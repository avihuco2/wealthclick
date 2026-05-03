"use client";

import { useState } from "react";

type T = {
  title: string;
  autoSyncLabel: string;
  autoSyncDesc: string;
  enabled: string;
  disabled: string;
};

export default function ScraperSettingsSection({
  initialEnabled,
  t,
}: {
  initialEnabled: boolean;
  t: T;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const next = !enabled;
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoSyncEnabled: next }),
    });
    setEnabled(next);
    setSaving(false);
  }

  return (
    <section className="mb-8 rounded-2xl border border-black/[0.08] bg-black/[0.04] p-6 backdrop-blur dark:border-white/[0.08] dark:bg-white/[0.04]">
      <h2 className="mb-4 text-lg font-semibold text-black dark:text-white">{t.title}</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-black/90 dark:text-white/90">{t.autoSyncLabel}</p>
          <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{t.autoSyncDesc}</p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
            enabled ? "bg-[#34C759]" : "bg-black/20 dark:bg-white/20"
          }`}
          role="switch"
          aria-checked={enabled}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      <p className="mt-3 text-xs font-medium" style={{ color: enabled ? "#34C759" : "#FF9500" }}>
        {enabled ? t.enabled : t.disabled}
      </p>
    </section>
  );
}
