import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  OAuthProvider,
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
} from "firebase/auth";

// PUBLIC GCIP/Firebase web config (ships in the browser bundle; not secrets — the
// API key is a browser identifier restricted by auth domain + Firebase rules).
// Hardcoded as fallbacks IN SOURCE so they're always in the bundle: .env loading and
// vite `define` both proved unreliable for import.meta.env here, leaving the config
// undefined -> this file throws at load -> blank SPA. Env still wins if provided.
const apiKey =
  (import.meta.env.VITE_GCIP_API_KEY as string | undefined) ||
  "AIzaSyBCCtuVajEza6yHonlkz8XkVQJjIgAMS9o";
const authDomain =
  (import.meta.env.VITE_GCIP_AUTH_DOMAIN as string | undefined) ||
  "united-planet-485003-n7-9f345.firebaseapp.com";
const projectId =
  (import.meta.env.VITE_GCIP_PROJECT_ID as string | undefined) ||
  "united-planet-485003-n7-9f345";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isGcipConfigured(): boolean {
  return Boolean(apiKey && authDomain && projectId);
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

export type { FirebaseUser, MultiFactorError, MultiFactorResolver };
