import { getDb } from "./db";

export type DbCategory = {
  id: string;
  user_id: string;
  name_en: string;
  name_he: string;
  color: string;
  icon: string;
  emoji: string;
  created_at: Date;
};

const DEFAULT_CATEGORIES = [
  { name_en: "Food & Dining",     name_he: "אוכל ומסעדות",  color: "#FF9500", icon: "utensils",     emoji: "🍔" },
  { name_en: "Transportation",    name_he: "תחבורה",         color: "#007AFF", icon: "car",          emoji: "🚗" },
  { name_en: "Shopping",          name_he: "קניות",          color: "#FF2D55", icon: "shopping-bag", emoji: "🛍️" },
  { name_en: "Entertainment",     name_he: "בידור",          color: "#AF52DE", icon: "gamepad-2",    emoji: "🎮" },
  { name_en: "Health & Medical",  name_he: "בריאות ורפואה",  color: "#34C759", icon: "heart",        emoji: "💊" },
  { name_en: "Housing & Rent",    name_he: "דיור ושכירות",   color: "#5AC8FA", icon: "home",         emoji: "🏠" },
  { name_en: "Education",         name_he: "חינוך",          color: "#5856D6", icon: "book-open",    emoji: "📚" },
  { name_en: "Travel",            name_he: "נסיעות",         color: "#32ADE6", icon: "plane",        emoji: "✈️" },
  { name_en: "Utilities & Bills", name_he: "חשבונות",        color: "#FFCC00", icon: "zap",          emoji: "⚡" },
  { name_en: "Salary",            name_he: "משכורת",         color: "#30D158", icon: "briefcase",    emoji: "💼" },
  { name_en: "Other Income",      name_he: "הכנסה אחרת",     color: "#64D2FF", icon: "trending-up",  emoji: "📈" },
  { name_en: "Other",             name_he: "אחר",            color: "#8E8E93", icon: "circle",       emoji: "📌" },
];

export async function getOrSeedCategories(userId: string): Promise<DbCategory[]> {
  const sql = getDb();

  const existing = await sql<DbCategory[]>`
    SELECT * FROM categories WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
  if (existing.length > 0) return existing;

  // Seed defaults for this user on first use
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    user_id: userId,
    name_en: c.name_en,
    name_he: c.name_he,
    color:   c.color,
    icon:    c.icon,
    emoji:   c.emoji,
  }));
  await sql`INSERT INTO categories ${sql(rows)}`;

  return sql<DbCategory[]>`
    SELECT * FROM categories WHERE user_id = ${userId} ORDER BY created_at ASC
  `;
}
