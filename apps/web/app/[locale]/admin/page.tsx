import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getDictionary, isValidLocale, type Locale } from "@/lib/i18n";
import { getDb, type DbUser } from "@/lib/db";
import { revalidatePath } from "next/cache";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const t = getDictionary(typedLocale).admin;

  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (session.user.role !== "admin") redirect(`/${locale}/unauthorized`);

  const sql = getDb();
  const users = await sql<DbUser[]>`
    SELECT * FROM users ORDER BY role DESC, created_at ASC
  `;

  // ── Server Actions ───────────────────────────────────────────────────────────

  async function addUser(formData: FormData) {
    "use server";
    const email = (formData.get("email") as string)?.trim().toLowerCase();
    const role = (formData.get("role") as string) === "admin" ? "admin" : "user";
    if (!email) return;
    const db = getDb();
    await db`
      INSERT INTO users (email, role)
      VALUES (${email}, ${role})
      ON CONFLICT (email) DO NOTHING
    `;
    revalidatePath(`/${locale}/admin`);
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const current = formData.get("active") === "true";
    const db = getDb();
    await db`
      UPDATE users SET active = ${!current}, updated_at = NOW() WHERE id = ${id}
    `;
    revalidatePath(`/${locale}/admin`);
  }

  async function removeUser(formData: FormData) {
    "use server";
    const id = formData.get("id") as string;
    const db = getDb();
    await db`DELETE FROM users WHERE id = ${id}`;
    revalidatePath(`/${locale}/admin`);
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden opacity-40 dark:opacity-100">
        <div className="absolute -top-24 -left-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-15 blur-[130px]" />
        <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-[oklch(0.55_0.22_300)] opacity-10 blur-[120px]" />
      </div>

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.08] bg-black/[0.04] backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.04]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <a href={`/${locale}/dashboard`} className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[oklch(0.5706_0.2236_258.71)] shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.5)]">
                <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                  <path d="M6 22L11 13L16 18L21 10L26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="26" cy="10" r="2.5" fill="white" />
                </svg>
              </div>
              <span className="text-[15px] font-semibold text-black dark:text-white">Wealth<span className="text-[oklch(0.48_0.22_258.71)] dark:text-[oklch(0.72_0.18_258.71)]">Click</span></span>
            </a>
            <span className="text-black/20 dark:text-white/20">/</span>
            <span className="text-[13px] text-black/50 dark:text-white/50">{t.title}</span>
          </div>
          <span className="rounded-full border border-black/10 bg-black/[0.06] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-black/40 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/40">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-[28px] font-semibold tracking-tight text-black dark:text-white">{t.title}</h1>
          <p className="mt-1 text-[14px] text-black/40 dark:text-white/40">{t.subtitle}</p>
        </div>

        {/* Add user form */}
        <form
          action={addUser}
          className="mb-8 flex flex-col gap-3 rounded-2xl border border-black/[0.08] bg-black/[0.04] p-5 backdrop-blur-md sm:flex-row sm:items-end dark:border-white/[0.08] dark:bg-white/[0.04]"
        >
          <div className="flex-1">
            <label className="mb-1.5 block text-[12px] font-medium text-black/40 dark:text-white/40">
              {t.emailCol}
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder={t.emailPlaceholder}
              className="w-full rounded-xl border border-black/10 bg-black/[0.06] px-4 py-2.5 text-[14px] text-black placeholder-black/20 outline-none backdrop-blur-md transition-all focus:border-black/25 focus:bg-black/[0.09] dark:border-white/10 dark:bg-white/[0.06] dark:text-white dark:placeholder-white/20 dark:focus:border-white/25 dark:focus:bg-white/[0.09]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-black/40 dark:text-white/40">
              {t.role}
            </label>
            <select
              name="role"
              className="rounded-xl border border-black/10 bg-[oklch(0.96_0.005_260)] px-4 py-2.5 text-[14px] text-black/80 outline-none backdrop-blur-md transition-all focus:border-black/25 dark:border-white/10 dark:bg-[oklch(0.12_0.02_260)] dark:text-white/80 dark:focus:border-white/25"
            >
              <option value="user">{t.roleUser}</option>
              <option value="admin">{t.roleAdmin}</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.35)] transition-all hover:brightness-110"
          >
            {t.addUser}
          </button>
        </form>

        {/* Users table */}
        <div className="overflow-hidden rounded-2xl border border-black/[0.08] backdrop-blur-md dark:border-white/[0.08]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-black/[0.06] bg-black/[0.03] dark:border-white/[0.06] dark:bg-white/[0.03]">
                {[t.nameCol, t.emailCol, t.roleCol, t.statusCol, t.actionsCol].map((h) => (
                  <th key={h} className="px-5 py-3 text-start text-[11px] font-medium uppercase tracking-wider text-black/30 dark:text-white/30">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, i) => {
                const isSelf = user.email === session.user.email;
                return (
                  <tr
                    key={user.id}
                    className={`border-b border-black/[0.04] transition-colors hover:bg-black/[0.03] dark:border-white/[0.04] dark:hover:bg-white/[0.03] ${i === users.length - 1 ? "border-none" : ""}`}
                  >
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {user.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.image} alt="" width={32} height={32} className="rounded-full ring-1 ring-black/10 dark:ring-white/10" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/10 text-[12px] font-semibold uppercase text-black/60 dark:bg-white/10 dark:text-white/60">
                            {(user.name ?? user.email)[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-[13px] font-medium text-black/80 dark:text-white/80">
                            {user.name ?? "—"}
                            {isSelf && <span className="ms-1.5 text-[10px] text-black/30 dark:text-white/30">({t.you})</span>}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4 text-[13px] text-black/50 dark:text-white/50">{user.email}</td>

                    {/* Role */}
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        user.role === "admin"
                          ? "border border-[oklch(0.5706_0.2236_258.71/0.4)] bg-[oklch(0.5706_0.2236_258.71/0.12)] text-[oklch(0.55_0.22_258.71)] dark:text-[oklch(0.75_0.15_258.71)]"
                          : "border border-black/10 bg-black/[0.05] text-black/40 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/40"
                      }`}>
                        {user.role === "admin" ? t.roleAdmin : t.roleUser}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        user.active
                          ? "border border-[oklch(0.72_0.17_142/0.4)] bg-[oklch(0.72_0.17_142/0.12)] text-[oklch(0.60_0.17_142)] dark:text-[oklch(0.80_0.14_142)]"
                          : "border border-black/10 bg-black/[0.05] text-black/30 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/30"
                      }`}>
                        {user.active ? t.active : t.inactive}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {/* Toggle active — disabled for self */}
                        {!isSelf && (
                          <form action={toggleActive}>
                            <input type="hidden" name="id" value={user.id} />
                            <input type="hidden" name="active" value={String(user.active)} />
                            <button
                              type="submit"
                              className="rounded-lg border border-black/10 bg-black/[0.05] px-3 py-1.5 text-[12px] text-black/50 transition-all hover:border-black/20 hover:bg-black/[0.09] hover:text-black/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/50 dark:hover:border-white/20 dark:hover:bg-white/[0.09] dark:hover:text-white/80"
                            >
                              {user.active ? t.deactivate : t.activate}
                            </button>
                          </form>
                        )}

                        {/* Remove — disabled for self */}
                        {!isSelf && (
                          <form action={removeUser}>
                            <input type="hidden" name="id" value={user.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-[oklch(0.577_0.245_27.325/0.3)] bg-[oklch(0.577_0.245_27.325/0.08)] px-3 py-1.5 text-[12px] text-[oklch(0.75_0.18_27.325)] transition-all hover:bg-[oklch(0.577_0.245_27.325/0.15)]"
                            >
                              {t.remove}
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
