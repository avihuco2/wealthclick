"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/i18n";

type ApiKey = { id: string; name: string; created_at: string; last_used_at: string | null };

type Props = {
  initialKeys: ApiKey[];
  locale: string;
  t: Dictionary["settings"];
};

export default function ApiKeysClient({ initialKeys, locale, t }: Props) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<{ id: string; name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createKey() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to create key"); return; }
      setNewToken({ id: data.id, name: data.name, token: data.token });
      setKeys((prev) => [{ id: data.id, name: data.name, created_at: new Date().toISOString(), last_used_at: null }, ...prev]);
      setName("");
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    setRevoking(id);
    setError(null);
    try {
      const res = await fetch("/api/v1/keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to revoke"); return; }
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (newToken?.id === id) setNewToken(null);
    } finally {
      setRevoking(null);
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function fmtDate(iso: string) {
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso));
  }

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-xl">
      <div className="mb-1 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-white">{t.apiKeysTitle}</h2>
          <p className="mt-1 text-[13px] text-white/40">{t.apiKeysDesc}</p>
        </div>
        <a
          href="/api/v1/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/50 transition-all hover:bg-white/[0.10] hover:text-white/80"
        >
          {t.docsLink} ↗
        </a>
      </div>

      {/* New token banner */}
      {newToken && (
        <div className="mt-5 rounded-2xl border border-[oklch(0.72_0.17_142)/0.3] bg-[oklch(0.72_0.17_142)/0.07] p-4">
          <p className="mb-1 text-[13px] font-semibold text-[oklch(0.80_0.14_142)]">{t.tokenTitle}</p>
          <p className="mb-3 text-[12px] text-white/50">{t.tokenWarning}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-white/80 font-mono select-all">
              {newToken.token}
            </code>
            <button
              onClick={() => copyToken(newToken.token)}
              className="shrink-0 rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-[12px] text-white/60 transition-all hover:bg-white/[0.14] hover:text-white"
            >
              {copied ? t.copied : t.copy}
            </button>
          </div>
        </div>
      )}

      {/* Create form */}
      <div className="mt-5 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createKey()}
          placeholder={t.keyNamePlaceholder}
          maxLength={64}
          dir="auto"
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20 focus:bg-white/[0.09]"
        />
        <button
          onClick={createKey}
          disabled={creating || !name.trim()}
          className="shrink-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] text-white/70 transition-all hover:bg-white/[0.12] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {creating ? "…" : t.createKey}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-[oklch(0.78_0.16_27)]">{error}</p>}

      {/* Keys list */}
      <div className="mt-5 space-y-2">
        {keys.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-white/30">{t.noKeys}</p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-white/80">{key.name}</p>
                <p className="mt-0.5 text-[11px] text-white/35">
                  {t.created}: {fmtDate(key.created_at)}
                  {" · "}
                  {key.last_used_at ? `${t.lastUsed}: ${fmtDate(key.last_used_at)}` : t.never}
                </p>
              </div>
              <button
                onClick={() => revokeKey(key.id)}
                disabled={revoking === key.id}
                className="shrink-0 rounded-xl border border-[oklch(0.78_0.16_27)/0.3] bg-[oklch(0.78_0.16_27)/0.08] px-3 py-1.5 text-[12px] text-[oklch(0.78_0.16_27)] transition-all hover:bg-[oklch(0.78_0.16_27)/0.15] disabled:opacity-40"
              >
                {revoking === key.id ? "…" : t.revoke}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
