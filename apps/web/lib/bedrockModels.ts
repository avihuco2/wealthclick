/** Model list shared between client UI and server-side bedrock.ts. No AWS SDK imports. */

export const BEDROCK_MODELS = [
  { id: "anthropic.claude-3-haiku-20240307-v1:0",    label: "Claude 3 Haiku (fast)" },
  { id: "anthropic.claude-3-5-haiku-20241022-v1:0",  label: "Claude 3.5 Haiku (smart)" },
  { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet (powerful)" },
  { id: "amazon.nova-micro-v1:0",                     label: "Amazon Nova Micro (cheap)" },
  { id: "amazon.nova-lite-v1:0",                      label: "Amazon Nova Lite" },
] as const;

export type BedrockModelId = (typeof BEDROCK_MODELS)[number]["id"];
