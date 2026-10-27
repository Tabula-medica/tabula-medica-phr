import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
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

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  mechanism?: string;
  management: string;
  source: 'FDA';
}

interface InteractionCheckResult {
  interactions: DrugInteraction[];
  majorCount: number;
  moderateCount: number;
  checkedAt: string;
  medicationsChecked: string[];
}

const SEVERITY_CONFIG = {
  major:    { label: 'Major',    color: '#FF3B30', bg: 'rgba(255,59,48,0.1)',  icon: 'alert-octagon' as const },
  moderate: { label: 'Moderate', color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)', icon: 'alert-triangle' as const },
  minor:    { label: 'Minor',    color: '#8E8E93', bg: 'rgba(142,142,147,0.1)', icon: 'info' as const },
};

export default function DrugInteractionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery<InteractionCheckResult>({
    queryKey: ['/api/medications/interactions'],
    staleTime: 1000 * 60 * 60,
  });

  const interactions = data?.interactions ?? [];
  const major = interactions.filter(i => i.severity === 'major');
  const moderate = interactions.filter(i => i.severity === 'moderate');
  const minor = interactions.filter(i => i.severity === 'minor');

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <ThemedText style={styles.pageTitle}>Drug interactions</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
            Checking {data?.medicationsChecked?.length ?? '...'} medications from your record
          </ThemedText>
        </View>

        {isLoading ? (
          <LoadingState message="Checking FDA interaction database..." />
        ) : interactions.length === 0 ? (
          <Animated.View entering={FadeInDown}>
            <Card style={styles.safeCard}>
              <Feather name="check-circle" size={32} color={theme.success} />
              <ThemedText style={[styles.safeTitle, { color: theme.text }]}>
                No interactions found
              </ThemedText>
              <ThemedText style={[styles.safeBody, { color: theme.textSecondary }]}>
                No drug interactions were found between your current medications
                in the FDA drug label database. Always tell every healthcare provider
                about all medications you take.
              </ThemedText>
            </Card>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown}>
              <Card style={styles.summaryCard}>
                <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
                  {interactions.length} interaction{interactions.length !== 1 ? 's' : ''} found
                </ThemedText>
                <ThemedText style={[styles.summaryBody, { color: theme.textSecondary }]}>
                  Share this with your doctor or pharmacist. They can review whether
                  these apply to your specific situation.
                </ThemedText>
                {major.length > 0 ? (
                  <View style={[styles.majorAlert, { borderColor: '#FF3B3030' }]}>
                    <Feather name="alert-octagon" size={14} color="#FF3B30" />
                    <ThemedText style={[styles.majorAlertText, { color: '#FF3B30' }]}>
                      {major.length} major interaction{major.length !== 1 ? 's' : ''} — speak to your doctor today
                    </ThemedText>
                  </View>
                ) : null}
              </Card>
            </Animated.View>

            {major.length > 0 ? (
              <InteractionGroup title="Major" items={major} theme={theme} />
            ) : null}
            {moderate.length > 0 ? (
              <InteractionGroup title="Moderate" items={moderate} theme={theme} />
            ) : null}
            {minor.length > 0 ? (
              <InteractionGroup title="Minor" items={minor} theme={theme} />
            ) : null}
          </>
        )}

        <View style={styles.footerNote}>
          <Feather name="info" size={13} color={theme.textSecondary} />
          <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
            Source: FDA drug label database (openFDA). This is for information only —
            not medical advice. Your pharmacist can review interactions in the context
            of your full health history.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function InteractionGroup({ title, items, theme }: {
  title: string; items: DrugInteraction[]; theme: any;
}) {
  const cfg = SEVERITY_CONFIG[items[0]?.severity ?? 'minor'];
  return (
    <View style={styles.group}>
      <View style={[styles.groupHead, { borderLeftColor: cfg.color }]}>
        <Feather name={cfg.icon} size={14} color={cfg.color} />
        <ThemedText style={[styles.groupTitle, { color: cfg.color }]}>
          {title} interactions · {items.length}
        </ThemedText>
      </View>
      {items.map((item, i) => (
        <InteractionCard key={`${item.drug1}${item.drug2}`} item={item} index={i} theme={theme} />
      ))}
    </View>
  );
}

function InteractionCard({ item, index, theme }: {
  item: DrugInteraction; index: number; theme: any;
}) {
  const cfg = SEVERITY_CONFIG[item.severity];
  return (
    <Animated.View entering={FadeInDown.delay(index * 60)}>
      <Card style={styles.intCard}>
        <View style={styles.intHeader}>
          <ThemedText style={styles.intDrugs}>
            {item.drug1} + {item.drug2}
          </ThemedText>
          <View style={[styles.intBadge, { backgroundColor: cfg.bg }]}>
            <Feather name={cfg.icon} size={10} color={cfg.color} />
            <ThemedText style={[styles.intBadgeText, { color: cfg.color }]}>
              {cfg.label}
            </ThemedText>
          </View>
        </View>
        <ThemedText style={[styles.intDesc, { color: theme.textSecondary }]}>
          {item.description}
        </ThemedText>
        <View style={[styles.intManagement, { backgroundColor: cfg.bg }]}>
          <Feather name="message-circle" size={12} color={cfg.color} />
          <ThemedText style={[styles.intManagementText, { color: cfg.color }]}>
            {item.management}
          </ThemedText>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  pageTitle: { fontSize: Typography.h2.fontSize, fontWeight: '700', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14 },
  safeCard: { margin: Spacing.lg, alignItems: 'center', gap: 10, paddingVertical: 28 },
  safeTitle: { fontSize: 16, fontWeight: '600' },
  safeBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  summaryCard: { margin: Spacing.lg, marginBottom: 8 },
  summaryTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  summaryBody: { fontSize: 13, lineHeight: 18, marginBottom: 10 },
  majorAlert: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: BorderRadius.sm, borderWidth: 1 },
  majorAlertText: { fontSize: 13, fontWeight: '500', flex: 1 },
  group: { marginBottom: Spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderLeftWidth: 3, marginLeft: Spacing.lg, marginBottom: 6 },
  groupTitle: { fontSize: 13, fontWeight: '600' },
  intCard: { marginHorizontal: Spacing.lg, marginBottom: 8 },
  intHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  intDrugs: { fontSize: 14, fontWeight: '600', flex: 1 },
  intBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  intBadgeText: { fontSize: 11, fontWeight: '500' },
  intDesc: { fontSize: 12, lineHeight: 17, marginBottom: 10 },
  intManagement: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: BorderRadius.sm },
  intManagementText: { fontSize: 12, flex: 1, lineHeight: 17 },
  footerNote: { flexDirection: 'row', gap: 8, margin: Spacing.lg, padding: 12, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: BorderRadius.md },
  footerText: { fontSize: 11, lineHeight: 16, flex: 1 },
});
