CREATE TABLE IF NOT EXISTS category_budgets (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id     UUID           NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  monthly_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

CREATE INDEX IF NOT EXISTS category_budgets_user_id_idx ON category_budgets (user_id);
