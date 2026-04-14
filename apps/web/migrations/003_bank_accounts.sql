-- ─── bank_accounts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id            TEXT        NOT NULL,
  nickname              TEXT,
  credentials_encrypted TEXT        NOT NULL,
  last_scraped_at       TIMESTAMPTZ,
  last_error            TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                                    CHECK (status IN ('active', 'error', 'scraping')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bank_accounts_user_id_idx ON bank_accounts (user_id);

-- ─── scrape_jobs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scrape_jobs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_account_id  UUID        NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  status           TEXT        NOT NULL DEFAULT 'running'
                               CHECK (status IN ('running', 'done', 'failed')),
  imported_count   INTEGER,
  error            TEXT,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scrape_jobs_bank_account_idx ON scrape_jobs (bank_account_id);

-- ─── external_id on transactions (deduplication) ─────────────────────────────
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_external_id_idx
  ON transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;
