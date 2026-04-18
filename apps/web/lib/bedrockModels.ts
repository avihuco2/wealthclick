/** Model list shared between client UI and server-side bedrock.ts. No AWS SDK imports. */

export const BEDROCK_MODELS = [
  // Anthropic Claude
  { id: "anthropic.claude-3-haiku-20240307-v1:0",    label: "Claude 3 Haiku (fast)" },
  { id: "anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku (smart)" },
  { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet (powerful)" },
  // Amazon Nova
  { id: "amazon.nova-micro-v1:0",                     label: "Amazon Nova Micro (cheap)" },
  { id: "amazon.nova-lite-v1:0",                      label: "Amazon Nova Lite" },
  // Qwen3
  { id: "qwen.qwen3-32b-v1:0",                        label: "Qwen3 32B" },
  { id: "qwen.qwen3-next-80b-a3b",                    label: "Qwen3 80B (MoE)" },
  // Gemma 3
  { id: "google.gemma-3-4b-it",                       label: "Gemma 3 4B (fast)" },
  { id: "google.gemma-3-12b-it",                      label: "Gemma 3 12B" },
  { id: "google.gemma-3-27b-it",                      label: "Gemma 3 27B" },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
