import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { getDb } from "@/lib/db";
import { getOrSeedCategories } from "@/lib/categories";
import { getTransactions, getTransactionStats } from "@/lib/transactions";
import { revalidatePath } from "next/cache";
import { upsertCategoryRule } from "@/lib/categoryRules";
import { NavBar } from "@/components/NavBar";
import TransactionsClient from "./TransactionsClient";

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = getDictionary(typedLocale).transactions as any;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);

  const userId = session.user.id;
  if (!userId) redirect(`/${locale}/login`);

  const { month: monthParam } = await searchParams;
  const month = monthParam ?? new Date().toISOString().slice(0, 7);

  const [transactions, categories, stats] = await Promise.all([
    getTransactions(userId, month),
    getOrSeedCategories(userId),
    getTransactionStats(userId, month),
  ]);

  // ── Server Actions ────────────────────────────────────────────────────────

  async function createTransaction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;

    const sql = getDb();
    const description = (formData.get("description") as string)?.trim();
    const amount = parseFloat(formData.get("amount") as string);
    const type = formData.get("type") as "income" | "expense";
    const date = formData.get("date") as string;
    const categoryId = (formData.get("category_id") as string) || null;
    const account = (formData.get("account") as string)?.trim() || null;

    if (!description || isNaN(amount) || amount <= 0 || !type || !date) return;

    await sql`
      INSERT INTO transactions (user_id, category_id, account, date, amount, description, type)
      VALUES (${session.user.id}, ${categoryId}, ${account}, ${date}, ${amount}, ${description}, ${type})
    `;
    // Learn rule for future auto-categorization
    if (categoryId && description) {
      await upsertCategoryRule(session.user.id, description, categoryId);
    }
    revalidatePath(`/${locale}/transactions`);
    revalidatePath(`/${locale}/dashboard`);
  }

  async function updateTransaction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;

    const id = formData.get("id") as string;
    if (!id) return;

    const sql = getDb();
    const description = (formData.get("description") as string)?.trim();
    const amount = parseFloat(formData.get("amount") as string);
    const type = formData.get("type") as "income" | "expense";
    const date = formData.get("date") as string;
    const categoryId = (formData.get("category_id") as string) || null;
    const account = (formData.get("account") as string)?.trim() || null;

    if (!description || isNaN(amount) || amount <= 0 || !type || !date) return;

    await sql`
      UPDATE transactions
      SET description = ${description},
          amount      = ${amount},
          type        = ${type},
          date        = ${date},
          category_id = ${categoryId},
          account     = ${account},
          updated_at  = NOW()
      WHERE id = ${id} AND user_id = ${session.user.id}
    `;
    // Learn rule for future auto-categorization
    if (categoryId && description) {
      await upsertCategoryRule(session.user.id, description, categoryId);
    }
    revalidatePath(`/${locale}/transactions`);
    revalidatePath(`/${locale}/dashboard`);
  }

  async function deleteTransaction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;

    const id = formData.get("id") as string;
    if (!id) return;

    const sql = getDb();
    await sql`
      DELETE FROM transactions WHERE id = ${id} AND user_id = ${session.user.id}
    `;
    revalidatePath(`/${locale}/transactions`);
    revalidatePath(`/${locale}/dashboard`);
  }

  async function createCategory(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) return;

    const nameEn = (formData.get("name_en") as string)?.trim();
    const nameHe = (formData.get("name_he") as string)?.trim();
    const emoji  = (formData.get("emoji")   as string)?.trim() || "🏷️";
    const color  = (formData.get("color")   as string) || "#8E8E93";

    if (!nameEn || !nameHe) return;

    const sql = getDb();
    await sql`
      INSERT INTO categories (user_id, name_en, name_he, color, icon, emoji)
      VALUES (${session.user.id}, ${nameEn}, ${nameHe}, ${color}, 'custom', ${emoji})
    `;
    revalidatePath(`/${locale}/transactions`);
  }

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
        activePage="transactions"
        t={{
          dashboard: getDictionary(typedLocale).dashboard.dashboardNav,
          transactions: getDictionary(typedLocale).dashboard.transactions,
          bankAccounts: getDictionary(typedLocale).bankAccounts.navLabel,
          userManagement: getDictionary(typedLocale).dashboard.userManagement,
          signOut: getDictionary(typedLocale).dashboard.signOut,
        }}
      />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <TransactionsClient
          transactions={transactions}
          categories={categories}
          stats={stats}
          locale={typedLocale}
          month={month}
          t={t}
          createAction={createTransaction}
          updateAction={updateTransaction}
          deleteAction={deleteTransaction}
          createCategoryAction={createCategory}
        />
      </main>
    </div>
  );
}
