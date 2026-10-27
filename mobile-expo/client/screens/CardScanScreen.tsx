import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { PermissionExplainer } from "@/components/PermissionExplainer";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

type CardType =
  | "INSURANCE_FRONT"
  | "INSURANCE_BACK"
  | "DISCOUNT_CARD"
  | "PHARMACY_CARD"
  | "HSA_FSA_CARD"
  | "MEDICARE"
  | "MEDICAID"
  | "VA_ID"
  | "UNKNOWN";

interface ExtractedCardData {
  cardType: CardType;
  confidence: number;
  isLive: boolean;
  memberId?: string;
  memberName?: string;
  groupNumber?: string;
  planName?: string;
  planType?: string;
  issuerName?: string;
  effectiveDate?: string;
  expirationDate?: string;
  rxBin?: string;
  rxPcn?: string;
  rxGroup?: string;
  rxId?: string;
  copays?: {
    primaryCare?: string;
    specialist?: string;
    urgentCare?: string;
    emergencyRoom?: string;
    genericRx?: string;
    preferredBrandRx?: string;
    specialtyRx?: string;
  };
  claimsAddress?: string;
  claimsPhone?: string;
  customerServicePhone?: string;
  payerIdEdi?: string;
  network?: string;
  deductible?: string;
  rawFields: Record<string, string>;
  scanTimestamp: string;
}

interface ScanResult {
  success: boolean;
  card: ExtractedCardData | null;
  error?: string;
  processingTimeMs: number;
}

interface BinLookup {
  bin: string;
  processor: string;
  network: string;
}

const CARD_TYPE_LABELS: Record<CardType, { label: string; icon: string; color: string }> = {
  INSURANCE_FRONT: { label: "Insurance (Front)", icon: "credit-card", color: "#1565c0" },
  INSURANCE_BACK: { label: "Insurance (Back)", icon: "rotate-cw", color: "#1565c0" },
  DISCOUNT_CARD: { label: "Discount Card", icon: "tag", color: "#2e7d32" },
  PHARMACY_CARD: { label: "Pharmacy Benefit", icon: "package", color: "#6a1b9a" },
  HSA_FSA_CARD: { label: "HSA / FSA", icon: "dollar-sign", color: "#e65100" },
  MEDICARE: { label: "Medicare", icon: "shield", color: "#0d47a1" },
  MEDICAID: { label: "Medicaid", icon: "heart", color: "#1b5e20" },
  VA_ID: { label: "VA ID", icon: "flag", color: "#263238" },
  UNKNOWN: { label: "Unknown Card", icon: "help-circle", color: "#757575" },
};

function FieldRow({ label, value, icon, onPress }: { label: string; value: string; icon?: string; onPress?: () => void }) {
  const { theme } = useTheme();
  const content = (
    <View style={styles.fieldRow}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={styles.fieldValueRow}>
        <ThemedText style={styles.fieldValue}>{value}</ThemedText>
        {icon ? <Feather name={icon as any} size={14} color={theme.primary} style={{ marginLeft: 6 }} /> : null}
      </View>
    </View>
  );
  if (onPress) {
    return <TouchableOpacity onPress={onPress} accessibilityRole="button">{content}</TouchableOpacity>;
  }
  return content;
}

function RxInfoSection({ card }: { card: ExtractedCardData }) {
  const { theme } = useTheme();
  const hasBin = card.rxBin;
  const [binLookup, setBinLookup] = useState<BinLookup | null>(null);
  const [binLoading, setBinLoading] = useState(false);

  const lookupBin = useCallback(async () => {
    if (!card.rxBin || binLookup) return;
    setBinLoading(true);
    try {
      const res = await apiRequest("GET", `/api/card-scan/bin/${card.rxBin}`);
      const data = await res.json();
      setBinLookup(data);
    } catch {
      setBinLookup(null);
    }
    setBinLoading(false);
  }, [card.rxBin, binLookup]);

  if (!hasBin && !card.rxPcn && !card.rxGroup && !card.rxId) return null;

  return (
    <Animated.View entering={FadeInDown.delay(100)}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="package" size={16} color="#6a1b9a" />
          <ThemedText style={styles.sectionTitle}>Pharmacy Routing (Rx)</ThemedText>
        </View>

        {card.rxBin ? (
          <View>
            <FieldRow label="BIN" value={card.rxBin} />
            {binLookup ? (
              <View style={[styles.binResult, { backgroundColor: "#f3e5f5" }]}>
                <Feather name="check-circle" size={12} color="#6a1b9a" />
                <ThemedText style={[styles.binResultText, { color: "#6a1b9a" }]}>
                  {binLookup.processor} ({binLookup.network})
                </ThemedText>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.binLookupBtn, { borderColor: "#6a1b9a" }]}
                onPress={lookupBin}
                disabled={binLoading}
                accessibilityRole="button"
                testID="button-bin-lookup"
              >
                {binLoading ? (
                  <ActivityIndicator size="small" color="#6a1b9a" />
                ) : (
                  <>
                    <Feather name="search" size={12} color="#6a1b9a" />
                    <ThemedText style={[styles.binLookupText, { color: "#6a1b9a" }]}>
                      Look up BIN processor
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {card.rxPcn ? <FieldRow label="PCN" value={card.rxPcn} /> : null}
        {card.rxGroup ? <FieldRow label="Rx Group" value={card.rxGroup} /> : null}
        {card.rxId ? <FieldRow label="Rx Member ID" value={card.rxId} /> : null}

        <ThemedText style={[styles.rxHint, { color: theme.textSecondary }]}>
          Pharmacies need BIN + PCN to route your prescription claim correctly.
        </ThemedText>
      </Card>
    </Animated.View>
  );
}

function CopaySection({ copays }: { copays: ExtractedCardData["copays"] }) {
  if (!copays) return null;
  const entries = Object.entries(copays).filter(([, v]) => v);
  if (entries.length === 0) return null;

  const labels: Record<string, string> = {
    primaryCare: "Primary Care",
    specialist: "Specialist",
    urgentCare: "Urgent Care",
    emergencyRoom: "Emergency Room",
    genericRx: "Generic Rx",
    preferredBrandRx: "Preferred Brand Rx",
    specialtyRx: "Specialty Rx",
  };

  return (
    <Animated.View entering={FadeInDown.delay(200)}>
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Feather name="dollar-sign" size={16} color="#e65100" />
          <ThemedText style={styles.sectionTitle}>Copays</ThemedText>
        </View>
        <View style={styles.copayGrid}>
          {entries.map(([key, val]) => (
            <View key={key} style={styles.copayCell}>
              <ThemedText style={styles.copayAmount}>{val}</ThemedText>
              <ThemedText style={styles.copayLabel}>{labels[key] ?? key}</ThemedText>
            </View>
          ))}
        </View>
      </Card>
    </Animated.View>
  );
}

export default function CardScanScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cardSide, setCardSide] = useState<"front" | "back">("front");
  const [manualBin, setManualBin] = useState("");
  const [manualBinResult, setManualBinResult] = useState<BinLookup | null>(null);
  const [manualBinLoading, setManualBinLoading] = useState(false);
  const [pendingPermission, setPendingPermission] = useState<"camera" | "photos" | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const handlePermissionAndScan = useCallback(async (source: "camera" | "gallery") => {
    const permType = source === "camera" ? "camera" : "photos";
    const existingPerm = source === "camera"
      ? await ImagePicker.getCameraPermissionsAsync()
      : await ImagePicker.getMediaLibraryPermissionsAsync();

    if (existingPerm.granted) {
      scanCard(source);
      return;
    }

    if (existingPerm.status === "denied" && !existingPerm.canAskAgain) {
      setPermissionDenied(true);
      setPendingPermission(permType);
      return;
    }

    setPermissionDenied(false);
    setPendingPermission(permType);
  }, []);

  const handlePermissionAllow = useCallback(async () => {
    if (!pendingPermission) return;
    const source = pendingPermission === "camera" ? "camera" : "gallery";
    const perm = pendingPermission === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (perm.granted) {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      setPendingPermission(null);
      setPermissionDenied(false);
      scanCard(source);
    } else {
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      if (!perm.canAskAgain) {
        setPermissionDenied(true);
      }
    }
  }, [pendingPermission]);

  const scanCard = useCallback(async (source: "camera" | "gallery" | "demo") => {
    setScanning(true);
    setScanResult(null);

    try {
      if (source === "demo") {
        const demoType = cardSide === "back" ? "insurance_back" : "insurance_front";
        const res = await apiRequest("GET", `/api/card-scan/demo/${demoType}`);
        const data = await res.json() as ScanResult;
        setScanResult(data);
        setScanning(false);
        return;
      }

      let result;
      if (source === "camera") {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          base64: true,
          allowsEditing: true,
          aspect: [3.375, 2.125],
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          base64: true,
          allowsEditing: true,
        });
      }

      if (result.canceled || !result.assets?.[0]?.base64) {
        setScanning(false);
        return;
      }

      const res = await apiRequest("POST", "/api/card-scan/scan", {
        image: result.assets[0].base64,
        cardSide,
      });
      const data = await res.json() as ScanResult;
      setScanResult(data);
    } catch (err: any) {
      setScanResult({ success: false, card: null, error: err.message, processingTimeMs: 0 });
    }
    setScanning(false);
  }, [cardSide]);

  const lookupManualBin = useCallback(async () => {
    const cleaned = manualBin.replace(/\D/g, "");
    if (cleaned.length !== 6) return;
    setManualBinLoading(true);
    try {
      const res = await apiRequest("GET", `/api/card-scan/bin/${cleaned}`);
      const data = await res.json();
      setManualBinResult(data);
    } catch {
      setManualBinResult(null);
    }
    setManualBinLoading(false);
  }, [manualBin]);

  const card = scanResult?.card;
  const typeInfo = card ? CARD_TYPE_LABELS[card.cardType] : null;

  if (pendingPermission) {
    return (
      <ThemedView style={styles.container}>
        <PermissionExplainer
          type={pendingPermission}
          onAllow={handlePermissionAllow}
          onDeny={() => { setPendingPermission(null); setPermissionDenied(false); }}
          denied={permissionDenied}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Feather name="credit-card" size={28} color={theme.primary} />
          <ThemedText style={styles.title}>Card Scanner</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Scan your insurance, pharmacy, or discount card to extract member info, pharmacy BIN/PCN, and copay details.
          </ThemedText>
        </View>

        <View style={styles.sideToggle}>
          <TouchableOpacity
            style={[styles.sideBtn, cardSide === "front" ? { backgroundColor: theme.primary } : { borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => setCardSide("front")}
            testID="button-card-front"
          >
            <ThemedText style={[styles.sideBtnText, { color: cardSide === "front" ? "#fff" : theme.text }]}>
              Front
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sideBtn, cardSide === "back" ? { backgroundColor: theme.primary } : { borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => setCardSide("back")}
            testID="button-card-back"
          >
            <ThemedText style={[styles.sideBtnText, { color: cardSide === "back" ? "#fff" : theme.text }]}>
              Back
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.scanActions}>
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: theme.primary }]}
            onPress={() => handlePermissionAndScan("camera")}
            disabled={scanning}
            testID="button-scan-camera"
          >
            <Feather name="camera" size={20} color="#fff" />
            <ThemedText style={styles.scanBtnText}>Take Photo</ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }]}
            onPress={() => handlePermissionAndScan("gallery")}
            disabled={scanning}
            testID="button-scan-gallery"
          >
            <Feather name="image" size={20} color={theme.text} />
            <ThemedText style={[styles.scanBtnText, { color: theme.text }]}>From Gallery</ThemedText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.demoBtn, { borderColor: theme.border }]}
          onPress={() => scanCard("demo")}
          disabled={scanning}
          testID="button-scan-demo"
        >
          <Feather name="play" size={14} color={theme.textSecondary} />
          <ThemedText style={[styles.demoBtnText, { color: theme.textSecondary }]}>
            Try with demo card ({cardSide})
          </ThemedText>
        </TouchableOpacity>

        {scanning ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Scanning card with AI OCR...
            </ThemedText>
          </Card>
        ) : null}

        {scanResult && !scanResult.success ? (
          <Animated.View entering={FadeInDown}>
            <Card style={[styles.errorCard, { borderColor: "#d32f2f" }]}>
              <Feather name="alert-triangle" size={18} color="#d32f2f" />
              <ThemedText style={[styles.errorText, { color: "#d32f2f" }]}>
                {scanResult.error ?? "Could not read card. Try a clearer photo."}
              </ThemedText>
            </Card>
          </Animated.View>
        ) : null}

        {card ? (
          <Animated.View entering={FadeInDown}>
            <Card style={styles.cardTypeHeader}>
              <View style={[styles.cardTypeBadge, { backgroundColor: typeInfo!.color + "15" }]}>
                <Feather name={typeInfo!.icon as any} size={18} color={typeInfo!.color} />
                <ThemedText style={[styles.cardTypeLabel, { color: typeInfo!.color }]}>
                  {typeInfo!.label}
                </ThemedText>
              </View>
              <View style={styles.confidenceRow}>
                <View style={[styles.confidenceBar, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={[styles.confidenceFill, { width: `${Math.round(card.confidence * 100)}%`, backgroundColor: card.confidence > 0.8 ? "#2e7d32" : "#e65100" }]} />
                </View>
                <ThemedText style={[styles.confidenceText, { color: theme.textSecondary }]}>
                  {Math.round(card.confidence * 100)}% confidence
                </ThemedText>
              </View>
              {!card.isLive ? (
                <View style={[styles.demoNotice, { backgroundColor: "#fff3e0" }]}>
                  <Feather name="info" size={12} color="#e65100" />
                  <ThemedText style={[styles.demoNoticeText, { color: "#e65100" }]}>
                    Demo data. Set AZAPI_API_KEY for real OCR scanning.
                  </ThemedText>
                </View>
              ) : null}
              <ThemedText style={[styles.processingTime, { color: theme.textSecondary }]}>
                Processed in {scanResult!.processingTimeMs}ms
              </ThemedText>
            </Card>

            {card.memberId || card.memberName || card.groupNumber || card.planName ? (
              <Animated.View entering={FadeInDown.delay(50)}>
                <Card style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Feather name="user" size={16} color="#1565c0" />
                    <ThemedText style={styles.sectionTitle}>Member Info</ThemedText>
                  </View>
                  {card.memberName ? <FieldRow label="Name" value={card.memberName} /> : null}
                  {card.memberId ? <FieldRow label="Member ID" value={card.memberId} /> : null}
                  {card.groupNumber ? <FieldRow label="Group" value={card.groupNumber} /> : null}
                  {card.planName ? <FieldRow label="Plan" value={card.planName} /> : null}
                  {card.planType ? <FieldRow label="Type" value={card.planType} /> : null}
                  {card.issuerName ? <FieldRow label="Issuer" value={card.issuerName} /> : null}
                  {card.network ? <FieldRow label="Network" value={card.network} /> : null}
                  {card.effectiveDate ? <FieldRow label="Effective" value={card.effectiveDate} /> : null}
                  {card.expirationDate ? <FieldRow label="Expires" value={card.expirationDate} /> : null}
                </Card>
              </Animated.View>
            ) : null}

            <RxInfoSection card={card} />
            <CopaySection copays={card.copays} />

            {card.claimsAddress || card.claimsPhone || card.customerServicePhone || card.payerIdEdi ? (
              <Animated.View entering={FadeInDown.delay(300)}>
                <Card style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <Feather name="phone" size={16} color="#37474f" />
                    <ThemedText style={styles.sectionTitle}>Contact & Claims</ThemedText>
                  </View>
                  {card.customerServicePhone ? (
                    <FieldRow
                      label="Customer Service"
                      value={card.customerServicePhone}
                      icon="phone"
                      onPress={() => Linking.openURL(`tel:${card.customerServicePhone!.replace(/\D/g, "")}`)}
                    />
                  ) : null}
                  {card.claimsPhone ? (
                    <FieldRow
                      label="Claims Phone"
                      value={card.claimsPhone}
                      icon="phone"
                      onPress={() => Linking.openURL(`tel:${card.claimsPhone!.replace(/\D/g, "")}`)}
                    />
                  ) : null}
                  {card.claimsAddress ? <FieldRow label="Claims Address" value={card.claimsAddress} /> : null}
                  {card.payerIdEdi ? <FieldRow label="EDI Payer ID" value={card.payerIdEdi} /> : null}
                </Card>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        <Card style={styles.binLookupCard}>
          <View style={styles.sectionHeader}>
            <Feather name="search" size={16} color="#6a1b9a" />
            <ThemedText style={styles.sectionTitle}>BIN Lookup</ThemedText>
          </View>
          <ThemedText style={[styles.binHint, { color: theme.textSecondary }]}>
            Enter the 6-digit BIN from any pharmacy card to identify the processor.
          </ThemedText>
          <View style={styles.binInputRow}>
            <TextInput
              style={[styles.binInput, { borderColor: theme.border, color: theme.text }]}
              value={manualBin}
              onChangeText={setManualBin}
              placeholder="e.g., 003858"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              testID="input-bin"
            />
            <TouchableOpacity
              style={[styles.binSearchBtn, { backgroundColor: theme.primary }]}
              onPress={lookupManualBin}
              disabled={manualBin.replace(/\D/g, "").length !== 6 || manualBinLoading}
              testID="button-bin-search"
            >
              {manualBinLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="search" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          {manualBinResult ? (
            <Animated.View entering={FadeInDown}>
              <View style={[styles.binResultCard, { backgroundColor: "#f3e5f5" }]}>
                <Feather name="check-circle" size={14} color="#6a1b9a" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.binResultProcessor, { color: "#6a1b9a" }]}>
                    {manualBinResult.processor}
                  </ThemedText>
                  <ThemedText style={[styles.binResultNetwork, { color: "#7b1fa2" }]}>
                    {manualBinResult.network}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Card>

        <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
          Card data is processed securely and never stored on our servers. AI-powered OCR by AZAPI.ai. BIN directory is for reference only.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.md },
  intro: { alignItems: "center", marginBottom: Spacing.lg, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  sideToggle: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: Spacing.md },
  sideBtn: { paddingVertical: 8, paddingHorizontal: 24, borderRadius: BorderRadius.md },
  sideBtnText: { fontSize: 13, fontWeight: "600" },
  scanActions: { flexDirection: "row", gap: 10, marginBottom: Spacing.sm },
  scanBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.md,
  },
  scanBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderWidth: 1, borderRadius: BorderRadius.sm, marginBottom: Spacing.lg,
  },
  demoBtnText: { fontSize: 12, fontWeight: "500" },
  loadingCard: { alignItems: "center", padding: Spacing.xl, gap: 12 },
  loadingText: { fontSize: 13 },
  errorCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: Spacing.md, borderWidth: 1 },
  errorText: { fontSize: 13, flex: 1 },
  cardTypeHeader: { marginBottom: Spacing.sm },
  cardTypeBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: BorderRadius.sm,
    alignSelf: "flex-start", marginBottom: 8,
  },
  cardTypeLabel: { fontSize: 14, fontWeight: "600" },
  confidenceRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  confidenceBar: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  confidenceFill: { height: "100%", borderRadius: 2 },
  confidenceText: { fontSize: 11 },
  demoNotice: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 4, paddingHorizontal: 10, borderRadius: BorderRadius.xs, marginBottom: 4,
  },
  demoNoticeText: { fontSize: 10, fontWeight: "500" },
  processingTime: { fontSize: 10 },
  sectionCard: { marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "600" },
  fieldRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 6,
  },
  fieldLabel: { fontSize: 12, flex: 1 },
  fieldValueRow: { flexDirection: "row", alignItems: "center" },
  fieldValue: { fontSize: 13, fontWeight: "500" },
  binResult: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: BorderRadius.xs, marginTop: 4, marginBottom: 6,
  },
  binResultText: { fontSize: 11, fontWeight: "500" },
  binLookupBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderRadius: BorderRadius.xs,
    paddingVertical: 4, paddingHorizontal: 10, marginTop: 4, marginBottom: 6, alignSelf: "flex-start",
  },
  binLookupText: { fontSize: 11, fontWeight: "500" },
  rxHint: { fontSize: 10, fontStyle: "italic", marginTop: 6 },
  copayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  copayCell: {
    alignItems: "center", minWidth: 80, paddingVertical: 8, paddingHorizontal: 10,
  },
  copayAmount: { fontSize: 16, fontWeight: "600" },
  copayLabel: { fontSize: 10, marginTop: 2, textAlign: "center" },
  binLookupCard: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  binHint: { fontSize: 12, marginBottom: 8 },
  binInputRow: { flexDirection: "row", gap: 8 },
  binInput: {
    flex: 1, borderWidth: 1, borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontWeight: "600",
    letterSpacing: 2,
  },
  binSearchBtn: {
    width: 44, height: 44, borderRadius: BorderRadius.sm,
    alignItems: "center", justifyContent: "center",
  },
  binResultCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: BorderRadius.sm, marginTop: 10,
  },
  binResultProcessor: { fontSize: 14, fontWeight: "600" },
  binResultNetwork: { fontSize: 11 },
  disclaimer: { fontSize: 10, textAlign: "center", lineHeight: 15, marginTop: Spacing.md, paddingHorizontal: Spacing.md },
});
