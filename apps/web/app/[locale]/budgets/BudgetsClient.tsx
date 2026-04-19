"use client";

import { useState, useCallback } from "react";
import type { CategoryBudgetRow } from "@/lib/budgets";
import type { Locale } from "@/lib/i18n";

interface Props {
  rows: CategoryBudgetRow[];
  locale: Locale;
  t: {
    category: string;
    avg3m: string;
    avg6m: string;
    monthlyBudget: string;
    thisMonth: string;
    progress: string;
    noBudget: string;
    over: string;
    under: string;
    save: string;
    saving: string;
    saved: string;
    totalBudget: string;
    totalActual: string;
    remaining: string;
    dashboardTitle: string;
    noData: string;
  };
}

const fmt = (val: string | number) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(
    typeof val === "string" ? parseFloat(val) : val,
  );

function ProgressBar({ actual, budget, color }: { actual: number; budget: number; color: string }) {
  if (budget <= 0) return null;
  const pct = Math.min((actual / budget) * 100, 100);
  const over = actual > budget;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: over ? "oklch(0.78 0.16 27)" : color }}
      />
    </div>
  );
}

function BudgetInput({
  categoryId,
  initial,
  t,
}: {
  categoryId: string;
  initial: number;
  t: Props["t"];
}) {
  const [value, setValue] = useState(initial === 0 ? "" : String(initial));
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const save = useCallback(async () => {
    const amount = parseFloat(value) || 0;
    setState("saving");
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, monthly_amount: amount }),
    });
    setState("saved");
    setTimeout(() => setState("idle"), 2000);
  }, [categoryId, value]);

  const label = state === "saving" ? t.saving : state === "saved" ? t.saved : t.save;

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40">₪</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => { setValue(e.target.value); setState("idle"); }}
        onKeyDown={(e) => e.key === "Enter" && save()}
        placeholder="0"
        className="w-24 rounded-lg bg-white/[0.06] px-2 py-1 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-white/25"
      />
      <button
        onClick={save}
        disabled={state !== "idle"}
        className="rounded-lg bg-white/[0.08] px-2.5 py-1 text-xs text-white/60 transition hover:bg-white/[0.14] hover:text-white/90 disabled:opacity-40"
      >
        {label}
      </button>
    </div>
  );
}

export default function BudgetsClient({ rows, locale, t }: Props) {
  const totalBudget = rows.reduce((s, r) => s + parseFloat(r.monthly_budget), 0);
  const totalActual = rows.reduce((s, r) => s + parseFloat(r.current_month_actual), 0);
  const remaining = totalBudget - totalActual;
  const budgetedRows = rows.filter((r) => parseFloat(r.monthly_budget) > 0);

  const name = (r: CategoryBudgetRow) => locale === "he" ? r.name_he : r.name_en;

  return (
    <div className="space-y-6">
      {/* ── Summary cards ── */}
      {totalBudget > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t.totalBudget, value: fmt(totalBudget), color: "oklch(0.5706 0.2236 258.71)" },
            { label: t.totalActual, value: fmt(totalActual), color: remaining >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.78 0.16 27)" },
            { label: t.remaining,   value: fmt(Math.abs(remaining)), color: remaining >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.78 0.16 27)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-md">
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
              <p className="mt-2 text-[26px] font-semibold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Dashboard: budgeted categories vs actual ── */}
      {budgetedRows.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 backdrop-blur-md">
          <h2 className="mb-4 text-[15px] font-semibold text-white/80">{t.dashboardTitle}</h2>
          <div className="space-y-4">
            {budgetedRows.map((r) => {
              const budget = parseFloat(r.monthly_budget);
              const actual = parseFloat(r.current_month_actual);
              const over = actual > budget;
              const pct = budget > 0 ? Math.round((actual / budget) * 100) : 0;
              return (
                <div key={r.category_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-white/80">
                      <span>{r.emoji}</span>
                      <span>{name(r)}</span>
                    </span>
                    <span className="flex items-center gap-2 text-white/50">
                      <span style={{ color: over ? "oklch(0.78 0.16 27)" : "oklch(0.72 0.17 142)" }}>
                        {fmt(actual)}
                      </span>
                      <span>/</span>
                      <span>{fmt(budget)}</span>
                      <span className="w-10 text-end text-xs" style={{ color: over ? "oklch(0.78 0.16 27)" : "oklch(0.72 0.17 142)" }}>
                        {pct}%
                      </span>
                    </span>
                  </div>
                  <ProgressBar actual={actual} budget={budget} color={r.color} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Full categories table ── */}
      <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-medium uppercase tracking-wider text-white/35">
                <th className="px-6 py-3 text-start">{t.category}</th>
                <th className="px-4 py-3 text-end">{t.avg3m}</th>
                <th className="px-4 py-3 text-end">{t.avg6m}</th>
                <th className="px-4 py-3 text-end">{t.thisMonth}</th>
                <th className="px-6 py-3 text-end">{t.monthlyBudget}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-white/30">{t.noData}</td>
                </tr>
              )}
              {rows.map((r) => {
                const budget = parseFloat(r.monthly_budget);
                const actual = parseFloat(r.current_month_actual);
                const over = budget > 0 && actual > budget;
                return (
                  <tr key={r.category_id} className="group transition-colors hover:bg-white/[0.03]">
                    <td className="px-6 py-3.5">
                      <span className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base" style={{ backgroundColor: `${r.color}20` }}>
                          {r.emoji}
                        </span>
                        <span className="font-medium text-white/80">{name(r)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-end text-white/50">{fmt(r.avg_3m)}</td>
                    <td className="px-4 py-3.5 text-end text-white/50">{fmt(r.avg_6m)}</td>
                    <td className="px-4 py-3.5 text-end">
                      <span style={{ color: over ? "oklch(0.78 0.16 27)" : "white" }} className="opacity-80">
                        {fmt(r.current_month_actual)}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-end">
                      <BudgetInput
                        categoryId={r.category_id}
                        initial={budget}
                        t={t}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
