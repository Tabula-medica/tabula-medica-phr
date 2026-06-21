/**
 * BookingScreen.tsx
 * Tabula Medica — Appointment Booking + Payment Lane Selection
 *
 * Final step before the GFE modal. Patient selects:
 *   1. Service (from Medicare rate table)
 *   2. Payment lane (A: InstaMed self-pay, B: VA CCN)
 *   3. Preferred date/time
 *
 * On "Book Appointment", generates a GFE and opens GFEModal.
 * After patient acknowledges GFE, booking is confirmed.
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
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { HRSAClinic } from '../services/hrsa.service';
import { MEDICARE_RATES, getMedicareRate, type MedicareRate } from '../services/medicareRates.service';
import { generateGFE, type GoodFaithEstimate } from '../services/goodFaithEstimate.service';
import { initiatePayment } from '../services/instamed.service';
import PaymentLaneSelector, { type PaymentLane } from '../components/PaymentLaneSelector';
import MedicareRateCard from '../components/MedicareRateCard';
import GFEModal from '../components/GFEModal';

const C = {
  teal: '#0d9e8a',
  teal2: '#14c4ad',
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
};

interface BookingScreenProps {
  navigation?: any;
  route?: {
    params?: {
      clinic?: HRSAClinic;
      selectedRate?: MedicareRate;
    };
  };
}

const BookingScreen: React.FC<BookingScreenProps> = ({ navigation, route }) => {
  const clinic = route?.params?.clinic;
  const preselectedRate = route?.params?.selectedRate;

  const [selectedRate, setSelectedRate] = useState<MedicareRate | null>(
    preselectedRate ?? null,
  );
  const [paymentLane, setPaymentLane] = useState<PaymentLane>('A_INSTAMED');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [vaReferral, setVaReferral] = useState('');
  const [notes, setNotes] = useState('');
  const [gfe, setGfe] = useState<GoodFaithEstimate | null>(null);
  const [showGFE, setShowGFE] = useState(false);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const commonRates = MEDICARE_RATES.filter((r) =>
    ['99213', '99203', '99213-GT', '90834', 'G0439'].includes(r.cptCode),
  );

  const handleBookPress = useCallback(() => {
    if (!selectedRate) {
      Alert.alert('Select a Service', 'Please choose a service to book.');
      return;
    }
    if (!preferredDate) {
      Alert.alert('Select a Date', 'Please enter your preferred appointment date.');
      return;
    }
    if (paymentLane === 'B_VA_CCN' && !vaReferral.trim()) {
      Alert.alert(
        'VA Referral Required',
        'Please enter your VA Community Care referral number.',
      );
      return;
    }

    const estimate = generateGFE({
      patientId: 'current-patient',
      patientName: 'Patient',
      patientDOB: '1990-01-01',
      appointmentDate: preferredDate,
      providerName: clinic?.name ?? 'Provider',
      providerNPI: '0000000000',
      providerAddress: clinic
        ? `${clinic.address}, ${clinic.city}, ${clinic.state} ${clinic.zip}`
        : 'Address pending',
      providerPhone: clinic?.phone ?? undefined,
      primaryCPT: selectedRate.cptCode,
      primaryServiceName: selectedRate.serviceName,
      primaryRate: selectedRate.medicareRate2026,
      paymentLane,
    });

    setGfe(estimate);
    setShowGFE(true);
  }, [selectedRate, preferredDate, paymentLane, vaReferral, clinic]);

  const handleGFEAccept = useCallback(
    async (acceptedGfe: GoodFaithEstimate, adjustedRate?: number) => {
      setShowGFE(false);
      setBooking(true);

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setBooked(true);
      } catch {
        Alert.alert('Booking Failed', 'Please try again.');
      } finally {
        setBooking(false);
      }
    },
    [],
  );

  if (booked) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.confirmedWrap}>
          <Text style={styles.confirmedIcon}>✅</Text>
          <Text style={styles.confirmedTitle}>Appointment Booked</Text>
          <Text style={styles.confirmedSub}>
            {clinic?.name ?? 'Your provider'} — {selectedRate?.serviceName}
          </Text>
          <Text style={styles.confirmedDate}>
            {preferredDate} {preferredTime ? `at ${preferredTime}` : ''}
          </Text>
          {paymentLane === 'A_INSTAMED' && (
            <View style={styles.confirmedPrice}>
              <Text style={styles.confirmedPriceLabel}>Your price</Text>
              <Text style={styles.confirmedPriceAmount}>
                ${selectedRate?.medicareRate2026.toFixed(2)}
              </Text>
            </View>
          )}
          {paymentLane === 'B_VA_CCN' && (
            <View style={styles.confirmedVA}>
              <Text style={styles.confirmedVAText}>
                VA pays via Optum CCN — $0 to you
              </Text>
              <Text style={styles.confirmedVARef}>
                Referral: {vaReferral}
              </Text>
            </View>
          )}
          <Text style={styles.confirmedGFE}>
            GFE ID: {gfe?.gfeId} — saved for your records
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation?.goBack?.()}
            data-testid="button-done"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Book Appointment</Text>

        {clinic && (
          <View style={styles.clinicBox}>
            <Text style={styles.clinicName}>{clinic.name}</Text>
            <Text style={styles.clinicAddr}>
              {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Select Service</Text>
        {selectedRate ? (
          <View>
            <MedicareRateCard rate={selectedRate} compact />
            <TouchableOpacity
              onPress={() => setSelectedRate(null)}
              style={styles.changeBtn}
              data-testid="button-change-service"
            >
              <Text style={styles.changeBtnText}>Change service</Text>
            </TouchableOpacity>
          </View>
        ) : (
          commonRates.map((rate) => (
            <MedicareRateCard
              key={rate.cptCode}
              rate={rate}
              onSelect={setSelectedRate}
              compact
            />
          ))
        )}

        <Text style={styles.sectionTitle}>Payment</Text>
        <PaymentLaneSelector
          selectedLane={paymentLane}
          onSelect={setPaymentLane}
          medicareRate={selectedRate?.medicareRate2026}
        />

        {paymentLane === 'B_VA_CCN' && (
          <View style={styles.vaBox}>
            <Text style={styles.vaLabel}>VA Community Care Referral Number</Text>
            <TextInput
              style={styles.input}
              value={vaReferral}
              onChangeText={setVaReferral}
              placeholder="e.g. CCN-2026-123456"
              placeholderTextColor={C.muted}
              autoCapitalize="characters"
              data-testid="input-va-referral"
            />
            <TouchableOpacity
              style={styles.vaVerifyBtn}
              onPress={() => navigation?.navigate?.('VAVerification', { referralNumber: vaReferral })}
              data-testid="button-verify-referral"
            >
              <Text style={styles.vaVerifyBtnText}>Verify Referral</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionTitle}>Preferred Date & Time</Text>
        <View style={styles.dateRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={preferredDate}
            onChangeText={setPreferredDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={C.muted}
            data-testid="input-date"
          />
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={preferredTime}
            onChangeText={setPreferredTime}
            placeholder="e.g. 10:00 AM"
            placeholderTextColor={C.muted}
            data-testid="input-time"
          />
        </View>

        <Text style={styles.sectionTitle}>Notes for Provider (Optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Any symptoms, medications, or questions..."
          placeholderTextColor={C.muted}
          multiline
          numberOfLines={3}
          data-testid="input-notes"
        />

        <TouchableOpacity
          style={[styles.bookBtn, booking && styles.bookBtnDisabled]}
          onPress={handleBookPress}
          disabled={booking}
          data-testid="button-book"
        >
          {booking ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.bookBtnText}>
              Review Good Faith Estimate & Book
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legalNote}>
          By booking, you'll receive a Good Faith Estimate as required by the
          No Surprises Act. Your price is locked — no surprise bills.
        </Text>
      </ScrollView>

      <GFEModal
        visible={showGFE}
        gfe={gfe}
        onAccept={handleGFEAccept}
        onDecline={() => setShowGFE(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  scroll: { padding: 16, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 16 },
  clinicBox: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 20,
  },
  clinicName: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  clinicAddr: { fontSize: 12, color: C.muted, lineHeight: 17 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 10,
    marginTop: 8,
  },
  changeBtn: { alignSelf: 'flex-end', marginBottom: 12 },
  changeBtnText: { fontSize: 12, fontWeight: '600', color: C.teal },
  input: {
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    marginBottom: 10,
  },
  notesInput: { minHeight: 80, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: 10 },
  vaBox: { marginBottom: 8 },
  vaLabel: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 6 },
  vaVerifyBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: C.teal,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  vaVerifyBtnText: { fontSize: 12, fontWeight: '600', color: C.teal },
  bookBtn: {
    backgroundColor: C.teal,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: C.white, fontSize: 16, fontWeight: '800' },
  legalNote: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 15,
  },
  confirmedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  confirmedIcon: { fontSize: 48, marginBottom: 16 },
  confirmedTitle: { fontSize: 22, fontWeight: '800', color: C.ink, marginBottom: 8 },
  confirmedSub: { fontSize: 14, color: C.mid, marginBottom: 4, textAlign: 'center' },
  confirmedDate: { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 16 },
  confirmedPrice: {
    backgroundColor: C.successBg,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  confirmedPriceLabel: { fontSize: 12, color: C.success, marginBottom: 4 },
  confirmedPriceAmount: { fontSize: 28, fontWeight: '800', color: C.success },
  confirmedVA: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  confirmedVAText: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  confirmedVARef: { fontSize: 12, color: C.muted, marginTop: 4 },
  confirmedGFE: { fontSize: 11, color: C.muted, marginBottom: 24 },
  doneBtn: {
    backgroundColor: C.teal,
    borderRadius: 10,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  doneBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
});

export default BookingScreen;
