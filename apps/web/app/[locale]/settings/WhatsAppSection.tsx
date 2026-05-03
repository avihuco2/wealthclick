"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ALL_MODELS, GOOGLE_MODELS, type AnyModelId } from "@/lib/bedrockModels";

interface WhatsAppConfig {
  id: string;
  evolution_url: string;
  has_api_key: boolean;
  instance_name: string;
  webhook_secret: string;
  allowed_numbers: string[];
  bedrock_model: string;
  system_prompt: string | null;
  max_history: number;
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
    maxHistory: string;
    maxHistoryHint: string;
    clearHistory: string;
    clearHistoryConfirm: string;
    clearingHistory: string;
    historyCleared: string;
  };
}

export default function WhatsAppSection({ t }: Props) {
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state — defaults pre-filled for local Evolution API setup
  const [evolutionUrl, setEvolutionUrl]     = useState("http://localhost:8080");
  const [apiKey, setApiKey]                 = useState("");
  const [instanceName, setInstanceName]     = useState("wealthclick");
  const [allowedNumbers, setAllowedNumbers] = useState("");
  const [model, setModel]                   = useState<AnyModelId>("anthropic.claude-3-haiku-20240307-v1:0" as AnyModelId);
  const [systemPrompt, setSystemPrompt]     = useState("");
  const [maxHistory, setMaxHistory]         = useState(40);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [historyClearedMsg, setHistoryClearedMsg] = useState(false);

  // UI state
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState(false);
  const [connState, setConnState]     = useState<ConnectionState>("unconfigured");
  // keep ref in sync so polling callbacks always see current state
  const setConnStateSynced = (s: ConnectionState) => { connStateRef.current = s; setConnState(s); };
  const [qrBase64, setQrBase64]       = useState<string | null>(null);
  const [connecting, setConnecting]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied]           = useState(false);

  const pollRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connStateRef = useRef<ConnectionState>("unconfigured");

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
        setModel(cfg.bedrock_model as AnyModelId);
        setSystemPrompt(cfg.system_prompt ?? "");
        setMaxHistory(cfg.max_history ?? 40);
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
        setConnStateSynced("connected");
        setQrBase64(null);
        stopPolling();
      } else if (state === "unconfigured") {
        setConnStateSynced("unconfigured");
      } else if (connStateRef.current !== "qr") {
        // only set error if we're not currently showing QR
        setConnStateSynced("error");
      }
    } catch {
      // ignore transient errors
    }
  }, [config?.id]); // no connState dep — use ref instead

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => {
    if (!config?.id) return;
    checkStatus();
  }, [config?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopPolling(), []);

  // ── Clear conversation history ─────────────────────────────────────────────

  async function handleClearHistory() {
    if (!confirm(t.clearHistoryConfirm)) return;
    setClearingHistory(true);
    try {
      await fetch("/api/whatsapp/clear-history", { method: "POST" });
      setHistoryClearedMsg(true);
      setTimeout(() => setHistoryClearedMsg(false), 3000);
    } finally {
      setClearingHistory(false);
    }
  }

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
          max_history: maxHistory,
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
        const delRes = await fetch("/api/whatsapp/instance/logout", { method: "DELETE" });
        console.log("[WA] delete:", delRes.status);
        // wait briefly for Evolution API to clean up
        await new Promise((r) => setTimeout(r, 2000));
        createRes = await fetch("/api/whatsapp/instance/create", { method: "POST" });
        createData = await createRes.json();
        console.log("[WA] retry create:", createRes.status, JSON.stringify(createData).substring(0, 200));
      }

      if (!createRes.ok) {
        console.error("[WA] create failed:", createData);
        setConnStateSynced("error");
        return;
      }

      // QR is not immediate — Baileys needs a moment to generate it. Poll up to 10×1.5s.
      let base64 = "";
      for (let attempt = 1; attempt <= 10; attempt++) {
        await new Promise((r) => setTimeout(r, 1500));
        const qrRes = await fetch("/api/whatsapp/instance/qr");
        const qrData = await qrRes.json();
        console.log(`[WA] QR attempt ${attempt}:`, qrRes.status, JSON.stringify(qrData).substring(0, 150));
        base64 = qrData?.base64 ?? qrData?.qrcode?.base64 ?? "";
        if (base64) break;
      }

      if (base64) {
        setQrBase64(base64.startsWith("data:") ? base64 : `data:image/png;base64,${base64}`);
        setConnStateSynced("qr");
        stopPolling();
        pollRef.current = setInterval(checkStatus, 3000);
      } else {
        console.error("[WA] no QR after 10 attempts");
        setConnStateSynced("error");
      }
    } catch (e) {
      console.error("[WA] handleConnect threw:", e);
      setConnStateSynced("error");
    } finally {
      setConnecting(false);
    }
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/whatsapp/instance/logout", { method: "DELETE" });
      setConnStateSynced("unconfigured");
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

  if (loading) return <div className="h-6 w-32 animate-pulse rounded bg-black/10 dark:bg-white/10" />;

  const isSaveDisabled = saving || !evolutionUrl.trim() || !instanceName.trim() || (!config?.has_api_key && !apiKey.trim());

  const inputClass = "w-full rounded-xl bg-black/[0.06] px-4 py-2.5 text-sm text-black placeholder-black/30 outline-none ring-1 ring-black/10 focus:ring-black/30 dark:bg-white/[0.06] dark:text-white dark:placeholder-white/30 dark:ring-white/10 dark:focus:ring-white/30";

  return (
    <section className="mt-10 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-black dark:text-white">{t.title}</h2>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">{t.desc}</p>
      </div>

      {/* Connection status + actions */}
      <div className="flex items-center gap-3">
        <span className={[
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
          connState === "connected" ? "bg-green-500/20 text-green-400" :
          connState === "qr"        ? "bg-yellow-500/20 text-yellow-400" :
          connState === "error"     ? "bg-red-500/20 text-red-400" :
                                      "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50",
        ].join(" ")}>
          <span className={[
            "h-1.5 w-1.5 rounded-full",
            connState === "connected" ? "bg-green-400" :
            connState === "qr"        ? "bg-yellow-400" :
            connState === "error"     ? "bg-red-400" :
                                        "bg-black/30 dark:bg-white/30",
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
            className="rounded-lg bg-black/10 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/20 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            {t.refresh}
          </button>
        )}
      </div>

      {/* QR code */}
      {connState === "qr" && qrBase64 && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-black/60 dark:text-white/60">{t.scanQr}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrBase64} alt="WhatsApp QR" className="h-48 w-48 rounded-xl bg-white p-2" />
        </div>
      )}

      {/* Webhook URL (read-only copy) */}
      {config?.webhook_secret && (
        <div className="space-y-1">
          <label className="block text-xs font-medium text-black/60 dark:text-white/60">{t.webhookUrl}</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-black/[0.06] px-3 py-2 text-xs text-black/70 dark:bg-white/[0.06] dark:text-white/70">
              {typeof window !== "undefined"
                ? `${window.location.origin}/api/whatsapp/webhook?key=${config.webhook_secret}`
                : `/api/whatsapp/webhook?key=${config.webhook_secret}`}
            </code>
            <button
              onClick={handleCopyWebhook}
              className="rounded-lg bg-black/10 px-3 py-2 text-xs text-black/70 transition hover:bg-black/20 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
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
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.evolutionUrl}</label>
          <input
            type="url"
            value={evolutionUrl}
            onChange={(e) => setEvolutionUrl(e.target.value)}
            placeholder={t.evolutionUrlPlaceholder}
            className={inputClass}
          />
        </div>

        {/* API Key */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.apiKey}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config?.has_api_key ? "••••••••••••••••" : t.apiKeyPlaceholder}
            className={inputClass}
          />
          <p className="text-xs text-black/40 dark:text-white/40">{t.apiKeyHint}</p>
        </div>

        {/* Instance name */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.instanceName}</label>
          <input
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder={t.instanceNamePlaceholder}
            className={inputClass}
          />
        </div>

        {/* Allowed numbers */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.allowedNumbers}</label>
          <textarea
            rows={3}
            value={allowedNumbers}
            onChange={(e) => setAllowedNumbers(e.target.value)}
            placeholder={t.allowedNumbersPlaceholder}
            className={`${inputClass} resize-none`}
          />
          <p className="text-xs text-black/40 dark:text-white/40">{t.allowedNumbersHint}</p>
        </div>

        {/* Model */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.model}</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as AnyModelId)}
            className="w-full rounded-xl bg-[oklch(0.96_0.005_260)] px-4 py-2.5 text-sm text-black/80 outline-none ring-1 ring-black/10 focus:ring-black/30 dark:bg-white/[0.06] dark:text-white dark:ring-white/10 dark:focus:ring-white/30"
          >
            <optgroup label="AWS Bedrock">
              {ALL_MODELS.filter((m) => m.provider === "bedrock").map((m) => (
                <option key={m.id} value={m.id} className="bg-[oklch(0.96_0.005_260)] dark:bg-[#1a1a2e]">{m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Google AI (Gemma)">
              {GOOGLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-[oklch(0.96_0.005_260)] dark:bg-[#1a1a2e]">{m.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* System prompt */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.systemPrompt}</label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder={t.systemPromptPlaceholder}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Max history */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-black/70 dark:text-white/70">{t.maxHistory}</label>
          <input
            type="number"
            min={1}
            max={200}
            value={maxHistory}
            onChange={(e) => setMaxHistory(Math.max(1, Math.min(200, Number(e.target.value) || 40)))}
            className="w-32 rounded-xl bg-black/[0.06] px-4 py-2.5 text-sm text-black outline-none ring-1 ring-black/10 focus:ring-black/30 dark:bg-white/[0.06] dark:text-white dark:ring-white/10 dark:focus:ring-white/30"
          />
          <p className="text-xs text-black/40 dark:text-white/40">{t.maxHistoryHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? t.saving : savedMsg ? t.saved : t.save}
          </button>
          <button
            onClick={handleClearHistory}
            disabled={clearingHistory}
            className="rounded-xl bg-red-500/20 px-5 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-500/30 transition hover:bg-red-500/30 disabled:opacity-40 dark:text-red-300"
          >
            {clearingHistory ? t.clearingHistory : historyClearedMsg ? t.historyCleared : t.clearHistory}
          </button>
        </div>
      </div>
    </section>
  );
}
