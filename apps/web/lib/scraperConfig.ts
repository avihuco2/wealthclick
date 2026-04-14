export type CredentialField = {
  name: string;
  label: string;
  labelHe: string;
  type: "text" | "password";
};

export type BankConfig = {
  companyId: string;
  label: string;
  labelHe: string;
  emoji: string;
  fields: CredentialField[];
};

export const BANK_CONFIGS: Record<string, BankConfig> = {
  hapoalim: {
    companyId: "hapoalim",
    label: "Bank Hapoalim",
    labelHe: "בנק הפועלים",
    emoji: "🔵",
    fields: [
      { name: "userCode", label: "User Code", labelHe: "קוד משתמש", type: "text" },
      { name: "password", label: "Password",  labelHe: "סיסמה",      type: "password" },
    ],
  },
  leumi: {
    companyId: "leumi",
    label: "Bank Leumi",
    labelHe: "בנק לאומי",
    emoji: "🟢",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  discount: {
    companyId: "discount",
    label: "Discount Bank",
    labelHe: "בנק דיסקונט",
    emoji: "🔴",
    fields: [
      { name: "id",       label: "ID Number",       labelHe: "תעודת זהות",  type: "text" },
      { name: "password", label: "Password",         labelHe: "סיסמה",       type: "password" },
      { name: "num",      label: "Account Number",   labelHe: "מספר חשבון",  type: "text" },
    ],
  },
  amex: {
    companyId: "amex",
    label: "American Express",
    labelHe: "אמריקן אקספרס",
    emoji: "💳",
    fields: [
      { name: "id",          label: "ID Number",          labelHe: "תעודת זהות",       type: "text" },
      { name: "card6Digits", label: "Card Last 6 Digits", labelHe: "6 ספרות אחרונות",  type: "text" },
      { name: "password",    label: "Password",           labelHe: "סיסמה",            type: "password" },
    ],
  },
  isracard: {
    companyId: "isracard",
    label: "Isracard",
    labelHe: "ישראכרט",
    emoji: "💳",
    fields: [
      { name: "id",          label: "ID Number",          labelHe: "תעודת זהות",       type: "text" },
      { name: "card6Digits", label: "Card Last 6 Digits", labelHe: "6 ספרות אחרונות",  type: "text" },
      { name: "password",    label: "Password",           labelHe: "סיסמה",            type: "password" },
    ],
  },
  visaCal: {
    companyId: "visaCal",
    label: "Visa Cal",
    labelHe: "ויזה כאל",
    emoji: "💳",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  max: {
    companyId: "max",
    label: "Max",
    labelHe: "מקס",
    emoji: "💳",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  mizrahi: {
    companyId: "mizrahi",
    label: "Bank Mizrahi",
    labelHe: "בנק מזרחי-טפחות",
    emoji: "🟡",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  beinleumi: {
    companyId: "beinleumi",
    label: "Bank Beinleumi",
    labelHe: "הבנק הבינלאומי",
    emoji: "🌍",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  mercantile: {
    companyId: "mercantile",
    label: "Mercantile Discount",
    labelHe: "בנק מרקנטיל דיסקונט",
    emoji: "🏦",
    fields: [
      { name: "id",       label: "ID Number",     labelHe: "תעודת זהות", type: "text" },
      { name: "password", label: "Password",       labelHe: "סיסמה",      type: "password" },
      { name: "num",      label: "Account Number", labelHe: "מספר חשבון", type: "text" },
    ],
  },
  massad: {
    companyId: "massad",
    label: "Bank Massad",
    labelHe: "בנק מסד",
    emoji: "🏦",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  otsarHahayal: {
    companyId: "otsarHahayal",
    label: "Otsar Hahayal",
    labelHe: "בנק אוצר החייל",
    emoji: "🏦",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
  yahav: {
    companyId: "yahav",
    label: "Bank Yahav",
    labelHe: "בנק יהב",
    emoji: "🏦",
    fields: [
      { name: "username",   label: "Username",    labelHe: "שם משתמש",     type: "text" },
      { name: "nationalID", label: "National ID", labelHe: "תעודת זהות",   type: "text" },
      { name: "password",   label: "Password",    labelHe: "סיסמה",        type: "password" },
    ],
  },
  beyahadBishvilha: {
    companyId: "beyahadBishvilha",
    label: "Beyhad Bishvilha",
    labelHe: "ביחד בשבילה",
    emoji: "🏦",
    fields: [
      { name: "id",       label: "ID Number", labelHe: "תעודת זהות", type: "text" },
      { name: "password", label: "Password",  labelHe: "סיסמה",      type: "password" },
    ],
  },
  pagi: {
    companyId: "pagi",
    label: "Pagi",
    labelHe: "פאגי",
    emoji: "🏦",
    fields: [
      { name: "username", label: "Username", labelHe: "שם משתמש", type: "text" },
      { name: "password", label: "Password", labelHe: "סיסמה",    type: "password" },
    ],
  },
};
