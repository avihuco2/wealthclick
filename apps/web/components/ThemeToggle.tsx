"use client";

import { useEffect, useState } from "react";

export function ThemeToggle({ labelDark, labelLight }: { labelDark: string; labelLight: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/[0.04] px-3 py-1.5 text-[13px] font-medium text-black/60 backdrop-blur-md transition-all duration-200 hover:border-black/20 hover:bg-black/[0.08] hover:text-black/90 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60 dark:hover:border-white/20 dark:hover:bg-white/[0.10] dark:hover:text-white/90"
      aria-label="Toggle theme"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
      <span>{dark ? labelLight : labelDark}</span>
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
