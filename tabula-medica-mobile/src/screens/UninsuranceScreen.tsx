/**
 * UninsuranceScreen.tsx
 * Tabula Medica — Uninsurance Mode
 *
 * Main patient-facing screen for the Uninsurance service mode.
 * Handles: HRSA clinic finder, Medicare rate lookup, provider booking,
 * payment lane selection (Lane A = InstaMed, Lane B = VA CCN),
 * and AaNeel Health Access Card NFC status display.
 *
 * Drop into: src/screens/UninsuranceScreen.tsx
 * Add to your bottom tab navigator or as a deep-link route.
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  SafeAreaView,
} from 'react-native';
import { findClinics, HRSAClinic } from '../services/hrsa.service';
import { getMedicareRate, MEDICARE_RATES, MedicareRate } from '../services/medicareRates.service';
import { useAuth } from '../hooks/useAuth'; // your existing auth hook

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentLane = 'A_INSTAMED' | 'B_VA_CCN';

export interface UninsuranceBooking {
  providerId: string;
  providerName: string;
  providerAddress: string;
  cptCode: string;
  serviceName: string;
  medicareRate: number;
  paymentLane: PaymentLane;
  vaReferralNumber?: string;
  patientId: string;
  scheduledDate: string;
}

// ─── Colour tokens (matches your existing design system) ─────────────────────

const C = {
  teal: '#0d9e8a',
  teal2: '#14c4ad',
  amber: '#f59e0b',
  amber2: '#fbbf24',
  night: '#040d1a',
  deep: '#071428',
  paper: '#f8f7f4',
  ink: '#0f1923',
  mid: '#4a5568',
  muted: '#8fa3b8',
  border: '#e2dfd8',
  success: '#15803d',
  successBg: '#dcfce7',
  white: '#ffffff',
  redLight: '#ffe4e6',
  red: '#e11d48',
  skyBg: '#e0f2fe',
  sky: '#0284c7',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ModeToggle: React.FC<{
  lane: PaymentLane;
  onToggle: (lane: PaymentLane) => void;
}> = ({ lane, onToggle }) => (
  <View style={styles.modeToggle}>
    <TouchableOpacity
      style={[styles.modeBtn, lane === 'A_INSTAMED' && styles.modeBtnActive]}
      onPress={() => onToggle('A_INSTAMED')}
    >
      <Text style={[styles.modeBtnText, lane === 'A_INSTAMED' && styles.modeBtnTextActive]}>
        Lane A — Self-Pay
      </Text>
      <Text style={[styles.modeBtnSub, lane === 'A_INSTAMED' && { color: C.teal2 }]}>
        Pay at point of care · 24hr ACH
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      style={[styles.modeBtn, lane === 'B_VA_CCN' && styles.modeBtnActiveVA]}
      onPress={() => onToggle('B_VA_CCN')}
    >
      <Text style={[styles.modeBtnText, lane === 'B_VA_CCN' && styles.modeBtnTextVA]}>
        Lane B — VA Veteran
      </Text>
      <Text style={[styles.modeBtnSub, lane === 'B_VA_CCN' && { color: C.amber2 }]}>
        VA pays via Optum CCN · $0 to you
      </Text>
    </TouchableOpacity>
  </View>
);

const RateCard: React.FC<{ rate: MedicareRate; onSelect: (r: MedicareRate) => void }> = ({
  rate,
  onSelect,
}) => (
  <TouchableOpacity style={styles.rateCard} onPress={() => onSelect(rate)}>
    <View style={styles.rateCardLeft}>
      <Text style={styles.rateServiceName}>{rate.serviceName}</Text>
      <Text style={styles.rateCPT}>{rate.cptCode}</Text>
    </View>
    <View style={styles.rateCardRight}>
      <Text style={styles.rateMarket}>${rate.typicalMarket.toLocaleString()}</Text>
      <Text style={styles.rateMedicare}>${rate.medicareRate2026.toFixed(2)}</Text>
      <View style={styles.saveBadge}>
        <Text style={styles.saveBadgeText}>
          save {Math.round((1 - rate.medicareRate2026 / rate.typicalMarket) * 100)}%
        </Text>
      </View>
    </View>
  </TouchableOpacity>
);

const ClinicCard: React.FC<{ clinic: HRSAClinic; onBook: (c: HRSAClinic) => void }> = ({
  clinic,
  onBook,
}) => (
  <View style={styles.clinicCard}>
    <View style={styles.clinicLeft}>
      <Text style={styles.clinicName}>{clinic.name}</Text>
      <Text style={styles.clinicAddr}>{clinic.address}</Text>
      {clinic.acceptsUninsured && (
        <View style={styles.clinicBadge}>
          <Text style={styles.clinicBadgeText}>✓ Sliding Scale</Text>
        </View>
      )}
      {clinic.languages && clinic.languages.length > 0 && (
        <Text style={styles.clinicLanguages}>🌐 {clinic.languages.slice(0, 3).join(' · ')}</Text>
      )}
    </View>
    <View style={styles.clinicRight}>
      {clinic.distanceMiles != null && (
        <Text style={styles.clinicDist}>{clinic.distanceMiles.toFixed(1)} mi</Text>
      )}
      <TouchableOpacity style={styles.bookBtn} onPress={() => onBook(clinic)}>
        <Text style={styles.bookBtnText}>Book →</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const VARefInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <View style={styles.vaRefContainer}>
    <Text style={styles.vaRefLabel}>VA Referral / Authorization Number</Text>
    <Text style={styles.vaRefHint}>
      From your Optum CCN authorization letter. Required for VA billing.
    </Text>
    <TextInput
      style={styles.vaRefInput}
      value={value}
      onChangeText={onChange}
      placeholder="e.g. 2026-CCN1-XXXXXXXX"
      placeholderTextColor={C.muted}
      autoCapitalize="characters"
      returnKeyType="done"
      onSubmitEditing={Keyboard.dismiss}
    />
    {value.length > 0 && value.length < 8 && (
      <Text style={styles.vaRefWarning}>Referral numbers are typically 18+ characters</Text>
    )}
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const UninsuranceScreen: React.FC = () => {
  const { user } = useAuth();

  // Lane selection
  const [lane, setLane] = useState<PaymentLane>('A_INSTAMED');
  const [vaReferralNumber, setVAReferralNumber] = useState('');

  // Clinic finder
  const [zipInput, setZipInput] = useState('');
  const [clinics, setClinics] = useState<HRSAClinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [clinicsError, setClinicsError] = useState<string | null>(null);

  // Rate selection
  const [selectedRate, setSelectedRate] = useState<MedicareRate | null>(null);

  // Booking state
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'rates' | 'clinics'>('rates');

  const zipRef = useRef<TextInput>(null);

  const handleZipSearch = useCallback(async () => {
    const zip = zipInput.trim();
    if (zip.length !== 5 || !/^\d{5}$/.test(zip)) {
      Alert.alert('Invalid ZIP', 'Please enter a valid 5-digit ZIP code.');
      return;
    }
    Keyboard.dismiss();
    setClinicsLoading(true);
    setClinicsError(null);
    setClinics([]);
    try {
      const results = await findClinics(zip, 25);
      if (results.length === 0) {
        setClinicsError('No HRSA clinics found within 25 miles. Try a nearby ZIP code.');
      } else {
        setClinics(results);
      }
    } catch (err) {
      setClinicsError('Could not reach the HRSA database. Please check your connection.');
    } finally {
      setClinicsLoading(false);
    }
  }, [zipInput]);

  const handleSelectRate = useCallback((rate: MedicareRate) => {
    setSelectedRate(rate);
    setActiveTab('clinics');
  }, []);

  const handleBookClinic = useCallback(
    (clinic: HRSAClinic) => {
      if (!selectedRate) {
        Alert.alert('Select a Service', 'Please select the service you need from the Rates tab first.');
        return;
      }

      if (lane === 'B_VA_CCN' && vaReferralNumber.trim().length < 8) {
        Alert.alert(
          'VA Referral Required',
          'Please enter your VA referral/authorization number before booking on Lane B.',
        );
        return;
      }

      const booking: UninsuranceBooking = {
        providerId: clinic.id,
        providerName: clinic.name,
        providerAddress: clinic.address,
        cptCode: selectedRate.cptCode,
        serviceName: selectedRate.serviceName,
        medicareRate: selectedRate.medicareRate2026,
        paymentLane: lane,
        vaReferralNumber: lane === 'B_VA_CCN' ? vaReferralNumber.trim() : undefined,
        patientId: user?.id ?? '',
        scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      };

      const rateDisplay =
        lane === 'B_VA_CCN'
          ? '$0 to you — VA pays via Optum CCN'
          : `$${selectedRate.medicareRate2026.toFixed(2)} at point of care`;

      Alert.alert(
        'Confirm Booking',
        `${clinic.name}\n\n${selectedRate.serviceName} (${selectedRate.cptCode})\nRate: ${rateDisplay}\n\nProceed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Book Now',
            onPress: () => confirmBooking(booking),
          },
        ],
      );
    },
    [selectedRate, lane, vaReferralNumber, user],
  );

  const confirmBooking = useCallback(async (booking: UninsuranceBooking) => {
    setBookingInProgress(true);
    try {
      // This is where you call your booking API
      // The encounter write-back to Google Healthcare API happens
      // server-side after the visit via encounterWriteback.service.ts
      //
      // Example:
      // await createBooking(booking); // your API call
      //
      // For now, simulate network latency
      await new Promise((r) => setTimeout(r, 1200));

      Alert.alert(
        'Booking Confirmed ✓',
        `Your appointment at ${booking.providerName} is confirmed.\n\nYou'll receive a confirmation email from Mailgun shortly.\n\n${booking.paymentLane === 'B_VA_CCN' ? 'Your VA referral number has been recorded. Present your Uninsurance Health Access Card at check-in.' : 'Payment of $' + booking.medicareRate.toFixed(2) + ' will be collected at point of care via InstaMed.'}`,
        [{ text: 'Done' }],
      );
    } catch {
      Alert.alert('Booking Failed', 'Could not complete booking. Please try again or call the clinic directly.');
    } finally {
      setBookingInProgress(false);
    }
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>⚡ Uninsurance Mode</Text>
            </View>
            <Text style={styles.headerTitle}>Medicare Rate Care</Text>
            <Text style={styles.headerSub}>
              Published 2026 rates · No surprise bills · AaNeel card accepted
            </Text>
          </View>

          {/* Payment Lane Toggle */}
          <ModeToggle lane={lane} onToggle={setLane} />

          {/* VA Referral input (Lane B only) */}
          {lane === 'B_VA_CCN' && (
            <VARefInput value={vaReferralNumber} onChange={setVAReferralNumber} />
          )}

          {/* Tab bar */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'rates' && styles.tabActive]}
              onPress={() => setActiveTab('rates')}
            >
              <Text style={[styles.tabText, activeTab === 'rates' && styles.tabTextActive]}>
                💰 Rates
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'clinics' && styles.tabActive]}
              onPress={() => setActiveTab('clinics')}
            >
              <Text style={[styles.tabText, activeTab === 'clinics' && styles.tabTextActive]}>
                🏥 Find Clinics
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Rates Tab ── */}
          {activeTab === 'rates' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionLabel}>
                Medicare 2026 Published Fee Schedule
              </Text>
              <Text style={styles.sectionSub}>
                Tap a service to find providers and book at that rate.
              </Text>
              {MEDICARE_RATES.map((rate) => (
                <RateCard
                  key={rate.cptCode}
                  rate={rate}
                  onSelect={handleSelectRate}
                />
              ))}
              <Text style={styles.rateDisclaimer}>
                * CMS PFS/CLFS 2026. Rates subject to GPCI geographic adjustment.
                Actual rate displayed before service.
              </Text>
            </View>
          )}

          {/* ── Clinics Tab ── */}
          {activeTab === 'clinics' && (
            <View style={styles.tabContent}>
              {selectedRate && (
                <View style={styles.selectedRateBanner}>
                  <Text style={styles.srbLabel}>Selected service</Text>
                  <Text style={styles.srbName}>{selectedRate.serviceName}</Text>
                  <Text style={styles.srbRate}>
                    ${selectedRate.medicareRate2026.toFixed(2)}{' '}
                    <Text style={styles.srbCPT}>({selectedRate.cptCode})</Text>
                  </Text>
                </View>
              )}

              <Text style={styles.sectionLabel}>Find Providers Near You</Text>
              <Text style={styles.sectionSub}>
                Search HRSA-registered FQHCs and clinics. All accept uninsured patients.
              </Text>

              {/* ZIP search */}
              <View style={styles.zipRow}>
                <TextInput
                  ref={zipRef}
                  style={styles.zipInput}
                  value={zipInput}
                  onChangeText={(v) => setZipInput(v.replace(/\D/g, '').slice(0, 5))}
                  placeholder="Enter ZIP code"
                  placeholderTextColor={C.muted}
                  keyboardType="number-pad"
                  returnKeyType="search"
                  onSubmitEditing={handleZipSearch}
                  maxLength={5}
                />
                <TouchableOpacity
                  style={[styles.searchBtn, clinicsLoading && styles.searchBtnDisabled]}
                  onPress={handleZipSearch}
                  disabled={clinicsLoading}
                >
                  {clinicsLoading ? (
                    <ActivityIndicator color={C.white} size="small" />
                  ) : (
                    <Text style={styles.searchBtnText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Results */}
              {clinicsError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{clinicsError}</Text>
                </View>
              )}

              {clinics.map((clinic) => (
                <ClinicCard key={clinic.id} clinic={clinic} onBook={handleBookClinic} />
              ))}

              {clinics.length === 0 && !clinicsLoading && !clinicsError && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyTitle}>Enter your ZIP to find clinics</Text>
                  <Text style={styles.emptySub}>
                    We search 1,400+ HRSA-registered FQHCs nationwide. All accept
                    uninsured patients on a sliding-fee scale.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* AaNeel card footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.cfIcon}>📡</Text>
            <View style={styles.cfBody}>
              <Text style={styles.cfTitle}>Uninsurance Health Access Card</Text>
              <Text style={styles.cfSub}>
                Tap your NFC card at any enrolled provider to transfer records and
                confirm your Medicare rate automatically. Powered by AaNeel Connect.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Full-screen booking overlay */}
      {bookingInProgress && (
        <View style={styles.bookingOverlay}>
          <ActivityIndicator color={C.teal2} size="large" />
          <Text style={styles.bookingOverlayText}>Confirming your booking…</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.paper },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: { backgroundColor: C.night, padding: 24, paddingTop: 20 },
  headerBadge: {
    backgroundColor: 'rgba(13,158,138,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(13,158,138,0.3)',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  headerBadgeText: { fontSize: 11, fontWeight: '700', color: C.teal2, letterSpacing: 0.5 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.white, letterSpacing: -0.5, marginBottom: 6 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 18 },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  modeBtn: { flex: 1, padding: 14, alignItems: 'center' },
  modeBtnActive: { backgroundColor: 'rgba(13,158,138,0.08)' },
  modeBtnActiveVA: { backgroundColor: 'rgba(245,158,11,0.08)' },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: C.mid, marginBottom: 3 },
  modeBtnTextActive: { color: C.teal },
  modeBtnTextVA: { color: C.amber },
  modeBtnSub: { fontSize: 10, color: C.muted, textAlign: 'center' },

  // VA referral
  vaRefContainer: {
    marginHorizontal: 16,
    backgroundColor: 'rgba(245,158,11,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  vaRefLabel: { fontSize: 13, fontWeight: '700', color: C.amber, marginBottom: 3 },
  vaRefHint: { fontSize: 11, color: C.mid, marginBottom: 10, lineHeight: 15 },
  vaRefInput: {
    backgroundColor: C.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    padding: 10,
    fontSize: 14,
    color: C.ink,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  vaRefWarning: { fontSize: 11, color: C.red, marginTop: 6 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: C.teal },
  tabText: { fontSize: 13, fontWeight: '600', color: C.mid },
  tabTextActive: { color: C.white },
  tabContent: { paddingHorizontal: 16 },

  // Section labels
  sectionLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  sectionSub: { fontSize: 12, color: C.mid, marginBottom: 14, lineHeight: 17 },

  // Rate cards
  rateCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateCardLeft: { flex: 1 },
  rateServiceName: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 3 },
  rateCPT: { fontSize: 11, color: C.muted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  rateCardRight: { alignItems: 'flex-end' },
  rateMarket: { fontSize: 11, color: C.muted, textDecorationLine: 'line-through', marginBottom: 1 },
  rateMedicare: { fontSize: 17, fontWeight: '800', color: C.teal, marginBottom: 4 },
  saveBadge: { backgroundColor: C.successBg, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  saveBadgeText: { fontSize: 10, fontWeight: '700', color: C.success },
  rateDisclaimer: { fontSize: 10, color: C.muted, marginTop: 8, marginBottom: 16, lineHeight: 14 },

  // Selected rate banner
  selectedRateBanner: {
    backgroundColor: 'rgba(13,158,138,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13,158,138,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  srbLabel: { fontSize: 10, color: C.teal, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 },
  srbName: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  srbRate: { fontSize: 15, fontWeight: '800', color: C.teal },
  srbCPT: { fontSize: 11, color: C.muted, fontWeight: '400' },

  // ZIP search
  zipRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  zipInput: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    fontSize: 15,
    color: C.ink,
  },
  searchBtn: { backgroundColor: C.teal, borderRadius: 10, paddingHorizontal: 20, justifyContent: 'center' },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: C.white, fontWeight: '700', fontSize: 14 },

  // Error
  errorBox: { backgroundColor: C.redLight, borderRadius: 10, padding: 14, marginBottom: 12 },
  errorText: { fontSize: 13, color: C.red, lineHeight: 18 },

  // Clinic cards
  clinicCard: {
    backgroundColor: C.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  clinicLeft: { flex: 1, marginRight: 12 },
  clinicName: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 3 },
  clinicAddr: { fontSize: 11, color: C.muted, marginBottom: 6, lineHeight: 15 },
  clinicBadge: { backgroundColor: C.successBg, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 4 },
  clinicBadgeText: { fontSize: 10, fontWeight: '700', color: C.success },
  clinicLanguages: { fontSize: 10, color: C.sky },
  clinicRight: { alignItems: 'flex-end' },
  clinicDist: { fontSize: 12, fontWeight: '700', color: C.teal, marginBottom: 8 },
  bookBtn: { backgroundColor: C.teal, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  bookBtnText: { color: C.white, fontWeight: '700', fontSize: 12 },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontSize: 13, color: C.mid, textAlign: 'center', lineHeight: 19 },

  // AaNeel footer
  cardFooter: {
    flexDirection: 'row',
    backgroundColor: C.night,
    margin: 16,
    borderRadius: 14,
    padding: 16,
    alignItems: 'flex-start',
    gap: 12,
  },
  cfIcon: { fontSize: 24 },
  cfBody: { flex: 1 },
  cfTitle: { fontSize: 13, fontWeight: '700', color: C.teal2, marginBottom: 4 },
  cfSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 16 },

  // Booking overlay
  bookingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,13,26,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  bookingOverlayText: { color: C.white, fontSize: 15, fontWeight: '600' },
});

export default UninsuranceScreen;
