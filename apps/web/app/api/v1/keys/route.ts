import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateApiKeyToken, hashApiKey } from "@/lib/apiAuth";

// GET — list API keys for the authenticated user (no plaintext returned)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  const keys = await sql<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>`
    SELECT id, name, created_at, last_used_at
    FROM api_keys
    WHERE user_id = ${session.user.id}
    ORDER BY created_at DESC
  `;

  return NextResponse.json({ data: keys });
}

// POST — create a new API key; returns the raw token ONCE (not stored)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name: string = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Default";

  const sql = getDb();

  // Enforce a reasonable limit per user
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM api_keys WHERE user_id = ${session.user.id}
  `;
  if (parseInt(count, 10) >= 10) {
    return NextResponse.json({ error: "Maximum of 10 API keys per user" }, { status: 429 });
  }

  const token = generateApiKeyToken();
  const hash = hashApiKey(token);

  const [key] = await sql<{ id: string }[]>`
    INSERT INTO api_keys (user_id, name, key_hash)
    VALUES (${session.user.id}, ${name}, ${hash})
    RETURNING id
  `;

  return NextResponse.json(
    {
      id: key.id,
      name,
      token, // shown ONCE — user must copy it now
      warning: "Store this token securely. It will not be shown again.",
    },
    { status: 201 },
  );
}

// DELETE — revoke an API key by id
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const sql = getDb();
  const rows = await sql`
    DELETE FROM api_keys
    WHERE id = ${body.id} AND user_id = ${session.user.id}
    RETURNING id
  `;

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ deleted: body.id });
}
