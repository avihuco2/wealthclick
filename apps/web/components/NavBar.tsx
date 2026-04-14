"use client";

import { useState } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Locale } from "@/lib/i18n";

type Props = {
  locale: Locale;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  isAdmin?: boolean;
  activePage?: "dashboard" | "transactions" | "admin";
  t: {
    dashboard: string;
    transactions: string;
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
    ...(isAdmin && t.userManagement
      ? [{ href: `/${locale}/admin`, label: t.userManagement, key: "admin" }]
      : []),
  ];

  const linkClass = (key: string) =>
    `rounded-xl border px-3 py-1.5 text-[13px] backdrop-blur-md transition-all duration-200 ${
      activePage === key
        ? "border-white/20 bg-white/[0.10] text-white/90"
        : "border-white/10 bg-white/[0.06] text-white/60 hover:border-white/20 hover:bg-white/[0.10] hover:text-white/90"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">

        {/* Logo */}
        <a href={`/${locale}/dashboard`} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[oklch(0.5706_0.2236_258.71)] shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.5)]">
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M6 22L11 13L16 18L21 10L26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="26" cy="10" r="2.5" fill="white" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold text-white">
            Wealth<span className="text-[oklch(0.72_0.18_258.71)]">Click</span>
          </span>
        </a>

        {/* Desktop nav */}
        <div className="hidden items-center gap-3 sm:flex">
          {navLinks.map((link) => (
            <a key={link.key} href={link.href} className={linkClass(link.key)}>
              {link.label}
            </a>
          ))}

          {/* Avatar */}
          {(userImage || userEmail) && (
            <div className="flex items-center gap-2">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt={userName ?? "avatar"} width={28} height={28} className="rounded-full ring-1 ring-white/20" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold uppercase text-white/70">
                  {(userName ?? userEmail ?? "U")[0]}
                </div>
              )}
              <span className="text-[13px] text-white/50">{userEmail}</span>
            </div>
          )}

          <LanguageSwitcher currentLocale={locale} />

          {signOutAction && (
            <form action={signOutAction}>
              <button type="submit" className={linkClass("__signout")}>
                {t.signOut}
              </button>
            </form>
          )}
        </div>

        {/* Mobile: lang switcher + hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <LanguageSwitcher currentLocale={locale} />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/60 transition-all hover:bg-white/[0.10] hover:text-white/90"
          >
            {open ? <XIcon /> : <HamburgerIcon />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-white/[0.06] bg-[oklch(0.08_0.02_260/0.95)] px-6 py-4 backdrop-blur-xl sm:hidden">

          {/* User info */}
          {(userImage || userEmail) && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={userImage} alt={userName ?? "avatar"} width={36} height={36} className="rounded-full ring-1 ring-white/20" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold uppercase text-white/70">
                  {(userName ?? userEmail ?? "U")[0]}
                </div>
              )}
              <div className="min-w-0">
                {userName && <p className="truncate text-[14px] font-medium text-white/80">{userName}</p>}
                <p className="truncate text-[12px] text-white/40">{userEmail}</p>
              </div>
            </div>
          )}

          {/* Nav links */}
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 text-[14px] transition-all ${
                  activePage === link.key
                    ? "bg-white/[0.10] text-white"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white/90"
                }`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Sign out */}
          {signOutAction && (
            <form action={signOutAction} className="mt-3 border-t border-white/[0.06] pt-3">
              <button
                type="submit"
                className="w-full rounded-xl px-4 py-3 text-start text-[14px] text-white/40 transition-all hover:bg-white/[0.06] hover:text-white/60"
              >
                {t.signOut}
              </button>
            </form>
          )}
        </div>
      )}
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
