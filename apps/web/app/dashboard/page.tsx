import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path d="M6 22L11 13L16 18L21 10L26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="26" cy="10" r="2.5" fill="white" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold text-foreground">WealthClick</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted-foreground">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
            Good to see you{session.user.name ? `, ${session.user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Your financial dashboard is coming soon.
          </p>
        </div>

        {/* Placeholder cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Total Balance", value: "—", sub: "Connect accounts to get started" },
            { label: "This Month", value: "—", sub: "Spending overview" },
            { label: "Savings Rate", value: "—", sub: "Track your goals" },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-2xl bg-card p-6 ring-1 ring-border"
            >
              <p className="text-[13px] font-medium text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-[32px] font-semibold text-foreground">{card.value}</p>
              <p className="mt-1 text-[12px] text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
