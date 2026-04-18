import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decryptApiKey } from "@/lib/whatsappCrypto";
import { createInstance } from "@/lib/evolutionApi";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const [cfg] = await sql<{
    evolution_url: string; api_key_enc: string; api_key_iv: string; api_key_tag: string;
    instance_name: string; webhook_secret: string;
  }[]>`
    SELECT evolution_url, api_key_enc, api_key_iv, api_key_tag, instance_name, webhook_secret::text
    FROM whatsapp_config WHERE user_id = ${session.user.id}
  `;
  if (!cfg) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });

  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/api/whatsapp/webhook?key=${cfg.webhook_secret}`;
  const apiKey = decryptApiKey(cfg.api_key_enc, cfg.api_key_iv, cfg.api_key_tag);

  try {
    const result = await createInstance(
      { url: cfg.evolution_url, apiKey, instance: cfg.instance_name },
      webhookUrl,
    );
    console.log("[WA create] success:", JSON.stringify(result).substring(0, 300));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[WA create] Evolution API error:", err);
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
