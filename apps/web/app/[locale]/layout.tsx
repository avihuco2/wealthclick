import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Heebo } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { locales, getDirection, isValidLocale, type Locale } from "@/lib/i18n";
import { ThemeScript } from "@/components/ThemeScript";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "WealthClick",
  description: "Your personal finance, beautifully managed.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!isValidLocale(locale)) notFound();

  const typedLocale = locale as Locale;
  const dir = getDirection(typedLocale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geist.variable} ${heebo.variable} dark h-full antialiased`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="h-full bg-background">{children}</body>
    </html>
  );
}
