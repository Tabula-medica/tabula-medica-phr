/**
 * VAVerificationScreen.tsx
 * Tabula Medica — VA Community Care Referral Verification (Lane B)
 *
 * Captures the veteran's VA CCN referral number and date of birth,
 * verifies the referral against Optum's EDI gateway, and shows the
 * authorized services. Used before booking when Lane B is selected.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  verifyVAReferral,
  type VAReferral,
  type ReferralVerifyResponse,
} from '../services/optumEdi.service';

const C = {
  teal: '#0d9e8a',
  teal2: '#14c4ad',
  amber: '#f59e0b',
  amber2: '#fbbf24',
  amberBg: 'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(245,158,11,0.25)',
  night: '#040d1a',
  paper: '#f8f7f4',
  ink: '#0f1923',
  mid: '#4a5568',
  muted: '#8fa3b8',
  border: '#e2dfd8',
  white: '#ffffff',
  success: '#15803d',
  successBg: '#dcfce7',
  red: '#e11d48',
  redLight: '#ffe4e6',
  skyBg: '#e0f2fe',
  sky: '#0284c7',
};

interface VAVerificationScreenProps {
  navigation?: any;
  route?: {
    params?: {
      referralNumber?: string;
    };
  };
}

const VAVerificationScreen: React.FC<VAVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const [referralNumber, setReferralNumber] = useState(
    route?.params?.referralNumber ?? '',
  );
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReferralVerifyResponse | null>(null);
  const [referral, setReferral] = useState<VAReferral | null>(null);

  const handleVerify = useCallback(async () => {
    if (!referralNumber.trim()) {
      Alert.alert('Enter Referral Number', 'Please enter your VA Community Care referral number.');
      return;
    }
    if (!dob.trim()) {
      Alert.alert('Enter Date of Birth', 'Please enter your date of birth for verification.');
      return;
    }

    setLoading(true);
    setResult(null);
    setReferral(null);

    try {
      const response = await verifyVAReferral(referralNumber.trim(), dob.trim());
      setResult(response);
      if (response.valid && response.referral) {
        setReferral(response.referral);
      }
    } catch {
      setResult({
        valid: false,
        errorMessage: 'Unable to verify referral at this time. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, [referralNumber, dob]);

  const handleProceed = useCallback(() => {
    if (referral && navigation) {
      navigation.navigate('Booking', {
        vaReferral: referral,
        paymentLane: 'B_VA_CCN',
      });
    }
  }, [referral, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🎖️</Text>
          <Text style={styles.title}>VA Community Care</Text>
          <Text style={styles.subtitle}>
            Verify your VA referral to book at $0 cost through the Optum CCN network
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>How it works</Text>
          <Text style={styles.infoText}>
            1. Your VA care coordinator issues a Community Care referral{'\n'}
            2. Enter the referral number below to verify it's active{'\n'}
            3. Book with any Uninsurance network provider{'\n'}
            4. VA pays the provider directly through Optum — $0 to you
          </Text>
        </View>

        <Text style={styles.fieldLabel}>VA Referral Number</Text>
        <TextInput
          style={styles.input}
          value={referralNumber}
          onChangeText={setReferralNumber}
          placeholder="e.g. CCN-2026-123456"
          placeholderTextColor={C.muted}
          autoCapitalize="characters"
          data-testid="input-referral-number"
        />

        <Text style={styles.fieldLabel}>Date of Birth</Text>
        <TextInput
          style={styles.input}
          value={dob}
          onChangeText={setDob}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={C.muted}
          keyboardType="numbers-and-punctuation"
          data-testid="input-dob"
        />

        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={loading}
          data-testid="button-verify"
        >
          {loading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.verifyBtnText}>Verify Referral</Text>
          )}
        </TouchableOpacity>

        {result && result.valid && referral && (
          <View style={styles.successBox}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Referral Verified</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Veteran</Text>
              <Text style={styles.detailValue}>{referral.veteranName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Referral #</Text>
              <Text style={styles.detailValue}>{referral.referralNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>VA Facility</Text>
              <Text style={styles.detailValue}>{referral.issuingVAFacility}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Expires</Text>
              <Text style={styles.detailValue}>{referral.expirationDate}</Text>
            </View>

            {referral.authorizedServices.length > 0 && (
              <View style={styles.servicesBox}>
                <Text style={styles.servicesTitle}>Authorized Services</Text>
                {referral.authorizedServices.map((svc, idx) => (
                  <Text key={idx} style={styles.serviceItem}>
                    • {svc}
                  </Text>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.proceedBtn}
              onPress={handleProceed}
              data-testid="button-proceed"
            >
              <Text style={styles.proceedBtnText}>
                Book Appointment — $0 Cost
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {result && !result.valid && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>
              {result.expired ? '⏰' : '❌'}
            </Text>
            <Text style={styles.errorTitle}>
              {result.expired ? 'Referral Expired' : 'Verification Failed'}
            </Text>
            <Text style={styles.errorText}>{result.errorMessage}</Text>

            <View style={styles.helpBox}>
              <Text style={styles.helpTitle}>Need help?</Text>
              <Text style={styles.helpText}>
                • Call the VA Health Benefits Hotline: 1-877-222-8387{'\n'}
                • Contact your VA care coordinator for a new referral{'\n'}
                • Visit va.gov/community-care for more information
              </Text>
            </View>
          </View>
        )}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Tabula Medica verifies VA Community Care referrals through the
            Optum CCN (Payer ID: VACCN) EDI gateway. Your referral information
            is transmitted securely and used only for appointment authorization.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  scroll: { padding: 16, paddingBottom: 60 },
  header: { alignItems: 'center', marginBottom: 20 },
  headerIcon: { fontSize: 36, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  subtitle: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  infoBox: {
    backgroundColor: C.amberBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.amberBorder,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#b45309', marginBottom: 8 },
  infoText: { fontSize: 12, color: '#92400e', lineHeight: 20 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.ink,
    marginBottom: 6,
  },
  input: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C.ink,
    marginBottom: 14,
  },
  verifyBtn: {
    backgroundColor: C.amber,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyBtnDisabled: { opacity: 0.5 },
  verifyBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  successBox: {
    backgroundColor: C.successBg,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: { fontSize: 32, marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '800', color: C.success, marginBottom: 16 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(21,128,61,0.15)',
  },
  detailLabel: { fontSize: 12, color: C.mid },
  detailValue: { fontSize: 12, fontWeight: '600', color: C.ink },
  servicesBox: { width: '100%', marginTop: 14 },
  servicesTitle: { fontSize: 13, fontWeight: '700', color: C.success, marginBottom: 6 },
  serviceItem: { fontSize: 12, color: C.ink, lineHeight: 20, marginLeft: 4 },
  proceedBtn: {
    backgroundColor: C.success,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  proceedBtnText: { color: C.white, fontSize: 15, fontWeight: '800' },
  errorBox: {
    backgroundColor: C.redLight,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIcon: { fontSize: 32, marginBottom: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: C.red, marginBottom: 8 },
  errorText: { fontSize: 13, color: '#9f1239', textAlign: 'center', lineHeight: 19 },
  helpBox: {
    backgroundColor: C.white,
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    width: '100%',
  },
  helpTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 6 },
  helpText: { fontSize: 12, color: C.mid, lineHeight: 20 },
  disclaimer: { marginTop: 8 },
  disclaimerText: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 15,
  },
});

export default VAVerificationScreen;
