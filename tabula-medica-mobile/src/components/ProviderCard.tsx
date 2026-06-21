/**
 * ProviderCard.tsx
 * Tabula Medica — Provider listing card with NFC/AaNeel badge
 *
 * Displays an enrolled Uninsurance provider or HRSA clinic with
 * distance, services, languages, and AaNeel NFC card acceptance badge.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import type { HRSAClinic } from '../services/hrsa.service';

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
  sky: '#0284c7',
  skyBg: '#e0f2fe',
  violet: '#7c3aed',
  violetBg: '#ede9fe',
};

interface ProviderCardProps {
  clinic: HRSAClinic;
  onBook?: (clinic: HRSAClinic) => void;
  onViewDetails?: (clinic: HRSAClinic) => void;
  showAaNeelBadge?: boolean;
  showBookButton?: boolean;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  clinic,
  onBook,
  onViewDetails,
  showAaNeelBadge = false,
  showBookButton = true,
}) => {
  const handleCall = () => {
    if (clinic.phone) {
      Linking.openURL(`tel:${clinic.phone.replace(/[^\d+]/g, '')}`);
    }
  };

  const handleWebsite = () => {
    if (clinic.website) {
      Linking.openURL(
        clinic.website.startsWith('http') ? clinic.website : `https://${clinic.website}`,
      );
    }
  };

  return (
    <View style={styles.card} data-testid={`provider-card-${clinic.id}`}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.clinicName} numberOfLines={2}>
            {clinic.name}
          </Text>
          <Text style={styles.clinicAddr} numberOfLines={2}>
            {clinic.address}, {clinic.city}, {clinic.state} {clinic.zip}
          </Text>
        </View>
        {clinic.distanceMiles != null && (
          <Text style={styles.distance}>{clinic.distanceMiles} mi</Text>
        )}
      </View>

      <View style={styles.badges}>
        {clinic.acceptsUninsured && (
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={styles.badgeGreenText}>Sliding Fee Scale</Text>
          </View>
        )}
        {clinic.clinicType === 'FQHC' && (
          <View style={[styles.badge, styles.badgeBlue]}>
            <Text style={styles.badgeBlueText}>FQHC</Text>
          </View>
        )}
        {clinic.clinicType === 'RURAL_HEALTH' && (
          <View style={[styles.badge, styles.badgeBlue]}>
            <Text style={styles.badgeBlueText}>Rural Health</Text>
          </View>
        )}
        {clinic.clinicType === 'FREE_CLINIC' && (
          <View style={[styles.badge, styles.badgeGreen]}>
            <Text style={styles.badgeGreenText}>Free Clinic</Text>
          </View>
        )}
        {showAaNeelBadge && (
          <View style={[styles.badge, styles.badgeViolet]}>
            <Text style={styles.badgeVioletText}>📲 AaNeel NFC</Text>
          </View>
        )}
      </View>

      {clinic.services.length > 0 && (
        <Text style={styles.services} numberOfLines={2}>
          {clinic.services.slice(0, 5).join(' · ')}
          {clinic.services.length > 5 ? ` +${clinic.services.length - 5} more` : ''}
        </Text>
      )}

      {clinic.languages.length > 0 && (
        <Text style={styles.languages}>
          🌐 {clinic.languages.join(', ')}
        </Text>
      )}

      {clinic.hoursNote && (
        <Text style={styles.hours}>🕐 {clinic.hoursNote}</Text>
      )}

      <View style={styles.actions}>
        {clinic.phone && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCall}
            data-testid={`call-provider-${clinic.id}`}
          >
            <Text style={styles.actionBtnText}>📞 Call</Text>
          </TouchableOpacity>
        )}
        {clinic.website && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleWebsite}
            data-testid={`website-provider-${clinic.id}`}
          >
            <Text style={styles.actionBtnText}>🌐 Website</Text>
          </TouchableOpacity>
        )}
        {onViewDetails && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => onViewDetails(clinic)}
            data-testid={`details-provider-${clinic.id}`}
          >
            <Text style={styles.actionBtnText}>Details</Text>
          </TouchableOpacity>
        )}
        {showBookButton && onBook && (
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => onBook(clinic)}
            data-testid={`book-provider-${clinic.id}`}
          >
            <Text style={styles.bookBtnText}>Book</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  clinicName: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 4 },
  clinicAddr: { fontSize: 12, color: C.muted, lineHeight: 17 },
  distance: { fontSize: 14, fontWeight: '700', color: C.teal, flexShrink: 0 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  badgeGreen: { backgroundColor: C.successBg },
  badgeGreenText: { fontSize: 10, fontWeight: '700', color: C.success },
  badgeBlue: { backgroundColor: C.skyBg },
  badgeBlueText: { fontSize: 10, fontWeight: '700', color: C.sky },
  badgeViolet: { backgroundColor: C.violetBg },
  badgeVioletText: { fontSize: 10, fontWeight: '700', color: C.violet },
  services: { fontSize: 11, color: C.mid, marginBottom: 6, lineHeight: 16 },
  languages: { fontSize: 11, color: C.sky, marginBottom: 6 },
  hours: { fontSize: 11, color: C.muted, marginBottom: 10 },
  actions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 12,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: C.mid },
  bookBtn: {
    backgroundColor: C.teal,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginLeft: 'auto',
  },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: C.white },
});

export default ProviderCard;
