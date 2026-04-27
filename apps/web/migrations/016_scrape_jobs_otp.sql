-- Add OTP relay support to scrape_jobs
ALTER TABLE scrape_jobs
  DROP CONSTRAINT IF EXISTS scrape_jobs_status_check;

ALTER TABLE scrape_jobs
  ADD CONSTRAINT scrape_jobs_status_check
  CHECK (status IN ('running', 'done', 'failed', 'awaiting_otp'));

ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE scrape_jobs ADD COLUMN IF NOT EXISTS otp_requested_at TIMESTAMPTZ;
