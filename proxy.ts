import { type NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken, sameToken } from "@/lib/auth";

/**
 * Password gate for the whole app. Runs before every matched request.
 *
 * Always let through:
 *  - /login (otherwise nobody could log in)
 *  - /api/webhooks (Stripe can't log in; that route checks Stripe's signature instead)
 *
 * Everything else needs the auth cookie. Pages redirect to /login; API
 * routes get a 401 JSON error, since a redirect to an HTML page is useless to fetch().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login" || pathname === "/api/webhooks") return NextResponse.next();

  const expected = await expectedToken();
  if (!expected) {
    // Fail closed: a missing env var should never mean "no password".
    return new NextResponse("APP_PASSWORD is not set. Add it to your environment.", { status: 500 });
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && sameToken(cookie, expected)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next's own build assets (JS, CSS, fonts, optimized images) and the favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
