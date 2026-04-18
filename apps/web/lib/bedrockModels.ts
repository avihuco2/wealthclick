/** Model list shared between client UI and server-side bedrock.ts. No AWS SDK imports. */

export const BEDROCK_MODELS = [
  // ── Anthropic Claude ──────────────────────────────────────────────────────
  { id: "anthropic.claude-3-haiku-20240307-v1:0",    label: "Claude 3 Haiku" },
  { id: "anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku" },
  { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet" },
  // ── Amazon Nova ───────────────────────────────────────────────────────────
  { id: "amazon.nova-micro-v1:0",                    label: "Nova Micro" },
  { id: "amazon.nova-lite-v1:0",                     label: "Nova Lite" },
  { id: "amazon.nova-pro-v1:0",                      label: "Nova Pro" },
  // ── Meta Llama ────────────────────────────────────────────────────────────
  { id: "meta.llama3-8b-instruct-v1:0",              label: "Llama 3 8B" },
  { id: "meta.llama3-70b-instruct-v1:0",             label: "Llama 3 70B" },
  // ── Mistral ───────────────────────────────────────────────────────────────
  { id: "mistral.ministral-3-3b-instruct",           label: "Ministral 3B" },
  { id: "mistral.ministral-3-8b-instruct",           label: "Ministral 8B" },
  { id: "mistral.ministral-3-14b-instruct",          label: "Ministral 14B" },
  { id: "mistral.mistral-7b-instruct-v0:2",          label: "Mistral 7B" },
  { id: "mistral.mixtral-8x7b-instruct-v0:1",        label: "Mixtral 8x7B" },
  { id: "mistral.magistral-small-2509",              label: "Magistral Small" },
  { id: "mistral.mistral-large-3-675b-instruct",     label: "Mistral Large 3" },
  // ── Qwen3 ─────────────────────────────────────────────────────────────────
  { id: "qwen.qwen3-32b-v1:0",                       label: "Qwen3 32B" },
  { id: "qwen.qwen3-next-80b-a3b",                   label: "Qwen3 80B (MoE)" },
  // ── Google Gemma ──────────────────────────────────────────────────────────
  { id: "google.gemma-3-4b-it",                      label: "Gemma 3 4B" },
  { id: "google.gemma-3-12b-it",                     label: "Gemma 3 12B" },
  { id: "google.gemma-3-27b-it",                     label: "Gemma 3 27B" },
  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { id: "deepseek.v3.2",                             label: "DeepSeek V3.2" },
  // ── Moonshot Kimi ─────────────────────────────────────────────────────────
  { id: "moonshotai.kimi-k2.5",                      label: "Kimi K2.5" },
  { id: "moonshot.kimi-k2-thinking",                 label: "Kimi K2 Thinking" },
  // ── NVIDIA Nemotron ───────────────────────────────────────────────────────
  { id: "nvidia.nemotron-nano-3-30b",                label: "Nemotron 30B" },
  { id: "nvidia.nemotron-super-3-120b",              label: "Nemotron 120B" },
  // ── AI21 Jamba ────────────────────────────────────────────────────────────
  { id: "ai21.jamba-1-5-mini-v1:0",                  label: "Jamba 1.5 Mini" },
  { id: "ai21.jamba-1-5-large-v1:0",                 label: "Jamba 1.5 Large" },
  // ── MiniMax ───────────────────────────────────────────────────────────────
  { id: "minimax.minimax-m2",                        label: "MiniMax M2" },
  { id: "minimax.minimax-m2.5",                      label: "MiniMax M2.5" },
  // ── Z.AI GLM ──────────────────────────────────────────────────────────────
  { id: "zai.glm-4.7-flash",                         label: "GLM 4.7 Flash" },
  { id: "zai.glm-4.7",                               label: "GLM 4.7" },
  { id: "zai.glm-5",                                 label: "GLM 5" },
  // ── Cohere Command ────────────────────────────────────────────────────────
  { id: "cohere.command-r-v1:0",                     label: "Command R" },
  { id: "cohere.command-r-plus-v1:0",                label: "Command R+" },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
