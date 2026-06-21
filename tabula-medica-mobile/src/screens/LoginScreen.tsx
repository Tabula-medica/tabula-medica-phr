import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import {
  checkBiometricSupport,
  sendPasswordReset,
  useGoogleSignIn,
  useAppleSignIn,
} from '../services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isResetVisible, setIsResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const { login, register, authenticateBiometric, isConfigured, applyAuthResult } = useAuth();
  const google = useGoogleSignIn();
  const apple = useAppleSignIn();

  useEffect(() => {
    checkBiometricSupport().then((r) => setBiometricAvailable(r.isSupported)).catch(() => {});
  }, []);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      if (isRegistering) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      const message =
        code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'Invalid email or password.'
          : code === 'auth/email-already-in-use'
          ? 'An account already exists for this email.'
          : code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : code === 'auth/network-request-failed'
          ? 'Network error. Check your connection and try again.'
          : error instanceof Error
          ? error.message
          : 'Sign-in failed';
      Alert.alert(isRegistering ? 'Sign-up Failed' : 'Login Failed', message);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      const result = await google.signIn();
      if (!result) {
        Alert.alert('Sign-in cancelled', 'Google sign-in did not complete.');
      } else {
        // Commit user + onboarding state immediately so the router can
        // send brand-new users to onboarding without waiting for the
        // background session lookup.
        applyAuthResult(result);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Google sign-in failed';
      Alert.alert('Google Sign-in Failed', message);
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setIsAppleLoading(true);
    try {
      const result = await apple.signIn();
      if (!result) {
        // User cancelled the native sheet or no identity token returned.
        return;
      }
      applyAuthResult(result);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code === 'ERR_REQUEST_CANCELED') return;
      const message = error instanceof Error ? error.message : 'Apple sign-in failed';
      Alert.alert('Apple Sign-in Failed', message);
    } finally {
      setIsAppleLoading(false);
    }
  }

  function openResetFlow() {
    setResetEmail(email);
    setIsResetVisible(true);
  }

  async function handleSendPasswordReset() {
    const trimmed = resetEmail.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setIsResetLoading(true);
    try {
      await sendPasswordReset(trimmed);
      Alert.alert(
        'Check your email',
        `If an account exists for ${trimmed}, a password reset link has been sent.`
      );
      setIsResetVisible(false);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      // Firebase returns auth/user-not-found for unknown emails. To avoid
      // leaking account existence, surface the same generic success message
      // as the success path. Other errors get an actionable message.
      if (code === 'auth/user-not-found') {
        Alert.alert(
          'Check your email',
          `If an account exists for ${trimmed}, a password reset link has been sent.`
        );
        setIsResetVisible(false);
        return;
      }
      const message =
        code === 'auth/invalid-email'
          ? 'That email address looks invalid. Please double-check it.'
          : code === 'auth/network-request-failed'
          ? 'Network error. Check your connection and try again.'
          : code === 'auth/too-many-requests'
          ? 'Too many attempts. Please wait a few minutes before trying again.'
          : error instanceof Error
          ? error.message
          : 'Could not send password reset email.';
      Alert.alert('Password Reset Failed', message);
    } finally {
      setIsResetLoading(false);
    }
  }

  async function handleBiometricLogin() {
    const success = await authenticateBiometric();
    if (success) {
      Alert.alert(
        'Info',
        'Biometric authentication successful. Please enter credentials to complete login.'
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Tabula Medica</Text>
          <Text style={styles.subtitle}>Your Health Records, Simplified</Text>
        </View>

        <View style={styles.form}>
          {!isConfigured && (
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>
                Sign-in is not configured for this build. Missing Firebase/GCIP env vars.
              </Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!isLoading && isConfigured}
            testID="input-email"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={isRegistering ? 'new-password' : 'password'}
            editable={!isLoading && isConfigured}
            testID="input-password"
          />

          <TouchableOpacity
            style={[styles.button, (isLoading || !isConfigured) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading || !isConfigured}
            testID={isRegistering ? 'button-signup' : 'button-login'}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isRegistering ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          {(google.ready || apple.ready) && (
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {google.ready && (
            <TouchableOpacity
              style={[
                styles.googleButton,
                (isGoogleLoading || isLoading || isAppleLoading || !isConfigured) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading || isAppleLoading || !isConfigured}
              testID="button-google-signin"
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#0F766E" />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>
          )}

          {apple.ready && (
            <TouchableOpacity
              style={[
                styles.appleButton,
                (isAppleLoading || isLoading || isGoogleLoading || !isConfigured) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={isAppleLoading || isLoading || isGoogleLoading || !isConfigured}
              testID="button-apple-signin"
            >
              {isAppleLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.appleButtonText}>Continue with Apple</Text>
              )}
            </TouchableOpacity>
          )}

          {!isRegistering && (
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={openResetFlow}
              disabled={isLoading || !isConfigured}
              testID="button-forgot-password"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {isResetVisible && (
            <View style={styles.resetBox} testID="container-reset-password">
              <Text style={styles.resetTitle}>Reset your password</Text>
              <Text style={styles.resetSubtitle}>
                Enter the email for your account and we'll send a link to reset
                your password.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isResetLoading}
                testID="input-reset-email"
              />
              <TouchableOpacity
                style={[styles.button, isResetLoading && styles.buttonDisabled]}
                onPress={handleSendPasswordReset}
                disabled={isResetLoading}
                testID="button-send-reset"
              >
                {isResetLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send reset email</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setIsResetVisible(false)}
                disabled={isResetLoading}
                testID="button-cancel-reset"
              >
                <Text style={styles.toggleText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsRegistering((v) => !v)}
            disabled={isLoading}
            testID="button-toggle-mode"
          >
            <Text style={styles.toggleText}>
              {isRegistering
                ? 'Already have an account? Sign in'
                : "Don't have an account? Create one"}
            </Text>
          </TouchableOpacity>

          {biometricAvailable && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricLogin}
              testID="button-biometric"
            >
              <Text style={styles.biometricText}>Use Face ID / Touch ID</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>HIPAA Compliant | SOC2 Certified</Text>
          <Text style={styles.disclaimerText}>
            For informational purposes only. Not for clinical decision-making.
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F766E' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#D1FAE5' },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  warningText: { color: '#92400E', fontSize: 13 },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#111827',
  },
  button: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { marginHorizontal: 12, color: '#6B7280', fontSize: 12 },
  googleButton: {
    backgroundColor: '#fff',
    borderColor: '#D1D5DB',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  googleButtonText: { color: '#111827', fontSize: 16, fontWeight: '500' },
  appleButton: {
    backgroundColor: '#000',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  appleButtonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  toggleButton: { marginTop: 12, alignItems: 'center', padding: 8 },
  toggleText: { color: '#0F766E', fontSize: 14 },
  forgotButton: { marginTop: 12, alignItems: 'flex-end', paddingVertical: 4 },
  forgotText: { color: '#0F766E', fontSize: 14, fontWeight: '500' },
  resetBox: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  resetSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    marginBottom: 12,
  },
  biometricButton: { marginTop: 8, alignItems: 'center', padding: 12 },
  biometricText: { color: '#0F766E', fontSize: 14, fontWeight: '500' },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { color: '#D1FAE5', fontSize: 12 },
  disclaimerText: {
    color: '#9CA3AF',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
});
