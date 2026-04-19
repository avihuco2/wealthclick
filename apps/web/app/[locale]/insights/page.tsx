import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { getInsightsData } from "@/lib/insights";
import { NavBar } from "@/components/NavBar";
import InsightsClient from "./InsightsClient";

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const t = getDictionary(typedLocale).insights;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const userId = session.user.id;
  if (!userId) redirect(`/${locale}/login`);

  const { month: monthParam } = await searchParams;
  const month = monthParam ?? new Date().toISOString().slice(0, 7);

  const data = await getInsightsData(userId, month);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* ── Background glows ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-18 blur-[130px]" />
        <div className="absolute -top-10 right-0 h-[500px] w-[500px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-12 blur-[120px]" />
        <div className="absolute -bottom-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[oklch(0.60_0.18_200)] opacity-10 blur-[140px]" />
        <div className="absolute top-1/2 right-[-100px] h-[350px] w-[350px] rounded-full bg-[oklch(0.72_0.18_54)] opacity-8 blur-[100px]" />
      </div>

      <NavBar
        locale={typedLocale}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        isAdmin={session.user.role === "admin"}
        activePage="insights"
        t={{
          dashboard: getDictionary(typedLocale).dashboard.dashboardNav,
          transactions: getDictionary(typedLocale).dashboard.transactions,
          bankAccounts: getDictionary(typedLocale).bankAccounts.navLabel,
          insights: getDictionary(typedLocale).insights.navLabel,
          budgets: getDictionary(typedLocale).budgets.navLabel,
          settings: getDictionary(typedLocale).settings.navLabel,
          userManagement: getDictionary(typedLocale).dashboard.userManagement,
          signOut: getDictionary(typedLocale).dashboard.signOut,
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <InsightsClient data={data} locale={typedLocale} t={t} month={month} />
      </main>
    </div>
  );
}
