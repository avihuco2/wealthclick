/**
 * AES-256-GCM encryption for Evolution API keys.
 * Key comes from WHATSAPP_ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getKey(): Buffer {
  const hex = process.env.WHATSAPP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("WHATSAPP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptApiKey(plaintext: string): { enc: string; iv: string; tag: string } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: enc.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptApiKey(enc: string, iv: string, tag: string): string {
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return decipher.update(Buffer.from(enc, "base64")) + decipher.final("utf8");
}
