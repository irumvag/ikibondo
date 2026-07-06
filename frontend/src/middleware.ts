import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge middleware that gates the authenticated route groups.
 *
 * This is defense-in-depth / UX only: it redirects visitors with no session to
 * the login page instead of letting them load a protected shell that would then
 * fail its API calls. It is NOT the security boundary — the JWT lives in
 * localStorage (not visible here) and the backend enforces real authorization on
 * every request. The `_ikibondo_role` cookie is set client-side on login, so its
 * presence is only a hint that a session exists.
 */
const PROTECTED_PREFIXES = [
  "/admin",
  "/chw",
  "/nurse",
  "/parent",
  "/supervisor",
  "/notifications",
  "/onboarding",
  "/profile",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (!isProtected) return NextResponse.next();

  const hasSession = request.cookies.has("_ikibondo_role");
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/chw/:path*",
    "/nurse/:path*",
    "/parent/:path*",
    "/supervisor/:path*",
    "/notifications/:path*",
    "/onboarding/:path*",
    "/profile/:path*",
  ],
};
