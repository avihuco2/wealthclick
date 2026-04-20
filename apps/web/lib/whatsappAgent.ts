/**
 * WhatsApp agent orchestrator.
 * Load conversation history → call Bedrock → send reply → persist updated history.
 */

import { getDb } from "./db";
import { converseWithTools, type ConverseTurnResult } from "./bedrock";
import { converseWithGoogleAI } from "./googleAI";
import { ALL_MODELS, getModelProvider } from "./bedrockModels";
import { sendTextMessage, type EvolutionConfig } from "./evolutionApi";
import type { Message, ContentBlock } from "@aws-sdk/client-bedrock-runtime";

// Max messages to keep in history (older messages trimmed from the start, keeping system coherence)
const MAX_HISTORY = 40;

export async function handleWhatsAppMessage(opts: {
  userId: string;
  phone: string;
  text: string;
  evolutionCfg: EvolutionConfig;
  modelId: string;
  systemPrompt?: string;
  maxHistory?: number;
}): Promise<void> {
  const { userId, phone, text, evolutionCfg, modelId, systemPrompt, maxHistory = 40 } = opts;
  const sql = getDb();

  // Load conversation history
  const [conv] = await sql<{ messages: unknown }[]>`
    SELECT messages FROM whatsapp_conversations
    WHERE user_id = ${userId} AND phone_number = ${phone}
  `;

  // Normalize messages from DB — may be a JSON string or parsed array depending on postgres-js version
  let rawHistory: Record<string, unknown>[];
  const rawMessages = conv?.messages ?? [];
  if (typeof rawMessages === "string") {
    try { rawHistory = JSON.parse(rawMessages); } catch { rawHistory = []; }
  } else {
    rawHistory = rawMessages as Record<string, unknown>[];
  }
  if (!Array.isArray(rawHistory)) rawHistory = [];
  const history: Message[] = (rawHistory as unknown as Record<string, unknown>[]).map((m) => ({
    role: m.role as "user" | "assistant",
    content: ((m.content as Record<string, unknown>[]) ?? []).map((block): ContentBlock => {
      if ("text" in block) return { text: block.text as string };
      if ("toolUse" in block) return { toolUse: block.toolUse } as unknown as ContentBlock;
      if ("toolResult" in block) return { toolResult: block.toolResult } as unknown as ContentBlock;
      return block as unknown as ContentBlock;
    }),
  }));

  // Trim history to maxHistory, but always start at a clean user text message
  // (never start with a toolResult user message — Bedrock rejects that)
  let trimmed = history.slice(-maxHistory);
  while (trimmed.length > 0) {
    const first = trimmed[0];
    const firstContent = first.content ?? [];
    const isToolResult = firstContent.some((b) => "toolResult" in b);
    if (first.role !== "user" || isToolResult) {
      trimmed = trimmed.slice(1);
    } else {
      break;
    }
  }

  // Append new user message
  const updatedHistory: Message[] = [
    ...trimmed,
    { role: "user", content: [{ text }] },
  ];

  // Route to correct provider
  const provider = getModelProvider(modelId);
  const modelEntry = ALL_MODELS.find((m) => m.id === modelId);
  const supportsTools = modelEntry?.supportsTools ?? (provider === "bedrock");
  let result: ConverseTurnResult;
  try {
    if (provider === "google") {
      result = await converseWithGoogleAI({ userId, modelId, messages: updatedHistory, systemPrompt, supportsTools });
    } else {
      result = await converseWithTools({ userId, modelId, messages: updatedHistory, systemPrompt });
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const errName = e instanceof Error ? e.constructor.name : "Unknown";
    console.error(`[whatsappAgent] ${provider} error:`, errName, errMsg, JSON.stringify(e, null, 2));
    await sendTextMessage(evolutionCfg, phone, `Error (${provider}/${modelId}): ${errMsg.slice(0, 200)}`);
    return;
  }

  // Send reply
  await sendTextMessage(evolutionCfg, phone, result.reply);

  // Persist trimmed history — ensure we don't start mid-tool-use-chain
  let toSave = result.updatedMessages.slice(-maxHistory);
  while (toSave.length > 0) {
    const first = toSave[0];
    const isToolResult = (first.content ?? []).some((b) => "toolResult" in b);
    if (first.role !== "user" || isToolResult) { toSave = toSave.slice(1); } else { break; }
  }

  await sql`
    INSERT INTO whatsapp_conversations (user_id, phone_number, messages, last_message_at)
    VALUES (${userId}, ${phone}, ${JSON.stringify(toSave)}::jsonb, NOW())
    ON CONFLICT (user_id, phone_number)
    DO UPDATE SET messages = ${JSON.stringify(toSave)}::jsonb, last_message_at = NOW()
  `;
}
