#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const PLACEHOLDER = "SET_VIA_ENVIRONMENT_SECRET";
const SOURCE_CONFIG = "store.config.json";
const PLACEHOLDER_PHONE_PATTERNS = [/\+?1?8005551234/, /555-?01\d{2}/, /5551234/];
const PLACEHOLDER_EMAIL_PATTERNS = [/example\.(com|org)$/i, /^support@tabulamedica\.health$/i];

function fail(msg) {
  console.error(`[push-asc-metadata] ERROR: ${msg}`);
  process.exit(1);
}

const passthroughArgs = process.argv.slice(2);
for (let i = 0; i < passthroughArgs.length; i++) {
  if (passthroughArgs[i] === "--platform") {
    const v = passthroughArgs[i + 1];
    if (v && v !== "ios") {
      fail(`This wrapper only supports --platform ios (got "${v}"); App Store metadata is iOS-only.`);
    }
    passthroughArgs.splice(i, 2);
    i--;
  }
}

const reviewerEmail = process.env.APPLE_REVIEWER_DEMO_EMAIL;
const reviewerPassword = process.env.APPLE_REVIEWER_DEMO_PASSWORD;
const contactEmail = process.env.APPLE_REVIEW_CONTACT_EMAIL;
const contactPhone = process.env.APPLE_REVIEW_CONTACT_PHONE;
const contactFirstName = process.env.APPLE_REVIEW_CONTACT_FIRST_NAME;
const contactLastName = process.env.APPLE_REVIEW_CONTACT_LAST_NAME;

if (!reviewerEmail || !reviewerPassword) {
  fail(
    "Missing required env vars APPLE_REVIEWER_DEMO_EMAIL and APPLE_REVIEWER_DEMO_PASSWORD. " +
      "Set them via EAS secrets (`eas secret:create`) or your CI secret store before running this script.",
  );
}

const raw = readFileSync(SOURCE_CONFIG, "utf8");
const config = JSON.parse(raw);

if (!config.apple || !config.apple.review) {
  fail(`${SOURCE_CONFIG} is missing apple.review block`);
}
if (config.android || config.googlePlay) {
  fail(
    `This wrapper is iOS-only; ${SOURCE_CONFIG} contains a non-Apple metadata block. ` +
      `Split Android metadata out before pushing.`,
  );
}

config.apple.review.demoAccountRequired = true;
config.apple.review.demoAccountName = reviewerEmail;
config.apple.review.demoAccountPassword = reviewerPassword;

if (contactEmail) config.apple.review.email = contactEmail;
if (contactPhone) config.apple.review.phone = contactPhone;
if (contactFirstName) config.apple.review.firstName = contactFirstName;
if (contactLastName) config.apple.review.lastName = contactLastName;

for (const [key, value] of Object.entries(config.apple.review)) {
  if (typeof value === "string" && value === PLACEHOLDER) {
    fail(`apple.review.${key} is still the placeholder "${PLACEHOLDER}" — set the corresponding env var.`);
  }
}

const reviewPhone = config.apple.review.phone ?? "";
if (PLACEHOLDER_PHONE_PATTERNS.some((re) => re.test(reviewPhone))) {
  fail(
    `apple.review.phone (${reviewPhone}) looks like a placeholder. ` +
      `Set APPLE_REVIEW_CONTACT_PHONE to the real support phone before pushing.`,
  );
}
const reviewEmail = config.apple.review.email ?? "";
if (PLACEHOLDER_EMAIL_PATTERNS.some((re) => re.test(reviewEmail))) {
  fail(
    `apple.review.email (${reviewEmail}) looks like a placeholder. ` +
      `Set APPLE_REVIEW_CONTACT_EMAIL to the real support email (with a real mailbox) before pushing.`,
  );
}

const reviewNotes = config.apple.review.notes ?? "";
const NOTES_PLACEHOLDER_PATTERNS = [
  /support@tabulamedica\.health/i,
  /\+?1?8005551234/,
  /555-?01\d{2}/,
  /@example\.(com|org)/i,
];
for (const re of NOTES_PLACEHOLDER_PATTERNS) {
  if (re.test(reviewNotes)) {
    fail(
      `apple.review.notes contains a placeholder contact pattern (${re}). ` +
        `Remove the dummy email/phone from the notes and reference the email/phone fields on the App Review submission instead.`,
    );
  }
}

const SKIP_REVIEWER_LOGIN_CHECK = process.env.SKIP_REVIEWER_LOGIN_CHECK === "1";
const REVIEWER_LOGIN_API_BASE =
  process.env.REVIEWER_LOGIN_API_BASE ?? "https://api.tabulamedica.health";

async function verifyReviewerLogin() {
  const url = `${REVIEWER_LOGIN_API_BASE.replace(/\/+$/, "")}/api/auth/login`;
  console.log(`[push-asc-metadata] Verifying reviewer login against ${url}`);
  let resp;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: reviewerEmail, password: reviewerPassword }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    fail(
      `Reviewer login pre-check failed to reach ${url}: ${err?.message ?? err}. ` +
        `Fix the network/backend, or re-run with SKIP_REVIEWER_LOGIN_CHECK=1 only if you have already manually verified.`,
    );
  }
  const bodyText = await resp.text().catch(() => "");
  if (resp.status !== 200) {
    const snippet = bodyText.slice(0, 400);
    let hint = "";
    if (resp.status === 401) hint = " Likely cause: reviewer password rotated or account disabled in prod.";
    else if (resp.status === 423) hint = " Likely cause: brute-force lockout — wait and retry.";
    else if (resp.status === 403) hint = " Likely cause: TLS/policy rejection at the load balancer.";
    else if (resp.status >= 500) hint = " Likely cause: backend error — check production logs.";
    fail(
      `Reviewer login pre-check FAILED with HTTP ${resp.status}.${hint} ` +
        `Aborting metadata push so Apple does not reject the build. Response: ${snippet}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    fail(`Reviewer login returned 200 but body was not JSON: ${bodyText.slice(0, 200)}`);
  }
  if (!parsed?.accessToken) {
    fail(
      `Reviewer login returned 200 but no accessToken in response — the login contract has changed. ` +
        `Update the reviewer pre-check before pushing.`,
    );
  }
  console.log(
    `[push-asc-metadata] Reviewer login OK (200, accessToken ${String(parsed.accessToken).length} chars)`,
  );
}

if (SKIP_REVIEWER_LOGIN_CHECK) {
  console.warn(
    "[push-asc-metadata] WARN: SKIP_REVIEWER_LOGIN_CHECK=1 — skipping pre-push reviewer login verification. " +
      "Only use this when the production API is intentionally unreachable from this runner.",
  );
} else {
  await verifyReviewerLogin();
}

const tmpDir = mkdtempSync(join(tmpdir(), "asc-metadata-"));
const tmpConfig = join(tmpDir, "store.config.json");
writeFileSync(tmpConfig, JSON.stringify(config, null, 2));

const backupPath = join(tmpDir, "store.config.json.bak");
copyFileSync(SOURCE_CONFIG, backupPath);

console.log(`[push-asc-metadata] Injected reviewer credentials into ${tmpConfig}`);
console.log(`[push-asc-metadata] Original ${SOURCE_CONFIG} backed up at ${backupPath}`);

let exitCode = 0;
try {
  copyFileSync(tmpConfig, SOURCE_CONFIG);
  const cmd = "eas";
  const args = ["metadata:push", ...passthroughArgs];
  console.log(`[push-asc-metadata] Running: ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit" });
  exitCode = result.status ?? 1;
} catch (err) {
  console.error(`[push-asc-metadata] ERROR during push: ${err?.message ?? err}`);
  exitCode = 1;
} finally {
  try {
    copyFileSync(backupPath, SOURCE_CONFIG);
    console.log(`[push-asc-metadata] Restored placeholder ${SOURCE_CONFIG} from backup`);
  } catch (restoreErr) {
    console.error(
      `[push-asc-metadata] CRITICAL: failed to restore ${SOURCE_CONFIG} from ${backupPath}: ${restoreErr?.message ?? restoreErr}. ` +
        `Manually restore from the backup before committing.`,
    );
    exitCode = exitCode || 1;
  }
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch (cleanupErr) {
    console.warn(
      `[push-asc-metadata] WARN: failed to delete tmp dir ${tmpDir}: ${cleanupErr?.message ?? cleanupErr}. ` +
        `Remove it manually to clear injected reviewer credentials from local disk.`,
    );
  }
}

process.exit(exitCode);
