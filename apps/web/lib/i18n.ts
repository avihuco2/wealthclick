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
    unauthorized: {
      title: "Access Denied",
      message: "Your account isn't authorised to use WealthClick. Contact the admin to request access.",
      signOut: "Sign out",
    },
    admin: {
      title: "User Management",
      subtitle: "Control who can access WealthClick.",
      addUser: "Add user",
      emailPlaceholder: "Email address",
      role: "Role",
      roleUser: "User",
      roleAdmin: "Admin",
      nameCol: "Name",
      emailCol: "Email",
      roleCol: "Role",
      statusCol: "Status",
      actionsCol: "Actions",
      active: "Active",
      inactive: "Inactive",
      deactivate: "Deactivate",
      activate: "Activate",
      remove: "Remove",
      you: "you",
    },
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
      userManagement: "User Management",
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
      transactions: "Transactions",
    },
    transactions: {
      title: "Transactions",
      addTransaction: "Add Transaction",
      editTransaction: "Edit Transaction",
      income: "Income",
      expense: "Expense",
      date: "Date",
      description: "Description",
      category: "Category",
      account: "Account",
      amount: "Amount",
      type: "Type",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      noTransactions: "No transactions yet",
      noTransactionsDesc: "Add your first transaction to get started.",
      totalIncome: "Income",
      totalExpenses: "Expenses",
      net: "Net",
      filterAll: "All",
      filterIncome: "Income",
      filterExpense: "Expenses",
      noCategory: "Uncategorized",
      accountPlaceholder: "e.g. Visa, Checking",
      categories: "Categories",
      addCategory: "Add Category",
      categoryName: "Name",
      categoryEmoji: "Emoji",
      categoryColor: "Color",
    },
  },
  he: {
    unauthorized: {
      title: "אין גישה",
      message: "החשבון שלך אינו מורשה להשתמש ב-WealthClick. פנה למנהל לבקשת גישה.",
      signOut: "התנתקות",
    },
    admin: {
      title: "ניהול משתמשים",
      subtitle: "שלוט במי שיכול לגשת ל-WealthClick.",
      addUser: "הוסף משתמש",
      emailPlaceholder: "כתובת אימייל",
      role: "תפקיד",
      roleUser: "משתמש",
      roleAdmin: "מנהל",
      nameCol: "שם",
      emailCol: "אימייל",
      roleCol: "תפקיד",
      statusCol: "סטטוס",
      actionsCol: "פעולות",
      active: "פעיל",
      inactive: "לא פעיל",
      deactivate: "השבת",
      activate: "הפעל",
      remove: "הסר",
      you: "אתה",
    },
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
      userManagement: "ניהול משתמשים",
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
      transactions: "עסקאות",
    },
    transactions: {
      title: "עסקאות",
      addTransaction: "הוסף עסקה",
      editTransaction: "ערוך עסקה",
      income: "הכנסה",
      expense: "הוצאה",
      date: "תאריך",
      description: "תיאור",
      category: "קטגוריה",
      account: "חשבון",
      amount: "סכום",
      type: "סוג",
      save: "שמור",
      cancel: "ביטול",
      delete: "מחק",
      noTransactions: "אין עסקאות עדיין",
      noTransactionsDesc: "הוסף את העסקה הראשונה שלך כדי להתחיל.",
      totalIncome: "הכנסות",
      totalExpenses: "הוצאות",
      net: "מאזן",
      filterAll: "הכל",
      filterIncome: "הכנסות",
      filterExpense: "הוצאות",
      noCategory: "ללא קטגוריה",
      accountPlaceholder: "לדוגמה: ויזה, עו\"ש",
      categories: "קטגוריות",
      addCategory: "הוסף קטגוריה",
      categoryName: "שם",
      categoryEmoji: "אמוג'י",
      categoryColor: "צבע",
    },
  },
} as const;

export type Dictionary = typeof dictionaries.en;

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}
