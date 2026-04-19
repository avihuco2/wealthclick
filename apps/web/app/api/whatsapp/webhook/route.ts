/**
 * POST /api/whatsapp/webhook?key=<webhook_secret>
 *
 * Receives webhook events from Evolution API v1.8.x.
 * v1 payload shape: { event, data: { key, message, pushName, ... }, sender }
 * — data is a single message, NOT { messages: [...] }.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { decryptApiKey } from "@/lib/whatsappCrypto";
import { handleWhatsAppMessage } from "@/lib/whatsappAgent";
import { sendTextMessage, type EvolutionConfig } from "@/lib/evolutionApi";

// ─── Rate limiting ────────────────────────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX   = 20;
const RATE_LIMIT_MS    = 60 * 60 * 1000;

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
    seenMessageIds.delete(seenMessageIds.values().next().value!);
  }
  return false;
}

// ─── HMAC validation ──────────────────────────────────────────────────────────
function validateHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
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
  const digits = raw.replace(/@.*$/, "").replace(/\D/g, "");
  return "+" + digits;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const webhookKey = searchParams.get("key");
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
    if (typeof config.allowed_numbers === "string") {
      try { config.allowed_numbers = JSON.parse(config.allowed_numbers); } catch { config.allowed_numbers = []; }
    }
    if (!Array.isArray(config.allowed_numbers)) config.allowed_numbers = [];
  }

  if (!config) return NextResponse.json({ ok: true });

  // HMAC — v1 doesn't send the header, skip when absent
  if (signature && config.api_key_enc) {
    const apiKey = decryptApiKey(config.api_key_enc, config.api_key_iv, config.api_key_tag);
    if (!validateHmac(rawBody, signature, apiKey)) {
      console.warn("[whatsapp] HMAC mismatch — rejected");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Debug: dump full payload to find phone number mapping
  console.log("[whatsapp] FULL PAYLOAD:", JSON.stringify(payload).substring(0, 2000));

  const eventName = payload.event as string ?? "";
  if (eventName !== "messages.upsert" && eventName !== "MESSAGES_UPSERT") {
    return NextResponse.json({ ok: true });
  }

  // v1: data is a single message object with key/message/sender at top level
  // v2: data.messages is an array
  const data = payload.data as Record<string, unknown> | undefined;
  if (!data) return NextResponse.json({ ok: true });

  // Normalize to array of messages
  let messages: Record<string, unknown>[];
  if (Array.isArray(data.messages)) {
    messages = data.messages as Record<string, unknown>[];
  } else if (data.key && data.message) {
    // v1 single-message format
    messages = [data as Record<string, unknown>];
  } else {
    console.log("[whatsapp] unrecognized payload shape:", JSON.stringify(data).substring(0, 200));
    return NextResponse.json({ ok: true });
  }

  // v1 sender = instance owner (bot), NOT the message author.
  // The actual sender is in key.remoteJid (may be LID format like 123@lid).

  const evolutionCfg: EvolutionConfig = {
    url: config.evolution_url,
    apiKey: decryptApiKey(config.api_key_enc, config.api_key_iv, config.api_key_tag),
    instance: config.instance_name,
  };

  for (const m of messages) {
    const key = m.key as Record<string, unknown> | undefined;
    const msgId = key?.id as string ?? "";
    const fromMe = !!key?.fromMe;
    const remoteJid = key?.remoteJid as string ?? "";
    // v1 Baileys uses LID (@lid) format — can't send back to LID via sendText.
    // Resolve to E.164 phone number: strip @lid digits are not the phone,
    // so use allowed_numbers list (if single entry) or fall back to remoteJid.
    const isLid = remoteJid.endsWith("@lid");
    const replyTo = isLid && config.allowed_numbers.length === 1
      ? config.allowed_numbers[0].replace(/^\+/, "") + "@s.whatsapp.net"
      : remoteJid;

    const messageContent = m.message as Record<string, unknown> | undefined;
    const text =
      (messageContent?.conversation as string) ||
      ((messageContent?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
      "";

    console.log(`[whatsapp] msg: id=${msgId} fromMe=${fromMe} jid=${remoteJid} text="${text.substring(0, 60)}"`);

    if (fromMe) continue;
    if (!text?.trim()) continue;
    if (!replyTo) continue;
    if (msgId && isDuplicate(msgId)) { console.log("[whatsapp] duplicate, skipping"); continue; }

    // v1 may use LID format (@lid) for remoteJid — phone extraction only works for @s.whatsapp.net
    const phone = normalizePhone(remoteJid);

    // Whitelist only applies when we have a real phone number (not LID)
    const isLid = remoteJid.endsWith("@lid");
    if (!isLid && config.allowed_numbers.length > 0 && !config.allowed_numbers.includes(phone)) {
      console.log(`[whatsapp] blocked ${phone} — not in whitelist`);
      continue;
    }

    if (isRateLimited(phone)) {
      console.log(`[whatsapp] rate limited ${phone}`);
      continue;
    }

    console.log(`[whatsapp] processing message from ${phone}, replying to ${replyTo}`);

    // DEBUG: echo directly to validate channel — remove when LLM flow verified
    sendTextMessage(evolutionCfg, replyTo, "OK — message received ✓")
      .then((res) => console.log("[whatsapp] echo sent OK:", JSON.stringify(res).substring(0, 200)))
      .catch((e) => console.error("[whatsapp] echo FAILED:", e));
    continue;

    // eslint-disable-next-line no-unreachable
    handleWhatsAppMessage({
      userId: config.user_id,
      phone: replyTo,
      text: text.trim(),
      evolutionCfg,
      modelId: config.bedrock_model,
      systemPrompt: config.system_prompt ?? undefined,
    }).catch((e) => console.error("[whatsapp] agent error:", e));
  }

  return NextResponse.json({ ok: true });
}
