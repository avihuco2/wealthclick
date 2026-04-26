"use client";

import { useState, useRef } from "react";
import type { Locale } from "@/lib/i18n";
import type { MonthlyTotals, CategoryBreakdown, AccountBreakdown } from "@/lib/insights";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChartT = {
  chartCashFlow: string;
  chartSpending: string;
  chartIncome: string;
  chartExpenses: string;
  chartNet: string;
  chartNoData: string;
  chartNoExpenses: string;
  chartUncategorized: string;
  chartByAccount: string;
  chartNoAccounts: string;
};

type Props = {
  monthlyTotals: MonthlyTotals[];
  categoryBreakdown: CategoryBreakdown[];
  accountBreakdown: AccountBreakdown[];
  locale: Locale;
  t: ChartT;
};

// ─── Formatters ───────────────────────────────────────────────────────────────

const ILS = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const fmtILS = (v: number | string) =>
  ILS.format(typeof v === "string" ? parseFloat(v) : v);

const fmtK = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
};

const MONTHS_EN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_HE = ["ינו","פבר","מרס","אפר","מאי","יונ","יול","אוג","ספט","אוק","נוב","דצמ"];

const PALETTE = ["#007AFF","#34C759","#FF9500","#FF2D55","#5856D6","#00C7BE","#30B0C7","#FF6B6B"];

// ─── Cash Flow Bar Chart ──────────────────────────────────────────────────────

function CashFlowChart({ data, locale, t }: { data: MonthlyTotals[]; locale: Locale; t: ChartT }) {
  const MONTHS = locale === "he" ? MONTHS_HE : MONTHS_EN;
  const hasData = data.some((d) => parseFloat(d.income) > 0 || parseFloat(d.expenses) > 0);

  if (!hasData) {
    return (
      <div className="flex h-[155px] items-center justify-center text-center text-[12px] leading-relaxed text-white/25 px-6">
        {t.chartNoData}
      </div>
    );
  }

  const allValues = data.flatMap((d) => [parseFloat(d.income), parseFloat(d.expenses)]);
  const maxVal = Math.max(...allValues, 1);

  // SVG layout constants
  const VW = 500;
  const VH = 175;
  const TOP = 22;    // top of bars (room for net label)
  const BOTTOM = 143; // bottom of bars
  const H = BOTTOM - TOP; // bar max height = 121
  const n = data.length || 1;
  const groupW = VW / n;
  const barW = Math.min(28, groupW * 0.30);
  const gap = 3;

  const yScale = (v: number) => BOTTOM - (v / maxVal) * H;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="auto" aria-hidden="true">
      {/* Subtle gridlines */}
      {[0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={0} x2={VW}
          y1={BOTTOM - pct * H} y2={BOTTOM - pct * H}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1"
        />
      ))}
      {/* Baseline */}
      <line x1={0} x2={VW} y1={BOTTOM} y2={BOTTOM} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />

      {data.map((d, i) => {
        const cx = (i + 0.5) * groupW;
        const inc = parseFloat(d.income);
        const exp = parseFloat(d.expenses);
        const net = parseFloat(d.net);
        const incH = (inc / maxVal) * H;
        const expH = (exp / maxVal) * H;
        const mIdx = parseInt(d.month.split("-")[1], 10) - 1;
        const year = d.month.slice(2, 4);
        const showYear = mIdx === 0 || i === 0;

        // Net label positioned above the taller bar
        const netY = Math.min(yScale(inc), yScale(exp)) - 5;
        const netColor = net >= 0 ? "oklch(0.80 0.14 142)" : "oklch(0.75 0.18 27)";

        return (
          <g key={d.month}>
            {/* Income bar */}
            <rect
              x={cx - barW - gap / 2}
              y={BOTTOM - incH}
              width={barW}
              height={Math.max(incH, 2)}
              rx={5} ry={5}
              fill="oklch(0.72 0.17 142)"
              opacity={0.80}
            />
            {/* Expense bar */}
            <rect
              x={cx + gap / 2}
              y={BOTTOM - expH}
              width={barW}
              height={Math.max(expH, 2)}
              rx={5} ry={5}
              fill="oklch(0.65 0.20 27)"
              opacity={0.80}
            />
            {/* Net label */}
            {(inc > 0 || exp > 0) && (
              <text
                x={cx} y={netY}
                textAnchor="middle"
                fontSize="8.5" fontWeight="600"
                fill={netColor}
              >
                {net >= 0 ? "+" : ""}{fmtK(net)}
              </text>
            )}
            {/* Month label */}
            <text
              x={cx} y={VH - 14}
              textAnchor="middle" fontSize="10"
              fill="rgba(255,255,255,0.35)"
            >
              {MONTHS[mIdx]}
            </text>
            {showYear && (
              <text
                x={cx} y={VH - 3}
                textAnchor="middle" fontSize="8.5"
                fill="rgba(255,255,255,0.20)"
              >
                {`'${year}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Spending Donut ───────────────────────────────────────────────────────────

function SpendingDonut({ data, locale, t }: { data: CategoryBreakdown[]; locale: Locale; t: ChartT }) {
  const isHe = locale === "he";

  if (!data.length) {
    return (
      <div className="flex h-[155px] items-center justify-center text-[12px] text-white/25">
        {t.chartNoExpenses}
      </div>
    );
  }

  // Merge beyond top 6 into "Other"
  const MAX = 6;
  let segs = data.slice(0, MAX);
  if (data.length > MAX) {
    const otherTotal = data.slice(MAX).reduce((s, d) => s + parseFloat(d.total), 0);
    const otherPct   = data.slice(MAX).reduce((s, d) => s + d.pct, 0);
    segs = [...segs, {
      category_id: null,
      category_name_en: "Other",
      category_name_he: "אחר",
      category_color: "#8E8E93",
      category_emoji: "🏷️",
      total: String(otherTotal),
      pct: otherPct,
    }];
  }

  const grandTotal = data.reduce((s, d) => s + parseFloat(d.total), 0);
  const colors = segs.map((seg, i) => seg.category_color || PALETTE[i % PALETTE.length]);

  // SVG donut geometry
  const R = 52, CX = 78, CY = 78;
  const C = 2 * Math.PI * R;
  const SW = 20; // stroke width = ring thickness

  let cumPct = 0;
  const arcs = segs.map((seg, i) => {
    const dashLen = (seg.pct / 100) * C;
    const dashOffset = C * (1 - cumPct / 100);
    cumPct += seg.pct;
    return { ...seg, dashLen, dashOffset, color: colors[i] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      {/* Donut SVG */}
      <div className="shrink-0">
        <svg viewBox="0 0 156 156" width="156" height="156" aria-hidden="true">
          <g transform={`rotate(-90 ${CX} ${CY})`}>
            {/* Background ring */}
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke="rgba(255,255,255,0.05)" strokeWidth={SW} />
            {/* Segment arcs */}
            {arcs.map((arc, i) => (
              <circle
                key={i}
                cx={CX} cy={CY} r={R}
                fill="none"
                stroke={arc.color}
                strokeWidth={SW}
                strokeDasharray={`${arc.dashLen} ${C}`}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="butt"
                opacity={0.88}
              />
            ))}
          </g>
          {/* Center: total expenses */}
          <text x={CX} y={CY - 7} textAnchor="middle" fontSize="12" fontWeight="700" fill="white">
            {fmtILS(grandTotal)}
          </text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="9.5" fill="rgba(255,255,255,0.38)">
            {t.chartExpenses}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-[10px] min-w-0 flex-1 w-full">
        {arcs.map((arc, i) => {
          const name = isHe
            ? (arc.category_name_he || arc.category_name_en)
            : (arc.category_name_en || arc.category_name_he);
          return (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] leading-none shrink-0">{arc.category_emoji ?? "🏷️"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-1 mb-1">
                  <span className="text-[11px] text-white/55 truncate">
                    {name ?? (isHe ? "ללא קטגוריה" : t.chartUncategorized)}
                  </span>
                  <span className="text-[10px] text-white/35 shrink-0">
                    {arc.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${arc.pct}%`, backgroundColor: arc.color }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Account Bars ─────────────────────────────────────────────────────────────

function AccountBars({ data, t }: { data: AccountBreakdown[]; t: ChartT }) {
  if (!data.length) {
    return (
      <div className="flex h-[155px] items-center justify-center text-[12px] text-white/25">
        {t.chartNoAccounts}
      </div>
    );
  }

  const ACCOUNT_PALETTE = ["#007AFF","#5856D6","#FF9500","#34C759","#FF2D55","#00C7BE","#30B0C7","#FF6B6B"];

  return (
    <div className="flex flex-col gap-3">
      {data.map((row, i) => (
        <div key={row.account} className="flex items-center gap-3 min-w-0">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length] }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-[12px] text-white/60 truncate">{row.account}</span>
              <span className="text-[11px] text-white/40 shrink-0">{fmtILS(row.total)}</span>
            </div>
            <div className="h-[4px] w-full overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${row.pct}%`, backgroundColor: ACCOUNT_PALETTE[i % ACCOUNT_PALETTE.length] }}
              />
            </div>
          </div>
          <span className="text-[10px] text-white/30 w-7 text-end shrink-0">{row.pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

// ─── Slide header ─────────────────────────────────────────────────────────────

function SlideHeader({ title, legend }: {
  title: string;
  legend?: { color: string; label: string }[];
}) {
  return (
    <div className="mb-4 flex items-center">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
      {legend && (
        <div className="ms-auto flex items-center gap-4">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="text-[10px] text-white/30">{l.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Carousel ────────────────────────────────────────────────────────────

export default function DashboardCharts({ monthlyTotals, categoryBreakdown, accountBreakdown, locale, t }: Props) {
  const [slide, setSlide] = useState(0);
  const SLIDES = 3;
  const touchStartX = useRef<number | null>(null);

  const prev = () => setSlide((s) => Math.max(0, s - 1));
  const next = () => setSlide((s) => Math.min(SLIDES - 1, s + 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev();
    touchStartX.current = null;
  };

  return (
    <div dir="ltr" className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
      {/* Slide strip */}
      <div
        className="flex transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${slide * -100}%)` }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Slide 0 — Cash Flow */}
        <div className="min-w-full px-5 pt-5 pb-11">
          <SlideHeader
            title={t.chartCashFlow}
            legend={[
              { color: "oklch(0.72 0.17 142)", label: t.chartIncome },
              { color: "oklch(0.65 0.20 27)",  label: t.chartExpenses },
            ]}
          />
          <CashFlowChart data={monthlyTotals} locale={locale} t={t} />
        </div>

        {/* Slide 1 — Spending Donut */}
        <div className="min-w-full px-5 pt-5 pb-11">
          <SlideHeader title={t.chartSpending} />
          <SpendingDonut data={categoryBreakdown} locale={locale} t={t} />
        </div>

        {/* Slide 2 — Spending by Account */}
        <div className="min-w-full px-5 pt-5 pb-11">
          <SlideHeader title={t.chartByAccount} />
          <AccountBars data={accountBreakdown} t={t} />
        </div>
      </div>

      {/* Prev arrow (physical left — carousel direction is always LTR) */}
      {slide > 0 && (
        <button
          onClick={prev}
          aria-label="Previous chart"
          className="absolute left-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/40 transition-all hover:bg-white/[0.14] hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {slide < SLIDES - 1 && (
        <button
          onClick={next}
          aria-label="Next chart"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.07] text-white/40 transition-all hover:bg-white/[0.14] hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}

      {/* Dot indicators */}
      <div className="absolute bottom-3.5 inset-x-0 flex justify-center gap-1.5">
        {Array.from({ length: SLIDES }, (_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
            aria-label={`Chart ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === slide ? "w-5 bg-white/60" : "w-1.5 bg-white/18"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
