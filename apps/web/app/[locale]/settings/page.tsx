import { auth, signOut } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { NavBar } from "@/components/NavBar";
import { getDb } from "@/lib/db";
import { getAutoSyncEnabled } from "@/lib/settings";
import ApiKeysClient from "./ApiKeysClient";
import WhatsAppSection from "./WhatsAppSection";
import ScraperSettingsSection from "./ScraperSettingsSection";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const dict = getDictionary(typedLocale);
  const t = dict.settings;

  const session = await auth();
  if (!session?.user?.id) redirect(`/${locale}/login`);

  const sql = getDb();
  const [keys, autoSyncEnabled] = await Promise.all([
    sql<{ id: string; name: string; created_at: string; last_used_at: string | null }[]>`
      SELECT id, name, created_at::text, last_used_at::text
      FROM api_keys
      WHERE user_id = ${session.user.id}
      ORDER BY created_at DESC
    `,
    getAutoSyncEnabled(),
  ]);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-40 dark:opacity-100">
        <div className="absolute -top-24 -left-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-18 blur-[130px]" />
        <div className="absolute -top-10 right-0 h-[500px] w-[500px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-12 blur-[120px]" />
      </div>

      <NavBar
        locale={typedLocale}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        isAdmin={session.user.role === "admin"}
        activePage="settings"
        t={{
          dashboard: dict.dashboard.dashboardNav,
          transactions: dict.dashboard.transactions,
          bankAccounts: dict.bankAccounts.navLabel,
          insights: dict.insights.navLabel,
          budgets: dict.budgets.navLabel,
          categories: dict.categories.navLabel,
          settings: dict.settings.navLabel,
          userManagement: dict.dashboard.userManagement,
          signOut: dict.dashboard.signOut,
        }}
        signOutAction={async () => {
          "use server";
          await signOut({ redirectTo: `/${locale}/login` });
        }}
      />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-8 text-[28px] font-semibold tracking-tight text-black dark:text-white">{t.title}</h1>
        <ScraperSettingsSection initialEnabled={autoSyncEnabled} t={t.scraper} />
        <ApiKeysClient initialKeys={keys} locale={typedLocale} t={t} />
        <WhatsAppSection t={t.whatsapp} />
      </main>
    </div>
  );
}
