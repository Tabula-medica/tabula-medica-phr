/**
 * In-app review prompt with safety gating.
 *
 * Apple's StoreKit `requestReview` is allowed up to 3 times per 365 days
 * per user. We additionally enforce these product rules:
 *   - Only fired by an explicit positive event (`signalPositive`).
 *   - Never fired within 72 hours of a negative event (`signalNegative`).
 *   - Never fired on clinical screens — caller responsibility (just don't
 *     call signalPositive from a clinical surface).
 *   - Minimum 5 cumulative positive events before the first prompt.
 *   - Minimum 60 days between prompt attempts.
 *   - Hard cap: 3 prompts per 365-day window.
 *
 * Native bridge: when running inside Capacitor with the
 * `@capacitor-community/in-app-review` plugin installed, calls the native
 * StoreKit / Play In-App Review flow. On web (or when the plugin is not
 * present), shows a non-blocking toast linking to the public store
 * listing — this lets us soft-launch the same logic on the PWA.
 */

import { toast } from "@/hooks/use-toast";

type PositiveEvent =
  | "subscription_success"
  | "share_success"
  | "ehr_connect_success"
  | "ambient_encounter_completed"
  | "care_gap_addressed";

type NegativeEvent =
  | "auth_error"
  | "payment_failed"
  | "ehr_connect_failed"
  | "ambient_encounter_failed"
  | "data_export_failed"
  | "generic_error";

const STORAGE_KEY = "tm:review_prompt:v1";
const APP_STORE_URL = "https://apps.apple.com/app/tabula-medica/id000000000"; // TODO: replace with real ID after first App Store Connect entry
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.tabulamedica.app";

const MIN_POSITIVE_EVENTS = 5;
const MIN_DAYS_BETWEEN_PROMPTS = 60;
const MAX_PROMPTS_PER_YEAR = 3;
const NEGATIVE_COOLDOWN_HOURS = 72;

interface PromptState {
  positiveCount: number;
  lastPositiveAt: number | null;
  lastNegativeAt: number | null;
  promptHistory: number[]; // timestamps of past prompts
}

function loadState(): PromptState {
  if (typeof localStorage === "undefined") {
    return { positiveCount: 0, lastPositiveAt: null, lastNegativeAt: null, promptHistory: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { positiveCount: 0, lastPositiveAt: null, lastNegativeAt: null, promptHistory: [] };
    const parsed = JSON.parse(raw);
    return {
      positiveCount: typeof parsed.positiveCount === "number" ? parsed.positiveCount : 0,
      lastPositiveAt: typeof parsed.lastPositiveAt === "number" ? parsed.lastPositiveAt : null,
      lastNegativeAt: typeof parsed.lastNegativeAt === "number" ? parsed.lastNegativeAt : null,
      promptHistory: Array.isArray(parsed.promptHistory) ? parsed.promptHistory.filter((n: any) => typeof n === "number") : [],
    };
  } catch {
    return { positiveCount: 0, lastPositiveAt: null, lastNegativeAt: null, promptHistory: [] };
  }
}

function saveState(s: PromptState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Ignore quota errors — review prompt is non-critical.
  }
}

function isCapacitorNative(): boolean {
  const w = typeof window !== "undefined" ? (window as any) : null;
  return !!(w && w.Capacitor && typeof w.Capacitor.isNativePlatform === "function" && w.Capacitor.isNativePlatform());
}

function platform(): "ios" | "android" | "web" {
  const w = typeof window !== "undefined" ? (window as any) : null;
  const p = w?.Capacitor?.getPlatform?.();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

async function tryNativeReview(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    // @ts-ignore — optional dependency, only present in native builds
    // Indirect the package name through a runtime variable so vite's
    // dependency scanner does not try to statically resolve this
    // Capacitor-only native plugin (web build does not include it; the
    // runtime .catch() handles its absence).
    const pkgName = ["@capacitor-community", "in-app-review"].join("/");
    const mod = await import(/* @vite-ignore */ pkgName).catch(() => null);
    if (!mod) return false;
    const InAppReview = (mod as any).InAppReview;
    if (!InAppReview || typeof InAppReview.requestReview !== "function") return false;
    await InAppReview.requestReview();
    return true;
  } catch {
    return false;
  }
}

function fallbackWebToast(): void {
  const url = platform() === "android" ? PLAY_STORE_URL : APP_STORE_URL;
  toast({
    title: "Enjoying Tabula Medica?",
    description: "A quick rating helps other patients find us. Thank you! Rate us anytime from Settings → About.",
  });
  // Best-effort open the store listing after a short delay so the user can
  // see the toast first. Suppressed in non-browser contexts.
  if (typeof window !== "undefined") {
    setTimeout(() => {
      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        // no-op
      }
    }, 1500);
  }
}

function shouldPrompt(state: PromptState, now: number): boolean {
  if (state.positiveCount < MIN_POSITIVE_EVENTS) return false;

  // Negative cooldown
  if (state.lastNegativeAt && now - state.lastNegativeAt < NEGATIVE_COOLDOWN_HOURS * 3600 * 1000) return false;

  // 365-day rolling cap
  const oneYearAgo = now - 365 * 24 * 3600 * 1000;
  const recentPrompts = state.promptHistory.filter((t) => t > oneYearAgo);
  if (recentPrompts.length >= MAX_PROMPTS_PER_YEAR) return false;

  // Min spacing between prompts
  if (recentPrompts.length > 0) {
    const lastPrompt = Math.max(...recentPrompts);
    if (now - lastPrompt < MIN_DAYS_BETWEEN_PROMPTS * 24 * 3600 * 1000) return false;
  }

  return true;
}

/**
 * Call after any positive user moment that's safe to celebrate.
 * Examples: subscription_success, share_success, ehr_connect_success.
 *
 * NEVER call from clinical screens (medication detail, lab result detail,
 * AI assistant response, ambient encounter recording UI, anywhere a
 * clinical decision might be perceived as influenced by an unrelated UI).
 */
export async function signalPositive(event: PositiveEvent): Promise<void> {
  const state = loadState();
  const now = Date.now();
  state.positiveCount += 1;
  state.lastPositiveAt = now;
  saveState(state);

  if (!shouldPrompt(state, now)) return;

  // Prompt is firing — record it BEFORE attempting the native call so we
  // don't double-prompt if the native bridge throws after surfacing UI.
  state.promptHistory.push(now);
  saveState(state);

  const nativeOk = await tryNativeReview();
  if (!nativeOk) {
    fallbackWebToast();
  }

  // Surface a debug breadcrumb in dev for visibility. Silent in prod.
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
    // eslint-disable-next-line no-console
    console.log("[review-prompt] fired", { event, native: nativeOk, positiveCount: state.positiveCount });
  }
}

/**
 * Call after any negative event. Sets a 72-hour cooldown so we never
 * prompt for a review right after a frustrating moment.
 */
export function signalNegative(_event: NegativeEvent): void {
  const state = loadState();
  state.lastNegativeAt = Date.now();
  saveState(state);
}

/**
 * Test/debug helper. NOT exported from the package barrel — only callable
 * from devtools console: `window.__resetReviewPrompt?.()`.
 */
if (typeof window !== "undefined") {
  (window as any).__resetReviewPrompt = () => {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    // eslint-disable-next-line no-console
    console.log("[review-prompt] state cleared");
  };
}
