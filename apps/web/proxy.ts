import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale } from "@/lib/i18n";

function detectLocale(req: NextRequest): string {
  const acceptLanguage = req.headers.get("accept-language") ?? "";
  const preferred = acceptLanguage.split(",")[0].split("-")[0].toLowerCase();
  return locales.includes(preferred as "en" | "he") ? preferred : defaultLocale;
}

const protectedPaths = ["/dashboard"];
const publicPaths = ["/login", "/"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. If path has no locale prefix, redirect to detected locale
  const hasLocale = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`
  );

  if (!hasLocale) {
    const locale = detectLocale(req);
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, req.url));
  }

  // 2. Extract locale and the rest of the path
  const locale = pathname.split("/")[1];
  const pathWithoutLocale = pathname.slice(locale.length + 1) || "/";

  // 3. Apply auth guards
  const session = await auth();
  const isProtected = protectedPaths.some((p) => pathWithoutLocale.startsWith(p));
  const isPublic = publicPaths.includes(pathWithoutLocale);

  if (isProtected && !session?.user) {
    return NextResponse.redirect(new URL(`/${locale}/login`, req.nextUrl));
  }

  if (isPublic && session?.user) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
