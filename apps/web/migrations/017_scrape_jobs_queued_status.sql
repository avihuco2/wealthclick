ALTER TABLE scrape_jobs
  DROP CONSTRAINT IF EXISTS scrape_jobs_status_check;

ALTER TABLE scrape_jobs
  ADD CONSTRAINT scrape_jobs_status_check
  CHECK (status IN ('queued', 'running', 'done', 'failed', 'awaiting_otp'));
