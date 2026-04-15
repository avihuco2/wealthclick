"use client";

import { useState, useMemo, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { DbTransaction, TransactionStats } from "@/lib/transactions";
import type { DbCategory } from "@/lib/categories";
import type { Locale, Dictionary } from "@/lib/i18n";

const COLOR_PALETTE = [
  "#FF9500", "#007AFF", "#FF2D55", "#AF52DE",
  "#34C759", "#5AC8FA", "#5856D6", "#32ADE6",
  "#FFCC00", "#30D158", "#64D2FF", "#8E8E93",
];

type Props = {
  transactions: DbTransaction[];
  categories: DbCategory[];
  stats: TransactionStats;
  locale: Locale;
  month: string;
  t: Dictionary["transactions"];
  createAction: (formData: FormData) => Promise<void>;
  updateAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  createCategoryAction: (formData: FormData) => Promise<void>;
};

export default function TransactionsClient({
  transactions,
  categories,
  stats,
  locale,
  month,
  t,
  createAction,
  updateAction,
  deleteAction,
  createCategoryAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Transaction modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<DbTransaction | null>(null);
  const [formType, setFormType] = useState<"income" | "expense">("expense");

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catColor, setCatColor] = useState(COLOR_PALETTE[0]);

  // Inline delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto-categorize
  const [autoCatting, setAutoCatting] = useState(false);
  const [autoCatResult, setAutoCatResult] = useState<number | null>(null);

  async function handleAutoCategorize() {
    setAutoCatting(true);
    setAutoCatResult(null);
    const res = await fetch("/api/transactions/categorize-all", { method: "POST" });
    if (res.ok) {
      const { updated } = await res.json();
      setAutoCatResult(updated);
      router.refresh();
    }
    setAutoCatting(false);
  }

  // Inline category overrides: undefined = unchanged, null = cleared, string = new id
  type CatOverride = { categoryId: string | null | undefined; saving: boolean };
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CatOverride>>({});

  async function handleCategoryChange(txId: string, categoryId: string | null) {
    const original = transactions.find((t) => t.id === txId)?.category_id ?? null;
    setCategoryOverrides((prev) => ({ ...prev, [txId]: { categoryId, saving: true } }));
    const res = await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    });
    setCategoryOverrides((prev) => ({
      ...prev,
      [txId]: { categoryId: res.ok ? categoryId : original, saving: false },
    }));
  }

  // Filters
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFormType(editingTx?.type ?? "expense");
  }, [editingTx]);

  // Escape closes whichever modal is open
  useEffect(() => {
    if (!modalOpen && !catModalOpen) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal();
        closeCatModal();
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [modalOpen, catModalOpen]);

  function openAdd() { setEditingTx(null); setModalOpen(true); }
  function openEdit(tx: DbTransaction) { setEditingTx(tx); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditingTx(null); }
  function closeCatModal() { setCatModalOpen(false); setCatColor(COLOR_PALETTE[0]); }

  function handleSubmit(formData: FormData) {
    if (editingTx) formData.set("id", editingTx.id);
    startTransition(async () => {
      if (editingTx) { await updateAction(formData); } else { await createAction(formData); }
      closeModal();
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      await deleteAction(fd);
      setDeletingId(null);
      router.refresh();
    });
  }

  function handleCatSubmit(formData: FormData) {
    formData.set("color", catColor);
    startTransition(async () => {
      await createCategoryAction(formData);
      closeCatModal();
      router.refresh();
    });
  }

  function navigateMonth(dir: 1 | -1) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`?month=${next}`);
  }

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        const cat = locale === "he" ? tx.category_name_he : tx.category_name_en;
        return (
          tx.description.toLowerCase().includes(q) ||
          (cat?.toLowerCase().includes(q) ?? false) ||
          (tx.account?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [transactions, filterType, search, locale]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function fmtCurrency(val: string | number) {
    return new Intl.NumberFormat("he-IL", {
      style: "currency", currency: "ILS",
      minimumFractionDigits: 0, maximumFractionDigits: 2,
    }).format(Number(val));
  }

  function fmtDate(d: Date) {
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      day: "numeric", month: "short", timeZone: "UTC",
    }).format(d);
  }

  function toDateInputValue(d: Date) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }

  function todayStr() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }

  function fmtMonthLabel() {
    const [y, m] = month.split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      month: "long", year: "numeric",
    }).format(new Date(y, m - 1, 1));
  }

  function getCatName(tx: DbTransaction) {
    return (locale === "he" ? tx.category_name_he : tx.category_name_en) ?? t.noCategory;
  }

  function getCatDisplayName(cat: DbCategory) {
    return locale === "he" ? cat.name_he : cat.name_en;
  }

  const glassInput =
    "w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[14px] text-white placeholder-white/25 outline-none backdrop-blur-md transition-all focus:border-white/25 focus:bg-white/[0.09]";

  const glassSelect =
    "w-full rounded-xl border border-white/10 bg-[oklch(0.12_0.02_260)] px-4 py-2.5 text-[14px] text-white/80 outline-none transition-all focus:border-white/25";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight text-white">{t.title}</h1>
        <div className="flex items-center gap-2">
          {/* Auto-categorize */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoCategorize}
              disabled={autoCatting}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-[14px] font-medium text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.10] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {autoCatting ? <SpinnerIcon /> : <SparklesIcon />}
              <span>{t.autoCategorize}</span>
            </button>
            {autoCatResult !== null && (
              <span className="text-[12px] text-white/40">
                {autoCatResult > 0
                  ? `${autoCatResult} ${t.autoCategorized}`
                  : t.autoCategorizeNone}
              </span>
            )}
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 rounded-xl bg-[oklch(0.5706_0.2236_258.71)] px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.35)] transition-all hover:brightness-110"
          >
            <PlusIcon />
            <span>{t.addTransaction}</span>
          </button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <button onClick={() => navigateMonth(-1)} className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white/50 transition-all hover:bg-white/[0.10] hover:text-white/80">
          <ChevronLeftIcon />
        </button>
        <span className="min-w-[160px] text-center text-[16px] font-medium text-white/80">{fmtMonthLabel()}</span>
        <button onClick={() => navigateMonth(1)} className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-white/50 transition-all hover:bg-white/[0.10] hover:text-white/80">
          <ChevronRightIcon />
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t.totalIncome} value={fmtCurrency(stats.total_income)} color="oklch(0.72 0.17 142)" />
        <StatCard label={t.totalExpenses} value={fmtCurrency(stats.total_expenses)} color="oklch(0.72 0.18 27)" />
        <StatCard label={t.net} value={fmtCurrency(stats.net)} color={Number(stats.net) >= 0 ? "oklch(0.72 0.17 142)" : "oklch(0.72 0.18 27)"} />
      </div>

      {/* Filter + Search */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1">
          {(["all", "income", "expense"] as const).map((ft) => (
            <button key={ft} onClick={() => setFilterType(ft)}
              className={cn("rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
                filterType === ft ? "bg-white/[0.12] text-white" : "text-white/40 hover:text-white/70")}>
              {ft === "all" ? t.filterAll : ft === "income" ? t.filterIncome : t.filterExpense}
            </button>
          ))}
        </div>
        <input type="text" placeholder={`${t.description}...`} value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-[13px] text-white placeholder-white/25 outline-none backdrop-blur-md transition-all focus:border-white/25 focus:bg-white/[0.09]" />
      </div>

      {/* Transaction list */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] backdrop-blur-md">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/30">
              <ReceiptIcon />
            </div>
            <p className="text-[15px] font-medium text-white/50">{t.noTransactions}</p>
            <p className="mt-1 text-[13px] text-white/25">{t.noTransactionsDesc}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                  {[t.date, t.description, t.category, t.account, t.amount, ""].map((h, i) => (
                    <th key={i} className={cn("px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-white/30", i >= 4 ? "text-end" : "text-start")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx, i) => (
                  <tr key={tx.id} className={cn("border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]", i === filtered.length - 1 && "border-none")}>
                    {/* Date */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-white/40">{fmtDate(tx.date)}</td>

                    {/* Description */}
                    <td className="max-w-[180px] truncate px-4 py-3.5 text-[13px] text-white/80">{tx.description}</td>

                    {/* Category — inline dropdown */}
                    <td className="px-4 py-3.5">
                      <CategoryDropdown
                        tx={tx}
                        categories={categories}
                        locale={locale}
                        noCategory={t.noCategory}
                        override={categoryOverrides[tx.id] ?? { categoryId: undefined, saving: false }}
                        onCategoryChange={handleCategoryChange}
                      />
                    </td>

                    {/* Account */}
                    <td className="px-4 py-3.5 text-[13px] text-white/40">{tx.account ?? "—"}</td>

                    {/* Amount */}
                    <td className="whitespace-nowrap px-4 py-3.5 text-end text-[13px] font-medium">
                      <span className={tx.type === "income" ? "text-[oklch(0.80_0.14_142)]" : "text-[oklch(0.78_0.16_27)]"}>
                        {tx.type === "income" ? "+" : "-"}{fmtCurrency(tx.amount)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {deletingId === tx.id ? (
                          <>
                            <button onClick={() => handleDelete(tx.id)} disabled={isPending}
                              className="rounded-lg border border-[oklch(0.577_0.245_27.325/0.4)] bg-[oklch(0.577_0.245_27.325/0.12)] px-2.5 py-1 text-[11px] font-medium text-[oklch(0.78_0.16_27)] transition-all hover:bg-[oklch(0.577_0.245_27.325/0.2)] disabled:opacity-50">
                              {t.delete}
                            </button>
                            <button onClick={() => setDeletingId(null)}
                              className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-white/50 transition-all hover:text-white/80">
                              {t.cancel}
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => openEdit(tx)} className="rounded-lg border border-white/10 bg-white/[0.05] p-1.5 text-white/40 transition-all hover:bg-white/[0.09] hover:text-white/80">
                              <PencilIcon />
                            </button>
                            <button onClick={() => setDeletingId(tx.id)} className="rounded-lg border border-white/10 bg-white/[0.05] p-1.5 text-white/40 transition-all hover:border-[oklch(0.577_0.245_27.325/0.3)] hover:bg-[oklch(0.577_0.245_27.325/0.08)] hover:text-[oklch(0.78_0.16_27)]">
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Categories section ──────────────────────────────────────────────── */}
      <div className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-medium uppercase tracking-wider text-white/30">{t.categories}</h2>
          <button
            onClick={() => setCatModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.10] hover:text-white/80"
          >
            <PlusIcon />
            {t.addCategory}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
              style={{ borderColor: `${cat.color}40`, background: `${cat.color}18` }}
            >
              <span className="text-[14px] leading-none">{cat.emoji || "🏷️"}</span>
              <span className="font-medium" style={{ color: cat.color }}>{getCatDisplayName(cat)}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Transaction Add/Edit Modal ──────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.12] bg-[oklch(0.10_0.02_260)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-white">
                {editingTx ? t.editTransaction : t.addTransaction}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/80">
                <XIcon />
              </button>
            </div>

            <form action={handleSubmit} key={editingTx?.id ?? "new"}>
              <input type="hidden" name="type" value={formType} />

              {/* Type toggle */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.type}</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setFormType("expense")}
                    className={cn("flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-all",
                      formType === "expense"
                        ? "border-[oklch(0.577_0.245_27.325/0.4)] bg-[oklch(0.577_0.245_27.325/0.15)] text-[oklch(0.78_0.16_27)]"
                        : "border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/[0.08]")}>
                    {t.expense}
                  </button>
                  <button type="button" onClick={() => setFormType("income")}
                    className={cn("flex-1 rounded-xl border py-2.5 text-[13px] font-medium transition-all",
                      formType === "income"
                        ? "border-[oklch(0.72_0.17_142/0.4)] bg-[oklch(0.72_0.17_142/0.15)] text-[oklch(0.80_0.14_142)]"
                        : "border-white/10 bg-white/[0.04] text-white/40 hover:bg-white/[0.08]")}>
                    {t.income}
                  </button>
                </div>
              </div>

              {/* Date */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.date}</label>
                <input type="date" name="date" required
                  defaultValue={editingTx ? toDateInputValue(editingTx.date) : todayStr()}
                  className={glassInput} />
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.description}</label>
                <input type="text" name="description" required
                  defaultValue={editingTx?.description ?? ""} placeholder={t.description}
                  className={glassInput} />
              </div>

              {/* Amount */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.amount}</label>
                <input type="number" name="amount" required min="0.01" step="0.01"
                  defaultValue={editingTx ? editingTx.amount : ""} placeholder="0.00"
                  className={glassInput} />
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.category}</label>
                <select name="category_id" defaultValue={editingTx?.category_id ?? ""} className={glassSelect}>
                  <option value="">{t.noCategory}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.emoji} {getCatDisplayName(cat)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account */}
              <div className="mb-6">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.account}</label>
                <input type="text" name="account" defaultValue={editingTx?.account ?? ""}
                  placeholder={t.accountPlaceholder} className={glassInput} />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={closeModal}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-[14px] font-medium text-white/60 transition-all hover:bg-white/[0.10] hover:text-white/90">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 rounded-xl bg-[oklch(0.5706_0.2236_258.71)] py-2.5 text-[14px] font-medium text-white shadow-[0_2px_12px_oklch(0.5706_0.2236_258.71/0.35)] transition-all hover:brightness-110 disabled:opacity-60">
                  {isPending ? "…" : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Category Modal ──────────────────────────────────────────────── */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeCatModal} />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/[0.12] bg-[oklch(0.10_0.02_260)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-[18px] font-semibold text-white">{t.addCategory}</h2>
              <button onClick={closeCatModal} className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/[0.08] hover:text-white/80">
                <XIcon />
              </button>
            </div>

            <form action={handleCatSubmit}>
              {/* Emoji row */}
              <div className="mb-4 flex gap-3">
                <div className="w-20">
                  <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.categoryEmoji}</label>
                  <input
                    type="text"
                    name="emoji"
                    maxLength={4}
                    placeholder="🏷️"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-center text-[20px] outline-none backdrop-blur-md transition-all focus:border-white/25 focus:bg-white/[0.09]"
                  />
                </div>
                {/* English name */}
                <div className="flex-1">
                  <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.categoryNameEn}</label>
                  <input
                    type="text"
                    name="name_en"
                    required
                    placeholder="e.g. Food"
                    dir="ltr"
                    className={glassInput}
                  />
                </div>
              </div>

              {/* Hebrew name */}
              <div className="mb-4">
                <label className="mb-1.5 block text-[12px] font-medium text-white/40">{t.categoryNameHe}</label>
                <input
                  type="text"
                  name="name_he"
                  required
                  placeholder="לדוגמה: אוכל"
                  dir="rtl"
                  className={glassInput}
                />
              </div>

              {/* Color picker */}
              <div className="mb-6">
                <label className="mb-2 block text-[12px] font-medium text-white/40">{t.categoryColor}</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={cn(
                        "h-8 w-8 rounded-full transition-all",
                        catColor === c ? "ring-2 ring-white ring-offset-2 ring-offset-[oklch(0.10_0.02_260)] scale-110" : "opacity-70 hover:opacity-100 hover:scale-105",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                {/* Preview */}
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px]"
                  style={{ borderColor: `${catColor}40`, background: `${catColor}18` }}>
                  <span className="text-[14px]">🏷️</span>
                  <span className="font-medium" style={{ color: catColor }}>{t.addCategory}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={closeCatModal}
                  className="flex-1 rounded-xl border border-white/10 bg-white/[0.06] py-2.5 text-[14px] font-medium text-white/60 transition-all hover:bg-white/[0.10] hover:text-white/90">
                  {t.cancel}
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 rounded-xl py-2.5 text-[14px] font-medium text-white transition-all hover:brightness-110 disabled:opacity-60"
                  style={{ background: catColor, boxShadow: `0 2px 12px ${catColor}55` }}>
                  {isPending ? "…" : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="absolute -bottom-4 end-[-1rem] h-20 w-20 rounded-full opacity-20 blur-[30px]" style={{ background: color }} />
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-2 text-[22px] font-semibold text-white">{value}</p>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}
function ChevronLeftIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>;
}
function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>;
}
function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>;
}
function XIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
}
function ReceiptIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" /><line x1="9" y1="7" x2="15" y2="7" /><line x1="9" y1="11" x2="15" y2="11" /><line x1="9" y1="15" x2="12" y2="15" /></svg>;
}
function SpinnerIcon() {
  return <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>;
}
function SparklesIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 3l.8 2.2L22 6l-2.2.8L19 9l-.8-2.2L16 6l2.2-.8z"/><path d="M5 15l.6 1.4L7 17l-1.4.6L5 19l-.6-1.4L3 17l1.4-.6z"/></svg>;
}
function ChevronDownIcon() {
  return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>;
}
// ── Inline category dropdown ─────────────────────────────────────────────────

type CatOverride = { categoryId: string | null | undefined; saving: boolean };

function CategoryDropdown({
  tx,
  categories,
  locale,
  noCategory,
  override,
  onCategoryChange,
}: {
  tx: DbTransaction;
  categories: DbCategory[];
  locale: Locale;
  noCategory: string;
  override: CatOverride;
  onCategoryChange: (txId: string, categoryId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const effectiveId =
    override.categoryId !== undefined ? override.categoryId : tx.category_id;
  const effectiveCat = effectiveId ? categories.find((c) => c.id === effectiveId) : null;
  const displayName = effectiveCat
    ? locale === "he" ? effectiveCat.name_he : effectiveCat.name_en
    : noCategory;

  function openSelect() {
    setEditing(true);
    // After render, focus + programmatically open the native select
    setTimeout(() => {
      selectRef.current?.focus();
      selectRef.current?.click();
    }, 0);
  }

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    setEditing(false);
    onCategoryChange(tx.id, val);
  }

  function handleBlur() {
    setEditing(false);
  }

  // Spinner while saving
  if (override.saving) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[12px] text-white/30">
        <SpinnerIcon />
      </span>
    );
  }

  // Native select while editing
  if (editing) {
    return (
      <select
        ref={selectRef}
        defaultValue={effectiveId ?? ""}
        onChange={handleChange}
        onBlur={handleBlur}
        className="rounded-full border border-white/20 bg-[oklch(0.13_0.02_260)] px-2.5 py-1 text-[11px] text-white/80 outline-none"
        style={effectiveCat ? { borderColor: `${effectiveCat.color}50` } : {}}
      >
        <option value="">{noCategory}</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.emoji} {locale === "he" ? cat.name_he : cat.name_en}
          </option>
        ))}
      </select>
    );
  }

  // Badge (click → open select)
  return (
    <button onClick={openSelect} className="group">
      {effectiveCat ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] transition-all group-hover:brightness-125"
          style={{ borderColor: `${effectiveCat.color}40`, background: `${effectiveCat.color}18` }}
        >
          <span className="text-[13px] leading-none">{effectiveCat.emoji || "•"}</span>
          <span className="text-[11px] font-medium" style={{ color: effectiveCat.color }}>
            {displayName}
          </span>
          <ChevronDownIcon />
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[12px] text-white/25 transition-all group-hover:border-white/20 group-hover:text-white/50">
          {displayName}
          <ChevronDownIcon />
        </span>
      )}
    </button>
  );
}
