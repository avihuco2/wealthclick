import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { getBankAccounts, getLatestScrapeJob } from "@/lib/bankAccounts";
import { BANK_CONFIGS } from "@/lib/scraperConfig";
import { getScrapeIntervalHours, getScrapeHistoryMonths, getAutoSyncEnabled } from "@/lib/settings";
import { NavBar } from "@/components/NavBar";
import BankAccountsClient from "@/components/BankAccountsClient";

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const t = getDictionary(typedLocale);

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const userId = session.user.id;
  if (!userId) redirect(`/${locale}/login`);

  const [accounts, scrapeIntervalHours, scrapeHistoryMonths, autoSyncEnabled] = await Promise.all([
    getBankAccounts(userId),
    getScrapeIntervalHours(),
    getScrapeHistoryMonths(),
    getAutoSyncEnabled(),
  ]);
  const accountsWithJobs = await Promise.all(
    accounts.map(async (account) => {
      const latestJob = await getLatestScrapeJob(account.id);
      const { credentials_encrypted: _creds, ...safe } = account;
      void _creds;
      return { ...safe, latestJob: latestJob ?? null };
    }),
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-18 blur-[130px]" />
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[oklch(0.60_0.18_200)] opacity-10 blur-[140px]" />
      </div>

      <NavBar
        locale={typedLocale}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        isAdmin={session.user.role === "admin"}
        activePage="bank-accounts"
        t={{
          dashboard: t.dashboard.dashboardNav,
          transactions: t.dashboard.transactions,
          bankAccounts: t.bankAccounts.navLabel,
          insights: t.insights.navLabel,
          budgets: t.budgets.navLabel,
          settings: t.settings.navLabel,
          userManagement: t.dashboard.userManagement,
          signOut: t.dashboard.signOut,
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <BankAccountsClient
          initialAccounts={accountsWithJobs}
          bankConfigs={Object.values(BANK_CONFIGS)}
          locale={typedLocale}
          scrapeIntervalHours={scrapeIntervalHours}
          scrapeHistoryMonths={scrapeHistoryMonths}
          autoSyncEnabled={autoSyncEnabled}
          t={t.bankAccounts}
        />
      </main>
    </div>
  );
}
