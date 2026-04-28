-- Add next_scrape_at column to bank_accounts
ALTER TABLE bank_accounts
ADD COLUMN next_scrape_at TIMESTAMPTZ;

-- Initialize to random time between 2-5 AM tomorrow in Asia/Jerusalem
UPDATE bank_accounts
SET next_scrape_at = (
  current_date + interval '1 day' +
  interval '2 hours' +
  (random() * interval '3 hours') +
  (row_number() OVER () * interval '10 minutes')
)
WHERE scrape_enabled = true;

CREATE INDEX idx_bank_accounts_next_scrape
ON bank_accounts(next_scrape_at)
WHERE scrape_enabled = true AND next_scrape_at IS NOT NULL;
