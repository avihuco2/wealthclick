import { createHash, randomBytes } from "crypto";
import { getDb } from "./db";

/** Generate a new raw API key token. Format: wc_<64 hex chars> */
export function generateApiKeyToken(): string {
  return "wc_" + randomBytes(32).toString("hex");
}

/** SHA-256 hash of the raw token — what we store in DB. */
export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Authenticate an incoming API request via Bearer token.
 * Updates last_used_at on success.
 * Returns userId on success, null on failure.
 */
export async function authenticateApiKey(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token.startsWith("wc_")) return null;

  const hash = hashApiKey(token);
  const sql = getDb();

  const rows = await sql<{ user_id: string }[]>`
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE key_hash = ${hash}
    RETURNING user_id
  `;

  return rows[0]?.user_id ?? null;
}
