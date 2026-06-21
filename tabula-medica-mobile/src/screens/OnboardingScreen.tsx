import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import {
  useAuth,
  OnboardingCompletionError,
  type OnboardingCompletionErrorKind,
} from '../hooks/useAuth';
import api from '../services/api';

type StepId = 'welcome' | 'profile' | 'language' | 'connect';

type OnboardingError = {
  kind: OnboardingCompletionErrorKind;
  message: string;
};

interface OnboardingProgress {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  preferredLanguage?: string;
  connectDoctorChoice?: 'connect' | 'skip';
  currentStep?: 'profile' | 'language' | 'connect' | 'complete';
  updatedAt?: string;
}

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'profile', label: 'About you' },
  { id: 'language', label: 'Language' },
  { id: 'connect', label: 'Connect' },
];

const LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'Mandarin',
  'Arabic',
  'Other',
];

const HIGHLIGHTS: Array<{
  icon: keyof typeof Feather.glyphMap;
  title: string;
  body: string;
}> = [
  {
    icon: 'activity',
    title: 'All your records, in one place',
    body: 'Connect your doctors and we pull together visits, labs, and medications so nothing is missed.',
  },
  {
    icon: 'message-circle',
    title: 'Ask anything, in plain language',
    body: 'Your AI health assistant explains results, summarizes notes, and answers questions any time.',
  },
  {
    icon: 'shield',
    title: 'Private and secure',
    body: 'HIPAA-compliant storage with face ID, audit logs, and granular sharing controls.',
  },
];

function isValidDob(value: string): boolean {
  if (!value) return false;
  // Accept YYYY-MM-DD only — keeps validation simple and dependency-free.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = match.slice(1).map((n) => parseInt(n, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date > now) return false;
  if (y < 1900) return false;
  return true;
}

function splitName(full: string | undefined): { first: string; last: string } {
  if (!full) return { first: '', last: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function errorTitleFor(kind: OnboardingCompletionErrorKind): string {
  if (kind === 'network') return "Can't reach the server";
  if (kind === 'auth') return 'Sign-in expired';
  return "Couldn't finish setup";
}

export default function OnboardingScreen() {
  const { user, markOnboardingComplete, logout, setPendingPostOnboardingRoute } = useAuth();
  const queryClient = useQueryClient();

  const { data: progressData, isLoading: loadingProgress } = useQuery({
    queryKey: ['/api/mobile/onboarding/progress'],
    queryFn: async () => {
      const res = await api.get<{ progress: OnboardingProgress | null }>(
        '/api/mobile/onboarding/progress',
      );
      return res.data.progress;
    },
  });

  const fallbackName = splitName(user?.name);

  const [step, setStep] = useState<StepId>('welcome');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [language, setLanguage] = useState('English');
  const [isFinishing, setIsFinishing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [completionError, setCompletionError] = useState<OnboardingError | null>(null);
  // True while the network-error auto-retry effect is actively polling for
  // connectivity in the background. Drives the inline "Reconnecting…" hint
  // so users can see the wait is being handled for them.
  const [isReconnecting, setIsReconnecting] = useState(false);
  // Bumped only on user-initiated finish attempts (Connect / Skip / Try again).
  // The auto-retry effect keys off this so it arms exactly once per manual
  // attempt — a failed auto-retry will NOT re-arm itself.
  const [manualAttemptId, setManualAttemptId] = useState(0);
  const autoRetryRunningRef = useRef(false);
  // Tracks the most recent connect/skip choice so the auto-retry effect
  // knows which finish path to re-run when connectivity returns.
  const lastFinishChoiceRef = useRef<'connect' | 'skip' | null>(null);

  // Hydrate local state from the saved progress (resume support).
  useEffect(() => {
    if (loadingProgress || hydrated) return;
    const saved = progressData || {};
    setFirstName(saved.firstName || fallbackName.first || '');
    setLastName(saved.lastName || fallbackName.last || '');
    setDob(saved.dateOfBirth || '');
    setLanguage(saved.preferredLanguage || 'English');
    const savedStep = saved.currentStep;
    if (savedStep === 'profile' || savedStep === 'language' || savedStep === 'connect') {
      setStep(savedStep);
    }
    setHydrated(true);
  }, [loadingProgress, progressData, hydrated, fallbackName.first, fallbackName.last]);

  const saveProgressMutation = useMutation({
    mutationFn: async (patch: Partial<OnboardingProgress>) => {
      const res = await api.patch<{ progress: OnboardingProgress }>(
        '/api/mobile/onboarding/progress',
        patch,
      );
      return res.data.progress;
    },
    onSuccess: (progress) => {
      queryClient.setQueryData(['/api/mobile/onboarding/progress'], progress);
    },
  });

  async function persistAndAdvance(
    patch: Partial<OnboardingProgress>,
    nextStep: StepId,
  ) {
    try {
      await saveProgressMutation.mutateAsync({
        ...patch,
        currentStep:
          nextStep === 'welcome'
            ? 'profile'
            : (nextStep as Exclude<StepId, 'welcome'>),
      });
      setStep(nextStep);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Please check your connection and try again.';
      Alert.alert("Couldn't save your progress", message);
    }
  }

  async function handleFinish(choice: 'connect' | 'skip') {
    lastFinishChoiceRef.current = choice;
    // Mark this as a fresh manual attempt so the auto-retry effect is
    // (re-)armed exactly once for any network error that follows.
    setManualAttemptId((n) => n + 1);
    setIsFinishing(true);
    setCompletionError(null);
    try {
      await saveProgressMutation.mutateAsync({
        connectDoctorChoice: choice,
        currentStep: 'complete',
      });
      // Stash the intent BEFORE flipping the onboarding gate so the router
      // can land "connect now" users directly on the Connect Doctor screen
      // instead of dropping everyone on the dashboard.
      setPendingPostOnboardingRoute(choice === 'connect' ? 'ConnectDoctor' : null);
      await markOnboardingComplete();
      setCompletionError(null);
    } catch (err) {
      if (err instanceof OnboardingCompletionError) {
        setCompletionError({ kind: err.kind, message: err.message });
        // Auth errors mean the session is gone — there's nothing to retry
        // against. Drop them to the sign-in screen so they can recover.
        if (err.kind === 'auth') {
          try {
            await logout();
          } catch {
            // ignore — auth state will reconcile on next launch
          }
        }
      } else {
        setCompletionError({
          kind: 'server',
          message:
            err instanceof Error
              ? err.message
              : "Something went wrong finishing your setup. Please try again.",
        });
      }
    } finally {
      setIsFinishing(false);
    }
  }

  // While a network-error banner is showing, poll for connectivity by
  // pinging the API base URL. As soon as a request succeeds (any HTTP
  // response counts — even 404 means we reached the server) auto-retry
  // the onboarding call exactly once for this error instance.
  useEffect(() => {
    if (!completionError || completionError.kind !== 'network') return;
    if (isFinishing) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    setIsReconnecting(true);

    const baseURL = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
      ?.apiBaseUrl;

    async function isOnline(): Promise<boolean> {
      if (!baseURL) return false;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      try {
        await fetch(baseURL, { method: 'HEAD', signal: controller.signal });
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(t);
      }
    }

    async function tick() {
      if (cancelled) return;
      const online = await isOnline();
      if (cancelled) return;
      if (online) {
        if (autoRetryRunningRef.current) return;
        const choice = lastFinishChoiceRef.current;
        if (!choice) return;
        autoRetryRunningRef.current = true;
        // Hand off to the isFinishing spinner — clear the inline hint so
        // we don't render two spinners at once.
        setIsReconnecting(false);
        try {
          await handleFinish(choice);
        } finally {
          autoRetryRunningRef.current = false;
        }
        return;
      }
      attempts += 1;
      // Gentle backoff so we don't hammer the network: 3s, 4.5s, 6.75s, ... capped at 20s.
      const delay = Math.min(3000 * Math.pow(1.5, Math.min(attempts, 5)), 20000);
      timer = setTimeout(tick, delay);
    }

    timer = setTimeout(tick, 3000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setIsReconnecting(false);
    };
    // manualAttemptId (not error identity) is the trigger: the effect arms
    // exactly once per user-initiated attempt. A failed auto-retry will
    // NOT re-arm itself — the user must tap "Try again" to get another
    // auto-retry cycle, preventing unbounded background polling/calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionError?.kind, manualAttemptId]);

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // user can retry from settings later
    }
  }

  const currentStepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === step),
    [step],
  );

  if (loadingProgress && !hydrated) {
    return (
      <View style={[styles.container, styles.loadingContainer]} testID="screen-onboarding">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="screen-onboarding"
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {step !== 'welcome' && (
          <StepIndicator activeIndex={currentStepIndex} />
        )}

        {step === 'welcome' && (
          <WelcomeStep
            firstName={fallbackName.first || 'there'}
            onStart={() => persistAndAdvance({}, 'profile')}
            saving={saveProgressMutation.isPending}
          />
        )}

        {step === 'profile' && (
          <ProfileStep
            firstName={firstName}
            lastName={lastName}
            dob={dob}
            onChangeFirstName={setFirstName}
            onChangeLastName={setLastName}
            onChangeDob={setDob}
            onBack={() => setStep('welcome')}
            saving={saveProgressMutation.isPending}
            onNext={() =>
              persistAndAdvance(
                {
                  firstName: firstName.trim(),
                  lastName: lastName.trim(),
                  dateOfBirth: dob.trim(),
                },
                'language',
              )
            }
          />
        )}

        {step === 'language' && (
          <LanguageStep
            language={language}
            onChange={setLanguage}
            onBack={() => setStep('profile')}
            saving={saveProgressMutation.isPending}
            onNext={() =>
              persistAndAdvance({ preferredLanguage: language }, 'connect')
            }
          />
        )}

        {step === 'connect' && (
          <ConnectStep
            onBack={() => setStep('language')}
            onConnect={() => handleFinish('connect')}
            onSkip={() => handleFinish('skip')}
            isFinishing={isFinishing}
            isReconnecting={isReconnecting}
            error={completionError}
          />
        )}
      </ScrollView>

      {step === 'welcome' && (
        <View style={styles.signOutFooter}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleSignOut}
            testID="button-onboarding-signout"
          >
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function StepIndicator({ activeIndex }: { activeIndex: number }) {
  return (
    <View style={styles.indicatorRow} testID="step-indicator">
      {STEPS.slice(1).map((s, i) => {
        const isActive = i + 1 === activeIndex;
        const isDone = i + 1 < activeIndex;
        return (
          <View key={s.id} style={styles.indicatorItem}>
            <View
              style={[
                styles.indicatorDot,
                isActive && styles.indicatorDotActive,
                isDone && styles.indicatorDotDone,
              ]}
            />
            <Text
              style={[
                styles.indicatorLabel,
                (isActive || isDone) && styles.indicatorLabelActive,
              ]}
            >
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function WelcomeStep({
  firstName,
  onStart,
  saving,
}: {
  firstName: string;
  onStart: () => void;
  saving: boolean;
}) {
  return (
    <View testID="step-welcome">
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Feather name="heart" size={28} color="#fff" />
        </View>
        <Text style={styles.title} testID="text-onboarding-greeting">
          Welcome, {firstName}
        </Text>
        <Text style={styles.subtitle}>
          Let's get your health records set up. It only takes a moment.
        </Text>
      </View>

      <View style={styles.card}>
        {HIGHLIGHTS.map((item) => (
          <View key={item.title} style={styles.highlight}>
            <View style={styles.highlightIcon}>
              <Feather name={item.icon} size={20} color="#0F766E" />
            </View>
            <View style={styles.highlightText}>
              <Text style={styles.highlightTitle}>{item.title}</Text>
              <Text style={styles.highlightBody}>{item.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        We'll ask a few quick questions next. You can stop any time and pick
        up where you left off.
      </Text>

      <TouchableOpacity
        style={[styles.primaryButton, saving && styles.buttonDisabled]}
        onPress={onStart}
        disabled={saving}
        testID="button-onboarding-get-started"
      >
        {saving ? (
          <ActivityIndicator color="#0F766E" />
        ) : (
          <Text style={styles.primaryButtonText}>Get started</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ProfileStep({
  firstName,
  lastName,
  dob,
  onChangeFirstName,
  onChangeLastName,
  onChangeDob,
  onNext,
  onBack,
  saving,
}: {
  firstName: string;
  lastName: string;
  dob: string;
  onChangeFirstName: (v: string) => void;
  onChangeLastName: (v: string) => void;
  onChangeDob: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  const dobOk = isValidDob(dob);
  const ready =
    firstName.trim().length > 0 && lastName.trim().length > 0 && dobOk;

  return (
    <View testID="step-profile">
      <Text style={styles.stepTitle}>About you</Text>
      <Text style={styles.stepSubtitle}>
        We use this to match your records and personalize your experience.
      </Text>

      <View style={styles.formCard}>
        <Text style={styles.label}>First name</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={onChangeFirstName}
          placeholder="First name"
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          testID="input-onboarding-first-name"
        />

        <Text style={styles.label}>Last name</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={onChangeLastName}
          placeholder="Last name"
          placeholderTextColor="#94A3B8"
          autoCapitalize="words"
          testID="input-onboarding-last-name"
        />

        <Text style={styles.label}>Date of birth</Text>
        <TextInput
          style={styles.input}
          value={dob}
          onChangeText={onChangeDob}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
          testID="input-onboarding-dob"
        />
        {dob.length > 0 && !dobOk && (
          <Text style={styles.errorText}>Use the format YYYY-MM-DD.</Text>
        )}
      </View>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        nextDisabled={!ready || saving}
        saving={saving}
        nextTestID="button-onboarding-profile-next"
        backTestID="button-onboarding-profile-back"
      />
    </View>
  );
}

function LanguageStep({
  language,
  onChange,
  onNext,
  onBack,
  saving,
}: {
  language: string;
  onChange: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <View testID="step-language">
      <Text style={styles.stepTitle}>Preferred language</Text>
      <Text style={styles.stepSubtitle}>
        We'll use this for summaries, voice replies, and reminders.
      </Text>

      <View style={styles.formCard}>
        {LANGUAGES.map((lang) => {
          const selected = lang === language;
          return (
            <TouchableOpacity
              key={lang}
              style={[styles.choiceRow, selected && styles.choiceRowSelected]}
              onPress={() => onChange(lang)}
              testID={`button-onboarding-language-${lang.toLowerCase()}`}
            >
              <Text
                style={[
                  styles.choiceLabel,
                  selected && styles.choiceLabelSelected,
                ]}
              >
                {lang}
              </Text>
              {selected && (
                <Feather name="check" size={18} color="#0F766E" />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        nextDisabled={saving}
        saving={saving}
        nextTestID="button-onboarding-language-next"
        backTestID="button-onboarding-language-back"
      />
    </View>
  );
}

function ConnectStep({
  onBack,
  onConnect,
  onSkip,
  isFinishing,
  isReconnecting,
  error,
}: {
  onBack: () => void;
  onConnect: () => void;
  onSkip: () => void;
  isFinishing: boolean;
  isReconnecting: boolean;
  error: OnboardingError | null;
}) {
  return (
    <View testID="step-connect">
      <Text style={styles.stepTitle}>Connect your first doctor</Text>
      <Text style={styles.stepSubtitle}>
        Link a provider now so your records start flowing in. You can always
        connect more from the dashboard.
      </Text>

      <View style={styles.formCard}>
        <View style={styles.connectRow}>
          <View style={styles.connectIcon}>
            <Feather name="link" size={22} color="#0F766E" />
          </View>
          <Text style={styles.connectBody}>
            We'll guide you through finding your doctor and authorizing a
            secure connection to their records system.
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner} testID="banner-onboarding-error">
          <View style={styles.errorIconWrap}>
            <Feather
              name={error.kind === 'network' ? 'wifi-off' : 'alert-triangle'}
              size={18}
              color="#7F1D1D"
            />
          </View>
          <View style={styles.errorTextWrap}>
            <Text style={styles.errorTitle} testID="text-onboarding-error-title">
              {errorTitleFor(error.kind)}
            </Text>
            <Text style={styles.errorMessage} testID="text-onboarding-error-message">
              {error.message}
            </Text>
            {error.kind === 'network' && isReconnecting && !isFinishing && (
              <View
                style={styles.reconnectingRow}
                testID="indicator-onboarding-reconnecting"
              >
                <ActivityIndicator size="small" color="#7F1D1D" />
                <Text style={styles.reconnectingText}>Reconnecting…</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[styles.primaryButton, isFinishing && styles.buttonDisabled]}
        onPress={onConnect}
        disabled={isFinishing || error?.kind === 'auth'}
        testID="button-onboarding-connect-doctor"
      >
        {isFinishing ? (
          <ActivityIndicator color="#0F766E" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {error && error.kind !== 'auth' ? 'Try again' : 'Connect a doctor'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.skipButton, isFinishing && styles.buttonDisabled]}
        onPress={onSkip}
        disabled={isFinishing || error?.kind === 'auth'}
        testID="button-onboarding-skip-connect"
      >
        <Text style={styles.skipButtonText}>Skip for now</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backLink}
        onPress={onBack}
        disabled={isFinishing}
        testID="button-onboarding-connect-back"
      >
        <Feather name="chevron-left" size={16} color="#D1FAE5" />
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

function StepFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  saving,
  nextTestID,
  backTestID,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled: boolean;
  saving: boolean;
  nextTestID: string;
  backTestID: string;
}) {
  return (
    <View>
      <TouchableOpacity
        style={[styles.primaryButton, nextDisabled && styles.buttonDisabled]}
        onPress={onNext}
        disabled={nextDisabled}
        testID={nextTestID}
      >
        {saving ? (
          <ActivityIndicator color="#0F766E" />
        ) : (
          <Text style={styles.primaryButtonText}>{nextLabel}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.backLink}
        onPress={onBack}
        disabled={saving}
        testID={backTestID}
      >
        <Feather name="chevron-left" size={16} color="#D1FAE5" />
        <Text style={styles.backLinkText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F766E' },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 64, paddingBottom: 32 },
  header: { alignItems: 'center', marginBottom: 24 },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    color: '#D1FAE5',
    textAlign: 'center',
    lineHeight: 22,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#D1FAE5',
    lineHeight: 20,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  highlightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  highlightText: { flex: 1 },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  highlightBody: { fontSize: 13, color: '#4B5563', lineHeight: 18 },
  note: {
    color: '#D1FAE5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#0F766E', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  secondaryButton: { marginTop: 4, alignItems: 'center', padding: 12 },
  secondaryButtonText: { color: '#D1FAE5', fontSize: 14 },
  signOutFooter: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: '#0F766E',
  },
  label: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#0F172A',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  choiceRowSelected: { backgroundColor: '#ECFDF5' },
  choiceLabel: { color: '#0F172A', fontSize: 15 },
  choiceLabelSelected: { color: '#0F766E', fontWeight: '600' },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  backLinkText: { color: '#D1FAE5', fontSize: 14, marginLeft: 4 },
  skipButton: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  skipButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  connectRow: { flexDirection: 'row', alignItems: 'flex-start' },
  connectIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  connectBody: {
    flex: 1,
    color: '#0F172A',
    fontSize: 14,
    lineHeight: 20,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  indicatorItem: { alignItems: 'center', flex: 1 },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: 6,
  },
  indicatorDotActive: { backgroundColor: '#fff', width: 10, height: 10, borderRadius: 5 },
  indicatorDotDone: { backgroundColor: '#A7F3D0' },
  indicatorLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  indicatorLabelActive: { color: '#fff', fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorIconWrap: { marginRight: 10, marginTop: 2 },
  errorTextWrap: { flex: 1 },
  errorTitle: {
    color: '#7F1D1D',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  errorMessage: { color: '#991B1B', fontSize: 13, lineHeight: 18 },
  reconnectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reconnectingText: {
    color: '#7F1D1D',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
});
