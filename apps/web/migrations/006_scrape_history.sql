-- Seed default scrape history period (can be changed from the UI)
INSERT INTO settings (key, value)
VALUES ('scrape_history_months', '3')
ON CONFLICT (key) DO NOTHING;
