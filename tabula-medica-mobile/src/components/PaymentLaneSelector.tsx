/**
 * PaymentLaneSelector.tsx
 * Tabula Medica — "I have VA auth" vs "I'll pay today" toggle
 *
 * Two-lane payment selector for the Uninsurance booking flow.
 * Lane A: Self-pay civilian via InstaMed (24-hour ACH settlement)
 * Lane B: VA veteran via Optum CCN ($0 copay, VA pays provider)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type PaymentLane = 'A_INSTAMED' | 'B_VA_CCN';

const C = {
  teal: '#0d9e8a',
  teal2: '#14c4ad',
  tealBg: 'rgba(13,158,138,0.08)',
  tealBorder: 'rgba(13,158,138,0.25)',
  amber: '#f59e0b',
  amber2: '#fbbf24',
  amberBg: 'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(245,158,11,0.25)',
  night: '#040d1a',
  ink: '#0f1923',
  mid: '#4a5568',
  muted: '#8fa3b8',
  border: '#e2dfd8',
  white: '#ffffff',
  paper: '#f8f7f4',
};

interface PaymentLaneSelectorProps {
  selectedLane: PaymentLane;
  onSelect: (lane: PaymentLane) => void;
  medicareRate?: number;
  disabled?: boolean;
}

const PaymentLaneSelector: React.FC<PaymentLaneSelectorProps> = ({
  selectedLane,
  onSelect,
  medicareRate,
  disabled = false,
}) => (
  <View style={styles.container}>
    <Text style={styles.heading}>How will you pay?</Text>

    <TouchableOpacity
      style={[
        styles.lane,
        selectedLane === 'A_INSTAMED' && styles.laneActiveA,
        disabled && styles.laneDisabled,
      ]}
      onPress={() => !disabled && onSelect('A_INSTAMED')}
      activeOpacity={disabled ? 1 : 0.7}
      data-testid="lane-a-instamed"
    >
      <View style={styles.laneHeader}>
        <View
          style={[
            styles.radio,
            selectedLane === 'A_INSTAMED' && styles.radioActiveA,
          ]}
        >
          {selectedLane === 'A_INSTAMED' && <View style={styles.radioInnerA} />}
        </View>
        <View style={styles.laneText}>
          <Text
            style={[
              styles.laneTitle,
              selectedLane === 'A_INSTAMED' && styles.laneTitleActiveA,
            ]}
          >
            Lane A — Self-Pay
          </Text>
          <Text style={styles.laneSub}>I'll pay at point of care</Text>
        </View>
        {medicareRate != null && selectedLane === 'A_INSTAMED' && (
          <Text style={styles.lanePriceA}>${medicareRate.toFixed(2)}</Text>
        )}
      </View>
      <View style={styles.laneDetails}>
        <Text style={styles.detailItem}>💳 Card, HSA, FSA, or AaNeel NFC</Text>
        <Text style={styles.detailItem}>⚡ 24-hour ACH settlement to provider</Text>
        <Text style={styles.detailItem}>📄 Instant digital receipt</Text>
      </View>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.lane,
        selectedLane === 'B_VA_CCN' && styles.laneActiveB,
        disabled && styles.laneDisabled,
      ]}
      onPress={() => !disabled && onSelect('B_VA_CCN')}
      activeOpacity={disabled ? 1 : 0.7}
      data-testid="lane-b-va-ccn"
    >
      <View style={styles.laneHeader}>
        <View
          style={[
            styles.radio,
            selectedLane === 'B_VA_CCN' && styles.radioActiveB,
          ]}
        >
          {selectedLane === 'B_VA_CCN' && <View style={styles.radioInnerB} />}
        </View>
        <View style={styles.laneText}>
          <Text
            style={[
              styles.laneTitle,
              selectedLane === 'B_VA_CCN' && styles.laneTitleActiveB,
            ]}
          >
            Lane B — VA Veteran
          </Text>
          <Text style={styles.laneSub}>I have a VA Community Care referral</Text>
        </View>
        {selectedLane === 'B_VA_CCN' && (
          <Text style={styles.lanePriceB}>$0.00</Text>
        )}
      </View>
      <View style={styles.laneDetails}>
        <Text style={styles.detailItem}>🎖️ VA pays via Optum CCN</Text>
        <Text style={styles.detailItem}>📋 Referral number required</Text>
        <Text style={styles.detailItem}>✅ $0 copay for authorized visits</Text>
      </View>
    </TouchableOpacity>

    <Text style={styles.disclaimer}>
      All prices are 2026 Medicare Physician Fee Schedule rates.
      No surprise bills — your price is locked by Good Faith Estimate.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 12,
  },
  lane: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
  },
  laneActiveA: {
    borderColor: C.teal,
    backgroundColor: C.tealBg,
  },
  laneActiveB: {
    borderColor: C.amber,
    backgroundColor: C.amberBg,
  },
  laneDisabled: { opacity: 0.5 },
  laneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioActiveA: { borderColor: C.teal },
  radioActiveB: { borderColor: C.amber },
  radioInnerA: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.teal,
  },
  radioInnerB: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: C.amber,
  },
  laneText: { flex: 1 },
  laneTitle: { fontSize: 14, fontWeight: '700', color: C.mid },
  laneTitleActiveA: { color: C.teal },
  laneTitleActiveB: { color: C.amber },
  laneSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  lanePriceA: { fontSize: 18, fontWeight: '800', color: C.teal },
  lanePriceB: { fontSize: 18, fontWeight: '800', color: '#15803d' },
  laneDetails: { marginLeft: 34, gap: 4 },
  detailItem: { fontSize: 11, color: C.mid, lineHeight: 17 },
  disclaimer: {
    fontSize: 10,
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});

export default PaymentLaneSelector;
