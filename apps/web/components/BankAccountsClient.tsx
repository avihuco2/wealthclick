"use client";

import { useState, useEffect, useCallback } from "react";
import type { Locale } from "@/lib/i18n";
import type { BankConfig } from "@/lib/scraperConfig";
import type { DbBankAccount, DbScrapeJob } from "@/lib/bankAccounts";

type SafeBankAccount = Omit<DbBankAccount, "credentials_encrypted"> & {
  latestJob: DbScrapeJob | null;
};

type T = {
  title: string;
  subtitle: string;
  connectButton: string;
  noAccounts: string;
  noAccountsDesc: string;
  lastScraped: string;
  never: string;
  scrapeNow: string;
  remove: string;
  statusActive: string;
  statusError: string;
  statusScraping: string;
  statusDisabled: string;
  importing: string;
  importDone: string;
  importFailed: string;
  selectBank: string;
  credentialsTitle: string;
  nicknameLabel: string;
  nicknamePlaceholder: string;
  connect: string;
  connecting: string;
  back: string;
  removeConfirm: string;
  syncAll: string;
  autoSync: string;
  every: string;
  hours: string;
  nextSync: string;
  inLabel: string;
  overdue: string;
  enable: string;
  disable: string;
};

type Props = {
  initialAccounts: SafeBankAccount[];
  bankConfigs: BankConfig[];
  locale: Locale;
  scrapeIntervalHours: number;
  t: T;
};

type ScrapeState = Record<
  string,
  { jobId: string; status: string; importedCount: number | null; error: string | null }
>;

const INTERVAL_OPTIONS = [1, 3, 6, 12, 24, 48];

export default function BankAccountsClient({
  initialAccounts,
  bankConfigs,
  locale,
  scrapeIntervalHours: initialInterval,
  t,
}: Props) {
  const [accounts, setAccounts] = useState<SafeBankAccount[]>(initialAccounts);
  const [showModal, setShowModal] = useState(false);
  const [scrapeState, setScrapeState] = useState<ScrapeState>({});
  const [syncingAll, setSyncingAll] = useState(false);
  const [interval, setIntervalHours] = useState(initialInterval);
  const [savingInterval, setSavingInterval] = useState(false);

  const refreshAccounts = useCallback(async () => {
    const res = await fetch("/api/bank-accounts");
    if (res.ok) setAccounts(await res.json());
  }, []);

  // Poll running scrape jobs
  useEffect(() => {
    const running = Object.entries(scrapeState).filter(([, s]) => s.status === "running");
    if (running.length === 0) return;

    const interval = setInterval(async () => {
      for (const [accountId, state] of running) {
        const res = await fetch(`/api/scrape-jobs/${state.jobId}`);
        if (!res.ok) continue;
        const job = await res.json();
        setScrapeState((prev) => ({
          ...prev,
          [accountId]: {
            jobId: job.id,
            status: job.status,
            importedCount: job.imported_count,
            error: job.error,
          },
        }));
        if (job.status !== "running") refreshAccounts();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [scrapeState, refreshAccounts]);

  async function handleScrape(account: SafeBankAccount) {
    const res = await fetch(`/api/bank-accounts/${account.id}/scrape`, { method: "POST" });
    if (!res.ok) return;
    const { jobId } = await res.json();
    setScrapeState((prev) => ({
      ...prev,
      [account.id]: { jobId, status: "running", importedCount: null, error: null },
    }));
  }

  async function handleIntervalChange(hours: number) {
    setSavingInterval(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrapeIntervalHours: hours }),
    });
    if (res.ok) setIntervalHours(hours);
    setSavingInterval(false);
  }

  async function handleSyncAll() {
    setSyncingAll(true);
    const res = await fetch("/api/bank-accounts/scrape-all", { method: "POST" });
    if (res.ok) {
      const { jobs } = await res.json();
      const updates: ScrapeState = {};
      for (const { accountId, jobId } of jobs) {
        updates[accountId] = { jobId, status: "running", importedCount: null, error: null };
      }
      setScrapeState((prev) => ({ ...prev, ...updates }));
    }
    setSyncingAll(false);
  }

  async function handleToggleEnabled(account: SafeBankAccount) {
    const newVal = !account.scrape_enabled;
    // Optimistic update
    setAccounts((prev) =>
      prev.map((a) => (a.id === account.id ? { ...a, scrape_enabled: newVal } : a)),
    );
    const res = await fetch(`/api/bank-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scrape_enabled: newVal }),
    });
    if (!res.ok) {
      // Revert on failure
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, scrape_enabled: !newVal } : a)),
      );
    }
  }

  async function handleRemove(account: SafeBankAccount) {
    if (!window.confirm(t.removeConfirm)) return;
    await fetch(`/api/bank-accounts/${account.id}`, { method: "DELETE" });
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    setScrapeState((prev) => {
      const next = { ...prev };
      delete next[account.id];
      return next;
    });
  }

  function handleConnected(account: SafeBankAccount) {
    setAccounts((prev) => [...prev, account]);
    setShowModal(false);
  }

  const fmtDate = (d: Date | string | null) => {
    if (!d) return t.never;
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  };

  const fmtNextSync = (lastSyncedAt: Date | null, enabled: boolean) => {
    if (!enabled) return null;
    if (!lastSyncedAt) return null; // never synced — no next sync estimate yet
    const next = new Date(lastSyncedAt).getTime() + interval * 3600 * 1000;
    const hoursLeft = Math.round((next - Date.now()) / 3600000);
    if (hoursLeft <= 0) return t.overdue; // scheduled time passed, cron will pick it up
    return `${t.inLabel} ${hoursLeft}${t.hours}`;
  };

  const enabledCount = accounts.filter((a) => a.scrape_enabled).length;

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-white">{t.title}</h1>
          <p className="mt-1 text-[13px] text-white/40">{t.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {accounts.length > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={syncingAll || enabledCount === 0}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-[13px] font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.10] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {syncingAll ? <SpinnerIcon /> : <RefreshIcon />}
              {t.syncAll}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-4 py-2.5 text-[13px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.4)] transition-all hover:brightness-110 active:scale-95"
          >
            <PlusIcon />
            {t.connectButton}
          </button>
        </div>
      </div>

      {/* Auto-sync banner with interval selector */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
        <ClockIcon />
        <span className="text-[13px] text-white/50">{t.autoSync}</span>
        <div className="flex items-center gap-1">
          {INTERVAL_OPTIONS.map((h) => (
            <button
              key={h}
              onClick={() => handleIntervalChange(h)}
              disabled={savingInterval}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-medium transition-all ${
                interval === h
                  ? "bg-[oklch(0.5706_0.2236_258.71)] text-white shadow-[0_1px_8px_oklch(0.5706_0.2236_258.71/0.4)]"
                  : "text-white/40 hover:bg-white/[0.07] hover:text-white/70"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {h}{t.hours}
            </button>
          ))}
          {savingInterval && <SpinnerIcon />}
        </div>
        <span className="ms-auto text-[12px] text-white/30">
          {enabledCount}/{accounts.length} enabled
        </span>
      </div>

      {/* Account list */}
      {accounts.length === 0 ? (
        <EmptyState t={t} onConnect={() => setShowModal(true)} />
      ) : (
        <div className="flex flex-col gap-3">
          {accounts.map((account) => {
            const config = bankConfigs.find((c) => c.companyId === account.company_id);
            const scrape = scrapeState[account.id];
            const isRunning = scrape?.status === "running" || account.status === "scraping";
            const hasFailed = scrape?.status === "failed" || account.status === "error";
            const isDisabled = !account.scrape_enabled;
            const nextSync = fmtNextSync(account.last_scraped_at, account.scrape_enabled);

            return (
              <div
                key={account.id}
                className={`flex items-start gap-4 rounded-2xl border p-5 backdrop-blur-md transition-all duration-200 ${
                  isDisabled
                    ? "border-white/[0.05] bg-white/[0.02] opacity-60"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12] hover:bg-white/[0.05]"
                }`}
              >
                {/* Bank icon */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07] text-2xl">
                  {config?.emoji ?? "🏦"}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-medium text-white/85">
                      {config?.label ?? account.company_id}
                    </span>
                    {account.nickname && (
                      <span className="text-[12px] text-white/40">— {account.nickname}</span>
                    )}
                    <StatusBadge
                      status={isDisabled ? "disabled" : isRunning ? "scraping" : hasFailed ? "error" : account.status}
                      t={t}
                    />
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                    <p className="text-[12px] text-white/35">
                      {t.lastScraped}: {fmtDate(account.last_scraped_at)}
                    </p>
                    {nextSync && (
                      <p className={`text-[12px] ${nextSync === t.overdue ? "text-amber-400/70" : "text-white/35"}`}>
                        {t.nextSync}: {nextSync}
                      </p>
                    )}
                  </div>

                  {/* Job feedback */}
                  {scrape && scrape.status !== "running" && (
                    <p className={`mt-1 text-[12px] ${scrape.status === "done" ? "text-[oklch(0.72_0.17_142)]" : "text-[oklch(0.65_0.22_25)]"}`}>
                      {scrape.status === "done"
                        ? `${scrape.importedCount ?? 0} ${t.importDone}`
                        : `${t.importFailed}${scrape.error ? `: ${scrape.error}` : ""}`}
                    </p>
                  )}
                  {isRunning && (
                    <p className="mt-1 text-[12px] text-[oklch(0.72_0.18_258.71)]">{t.importing}</p>
                  )}
                  {!scrape && hasFailed && account.last_error && (
                    <p className="mt-1 text-[12px] text-[oklch(0.65_0.22_25)]">{account.last_error}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    {!isDisabled && (
                      <button
                        onClick={() => handleScrape(account)}
                        disabled={isRunning}
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.10] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {isRunning ? <SpinnerIcon /> : t.scrapeNow}
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleEnabled(account)}
                      className={`rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all ${
                        isDisabled
                          ? "border-white/10 bg-white/[0.05] text-white/40 hover:border-white/20 hover:text-white/60"
                          : "border-white/10 bg-white/[0.05] text-white/50 hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-400"
                      }`}
                    >
                      {isDisabled ? t.enable : t.disable}
                    </button>
                    <button
                      onClick={() => handleRemove(account)}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[12px] text-white/35 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                    >
                      {t.remove}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ConnectBankModal
          bankConfigs={bankConfigs}
          t={t}
          onClose={() => setShowModal(false)}
          onConnected={handleConnected}
        />
      )}
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ t, onConnect }: { t: T; onConnect: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.03] px-8 py-16 text-center backdrop-blur-md">
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-25 blur-[20px]" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.08] text-3xl">🏦</div>
      </div>
      <h2 className="text-[18px] font-semibold text-white/80">{t.noAccounts}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-white/35">{t.noAccountsDesc}</p>
      <button
        onClick={onConnect}
        className="mt-6 flex items-center gap-2 rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.4)] transition-all hover:brightness-110"
      >
        <PlusIcon />
        {t.connectButton}
      </button>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string; t: T }) {
  const map: Record<string, { label: string; color: string }> = {
    active:   { label: t.statusActive,   color: "text-[oklch(0.72_0.17_142)] border-[oklch(0.72_0.17_142/0.3)] bg-[oklch(0.72_0.17_142/0.08)]" },
    error:    { label: t.statusError,    color: "text-[oklch(0.65_0.22_25)] border-[oklch(0.65_0.22_25/0.3)] bg-[oklch(0.65_0.22_25/0.08)]" },
    scraping: { label: t.statusScraping, color: "text-[oklch(0.72_0.18_258.71)] border-[oklch(0.72_0.18_258.71/0.3)] bg-[oklch(0.72_0.18_258.71/0.08)]" },
    disabled: { label: t.statusDisabled, color: "text-white/30 border-white/10 bg-white/[0.04]" },
  };
  const cfg = map[status] ?? map.active;
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

// ─── Connect modal ────────────────────────────────────────────────────────────

type SafeAccountNoJob = Omit<DbBankAccount, "credentials_encrypted"> & { latestJob: null };

function ConnectBankModal({
  bankConfigs, t, onClose, onConnected,
}: {
  bankConfigs: BankConfig[];
  t: T;
  onClose: () => void;
  onConnected: (account: SafeBankAccount) => void;
}) {
  const [step, setStep] = useState<"select" | "credentials">("select");
  const [selectedConfig, setSelectedConfig] = useState<BankConfig | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSelectBank(config: BankConfig) {
    setSelectedConfig(config);
    setFieldValues({});
    setError(null);
    setStep("credentials");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedConfig) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/bank-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: selectedConfig.companyId,
        credentials: fieldValues,
        nickname: nickname.trim() || undefined,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to connect account");
      return;
    }
    const account = (await res.json()) as SafeAccountNoJob;
    onConnected({ ...account, latestJob: null });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/[0.10] bg-[oklch(0.09_0.02_260)] p-6 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20 sm:hidden" />

        {step === "select" ? (
          <>
            <h2 className="mb-5 text-[18px] font-semibold text-white">{t.selectBank}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {bankConfigs.map((config) => (
                <button
                  key={config.companyId}
                  onClick={() => handleSelectBank(config)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-3 py-4 text-center transition-all hover:border-white/[0.16] hover:bg-white/[0.08] active:scale-95"
                >
                  <span className="text-2xl">{config.emoji}</span>
                  <span className="text-[11px] leading-tight text-white/70">{config.label}</span>
                </button>
              ))}
            </div>
            <button onClick={onClose} className="mt-5 w-full rounded-xl border border-white/[0.08] py-2.5 text-[13px] text-white/40 transition-all hover:bg-white/[0.05]">✕</button>
          </>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <button onClick={() => setStep("select")} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/60 transition-all hover:bg-white/[0.10]">‹</button>
              <h2 className="text-[18px] font-semibold text-white">{t.credentialsTitle} {selectedConfig!.label}</h2>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {selectedConfig!.fields.map((field) => (
                <div key={field.name}>
                  <label className="mb-1.5 block text-[12px] font-medium text-white/50">{field.label}</label>
                  <input
                    type={field.type}
                    value={fieldValues[field.name] ?? ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                    required
                    autoComplete={field.type === "password" ? "current-password" : "off"}
                    className="w-full rounded-xl border border-white/[0.10] bg-white/[0.06] px-4 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-all focus:border-[oklch(0.5706_0.2236_258.71/0.6)] focus:ring-1 focus:ring-[oklch(0.5706_0.2236_258.71/0.3)]"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-white/50">{t.nicknameLabel}</label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t.nicknamePlaceholder}
                  dir="auto"
                  className="w-full rounded-xl border border-white/[0.10] bg-white/[0.06] px-4 py-2.5 text-[14px] text-white placeholder-white/25 outline-none transition-all focus:border-[oklch(0.5706_0.2236_258.71/0.6)] focus:ring-1 focus:ring-[oklch(0.5706_0.2236_258.71/0.3)]"
                />
              </div>
              {error && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] text-red-400">{error}</p>
              )}
              <button type="submit" disabled={loading} className="mt-1 w-full rounded-xl bg-[oklch(0.5706_0.2236_258.71)] py-3 text-[14px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.4)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? t.connecting : t.connect}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
function RefreshIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
}
function SpinnerIcon() {
  return <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>;
}
function ClockIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
