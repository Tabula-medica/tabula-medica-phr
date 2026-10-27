import React from 'react';
import {
  View, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { LoadingState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { deepLinkToUninsurance } from '@/lib/crossAppLink';
import { apiRequest } from '@/lib/query-client';

interface CareGap {
  id: string;
  screeningName: string;
  description: string;
  whyItMatters: string;
  status: 'overdue' | 'due_soon' | 'up_to_date' | 'not_applicable';
  lastDoneDate?: string;
  nextDueDate?: string;
  intervalDescription: string;
  ageRange: string;
  gradeLabel: string;
  coveredByInsurance: boolean;
  estimatedTimeMinutes: number;
  cptCode?: string;
  specialty?: string;
}

const STATUS_CONFIG: Record<CareGap['status'], {
  label: string; color: string; bg: string; icon: keyof typeof Feather.glyphMap;
}> = {
  overdue:       { label: 'Overdue',     color: '#FF3B30', bg: 'rgba(255,59,48,0.1)',  icon: 'alert-circle' },
  due_soon:      { label: 'Due soon',    color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)', icon: 'clock' },
  up_to_date:    { label: 'Up to date',  color: '#34C759', bg: 'rgba(52,199,89,0.1)',  icon: 'check-circle' },
  not_applicable:{ label: 'Not needed',  color: '#8E8E93', bg: 'rgba(142,142,147,0.1)', icon: 'minus-circle' },
};

export default function CareGapsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery<{ gaps: CareGap[]; patientAge: number; completionPct: number }>({
    queryKey: ['/api/care-gaps'],
  });

  const gaps = data?.gaps ?? [];
  const overdue = gaps.filter(g => g.status === 'overdue');
  const dueSoon = gaps.filter(g => g.status === 'due_soon');
  const upToDate = gaps.filter(g => g.status === 'up_to_date');
  const pct = data?.completionPct ?? 0;

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <ThemedText style={styles.pageTitle}>Health screenings</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
            Preventive screenings recommended for you
          </ThemedText>
        </View>

        {isLoading ? (
          <LoadingState message="Checking your screenings..." />
        ) : (
          <>
            <Animated.View entering={FadeInDown}>
              <Card style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <View style={styles.ringContainer}>
                    <View style={[styles.ring, { borderColor: theme.success }]}>
                      <ThemedText style={[styles.ringPct, { color: theme.success }]}>
                        {pct}%
                      </ThemedText>
                      <ThemedText style={[styles.ringLabel, { color: theme.textSecondary }]}>
                        current
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.summaryStats}>
                    <View style={styles.statRow}>
                      <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
                      <ThemedText style={[styles.statText, { color: theme.text }]}>
                        {overdue.length} overdue
                      </ThemedText>
                    </View>
                    <View style={styles.statRow}>
                      <View style={[styles.dot, { backgroundColor: '#FF9F0A' }]} />
                      <ThemedText style={[styles.statText, { color: theme.text }]}>
                        {dueSoon.length} due soon
                      </ThemedText>
                    </View>
                    <View style={styles.statRow}>
                      <View style={[styles.dot, { backgroundColor: '#34C759' }]} />
                      <ThemedText style={[styles.statText, { color: theme.text }]}>
                        {upToDate.length} up to date
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.coveredNote, { color: theme.textSecondary }]}>
                      Most screenings are covered 100% under your insurance
                    </ThemedText>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {overdue.length > 0 ? (
              <GapSection title="Overdue" items={overdue} theme={theme} />
            ) : null}

            {dueSoon.length > 0 ? (
              <GapSection title="Coming up" items={dueSoon} theme={theme} />
            ) : null}

            {upToDate.length > 0 ? (
              <GapSection title="Up to date" items={upToDate} theme={theme} />
            ) : null}

            {gaps.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Feather name="check-circle" size={32} color={theme.success} />
                <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                  All screenings up to date
                </ThemedText>
                <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
                  No preventive screenings are overdue based on your age, sex, and health history.
                </ThemedText>
              </Card>
            ) : null}

            <TouchableOpacity
              style={styles.uspstfLink}
              onPress={() => Linking.openURL('https://www.uspreventiveservicestaskforce.org/uspstf/recommendation-topics/uspstf-a-and-b-recommendations')}
              accessibilityRole="link"
            >
              <Feather name="external-link" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.uspstfText, { color: theme.textSecondary }]}>
                Based on USPSTF Grade A & B recommendations
              </ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function GapSection({ title, items, theme }: { title: string; items: CareGap[]; theme: any }) {
  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { paddingHorizontal: Spacing.lg }]}>
        {title}
      </ThemedText>
      {items.map((gap, i) => (
        <GapCard key={gap.id} gap={gap} index={i} theme={theme} />
      ))}
    </View>
  );
}

async function handleFixThis(gap: CareGap) {
  if (!gap.cptCode || !gap.specialty) return;

  try {
    await deepLinkToUninsurance({
      cptCode: gap.cptCode,
      specialty: gap.specialty,
    });
  } catch {
    try {
      const fallbackUrl = `https://uninsurance.care/book?cpt=${encodeURIComponent(gap.cptCode)}&specialty=${encodeURIComponent(gap.specialty)}&source=tabula_medica`;
      await Linking.openURL(fallbackUrl);
    } catch {
      if (Platform.OS !== 'web') {
        Alert.alert('Unable to open', 'Could not open the booking page. Please try again later.');
      }
    }
  }
}

function GapCard({ gap, index, theme }: { gap: CareGap; index: number; theme: any }) {
  const [expanded, setExpanded] = React.useState(gap.status === 'overdue');
  const status = STATUS_CONFIG[gap.status];

  return (
    <Animated.View entering={FadeInDown.delay(index * 60)}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Card style={styles.gapCard}>
          <View style={styles.gapHeader}>
            <View style={styles.gapInfo}>
              <ThemedText style={styles.gapName}>{gap.screeningName}</ThemedText>
              <ThemedText style={[styles.gapDesc, { color: theme.textSecondary }]}>
                {gap.description}
              </ThemedText>
            </View>
            <View style={[styles.gapStatus, { backgroundColor: status.bg }]}>
              <Feather name={status.icon} size={11} color={status.color} />
              <ThemedText style={[styles.gapStatusText, { color: status.color }]}>
                {status.label}
              </ThemedText>
            </View>
          </View>

          {expanded ? (
            <View style={[styles.gapExpanded, { borderTopColor: theme.border }]}>
              <ThemedText style={[styles.gapWhy, { color: theme.text }]}>
                Why it matters
              </ThemedText>
              <ThemedText style={[styles.gapWhyBody, { color: theme.textSecondary }]}>
                {gap.whyItMatters}
              </ThemedText>

              <View style={styles.gapMeta}>
                <MetaChip icon="repeat" label={gap.intervalDescription} theme={theme} />
                <MetaChip icon="users" label={gap.ageRange} theme={theme} />
                <MetaChip icon="clock" label={`~${gap.estimatedTimeMinutes} min`} theme={theme} />
                {gap.coveredByInsurance ? (
                  <MetaChip icon="shield" label="Usually $0 with insurance" theme={theme} color="#34C759" />
                ) : null}
              </View>

              {gap.lastDoneDate ? (
                <ThemedText style={[styles.lastDone, { color: theme.textSecondary }]}>
                  Last done: {new Date(gap.lastDoneDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </ThemedText>
              ) : null}

              {(gap.status === 'overdue' || gap.status === 'due_soon') ? (
                <View style={styles.actionBtns}>
                  {gap.cptCode ? (
                    <TouchableOpacity
                      style={[styles.fixThisBtn, { backgroundColor: '#FF3B30' }]}
                      onPress={() => handleFixThis(gap)}
                      accessibilityRole="button"
                      accessibilityLabel={`Fix this care gap for ${gap.screeningName}`}
                      testID={`button-fix-this-${gap.id}`}
                    >
                      <Feather name="zap" size={14} color="#fff" />
                      <ThemedText style={styles.scheduleBtnText}>
                        Fix this
                      </ThemedText>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={[styles.scheduleBtn, { backgroundColor: theme.primary, flex: gap.cptCode ? 1 : undefined }]}
                    onPress={() => Linking.openURL('https://findahealthcenter.hrsa.gov')}
                    accessibilityRole="button"
                    testID={`button-find-provider-${gap.id}`}
                  >
                    <ThemedText style={styles.scheduleBtnText}>
                      Find a provider
                    </ThemedText>
                    <Feather name="arrow-right" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : null}
        </Card>
      </TouchableOpacity>
    </Animated.View>
  );
}

function MetaChip({ icon, label, theme, color }: {
  icon: keyof typeof Feather.glyphMap; label: string; theme: any; color?: string;
}) {
  const c = color ?? theme.textSecondary;
  return (
    <View style={[styles.metaChip, { borderColor: c + '30' }]}>
      <Feather name={icon} size={10} color={c} />
      <ThemedText style={[styles.metaChipText, { color: c }]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  pageTitle: { fontSize: Typography.h2.fontSize, fontWeight: '700', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14 },
  summaryCard: { margin: Spacing.lg, marginTop: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringContainer: { width: 80, alignItems: 'center' },
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 20, fontWeight: '700' },
  ringLabel: { fontSize: 10 },
  summaryStats: { flex: 1, gap: 6 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 13 },
  coveredNote: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  section: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6, marginTop: 4 },
  gapCard: { marginHorizontal: Spacing.lg, marginBottom: 8, padding: 13 },
  gapHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gapInfo: { flex: 1 },
  gapName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  gapDesc: { fontSize: 12 },
  gapStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  gapStatusText: { fontSize: 11, fontWeight: '500' },
  gapExpanded: { borderTopWidth: 0.5, marginTop: 12, paddingTop: 12 },
  gapWhy: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  gapWhyBody: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  gapMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 0.5 },
  metaChipText: { fontSize: 10, fontWeight: '500' },
  lastDone: { fontSize: 11, marginBottom: 10 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  fixThisBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: BorderRadius.sm },
  scheduleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: BorderRadius.sm },
  scheduleBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyCard: { margin: Spacing.lg, alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  uspstfLink: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', padding: Spacing.lg },
  uspstfText: { fontSize: 11 },
});
