-- Seed default scrape history period (can be changed from the UI)
INSERT INTO settings (key, value)
VALUES ('scrape_history_months', '6')
ON CONFLICT (key) DO UPDATE SET value = '6' WHERE settings.value = '3';
