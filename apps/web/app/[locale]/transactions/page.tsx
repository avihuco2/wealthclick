import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { getDb } from "@/lib/db";
import { getOrSeedCategories } from "@/lib/categories";
import { getTransactions, getTransactionStats } from "@/lib/transactions";
import { revalidatePath } from "next/cache";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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

    const name  = (formData.get("name")  as string)?.trim();
    const emoji = (formData.get("emoji") as string)?.trim() || "🏷️";
    const color = (formData.get("color") as string) || "#8E8E93";

    if (!name) return;

    const sql = getDb();
    await sql`
      INSERT INTO categories (user_id, name_en, name_he, color, icon, emoji)
      VALUES (${session.user.id}, ${name}, ${name}, ${color}, 'custom', ${emoji})
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

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
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
            <span className="text-white/20">/</span>
            <span className="text-[13px] text-white/50">{t.title}</span>
          </div>
          <LanguageSwitcher currentLocale={typedLocale} />
        </div>
      </header>

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
