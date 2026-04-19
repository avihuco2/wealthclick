/**
 * WhatsApp agent orchestrator.
 * Load conversation history → call Bedrock → send reply → persist updated history.
 */

import { getDb } from "./db";
import { converseWithTools, type ConverseTurnResult } from "./bedrock";
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
}): Promise<void> {
  const { userId, phone, text, evolutionCfg, modelId, systemPrompt } = opts;
  const sql = getDb();

  // Load conversation history
  const [conv] = await sql<{ messages: Message[] }[]>`
    SELECT messages FROM whatsapp_conversations
    WHERE user_id = ${userId} AND phone_number = ${phone}
  `;

  // Normalize messages from DB — strip SDK-internal properties that break Bedrock on re-submission
  const rawHistory = conv?.messages ?? [];
  const history: Message[] = (rawHistory as unknown as Record<string, unknown>[]).map((m) => ({
    role: m.role as "user" | "assistant",
    content: ((m.content as Record<string, unknown>[]) ?? []).map((block): ContentBlock => {
      if ("text" in block) return { text: block.text as string };
      if ("toolUse" in block) return { toolUse: block.toolUse } as unknown as ContentBlock;
      if ("toolResult" in block) return { toolResult: block.toolResult } as unknown as ContentBlock;
      return block as unknown as ContentBlock;
    }),
  }));

  // Append new user message
  const updatedHistory: Message[] = [
    ...history,
    { role: "user", content: [{ text }] },
  ];

  // Call Bedrock
  let result: ConverseTurnResult;
  try {
    result = await converseWithTools({ userId, modelId, messages: updatedHistory, systemPrompt });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[whatsappAgent] Bedrock error:", errMsg);
    await sendTextMessage(evolutionCfg, phone, "Sorry, I ran into an error. Please try again.");
    return;
  }

  // Send reply
  await sendTextMessage(evolutionCfg, phone, result.reply);

  // Persist trimmed history
  const toSave = result.updatedMessages.slice(-MAX_HISTORY);

  await sql`
    INSERT INTO whatsapp_conversations (user_id, phone_number, messages, last_message_at)
    VALUES (${userId}, ${phone}, ${JSON.stringify(toSave)}, NOW())
    ON CONFLICT (user_id, phone_number)
    DO UPDATE SET messages = ${JSON.stringify(toSave)}, last_message_at = NOW()
  `;
}
