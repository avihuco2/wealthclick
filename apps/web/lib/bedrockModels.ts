/** Model list shared between client UI and server-side bedrock.ts. No AWS SDK imports. */

export const BEDROCK_MODELS = [
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  // Using inference profile IDs (us.*) for cross-region routing + availability
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",  label: "Claude Haiku 4.5" },
  { id: "us.anthropic.claude-sonnet-4-5-20250929-v1:0", label: "Claude Sonnet 4.5" },
  { id: "us.anthropic.claude-sonnet-4-6",               label: "Claude Sonnet 4.6" },
  { id: "us.anthropic.claude-opus-4-5-20251101-v1:0",   label: "Claude Opus 4.5" },
  { id: "us.anthropic.claude-opus-4-6-v1",              label: "Claude Opus 4.6" },
  { id: "us.anthropic.claude-opus-4-7",                 label: "Claude Opus 4.7" },
  { id: "us.anthropic.claude-3-7-sonnet-20250219-v1:0", label: "Claude 3.7 Sonnet" },
  { id: "us.anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku" },
  { id: "us.anthropic.claude-3-haiku-20240307-v1:0",    label: "Claude 3 Haiku (legacy)" },
  // ── Amazon Nova ───────────────────────────────────────────────────────────
  { id: "us.amazon.nova-micro-v1:0",                    label: "Nova Micro" },
  { id: "us.amazon.nova-lite-v1:0",                     label: "Nova Lite" },
  { id: "us.amazon.nova-2-lite-v1:0",                   label: "Nova 2 Lite" },
  { id: "us.amazon.nova-pro-v1:0",                      label: "Nova Pro" },
  { id: "us.amazon.nova-premier-v1:0",                  label: "Nova Premier" },
  // ── Meta Llama ────────────────────────────────────────────────────────────
  { id: "meta.llama3-8b-instruct-v1:0",                 label: "Llama 3 8B" },
  { id: "meta.llama3-70b-instruct-v1:0",                label: "Llama 3 70B" },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral.ministral-3-3b-instruct",              label: "Ministral 3B" },
  { id: "mistral.ministral-3-8b-instruct",              label: "Ministral 8B" },
  { id: "mistral.ministral-3-14b-instruct",             label: "Ministral 14B" },
  { id: "mistral.mistral-7b-instruct-v0:2",             label: "Mistral 7B" },
  { id: "mistral.mixtral-8x7b-instruct-v0:1",           label: "Mixtral 8x7B" },
  { id: "mistral.magistral-small-2509",                 label: "Magistral Small" },
  { id: "mistral.mistral-large-3-675b-instruct",        label: "Mistral Large 3" },
  // ── Qwen3 ─────────────────────────────────────────────────────────────────
  { id: "qwen.qwen3-32b-v1:0",                          label: "Qwen3 32B" },
  { id: "qwen.qwen3-next-80b-a3b",                      label: "Qwen3 80B (MoE)" },
  // ── Google Gemma ──────────────────────────────────────────────────────────
  { id: "google.gemma-3-4b-it",                         label: "Gemma 3 4B" },
  { id: "google.gemma-3-12b-it",                        label: "Gemma 3 12B" },
  { id: "google.gemma-3-27b-it",                        label: "Gemma 3 27B" },
  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { id: "deepseek.v3.2",                                label: "DeepSeek V3.2" },
  // ── Moonshot Kimi ─────────────────────────────────────────────────────────
  { id: "moonshotai.kimi-k2.5",                         label: "Kimi K2.5" },
  { id: "moonshot.kimi-k2-thinking",                    label: "Kimi K2 Thinking" },
  // ── NVIDIA Nemotron ───────────────────────────────────────────────────────
  { id: "nvidia.nemotron-nano-3-30b",                   label: "Nemotron 30B" },
  { id: "nvidia.nemotron-super-3-120b",                 label: "Nemotron 120B" },
  // ── AI21 Jamba ────────────────────────────────────────────────────────────
  { id: "ai21.jamba-1-5-mini-v1:0",                     label: "Jamba 1.5 Mini" },
  { id: "ai21.jamba-1-5-large-v1:0",                    label: "Jamba 1.5 Large" },
  // ── MiniMax ───────────────────────────────────────────────────────────────
  { id: "minimax.minimax-m2",                           label: "MiniMax M2" },
  { id: "minimax.minimax-m2.5",                         label: "MiniMax M2.5" },
  // ── Z.AI GLM ──────────────────────────────────────────────────────────────
  { id: "zai.glm-4.7-flash",                            label: "GLM 4.7 Flash" },
  { id: "zai.glm-4.7",                                  label: "GLM 4.7" },
  { id: "zai.glm-5",                                    label: "GLM 5" },
  // ── Cohere Command ────────────────────────────────────────────────────────
  { id: "cohere.command-r-v1:0",                        label: "Command R" },
  { id: "cohere.command-r-plus-v1:0",                   label: "Command R+" },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
