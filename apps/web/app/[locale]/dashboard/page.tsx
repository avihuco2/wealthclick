import { auth, signOut } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { NavBar } from "@/components/NavBar";
import { getTransactionStats } from "@/lib/transactions";
import { getMonthlyTotals, getCategoryBreakdown, getAccountBreakdown } from "@/lib/insights";
import DashboardCharts from "./DashboardCharts";
import DashboardMonthNav from "./DashboardMonthNav";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const t = getDictionary(typedLocale).dashboard;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const firstName = session.user.name?.split(" ")[0] ?? null;

  const { month: monthParam } = await searchParams;
  const todayMonth = new Date().toISOString().slice(0, 7);
  const selectedMonth =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : todayMonth;

  const userId = session.user.id;
  const [monthStats, monthlyTotals, categoryBreakdown, accountBreakdown] = userId
    ? await Promise.all([
        getTransactionStats(userId, selectedMonth),
        getMonthlyTotals(userId, 6),
        getCategoryBreakdown(userId, selectedMonth),
        getAccountBreakdown(userId, selectedMonth),
      ])
    : [null, [], [], []];

  const fmt = (val: string | null | undefined, signed = false) =>
    val == null
      ? "—"
      : new Intl.NumberFormat("he-IL", {
          style: "currency",
          currency: "ILS",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(signed ? parseFloat(val) : Math.abs(parseFloat(val)));

  const netVal = monthStats ? parseFloat(monthStats.net) : null;
  const balanceValue = monthStats ? fmt(monthStats.net, true) : "—";
  const balanceColor = netVal === null ? undefined : netVal >= 0 ? "oklch(0.80 0.14 142)" : "oklch(0.78 0.16 27)";
  const spendingValue = monthStats ? fmt(monthStats.total_expenses) : "—";
  const savingsRate =
    monthStats && parseFloat(monthStats.total_income) > 0
      ? `${Math.round((parseFloat(monthStats.net) / parseFloat(monthStats.total_income)) * 100)}%`
      : "—";

  return (
    <div className="relative min-h-screen overflow-x-hidden">

      {/* ── Background glows ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-40 dark:opacity-100">
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
        activePage="dashboard"
        t={{
          dashboard: t.dashboardNav,
          transactions: t.transactions,
          bankAccounts: getDictionary(typedLocale).bankAccounts.navLabel,
          insights: getDictionary(typedLocale).insights.navLabel,
          budgets: getDictionary(typedLocale).budgets.navLabel,
          categories: getDictionary(typedLocale).categories.navLabel,
          settings: getDictionary(typedLocale).settings.navLabel,
          userManagement: t.userManagement,
          signOut: t.signOut,
        }}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: `/${locale}/login` });
        }}
      />

      {/* ── Main content ── */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Greeting */}
        <div className="mb-10">
          <h1 className="text-[32px] font-semibold tracking-tight text-black dark:text-white">
            {t.greeting(firstName)}
            <span className="ms-2">👋</span>
          </h1>
          <p className="mt-2 text-[15px] text-black/45 dark:text-white/45">{t.overviewSubtitle}</p>
        </div>

        {/* Month navigator */}
        <div className="mb-6 flex items-center justify-center">
          <DashboardMonthNav month={selectedMonth} locale={typedLocale} />
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <a href={`/${typedLocale}/transactions`} className="block">
            <MetricCard
              label={t.totalBalance}
              value={balanceValue}
              sub={t.totalBalanceSub}
              accentColor="oklch(0.5706 0.2236 258.71)"
              valueColor={balanceColor}
              icon={<BalanceIcon />}
            />
          </a>
          <MetricCard
            label={t.thisMonth}
            value={spendingValue}
            sub={t.thisMonthSub}
            accentColor="oklch(0.72 0.17 142)"
            icon={<SpendingIcon />}
          />
          <MetricCard
            label={t.savingsRate}
            value={savingsRate}
            sub={t.savingsRateSub}
            accentColor="oklch(0.72 0.18 54)"
            icon={<SavingsIcon />}
          />
        </div>

        {/* Charts carousel */}
        <div className="mt-6">
          <DashboardCharts
            monthlyTotals={monthlyTotals}
            categoryBreakdown={categoryBreakdown}
            accountBreakdown={accountBreakdown}
            locale={typedLocale}
            month={selectedMonth}
            t={{
              chartCashFlow:      t.chartCashFlow,
              chartSpending:      t.chartSpending,
              chartIncome:        t.chartIncome,
              chartExpenses:      t.chartExpenses,
              chartNet:           t.chartNet,
              chartNoData:        t.chartNoData,
              chartNoExpenses:    t.chartNoExpenses,
              chartUncategorized: t.chartUncategorized,
              chartByAccount:     t.chartByAccount,
              chartNoAccounts:    t.chartNoAccounts,
            }}
          />
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <a href={`/${locale}/bank-accounts`} className="block">
            <QuickAction
              icon={<BankIcon />}
              title={t.connectBankTitle}
              description={t.connectBankDescription}
            />
          </a>
          <a href={`/${locale}/insights`} className="block">
            <QuickAction
              icon={<InsightsIcon />}
              title={getDictionary(typedLocale).insights.widgetTitle}
              description={getDictionary(typedLocale).insights.widgetDescription}
            />
          </a>
          <a href={`/${locale}/budgets`} className="block">
            <QuickAction
              icon={<BudgetIcon />}
              title={getDictionary(typedLocale).budgets.navLabel}
              description={getDictionary(typedLocale).budgets.subtitle}
            />
          </a>
        </div>
      </main>
    </div>
  );
}

// ─── MetricCard ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accentColor, valueColor, icon }: {
  label: string; value: string; sub: string; accentColor: string; valueColor?: string; icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-black/[0.10] bg-black/[0.05] p-6 backdrop-blur-xl transition-all duration-300 hover:border-black/[0.18] hover:bg-black/[0.08] dark:border-white/[0.10] dark:bg-white/[0.05] dark:hover:border-white/[0.18] dark:hover:bg-white/[0.08]">
      <div className="absolute -bottom-8 end-[-2rem] h-32 w-32 rounded-full opacity-20 blur-[40px] transition-opacity duration-300 group-hover:opacity-30" style={{ background: accentColor }} />
      <div className="relative">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${accentColor}20`, boxShadow: `0 2px 12px ${accentColor}30` }}>
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        <p className="text-[12px] font-medium uppercase tracking-wider text-black/40 dark:text-white/40">{label}</p>
        <p className="mt-2 text-[36px] font-semibold leading-none text-black dark:text-white" style={{ color: valueColor }}>{value}</p>
        <p className="mt-2 text-[12px] text-black/35 dark:text-white/35">{sub}</p>
      </div>
    </div>
  );
}

// ─── QuickAction ──────────────────────────────────────────────────────────────

function QuickAction({ icon, title, description, badge }: {
  icon: React.ReactNode; title: string; description: string; badge?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-black/[0.08] bg-black/[0.03] p-5 backdrop-blur-md transition-all duration-200 hover:border-black/[0.14] hover:bg-black/[0.06] dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.14] dark:hover:bg-white/[0.06]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/[0.07] text-black/60 dark:border-white/10 dark:bg-white/[0.07] dark:text-white/60">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-medium text-black/80 dark:text-white/80">{title}</p>
          {badge && (
            <span className="rounded-full border border-black/10 bg-black/[0.06] px-2 py-0.5 text-[10px] font-medium text-black/35 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/35">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12px] text-black/35 dark:text-white/35">{description}</p>
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BalanceIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>;
}
function SpendingIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
}
function SavingsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
}
function BankIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="3" y1="22" x2="21" y2="22" /><line x1="6" y1="18" x2="6" y2="11" /><line x1="10" y1="18" x2="10" y2="11" /><line x1="14" y1="18" x2="14" y2="11" /><line x1="18" y1="18" x2="18" y2="11" /><polygon points="12 2 20 7 4 7" /></svg>;
}
function InsightsIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 20h20" /><path d="m5 17 4-5 4 3 4-6 4 5" /></svg>;
}
function BudgetIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
}
