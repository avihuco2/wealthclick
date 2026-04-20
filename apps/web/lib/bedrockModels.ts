/**
 * Model list shared between client UI and server-side bedrock.ts.
 * IDs use us. cross-region inference profile prefix where available —
 * bedrock.ts strips the prefix before calling the API to avoid SDK SerializationException.
 */

export const BEDROCK_MODELS = [
  // ── Anthropic Claude 4.x ─────────────────────────────────────────────────
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",  label: "Claude Haiku 4.5",      provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Claude Sonnet 4.5",     provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-sonnet-4-6",               label: "Claude Sonnet 4.6",     provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0",   label: "Claude Opus 4.5",       provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-opus-4-6-v1",              label: "Claude Opus 4.6",       provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-opus-4-7",                 label: "Claude Opus 4.7",       provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  // ── Anthropic Claude 3.x ─────────────────────────────────────────────────
  { id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0", label: "Claude 3.7 Sonnet",     provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "us.anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku",      provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "anthropic.claude-3-haiku-20240307-v1:0",       label: "Claude 3 Haiku",        provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  // ── Amazon Nova ───────────────────────────────────────────────────────────
  { id: "us.amazon.nova-micro-v1:0",                    label: "Nova Micro",            provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  { id: "us.amazon.nova-lite-v1:0",                     label: "Nova Lite",             provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  { id: "us.amazon.nova-pro-v1:0",                      label: "Nova Pro",              provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  // ── Meta Llama ────────────────────────────────────────────────────────────
  { id: "meta.llama3-8b-instruct-v1:0",                 label: "Llama 3 8B",            provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  { id: "meta.llama3-70b-instruct-v1:0",                label: "Llama 3 70B",           provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral.mistral-7b-instruct-v0:2",             label: "Mistral 7B",            provider: "bedrock" as const, supportsTools: false, supportsSystem: true  },
  { id: "mistral.mistral-large-2402-v1:0",              label: "Mistral Large",         provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  // ── Cohere Command ────────────────────────────────────────────────────────
  { id: "cohere.command-r-v1:0",                        label: "Command R",             provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  { id: "cohere.command-r-plus-v1:0",                   label: "Command R+",            provider: "bedrock" as const, supportsTools: true,  supportsSystem: true  },
  // ── Google Gemma 3 (via Bedrock) ──────────────────────────────────────────
  { id: "google.gemma-3-27b-it",                        label: "Gemma 3 27B",           provider: "bedrock" as const, supportsTools: false, supportsSystem: false },
  { id: "google.gemma-3-12b-it",                        label: "Gemma 3 12B",           provider: "bedrock" as const, supportsTools: false, supportsSystem: false },
  { id: "google.gemma-3-4b-it",                         label: "Gemma 3 4B",            provider: "bedrock" as const, supportsTools: false, supportsSystem: false },
] as const;

// ── Google AI models ──────────────────────────────────────────────────────────
export const GOOGLE_MODELS = [
  { id: "gemma-3-27b-it", label: "Gemma 3 27B", provider: "google" as const, supportsTools: true  },
  { id: "gemma-3-12b-it", label: "Gemma 3 12B", provider: "google" as const, supportsTools: true  },
  { id: "gemma-3-4b-it",  label: "Gemma 3 4B",  provider: "google" as const, supportsTools: false },
  { id: "gemma-3-1b-it",  label: "Gemma 3 1B",  provider: "google" as const, supportsTools: false },
] as const;

export const ALL_MODELS = [...BEDROCK_MODELS, ...GOOGLE_MODELS] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
export type GoogleModelId  = (typeof GOOGLE_MODELS)[number]["id"];
export type AnyModelId     = (typeof ALL_MODELS)[number]["id"];

export function getModelProvider(modelId: string): "bedrock" | "google" {
  const m = ALL_MODELS.find((x) => x.id === modelId);
  return m?.provider ?? "bedrock";
}
