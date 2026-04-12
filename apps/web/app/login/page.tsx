import { signIn, auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-4 py-16 overflow-hidden">

      {/* ── Layered background glows ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Deep navy base is set via --background CSS variable */}

        {/* Top-center: primary blue bloom */}
        <div className="absolute -top-32 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-20 blur-[140px]" />

        {/* Bottom-left: purple bloom */}
        <div className="absolute -bottom-20 -left-20 h-[500px] w-[500px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-15 blur-[120px]" />

        {/* Top-right: teal accent */}
        <div className="absolute -top-10 right-0 h-[400px] w-[400px] rounded-full bg-[oklch(0.65_0.18_200)] opacity-12 blur-[110px]" />

        {/* Center soft white shimmer */}
        <div className="absolute top-1/2 left-1/2 h-[300px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-[0.025] blur-[80px]" />
      </div>

      {/* ── Main card container ── */}
      <div className="w-full max-w-sm">

        {/* Logo + Brand */}
        <div className="mb-10 flex flex-col items-center gap-4">
          {/* Icon with layered glow */}
          <div className="relative">
            {/* Glow behind icon */}
            <div className="absolute inset-0 rounded-3xl bg-[oklch(0.5706_0.2236_258.71)] opacity-50 blur-[24px] scale-110" />
            <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-3xl bg-[oklch(0.5706_0.2236_258.71)] shadow-[0_8px_32px_oklch(0.5706_0.2236_258.71/0.5)]">
              <WealthIcon />
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-[30px] font-semibold tracking-tight text-white">
              WealthClick
            </h1>
            <p className="mt-1.5 text-[15px] text-white/50">
              Your personal finance, beautifully managed.
            </p>
          </div>
        </div>

        {/* Glass login card */}
        <div className="rounded-3xl border border-white/[0.12] bg-white/[0.06] px-8 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <h2 className="mb-1 text-center text-[17px] font-semibold text-white">
            Sign in to continue
          </h2>
          <p className="mb-7 text-center text-[13px] leading-relaxed text-white/45">
            Connect your account to track spending, set budgets, and see where
            your money goes.
          </p>

          {/* Google Sign-in — glass button */}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-3.5 text-[15px] font-medium text-white shadow-[0_2px_12px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-white/[0.13] hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)] active:scale-[0.98]"
            >
              {/* Subtle hover shimmer */}
              <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <GoogleIcon />
              <span className="relative">Continue with Google</span>
            </button>
          </form>

          {/* Thin separator */}
          <div className="my-5 h-px w-full bg-white/8" />

          <p className="text-center text-[12px] leading-relaxed text-white/30">
            By continuing, you agree to our{" "}
            <a
              href="/terms"
              className="text-white/50 underline underline-offset-2 transition-colors hover:text-white/80"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-white/50 underline underline-offset-2 transition-colors hover:text-white/80"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>

        {/* Features strip */}
        <div className="mt-8 flex items-center justify-center gap-6">
          <Feature icon={<ShieldIcon />} label="Secure & private" />
          <FeatureDivider />
          <Feature icon={<ChartIcon />} label="Smart insights" />
          <FeatureDivider />
          <Feature icon={<BellIcon />} label="Budget alerts" />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-white/35">{icon}</div>
      <span className="text-[11px] text-white/35">{label}</span>
    </div>
  );
}

function FeatureDivider() {
  return <div className="h-6 w-px bg-white/10" />;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function WealthIcon() {
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 22L11 13L16 18L21 10L26 16"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26" cy="10" r="2.5" fill="white" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
