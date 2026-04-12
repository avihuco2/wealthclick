import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/dashboard"];
const publicRoutes = ["/login", "/"];

export default async function proxy(req: NextRequest) {
  const session = await auth();
  const path = req.nextUrl.pathname;

  const isProtected = protectedRoutes.some((r) => path.startsWith(r));
  const isPublic = publicRoutes.includes(path);

  if (isProtected && !session?.user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Already logged in — send to dashboard
  if (isPublic && session?.user) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
