import { getDb } from "./db";

/**
 * Learn a user's explicit category choice for a description.
 * Only call on deliberate user actions (not auto-applied rules).
 */
export async function upsertCategoryRule(
  userId: string,
  description: string,
  categoryId: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO category_rules (user_id, description, category_id)
    VALUES (${userId}, ${description}, ${categoryId})
    ON CONFLICT (user_id, description)
    DO UPDATE SET category_id = ${categoryId}, updated_at = now()
  `;
}

/**
 * Apply stored rules to all uncategorized transactions for a user.
 * Returns the number of transactions updated.
 */
export async function applyRulesToUncategorized(userId: string): Promise<number> {
  const sql = getDb();
  const rows = await sql`
    UPDATE transactions t
    SET category_id = cr.category_id, updated_at = now()
    FROM category_rules cr
    WHERE t.user_id   = ${userId}
      AND cr.user_id  = ${userId}
      AND t.description = cr.description
      AND t.category_id IS NULL
    RETURNING t.id
  `;
  return rows.length;
}
