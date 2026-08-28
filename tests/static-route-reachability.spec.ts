import { describe, it, expect } from "vitest";
import { isServerRoutePath } from "../server/static";

/**
 * The SPA catch-all is mounted before the API routes and answers everything it
 * does not recognise with `index.html`. This predicate is therefore the whole
 * reachability contract for any server-rendered route outside `/api`: a path
 * missing from it is a handler that never runs in production, no matter how
 * carefully it was written or how green its own tests are.
 *
 * That is not hypothetical. `/s/:token` was missing, so in production the
 * share link served the marketing SPA — which is `robots: index, follow` and
 * loads a Google Fonts stylesheet — putting the 256-bit bearer token on an
 * indexable document and into a cross-origin `Referer`, while the CSP,
 * `no-referrer`, `noindex` and inert-GET interstitial written to prevent
 * exactly that never executed.
 */
describe("the SPA catch-all must not swallow server routes", () => {
  it("passes the health-summary share link through to its handler", () => {
    expect(isServerRoutePath("/s/abc123")).toBe(true);
    expect(isServerRoutePath("/s")).toBe(true);
  });

  it("still passes the API and infra paths through", () => {
    expect(isServerRoutePath("/api/engagement/share/view")).toBe(true);
    expect(isServerRoutePath("/health")).toBe(true);
    expect(isServerRoutePath("/healthz")).toBe(true);
    expect(isServerRoutePath("/_ah/start")).toBe(true);
  });

  it("still lets genuine SPA routes fall through to index.html", () => {
    // These must NOT be claimed: they are client-side routes, and claiming
    // them would break bookmarks and full reloads.
    for (const spaRoute of ["/", "/dashboard", "/auth/login", "/auth/register", "/settings"]) {
      expect(isServerRoutePath(spaRoute), `${spaRoute} must reach the SPA`).toBe(false);
    }
  });

  it("does not claim a lookalike prefix", () => {
    // `/s` is a short prefix, so the match has to be exact-or-slash rather
    // than startsWith("/s") — otherwise every SPA route beginning with "s"
    // would be swallowed by the server instead.
    for (const notShare of ["/settings", "/summary", "/share", "/support"]) {
      expect(isServerRoutePath(notShare), `${notShare} is not a share link`).toBe(false);
    }
  });
});
