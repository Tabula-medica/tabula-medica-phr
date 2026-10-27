/**
 * Regression tests for the web SPA vs Expo/API host routing matrix.
 *
 * These guard against the two failure modes called out at deploy time:
 *   1. A request to an EAS / api.tabulamedica.health host accidentally
 *      being served the web SPA bundle.
 *   2. A request to a web subdomain (www / app / portal) accidentally
 *      falling through to the Expo dist/ bundle, or having its
 *      `/api/*` / `/webhooks/*` traffic swallowed by the SPA fallback.
 *
 * Wired into `npm run test:server` via scripts/run-server-tests.mjs and
 * the `.github/workflows/ci-cd.yml` `server-tests` job (see replit.md).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  WEB_HOSTS,
  isWebHost,
  shouldServeWebSpa,
} from "../web-host-routing";

test("WEB_HOSTS contains all production-relevant hosts", () => {
  assert.equal(WEB_HOSTS.size, 8);
  for (const host of [
    "www.tabulamedica.health",
    "app.tabulamedica.health",
    "portal.tabulamedica.health",
    "tabula-medica-web-verion.replit.app",
    "tabulamedica.us",
    "www.tabulamedica.us",
    "tabulamedica.world",
    "www.tabulamedica.world",
  ]) {
    assert.ok(WEB_HOSTS.has(host), `WEB_HOSTS missing ${host}`);
  }
});

test("isWebHost: identifies all three .health production subdomains", () => {
  assert.equal(isWebHost("www.tabulamedica.health"), true);
  assert.equal(isWebHost("app.tabulamedica.health"), true);
  assert.equal(isWebHost("portal.tabulamedica.health"), true);
});

test("isWebHost: identifies .us and .world domains", () => {
  assert.equal(isWebHost("tabulamedica.us"), true);
  assert.equal(isWebHost("www.tabulamedica.us"), true);
  assert.equal(isWebHost("tabulamedica.world"), true);
  assert.equal(isWebHost("www.tabulamedica.world"), true);
});

test("isWebHost: identifies the Replit preview host", () => {
  assert.equal(isWebHost("tabula-medica-web-verion.replit.app"), true);
});

test("isWebHost: rejects api.tabulamedica.health (mobile/EAS API surface)", () => {
  assert.equal(isWebHost("api.tabulamedica.health"), false);
});

test("isWebHost: rejects arbitrary external hosts", () => {
  assert.equal(isWebHost("tabulamedica.health"), false);
  assert.equal(isWebHost("evil.com"), false);
  assert.equal(isWebHost("localhost"), false);
  assert.equal(isWebHost("127.0.0.1"), false);
});

test("isWebHost: rejects empty / null / undefined hostnames", () => {
  assert.equal(isWebHost(""), false);
  assert.equal(isWebHost(null), false);
  assert.equal(isWebHost(undefined), false);
});

test("isWebHost: case-insensitive (proxy / Host header capitalization varies)", () => {
  assert.equal(isWebHost("APP.TABULAMEDICA.HEALTH"), true);
  assert.equal(isWebHost("Portal.TabulaMedica.Health"), true);
});

test("shouldServeWebSpa: serves SPA for root + nested SPA routes on web hosts", () => {
  assert.equal(shouldServeWebSpa("www.tabulamedica.health", "/"), true);
  assert.equal(shouldServeWebSpa("app.tabulamedica.health", "/dashboard"), true);
  assert.equal(
    shouldServeWebSpa("portal.tabulamedica.health", "/patients/123"),
    true,
  );
  assert.equal(
    shouldServeWebSpa("tabula-medica-web-verion.replit.app", "/onboarding"),
    true,
  );
});

test("shouldServeWebSpa: NEVER serves SPA for /api on web hosts (must reach API)", () => {
  for (const host of [
    "www.tabulamedica.health",
    "app.tabulamedica.health",
    "portal.tabulamedica.health",
  ]) {
    assert.equal(
      shouldServeWebSpa(host, "/api/version"),
      false,
      `${host} /api/version should fall through to API`,
    );
    assert.equal(shouldServeWebSpa(host, "/api/auth/me"), false);
    assert.equal(shouldServeWebSpa(host, "/api/health-records"), false);
  }
});

test("shouldServeWebSpa: NEVER serves SPA for /webhooks on web hosts", () => {
  assert.equal(
    shouldServeWebSpa("app.tabulamedica.health", "/webhooks/stripe"),
    false,
  );
  assert.equal(
    shouldServeWebSpa("portal.tabulamedica.health", "/webhooks/twilio"),
    false,
  );
});

test("shouldServeWebSpa: NEVER serves SPA on api.tabulamedica.health (any path)", () => {
  // This is the most important invariant: an EAS mobile client hitting
  // api.tabulamedica.health/ must NOT get the web SPA bundle back.
  assert.equal(shouldServeWebSpa("api.tabulamedica.health", "/"), false);
  assert.equal(
    shouldServeWebSpa("api.tabulamedica.health", "/manifest"),
    false,
  );
  assert.equal(
    shouldServeWebSpa("api.tabulamedica.health", "/anything"),
    false,
  );
});

test("shouldServeWebSpa: NEVER serves SPA on unknown hosts (defense in depth)", () => {
  assert.equal(shouldServeWebSpa("evil.com", "/"), false);
  assert.equal(shouldServeWebSpa("localhost", "/"), false);
  assert.equal(shouldServeWebSpa("", "/"), false);
});
