/**
 * POST /api/whatsapp/webhook?key=<webhook_secret>
 *
 * Security layers:
 *  1. Webhook secret in URL — routes to correct user
 *  2. HMAC-SHA256 signature validation (x-hub-signature-256 header from Evolution API)
 *  3. Allowed numbers whitelist (E.164)
 *  4. In-memory rate limiting — 20 messages per phone per hour
 *  5. Message deduplication (recent message ID set)
 *  6. fromMe filter — skip bot's own outgoing messages
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { decryptApiKey } from "@/lib/whatsappCrypto";
import { handleWhatsAppMessage } from "@/lib/whatsappAgent";
import type { EvolutionConfig } from "@/lib/evolutionApi";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Map<phone, {count, windowStart}>
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX   = 20;
const RATE_LIMIT_MS    = 60 * 60 * 1000; // 1 hour

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(phone);
  if (!entry || now - entry.windowStart > RATE_LIMIT_MS) {
    rateLimitMap.set(phone, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

// ─── Deduplication ────────────────────────────────────────────────────────────
const seenMessageIds = new Set<string>();
const MAX_SEEN_IDS = 10_000;

function isDuplicate(msgId: string): boolean {
  if (seenMessageIds.has(msgId)) return true;
  seenMessageIds.add(msgId);
  if (seenMessageIds.size > MAX_SEEN_IDS) {
    // Evict oldest by deleting first entry
    seenMessageIds.delete(seenMessageIds.values().next().value!);
  }
  return false;
}

// ─── HMAC validation ──────────────────────────────────────────────────────────
function validateHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  // Expected format: sha256=<hex>
  const prefix = "sha256=";
  if (!signature.startsWith(prefix)) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const expectedBuf = Buffer.from(prefix + expected, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== sigBuf.length) return false;
  return timingSafeEqual(expectedBuf, sigBuf);
}

// ─── Normalize phone to E.164 ─────────────────────────────────────────────────
function normalizePhone(raw: string): string {
  // Evolution sends numbers like "972501234567@s.whatsapp.net"
  const digits = raw.replace(/@.*$/, "").replace(/\D/g, "");
  return "+" + digits;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const webhookKey = searchParams.get("key"); // URL is sync, searchParams.get() is sync
  if (!webhookKey) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  const sql = getDb();
  const [config] = await sql<{
    user_id: string;
    evolution_url: string;
    api_key_enc: string;
    api_key_iv: string;
    api_key_tag: string;
    instance_name: string;
    webhook_secret: string;
    allowed_numbers: string[] | string;
    bedrock_model: string;
    system_prompt: string | null;
  }[]>`
    SELECT user_id, evolution_url, api_key_enc, api_key_iv, api_key_tag,
           instance_name, webhook_secret::text, allowed_numbers, bedrock_model, system_prompt
    FROM whatsapp_config
    WHERE webhook_secret = ${webhookKey}::uuid
  `;

  if (config) {
    // Normalize allowed_numbers: jsonb may come back as a JSON string or already an array
    if (typeof config.allowed_numbers === "string") {
      try { config.allowed_numbers = JSON.parse(config.allowed_numbers); } catch { config.allowed_numbers = []; }
    }
    if (!Array.isArray(config.allowed_numbers)) config.allowed_numbers = [];
  }

  if (!config) return NextResponse.json({ ok: true }); // unknown key — silently ignore

  // HMAC validation — only enforce if Evolution sends the header (v2+).
  // v1.x does not send x-hub-signature-256, so skip when absent.
  if (signature && config.api_key_enc) {
    const apiKey = decryptApiKey(config.api_key_enc, config.api_key_iv, config.api_key_tag);
    if (!validateHmac(rawBody, signature, apiKey)) {
      console.warn("[whatsapp] HMAC mismatch — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body as Record<string, unknown>;

  // Only handle MESSAGES_UPSERT
  if (event.event !== "messages.upsert" && event.event !== "MESSAGES_UPSERT") {
    return NextResponse.json({ ok: true });
  }

  const messages = (event.data as Record<string, unknown>)?.messages as unknown[];
  if (!Array.isArray(messages)) return NextResponse.json({ ok: true });

  const evolutionCfg: EvolutionConfig = {
    url: config.evolution_url,
    apiKey: decryptApiKey(config.api_key_enc, config.api_key_iv, config.api_key_tag),
    instance: config.instance_name,
  };

  // Process each message (usually just one)
  for (const msg of messages) {
    const m = msg as Record<string, unknown>;
    const msgId = m.key ? (m.key as Record<string, unknown>).id as string : "";
    const fromMe = m.key ? !!(m.key as Record<string, unknown>).fromMe : false;
    const remoteJid = m.key ? (m.key as Record<string, unknown>).remoteJid as string : "";
    const text =
      (m.message as Record<string, unknown>)?.conversation as string ||
      ((m.message as Record<string, unknown>)?.extendedTextMessage as Record<string, unknown>)?.text as string ||
      "";

    // Skip own messages, empty text
    if (fromMe) continue;
    if (!text?.trim()) continue;
    if (!remoteJid) continue;

    // Deduplication
    if (msgId && isDuplicate(msgId)) continue;

    const phone = normalizePhone(remoteJid);

    // Whitelist check
    if (config.allowed_numbers.length > 0 && !config.allowed_numbers.includes(phone)) {
      console.log(`[whatsapp] blocked ${phone} — not in whitelist`);
      continue;
    }

    // Rate limiting
    if (isRateLimited(phone)) {
      console.log(`[whatsapp] rate limited ${phone}`);
      continue;
    }

    // Fire and forget — respond to Evolution API immediately
    handleWhatsAppMessage({
      userId: config.user_id,
      phone: remoteJid, // use original JID for sending
      text: text.trim(),
      evolutionCfg,
      modelId: config.bedrock_model,
      systemPrompt: config.system_prompt ?? undefined,
    }).catch((e) => console.error("[whatsapp] agent error:", e));
  }

  return NextResponse.json({ ok: true });
}
