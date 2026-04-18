-- WhatsApp bot configuration per user
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  -- Evolution API connection
  evolution_url   TEXT        NOT NULL DEFAULT '',
  -- API key stored AES-256-GCM encrypted: base64(enc) | base64(iv) | base64(tag)
  api_key_enc     TEXT,
  api_key_iv      TEXT,
  api_key_tag     TEXT,
  -- Instance name for this user's WhatsApp session
  instance_name   TEXT        NOT NULL DEFAULT '',
  -- Webhook secret — unique UUID used in webhook URL: /api/whatsapp/webhook?key=<this>
  webhook_secret  UUID        NOT NULL DEFAULT gen_random_uuid(),
  -- Allowed phone numbers (E.164 list, stored as JSONB array e.g. ["+972501234567"])
  allowed_numbers JSONB       NOT NULL DEFAULT '[]',
  -- Bedrock model ID chosen by user
  bedrock_model   TEXT        NOT NULL DEFAULT 'anthropic.claude-3-haiku-20240307-v1:0',
  -- Optional system prompt override
  system_prompt   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation history per phone number (JSONB messages array)
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number    TEXT        NOT NULL,
  -- Array of {role: "user"|"assistant", content: [{type:"text",text:"..."}]}
  messages        JSONB       NOT NULL DEFAULT '[]',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_user_phone ON whatsapp_conversations (user_id, phone_number);
