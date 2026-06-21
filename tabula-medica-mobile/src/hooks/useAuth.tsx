import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  User,
  AuthResponse,
  login as authLogin,
  register as authRegister,
  logout as authLogout,
  authenticateWithBiometrics,
  resendVerificationEmail as authResendVerification,
  exchangeGcipSession,
} from '../services/auth';
import { isGcipConfigured, onGcipAuthChange, reloadGcipUser } from '../lib/gcip';
import api from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isEmailVerified: boolean;
  isConfigured: boolean;
  /** True only when the server-side onboarding gate is known to require onboarding. */
  needsOnboarding: boolean;
  /**
   * True once we have a definitive answer (true OR false) about onboarding
   * for the current user, OR we've exhausted retries. Used by the router to
   * avoid flashing the main app before onboarding is resolved.
   */
  isOnboardingResolved: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  /**
   * Apply the result of a federated (Google/Apple) sign-in performed in a
   * screen-level hook so that user + onboarding state are committed
   * immediately, mirroring what login()/register() do.
   */
  applyAuthResult: (response: AuthResponse | null) => void;
  logout: () => Promise<void>;
  authenticateBiometric: () => Promise<boolean>;
  resendVerificationEmail: () => Promise<boolean>;
  refreshVerificationStatus: () => Promise<boolean>;
  markOnboardingComplete: () => Promise<void>;
  /**
   * After onboarding, the router uses this to send users straight into a
   * specific Main-stack screen (e.g. ConnectDoctor when they picked
   * "connect a doctor" on the last step). The router consumes it once.
   */
  pendingPostOnboardingRoute: 'ConnectDoctor' | null;
  setPendingPostOnboardingRoute: (route: 'ConnectDoctor' | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export type OnboardingCompletionErrorKind = 'network' | 'server' | 'auth';

export class OnboardingCompletionError extends Error {
  readonly kind: OnboardingCompletionErrorKind;
  constructor(kind: OnboardingCompletionErrorKind, message: string) {
    super(message);
    this.name = 'OnboardingCompletionError';
    this.kind = kind;
  }
}

function classifyOnboardingError(err: unknown): OnboardingCompletionError {
  const anyErr = err as {
    response?: { status?: number };
    code?: string;
    message?: string;
  } | undefined;
  const status = anyErr?.response?.status;
  if (status === 401 || status === 403) {
    return new OnboardingCompletionError(
      'auth',
      "We couldn't verify your sign-in. Please sign in again to finish setting up.",
    );
  }
  if (typeof status === 'number' && status >= 500) {
    return new OnboardingCompletionError(
      'server',
      "Our servers had a problem finishing your setup. Please try again in a moment.",
    );
  }
  // No HTTP response = network failure (offline, DNS, timeout, etc.).
  if (!anyErr?.response) {
    return new OnboardingCompletionError(
      'network',
      "We couldn't reach Tabula Medica. Check your internet connection and try again.",
    );
  }
  return new OnboardingCompletionError(
    'server',
    "Something went wrong finishing your setup. Please try again.",
  );
}

// Cap retries when the backend handoff returns null (transient storage
// errors, network blips). After this many attempts we stop blocking the
// router and default to "no onboarding" so users aren't stuck on a splash.
const MAX_ONBOARDING_LOOKUP_ATTEMPTS = 3;
const ONBOARDING_LOOKUP_RETRY_MS = 2000;

function toUser(fbUser: {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}): User {
  const name =
    fbUser.displayName ||
    fbUser.email?.split('@')[0] ||
    'Patient';
  return {
    id: fbUser.uid,
    email: fbUser.email ?? '',
    name,
    role: 'patient',
    emailVerified: fbUser.emailVerified,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // `null` = not yet resolved. The router treats this as "still loading"
  // for verified users so we don't flash Main before the server tells us
  // whether onboarding is needed.
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [pendingPostOnboardingRoute, setPendingPostOnboardingRoute] = useState<
    'ConnectDoctor' | null
  >(null);
  const configured = isGcipConfigured();
  // The uid we have a *definitive* onboarding answer for. Only set on a
  // successful boolean result so transient handoff failures don't suppress
  // future onboarding routing.
  const resolvedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!configured) {
      console.warn(
        '[Auth] Firebase/GCIP not configured. Set EXPO_PUBLIC_GCIP_API_KEY, EXPO_PUBLIC_GCIP_AUTH_DOMAIN, EXPO_PUBLIC_GCIP_PROJECT_ID.'
      );
      setIsLoading(false);
      return;
    }
    const unsub = onGcipAuthChange((fbUser) => {
      setUser((prev) => {
        const next = fbUser ? toUser(fbUser) : null;
        // If the user changed (different uid or signed out), drop the
        // resolved onboarding answer so we re-query for the new identity.
        if (prev?.id !== next?.id) {
          resolvedUidRef.current = null;
          setNeedsOnboarding(null);
          // Different (or no) user — drop any stale post-onboarding intent
          // so it can't leak into a future session.
          setPendingPostOnboardingRoute(null);
        }
        return next;
      });
      setIsLoading(false);
    });
    return unsub;
  }, [configured]);

  // For sessions restored from disk (or returning users post-verification),
  // login()/register()/applyAuthResult() never ran in this app launch, so we
  // didn't get a `needsOnboarding` answer. Ask the backend, with bounded
  // retries on transient failures.
  useEffect(() => {
    if (!user || !user.emailVerified) return;
    if (resolvedUidRef.current === user.id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;

    async function attempt() {
      attempts += 1;
      const handoff = await exchangeGcipSession();
      if (cancelled) return;
      if (handoff?.needsOnboarding === true || handoff?.needsOnboarding === false) {
        resolvedUidRef.current = user!.id;
        setNeedsOnboarding(handoff.needsOnboarding);
        return;
      }
      // Null/undefined or thrown error -> retry up to the cap, then give
      // up and let the router proceed (default: no onboarding) so users
      // aren't stranded on a splash if the backend keeps failing.
      if (attempts >= MAX_ONBOARDING_LOOKUP_ATTEMPTS) {
        resolvedUidRef.current = user!.id;
        setNeedsOnboarding(false);
        return;
      }
      timer = setTimeout(attempt, ONBOARDING_LOOKUP_RETRY_MS);
    }

    attempt();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  function applyAuthResult(response: AuthResponse | null) {
    if (!response) return;
    setUser(response.user);
    if (typeof response.needsOnboarding === 'boolean') {
      resolvedUidRef.current = response.user.id;
      setNeedsOnboarding(response.needsOnboarding);
    } else {
      // Handoff didn't give us a definitive answer; let the effect retry
      // for this uid.
      resolvedUidRef.current = null;
      setNeedsOnboarding(null);
    }
  }

  async function login(email: string, password: string) {
    const response = await authLogin(email, password);
    applyAuthResult(response);
  }

  async function register(email: string, password: string) {
    const response = await authRegister(email, password);
    setUser(response.user);
    // Brand-new sign-ups always need onboarding once they verify email.
    // We still mark this as the resolved answer so the verify-email
    // → onboarding transition is instant.
    resolvedUidRef.current = response.user.id;
    setNeedsOnboarding(true);
  }

  async function logout() {
    await authLogout();
    setUser(null);
    resolvedUidRef.current = null;
    setNeedsOnboarding(null);
    setPendingPostOnboardingRoute(null);
  }

  async function authenticateBiometric(): Promise<boolean> {
    return authenticateWithBiometrics();
  }

  async function resendVerificationEmail(): Promise<boolean> {
    return authResendVerification();
  }

  async function refreshVerificationStatus(): Promise<boolean> {
    const fbUser = await reloadGcipUser();
    if (!fbUser) return false;
    setUser(toUser(fbUser));
    return fbUser.emailVerified;
  }

  async function markOnboardingComplete(): Promise<void> {
    if (!user) {
      // No signed-in user means there's nothing to complete server-side.
      // Surface this as an auth error so the screen can send them back
      // to sign-in instead of retrying in a loop.
      throw new OnboardingCompletionError(
        'auth',
        'Your session has expired. Please sign in again to finish setting up.',
      );
    }
    try {
      await api.post('/api/onboarding/complete', { completedSteps: ['welcome'] });
    } catch (err) {
      console.warn('[Auth] Failed to record onboarding completion:', err);
      // Classify so the screen can decide between "retry" and "sign back in".
      // Re-throw so we DON'T clear the gate — preventing a "completed in
      // UI but not on server" split where the welcome screen would reappear
      // next launch.
      throw classifyOnboardingError(err);
    }
    if (user) {
      resolvedUidRef.current = user.id;
    }
    setNeedsOnboarding(false);
  }

  const isOnboardingResolved = needsOnboarding !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isLoggedIn: !!user,
        isEmailVerified: !!user?.emailVerified,
        isConfigured: configured,
        needsOnboarding: needsOnboarding === true,
        isOnboardingResolved,
        login,
        register,
        applyAuthResult,
        logout,
        authenticateBiometric,
        resendVerificationEmail,
        refreshVerificationStatus,
        markOnboardingComplete,
        pendingPostOnboardingRoute,
        setPendingPostOnboardingRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
