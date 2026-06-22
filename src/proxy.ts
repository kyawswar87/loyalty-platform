import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Next.js 16 Proxy (formerly Middleware) — optimistic, cookie-only route gate.
 *
 * This is the fast first pass: it reads the JWT session from the cookie (no DB)
 * and redirects obvious cases. It is NOT the security boundary — authoritative
 * checks (including disabled accounts) live in `lib/authz.ts` (`requireRole`),
 * which every protected page/action calls.
 *
 * Wrapping with Auth.js `auth()` populates `req.auth` with the decoded session.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const role = session?.user?.role;

  const isLogin = pathname === "/login";
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Already signed in → keep them out of the login page.
  if (isLogin && session) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  // Protected areas require a session.
  if ((isAdmin || isDashboard) && !session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Admin area is admin-only.
  if (isAdmin && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except API routes, Next internals, and static assets.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
