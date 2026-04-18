import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { decryptApiKey } from "@/lib/whatsappCrypto";
import { logoutInstance } from "@/lib/evolutionApi";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getDb();
  const [cfg] = await sql<{
    evolution_url: string; api_key_enc: string; api_key_iv: string; api_key_tag: string; instance_name: string;
  }[]>`
    SELECT evolution_url, api_key_enc, api_key_iv, api_key_tag, instance_name
    FROM whatsapp_config WHERE user_id = ${session.user.id}
  `;
  if (!cfg) return NextResponse.json({ error: "WhatsApp not configured" }, { status: 400 });

  const apiKey = decryptApiKey(cfg.api_key_enc, cfg.api_key_iv, cfg.api_key_tag);
  await logoutInstance({ url: cfg.evolution_url, apiKey, instance: cfg.instance_name });
  return NextResponse.json({ ok: true });
}
