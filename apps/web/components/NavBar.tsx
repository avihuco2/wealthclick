"use client";

import { useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  isAdmin?: boolean;
  activePage?: "dashboard" | "transactions" | "bank-accounts" | "insights" | "budgets" | "settings" | "admin" | "categories";
  t: {
    dashboard: string;
    transactions: string;
    bankAccounts?: string;
    insights?: string;
    budgets?: string;
    categories?: string;
    settings?: string;
    userManagement?: string;
    signOut: string;
  };
  signOutAction?: () => Promise<void>;
};

export function NavBar({
  locale,
  userName,
  userEmail,
  userImage,
  isAdmin,
  activePage,
  t,
  signOutAction,
}: Props) {
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: `/${locale}/dashboard`, label: t.dashboard, key: "dashboard" },
    { href: `/${locale}/transactions`, label: t.transactions, key: "transactions" },
    ...(t.bankAccounts
      ? [{ href: `/${locale}/bank-accounts`, label: t.bankAccounts, key: "bank-accounts" }]
      : []),
    ...(t.insights
      ? [{ href: `/${locale}/insights`, label: t.insights, key: "insights" }]
      : []),
    ...(t.budgets
      ? [{ href: `/${locale}/budgets`, label: t.budgets, key: "budgets" }]
      : []),
    ...(t.categories
      ? [{ href: `/${locale}/categories`, label: t.categories, key: "categories" }]
      : []),
    ...(t.settings
      ? [{ href: `/${locale}/settings`, label: t.settings, key: "settings" }]
      : []),
    ...(isAdmin && t.userManagement
      ? [{ href: `/${locale}/admin`, label: t.userManagement, key: "admin" }]
      : []),
  ];

  const linkClass = (key: string) =>
    `rounded-xl border px-3 py-1.5 text-[13px] backdrop-blur-md transition-all duration-200 ${
      activePage === key
        ? "border-black/20 bg-black/[0.10] text-black/90 dark:border-white/20 dark:bg-white/[0.10] dark:text-white/90"
        : "border-black/10 bg-black/[0.06] text-black/60 hover:border-black/20 hover:bg-black/[0.10] hover:text-black/90 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60 dark:hover:border-white/20 dark:hover:bg-white/[0.10] dark:hover:text-white/90"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-black/[0.08] bg-black/[0.04] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <a href={`/${locale}/dashboard`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[oklch(0.5706_0.2236_258.71)] shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.5)]">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M6 22L11 13L16 18L21 10L26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="26" cy="10" r="2.5" fill="white" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-black dark:text-white">
            Wealth<span className="text-[oklch(0.48_0.22_258.71)] dark:text-[oklch(0.72_0.18_258.71)]">Click</span>
          </span>
        </a>

        {/* Right: lang switcher + theme + hamburger */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher currentLocale={locale} />
          <ThemeToggle labelDark="Dark" labelLight="Light" />

          {/* Hamburger + anchored dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/[0.06] text-black/60 transition-all hover:bg-black/[0.10] hover:text-black/90 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/60 dark:hover:bg-white/[0.10] dark:hover:text-white/90"
            >
              {open ? <XIcon /> : <HamburgerIcon />}
            </button>

            {/* Dropdown panel — anchored to button, not full-width */}
            {open && (
              <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-2xl border border-black/[0.10] bg-[oklch(0.96_0.005_260/0.97)] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:border-white/[0.10] dark:bg-[oklch(0.09_0.02_260/0.97)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">

                {/* User info */}
                {(userImage || userEmail) && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl border border-black/[0.07] bg-black/[0.04] px-3 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.04]">
                    {userImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={userImage} alt={userName ?? "avatar"} width={32} height={32} className="rounded-full ring-1 ring-black/20 dark:ring-white/20" />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/10 text-[12px] font-semibold uppercase text-black/70 dark:bg-white/10 dark:text-white/70">
                        {(userName ?? userEmail ?? "U")[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      {userName && <p className="truncate text-[13px] font-medium text-black/80 dark:text-white/80">{userName}</p>}
                      <p className="truncate text-[11px] text-black/40 dark:text-white/40">{userEmail}</p>
                    </div>
                  </div>
                )}

                {/* Nav links */}
                <nav className="flex flex-col gap-0.5">
                  {navLinks.map((link) => (
                    <a
                      key={link.key}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={`rounded-xl px-3 py-2.5 text-[13px] transition-all ${
                        activePage === link.key
                          ? "bg-black/[0.10] text-black dark:bg-white/[0.10] dark:text-white"
                          : "text-black/60 hover:bg-black/[0.06] hover:text-black/90 dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white/90"
                      }`}
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>

                {/* Sign out */}
                {signOutAction && (
                  <form action={signOutAction} className="mt-1 border-t border-black/[0.06] pt-1 dark:border-white/[0.06]">
                    <button
                      type="submit"
                      className="w-full rounded-xl px-3 py-2.5 text-start text-[13px] text-black/40 transition-all hover:bg-black/[0.06] hover:text-black/60 dark:text-white/40 dark:hover:bg-white/[0.06] dark:hover:text-white/60"
                    >
                      {t.signOut}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
