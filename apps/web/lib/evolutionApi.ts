/**
 * Evolution API client — compatible with v1.8.x (Baileys-based).
 */

export interface EvolutionConfig {
  url: string;
  apiKey: string;
  instance: string;
}

async function evoFetch(cfg: EvolutionConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${cfg.url}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      apikey: cfg.apiKey,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution API ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

/** Create a new instance and configure its webhook (v1). */
export async function createInstance(cfg: EvolutionConfig, webhookUrl: string) {
  const createResult = await evoFetch(cfg, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: cfg.instance,
      qrcode: true,
    }),
  });

  // v1 webhook set — flat payload (no wrapper)
  await evoFetch(cfg, `/webhook/set/${cfg.instance}`, {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: true,
      webhookBase64: false,
      events: ["MESSAGES_UPSERT"],
    }),
  });

  return createResult;
}

/** Delete/remove an instance. */
export async function deleteInstance(cfg: EvolutionConfig) {
  return evoFetch(cfg, `/instance/delete/${cfg.instance}`, { method: "DELETE" });
}

/** Get QR code for the instance. */
export async function getQrCode(cfg: EvolutionConfig): Promise<{ base64?: string; pairingCode?: string; code?: string }> {
  return evoFetch(cfg, `/instance/connect/${cfg.instance}`);
}

/** Get connection status (v1). */
export async function getInstanceStatus(cfg: EvolutionConfig): Promise<{ instance: { state: string } }> {
  return evoFetch(cfg, `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`).then(
    (data: unknown) => {
      const arr = Array.isArray(data) ? data : [data];
      const inst = arr[0];
      if (!inst) return { instance: { state: "unknown" } };
      const state =
        inst?.connectionStatus ??
        inst?.instance?.status ??
        inst?.instance?.state ??
        inst?.state ??
        "unknown";
      return { instance: { state } };
    },
  );
}

/** Logout / disconnect instance. */
export async function logoutInstance(cfg: EvolutionConfig) {
  return evoFetch(cfg, `/instance/logout/${cfg.instance}`, { method: "DELETE" });
}

/**
 * Send a text message (v1).
 * Handles LID JIDs by using the Baileys relay endpoint which accepts full JIDs.
 */
export async function sendTextMessage(cfg: EvolutionConfig, to: string, text: string) {
  // v1 sendText doesn't support @lid JIDs — use sendMessage relay endpoint instead
  if (to.endsWith("@lid")) {
    return evoFetch(cfg, `/chat/sendMessage/${cfg.instance}`, {
      method: "POST",
      body: JSON.stringify({
        jid: to,
        message: { conversation: text },
      }),
    });
  }

  return evoFetch(cfg, `/message/sendText/${cfg.instance}`, {
    method: "POST",
    body: JSON.stringify({ number: to, textMessage: { text } }),
  });
}
