export type Locale = "en" | "he";

export const locales: Locale[] = ["en", "he"];
export const defaultLocale: Locale = "en";

export function getDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "he" ? "rtl" : "ltr";
}

export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

// ─── Translation dictionaries ─────────────────────────────────────────────────

const dictionaries = {
  en: {
    login: {
      subtitle: "Your personal finance, beautifully managed.",
      signInHeading: "Sign in to continue",
      signInDescription:
        "Connect your account to track spending, set budgets, and see where your money goes.",
      googleButton: "Continue with Google",
      termsPrefix: "By continuing, you agree to our",
      terms: "Terms of Service",
      and: "and",
      privacy: "Privacy Policy",
      featureSecure: "Secure & private",
      featureInsights: "Smart insights",
      featureBudget: "Budget alerts",
    },
    dashboard: {
      greeting: (name: string | null) =>
        name ? `Good to see you, ${name}` : "Good to see you",
      overviewSubtitle: "Your financial overview is ready. More features coming soon.",
      signOut: "Sign out",
      // Metric cards
      totalBalance: "Total Balance",
      totalBalanceSub: "Connect accounts to get started",
      thisMonth: "This Month",
      thisMonthSub: "Spending overview",
      savingsRate: "Savings Rate",
      savingsRateSub: "Track your goals",
      // Coming soon
      comingSoonTitle: "Your dashboard is being built",
      comingSoonDescription:
        "Transaction history, AI-powered insights, budget tracking, and spending charts are on the way.",
      features: [
        "Transaction history",
        "AI categorization",
        "Budget tracking",
        "Spending charts",
        "Recurring payments",
      ],
      // Quick actions
      connectBankTitle: "Connect a bank account",
      connectBankDescription: "Securely link your accounts to start tracking",
      budgetGoalTitle: "Set a budget goal",
      budgetGoalDescription: "Define monthly limits for each category",
      comingSoon: "Coming soon",
    },
  },
  he: {
    login: {
      subtitle: "הניהול הפיננסי שלך, בצורה יפה ופשוטה.",
      signInHeading: "כניסה לחשבון",
      signInDescription:
        "חבר את החשבון שלך כדי לעקוב אחר הוצאות, לקבוע תקציבים ולראות לאן הכסף שלך הולך.",
      googleButton: "המשך עם Google",
      termsPrefix: "בהמשך, אתה מסכים ל",
      terms: "תנאי השירות",
      and: "ו",
      privacy: "מדיניות הפרטיות",
      featureSecure: "מאובטח ופרטי",
      featureInsights: "תובנות חכמות",
      featureBudget: "התראות תקציב",
    },
    dashboard: {
      greeting: (name: string | null) =>
        name ? `שמחים לראות אותך, ${name}` : "שמחים לראות אותך",
      overviewSubtitle: "הסקירה הפיננסית שלך מוכנה. פיצ׳רים נוספים בקרוב.",
      signOut: "התנתקות",
      // Metric cards
      totalBalance: "יתרה כוללת",
      totalBalanceSub: "חבר חשבונות כדי להתחיל",
      thisMonth: "החודש",
      thisMonthSub: "סקירת הוצאות",
      savingsRate: "שיעור חיסכון",
      savingsRateSub: "עקוב אחר המטרות שלך",
      // Coming soon
      comingSoonTitle: "הלוח שלך נמצא בבנייה",
      comingSoonDescription:
        "היסטוריית עסקאות, תובנות מבוססות בינה מלאכותית, מעקב תקציב וגרפי הוצאות — בדרך אליך.",
      features: [
        "היסטוריית עסקאות",
        "קטגוריזציה חכמה",
        "מעקב תקציב",
        "גרפי הוצאות",
        "תשלומים חוזרים",
      ],
      // Quick actions
      connectBankTitle: "חבר חשבון בנק",
      connectBankDescription: "קשר את חשבונותיך באופן מאובטח כדי להתחיל לעקוב",
      budgetGoalTitle: "הגדר יעד תקציב",
      budgetGoalDescription: "הגדר מגבלות חודשיות לכל קטגוריה",
      comingSoon: "בקרוב",
    },
  },
} as const;

export type Dictionary = typeof dictionaries.en;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
