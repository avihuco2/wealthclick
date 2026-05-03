"use client";

import { useState } from "react";

type Category = {
  id: string;
  name_en: string;
  name_he: string;
  emoji: string;
  color: string;
};

type T = {
  title: string;
  editButton: string;
  saveButton: string;
  cancelButton: string;
  saving: string;
  nameEn: string;
  nameHe: string;
  emoji: string;
  color: string;
};

const PRESET_COLORS = [
  "#FF9500", "#007AFF", "#FF2D55", "#AF52DE", "#34C759",
  "#5AC8FA", "#5856D6", "#32ADE6", "#FFCC00", "#30D158",
  "#64D2FF", "#8E8E93",
];

export default function CategoriesSection({
  initialCategories,
  t,
}: {
  initialCategories: Category[];
  t: T;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Category>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(cat: Category) {
    setEditing(cat.id);
    setDraft({ name_en: cat.name_en, name_he: cat.name_he, emoji: cat.emoji, color: cat.color });
  }

  function cancel() {
    setEditing(null);
    setDraft({});
  }

  async function save(id: string) {
    if (!draft.name_en?.trim() || !draft.name_he?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const updated = await res.json();
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
        setEditing(null);
        setDraft({});
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur">
      <h2 className="mb-4 text-lg font-semibold text-white">{t.title}</h2>
      <div className="space-y-2">
        {categories.map((cat) =>
          editing === cat.id ? (
            <div
              key={cat.id}
              className="rounded-xl border border-white/[0.10] bg-white/[0.06] p-4 space-y-3"
            >
              {/* Emoji + color row */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/50">{t.emoji}</label>
                  <input
                    value={draft.emoji ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, emoji: e.target.value }))}
                    className="w-16 rounded-lg border border-white/10 bg-white/10 px-2 py-1.5 text-center text-lg text-white focus:outline-none focus:ring-1 focus:ring-white/30"
                    maxLength={4}
                    dir="auto"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-white/50">{t.color}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setDraft((d) => ({ ...d, color: c }))}
                        className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                          draft.color === c ? "ring-2 ring-white ring-offset-1 ring-offset-black/50" : ""
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={draft.color ?? "#8E8E93"}
                      onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                      className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
                      title="Custom color"
                    />
                  </div>
                </div>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/50">{t.nameEn}</label>
                  <input
                    value={draft.name_en ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, name_en: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    dir="ltr"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/50">{t.nameHe}</label>
                  <input
                    value={draft.name_he ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, name_he: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancel}
                  disabled={saving}
                  className="rounded-lg border border-white/10 px-4 py-1.5 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
                >
                  {t.cancelButton}
                </button>
                <button
                  onClick={() => save(cat.id)}
                  disabled={saving || !draft.name_en?.trim() || !draft.name_he?.trim()}
                  className="rounded-lg bg-[#007AFF] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#0070E0] disabled:opacity-50"
                >
                  {saving ? t.saving : t.saveButton}
                </button>
              </div>
            </div>
          ) : (
            <div
              key={cat.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg"
                  style={{ backgroundColor: cat.color + "33" }}
                >
                  {cat.emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{cat.name_en}</p>
                  <p className="truncate text-xs text-white/50">{cat.name_he}</p>
                </div>
              </div>
              <button
                onClick={() => startEdit(cat)}
                className="flex-shrink-0 rounded-lg border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              >
                {t.editButton}
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
