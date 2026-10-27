/**
 * OnboardingProviderScreen — simplified 3-step provider onboarding wizard
 * for the mobile (React Native / Expo) client.
 *
 * Step 1: Persona & organization details → calls /api/onboarding/provider/start
 *         on "Next" so that a sessionId is available for the FHIR test in step 2.
 * Step 2: FHIR endpoint test (optional) — uses sessionId already created
 * Step 3: Review & submit remaining steps
 */

import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";

// ─── Types ─────────────────────────────────────────────────────────────────

type ProviderPersona = "provider" | "lab" | "radiology" | "hospital" | "dpc";

const PERSONAS: { id: ProviderPersona; label: string }[] = [
  { id: "provider",  label: "Individual Provider" },
  { id: "lab",       label: "Clinical Laboratory" },
  { id: "radiology", label: "Radiology / Imaging" },
  { id: "hospital",  label: "Hospital / Health System" },
  { id: "dpc",       label: "DPC Practice" },
];

// ─── API helpers ───────────────────────────────────────────────────────────

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await apiRequest("POST", path, body);
  if (!resp.ok) {
    const err = (await resp.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function OnboardingProviderScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [persona, setPersona] = useState<ProviderPersona>("provider");
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [npiNumber, setNpiNumber] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const [fhirUrl, setFhirUrl] = useState("");
  const [fhirTesting, setFhirTesting] = useState(false);
  const [fhirStatus, setFhirStatus] = useState<"idle" | "ok" | "fail">("idle");

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // ── Step 1 → 2: start session ─────────────────────────────────────────

  const handleStep1Next = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const data = await apiPost<{ session: { sessionId: string } }>(
        "/api/onboarding/provider/start",
        {
          persona,
          orgName: orgName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          npiNumber: npiNumber.trim() || undefined,
        },
      );
      setSessionId(data.session.sessionId);
      // Immediately complete the org_info step
      await apiPost("/api/onboarding/provider/step", {
        sessionId: data.session.sessionId,
        stepId: "org_info",
        data: { confirmed: true },
      });
      setStep(2);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not start session");
    } finally {
      setAdvancing(false);
    }
  }, [advancing, persona, orgName, contactEmail, npiNumber]);

  // ── Step 2: FHIR test ─────────────────────────────────────────────────

  const handleFhirTest = useCallback(async () => {
    if (!sessionId || !fhirUrl.trim()) return;
    setFhirTesting(true);
    try {
      const data = await apiPost<{ result: { ok: boolean; error?: string } }>(
        "/api/onboarding/provider/test-fhir",
        { sessionId, fhirBaseUrl: fhirUrl.trim() },
      );
      setFhirStatus(data.result.ok ? "ok" : "fail");
    } catch {
      setFhirStatus("fail");
    } finally {
      setFhirTesting(false);
    }
  }, [sessionId, fhirUrl]);

  // ── Step 2 → 3 ────────────────────────────────────────────────────────

  const handleStep2Next = useCallback(() => setStep(3), []);

  // ── Step 3: submit remaining steps ────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (submitting || !sessionId) return;
    setSubmitting(true);
    try {
      // Advance FHIR step (skip if no URL)
      const fhirStepId = persona === "radiology" ? "dicom_endpoint" : "fhir_test";
      await apiPost("/api/onboarding/provider/step", {
        sessionId,
        stepId: fhirStepId,
        ...(fhirUrl.trim()
          ? { data: { fhirBaseUrl: fhirUrl.trim() } }
          : { skip: true }),
      }).catch(() => {/* non-blocking — step may not exist for this persona */});

      setDone(true);
    } catch (err: unknown) {
      Alert.alert("Error", err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, sessionId, persona, fhirUrl]);

  // ── Render ────────────────────────────────────────────────────────────

  const styles = buildStyles(theme);

  if (done) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.successContainer}>
          <ThemedText type="title" style={styles.successTitle} testID="text-onboarding-done">
            Onboarding Submitted
          </ThemedText>
          <ThemedText type="body" style={styles.successSub}>
            Your organization details have been saved. Our team will reach out within 1 business day.
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {([1, 2, 3] as const).map((n) => (
          <View
            key={n}
            style={[
              styles.dot,
              { backgroundColor: step >= n ? theme.primary : theme.border },
            ]}
          />
        ))}
      </View>

      {/* Step 1: Persona + org details */}
      {step === 1 && (
        <View style={styles.stepContainer}>
          <ThemedText type="title" style={styles.stepTitle}>Your Organization</ThemedText>
          <ThemedText type="body" style={[styles.stepSub, { color: theme.textSecondary }]}>
            Tell us about your practice or organization
          </ThemedText>

          <View style={styles.personaGrid}>
            {PERSONAS.map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`button-persona-${p.id}`}
                onPress={() => setPersona(p.id)}
                style={[
                  styles.personaCard,
                  {
                    backgroundColor: persona === p.id ? theme.primary + "22" : theme.surface,
                    borderColor: persona === p.id ? theme.primary : theme.border,
                  },
                ]}
              >
                <ThemedText
                  type="caption"
                  style={[
                    styles.personaLabel,
                    { color: persona === p.id ? theme.primary : theme.textPrimary },
                  ]}
                >
                  {p.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
              Organization / Practice Name *
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
              placeholder="e.g. Riverside Family Medicine"
              placeholderTextColor={theme.textTertiary}
              value={orgName}
              onChangeText={setOrgName}
              testID="input-orgName"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
              Contact Email *
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
              placeholder="admin@yourpractice.com"
              placeholderTextColor={theme.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={contactEmail}
              onChangeText={setContactEmail}
              testID="input-contactEmail"
            />
          </View>

          {(persona === "provider" || persona === "dpc") && (
            <View style={styles.fieldGroup}>
              <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
                NPI Number (optional)
              </ThemedText>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
                placeholder="10-digit NPI"
                placeholderTextColor={theme.textTertiary}
                keyboardType="number-pad"
                maxLength={10}
                value={npiNumber}
                onChangeText={(t) => setNpiNumber(t.replace(/\D/g, ""))}
                testID="input-npiNumber"
              />
            </View>
          )}

          <TouchableOpacity
            testID="button-next-step1"
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary },
              (!orgName.trim() || !contactEmail.includes("@") || advancing) && styles.buttonDisabled,
            ]}
            onPress={handleStep1Next}
            disabled={!orgName.trim() || !contactEmail.includes("@") || advancing}
          >
            {advancing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Next: FHIR Endpoint</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Step 2: FHIR endpoint (optional) */}
      {step === 2 && (
        <View style={styles.stepContainer}>
          <ThemedText type="title" style={styles.stepTitle}>FHIR Endpoint</ThemedText>
          <ThemedText type="body" style={[styles.stepSub, { color: theme.textSecondary }]}>
            Optionally connect your EHR via FHIR R4. You can add this later.
          </ThemedText>

          <View style={styles.fieldGroup}>
            <ThemedText type="caption" style={[styles.label, { color: theme.textSecondary }]}>
              FHIR R4 Base URL (optional)
            </ThemedText>
            <TextInput
              style={[styles.input, { borderColor: theme.border, color: theme.textPrimary, backgroundColor: theme.surface }]}
              placeholder="https://ehr.example.com/fhir/r4"
              placeholderTextColor={theme.textTertiary}
              autoCapitalize="none"
              keyboardType="url"
              value={fhirUrl}
              onChangeText={(t) => { setFhirUrl(t); setFhirStatus("idle"); }}
              testID="input-fhirUrl"
            />
          </View>

          {fhirUrl.trim().length > 0 && (
            <TouchableOpacity
              testID="button-test-fhir"
              style={[styles.outlineButton, { borderColor: theme.primary }]}
              onPress={handleFhirTest}
              disabled={fhirTesting}
            >
              {fhirTesting ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <ThemedText style={[styles.outlineButtonText, { color: theme.primary }]}>
                  Test Connection
                </ThemedText>
              )}
            </TouchableOpacity>
          )}

          {fhirStatus === "ok" && (
            <View style={[styles.statusBanner, { backgroundColor: "#d1fae5", borderColor: "#6ee7b7" }]}>
              <ThemedText style={{ color: "#065f46", fontSize: 13 }}>FHIR endpoint reachable</ThemedText>
            </View>
          )}
          {fhirStatus === "fail" && (
            <View style={[styles.statusBanner, { backgroundColor: "#fee2e2", borderColor: "#fca5a5" }]}>
              <ThemedText style={{ color: "#991b1b", fontSize: 13 }}>
                Could not reach endpoint — check the URL and try again
              </ThemedText>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              testID="button-back-step2"
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => setStep(1)}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Back</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              testID="button-next-step2"
              style={[styles.primaryButton, { backgroundColor: theme.primary, flex: 1 }]}
              onPress={handleStep2Next}
            >
              <ThemedText style={styles.primaryButtonText}>Review</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <View style={styles.stepContainer}>
          <ThemedText type="title" style={styles.stepTitle}>Review & Submit</ThemedText>
          <ThemedText type="body" style={[styles.stepSub, { color: theme.textSecondary }]}>
            Confirm your details before we finalize your account
          </ThemedText>

          <View style={[styles.reviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ReviewRow label="Type"         value={PERSONAS.find((p) => p.id === persona)?.label ?? persona} theme={theme} />
            <ReviewRow label="Organization" value={orgName} theme={theme} />
            <ReviewRow label="Email"        value={contactEmail} theme={theme} />
            {npiNumber.length > 0 && <ReviewRow label="NPI" value={npiNumber} theme={theme} />}
            {fhirUrl.length > 0   && <ReviewRow label="FHIR URL" value={fhirUrl} theme={theme} />}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              testID="button-back-step3"
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => setStep(2)}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Back</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              testID="button-submit-onboarding"
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, flex: 1 },
                submitting && styles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Submit</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function ReviewRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  return (
    <View style={reviewRowStyles.row}>
      <ThemedText type="caption" style={[reviewRowStyles.label, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <ThemedText type="body" style={[reviewRowStyles.value, { color: theme.textPrimary }]}>
        {value}
      </ThemedText>
    </View>
  );
}

const reviewRowStyles = StyleSheet.create({
  row:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  label: { fontSize: 12 },
  value: { fontSize: 14, fontWeight: "500", maxWidth: "65%", textAlign: "right" },
});

// ─── Styles ─────────────────────────────────────────────────────────────────

function buildStyles(theme: ReturnType<typeof useTheme>["theme"]) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { paddingHorizontal: 20 },
    dotsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    stepContainer: { gap: 16 },
    stepTitle: { fontSize: 22, fontWeight: "700" },
    stepSub: { fontSize: 14, lineHeight: 20, marginTop: -8 },
    personaGrid: { gap: 8 },
    personaCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    personaLabel: { fontSize: 13, fontWeight: "500" },
    fieldGroup: { gap: 4 },
    label: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    primaryButton: {
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
    outlineButton: {
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      borderWidth: 1.5,
    },
    outlineButtonText: { fontWeight: "600", fontSize: 14 },
    statusBanner: { borderWidth: 1, borderRadius: 8, padding: 10 },
    buttonRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    secondaryButton: {
      borderRadius: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
      alignItems: "center",
      borderWidth: 1,
    },
    reviewCard: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 2 },
    buttonDisabled: { opacity: 0.5 },
    successContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 24 },
    successTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
    successSub: { textAlign: "center", color: "#6b7280", lineHeight: 22 },
  });
}
