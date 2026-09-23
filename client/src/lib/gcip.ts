import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  reload,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  getMultiFactorResolver,
  type Auth,
  type User as FirebaseUser,
  type Unsubscribe,
  type MultiFactorError,
  type MultiFactorResolver,
  type ConfirmationResult,
} from "firebase/auth";

const apiKey = import.meta.env.VITE_GCIP_API_KEY as string | undefined;
const authDomain = import.meta.env.VITE_GCIP_AUTH_DOMAIN as string | undefined;
const projectId = import.meta.env.VITE_GCIP_PROJECT_ID as string | undefined;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isGcipConfigured(): boolean {
  return Boolean(apiKey && authDomain && projectId);
}

/**
 * True when the web app is running inside the Tabula Medica native iOS/Android
 * WebView wrapper. OAuth popups (`signInWithPopup` for Google/Apple) cannot
 * complete inside a WKWebView — Google blocks embedded-webview OAuth
 * (`disallowed_useragent`) and popups can't round-trip back to the opener — so
 * in that context the UI hides the social buttons and offers email/password
 * sign-in instead. Detected via the native flag the wrapper injects before page
 * scripts run (`window.__TABULA_NATIVE_APP__`, see phr-mobile config
 * `NATIVE_FLAG_JS`) or the `?app=1` marker on the wrapper's entry URL.
 */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { __TABULA_NATIVE_APP__?: boolean };
  if (w.__TABULA_NATIVE_APP__ === true) return true;
  try {
    return new URLSearchParams(window.location.search).get("app") === "1";
  } catch {
    return false;
  }
}

function getApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isGcipConfigured()) {
    throw new Error(
      "[GCIP] Missing client config. Set VITE_GCIP_API_KEY, VITE_GCIP_AUTH_DOMAIN, VITE_GCIP_PROJECT_ID."
    );
  }
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  cachedApp =
    existing ??
    initializeApp({
      apiKey: apiKey!,
      authDomain: authDomain!,
      projectId: projectId!,
    });
  return cachedApp;
}

export function getGcipAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getApp());
  return cachedAuth;
}

export async function signInGcipWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(getGcipAuth(), email, password);
  return cred.user;
}

export async function signUpGcipWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(
    getGcipAuth(),
    email,
    password
  );
  return cred.user;
}

/**
 * Send a password-reset email to the given address via GCIP. Resolves whether
 * or not the address exists (email-enumeration protection); the caller should
 * always show the same "check your email" confirmation.
 */
export async function sendGcipPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getGcipAuth(), email);
}

// ---------------------------------------------------------------------------
// Email verification — the anti-bot check on the email/password sign-up path.
//
// We do NOT require MFA to register or sign in (TOTP stays opt-in in Security
// settings). Instead a new email/password account has to prove the address is
// a real inbox someone can read: GCIP mails a verification link, and the
// server refuses to provision the account until the token comes back with
// `email_verified: true` (see server/auth/email-verification.ts).
//
// Google/Apple sign-in and phone/SMS sign-in are unaffected — those tokens
// arrive already verified by the IdP or by possession of the number.
// ---------------------------------------------------------------------------

/**
 * Mail the current user a verification link. Call right after
 * signUpGcipWithEmail(), and again for "resend".
 *
 * The link returns the browser to `${origin}/auth/login?verified=1`, so the
 * person lands back on our sign-in page instead of Firebase's bare
 * "your email has been verified" page.
 *
 * OPS PREREQ: every serving domain (tabulamedica.us/.world/.health, localhost)
 * must be listed under Authentication > Settings > Authorized domains in the
 * Firebase/GCIP console, or the link is rejected with auth/unauthorized-continue-uri.
 */
export async function sendGcipVerificationEmail(): Promise<void> {
  const user = getGcipAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const continueUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/login?verified=1`
      : undefined;
  await sendEmailVerification(user, continueUrl ? { url: continueUrl } : undefined);
}

/** Email address of the currently signed-in GCIP user, if any. */
export function getGcipCurrentEmail(): string | null {
  return getGcipAuth().currentUser?.email ?? null;
}

/**
 * Re-fetch the current user from GCIP so a just-clicked verification link is
 * reflected in `emailVerified`. Returns the refreshed verified flag (false when
 * nobody is signed in).
 */
export async function refreshGcipEmailVerified(): Promise<boolean> {
  const user = getGcipAuth().currentUser;
  if (!user) return false;
  await reload(user);
  return user.emailVerified === true;
}

/**
 * True when this user signed in with an address they typed themselves
 * (`password` provider) and has not confirmed it yet — the client-side mirror
 * of the server rule in server/auth/email-verification.ts. Google/Apple and
 * phone sign-ins always return false.
 */
export function needsEmailVerification(user: FirebaseUser | null): boolean {
  if (!user) return false;
  if (user.emailVerified) return false;
  // `providerData` is empty for phone-only users and carries "google.com" /
  // "apple.com" / "password" otherwise.
  const usesPassword = user.providerData.some((p) => p.providerId === "password");
  return usesPassword;
}

export async function signInGcipWithGoogle(): Promise<FirebaseUser> {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(getGcipAuth(), provider);
  return cred.user;
}

/**
 * Sign in with Apple via GCIP. Requires the Apple provider to be enabled in
 * the Firebase Console with the Services ID + Team ID + Key ID + .p8 private
 * key. Apple's "hide my email" relay addresses
 * (`<random>@privaterelay.appleid.com`) are accepted and treated as the
 * canonical verified email.
 */
export async function signInGcipWithApple(): Promise<FirebaseUser> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const cred = await signInWithPopup(getGcipAuth(), provider);
  return cred.user;
}

// ---------------------------------------------------------------------------
// Redirect-based social sign-in (used by the LOGIN/REGISTER pages).
//
// The popup functions above depend on third-party cookies, which incognito
// windows, Safari (ITP), and strict-privacy browsers block — that surfaced to
// users as `auth/internal-error`. The redirect flow navigates the whole page
// to Google/Apple and back, so it works in every browser with no third-party-
// cookie dependency. These return `Promise<void>` because the page unloads
// (navigates away) before the promise settles; the result is picked up on the
// next page load via `completeGcipRedirectSignIn()`.
//
// (The popup variants are intentionally kept for in-app RE-AUTH, e.g.
// security-settings.tsx, where an inline popup — not a full-page redirect that
// would lose flow state — is the right UX.)
// ---------------------------------------------------------------------------

export async function signInGcipWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithRedirect(getGcipAuth(), provider);
}

export async function signInGcipWithAppleRedirect(): Promise<void> {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  await signInWithRedirect(getGcipAuth(), provider);
}

/**
 * Call once on auth-page load to finish a Google/Apple redirect sign-in.
 * Returns the signed-in user when the page was reached via an OAuth redirect,
 * or null on a normal page load. May throw a MultiFactorError (handle with
 * isMfaChallenge/getMfaResolver) when the account has TOTP enrolled.
 */
export async function completeGcipRedirectSignIn(): Promise<FirebaseUser | null> {
  if (!isGcipConfigured()) return null;
  const result = await getRedirectResult(getGcipAuth());
  return result?.user ?? null;
}

// ---------------------------------------------------------------------------
// Phone (SMS one-time-code) sign-in — the "HealthEx-easy" passwordless path.
//
// Flow: normalizePhoneE164() -> startPhoneSignIn() (sends the SMS via an
// invisible reCAPTCHA) -> confirmPhoneCode() with the 6-digit code the user
// received. GCIP mints an ID token whose firebase.sign_in_provider is "phone";
// the server (verifyAndResolveGcip) provisions/links the user from it exactly
// like Google/Apple, so no new backend endpoint is needed.
//
// OPS PREREQS (one-time, Firebase/GCIP console for project
// united-planet-485003-n7-9f345):
//   1. Authentication > Sign-in method > enable "Phone".
//   2. Project must be on the Blaze plan (SMS has per-message cost + quota).
//   3. Add every serving domain (tabulamedica.us/.world/.health, localhost)
//      to Authentication > Settings > Authorized domains, or reCAPTCHA blocks
//      the send with auth/argument-error.
// ---------------------------------------------------------------------------

let cachedRecaptcha: RecaptchaVerifier | null = null;

/**
 * Normalize a user-typed phone number to E.164 (e.g. "+15715550123"), which is
 * the only format GCIP's phone auth accepts. Assumes US (+1) when no country
 * code is given — the PHR's launch markets are US (.us) / global (.world) with
 * US default. Returns null when the input can't be a valid number.
 */
export function normalizePhoneE164(raw: string, defaultCountry = "1"): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Already E.164.
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  // US 10-digit -> prepend country code.
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  // 11-digit starting with the US country code.
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Anything else with a plausible length: assume it already carries a country
  // code and just needs the leading "+".
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * Lazily build (once) an invisible reCAPTCHA verifier bound to a container
 * element the caller renders. Firebase phone auth requires this anti-abuse
 * step; "invisible" means the user never sees a puzzle unless Google decides
 * the request is suspicious. Reused across resend attempts on the same page.
 */
function getRecaptcha(containerId: string): RecaptchaVerifier {
  if (cachedRecaptcha) return cachedRecaptcha;
  cachedRecaptcha = new RecaptchaVerifier(getGcipAuth(), containerId, {
    size: "invisible",
  });
  return cachedRecaptcha;
}

/**
 * Tear down the reCAPTCHA verifier. Call when leaving the phone-sign-in view or
 * after a hard failure so the next attempt starts from a clean widget (a stale
 * verifier throws auth/internal-error on reuse after certain errors).
 */
export function clearRecaptcha(): void {
  if (cachedRecaptcha) {
    try {
      cachedRecaptcha.clear();
    } catch {
      /* already gone */
    }
    cachedRecaptcha = null;
  }
}

/**
 * Step 1 of phone sign-in: send a 6-digit SMS code to an E.164 number.
 * `containerId` is the id of an (empty) element in the DOM for the invisible
 * reCAPTCHA. Returns a ConfirmationResult to pass to confirmPhoneCode().
 */
export async function startPhoneSignIn(
  phoneE164: string,
  containerId: string,
): Promise<ConfirmationResult> {
  const verifier = getRecaptcha(containerId);
  try {
    return await signInWithPhoneNumber(getGcipAuth(), phoneE164, verifier);
  } catch (err) {
    // A failed send can leave the verifier in an unusable state; reset so the
    // user's retry rebuilds it.
    clearRecaptcha();
    throw err;
  }
}

/**
 * Step 2 of phone sign-in: exchange the SMS code for a signed-in user. Throws
 * auth/invalid-verification-code when the code is wrong or expired.
 */
export async function confirmPhoneCode(
  confirmation: ConfirmationResult,
  code: string,
): Promise<FirebaseUser> {
  const cred = await confirmation.confirm(code.replace(/\D/g, ""));
  clearRecaptcha();
  return cred.user;
}

export async function signOutGcip(): Promise<void> {
  await signOut(getGcipAuth());
}

/**
 * Returns a fresh GCIP ID token for the current user, or null when
 * no user is signed in. Pass `forceRefresh=true` after a known token
 * revocation; otherwise the SDK auto-refreshes ~5 minutes before expiry.
 *
 * Send the returned string as `Authorization: Bearer <token>` to hit
 * the dual-validation backend path that lights up `provider=gcip` in logs.
 */
export async function getGcipIdToken(forceRefresh = false): Promise<string | null> {
  const user = getGcipAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function onGcipAuthChange(
  cb: (user: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(getGcipAuth(), cb);
}

// ---------------------------------------------------------------------------
// TOTP (MFA) helpers — Firebase manages the TOTP secret + factor; our server
// only mirrors the enabled flag and stores recovery codes hashed.
// ---------------------------------------------------------------------------

export interface TotpEnrollmentStart {
  secret: TotpSecret;
  secretKey: string;
  qrCodeUrl: string;
}

/**
 * Begin a TOTP enrollment. Returns the shared secret + an otpauth:// URL
 * suitable for rendering as a QR code. The caller must subsequently call
 * finalizeTotpEnrollment() with the 6-digit code from the user's app.
 *
 * Requires a recently-signed-in user. If Firebase rejects with
 * `auth/requires-recent-login`, the caller should re-run signInGcipWithGoogle().
 */
export async function startTotpEnrollment(
  accountName: string,
  issuer = "Tabula Medica"
): Promise<TotpEnrollmentStart> {
  const user = getGcipAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const session = await multiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const qrCodeUrl = secret.generateQrCodeUrl(accountName, issuer);
  return { secret, secretKey: secret.secretKey, qrCodeUrl };
}

/**
 * Complete TOTP enrollment using the 6-digit code from the user's
 * authenticator app. Throws if the code is wrong.
 */
export async function finalizeTotpEnrollment(
  secret: TotpSecret,
  oneTimeCode: string,
  displayName = "Authenticator app"
): Promise<void> {
  const user = getGcipAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    secret,
    oneTimeCode.replace(/\s/g, "")
  );
  await multiFactor(user).enroll(assertion, displayName);
}

/**
 * Returns true if the current user has at least one enrolled second factor.
 */
export function hasEnrolledTotp(): boolean {
  const user = getGcipAuth().currentUser;
  if (!user) return false;
  return multiFactor(user).enrolledFactors.length > 0;
}

/**
 * Remove every enrolled second factor for the current user. Requires a
 * recent re-authentication (callers should re-run Google sign-in first).
 */
export async function unenrollAllFactors(): Promise<void> {
  const user = getGcipAuth().currentUser;
  if (!user) throw new Error("Not signed in");
  const mf = multiFactor(user);
  for (const factor of mf.enrolledFactors) {
    await mf.unenroll(factor);
  }
}

/**
 * Type guard: did this error indicate that Firebase needs a TOTP challenge
 * to complete sign-in?
 */
export function isMfaChallenge(err: unknown): err is MultiFactorError {
  return Boolean(err) && (err as any)?.code === "auth/multi-factor-auth-required";
}

/**
 * Build a resolver from a thrown MultiFactorError so the caller can render
 * a "enter your 6-digit code" prompt and then call resolveTotpChallenge().
 */
export function getMfaResolver(err: MultiFactorError): MultiFactorResolver {
  return getMultiFactorResolver(getGcipAuth(), err);
}

/**
 * Complete a sign-in that was paused at the MFA challenge. Returns the
 * authenticated user on success.
 */
export async function resolveTotpChallenge(
  resolver: MultiFactorResolver,
  oneTimeCode: string
): Promise<FirebaseUser> {
  const hint = resolver.hints.find(
    (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
  );
  if (!hint) {
    throw new Error("No TOTP factor enrolled on this account");
  }
  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    oneTimeCode.replace(/\s/g, "")
  );
  const cred = await resolver.resolveSignIn(assertion);
  return cred.user;
}

export type { FirebaseUser, MultiFactorError, MultiFactorResolver, ConfirmationResult };
