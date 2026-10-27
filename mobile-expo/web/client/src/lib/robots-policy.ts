import { INDEXABLE_ROBOTS, NOINDEX_ROBOTS } from "@/hooks/use-seo";

// The ONLY routes allowed to stay `index, follow`. Mirrors the public URLs in
// web/client/public/sitemap.xml. Because the app is client-rendered, every
// route otherwise serves index.html's global `index, follow` robots meta —
// which would let dozens of authenticated app shells (/medications,
// /lab-results, /vitals, /timeline, etc.) be indexed as thin empty pages. The
// route-driven manager in App.tsx flips every non-allowlisted route to
// `noindex, nofollow`. Keep this set in sync with sitemap.xml — the
// robots-policy regression test asserts the two stay identical.
export const INDEXABLE_ROUTES = new Set<string>([
  "/",
  "/symptom-checker",
  "/try",
  "/about/security",
  "/insurance-learning",
  "/uninsured-resources",
  "/care/find-a-doctor",
  "/find-free-care",
  "/drug-savings",
  "/learn",
  "/faq",
  "/privacy-policy",
  "/terms-of-service",
  "/care/california",
  "/care/texas",
  "/care/florida",
  "/care/new-york",
  "/care/illinois",
  "/care/georgia",
  "/care/pennsylvania",
  "/care/ohio",
  "/care/arizona",
  "/care/north-carolina",
  "/care/oklahoma",
  "/care/mississippi",
  "/care/missouri",
]);

/**
 * Resolves the `robots` meta content for a given route. Only the public
 * marketing/educational routes in INDEXABLE_ROUTES stay indexable; every other
 * (authenticated) route is flipped to `noindex, nofollow` so empty app shells
 * never reach search results.
 *
 * The authenticated dashboard shares the "/" path with the public marketing
 * landing page. Only the signed-out landing view of "/" is indexable; the
 * signed-in dashboard ("/" while authenticated) is a PHI surface and must be
 * noindex.
 */
export function resolveRobotsContent(
  location: string,
  isAuthenticated: boolean,
): string {
  const indexable =
    INDEXABLE_ROUTES.has(location) && !(location === "/" && isAuthenticated);
  return indexable ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS;
}
