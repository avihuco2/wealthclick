"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { CategoryBudgetRow, BudgetIncomeRow } from "@/lib/budgets";
import type { Locale } from "@/lib/i18n";

interface T {
  title: string;
  subtitle: string;
  category: string;
  avg3m: string;
  avg6m: string;
  monthlyBudget: string;
  thisMonth: string;
  ofIncome: string;
  save: string;
  saving: string;
  saved: string;
  totalBudget: string;
  totalActual: string;
  remaining: string;
  dashboardTitle: string;
  noData: string;
  forecastedIncome: string;
  actualIncome: string;
  totalAllocated: string;
  unallocated: string;
  importFromLastMonth: string;
  importing: string;
  imported: string;
}

interface Props {
  rows: CategoryBudgetRow[];
  income: BudgetIncomeRow;
  month: string;
  locale: Locale;
  t: T;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val: string | number) =>
  new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(typeof val === "string" ? parseFloat(val) : val);

function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ actual, budget, color }: { actual: number; budget: number; color: string }) {
  if (budget <= 0) return null;
  const pct = Math.min((actual / budget) * 100, 100);
  const over = actual > budget;
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: over ? "oklch(0.78 0.16 27)" : color }}
      />
    </div>
  );
}

// ─── IncomePctBadge ───────────────────────────────────────────────────────────

function IncomePctBadge({ budget, income }: { budget: number; income: number }) {
  if (income <= 0 || budget <= 0) return null;
  const pct = Math.round((budget / income) * 100);
  const color =
    pct > 30 ? "oklch(0.78 0.16 27)" :
    pct > 15 ? "oklch(0.80 0.17 54)" :
               "oklch(0.72 0.17 142)";
  return (
    <span
      className="ms-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {pct}%
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BudgetsClient({ rows, income, month, locale, t }: Props) {
  const router = useRouter();

  // ── Budgets state (categoryId → amount) ──────────────────────────────────
  const [budgets, setBudgets] = useState<Record<string, number>>(() =>
    Object.fromEntries(rows.map((r) => [r.category_id, parseFloat(r.monthly_budget)]))
  );
  const [saveAllState, setSaveAllState] = useState<"idle" | "saving" | "saved">("idle");

  // ── Forecasted income state ───────────────────────────────────────────────
  const [forecastedIncome, setForecastedIncome] = useState(
    Math.round(parseFloat(income.forecasted_amount))
  );
  const [incomeSaveState, setIncomeSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [importState, setImportState] = useState<"idle" | "importing" | "imported">("idle");

  // ── Month navigation ──────────────────────────────────────────────────────
  const isCurrentMonth = month === currentMonth();

  function navigate(delta: number) {
    const next = shiftMonth(month, delta);
    router.push(`?month=${next}`);
  }

  // ── Import from last month ────────────────────────────────────────────────
  const importFromLastMonth = useCallback(async () => {
    setImportState("importing");
    await fetch("/api/budgets/copy-from-last-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const [newRows, newIncome] = await Promise.all([
      fetch(`/api/budgets?month=${month}`).then((r) => r.json()),
      fetch(`/api/budgets/income?month=${month}`).then((r) => r.json()),
    ]);
    setBudgets(Object.fromEntries(newRows.map((r: CategoryBudgetRow) => [r.category_id, parseFloat(r.monthly_budget)])));
    setForecastedIncome(Math.round(parseFloat(newIncome.forecasted_amount)));
    setImportState("imported");
    setTimeout(() => setImportState("idle"), 1500);
  }, [month]);

  // ── Save all budgets ──────────────────────────────────────────────────────
  const saveAll = useCallback(async () => {
    setSaveAllState("saving");
    await Promise.all(
      Object.entries(budgets).map(([categoryId, amount]) =>
        fetch("/api/budgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: categoryId, month, monthly_amount: amount }),
        })
      )
    );
    setSaveAllState("saved");
    setTimeout(() => setSaveAllState("idle"), 2000);
  }, [budgets, month]);

  // ── Save forecasted income ────────────────────────────────────────────────
  const saveIncome = useCallback(async (val: number) => {
    setIncomeSaveState("saving");
    await fetch("/api/budgets/income", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, forecasted_amount: val }),
    });
    setIncomeSaveState("saved");
    setTimeout(() => setIncomeSaveState("idle"), 2000);
  }, [month]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const totalBudget = Object.values(budgets).reduce((s, v) => s + v, 0);
  const totalActual = rows.reduce((s, r) => s + parseFloat(r.current_month_actual), 0);
  const remaining = totalBudget - totalActual;
  const totalAllocated = totalBudget;
  const unallocated = forecastedIncome - totalAllocated;

  const name = (r: CategoryBudgetRow) => locale === "he" ? r.name_he : r.name_en;

  const saveAllLabel = saveAllState === "saving" ? t.saving : saveAllState === "saved" ? t.saved : t.save;

  const incomeLabel =
    incomeSaveState === "saving" ? t.saving :
    incomeSaveState === "saved"  ? t.saved  : t.save;

  return (
    <div className="space-y-6">

      {/* ── Header: title + month navigator ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white">{t.title}</h1>
          <p className="mt-1 text-[14px] text-black/45 dark:text-white/45">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={importFromLastMonth}
            disabled={importState !== "idle"}
            className="rounded-xl border border-black/[0.10] bg-black/[0.04] px-4 py-2.5 text-[13px] text-black/60 transition hover:bg-black/[0.08] hover:text-black/90 disabled:opacity-40 dark:border-white/[0.10] dark:bg-white/[0.04] dark:text-white/60 dark:hover:bg-white/[0.08] dark:hover:text-white/90"
          >
            {importState === "importing" ? t.importing : importState === "imported" ? t.imported : t.importFromLastMonth}
          </button>
        <div className="flex items-center gap-2 rounded-2xl border border-black/[0.10] bg-black/[0.05] px-4 py-2.5 dark:border-white/[0.10] dark:bg-white/[0.05]">
          <button
            onClick={() => navigate(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 transition hover:bg-black/[0.08] hover:text-black/90 dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white/90"
            aria-label="Previous month"
          >
            <ChevronIcon dir={locale === "he" ? "right" : "left"} />
          </button>
          <span className="min-w-[120px] text-center text-[14px] font-medium text-black/90 dark:text-white/90">
            {monthLabel(month, locale)}
          </span>
          <button
            onClick={() => navigate(1)}
            disabled={isCurrentMonth}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 transition hover:bg-black/[0.08] hover:text-black/90 disabled:opacity-25 dark:text-white/50 dark:hover:bg-white/[0.08] dark:hover:text-white/90"
            aria-label="Next month"
          >
            <ChevronIcon dir={locale === "he" ? "left" : "right"} />
          </button>
        </div>
        </div>
      </div>

      {/* ── Forecasted income card ── */}
      <div className="rounded-2xl border border-black/[0.10] bg-black/[0.04] p-5 dark:border-white/[0.10] dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-[12px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{t.forecastedIncome}</p>
            <p className="text-[13px] text-black/50 dark:text-white/50">
              {t.actualIncome}: <span className="text-black/70 dark:text-white/70">{fmt(income.actual_income)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-black/40 dark:text-white/40">₪</span>
            <input
              type="number"
              min={0}
              value={forecastedIncome || ""}
              onChange={(e) => { setForecastedIncome(Math.max(0, parseInt(e.target.value) || 0)); setIncomeSaveState("idle"); }}
              onKeyDown={(e) => e.key === "Enter" && saveIncome(forecastedIncome)}
              placeholder="0"
              className="w-32 rounded-xl bg-black/[0.06] px-3 py-2 text-sm text-black outline-none ring-1 ring-black/10 focus:ring-black/25 dark:bg-white/[0.06] dark:text-white dark:ring-white/10 dark:focus:ring-white/25"
            />
            <button
              onClick={() => saveIncome(forecastedIncome)}
              disabled={incomeSaveState !== "idle"}
              className="rounded-xl bg-[oklch(0.5706_0.2236_258.71)]/20 px-3 py-2 text-xs font-medium text-[oklch(0.55_0.22_258.71)] transition hover:bg-[oklch(0.5706_0.2236_258.71)]/30 disabled:opacity-40 dark:text-[oklch(0.72_0.18_258.71)]"
            >
              {incomeLabel}
            </button>
          </div>
        </div>
        {/* Income allocation bar */}
        {forecastedIncome > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-[11px] text-black/40 dark:text-white/40">
              <span>{t.totalAllocated}: {fmt(totalAllocated)} ({Math.round((totalAllocated / forecastedIncome) * 100)}%)</span>
              <span style={{ color: unallocated >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.78 0.16 27)" }}>
                {t.unallocated}: {fmt(Math.abs(unallocated))}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((totalAllocated / forecastedIncome) * 100, 100)}%`,
                  backgroundColor: unallocated >= 0 ? "oklch(0.5706 0.2236 258.71)" : "oklch(0.78 0.16 27)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: t.totalBudget, value: fmt(totalBudget), color: "oklch(0.5706 0.2236 258.71)" },
          { label: t.totalActual, value: fmt(totalActual), color: remaining >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.78 0.16 27)" },
          { label: t.remaining,   value: fmt(Math.abs(remaining)), color: remaining >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.78 0.16 27)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl border border-black/[0.08] bg-black/[0.04] p-5 dark:border-white/[0.08] dark:bg-white/[0.04]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{label}</p>
            <p className="mt-2 text-[24px] font-semibold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Category table ── */}
      <div className="overflow-hidden rounded-3xl border border-black/[0.08] bg-black/[0.03] backdrop-blur-md dark:border-white/[0.08] dark:bg-white/[0.03]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-[11px] font-medium uppercase tracking-wider text-black/35 dark:border-white/[0.06] dark:text-white/35">
                <th className="px-6 py-3 text-start">{t.category}</th>
                <th className="px-4 py-3 text-end">{t.avg3m}</th>
                <th className="px-4 py-3 text-end">{t.avg6m}</th>
                <th className="px-4 py-3 text-end">{t.thisMonth}</th>
                <th className="px-6 py-3 text-end">{t.monthlyBudget}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-black/30 dark:text-white/30">{t.noData}</td></tr>
              )}
              {rows.map((r) => {
                const budget = budgets[r.category_id] ?? 0;
                const actual = parseFloat(r.current_month_actual);
                const over   = budget > 0 && actual > budget;

                return (
                  <tr key={r.category_id} className="group transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${r.color}20` }}>
                          {r.emoji}
                        </span>
                        <span className="font-medium text-black/80 dark:text-white/80">{name(r)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end text-black/40 dark:text-white/40">{fmt(r.avg_3m)}</td>
                    <td className="px-4 py-3 text-end text-black/40 dark:text-white/40">{fmt(r.avg_6m)}</td>
                    <td className="px-4 py-3 text-end">
                      <div>
                        <span className={over ? "text-[oklch(0.78_0.16_27)]" : "text-black/75 dark:text-white/75"}>
                          {fmt(actual)}
                        </span>
                        {budget > 0 && (
                          <ProgressBar actual={actual} budget={budget} color={r.color} />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <IncomePctBadge budget={budget} income={forecastedIncome} />
                        <span className="text-black/40 dark:text-white/40">₪</span>
                        <input
                          type="number"
                          min={0}
                          value={budget || ""}
                          placeholder="0"
                          onChange={(e) => {
                            const v = Math.max(0, parseFloat(e.target.value) || 0);
                            setBudgets((prev) => ({ ...prev, [r.category_id]: v }));
                          }}
                          className="w-24 rounded-lg bg-black/[0.06] px-2 py-1.5 text-sm text-black outline-none ring-1 ring-black/10 focus:ring-black/25 dark:bg-white/[0.06] dark:text-white dark:ring-white/10 dark:focus:ring-white/25"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Save all button ── */}
      <div className="flex justify-end">
        <button
          onClick={saveAll}
          disabled={saveAllState !== "idle"}
          className="rounded-xl bg-[oklch(0.5706_0.2236_258.71)]/20 px-6 py-2.5 text-sm font-medium text-[oklch(0.55_0.22_258.71)] transition hover:bg-[oklch(0.5706_0.2236_258.71)]/30 disabled:opacity-40 dark:text-[oklch(0.72_0.18_258.71)]"
        >
          {saveAllLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronIcon({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {dir === "left"
        ? <polyline points="15 18 9 12 15 6" />
        : <polyline points="9 18 15 12 9 6" />}
    </svg>
  );
}
