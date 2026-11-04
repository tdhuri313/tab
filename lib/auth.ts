/**
 * A single shared password for the whole app (APP_PASSWORD).
 *
 * After a correct login we store a hash of the password in an httpOnly
 * cookie. proxy.ts recomputes the hash on every request and compares. The
 * password itself never sits in the browser, and changing APP_PASSWORD
 * logs everyone out (old cookies no longer match).
 *
 * Uses Web Crypto (crypto.subtle) so the same code runs in the proxy and in
 * server actions.
 */

export const AUTH_COOKIE = "tab_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

/** The cookie value a logged-in browser should have, or null if APP_PASSWORD isn't set. */
export async function expectedToken(): Promise<string | null> {
  const password = process.env.APP_PASSWORD;
  return password ? hashToken(password) : null;
}

export async function hashToken(password: string): Promise<string> {
  // Prefix so this hash is specific to this use, not a bare sha256 of the password.
  const bytes = new TextEncoder().encode(`tab-session:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Equal-length strings compared without bailing early, so timing doesn't leak how much matched. */
export function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Only allow redirecting back to a path on this site ("/invoices"), never "//evil.com" or "https://…". */
export function safeNextPath(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
