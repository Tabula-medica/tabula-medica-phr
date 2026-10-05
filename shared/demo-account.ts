// Identity of the single, shared, read-only demo account — see
// server/seed-demo-account.ts for the data it seeds and
// server/replit_integrations/auth/replitAuth.ts for how a visitor is signed
// into it. Imported by both client and server so neither has to guess the
// other's constant.
export const DEMO_USER_ID = "demo|tabula-medica-demo-account";
export const DEMO_USER_EMAIL = "demo@tabulamedica.health";

// POST-method endpoints that only read data (never persist anything new) and
// so stay usable from the read-only demo account. Extend this list rather
// than loosening isDemoWriteBlocked below.
export const DEMO_ALLOWED_MUTATING_PATHS = new Set<string>([
  "/api/search",
  "/api/search/voice",
  "/api/smart-search",
]);

/**
 * True when a request must be refused to keep the shared demo account
 * read-only: any state-changing method, from the demo user, to a path not on
 * the explicit read-only allowlist.
 */
export function isDemoWriteBlocked(method: string, path: string, userId: string | undefined): boolean {
  if (userId !== DEMO_USER_ID) return false;
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  return !DEMO_ALLOWED_MUTATING_PATHS.has(path);
}
