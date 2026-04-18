/**
 * Evolution API client — thin wrapper for WhatsApp instance management and messaging.
 */

export interface EvolutionConfig {
  url: string;   // e.g. https://evo.example.com
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

/** Create a new instance in Evolution API. */
export async function createInstance(cfg: EvolutionConfig, webhookUrl: string) {
  return evoFetch(cfg, "/instance/create", {
    method: "POST",
    body: JSON.stringify({
      instanceName: cfg.instance,
      qrcode: true,
      webhook: {
        enabled: true,
        url: webhookUrl,
        byEvents: true,
        base64: false,
        events: ["MESSAGES_UPSERT"],
      },
    }),
  });
}

/** Delete/remove an instance from Evolution API. */
export async function deleteInstance(cfg: EvolutionConfig) {
  return evoFetch(cfg, `/instance/delete/${cfg.instance}`, { method: "DELETE" });
}

/** Get QR code (base64 image) for the instance. */
export async function getQrCode(cfg: EvolutionConfig): Promise<{ base64?: string; pairingCode?: string; code?: string }> {
  return evoFetch(cfg, `/instance/connect/${cfg.instance}`);
}

/** Get connection status of instance. */
export async function getInstanceStatus(cfg: EvolutionConfig): Promise<{ instance: { state: string } }> {
  return evoFetch(cfg, `/instance/fetchInstances?instanceName=${encodeURIComponent(cfg.instance)}`).then(
    (data: unknown) => {
      const arr = Array.isArray(data) ? data : [data];
      const inst = arr[0];
      return { instance: { state: inst?.instance?.state ?? inst?.state ?? "unknown" } };
    },
  );
}

/** Logout / disconnect instance. */
export async function logoutInstance(cfg: EvolutionConfig) {
  return evoFetch(cfg, `/instance/logout/${cfg.instance}`, { method: "DELETE" });
}

/** Send a text message. */
export async function sendTextMessage(cfg: EvolutionConfig, to: string, text: string) {
  return evoFetch(cfg, `/message/sendText/${cfg.instance}`, {
    method: "POST",
    body: JSON.stringify({ number: to, text }),
  });
}
