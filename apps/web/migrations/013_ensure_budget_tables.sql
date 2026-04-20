-- Ensure budget tables exist (idempotent re-creation in case migration 012 was skipped)
CREATE TABLE IF NOT EXISTS category_budgets (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    UUID           NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month          CHAR(7)        NOT NULL,
  monthly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);

CREATE INDEX IF NOT EXISTS category_budgets_user_month_idx ON category_budgets (user_id, month);

CREATE TABLE IF NOT EXISTS budget_income (
  id                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month             CHAR(7)        NOT NULL,
  forecasted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (forecasted_amount >= 0),
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);

CREATE INDEX IF NOT EXISTS budget_income_user_month_idx ON budget_income (user_id, month);
