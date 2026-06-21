/**
 * GFEModal.tsx
 * Tabula Medica — Good Faith Estimate Confirmation Modal
 *
 * Shown immediately when patient taps "Book" — BEFORE any payment is collected.
 * Federal law (No Surprises Act) requires the GFE be presented and acknowledged
 * before the appointment is confirmed.
 *
 * Features:
 * - Full GFE display with line items (primary + ancillary services)
 * - Dispute rights notice ($400 threshold clearly stated)
 * - HSA eligibility badge (2026 DPC safe harbor)
 * - TEFCA IAS data exchange consent toggle
 * - "Uninsured Identity Vault" — accepts passport/foreign ID
 * - Sliding scale calculator trigger (income-based discount)
 * - Patient must scroll to bottom + tap "I Understand" before proceeding
 *
 * Drop into: src/components/GFEModal.tsx
 * Used by: UninsuranceScreen.tsx → handleBookClinic()
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import {
  GoodFaithEstimate,
  GFESummary,
  getGFESummary,
  SlidingScaleResult,
  calculateSlidingScale,
} from '../services/goodFaithEstimate.service';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Colour tokens ───────────────────────────────────────────────────────────

const C = {
  teal: '#0d9e8a', teal2: '#14c4ad', tealBg: 'rgba(13,158,138,0.08)',
  tealBorder: 'rgba(13,158,138,0.25)',
  amber: '#f59e0b', amberBg: 'rgba(245,158,11,0.08)', amberBorder: 'rgba(245,158,11,0.25)',
  green: '#15803d', greenBg: '#dcfce7',
  red: '#e11d48', redBg: '#ffe4e6',
  sky: '#0284c7', skyBg: '#e0f2fe',
  violet: '#7c3aed', violetBg: '#ede9fe',
  night: '#040d1a', deep: '#071428',
  paper: '#f8f7f4', white: '#ffffff',
  ink: '#0f1923', mid: '#4a5568', muted: '#8fa3b8', border: '#e2dfd8',
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const ComplianceBadge: React.FC<{ text: string; color: string; bg: string }> = ({ text, color, bg }) => (
  <View style={[styles.badge, { backgroundColor: bg }]}>
    <Text style={[styles.badgeText, { color }]}>✓ {text}</Text>
  </View>
);

const LineItemRow: React.FC<{
  cpt: string;
  description: string;
  provider: string;
  role: 'primary' | 'ancillary' | 'facility';
  cost: number;
  icd10?: string;
}> = ({ cpt, description, provider, role, cost, icd10 }) => (
  <View style={styles.lineItem}>
    <View style={styles.lineItemLeft}>
      <View style={styles.lineItemTop}>
        <Text style={styles.lineItemCPT}>{cpt}</Text>
        {role === 'ancillary' && (
          <View style={styles.ancillaryTag}><Text style={styles.ancillaryTagText}>ancillary</Text></View>
        )}
      </View>
      <Text style={styles.lineItemDesc}>{description}</Text>
      <Text style={styles.lineItemProvider}>{provider}</Text>
      {icd10 && <Text style={styles.lineItemICD}>ICD-10: {icd10}</Text>}
    </View>
    <Text style={styles.lineItemCost}>${cost.toFixed(2)}</Text>
  </View>
);

const SlidingScaleWidget: React.FC<{
  baseRate: number;
  onApply: (result: SlidingScaleResult) => void;
}> = ({ baseRate, onApply }) => {
  const [income, setIncome] = useState('');
  const [household, setHousehold] = useState('1');
  const [result, setResult] = useState<SlidingScaleResult | null>(null);

  const calculate = () => {
    const annualIncome = parseFloat(income.replace(/,/g, ''));
    const householdSize = parseInt(household, 10);
    if (isNaN(annualIncome) || annualIncome < 0) {
      Alert.alert('Enter your annual income to calculate your discount.');
      return;
    }
    const r = calculateSlidingScale({ annualIncome, householdSize, baseRate });
    setResult(r);
    if (r.discountPercent > 0) onApply(r);
  };

  return (
    <View style={styles.slidingWrap}>
      <Text style={styles.slidingTitle}>📊 Income-Based Discount Calculator</Text>
      <Text style={styles.slidingHint}>
        Based on 2026 Federal Poverty Guidelines. Upload your 1040 or pay stub to auto-fill.
      </Text>
      <View style={styles.slidingRow}>
        <View style={styles.slidingField}>
          <Text style={styles.slidingLabel}>Annual income ($)</Text>
          <TextInput
            style={styles.slidingInput}
            value={income}
            onChangeText={setIncome}
            keyboardType="numeric"
            placeholder="e.g. 28000"
            placeholderTextColor={C.muted}
          />
        </View>
        <View style={[styles.slidingField, { flex: 0, width: 80 }]}>
          <Text style={styles.slidingLabel}>Household</Text>
          <TextInput
            style={styles.slidingInput}
            value={household}
            onChangeText={setHousehold}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={C.muted}
          />
        </View>
      </View>
      <TouchableOpacity style={styles.slidingBtn} onPress={calculate}>
        <Text style={styles.slidingBtnText}>Calculate My Rate</Text>
      </TouchableOpacity>
      {result && (
        <View style={[styles.slidingResult, result.discountPercent > 0 ? styles.slidingResultGood : styles.slidingResultFull]}>
          <Text style={styles.srFPL}>{result.fplPercent}% FPL</Text>
          {result.discountPercent > 0 ? (
            <>
              <Text style={styles.srSaving}>
                {result.discountPercent}% discount applied — ${result.adjustedRate.toFixed(2)}
              </Text>
              {result.qualifiesForFree && (
                <Text style={styles.srFree}>✓ You qualify for FREE care at nearby FQHCs</Text>
              )}
              {result.qualifiesForFQHC && !result.qualifiesForFree && (
                <Text style={styles.srFQHC}>✓ Eligible for FQHC sliding-scale care</Text>
              )}
            </>
          ) : (
            <Text style={styles.srFull}>Full rate applies — no discount at this income level</Text>
          )}
        </View>
      )}
    </View>
  );
};

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface GFEModalProps {
  visible: boolean;
  gfe: GoodFaithEstimate | null;
  onAccept: (gfe: GoodFaithEstimate, adjustedRate?: number) => void;
  onDecline: () => void;
}

const GFEModal: React.FC<GFEModalProps> = ({ visible, gfe, onAccept, onDecline }) => {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [tefcaConsent, setTefcaConsent] = useState(false);
  const [showSliding, setShowSliding] = useState(false);
  const [adjustedRate, setAdjustedRate] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
      if (isAtBottom && !hasScrolled) setHasScrolled(true);
    },
    [hasScrolled],
  );

  const handleAccept = useCallback(() => {
    if (!gfe) return;
    if (!understood) {
      Alert.alert('Please confirm', 'Scroll to the bottom and tap "I Understand" to continue.');
      return;
    }
    const finalGFE = tefcaConsent ? { ...gfe, tefcaIASEnabled: true } : gfe;
    onAccept(finalGFE, adjustedRate ?? undefined);
  }, [gfe, understood, tefcaConsent, adjustedRate, onAccept]);

  if (!gfe) return null;

  const summary = getGFESummary(gfe);
  const displayCost = adjustedRate ?? gfe.totalExpectedCost;
  const isVALane = gfe.paymentLane === 'B_VA_CCN';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onDecline}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Good Faith Estimate</Text>
            <Text style={styles.headerSub}>No Surprises Act — 2026 Compliant</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onDecline}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* GFE ID + compliance badges */}
        <View style={styles.gfeIdRow}>
          <Text style={styles.gfeId}>GFE ID: {summary.gfeId}</Text>
          <Text style={styles.gfeDate}>
            Issued: {new Date(summary.issuedAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.badgesRow}>
          {summary.complianceFlags.map((f) => (
            <ComplianceBadge key={f} text={f} color={C.teal} bg={C.tealBg} />
          ))}
          {isVALane && (
            <ComplianceBadge text="VA Community Care" color={C.amber} bg={C.amberBg} />
          )}
        </View>

        {/* Scrollable body */}
        <ScrollView
          ref={scrollRef}
          style={styles.body}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator={true}
        >

          {/* Price summary box */}
          <View style={[styles.priceBox, isVALane ? styles.priceBoxVA : styles.priceBoxCivilian]}>
            <Text style={styles.pbLabel}>
              {isVALane ? 'Your cost (VA pays the rest)' : 'Fixed price — no surprise bills'}
            </Text>
            <Text style={[styles.pbAmount, isVALane ? styles.pbAmountVA : styles.pbAmountCivilian]}>
              {isVALane ? '$0.00' : `$${displayCost.toFixed(2)}`}
            </Text>
            {!isVALane && (
              <Text style={styles.pbDispute}>
                If your final bill exceeds ${(displayCost + 400).toFixed(2)}, you can
                dispute it under federal law.
              </Text>
            )}
            {isVALane && (
              <Text style={styles.pbVANote}>
                VA pays via Optum CCN (Payer ID: VACCN) within 30 days.
                Your VA referral number is required at check-in.
              </Text>
            )}
          </View>

          {/* Provider info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Provider</Text>
            <Text style={styles.providerName}>{summary.providerName}</Text>
            <Text style={styles.providerNPI}>NPI: {gfe.primaryProviderNPI}</Text>
            <Text style={styles.providerAddr}>{gfe.primaryProviderAddress}</Text>
            {gfe.primaryProviderPhone && (
              <Text style={styles.providerPhone}>{gfe.primaryProviderPhone}</Text>
            )}
            <Text style={styles.conveningNote}>
              Convening Entity: {gfe.conveningEntity}
            </Text>
          </View>

          {/* Line items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Services ({gfe.lineItems.length})
            </Text>
            {gfe.lineItems.map((item, idx) => (
              <LineItemRow
                key={`${item.cptCode}-${idx}`}
                cpt={item.cptCode}
                description={item.serviceDescription}
                provider={item.providerName}
                role={item.providerRole}
                cost={item.expectedCost}
                icd10={item.icd10Code}
              />
            ))}
            <View style={styles.lineItemTotal}>
              <Text style={styles.litLabel}>Total Expected Cost</Text>
              <Text style={styles.litAmount}>${displayCost.toFixed(2)}</Text>
            </View>
          </View>

          {/* HSA notice */}
          {summary.hsaEligible && (
            <View style={styles.hsaBox}>
              <Text style={styles.hsaIcon}>💰</Text>
              <View style={styles.hsaBody}>
                <Text style={styles.hsaTitle}>HSA Eligible (2026)</Text>
                <Text style={styles.hsaText}>
                  This visit qualifies for HSA reimbursement under the 2026 DPC safe harbor
                  (Consolidated Appropriations Act). Pay from your HSA card at check-in.
                </Text>
              </View>
            </View>
          )}

          {/* Sliding scale trigger */}
          {!isVALane && (
            <TouchableOpacity
              style={styles.slidingTrigger}
              onPress={() => setShowSliding(!showSliding)}
            >
              <Text style={styles.slidingTriggerText}>
                {showSliding ? '▲ Hide' : '📊 Check income-based discount (1040 / pay stubs)'}
              </Text>
            </TouchableOpacity>
          )}
          {showSliding && !isVALane && (
            <SlidingScaleWidget
              baseRate={gfe.totalExpectedCost}
              onApply={(result) => {
                if (result.discountPercent > 0) {
                  setAdjustedRate(result.adjustedRate);
                }
              }}
            />
          )}

          {/* Uninsured identity vault notice */}
          {(gfe.patientPassportId || gfe.patientForeignId) && (
            <View style={styles.idVaultBox}>
              <Text style={styles.idVaultIcon}>🛂</Text>
              <View style={styles.idVaultBody}>
                <Text style={styles.idVaultTitle}>Uninsured Identity Vault</Text>
                <Text style={styles.idVaultText}>
                  Your {gfe.patientPassportId ? 'passport' : 'government-issued ID'} has
                  been securely stored and is accepted by this provider in lieu of a Social
                  Security Number. No SSN required to receive care.
                </Text>
              </View>
            </View>
          )}

          {/* TEFCA IAS consent */}
          <View style={styles.tefcaBox}>
            <View style={styles.tefcaLeft}>
              <Text style={styles.tefcaTitle}>📡 Share prior records with provider (TEFCA IAS)</Text>
              <Text style={styles.tefcaText}>
                Allow this provider to receive your previous health records from other
                clinics via TEFCA Individual Access Services. Speeds intake and avoids
                repeat tests.
              </Text>
            </View>
            <Switch
              value={tefcaConsent}
              onValueChange={setTefcaConsent}
              trackColor={{ false: C.border, true: C.teal }}
              thumbColor={C.white}
            />
          </View>

          {/* Appointment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appointment</Text>
            <View style={styles.apptRow}>
              <Text style={styles.apptLabel}>Date</Text>
              <Text style={styles.apptValue}>{gfe.appointmentDate}</Text>
            </View>
            <View style={styles.apptRow}>
              <Text style={styles.apptLabel}>Payment</Text>
              <Text style={styles.apptValue}>{summary.paymentLaneLabel}</Text>
            </View>
            <View style={styles.apptRow}>
              <Text style={styles.apptLabel}>Dispute threshold</Text>
              <Text style={styles.apptValue}>${gfe.totalMaxBeforeDispute.toFixed(2)}</Text>
            </View>
          </View>

          {/* Disclaimer (full NSA text) */}
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerTitle}>Your Rights Under the No Surprises Act</Text>
            <Text style={styles.disclaimerText}>{gfe.disclaimer}</Text>
          </View>

          {/* Scroll nudge */}
          {!hasScrolled && (
            <Text style={styles.scrollNudge}>↓ Scroll to the bottom to continue</Text>
          )}

          {/* Acknowledge */}
          {hasScrolled && (
            <TouchableOpacity
              style={[styles.understandBtn, understood && styles.understandBtnActive]}
              onPress={() => setUnderstood(!understood)}
            >
              <View style={[styles.checkbox, understood && styles.checkboxActive]}>
                {understood && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={[styles.understandText, understood && styles.understandTextActive]}>
                I have read and understand this Good Faith Estimate and my rights under
                the No Surprises Act.
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.declineBtn} onPress={onDecline}>
            <Text style={styles.declineBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.acceptBtn,
              (!hasScrolled || !understood) && styles.acceptBtnDisabled,
            ]}
            onPress={handleAccept}
            disabled={!hasScrolled || !understood}
          >
            <Text style={styles.acceptBtnText}>
              {isVALane ? 'Confirm VA Booking ($0)' : `Confirm — $${displayCost.toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.night, padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.white },
  headerSub: { fontSize: 11, color: C.teal2, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.1)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: C.white, fontSize: 14, fontWeight: '700' },

  gfeIdRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: C.deep },
  gfeId: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: 'rgba(255,255,255,.4)' },
  gfeDate: { fontSize: 10, color: 'rgba(255,255,255,.3)' },

  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.deep },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  body: { flex: 1 },

  priceBox: { margin: 16, borderRadius: 14, padding: 20 },
  priceBoxCivilian: { backgroundColor: C.tealBg, borderWidth: 1, borderColor: C.tealBorder },
  priceBoxVA: { backgroundColor: C.amberBg, borderWidth: 1, borderColor: C.amberBorder },
  pbLabel: { fontSize: 12, fontWeight: '600', color: C.mid, marginBottom: 6 },
  pbAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1, marginBottom: 6 },
  pbAmountCivilian: { color: C.teal },
  pbAmountVA: { color: C.amber },
  pbDispute: { fontSize: 11, color: C.mid, lineHeight: 15 },
  pbVANote: { fontSize: 11, color: C.mid, lineHeight: 15 },

  section: { backgroundColor: C.white, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  providerName: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 3 },
  providerNPI: { fontSize: 11, color: C.muted, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 2 },
  providerAddr: { fontSize: 12, color: C.mid, marginBottom: 2 },
  providerPhone: { fontSize: 12, color: C.sky },
  conveningNote: { fontSize: 11, color: C.muted, marginTop: 8, fontStyle: 'italic' },

  lineItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  lineItemLeft: { flex: 1 },
  lineItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  lineItemCPT: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: C.muted },
  ancillaryTag: { backgroundColor: C.violetBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 100 },
  ancillaryTagText: { fontSize: 9, color: C.violet, fontWeight: '700' },
  lineItemDesc: { fontSize: 13, fontWeight: '600', color: C.ink, marginBottom: 1 },
  lineItemProvider: { fontSize: 11, color: C.mid },
  lineItemICD: { fontSize: 10, color: C.muted, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  lineItemCost: { fontSize: 15, fontWeight: '800', color: C.teal, marginLeft: 12, marginTop: 2 },
  lineItemTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginTop: 4 },
  litLabel: { fontSize: 13, fontWeight: '700', color: C.ink },
  litAmount: { fontSize: 18, fontWeight: '800', color: C.teal },

  hsaBox: { flexDirection: 'row', backgroundColor: C.greenBg, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 12 },
  hsaIcon: { fontSize: 22 },
  hsaBody: { flex: 1 },
  hsaTitle: { fontSize: 13, fontWeight: '700', color: C.green, marginBottom: 3 },
  hsaText: { fontSize: 11, color: C.green, lineHeight: 16 },

  slidingTrigger: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.skyBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  slidingTriggerText: { fontSize: 12, fontWeight: '600', color: C.sky },

  slidingWrap: { marginHorizontal: 16, marginBottom: 12, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  slidingTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 4 },
  slidingHint: { fontSize: 11, color: C.mid, marginBottom: 12, lineHeight: 15 },
  slidingRow: { flexDirection: 'row', gap: 10 },
  slidingField: { flex: 1 },
  slidingLabel: { fontSize: 11, fontWeight: '600', color: C.mid, marginBottom: 4 },
  slidingInput: { backgroundColor: C.paper, borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, fontSize: 14, color: C.ink },
  slidingBtn: { backgroundColor: C.sky, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 12 },
  slidingBtnText: { color: C.white, fontWeight: '700', fontSize: 13 },
  slidingResult: { borderRadius: 8, padding: 12, marginTop: 10 },
  slidingResultGood: { backgroundColor: C.greenBg },
  slidingResultFull: { backgroundColor: '#f3f4f6' },
  srFPL: { fontSize: 11, color: C.mid, marginBottom: 3 },
  srSaving: { fontSize: 14, fontWeight: '700', color: C.green },
  srFree: { fontSize: 11, color: C.green, marginTop: 3 },
  srFQHC: { fontSize: 11, color: C.sky, marginTop: 3 },
  srFull: { fontSize: 13, color: C.mid },

  idVaultBox: { flexDirection: 'row', backgroundColor: C.violetBg, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 12 },
  idVaultIcon: { fontSize: 22 },
  idVaultBody: { flex: 1 },
  idVaultTitle: { fontSize: 13, fontWeight: '700', color: C.violet, marginBottom: 3 },
  idVaultText: { fontSize: 11, color: C.violet, lineHeight: 16 },

  tefcaBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 12, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border, padding: 14, gap: 12 },
  tefcaLeft: { flex: 1 },
  tefcaTitle: { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 3 },
  tefcaText: { fontSize: 11, color: C.mid, lineHeight: 15 },

  apptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  apptLabel: { fontSize: 12, color: C.muted },
  apptValue: { fontSize: 12, fontWeight: '600', color: C.ink },

  disclaimerBox: { backgroundColor: '#f3f4f6', borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  disclaimerTitle: { fontSize: 12, fontWeight: '700', color: C.ink, marginBottom: 8 },
  disclaimerText: { fontSize: 10, color: C.mid, lineHeight: 16 },

  scrollNudge: { textAlign: 'center', fontSize: 12, color: C.muted, paddingVertical: 12 },

  understandBtn: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: C.border, backgroundColor: C.white },
  understandBtnActive: { borderColor: C.teal, backgroundColor: C.tealBg },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkboxActive: { backgroundColor: C.teal, borderColor: C.teal },
  checkmark: { color: C.white, fontSize: 13, fontWeight: '800' },
  understandText: { flex: 1, fontSize: 12, color: C.mid, lineHeight: 17 },
  understandTextActive: { color: C.ink },

  footer: { flexDirection: 'row', gap: 12, padding: 16, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border },
  declineBtn: { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: C.mid },
  acceptBtn: { flex: 2, padding: 14, borderRadius: 10, backgroundColor: C.teal, alignItems: 'center' },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptBtnText: { fontSize: 14, fontWeight: '800', color: C.white },
});

export default GFEModal;
