-- Stores user's explicit description→category mappings for auto-categorization
CREATE TABLE IF NOT EXISTS category_rules (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  description TEXT        NOT NULL,
  category_id UUID        NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, description)
);

CREATE INDEX IF NOT EXISTS category_rules_user_idx ON category_rules(user_id);
