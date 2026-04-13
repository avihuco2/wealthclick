-- ─── categories ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_en    TEXT        NOT NULL,
  name_he    TEXT        NOT NULL,
  color      TEXT        NOT NULL,
  icon       TEXT        NOT NULL,
  emoji      TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories (user_id);

-- Add emoji column to existing tables (idempotent)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS emoji TEXT NOT NULL DEFAULT '';

-- Backfill emoji for default categories seeded before this column existed
UPDATE categories SET emoji = '🍔' WHERE name_en = 'Food & Dining'     AND emoji = '';
UPDATE categories SET emoji = '🚗' WHERE name_en = 'Transportation'    AND emoji = '';
UPDATE categories SET emoji = '🛍️' WHERE name_en = 'Shopping'          AND emoji = '';
UPDATE categories SET emoji = '🎮' WHERE name_en = 'Entertainment'     AND emoji = '';
UPDATE categories SET emoji = '💊' WHERE name_en = 'Health & Medical'  AND emoji = '';
UPDATE categories SET emoji = '🏠' WHERE name_en = 'Housing & Rent'    AND emoji = '';
UPDATE categories SET emoji = '📚' WHERE name_en = 'Education'         AND emoji = '';
UPDATE categories SET emoji = '✈️' WHERE name_en = 'Travel'            AND emoji = '';
UPDATE categories SET emoji = '⚡' WHERE name_en = 'Utilities & Bills' AND emoji = '';
UPDATE categories SET emoji = '💼' WHERE name_en = 'Salary'            AND emoji = '';
UPDATE categories SET emoji = '📈' WHERE name_en = 'Other Income'      AND emoji = '';
UPDATE categories SET emoji = '📌' WHERE name_en = 'Other'             AND emoji = '';

-- ─── transactions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID           REFERENCES categories(id) ON DELETE SET NULL,
  account     TEXT,
  date        DATE           NOT NULL,
  amount      NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  description TEXT           NOT NULL,
  type        TEXT           NOT NULL CHECK (type IN ('income', 'expense')),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON transactions (user_id, date DESC);
