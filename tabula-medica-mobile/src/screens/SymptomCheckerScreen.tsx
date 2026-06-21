import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Feather } from '@expo/vector-icons';
import api from '../services/api';

type Urgency = 'SELF_CARE' | 'PRIMARY_CARE' | 'URGENT_CARE' | 'ER';

interface TriageResult {
  urgency: Urgency;
  recommendedAction: string;
  rationale: string;
  selfCareSteps: string[];
  whenToSeekCare: string[];
  redFlagRuleId?: string;
  modelGenerated: boolean;
  disclaimer: string;
}

interface SymptomSession {
  id: string;
  transcript: { bodyRegion: string; symptoms: string[]; severity: number };
  triageResult: TriageResult;
  createdAt: string;
}

const BODY_REGIONS = [
  { id: 'head', label: 'Head / face' },
  { id: 'chest', label: 'Chest' },
  { id: 'abdomen', label: 'Abdomen / stomach' },
  { id: 'back', label: 'Back' },
  { id: 'arms', label: 'Arms / shoulders' },
  { id: 'legs', label: 'Legs / hips' },
  { id: 'skin', label: 'Skin' },
  { id: 'general', label: 'General / whole body' },
  { id: 'mental', label: 'Mental / emotional' },
];

const COMMON_SYMPTOMS: Record<string, string[]> = {
  head: ['headache', 'dizziness', 'facial droop', 'slurred speech', 'vision change', 'ear pain'],
  chest: ['chest pain', 'shortness of breath', 'palpitations', 'cough', 'left arm pain'],
  abdomen: ['nausea', 'vomiting', 'abdominal pain', 'diarrhea', 'constipation', 'loss of appetite'],
  back: ['back pain', 'stiffness', 'muscle spasm'],
  arms: ['arm pain', 'weakness one side', 'numbness', 'tingling'],
  legs: ['leg pain', 'swelling', 'weakness', 'numbness'],
  skin: ['rash', 'itching', 'swelling face', 'uncontrolled bleeding'],
  general: ['fever', 'fatigue', 'chills', 'weight loss', 'night sweats'],
  mental: ['anxiety', 'low mood', 'suicidal thoughts', 'insomnia', 'panic'],
};

const ONSET_OPTIONS: Array<{ label: string; val: number | undefined }> = [
  { label: 'Just now', val: 1 },
  { label: 'A few hours', val: 6 },
  { label: 'Today', val: 12 },
  { label: '1–2 days', val: 36 },
  { label: '3–7 days', val: 120 },
  { label: '1–2 weeks', val: 240 },
  { label: 'Longer', val: 720 },
  { label: 'Not sure', val: undefined },
];

const URGENCY_META: Record<
  Urgency,
  { label: string; bg: string; border: string; badgeBg: string; iconName: keyof typeof Feather.glyphMap }
> = {
  ER: {
    label: 'Emergency — call 911',
    bg: '#FEE2E2',
    border: '#DC2626',
    badgeBg: '#DC2626',
    iconName: 'phone-call',
  },
  URGENT_CARE: {
    label: 'Urgent care today',
    bg: '#FEF3C7',
    border: '#D97706',
    badgeBg: '#D97706',
    iconName: 'alert-triangle',
  },
  PRIMARY_CARE: {
    label: 'Primary care soon',
    bg: '#DBEAFE',
    border: '#2563EB',
    badgeBg: '#2563EB',
    iconName: 'thermometer',
  },
  SELF_CARE: {
    label: 'Self-care may be appropriate',
    bg: '#D1FAE5',
    border: '#059669',
    badgeBg: '#059669',
    iconName: 'check-circle',
  },
};

const TOTAL_STEPS = 5;

export default function SymptomCheckerScreen() {
  const [step, setStep] = useState(0);
  const [bodyRegion, setBodyRegion] = useState<string>('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [onsetHours, setOnsetHours] = useState<number | undefined>(undefined);
  const [severity, setSeverity] = useState<number>(5);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<TriageResult | null>(null);

  const triageMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; result: TriageResult }>(
        '/api/symptom-checker/triage',
        {
          bodyRegion,
          symptoms,
          onsetHours,
          severity,
          notes: notes || undefined,
        },
      );
      return res.data;
    },
    onSuccess: (data) => {
      setResult(data.result);
      setStep(5);
    },
  });

  const sessionsQuery = useQuery({
    queryKey: ['symptom-checker-sessions'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; sessions: SymptomSession[] }>(
        '/api/symptom-checker/sessions',
      );
      return res.data;
    },
    staleTime: 60_000,
  });

  function reset() {
    setStep(0);
    setBodyRegion('');
    setSymptoms([]);
    setCustomSymptom('');
    setOnsetHours(undefined);
    setSeverity(5);
    setNotes('');
    setResult(null);
  }

  function toggleSymptom(s: string) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length >= 8 ? prev : [...prev, s],
    );
  }

  function addCustomSymptom() {
    const s = customSymptom.trim().toLowerCase();
    if (!s) return;
    if (symptoms.includes(s) || symptoms.length >= 8) return;
    setSymptoms((p) => [...p, s]);
    setCustomSymptom('');
  }

  const progressPct = step >= TOTAL_STEPS ? 100 : Math.round((step / TOTAL_STEPS) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Feather name="thermometer" size={28} color="#0F766E" />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.title} testID="text-page-title">Symptom Checker</Text>
          <Text style={styles.subtitle}>
            Answer a few questions to find out what level of care to seek.
          </Text>
        </View>
      </View>

      <View style={styles.disclaimer} testID="alert-disclaimer">
        <Feather name="shield" size={16} color="#92400E" />
        <Text style={styles.disclaimerText}>
          Not a medical diagnosis. This tool helps you decide what level of care to seek.
        </Text>
      </View>

      {step < TOTAL_STEPS && (
        <View style={styles.progressWrap}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>Step {step + 1} of {TOTAL_STEPS}</Text>
            <Text style={styles.progressText}>{progressPct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} testID="bar-progress" />
          </View>
        </View>
      )}

      {step === 0 && (
        <View style={styles.card} testID="card-step-region">
          <Text style={styles.cardTitle}>Where is the problem?</Text>
          <Text style={styles.cardSub}>Pick the body region most affected.</Text>
          <View style={styles.gridTwo}>
            {BODY_REGIONS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.choice, bodyRegion === r.id && styles.choiceActive]}
                onPress={() => setBodyRegion(r.id)}
                testID={`button-region-${r.id}`}
              >
                <Text style={[styles.choiceText, bodyRegion === r.id && styles.choiceTextActive]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.navRow}>
            <View />
            <PrimaryButton
              label="Next"
              disabled={!bodyRegion}
              onPress={() => setStep(1)}
              testID="button-step-next"
            />
          </View>
        </View>
      )}

      {step === 1 && (
        <View style={styles.card} testID="card-step-symptoms">
          <Text style={styles.cardTitle}>What are you feeling?</Text>
          <Text style={styles.cardSub}>Pick up to 8 symptoms. Add your own if you don't see them.</Text>
          <View style={styles.chipsWrap}>
            {(COMMON_SYMPTOMS[bodyRegion] ?? []).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, symptoms.includes(s) && styles.chipActive]}
                onPress={() => toggleSymptom(s)}
                testID={`badge-symptom-${s.replace(/\s+/g, '-')}`}
              >
                <Text style={[styles.chipText, symptoms.includes(s) && styles.chipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Add another symptom…"
              placeholderTextColor="#9CA3AF"
              value={customSymptom}
              onChangeText={setCustomSymptom}
              onSubmitEditing={addCustomSymptom}
              testID="input-custom-symptom"
            />
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={addCustomSymptom}
              testID="button-add-custom-symptom"
            >
              <Text style={styles.outlineBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {symptoms.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.cardSub}>Selected:</Text>
              <View style={styles.chipsWrap}>
                {symptoms.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, styles.chipActive]}
                    onPress={() => toggleSymptom(s)}
                    testID={`badge-selected-${s.replace(/\s+/g, '-')}`}
                  >
                    <Text style={[styles.chipText, styles.chipTextActive]}>{s} ×</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.navRow}>
            <SecondaryButton label="Back" onPress={() => setStep(0)} testID="button-step-back" />
            <PrimaryButton
              label="Next"
              disabled={symptoms.length === 0}
              onPress={() => setStep(2)}
              testID="button-step-next"
            />
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.card} testID="card-step-onset">
          <Text style={styles.cardTitle}>When did this start?</Text>
          <Text style={styles.cardSub}>An approximate time helps us judge urgency.</Text>
          <View style={styles.gridTwo}>
            {ONSET_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.choice, onsetHours === opt.val && styles.choiceActive]}
                onPress={() => setOnsetHours(opt.val)}
                testID={`button-onset-${opt.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Text style={[styles.choiceText, onsetHours === opt.val && styles.choiceTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.navRow}>
            <SecondaryButton label="Back" onPress={() => setStep(1)} testID="button-step-back" />
            <PrimaryButton label="Next" onPress={() => setStep(3)} testID="button-step-next" />
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.card} testID="card-step-severity">
          <Text style={styles.cardTitle}>How severe is it?</Text>
          <Text style={styles.cardSub}>1 = barely noticeable · 10 = worst you can imagine</Text>
          <View style={styles.severityRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.severityCell, severity === n && styles.severityCellActive]}
                onPress={() => setSeverity(n)}
                testID={`button-severity-${n}`}
              >
                <Text
                  style={[styles.severityText, severity === n && styles.severityTextActive]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.severityValue} testID="text-severity-value">
            {severity} / 10
          </Text>
          <TextInput
            style={[styles.customInput, { height: 80, textAlignVertical: 'top', marginTop: 12 }]}
            placeholder="Anything else you'd like to add? (optional)"
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, 2000))}
            multiline
            testID="input-notes"
          />
          <View style={styles.navRow}>
            <SecondaryButton label="Back" onPress={() => setStep(2)} testID="button-step-back" />
            <PrimaryButton label="Next" onPress={() => setStep(4)} testID="button-step-next" />
          </View>
        </View>
      )}

      {step === 4 && (
        <View style={styles.card} testID="card-step-review">
          <Text style={styles.cardTitle}>Review and submit</Text>
          <Text style={styles.cardSub}>
            We'll combine your answers with safety rules to suggest a level of care.
          </Text>
          <ReviewRow label="Region" value={bodyRegion} testID="review-region" />
          <ReviewRow label="Symptoms" value={symptoms.join(', ')} testID="review-symptoms" />
          <ReviewRow
            label="Onset"
            value={onsetHours == null ? 'Not sure' : `${onsetHours} h`}
            testID="review-onset"
          />
          <ReviewRow label="Severity" value={`${severity}/10`} testID="review-severity" />
          {!!notes && <ReviewRow label="Notes" value={notes} testID="review-notes" />}
          <View style={styles.navRow}>
            <SecondaryButton label="Back" onPress={() => setStep(3)} testID="button-step-back" />
            <PrimaryButton
              label={triageMutation.isPending ? 'Analyzing…' : 'Get recommendation'}
              disabled={triageMutation.isPending}
              onPress={() => triageMutation.mutate()}
              testID="button-submit-triage"
            />
          </View>
          {triageMutation.isError && (
            <Text style={styles.errorText}>
              Something went wrong. Please check your connection and try again.
            </Text>
          )}
        </View>
      )}

      {step === 5 && result && <ResultView result={result} onReset={reset} />}

      {step < TOTAL_STEPS &&
        sessionsQuery.data?.sessions &&
        sessionsQuery.data.sessions.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <Text style={styles.sectionTitle}>Your recent checks</Text>
            {sessionsQuery.data.sessions.slice(0, 5).map((s) => {
              const meta = URGENCY_META[s.triageResult.urgency];
              return (
                <View key={s.id} style={styles.sessionCard} testID={`card-session-${s.id}`}>
                  <Feather name={meta.iconName} size={18} color="#6B7280" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.sessionTitle} numberOfLines={1}>
                      {s.transcript.bodyRegion} · {s.transcript.symptoms.slice(0, 3).join(', ')}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {new Date(s.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: meta.badgeBg }]}>
                    <Text style={styles.badgeText}>{meta.label}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
    </ScrollView>
  );
}

function ReviewRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}: </Text>
      <Text style={styles.reviewValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity style={styles.secondaryBtn} onPress={onPress} testID={testID}>
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ResultView({ result, onReset }: { result: TriageResult; onReset: () => void }) {
  const meta = URGENCY_META[result.urgency];
  return (
    <View
      style={[styles.card, { backgroundColor: meta.bg, borderColor: meta.border, borderWidth: 2 }]}
      testID="card-result"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Feather name={meta.iconName} size={28} color={meta.border} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={[styles.badge, { backgroundColor: meta.badgeBg, alignSelf: 'flex-start' }]}>
            <Text style={styles.badgeText} testID="badge-urgency">{meta.label}</Text>
          </View>
          <Text style={[styles.cardTitle, { marginTop: 8 }]} testID="text-result-action">
            {result.recommendedAction}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Why</Text>
      <Text style={styles.bodyText} testID="text-result-rationale">
        {result.rationale}
      </Text>

      {result.selfCareSteps.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>What you can do</Text>
          <View testID="list-self-care">
            {result.selfCareSteps.map((s, i) => (
              <Text key={i} style={styles.bullet}>• {s}</Text>
            ))}
          </View>
        </>
      )}

      {result.whenToSeekCare.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Seek care sooner if</Text>
          <View testID="list-when-to-seek">
            {result.whenToSeekCare.map((s, i) => (
              <Text key={i} style={styles.bullet}>• {s}</Text>
            ))}
          </View>
        </>
      )}

      <View style={styles.divider} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <Feather name="shield" size={14} color="#6B7280" />
        <Text style={styles.smallMuted} testID="text-disclaimer">
          {result.disclaimer}
        </Text>
      </View>

      <View style={styles.navRow}>
        <SecondaryButton label="Start over" onPress={onReset} testID="button-start-over" />
        {result.urgency === 'ER' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#DC2626' }]}
            onPress={() => Linking.openURL('tel:911')}
            testID="link-call-911"
          >
            <Feather name="phone-call" size={16} color="#fff" />
            <Text style={[styles.primaryBtnText, { marginLeft: 6 }]}>Call 911</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  disclaimerText: { flex: 1, fontSize: 12, color: '#92400E' },
  progressWrap: { marginBottom: 12 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressText: { fontSize: 12, color: '#6B7280' },
  progressTrack: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0F766E' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
  gridTwo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  choiceActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  choiceText: { fontSize: 14, color: '#111827', fontWeight: '500' },
  choiceTextActive: { color: '#fff' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0F766E',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#0F766E' },
  chipText: { fontSize: 13, color: '#0F766E' },
  chipTextActive: { color: '#fff' },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  customInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  outlineBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0F766E',
    borderRadius: 8,
  },
  outlineBtnText: { color: '#0F766E', fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 8 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F766E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  secondaryBtnText: { color: '#374151', fontWeight: '500', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
  severityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  severityCell: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityCellActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  severityText: { fontSize: 14, color: '#111827' },
  severityTextActive: { color: '#fff', fontWeight: '700' },
  severityValue: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 28,
    fontWeight: '700',
    color: '#0F766E',
  },
  reviewRow: { flexDirection: 'row', marginBottom: 6, flexWrap: 'wrap' },
  reviewLabel: { fontSize: 14, color: '#6B7280' },
  reviewValue: { fontSize: 14, color: '#111827', flex: 1, flexWrap: 'wrap' },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sessionTitle: { fontSize: 13, color: '#111827', fontWeight: '500' },
  sessionDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 4 },
  bodyText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  bullet: { fontSize: 13, color: '#374151', marginBottom: 4, lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 12 },
  smallMuted: { flex: 1, fontSize: 11, color: '#6B7280', lineHeight: 15 },
});
