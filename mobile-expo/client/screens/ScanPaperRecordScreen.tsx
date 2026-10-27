import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, Platform, ActivityIndicator, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import { useAuthContext } from "@/context/AuthContext";

type DocType =
  | "lab_report" | "discharge_summary" | "progress_note"
  | "radiology_report" | "pathology_report" | "prescription"
  | "referral_letter" | "insurance_eob" | "operative_report";

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "progress_note", label: "Visit / Progress Note" },
  { value: "lab_report", label: "Lab Report" },
  { value: "prescription", label: "Prescription" },
  { value: "radiology_report", label: "Imaging / Radiology" },
  { value: "discharge_summary", label: "Discharge Summary" },
  { value: "operative_report", label: "Operative Report" },
  { value: "pathology_report", label: "Pathology" },
  { value: "referral_letter", label: "Referral Letter" },
  { value: "insurance_eob", label: "Insurance EOB" },
];

interface ExtractedField {
  key: string;
  label: string;
  value: string | number;
  unit?: string;
  confidence: number;
}

interface ExtractionResult {
  id: string;
  status: string;
  overallConfidence: number;
  quality: { grade: string; dpi: number };
  consensusFields: ExtractedField[];
  conflicts: { fieldKey: string; resolved: boolean }[];
  reviewNotes?: string[];
}

export default function ScanPaperRecordScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { user } = useAuthContext();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("progress_note");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [cameraPerm, requestCameraPerm] = ImagePicker.useCameraPermissions();
  const [libraryPerm, requestLibraryPerm] = ImagePicker.useMediaLibraryPermissions();

  const openSettingsSafely = useCallback(async () => {
    if (Platform.OS === "web") return;
    try { await Linking.openSettings(); } catch {}
  }, []);

  const ensureCamera = useCallback(async () => {
    if (Platform.OS === "web") { setError("Camera capture isn't available on web — use Choose from Library."); return false; }
    if (!cameraPerm) return false;
    if (cameraPerm.granted) return true;
    if (!cameraPerm.canAskAgain) { await openSettingsSafely(); return false; }
    const r = await requestCameraPerm();
    return r.granted;
  }, [cameraPerm, requestCameraPerm, openSettingsSafely]);

  const ensureLibrary = useCallback(async () => {
    if (!libraryPerm) return false;
    if (libraryPerm.granted) return true;
    if (!libraryPerm.canAskAgain) { await openSettingsSafely(); return false; }
    const r = await requestLibraryPerm();
    return r.granted;
  }, [libraryPerm, requestLibraryPerm, openSettingsSafely]);

  const handleCapture = useCallback(async () => {
    Haptics.selectionAsync();
    setError(null); setResult(null);
    if (!(await ensureCamera())) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) setImageUri(r.assets[0].uri);
  }, [ensureCamera]);

  const handlePick = useCallback(async () => {
    Haptics.selectionAsync();
    setError(null); setResult(null);
    if (!(await ensureLibrary())) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      exif: false,
    });
    if (!r.canceled && r.assets[0]) setImageUri(r.assets[0].uri);
  }, [ensureLibrary]);

  const handleExtract = useCallback(async () => {
    if (!imageUri) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const form = new FormData();
      const ext = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const mime = ext === "png" ? "image/png" : ext === "heic" ? "image/heic" : "image/jpeg";
      if (Platform.OS === "web") {
        const blob = await (await fetch(imageUri)).blob();
        form.append("file", blob, `scan.${ext}`);
      } else {
        form.append("file", { uri: imageUri, name: `scan.${ext}`, type: mime } as any);
      }
      form.append("documentType", docType);

      const url = new URL("/api/scan/paper-record", getApiUrl());
      const headers: Record<string, string> = {};
      if (user?.id) headers["x-user-id"] = user.id;
      const res = await fetch(url.toString(), { method: "POST", body: form, headers, credentials: "include" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Server returned ${res.status}: ${text || "extraction failed"}`);
      }
      const data = await res.json();
      setResult(data.extraction);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setError(e?.message || "Failed to extract document");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  }, [imageUri, docType, user?.id]);

  const handleReset = useCallback(() => {
    setImageUri(null); setResult(null); setError(null);
  }, []);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.backgroundDefault },
    content: { paddingHorizontal: Spacing.lg, paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
    intro: { color: theme.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
    sectionTitle: { fontSize: 13, fontWeight: "700", color: theme.textSecondary, letterSpacing: 0.5, marginTop: Spacing.lg, marginBottom: Spacing.sm, textTransform: "uppercase" },
    typeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
    typeChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
    typeChipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    typeChipText: { fontSize: 13, color: theme.text },
    typeChipTextActive: { color: "#fff", fontWeight: "600" },
    previewBox: { aspectRatio: 4 / 5, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundDefault, alignItems: "center", justifyContent: "center", overflow: "hidden", marginBottom: Spacing.md },
    previewImg: { width: "100%", height: "100%", resizeMode: "cover" },
    placeholderText: { color: theme.textSecondary, fontSize: 14, marginTop: Spacing.sm },
    btnRow: { flexDirection: "row", gap: Spacing.sm },
    btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundDefault },
    btnPrimary: { backgroundColor: theme.primary, borderColor: theme.primary },
    btnText: { fontSize: 15, fontWeight: "600", color: theme.text },
    btnTextPrimary: { color: "#fff" },
    btnDisabled: { opacity: 0.5 },
    errorBox: { padding: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: "#FEE", borderWidth: 1, borderColor: theme.error ?? "#C33", marginTop: Spacing.md },
    errorText: { color: theme.error ?? "#C33", fontSize: 14 },
    resultCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.backgroundDefault, marginTop: Spacing.md },
    resultHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
    resultTitle: { fontSize: 16, fontWeight: "700", color: theme.text },
    badge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, fontSize: 11, fontWeight: "700" },
    fieldRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs, borderTopWidth: 1, borderTopColor: theme.border },
    fieldLabel: { fontSize: 13, color: theme.textSecondary, flex: 1 },
    fieldValue: { fontSize: 13, color: theme.text, fontWeight: "600" },
    notice: { fontSize: 12, color: theme.textSecondary, marginTop: Spacing.md, fontStyle: "italic" },
  });

  const status = result?.status;
  const badgeStyle = (s?: string) => {
    if (s === "verified" || s === "auto_passed") return { backgroundColor: "#10B98122", color: "#047857" };
    if (s === "needs_review" || s === "conflict") return { backgroundColor: "#F59E0B22", color: "#B45309" };
    if (s === "manual_scan_required" || s === "rejected") return { backgroundColor: "#EF444422", color: "#B91C1C" };
    return { backgroundColor: theme.border, color: theme.textSecondary };
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} scrollIndicatorInsets={{ bottom: insets.bottom }}>
      <ThemedText style={styles.intro}>
        Take a photo or pick an image of a paper medical record. We'll run quality checks and AI-assisted extraction so the data can be added to your timeline.
      </ThemedText>

      <ThemedText style={styles.sectionTitle}>Document Type</ThemedText>
      <View style={styles.typeRow}>
        {DOC_TYPES.map((t) => {
          const active = t.value === docType;
          return (
            <Pressable
              key={t.value}
              testID={`chip-doctype-${t.value}`}
              onPress={() => { Haptics.selectionAsync(); setDocType(t.value); }}
              style={[styles.typeChip, active && styles.typeChipActive]}
            >
              <ThemedText style={[styles.typeChipText, active && styles.typeChipTextActive]}>{t.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={styles.sectionTitle}>Image</ThemedText>
      <View style={styles.previewBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImg} />
        ) : (
          <>
            <Feather name="camera" size={36} color={theme.textSecondary} />
            <ThemedText style={styles.placeholderText}>No image selected</ThemedText>
          </>
        )}
      </View>

      <View style={styles.btnRow}>
        <Pressable testID="button-scan-capture" onPress={handleCapture} style={styles.btn} disabled={busy}>
          <Feather name="camera" size={18} color={theme.text} />
          <ThemedText style={styles.btnText}>Take Photo</ThemedText>
        </Pressable>
        <Pressable testID="button-scan-pick" onPress={handlePick} style={styles.btn} disabled={busy}>
          <Feather name="image" size={18} color={theme.text} />
          <ThemedText style={styles.btnText}>Choose Image</ThemedText>
        </Pressable>
      </View>

      <View style={{ height: Spacing.md }} />

      <Pressable
        testID="button-scan-extract"
        onPress={handleExtract}
        style={[styles.btn, styles.btnPrimary, (!imageUri || busy) && styles.btnDisabled]}
        disabled={!imageUri || busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Feather name="zap" size={18} color="#fff" />}
        <ThemedText style={[styles.btnText, styles.btnTextPrimary]}>
          {busy ? "Extracting…" : "Extract with AI"}
        </ThemedText>
      </Pressable>

      {error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}

      {result ? (
        <View testID="result-extraction" style={styles.resultCard}>
          <View style={styles.resultHeaderRow}>
            <ThemedText style={styles.resultTitle}>Extraction Result</ThemedText>
            <ThemedText style={[styles.badge, badgeStyle(status)]}>{status?.replace(/_/g, " ").toUpperCase()}</ThemedText>
          </View>
          <ThemedText style={styles.fieldLabel}>
            Confidence: {(result.overallConfidence * 100).toFixed(0)}%  ·  Quality: {result.quality.grade}  ·  {result.consensusFields.length} fields
          </ThemedText>
          {result.consensusFields.slice(0, 12).map((f) => (
            <View key={f.key} style={styles.fieldRow}>
              <ThemedText style={styles.fieldLabel}>{f.label}</ThemedText>
              <ThemedText style={styles.fieldValue}>{f.value}{f.unit ? ` ${f.unit}` : ""}</ThemedText>
            </View>
          ))}
          {result.conflicts?.filter((c) => !c.resolved).length > 0 ? (
            <ThemedText style={styles.notice}>
              {result.conflicts.filter((c) => !c.resolved).length} field(s) flagged for human review.
            </ThemedText>
          ) : null}
          <View style={{ height: Spacing.md }} />
          <Pressable testID="button-scan-reset" onPress={handleReset} style={styles.btn}>
            <Feather name="refresh-cw" size={18} color={theme.text} />
            <ThemedText style={styles.btnText}>Scan Another</ThemedText>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
