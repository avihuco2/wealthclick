/**
 * Model list shared between client UI and server-side bedrock.ts.
 * IDs use us. cross-region inference profile prefix where available —
 * bedrock.ts strips the prefix before calling the API to avoid SDK SerializationException.
 */

export const BEDROCK_MODELS = [
  // ── Anthropic Claude 4.x ─────────────────────────────────────────────────
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",  label: "Claude Haiku 4.5",      supportsTools: true  },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Claude Sonnet 4.5",     supportsTools: true  },
  { id: "us.anthropic.claude-sonnet-4-6",               label: "Claude Sonnet 4.6",     supportsTools: true  },
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0",   label: "Claude Opus 4.5",       supportsTools: true  },
  { id: "us.anthropic.claude-opus-4-6-v1",              label: "Claude Opus 4.6",       supportsTools: true  },
  { id: "us.anthropic.claude-opus-4-7",                 label: "Claude Opus 4.7",       supportsTools: true  },
  // ── Anthropic Claude 3.x ─────────────────────────────────────────────────
  { id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0", label: "Claude 3.7 Sonnet",     supportsTools: true  },
  { id: "us.anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku",      supportsTools: true  },
  { id: "anthropic.claude-3-haiku-20240307-v1:0",       label: "Claude 3 Haiku",        supportsTools: true  },
  // ── Amazon Nova ───────────────────────────────────────────────────────────
  { id: "us.amazon.nova-micro-v1:0",                    label: "Nova Micro",            supportsTools: false },
  { id: "us.amazon.nova-lite-v1:0",                     label: "Nova Lite",             supportsTools: true  },
  { id: "us.amazon.nova-pro-v1:0",                      label: "Nova Pro",              supportsTools: true  },
  // ── Meta Llama ────────────────────────────────────────────────────────────
  { id: "meta.llama3-8b-instruct-v1:0",                 label: "Llama 3 8B",            supportsTools: false },
  { id: "meta.llama3-70b-instruct-v1:0",                label: "Llama 3 70B",           supportsTools: false },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral.mistral-7b-instruct-v0:2",             label: "Mistral 7B",            supportsTools: false },
  { id: "mistral.mistral-large-2402-v1:0",              label: "Mistral Large",         supportsTools: true  },
  // ── Cohere Command ────────────────────────────────────────────────────────
  { id: "cohere.command-r-v1:0",                        label: "Command R",             supportsTools: true  },
  { id: "cohere.command-r-plus-v1:0",                   label: "Command R+",            supportsTools: true  },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
