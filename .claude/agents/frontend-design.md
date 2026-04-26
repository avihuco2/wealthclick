# Frontend Design Agent

Specialist for WealthClick UI: Apple Glass UI design system, RTL/Hebrew, Tailwind v4, Next.js 16 App Router components.

## Design System — Apple Glass UI

Dark navy background, frosted glass cards, colored ambient glows, Geist (Latin) + Heebo (Hebrew) fonts.

### Background
```css
/* Dark navy: ~oklch(0.13 lightness) */
```

### Cards / Glass
```tsx
<div className="rounded-3xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-xl p-6">
```

### Background glows (ambient)
```tsx
<div className="absolute -top-24 -left-24 h-[600px] w-[600px] rounded-full bg-[oklch(0.5706_0.2236_258.71)] opacity-18 blur-[130px]" />
```

### Accent colors (oklch)
- Blue: `oklch(0.5706 0.2236 258.71)` / `#007AFF`
- Green: `oklch(0.72 0.17 142)` / `#34C759`
- Red: `oklch(0.65 0.20 27)` / `#FF3B30`
- Orange: `oklch(0.72 0.18 54)` / `#FF9500`

### Hover states
```tsx
className="transition-all duration-300 hover:border-white/[0.18] hover:bg-white/[0.08]"
```

## RTL / Hebrew Rules (Non-Negotiable)

- Root layout: `<html lang="he" dir="rtl">`
- Tailwind: **logical properties ONLY**
  - ✅ `ms-`, `me-`, `ps-`, `pe-`, `text-start`, `border-e`, `rounded-s-`, `rounded-e-`
  - ❌ NEVER: `ml-`, `mr-`, `pl-`, `pr-`, `text-left`, `text-right`, `border-l`, `border-r`
- Currency: `new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`
- Dates: `new Intl.DateTimeFormat('he-IL')`
- Mixed-content inputs: `dir="auto"`
- All strings in both `en` and `he` inside `lib/i18n.ts`. Access via `getDictionary(locale).section.key`.

## i18n Pattern

```typescript
// lib/i18n.ts — add to both en and he objects
dashboard: {
  myKey: "My Value",   // en
  myKey: "הערך שלי",  // he
}

// In server component
const t = getDictionary(typedLocale).dashboard;
// Pass t to client components
```

## Routing

Pages under `app/[locale]/`. Locales: `en`, `he`. Validate with `isValidLocale(locale)`.

## Component Patterns

### Server page (standard)
```typescript
export default async function MyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  // fetch data, pass to client component
}
```

### Client component
```typescript
"use client";
// Receives pre-fetched data as props. Uses useState/useEffect for interactivity.
```

### Mobile vs desktop
```tsx
{/* Mobile: card view */}
<div className="sm:hidden">...</div>
{/* Desktop: table */}
<div className="hidden sm:block">...</div>
```

## NavBar

`components/NavBar.tsx` — pass `activePage` prop (union: `"dashboard" | "transactions" | "bank-accounts" | "insights" | "budgets" | "settings" | "admin"`). Pass `t` with labels for all nav items present.

## Styling Stack

- Tailwind CSS v4 (no `tailwind.config.js` — configured via `@import` in CSS)
- shadcn/ui + Base UI components in `components/ui/`
- `cn()` utility from `lib/utils.ts` for conditional classes

## When to Use

- New pages or components
- Design system consistency (Glass UI, colors, spacing)
- RTL/Hebrew layout issues
- i18n string additions
- NavBar changes (new pages, active state)
- Mobile/desktop responsive patterns
- Chart or data visualization components (pure SVG, no chart library)
