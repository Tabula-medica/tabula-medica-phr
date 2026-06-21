import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';

export default function VerifyEmailScreen() {
  const { user, logout, resendVerificationEmail, refreshVerificationStatus } =
    useAuth();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  async function handleResend() {
    setIsResending(true);
    try {
      const sent = await resendVerificationEmail();
      Alert.alert(
        sent ? 'Verification email sent' : 'Unable to send email',
        sent
          ? `We sent a new verification link to ${user?.email ?? 'your email'}.`
          : 'No signed-in user to send a verification email to.'
      );
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      const message =
        code === 'auth/too-many-requests'
          ? 'Too many requests. Please wait a few minutes before trying again.'
          : error instanceof Error
          ? error.message
          : 'Unable to send verification email.';
      Alert.alert('Unable to send email', message);
    } finally {
      setIsResending(false);
    }
  }

  async function handleCheck() {
    setIsChecking(true);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified) {
        Alert.alert(
          'Still not verified',
          'We did not detect a verified email yet. Please open the link in your inbox, then try again.'
        );
      }
      // When verified is true the AuthProvider state update will swap the
      // navigator over to the MainNavigator automatically.
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to refresh status.';
      Alert.alert('Unable to refresh', message);
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // logout is best-effort; ignore.
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Feather name="mail" size={40} color="#0F766E" />
        </View>
        <Text style={styles.title} testID="text-verify-title">
          Check your email
        </Text>
        <Text style={styles.body}>
          We sent a verification link to{' '}
          <Text style={styles.email} testID="text-verify-email">
            {user?.email || 'your email address'}
          </Text>
          . Open it on this device to confirm your account before viewing your
          health records.
        </Text>
        <Text style={styles.smallBody}>
          Your dashboard stays locked until your email is verified so your
          records can be linked to the right account.
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, isChecking && styles.buttonDisabled]}
          onPress={handleCheck}
          disabled={isChecking}
          testID="button-check-verification"
        >
          {isChecking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              I&apos;ve verified my email
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, isResending && styles.buttonDisabled]}
          onPress={handleResend}
          disabled={isResending}
          testID="button-resend-verification"
        >
          {isResending ? (
            <ActivityIndicator color="#0F766E" />
          ) : (
            <Text style={styles.secondaryButtonText}>
              Resend verification email
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={handleSignOut}
          testID="button-signout"
        >
          <Text style={styles.linkText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F766E',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  email: { fontWeight: '600', color: '#0F766E' },
  smallBody: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#0F766E',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#fff',
    borderColor: '#0F766E',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: '#0F766E', fontSize: 16, fontWeight: '500' },
  buttonDisabled: { opacity: 0.7 },
  linkButton: { marginTop: 16, alignItems: 'center', padding: 8 },
  linkText: { color: '#6B7280', fontSize: 14 },
});
