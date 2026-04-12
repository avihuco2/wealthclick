"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";

export function LanguageSwitcher({ currentLocale }: { currentLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  const targetLocale: Locale = currentLocale === "en" ? "he" : "en";
  const label = currentLocale === "en" ? "עברית" : "English";

  const handleSwitch = () => {
    // Replace the locale prefix in the current path
    const newPath = pathname.replace(`/${currentLocale}`, `/${targetLocale}`);
    router.push(newPath);
  };

  return (
    <button
      onClick={handleSwitch}
      aria-label={`Switch to ${targetLocale}`}
      className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-white/60 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.10] hover:text-white/90"
    >
      {label}
    </button>
  );
}
