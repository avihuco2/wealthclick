"use client";

import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export default function DashboardMonthNav({ month, locale }: { month: string; locale: Locale }) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 7);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => router.push(`?month=${shiftMonth(month, -1)}`)}
        aria-label="Previous month"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/70"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <span className="min-w-[140px] text-center text-[14px] font-medium text-white/65">
        {monthLabel(month, locale)}
      </span>
      <button
        onClick={() => router.push(`?month=${shiftMonth(month, 1)}`)}
        aria-label="Next month"
        disabled={month >= today}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/70 disabled:opacity-25 disabled:cursor-not-allowed"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
