/**
 * MedicareRateCard.tsx
 * Tabula Medica — "Your price: $82.40" Medicare rate display card
 *
 * Shows the Medicare 2026 rate alongside the typical market price
 * with a savings badge. Used in RateCalculatorScreen and BookingScreen.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { MedicareRate } from '../services/medicareRates.service';

const C = {
  teal: '#0d9e8a',
  teal2: '#14c4ad',
  tealBg: 'rgba(13,158,138,0.08)',
  night: '#040d1a',
  paper: '#f8f7f4',
  ink: '#0f1923',
  mid: '#4a5568',
  muted: '#8fa3b8',
  border: '#e2dfd8',
  success: '#15803d',
  successBg: '#dcfce7',
  white: '#ffffff',
  red: '#e11d48',
  redLight: '#ffe4e6',
  skyBg: '#e0f2fe',
  sky: '#0284c7',
};

const CATEGORY_ICONS: Record<string, string> = {
  office: '🩺',
  lab: '🧪',
  imaging: '📷',
  pharmacy: '💊',
  mental_health: '🧠',
  preventive: '🛡️',
  dental: '🦷',
  urgent: '🚨',
  telehealth: '📱',
  other: '⚕️',
};

interface MedicareRateCardProps {
  rate: MedicareRate;
  onSelect?: (rate: MedicareRate) => void;
  compact?: boolean;
  showOrderNote?: boolean;
}

const MedicareRateCard: React.FC<MedicareRateCardProps> = ({
  rate,
  onSelect,
  compact = false,
  showOrderNote = true,
}) => {
  const savingsPercent = Math.round(
    (1 - rate.medicareRate2026 / rate.typicalMarket) * 100,
  );
  const savingsAmount = rate.typicalMarket - rate.medicareRate2026;
  const icon = CATEGORY_ICONS[rate.category] ?? '⚕️';

  const card = (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.top}>
        <View style={styles.topLeft}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.nameWrap}>
            <Text style={styles.serviceName} numberOfLines={compact ? 1 : 2}>
              {rate.serviceName}
            </Text>
            <Text style={styles.cptCode}>{rate.cptCode}</Text>
          </View>
        </View>
        <View style={styles.saveBadge}>
          <Text style={styles.saveBadgeText}>save {savingsPercent}%</Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceCol}>
          <Text style={styles.priceLabel}>Typical price</Text>
          <Text style={styles.marketPrice}>
            ${rate.typicalMarket.toLocaleString()}
          </Text>
        </View>
        <View style={styles.arrow}>
          <Text style={styles.arrowText}>→</Text>
        </View>
        <View style={[styles.priceCol, styles.priceColRight]}>
          <Text style={styles.priceLabel}>Your price</Text>
          <Text style={styles.medicarePrice}>
            ${rate.medicareRate2026.toFixed(2)}
          </Text>
        </View>
      </View>

      {!compact && (
        <View style={styles.footer}>
          <Text style={styles.savingsText}>
            You save ${savingsAmount.toLocaleString()}
          </Text>
          {showOrderNote && rate.requiresOrder && (
            <View style={styles.orderBadge}>
              <Text style={styles.orderBadgeText}>Requires provider order</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onSelect) {
    return (
      <TouchableOpacity
        onPress={() => onSelect(rate)}
        activeOpacity={0.7}
        data-testid={`rate-card-${rate.cptCode}`}
      >
        {card}
      </TouchableOpacity>
    );
  }

  return card;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  cardCompact: { padding: 12, marginBottom: 8 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  topLeft: { flexDirection: 'row', flex: 1, gap: 10 },
  icon: { fontSize: 20, marginTop: 2 },
  nameWrap: { flex: 1 },
  serviceName: { fontSize: 14, fontWeight: '700', color: C.ink, lineHeight: 19 },
  cptCode: { fontSize: 11, color: C.muted, marginTop: 2, fontFamily: 'monospace' },
  saveBadge: {
    backgroundColor: C.successBg,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  saveBadgeText: { fontSize: 11, fontWeight: '800', color: C.success },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.paper,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  priceCol: { flex: 1 },
  priceColRight: { alignItems: 'flex-end' },
  priceLabel: { fontSize: 10, color: C.muted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  marketPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: C.red,
    textDecorationLine: 'line-through',
    textDecorationColor: C.red,
  },
  medicarePrice: { fontSize: 22, fontWeight: '800', color: C.teal },
  arrow: { paddingHorizontal: 10 },
  arrowText: { fontSize: 18, color: C.muted },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savingsText: { fontSize: 12, fontWeight: '700', color: C.success },
  orderBadge: {
    backgroundColor: C.skyBg,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  orderBadgeText: { fontSize: 10, fontWeight: '600', color: C.sky },
});

export default MedicareRateCard;
