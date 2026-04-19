ALTER TABLE whatsapp_config ADD COLUMN IF NOT EXISTS max_history integer NOT NULL DEFAULT 40;
