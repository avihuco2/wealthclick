"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { InsightsData } from "@/lib/insights";
import type { Locale, Dictionary } from "@/lib/i18n";

type Props = {
  data: InsightsData;
  locale: Locale;
  t: Dictionary["insights"];
  month: string;
};

export default function InsightsClient({ data, locale, t, month }: Props) {
  const router = useRouter();

  function navigateMonth(dir: 1 | -1) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`?month=${next}`);
  }

  function fmtCurrency(val: string | number) {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: "ILS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(val));
  }

  function fmtDate(d: Date) {
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(d);
  }

  function fmtMonthLabel() {
    const [y, m] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, 1));
  }

  function getCatName(nameEn: string | null, nameHe: string | null): string {
    return locale === "he" ? nameHe || "ללא קטגוריה" : nameEn || "Uncategorized";
  }

  function deltaPercent(current: number, prior: number): { label: string; sign: "neutral" | "positive" | "negative" } {
    if (prior === 0 && current === 0) return { label: "—", sign: "neutral" };
    if (prior === 0) return { label: t.new, sign: "neutral" };
    const pct = ((current - prior) / prior) * 100;
    const sign = pct >= 0 ? "+" : "";
    // For expenses: lower is better (negative % change = good)
    return {
      label: `${sign}${Math.round(pct)}%`,
      sign: pct <= 0 ? "positive" : "negative",
    };
  }

  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);
  const comparison = data.periodComparison;
  const currentIncome = parseFloat(comparison.current_income);
  const currentExpenses = parseFloat(comparison.current_expenses);
  const currentNet = parseFloat(comparison.current_net);
  const priorIncome = parseFloat(comparison.prior_income);
  const priorExpenses = parseFloat(comparison.prior_expenses);

  const incomeDelta = deltaPercent(currentIncome, priorIncome);
  const expensesDelta = deltaPercent(currentExpenses, priorExpenses);

  return (
    <div>
      {/* Title + Month Navigator */}
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white mb-6">{t.title}</h1>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="rounded-xl border border-black/10 bg-black/[0.06] p-2 text-black/50 transition-all hover:bg-black/[0.10] hover:text-black/80 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/50 dark:hover:bg-white/[0.10] dark:hover:text-white/80"
          >
            <ChevronLeftIcon />
          </button>
          <span className="min-w-[160px] text-center text-[16px] font-medium text-black/80 dark:text-white/80">{fmtMonthLabel()}</span>
          <button
            onClick={() => navigateMonth(1)}
            disabled={isCurrentMonth}
            className={cn(
              "rounded-xl border border-black/10 bg-black/[0.06] p-2 transition-all dark:border-white/10 dark:bg-white/[0.06]",
              isCurrentMonth ? "cursor-not-allowed text-black/25 dark:text-white/25" : "text-black/50 hover:bg-black/[0.10] hover:text-black/80 dark:text-white/50 dark:hover:bg-white/[0.10] dark:hover:text-white/80",
            )}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>

      {/* Section 1: Period Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.10] bg-black/[0.05] p-6 backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.05]">
          <div className="absolute -bottom-8 end-[-2rem] h-32 w-32 rounded-full opacity-20 blur-[40px]" style={{ background: "oklch(0.72 0.17 142)" }} />
          <div className="relative">
            <p className="text-[12px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{t.income}</p>
            <p className="mt-2 text-[36px] font-semibold leading-none text-[oklch(0.80_0.14_142)]">{fmtCurrency(currentIncome)}</p>
            <p className="mt-2 text-[12px] text-black/35 dark:text-white/35">{incomeDelta.label}</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.10] bg-black/[0.05] p-6 backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.05]">
          <div className="absolute -bottom-8 end-[-2rem] h-32 w-32 rounded-full opacity-20 blur-[40px]" style={{ background: "oklch(0.72 0.18 27)" }} />
          <div className="relative">
            <p className="text-[12px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{t.expenses}</p>
            <p className="mt-2 text-[36px] font-semibold leading-none text-[oklch(0.78_0.16_27)]">{fmtCurrency(currentExpenses)}</p>
            <p className="mt-2 text-[12px] text-black/35 dark:text-white/35">{expensesDelta.label}</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.10] bg-black/[0.05] p-6 backdrop-blur-xl dark:border-white/[0.10] dark:bg-white/[0.05]">
          <div className="absolute -bottom-8 end-[-2rem] h-32 w-32 rounded-full opacity-20 blur-[40px]" style={{ background: currentNet >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.72 0.18 27)" }} />
          <div className="relative">
            <p className="text-[12px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{t.net}</p>
            <p className={cn("mt-2 text-[36px] font-semibold leading-none", currentNet >= 0 ? "text-[oklch(0.80_0.14_142)]" : "text-[oklch(0.78_0.16_27)]")}>
              {currentNet >= 0 ? "+" : "−"}{fmtCurrency(Math.abs(currentNet))}
            </p>
            <p className="mt-2 text-[12px] text-black/35 dark:text-white/35">{t.vsLastMonth}</p>
          </div>
        </div>
      </div>

      {/* Section 2: Category Breakdown */}
      {data.categoryBreakdown.length > 0 ? (
        <div className="mb-8 rounded-3xl border border-black/[0.08] bg-black/[0.04] p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
          <h2 className="mb-4 text-[16px] font-semibold text-black dark:text-white">{t.breakdownTitle}</h2>
          <div className="space-y-4">
            {data.categoryBreakdown.map((row) => (
              <div key={row.category_id ?? "uncategorized"} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px]">{row.category_emoji || "🏷️"}</span>
                    <span className="text-[13px] text-black/80 dark:text-white/80">{getCatName(row.category_name_en, row.category_name_he)}</span>
                  </div>
                  <span className="text-[13px] font-medium text-black dark:text-white">{row.pct.toFixed(0)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: row.category_color ?? "#8E8E93" }} />
                </div>
                <div className="text-[12px] text-black/40 dark:text-white/40">{fmtCurrency(row.total)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-8 rounded-3xl border border-black/[0.08] bg-black/[0.04] p-6 text-center backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
          <p className="text-[14px] text-black/40 dark:text-white/40">{t.noExpenses}</p>
        </div>
      )}

      {/* Section 3: Top Expenses */}
      {data.topExpenses.length > 0 && (
        <div className="mb-8 rounded-3xl border border-black/[0.08] bg-black/[0.04] p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
          <h2 className="mb-4 text-[16px] font-semibold text-black dark:text-white">{t.topExpensesTitle}</h2>
          <div className="space-y-3">
            {data.topExpenses.map((tx, i) => (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-[12px] font-medium text-black/50 dark:text-white/50">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-black/80 dark:text-white/80">{tx.description}</p>
                    <p className="text-[11px] text-black/35 dark:text-white/35">{fmtDate(tx.date)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <p className="text-[13px] font-medium text-black dark:text-white">{fmtCurrency(tx.amount)}</p>
                  {tx.category_emoji && (
                    <span className="text-[12px]" style={{ color: tx.category_color ?? undefined }}>
                      {tx.category_emoji}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Spending Pace */}
      <div className="mb-8 rounded-3xl border border-black/[0.08] bg-black/[0.04] p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
        <h2 className="mb-4 text-[16px] font-semibold text-black dark:text-white">{t.paceTitle}</h2>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[13px] text-black/60 dark:text-white/60">{t.activeDays}</span>
              <span className="text-[13px] font-medium text-black dark:text-white">
                {data.spendingPace.active_days} / {data.spendingPace.total_days} {t.daysInMonth}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-[oklch(0.5706_0.2236_258.71)]"
                style={{ width: `${(data.spendingPace.active_days / data.spendingPace.total_days) * 100}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <span className="text-[13px] text-black/60 dark:text-white/60">{t.avgPerDay}</span>
            <span className="text-[16px] font-semibold text-black dark:text-white">{fmtCurrency(data.spendingPace.avg_per_day)}</span>
          </div>
        </div>
      </div>

      {/* Section 5: Category Trends */}
      {data.categoryTrends.length > 0 && (
        <div className="rounded-3xl border border-black/[0.08] bg-black/[0.04] p-6 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
          <h2 className="mb-4 text-[16px] font-semibold text-black dark:text-white">{t.trendsTitle}</h2>
          <div className="space-y-3">
            {data.categoryTrends.map((row) => {
              const current = parseFloat(row.current_total);
              const prior = parseFloat(row.prior_total);
              const delta = deltaPercent(current, prior);
              return (
                <div key={row.category_id ?? "uncategorized"} className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-[16px]">{row.category_emoji || "🏷️"}</span>
                    <span className="truncate text-[13px] text-black/80 dark:text-white/80">{getCatName(row.category_name_en, row.category_name_he)}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <p className="text-[13px] font-medium text-black dark:text-white">{fmtCurrency(current)}</p>
                      <p className={cn("text-[11px]", delta.sign === "positive" ? "text-[oklch(0.80_0.14_142)]" : delta.sign === "negative" ? "text-[oklch(0.78_0.16_27)]" : "text-black/40 dark:text-white/40")}>
                        {delta.label}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronLeftIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>;
}
