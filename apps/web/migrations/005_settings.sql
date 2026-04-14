CREATE TABLE IF NOT EXISTS settings (
  key        TEXT        PRIMARY KEY,
  value      TEXT        NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default scrape interval (can be overridden by SCRAPE_INTERVAL_HOURS env var)
INSERT INTO settings (key, value)
VALUES ('scrape_interval_hours', '6')
ON CONFLICT (key) DO NOTHING;
