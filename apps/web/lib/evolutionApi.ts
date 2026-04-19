/**
 * Evolution API client — compatible with v2.2.x (Baileys 6.x with LID support).
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

/** Create a new instance and configure its webhook. */
export async function createInstance(cfg: EvolutionConfig, webhookUrl: string) {
  const createResult = await evoFetch(cfg, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: cfg.instance,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

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

/** Get connection status. */
export async function getInstanceStatus(cfg: EvolutionConfig): Promise<{ instance: { state: string } }> {
  return evoFetch(cfg, `/instance/connectionState/${cfg.instance}`).then(
    (data: Record<string, unknown>) => {
      const state = (data?.instance as Record<string, unknown>)?.state as string ?? data?.state as string ?? "unknown";
      return { instance: { state } };
    },
  ).catch(() => {
    // Fallback to fetchInstances for v1 compat
    return evoFetch(cfg, `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`).then(
      (data: unknown) => {
        const arr = Array.isArray(data) ? data : [data];
        const inst = arr[0];
        if (!inst) return { instance: { state: "unknown" } };
        const state = inst?.connectionStatus ?? inst?.instance?.status ?? inst?.instance?.state ?? inst?.state ?? "unknown";
        return { instance: { state } };
      },
    );
  });
}

/** Logout / disconnect instance. */
export async function logoutInstance(cfg: EvolutionConfig) {
  return evoFetch(cfg, `/instance/logout/${cfg.instance}`, { method: "DELETE" });
}

/** Send a text message — works with both phone numbers and LID JIDs. */
export async function sendTextMessage(cfg: EvolutionConfig, to: string, text: string) {
  return evoFetch(cfg, `/message/sendText/${cfg.instance}`, {
    method: "POST",
    body: JSON.stringify({ number: to, text }),
  });
}
