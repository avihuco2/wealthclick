/** Model list shared between client UI and server-side bedrock.ts. No AWS SDK imports. */

export const BEDROCK_MODELS = [
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  // Direct model IDs (no us. prefix) to avoid SDK SerializationException with tools
  { id: "anthropic.claude-3-haiku-20240307-v1:0",       label: "Claude 3 Haiku",        supportsTools: true  },
  { id: "anthropic.claude-3-5-haiku-20241022-v1:0",     label: "Claude 3.5 Haiku",      supportsTools: true  },
  { id: "anthropic.claude-3-7-sonnet-20250219-v1:0",    label: "Claude 3.7 Sonnet",     supportsTools: true  },
  // ── Amazon Nova ───────────────────────────────────────────────────────────
  { id: "amazon.nova-micro-v1:0",                       label: "Nova Micro",            supportsTools: false },
  { id: "amazon.nova-lite-v1:0",                        label: "Nova Lite",             supportsTools: true  },
  { id: "amazon.nova-pro-v1:0",                         label: "Nova Pro",              supportsTools: true  },
  // ── Meta Llama ────────────────────────────────────────────────────────────
  { id: "meta.llama3-8b-instruct-v1:0",                 label: "Llama 3 8B",            supportsTools: false },
  { id: "meta.llama3-70b-instruct-v1:0",                label: "Llama 3 70B",           supportsTools: false },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral.mistral-7b-instruct-v0:2",             label: "Mistral 7B",            supportsTools: false },
  { id: "mistral.mixtral-8x7b-instruct-v0:1",           label: "Mixtral 8x7B",          supportsTools: false },
  { id: "mistral.mistral-large-2402-v1:0",              label: "Mistral Large",         supportsTools: true  },
  // ── Cohere Command ────────────────────────────────────────────────────────
  { id: "cohere.command-r-v1:0",                        label: "Command R",             supportsTools: true  },
  { id: "cohere.command-r-plus-v1:0",                   label: "Command R+",            supportsTools: true  },
  // ── AI21 Jamba ────────────────────────────────────────────────────────────
  { id: "ai21.jamba-1-5-mini-v1:0",                     label: "Jamba 1.5 Mini",        supportsTools: false },
  { id: "ai21.jamba-1-5-large-v1:0",                    label: "Jamba 1.5 Large",       supportsTools: false },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
