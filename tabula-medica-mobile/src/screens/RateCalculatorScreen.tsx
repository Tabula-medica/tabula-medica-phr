/**
 * RateCalculatorScreen.tsx
 * Tabula Medica — Medicare 2026 PFS Rate Calculator
 *
 * Lets patients search CPT codes and common procedures to see
 * their Uninsurance price (Medicare rate) vs. typical market price.
 * Includes category filters, search, and savings display.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import {
  MEDICARE_RATES,
  searchRates,
  getRatesByCategory,
  getAllCategories,
  getTopSavings,
  type MedicareRate,
  type RateCategory,
} from '../services/medicareRates.service';
import MedicareRateCard from '../components/MedicareRateCard';

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
  skyBg: '#e0f2fe',
  sky: '#0284c7',
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  office: { label: 'Office Visits', icon: '🩺' },
  lab: { label: 'Lab Tests', icon: '🧪' },
  imaging: { label: 'Imaging', icon: '📷' },
  mental_health: { label: 'Mental Health', icon: '🧠' },
  preventive: { label: 'Preventive', icon: '🛡️' },
  dental: { label: 'Dental', icon: '🦷' },
  urgent: { label: 'Urgent/ER', icon: '🚨' },
  telehealth: { label: 'Telehealth', icon: '📱' },
  other: { label: 'Other', icon: '⚕️' },
};

interface RateCalculatorScreenProps {
  navigation?: any;
}

const RateCalculatorScreen: React.FC<RateCalculatorScreenProps> = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<RateCategory | 'ALL'>('ALL');

  const categories = useMemo(() => getAllCategories(), []);

  const filteredRates = useMemo(() => {
    let rates: MedicareRate[];
    if (query.trim()) {
      rates = searchRates(query).rates;
    } else if (selectedCategory !== 'ALL') {
      rates = getRatesByCategory(selectedCategory);
    } else {
      rates = MEDICARE_RATES;
    }
    return rates;
  }, [query, selectedCategory]);

  const topSavings = useMemo(() => getTopSavings(3), []);

  const handleSelect = (rate: MedicareRate) => {
    if (navigation) {
      navigation.navigate('Booking', { selectedRate: rate });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredRates}
        keyExtractor={(item) => item.cptCode}
        renderItem={({ item }) => (
          <MedicareRateCard rate={item} onSelect={handleSelect} />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Rate Calculator</Text>
              <Text style={styles.subtitle}>
                Medicare 2026 rates — what you'll actually pay
              </Text>
            </View>

            {!query && selectedCategory === 'ALL' && (
              <View style={styles.savingsHighlight}>
                <Text style={styles.savingsTitle}>Biggest Savings</Text>
                {topSavings.map((s) => (
                  <View key={s.cptCode} style={styles.savingsRow}>
                    <Text style={styles.savingsService} numberOfLines={1}>
                      {s.serviceName}
                    </Text>
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsBadgeText}>
                        save {s.savingsPercent}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (text.trim()) setSelectedCategory('ALL');
              }}
              placeholder="Search by CPT code or service name..."
              placeholderTextColor={C.muted}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              data-testid="input-rate-search"
            />

            <View style={styles.categoryRow}>
              <TouchableOpacity
                style={[
                  styles.catChip,
                  selectedCategory === 'ALL' && styles.catChipActive,
                ]}
                onPress={() => {
                  setSelectedCategory('ALL');
                  setQuery('');
                }}
              >
                <Text
                  style={[
                    styles.catChipText,
                    selectedCategory === 'ALL' && styles.catChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat] ?? { label: cat, icon: '⚕️' };
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      selectedCategory === cat && styles.catChipActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setQuery('');
                    }}
                    data-testid={`category-${cat}`}
                  >
                    <Text style={styles.catIcon}>{meta.icon}</Text>
                    <Text
                      style={[
                        styles.catChipText,
                        selectedCategory === cat && styles.catChipTextActive,
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.resultCount}>
              {filteredRates.length} service{filteredRates.length !== 1 ? 's' : ''}
              {query ? ` matching "${query}"` : ''}
            </Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No rates found</Text>
            <Text style={styles.emptySub}>
              Try a different search term or select a category above.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 4 },
  savingsHighlight: {
    marginHorizontal: 16,
    backgroundColor: C.successBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  savingsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.success,
    marginBottom: 8,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  savingsService: { fontSize: 12, color: C.ink, flex: 1, marginRight: 8 },
  savingsBadge: {
    backgroundColor: C.white,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  savingsBadgeText: { fontSize: 10, fontWeight: '800', color: C.success },
  searchInput: {
    marginHorizontal: 16,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: C.ink,
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 100,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.white,
    gap: 4,
  },
  catChipActive: { backgroundColor: C.skyBg, borderColor: C.sky },
  catIcon: { fontSize: 12 },
  catChipText: { fontSize: 11, fontWeight: '600', color: C.mid },
  catChipTextActive: { color: C.sky },
  resultCount: {
    fontSize: 12,
    color: C.muted,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink, marginBottom: 8 },
  emptySub: { fontSize: 13, color: C.mid, textAlign: 'center', lineHeight: 19 },
});

export default RateCalculatorScreen;
