/**
 * ProviderSearchScreen.tsx
 * Tabula Medica — HRSA FQHC + Enrolled Provider Search
 *
 * Combines HRSA public API results with Tabula Medica's enrolled
 * provider network. Patients can search by ZIP, filter by service type,
 * and book directly from the results.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import { findClinics, HRSAClinic } from '../services/hrsa.service';
import ProviderCard from '../components/ProviderCard';

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
  skyBg: '#e0f2fe',
  sky: '#0284c7',
};

type ServiceFilter = 'ALL' | 'dental' | 'mental_health' | 'pharmacy' | 'prenatal' | 'pediatric';

const FILTERS: { key: ServiceFilter; label: string; icon: string }[] = [
  { key: 'ALL', label: 'All', icon: '🏥' },
  { key: 'dental', label: 'Dental', icon: '🦷' },
  { key: 'mental_health', label: 'Mental Health', icon: '🧠' },
  { key: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { key: 'prenatal', label: 'Prenatal', icon: '🤰' },
  { key: 'pediatric', label: 'Pediatric', icon: '👶' },
];

interface ProviderSearchScreenProps {
  navigation?: any;
}

const ProviderSearchScreen: React.FC<ProviderSearchScreenProps> = ({ navigation }) => {
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(25);
  const [filter, setFilter] = useState<ServiceFilter>('ALL');
  const [results, setResults] = useState<HRSAClinic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  const handleSearch = useCallback(async () => {
    const cleanZip = zip.replace(/\D/g, '');
    if (cleanZip.length !== 5) return;
    Keyboard.dismiss();
    setLoading(true);
    setSearched(true);

    try {
      const result = await findClinics({
        zip: cleanZip,
        radiusMiles: radius,
        serviceFilter: filter === 'ALL' ? undefined : filter,
      });
      setResults(result.clinics);
      setTotalFound(result.totalFound);
    } catch {
      setResults([]);
      setTotalFound(0);
    } finally {
      setLoading(false);
    }
  }, [zip, radius, filter]);

  const handleBook = useCallback(
    (clinic: HRSAClinic) => {
      if (navigation) {
        navigation.navigate('Booking', { clinic });
      }
    },
    [navigation],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Find a Provider</Text>
        <Text style={styles.subtitle}>
          Search 1,400+ FQHCs and community health centers
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.zipInput}
          value={zip}
          onChangeText={setZip}
          placeholder="ZIP Code"
          placeholderTextColor={C.muted}
          keyboardType="number-pad"
          maxLength={5}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          data-testid="input-zip"
        />
        <TouchableOpacity
          style={[styles.radiusBtn, radius === 10 && styles.radiusBtnActive]}
          onPress={() => setRadius(10)}
        >
          <Text style={[styles.radiusBtnText, radius === 10 && styles.radiusBtnTextActive]}>10 mi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.radiusBtn, radius === 25 && styles.radiusBtnActive]}
          onPress={() => setRadius(25)}
        >
          <Text style={[styles.radiusBtnText, radius === 25 && styles.radiusBtnTextActive]}>25 mi</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.radiusBtn, radius === 50 && styles.radiusBtnActive]}
          onPress={() => setRadius(50)}
        >
          <Text style={[styles.radiusBtnText, radius === 50 && styles.radiusBtnTextActive]}>50 mi</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            data-testid={`filter-${f.key}`}
          >
            <Text style={styles.filterIcon}>{f.icon}</Text>
            <Text
              style={[
                styles.filterLabel,
                filter === f.key && styles.filterLabelActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.searchBtn, zip.length !== 5 && styles.searchBtnDisabled]}
        onPress={handleSearch}
        disabled={zip.length !== 5 || loading}
        data-testid="button-search"
      >
        {loading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <Text style={styles.searchBtnText}>Search Providers</Text>
        )}
      </TouchableOpacity>

      {searched && !loading && (
        <Text style={styles.resultCount}>
          {totalFound} provider{totalFound !== 1 ? 's' : ''} found
          {totalFound > 0 ? ` within ${radius} miles` : ''}
        </Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ProviderCard
            clinic={item}
            onBook={handleBook}
            showBookButton={true}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          searched && !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No providers found</Text>
              <Text style={styles.emptySub}>
                Try expanding your search radius or changing the service filter.
                All FQHCs accept uninsured patients on a sliding fee scale.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: C.ink },
  subtitle: { fontSize: 13, color: C.muted, marginTop: 4 },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  zipInput: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: C.ink,
  },
  radiusBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: C.white,
  },
  radiusBtnActive: {
    backgroundColor: C.teal,
    borderColor: C.teal,
  },
  radiusBtnText: { fontSize: 12, fontWeight: '600', color: C.mid },
  radiusBtnTextActive: { color: C.white },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 6,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  filterChip: {
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
  filterChipActive: {
    backgroundColor: C.skyBg,
    borderColor: C.sky,
  },
  filterIcon: { fontSize: 12 },
  filterLabel: { fontSize: 11, fontWeight: '600', color: C.mid },
  filterLabelActive: { color: C.sky },
  searchBtn: {
    marginHorizontal: 16,
    backgroundColor: C.teal,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText: { color: C.white, fontSize: 15, fontWeight: '700' },
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

export default ProviderSearchScreen;
