/**
 * GET  /api/whatsapp/config — fetch config (no plaintext API key)
 * PUT  /api/whatsapp/config — save / update config
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { encryptApiKey } from "@/lib/whatsappCrypto";

function authFail() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return authFail();

  const sql = getDb();
  const [row] = await sql<{
    id: string;
    evolution_url: string;
    has_api_key: boolean;
    instance_name: string;
    webhook_secret: string;
    allowed_numbers: string[];
    bedrock_model: string;
    system_prompt: string | null;
    max_history: number;
  }[]>`
    SELECT id, evolution_url,
           (api_key_enc IS NOT NULL) AS has_api_key,
           instance_name, webhook_secret::text,
           allowed_numbers, bedrock_model, system_prompt, max_history
    FROM whatsapp_config WHERE user_id = ${session.user.id}
  `;

  if (row && typeof row.allowed_numbers === "string") {
    try { row.allowed_numbers = JSON.parse(row.allowed_numbers as unknown as string); } catch { row.allowed_numbers = []; }
  }
  if (row && !Array.isArray(row.allowed_numbers)) row.allowed_numbers = [];

  return NextResponse.json({ config: row ?? null });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return authFail();

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const {
    evolution_url,
    api_key,
    instance_name,
    allowed_numbers,
    bedrock_model,
    system_prompt,
    max_history,
  } = body as Record<string, unknown>;

  const maxHistoryVal = Math.max(1, Math.min(200, Number(max_history) || 40));

  const sql = getDb();

  let keyFields: Record<string, string> = {};
  if (api_key && typeof api_key === "string" && api_key.trim()) {
    const { enc, iv, tag } = encryptApiKey(api_key.trim());
    keyFields = { api_key_enc: enc, api_key_iv: iv, api_key_tag: tag };
  }

  const [existing] = await sql<{ id: string }[]>`
    SELECT id FROM whatsapp_config WHERE user_id = ${session.user.id}
  `;

  if (existing) {
    if (Object.keys(keyFields).length > 0) {
      await sql`
        UPDATE whatsapp_config SET
          evolution_url   = ${evolution_url as string},
          api_key_enc     = ${keyFields.api_key_enc},
          api_key_iv      = ${keyFields.api_key_iv},
          api_key_tag     = ${keyFields.api_key_tag},
          instance_name   = ${instance_name as string},
          allowed_numbers = ${JSON.stringify(allowed_numbers ?? [])}::jsonb,
          bedrock_model   = ${bedrock_model as string},
          system_prompt   = ${system_prompt as string | null},
          max_history     = ${maxHistoryVal},
          updated_at      = NOW()
        WHERE user_id = ${session.user.id}
      `;
    } else {
      await sql`
        UPDATE whatsapp_config SET
          evolution_url   = ${evolution_url as string},
          instance_name   = ${instance_name as string},
          allowed_numbers = ${JSON.stringify(allowed_numbers ?? [])}::jsonb,
          bedrock_model   = ${bedrock_model as string},
          system_prompt   = ${system_prompt as string | null},
          max_history     = ${maxHistoryVal},
          updated_at      = NOW()
        WHERE user_id = ${session.user.id}
      `;
    }
  } else {
    if (!keyFields.api_key_enc) {
      return NextResponse.json({ error: "api_key required on first save" }, { status: 400 });
    }
    await sql`
      INSERT INTO whatsapp_config
        (user_id, evolution_url, api_key_enc, api_key_iv, api_key_tag,
         instance_name, allowed_numbers, bedrock_model, system_prompt, max_history)
      VALUES (
        ${session.user.id}, ${evolution_url as string},
        ${keyFields.api_key_enc}, ${keyFields.api_key_iv}, ${keyFields.api_key_tag},
        ${instance_name as string}, ${JSON.stringify(allowed_numbers ?? [])}::jsonb,
        ${bedrock_model as string}, ${system_prompt as string | null}, ${maxHistoryVal}
      )
    `;
  }

  return NextResponse.json({ ok: true });
}
