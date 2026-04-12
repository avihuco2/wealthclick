import { signOut } from "@/lib/auth";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function UnauthorizedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const t = getDictionary(locale as Locale).unauthorized;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.577_0.245_27.325)] opacity-10 blur-[140px]" />
        <div className="absolute -top-20 right-0 h-[400px] w-[400px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-8 blur-[120px]" />
      </div>

      <div className="w-full max-w-sm text-center">
        {/* Icon */}
        <div className="relative mx-auto mb-8 flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[oklch(0.577_0.245_27.325)] opacity-25 blur-[24px]" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md">
            <LockIcon />
          </div>
        </div>

        <h1 className="text-[26px] font-semibold text-white">{t.title}</h1>
        <p className="mx-auto mt-3 max-w-xs text-[14px] leading-relaxed text-white/40">
          {t.message}
        </p>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/${locale}/login` });
          }}
        >
          <button
            type="submit"
            className="rounded-xl border border-white/10 bg-white/[0.06] px-6 py-2.5 text-[14px] font-medium text-white/70 backdrop-blur-md transition-all duration-200 hover:border-white/20 hover:bg-white/[0.10] hover:text-white"
          >
            {t.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
