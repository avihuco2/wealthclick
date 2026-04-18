"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { BEDROCK_MODELS, type BedrockModelId } from "@/lib/bedrockModels";

interface WhatsAppConfig {
  id: string;
  evolution_url: string;
  has_api_key: boolean;
  instance_name: string;
  webhook_secret: string;
  allowed_numbers: string[];
  bedrock_model: string;
  system_prompt: string | null;
}

type ConnectionState = "unconfigured" | "qr" | "connected" | "error";

interface Props {
  t: {
    title: string;
    desc: string;
    evolutionUrl: string;
    evolutionUrlPlaceholder: string;
    apiKey: string;
    apiKeyPlaceholder: string;
    apiKeyHint: string;
    instanceName: string;
    instanceNamePlaceholder: string;
    allowedNumbers: string;
    allowedNumbersPlaceholder: string;
    allowedNumbersHint: string;
    model: string;
    systemPrompt: string;
    systemPromptPlaceholder: string;
    save: string;
    saving: string;
    saved: string;
    connect: string;
    connecting: string;
    disconnect: string;
    disconnecting: string;
    scanQr: string;
    qrExpired: string;
    refresh: string;
    webhookUrl: string;
    copy: string;
    copied: string;
    statusConnected: string;
    statusDisconnected: string;
    statusError: string;
  };
}

export default function WhatsAppSection({ t }: Props) {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [evolutionUrl, setEvolutionUrl]     = useState("");
  const [apiKey, setApiKey]                 = useState("");
  const [instanceName, setInstanceName]     = useState("");
  const [allowedNumbers, setAllowedNumbers] = useState("");
  const [model, setModel]                   = useState<BedrockModelId>("us.anthropic.claude-haiku-4-5-20251001-v1:0");
  const [systemPrompt, setSystemPrompt]     = useState("");

  // UI state
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState(false);
  const [connState, setConnState]     = useState<ConnectionState>("unconfigured");
  const [qrBase64, setQrBase64]       = useState<string | null>(null);
  const [connecting, setConnecting]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied]           = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load config ────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/whatsapp/config");
      const data = await res.json();
      const cfg: WhatsAppConfig | null = data.config;
      setConfig(cfg);
      if (cfg) {
        setEvolutionUrl(cfg.evolution_url);
        setInstanceName(cfg.instance_name);
        setAllowedNumbers(cfg.allowed_numbers.join(", "));
        setModel(cfg.bedrock_model as BedrockModelId);
        setSystemPrompt(cfg.system_prompt ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // ── Poll connection status ─────────────────────────────────────────────────

  const checkStatus = useCallback(async () => {
    if (!config?.id) return;
    try {
      const res = await fetch("/api/whatsapp/instance/status");
      const data = await res.json();
      const state: string = data?.instance?.state ?? "unknown";
      if (state === "open") {
        setConnState("connected");
        setQrBase64(null);
        stopPolling();
      } else if (state === "unconfigured") {
        setConnState("unconfigured");
      } else if (connState !== "qr") {
        setConnState("error");
      }
    } catch {
      // ignore transient errors
    }
  }, [config?.id, connState]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => {
    if (!config?.id) return;
    checkStatus();
  }, [config?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopPolling(), []);

  // ── Save config ────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const numbers = allowedNumbers
        .split(/[,\n]+/)
        .map((n) => n.trim())
        .filter(Boolean);

      await fetch("/api/whatsapp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evolution_url: evolutionUrl.trim(),
          api_key: apiKey.trim() || undefined,
          instance_name: instanceName.trim(),
          allowed_numbers: numbers,
          bedrock_model: model,
          system_prompt: systemPrompt.trim() || null,
        }),
      });
      setApiKey(""); // clear after save
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  }

  // ── Connect (create instance + show QR) ───────────────────────────────────

  async function handleConnect() {
    setConnecting(true);
    try {
      let createRes = await fetch("/api/whatsapp/instance/create", { method: "POST" });
      let createData = await createRes.json();
      console.log("[WA] create:", createRes.status, JSON.stringify(createData).substring(0, 200));

      // 403 = name already in use (stuck instance). Delete and retry once.
      if (createRes.status === 403) {
        console.log("[WA] instance exists — deleting and retrying");
        await fetch("/api/whatsapp/instance/logout", { method: "DELETE" });
        createRes = await fetch("/api/whatsapp/instance/create", { method: "POST" });
        createData = await createRes.json();
        console.log("[WA] retry create:", createRes.status, JSON.stringify(createData).substring(0, 200));
      }

      if (!createRes.ok) {
        console.error("[WA] create failed:", createData);
        setConnState("error");
        return;
      }

      let base64: string = createData?.qrcode?.base64 ?? "";
      console.log("[WA] QR from create:", base64 ? "✓" : "(empty)");

      if (!base64) {
        const qrRes = await fetch("/api/whatsapp/instance/qr");
        const qrData = await qrRes.json();
        console.log("[WA] /qr endpoint:", qrRes.status, JSON.stringify(qrData).substring(0, 200));
        base64 = qrData?.base64 ?? qrData?.qrcode?.base64 ?? "";
      }

      if (base64) {
        setQrBase64(base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`);
        setConnState("qr");
        stopPolling();
        pollRef.current = setInterval(checkStatus, 3000);
      } else {
        console.error("[WA] no QR in any response");
        setConnState("error");
      }
    } catch (e) {
      console.error("[WA] handleConnect threw:", e);
      setConnState("error");
    } finally {
      setConnecting(false);
    }
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/whatsapp/instance/logout", { method: "DELETE" });
      setConnState("unconfigured");
      setQrBase64(null);
      stopPolling();
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Refresh QR ─────────────────────────────────────────────────────────────

  async function handleRefreshQr() {
    const qrRes = await fetch("/api/whatsapp/instance/qr");
    const qrData = await qrRes.json();
    const base64: string = qrData?.base64 ?? qrData?.qrcode?.base64 ?? "";
    if (base64) setQrBase64(base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`);
  }

  // ── Copy webhook URL ───────────────────────────────────────────────────────

  function handleCopyWebhook() {
    if (!config?.webhook_secret) return;
    const url = `${window.location.origin}/api/whatsapp/webhook?key=${config.webhook_secret}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="h-6 w-32 animate-pulse rounded bg-white/10" />;

  const isSaveDisabled = saving || !evolutionUrl.trim() || !instanceName.trim() || (!config?.has_api_key && !apiKey.trim());

  return (
    <section className="mt-10 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{t.title}</h2>
        <p className="mt-1 text-sm text-white/50">{t.desc}</p>
      </div>

      {/* Connection status + actions */}
      <div className="flex items-center gap-3">
        <span className={[
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
          connState === "connected" ? "bg-green-500/20 text-green-400" :
          connState === "qr"        ? "bg-yellow-500/20 text-yellow-400" :
          connState === "error"     ? "bg-red-500/20 text-red-400" :
                                      "bg-white/10 text-white/50",
        ].join(" ")}>
          <span className={[
            "h-1.5 w-1.5 rounded-full",
            connState === "connected" ? "bg-green-400" :
            connState === "qr"        ? "bg-yellow-400" :
            connState === "error"     ? "bg-red-400" :
                                        "bg-white/30",
          ].join(" ")} />
          {connState === "connected" ? t.statusConnected :
           connState === "qr"        ? t.scanQr :
           connState === "error"     ? t.statusError :
                                       t.statusDisconnected}
        </span>

        {config && connState !== "connected" && connState !== "qr" && (
          <button
            onClick={handleConnect}
            disabled={connecting || !config.has_api_key}
            className="rounded-lg bg-green-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-600 disabled:opacity-40"
          >
            {connecting ? t.connecting : t.connect}
          </button>
        )}
        {connState === "connected" && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="rounded-lg bg-red-600/60 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-40"
          >
            {disconnecting ? t.disconnecting : t.disconnect}
          </button>
        )}
        {connState === "qr" && (
          <button
            onClick={handleRefreshQr}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/20"
          >
            {t.refresh}
          </button>
        )}
      </div>

      {/* QR code */}
      {connState === "qr" && qrBase64 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-white/60">{t.scanQr}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrBase64} alt="WhatsApp QR" className="h-48 w-48 rounded-xl bg-white p-2" />
        </div>
      )}

      {/* Webhook URL (read-only copy) */}
      {config?.webhook_secret && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-white/60">{t.webhookUrl}</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/70">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/whatsapp/webhook?key=${config.webhook_secret}`
                : `/api/whatsapp/webhook?key=${config.webhook_secret}`}
            </code>
            <button
              onClick={handleCopyWebhook}
              className="rounded-lg bg-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/20"
            >
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </div>
      )}

      {/* Config form */}
      <div className="grid gap-4">
        {/* Evolution URL */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.evolutionUrl}</label>
          <input
            type="url"
            value={evolutionUrl}
            onChange={(e) => setEvolutionUrl(e.target.value)}
            placeholder={t.evolutionUrlPlaceholder}
            className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.apiKey}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.has_api_key ? "••••••••••••••••" : t.apiKeyPlaceholder}
            className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <p className="text-xs text-white/40">{t.apiKeyHint}</p>
        </div>

        {/* Instance name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.instanceName}</label>
          <input
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder={t.instanceNamePlaceholder}
            className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </div>

        {/* Allowed numbers */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.allowedNumbers}</label>
          <textarea
            rows={3}
            value={allowedNumbers}
            onChange={(e) => setAllowedNumbers(e.target.value)}
            placeholder={t.allowedNumbersPlaceholder}
            className="w-full resize-none rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
          <p className="text-xs text-white/40">{t.allowedNumbersHint}</p>
        </div>

        {/* Model */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.model}</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as BedrockModelId)}
            className="w-full rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/30"
          >
            {BEDROCK_MODELS.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#1a1a2e]">{m.label}</option>
            ))}
          </select>
        </div>

        {/* System prompt */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-white/70">{t.systemPrompt}</label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={t.systemPromptPlaceholder}
            className="w-full resize-none rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none ring-1 ring-white/10 focus:ring-white/30"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaveDisabled}
          className="self-start rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {saving ? t.saving : savedMsg ? t.saved : t.save}
        </button>
      </div>
    </section>
  );
}
