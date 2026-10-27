import React, { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity,
  StyleSheet, Share, Alert,
} from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Card } from '@/components/Card';
import { LoadingState } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/query-client';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';

interface PriorAuthItem {
  id: string;
  type: 'medication' | 'procedure' | 'imaging' | 'referral';
  name: string;
  reason: string;
  status: 'action_needed' | 'pending' | 'approved' | 'denied' | 'appealing';
  insurancePlan?: string;
  submittedDate?: string;
  decisionDate?: string;
  urgency: 'routine' | 'urgent' | 'emergent';
  estimatedCostWithout?: number;
  letterGenerated?: boolean;
}

interface PALetter {
  content: string;
  generatedAt: string;
  itemName: string;
}

const STATUS_CONFIG: Record<PriorAuthItem['status'], {
  label: string; color: string; bg: string; icon: keyof typeof Feather.glyphMap;
}> = {
  action_needed: { label: 'Action needed', color: '#FF3B30', bg: 'rgba(255,59,48,0.1)', icon: 'alert-circle' },
  pending:        { label: 'Pending review', color: '#FF9F0A', bg: 'rgba(255,159,10,0.1)', icon: 'clock' },
  approved:       { label: 'Approved',       color: '#34C759', bg: 'rgba(52,199,89,0.1)',  icon: 'check-circle' },
  denied:         { label: 'Denied',          color: '#FF3B30', bg: 'rgba(255,59,48,0.1)', icon: 'x-circle' },
  appealing:      { label: 'Appeal filed',    color: '#007AFF', bg: 'rgba(0,122,255,0.1)',  icon: 'refresh-cw' },
};

const URGENCY_CONFIG: Record<PriorAuthItem['urgency'], { label: string; color: string }> = {
  routine:  { label: 'Routine',  color: '#8E8E93' },
  urgent:   { label: 'Urgent',   color: '#FF9F0A' },
  emergent: { label: 'Emergent', color: '#FF3B30' },
};

export default function PriorAuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedItem, setSelectedItem] = useState<PriorAuthItem | null>(null);
  const [generatedLetter, setGeneratedLetter] = useState<PALetter | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/prior-auth/items'],
  });

  const generateMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await apiRequest('POST', '/api/prior-auth/generate-letter', { itemId });
      return res.json() as Promise<PALetter>;
    },
    onSuccess: (letter) => {
      setGeneratedLetter(letter);
    },
    onError: () => {
      Alert.alert('Could not generate letter', 'Please try again or contact your provider directly.');
    },
  });

  const items = (data as any)?.items ?? [];
  const actionItems = items.filter((i: PriorAuthItem) => i.status === 'action_needed' || i.status === 'denied');
  const pendingItems = items.filter((i: PriorAuthItem) => i.status === 'pending' || i.status === 'appealing');
  const resolvedItems = items.filter((i: PriorAuthItem) => i.status === 'approved');

  async function handleShare(letter: PALetter) {
    try {
      await Share.share({
        title: `Prior Authorization: ${letter.itemName}`,
        message: letter.content,
      });
    } catch {
    }
  }

  if (generatedLetter) {
    return (
      <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
            <TouchableOpacity
              onPress={() => setGeneratedLetter(null)}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={24} color={theme.primary} />
              <ThemedText style={[styles.backText, { color: theme.primary }]}>Back</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={{ paddingHorizontal: Spacing.lg }}>
            <ThemedText style={styles.pageTitle}>PA Justification Letter</ThemedText>
            <ThemedText style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
              Generated from your health record. Share this with your provider to submit.
            </ThemedText>
          </View>

          <Card style={{ margin: Spacing.lg }}>
            <ThemedText style={[styles.letterText, { color: theme.text }]}>
              {generatedLetter.content}
            </ThemedText>
          </Card>

          <View style={styles.letterActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
              onPress={() => handleShare(generatedLetter)}
              accessibilityRole="button"
              testID="button-share-letter"
            >
              <Feather name="share-2" size={16} color="#fff" />
              <ThemedText style={styles.primaryBtnText}>Send to provider</ThemedText>
            </TouchableOpacity>

            <ThemedText style={[styles.letterNote, { color: theme.textSecondary }]}>
              Your provider needs to submit this letter to your insurance company.
              Share it with them via your patient portal, fax, or at your next visit.
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <ThemedText style={styles.pageTitle}>Prior authorization</ThemedText>
          <ThemedText style={[styles.pageSubtitle, { color: theme.textSecondary }]}>
            Insurance pre-approvals for your medications and procedures
          </ThemedText>
        </View>

        <Animated.View entering={FadeInDown}>
          <Card style={styles.explainerCard}>
            <ThemedText style={[styles.explainerTitle, { color: theme.text }]}>
              What is prior authorization?
            </ThemedText>
            <ThemedText style={[styles.explainerBody, { color: theme.textSecondary }]}>
              Some insurance plans require your doctor to get permission before
              they'll pay for certain medications or procedures. This is called
              prior authorization (PA). Tabula Medica can generate the paperwork
              your doctor needs — using your own health record.
            </ThemedText>
          </Card>
        </Animated.View>

        {isLoading ? (
          <LoadingState message="Checking your coverage..." />
        ) : items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Feather name="check-circle" size={32} color={theme.success} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              No prior authorizations needed
            </ThemedText>
            <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Your current medications and upcoming procedures don't appear
              to require pre-approval from your insurance.
            </ThemedText>
          </Card>
        ) : (
          <>
            {actionItems.length > 0 ? (
              <Section title="Needs your attention" count={actionItems.length}>
                {actionItems.map((item: PriorAuthItem, i: number) => (
                  <PACard
                    key={item.id}
                    item={item}
                    index={i}
                    theme={theme}
                    onGenerate={() => {
                      setSelectedItem(item);
                      generateMutation.mutate(item.id);
                    }}
                    isGenerating={generateMutation.isPending && selectedItem?.id === item.id}
                  />
                ))}
              </Section>
            ) : null}

            {pendingItems.length > 0 ? (
              <Section title="In progress" count={pendingItems.length}>
                {pendingItems.map((item: PriorAuthItem, i: number) => (
                  <PACard key={item.id} item={item} index={i} theme={theme} />
                ))}
              </Section>
            ) : null}

            {resolvedItems.length > 0 ? (
              <Section title="Approved" count={resolvedItems.length}>
                {resolvedItems.map((item: PriorAuthItem, i: number) => (
                  <PACard key={item.id} item={item} index={i} theme={theme} />
                ))}
              </Section>
            ) : null}
          </>
        )}

        <View style={styles.helpRow}>
          <Feather name="info" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.helpText, { color: theme.textSecondary }]}>
            Call your insurance company's member services line if a prior auth is taking
            more than 3 business days. Ask for an "expedited review" if medically urgent.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Section({
  title, count, children,
}: {
  title: string; count: number; children: React.ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
          {count}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

function PACard({
  item, index, theme, onGenerate, isGenerating,
}: {
  item: PriorAuthItem;
  index: number;
  theme: any;
  onGenerate?: () => void;
  isGenerating?: boolean;
}) {
  const status = STATUS_CONFIG[item.status];
  const urgency = URGENCY_CONFIG[item.urgency];

  return (
    <Animated.View entering={FadeInDown.delay(index * 70)}>
      <Card style={styles.paCard}>
        <View style={styles.paHeader}>
          <View style={styles.paInfo}>
            <ThemedText style={styles.paName}>{item.name}</ThemedText>
            <ThemedText style={[styles.paReason, { color: theme.textSecondary }]}>
              {item.reason}
            </ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Feather name={status.icon} size={11} color={status.color} />
            <ThemedText style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.paDetails}>
          {item.urgency !== 'routine' ? (
            <View style={[styles.urgencyChip, { borderColor: urgency.color + '40' }]}>
              <ThemedText style={[styles.urgencyText, { color: urgency.color }]}>
                {urgency.label}
              </ThemedText>
            </View>
          ) : null}
          {item.insurancePlan ? (
            <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
              {item.insurancePlan}
            </ThemedText>
          ) : null}
          {item.estimatedCostWithout ? (
            <ThemedText style={[styles.costText, { color: '#FF3B30' }]}>
              ${item.estimatedCostWithout.toLocaleString()} without approval
            </ThemedText>
          ) : null}
        </View>

        {(item.status === 'action_needed' || item.status === 'denied') && onGenerate ? (
          <TouchableOpacity
            style={[styles.generateBtn, { backgroundColor: theme.primary }]}
            onPress={onGenerate}
            disabled={isGenerating}
            accessibilityRole="button"
            accessibilityLabel={`Generate prior authorization letter for ${item.name}`}
            testID={`button-generate-pa-${item.id}`}
          >
            <Feather name="file-text" size={14} color="#fff" />
            <ThemedText style={styles.generateBtnText}>
              {isGenerating ? 'Generating letter...' :
               item.status === 'denied' ? 'Generate appeal letter' :
               'Generate PA letter'}
            </ThemedText>
          </TouchableOpacity>
        ) : null}

        {item.submittedDate ? (
          <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
            Submitted {item.submittedDate}
            {item.decisionDate ? ` · Decision ${item.decisionDate}` : ''}
          </ThemedText>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.md },
  backText: { fontSize: 16 },
  pageTitle: { fontSize: Typography.h2.fontSize, fontWeight: '700', marginBottom: 4, letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, lineHeight: 19 },
  explainerCard: { margin: Spacing.lg, marginTop: 4 },
  explainerTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  explainerBody: { fontSize: 13, lineHeight: 19 },
  emptyCard: { margin: Spacing.lg, alignItems: 'center', gap: 10, paddingVertical: 28 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  section: { marginBottom: Spacing.md },
  sectionHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  sectionCount: { fontSize: 13 },
  paCard: { marginHorizontal: Spacing.lg, marginBottom: 8 },
  paHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  paInfo: { flex: 1 },
  paName: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  paReason: { fontSize: 12, lineHeight: 17 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: '500' },
  paDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  urgencyChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5 },
  urgencyText: { fontSize: 11, fontWeight: '500' },
  detailText: { fontSize: 11 },
  costText: { fontSize: 11, fontWeight: '500' },
  generateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: BorderRadius.sm,
  },
  generateBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 11, marginTop: 6 },
  letterText: { fontSize: 13, lineHeight: 22 },
  letterActions: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  letterNote: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  helpRow: {
    flexDirection: 'row', gap: 8, margin: Spacing.lg,
    padding: 12, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: BorderRadius.md,
  },
  helpText: { fontSize: 12, lineHeight: 17, flex: 1 },
});
