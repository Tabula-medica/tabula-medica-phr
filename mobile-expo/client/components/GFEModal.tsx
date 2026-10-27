import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface GFELineItem {
  cptCode: string;
  serviceDescription: string;
  providerName: string;
  providerNPI: string;
  providerRole: "primary" | "ancillary" | "facility";
  expectedCost: number;
  icd10Code?: string;
  icd10Description?: string;
}

export interface GoodFaithEstimate {
  gfeId: string;
  issuedAt: string;
  expiresAt: string;
  appointmentDate: string;
  patientName: string;
  patientDOB: string;
  patientId: string;
  patientSSN?: string;
  patientPassportId?: string;
  patientForeignId?: string;
  conveningEntity: string;
  conveningNPI?: string;
  primaryProviderName: string;
  primaryProviderNPI: string;
  primaryProviderAddress: string;
  primaryProviderTaxId?: string;
  primaryProviderPhone?: string;
  lineItems: GFELineItem[];
  totalExpectedCost: number;
  totalMaxBeforeDispute: number;
  hsaEligible: boolean;
  dpcSafeHarbor: boolean;
  noSurprisesActApplies: boolean;
  tefcaIASEnabled: boolean;
  paymentLane: "A_INSTAMED" | "B_VA_CCN";
  currency: "USD";
  disclaimer: string;
}

interface GFESummary {
  gfeId: string;
  providerName: string;
  serviceDescription: string;
  cptCode: string;
  fixedPrice: number;
  maxBeforeDispute: number;
  hsaEligible: boolean;
  issuedAt: string;
  appointmentDate: string;
  hasAncillaryServices: boolean;
  ancillaryCount: number;
  ancillaryTotal: number;
  paymentLaneLabel: string;
  complianceFlags: string[];
}

function getGFESummary(gfe: GoodFaithEstimate): GFESummary {
  const ancillary = gfe.lineItems.filter((i) => i.providerRole === "ancillary");
  const ancillaryTotal = ancillary.reduce((s, i) => s + i.expectedCost, 0);
  const complianceFlags: string[] = ["No Surprises Act compliant"];
  if (gfe.hsaEligible) complianceFlags.push("HSA eligible (2026 DPC safe harbor)");
  if (gfe.tefcaIASEnabled) complianceFlags.push("TEFCA IAS data exchange enabled");
  if (gfe.dpcSafeHarbor) complianceFlags.push("DPC Safe Harbor ≤ $150/mo");
  const primary = gfe.lineItems.find((i) => i.providerRole === "primary")!;
  return {
    gfeId: gfe.gfeId,
    providerName: gfe.primaryProviderName,
    serviceDescription: primary?.serviceDescription ?? "",
    cptCode: primary?.cptCode ?? "",
    fixedPrice: gfe.totalExpectedCost,
    maxBeforeDispute: gfe.totalMaxBeforeDispute,
    hsaEligible: gfe.hsaEligible,
    issuedAt: gfe.issuedAt,
    appointmentDate: gfe.appointmentDate,
    hasAncillaryServices: ancillary.length > 0,
    ancillaryCount: ancillary.length,
    ancillaryTotal: Math.round(ancillaryTotal * 100) / 100,
    paymentLaneLabel: gfe.paymentLane === "B_VA_CCN" ? "VA pays via Optum CCN (Lane B)" : "Self-pay at point of care (Lane A)",
    complianceFlags,
  };
}

interface SlidingScaleResult {
  adjustedRate: number;
  discountPercent: number;
  fplPercent: number;
  tier: string;
  qualifiesForFQHC: boolean;
  qualifiesForFree: boolean;
}

const FPG_2026_BASE = 15060;
const FPG_2026_PER_ADDITIONAL = 5380;

function calculateSlidingScale(annualIncome: number, householdSize: number, baseRate: number): SlidingScaleResult {
  const fpgForHousehold = FPG_2026_BASE + Math.max(0, householdSize - 1) * FPG_2026_PER_ADDITIONAL;
  const fplPercent = Math.round((annualIncome / fpgForHousehold) * 100);
  let tier: string;
  let discountPercent: number;
  if (fplPercent <= 100) { tier = "free"; discountPercent = 100; }
  else if (fplPercent <= 150) { tier = "25pct"; discountPercent = 75; }
  else if (fplPercent <= 200) { tier = "50pct"; discountPercent = 50; }
  else if (fplPercent <= 300) { tier = "75pct"; discountPercent = 25; }
  else { tier = "full"; discountPercent = 0; }
  const adjustedRate = Math.round(baseRate * (1 - discountPercent / 100) * 100) / 100;
  return { adjustedRate, discountPercent, fplPercent, tier, qualifiesForFQHC: fplPercent <= 200, qualifiesForFree: fplPercent <= 100 };
}

function ComplianceBadge({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ backgroundColor: `${color}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Feather name="check" size={10} color={color} />
        <ThemedText type="small" style={{ color, fontSize: 10, fontWeight: "700" }}>{text}</ThemedText>
      </View>
    </View>
  );
}

function LineItemRow({ item, theme }: { item: GFELineItem; theme: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <ThemedText type="small" style={{ fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", color: theme.textSecondary }}>{item.cptCode}</ThemedText>
          {item.providerRole === "ancillary" ? (
            <View style={{ backgroundColor: "#8B5CF615", paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full }}>
              <ThemedText type="small" style={{ fontSize: 9, color: "#8B5CF6", fontWeight: "700" }}>ancillary</ThemedText>
            </View>
          ) : null}
        </View>
        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 1 }}>{item.serviceDescription}</ThemedText>
        <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary }}>{item.providerName}</ThemedText>
        {item.icd10Code ? (
          <ThemedText type="small" style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" }}>ICD-10: {item.icd10Code}</ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" style={{ fontSize: 15, fontWeight: "800", color: "#10B981", marginLeft: 12, marginTop: 2 }}>${item.expectedCost.toFixed(2)}</ThemedText>
    </View>
  );
}

function SlidingScaleWidget({ baseRate, theme, onApply }: { baseRate: number; theme: any; onApply: (r: SlidingScaleResult) => void }) {
  const [income, setIncome] = useState("");
  const [household, setHousehold] = useState("1");
  const [result, setResult] = useState<SlidingScaleResult | null>(null);

  const calculate = () => {
    const annualIncome = parseFloat(income.replace(/,/g, ""));
    const householdSize = parseInt(household, 10);
    if (isNaN(annualIncome) || annualIncome < 0) return;
    const r = calculateSlidingScale(annualIncome, householdSize, baseRate);
    setResult(r);
    if (r.discountPercent > 0) onApply(r);
  };

  return (
    <Card style={{ padding: Spacing.md, marginBottom: Spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Feather name="bar-chart-2" size={14} color={theme.text} />
        <ThemedText type="small" style={{ fontWeight: "700" }}>Income-Based Discount Calculator</ThemedText>
      </View>
      <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, marginBottom: Spacing.sm, lineHeight: 15 }}>
        Based on 2026 Federal Poverty Guidelines. Upload your 1040 or pay stub to auto-fill.
      </ThemedText>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ThemedText type="small" style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary, marginBottom: 4 }}>Annual income ($)</ThemedText>
          <TextInput testID="input-sliding-income" value={income} onChangeText={setIncome} keyboardType="numeric" placeholder="e.g. 28000" placeholderTextColor={theme.textSecondary} style={{ backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: theme.border, padding: 10, fontSize: 14, color: theme.text }} />
        </View>
        <View style={{ width: 80 }}>
          <ThemedText type="small" style={{ fontSize: 11, fontWeight: "600", color: theme.textSecondary, marginBottom: 4 }}>Household</ThemedText>
          <TextInput testID="input-sliding-household" value={household} onChangeText={setHousehold} keyboardType="number-pad" placeholder="1" placeholderTextColor={theme.textSecondary} style={{ backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: theme.border, padding: 10, fontSize: 14, color: theme.text }} />
        </View>
      </View>
      <Pressable testID="button-calculate-rate" onPress={calculate} style={{ backgroundColor: "#0284c7", borderRadius: BorderRadius.sm, padding: 10, alignItems: "center", marginTop: Spacing.sm }}>
        <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>Calculate My Rate</ThemedText>
      </Pressable>
      {result ? (
        <View style={{ borderRadius: BorderRadius.sm, padding: 12, marginTop: 10, backgroundColor: result.discountPercent > 0 ? "#dcfce7" : theme.backgroundSecondary }}>
          <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 3 }}>{result.fplPercent}% FPL</ThemedText>
          {result.discountPercent > 0 ? (
            <>
              <ThemedText type="small" style={{ fontSize: 14, fontWeight: "700", color: "#15803d" }}>
                {result.discountPercent}% discount applied — ${result.adjustedRate.toFixed(2)}
              </ThemedText>
              {result.qualifiesForFree ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Feather name="check" size={10} color="#15803d" />
                  <ThemedText type="small" style={{ fontSize: 11, color: "#15803d" }}>You qualify for FREE care at nearby FQHCs</ThemedText>
                </View>
              ) : null}
              {result.qualifiesForFQHC && !result.qualifiesForFree ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                  <Feather name="check" size={10} color="#0284c7" />
                  <ThemedText type="small" style={{ fontSize: 11, color: "#0284c7" }}>Eligible for FQHC sliding-scale care</ThemedText>
                </View>
              ) : null}
            </>
          ) : (
            <ThemedText type="small" style={{ fontSize: 13, color: theme.textSecondary }}>Full rate applies — no discount at this income level</ThemedText>
          )}
        </View>
      ) : null}
    </Card>
  );
}

interface GFEModalProps {
  visible: boolean;
  gfe: GoodFaithEstimate | null;
  onAccept: (gfe: GoodFaithEstimate, adjustedRate?: number) => void;
  onDecline: () => void;
}

export default function GFEModal({ visible, gfe, onAccept, onDecline }: GFEModalProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [tefcaConsent, setTefcaConsent] = useState(false);
  const [showSliding, setShowSliding] = useState(false);
  const [adjustedRate, setAdjustedRate] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
      const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
      const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
      if (isAtBottom && !hasScrolled) setHasScrolled(true);
    },
    [hasScrolled],
  );

  const handleAccept = useCallback(() => {
    if (!gfe || !understood) return;
    const finalGFE = tefcaConsent ? { ...gfe, tefcaIASEnabled: true } : gfe;
    onAccept(finalGFE, adjustedRate ?? undefined);
  }, [gfe, understood, tefcaConsent, adjustedRate, onAccept]);

  if (!gfe) return null;

  const summary = getGFESummary(gfe);
  const displayCost = adjustedRate ?? gfe.totalExpectedCost;
  const isVALane = gfe.paymentLane === "B_VA_CCN";

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onDecline}>
      <View style={{ flex: 1, backgroundColor: isDark ? theme.backgroundDefault : "#f8f7f4" }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: isDark ? theme.backgroundSecondary : "#040d1a", padding: 20, paddingTop: insets.top + 8 }}>
          <View>
            <ThemedText type="subtitle" style={{ fontWeight: "800", color: "#FFF" }}>Good Faith Estimate</ThemedText>
            <ThemedText type="small" style={{ color: "#14c4ad", marginTop: 2 }}>No Surprises Act — 2026 Compliant</ThemedText>
          </View>
          <Pressable testID="button-close-gfe" onPress={onDecline} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,.1)", alignItems: "center", justifyContent: "center" }}>
            <Feather name="x" size={14} color="#FFF" />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: isDark ? theme.backgroundSecondary : "#071428" }}>
          <ThemedText type="small" style={{ fontSize: 10, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", color: "rgba(255,255,255,.4)" }}>GFE ID: {summary.gfeId}</ThemedText>
          <ThemedText type="small" style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>Issued: {new Date(summary.issuedAt).toLocaleDateString()}</ThemedText>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: isDark ? theme.backgroundSecondary : "#071428" }}>
          {summary.complianceFlags.map((f) => (
            <ComplianceBadge key={f} text={f} color="#10B981" />
          ))}
          {isVALane ? <ComplianceBadge text="VA Community Care" color="#f59e0b" /> : null}
        </View>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} onScroll={handleScroll} scrollEventThrottle={100} showsVerticalScrollIndicator>
          <View style={{ margin: 16, borderRadius: 14, padding: 20, backgroundColor: isVALane ? "rgba(245,158,11,0.08)" : "rgba(13,158,138,0.08)", borderWidth: 1, borderColor: isVALane ? "rgba(245,158,11,0.25)" : "rgba(13,158,138,0.25)" }}>
            <ThemedText type="small" style={{ fontSize: 12, fontWeight: "600", color: theme.textSecondary, marginBottom: 6 }}>
              {isVALane ? "Your cost (VA pays the rest)" : "Fixed price — no surprise bills"}
            </ThemedText>
            <ThemedText type="title" style={{ fontSize: 40, fontWeight: "800", letterSpacing: -1, marginBottom: 6, color: isVALane ? "#f59e0b" : "#10B981" }}>
              {isVALane ? "$0.00" : `$${displayCost.toFixed(2)}`}
            </ThemedText>
            {!isVALane ? (
              <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15 }}>
                If your final bill exceeds ${(displayCost + 400).toFixed(2)}, you can dispute it under federal law.
              </ThemedText>
            ) : (
              <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15 }}>
                VA pays via Optum CCN (Payer ID: VACCN) within 30 days. Your VA referral number is required at check-in.
              </ThemedText>
            )}
          </View>

          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <ThemedText type="small" style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Provider</ThemedText>
            <ThemedText type="small" style={{ fontSize: 15, fontWeight: "700", marginBottom: 3 }}>{summary.providerName}</ThemedText>
            <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", marginBottom: 2 }}>NPI: {gfe.primaryProviderNPI}</ThemedText>
            <ThemedText type="small" style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 2 }}>{gfe.primaryProviderAddress}</ThemedText>
            {gfe.primaryProviderPhone ? (
              <ThemedText type="small" style={{ fontSize: 12, color: theme.primary }}>{gfe.primaryProviderPhone}</ThemedText>
            ) : null}
            <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, marginTop: 8, fontStyle: "italic" }}>Convening Entity: {gfe.conveningEntity}</ThemedText>
          </Card>

          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <ThemedText type="small" style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Services ({gfe.lineItems.length})</ThemedText>
            {gfe.lineItems.map((item, idx) => (
              <LineItemRow key={`${item.cptCode}-${idx}`} item={item} theme={theme} />
            ))}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4 }}>
              <ThemedText type="small" style={{ fontSize: 13, fontWeight: "700" }}>Total Expected Cost</ThemedText>
              <ThemedText type="small" style={{ fontSize: 18, fontWeight: "800", color: "#10B981" }}>${displayCost.toFixed(2)}</ThemedText>
            </View>
          </Card>

          {summary.hsaEligible ? (
            <View style={{ flexDirection: "row", backgroundColor: "#dcfce7", borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#15803d20", alignItems: "center", justifyContent: "center" }}>
                <Feather name="dollar-sign" size={16} color="#15803d" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ fontSize: 13, fontWeight: "700", color: "#15803d", marginBottom: 3 }}>HSA Eligible (2026)</ThemedText>
                <ThemedText type="small" style={{ fontSize: 11, color: "#15803d", lineHeight: 16 }}>
                  This visit qualifies for HSA reimbursement under the 2026 DPC safe harbor (Consolidated Appropriations Act). Pay from your HSA card at check-in.
                </ThemedText>
              </View>
            </View>
          ) : null}

          {!isVALane ? (
            <Pressable testID="button-toggle-sliding" onPress={() => setShowSliding(!showSliding)} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: "#e0f2fe", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Feather name={showSliding ? "chevron-up" : "bar-chart-2"} size={14} color="#0284c7" />
                <ThemedText type="small" style={{ fontSize: 12, fontWeight: "600", color: "#0284c7" }}>
                  {showSliding ? "Hide" : "Check income-based discount (1040 / pay stubs)"}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}
          {showSliding && !isVALane ? (
            <View style={{ marginHorizontal: 16 }}>
              <SlidingScaleWidget baseRate={gfe.totalExpectedCost} theme={theme} onApply={(r) => { if (r.discountPercent > 0) setAdjustedRate(r.adjustedRate); }} />
            </View>
          ) : null}

          {gfe.patientPassportId || gfe.patientForeignId ? (
            <View style={{ flexDirection: "row", backgroundColor: "#ede9fe", borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 12 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#7c3aed20", alignItems: "center", justifyContent: "center" }}>
                <Feather name="shield" size={16} color="#7c3aed" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ fontSize: 13, fontWeight: "700", color: "#7c3aed", marginBottom: 3 }}>Uninsured Identity Vault</ThemedText>
                <ThemedText type="small" style={{ fontSize: 11, color: "#7c3aed", lineHeight: 16 }}>
                  Your {gfe.patientPassportId ? "passport" : "government-issued ID"} has been securely stored and is accepted by this provider in lieu of a Social Security Number. No SSN required to receive care.
                </ThemedText>
              </View>
            </View>
          ) : null}

          <Card style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 12, padding: 14, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <Feather name="radio" size={13} color={theme.text} />
                <ThemedText type="small" style={{ fontSize: 13, fontWeight: "700" }}>Share prior records with provider (TEFCA IAS)</ThemedText>
              </View>
              <ThemedText type="small" style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 15 }}>
                Allow this provider to receive your previous health records from other clinics via TEFCA Individual Access Services. Speeds intake and avoids repeat tests.
              </ThemedText>
            </View>
            <Switch value={tefcaConsent} onValueChange={setTefcaConsent} trackColor={{ false: theme.border, true: "#10B981" }} thumbColor="#FFF" />
          </Card>

          <Card style={{ marginHorizontal: 16, marginBottom: 12, padding: 16 }}>
            <ThemedText type="small" style={{ fontSize: 11, fontWeight: "700", color: theme.textSecondary, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Appointment</ThemedText>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <ThemedText type="small" style={{ fontSize: 12, color: theme.textSecondary }}>Date</ThemedText>
              <ThemedText type="small" style={{ fontSize: 12, fontWeight: "600" }}>{gfe.appointmentDate}</ThemedText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
              <ThemedText type="small" style={{ fontSize: 12, color: theme.textSecondary }}>Payment</ThemedText>
              <ThemedText type="small" style={{ fontSize: 12, fontWeight: "600" }}>{summary.paymentLaneLabel}</ThemedText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <ThemedText type="small" style={{ fontSize: 12, color: theme.textSecondary }}>Dispute threshold</ThemedText>
              <ThemedText type="small" style={{ fontSize: 12, fontWeight: "600" }}>${gfe.totalMaxBeforeDispute.toFixed(2)}</ThemedText>
            </View>
          </Card>

          <View style={{ backgroundColor: isDark ? theme.backgroundSecondary : "#f3f4f6", borderRadius: 12, marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1, borderColor: theme.border }}>
            <ThemedText type="small" style={{ fontSize: 12, fontWeight: "700", marginBottom: 8 }}>Your Rights Under the No Surprises Act</ThemedText>
            <ThemedText type="small" style={{ fontSize: 10, color: theme.textSecondary, lineHeight: 16 }}>{gfe.disclaimer}</ThemedText>
          </View>

          {!hasScrolled ? (
            <View style={{ alignItems: "center", paddingVertical: 12 }}>
              <Feather name="chevron-down" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>Scroll to the bottom to continue</ThemedText>
            </View>
          ) : null}

          {hasScrolled ? (
            <Pressable testID="button-understand-gfe" onPress={() => setUnderstood(!understood)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: understood ? "#10B981" : theme.border, backgroundColor: understood ? "rgba(16,185,129,0.08)" : theme.backgroundDefault }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: understood ? "#10B981" : theme.border, backgroundColor: understood ? "#10B981" : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 }}>
                {understood ? <Feather name="check" size={13} color="#FFF" /> : null}
              </View>
              <ThemedText type="small" style={{ flex: 1, fontSize: 12, color: understood ? theme.text : theme.textSecondary, lineHeight: 17 }}>
                I have read and understand this Good Faith Estimate and my rights under the No Surprises Act.
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={{ height: 24 }} />
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 12, padding: 16, paddingBottom: insets.bottom + 16, backgroundColor: theme.backgroundDefault, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Pressable testID="button-decline-gfe" onPress={onDecline} style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
            <ThemedText type="small" style={{ fontSize: 14, fontWeight: "600", color: theme.textSecondary }}>Cancel</ThemedText>
          </Pressable>
          <Pressable testID="button-accept-gfe" onPress={handleAccept} disabled={!hasScrolled || !understood} style={{ flex: 2, padding: 14, borderRadius: 10, backgroundColor: "#10B981", alignItems: "center", opacity: hasScrolled && understood ? 1 : 0.4 }}>
            <ThemedText type="small" style={{ fontSize: 14, fontWeight: "800", color: "#FFF" }}>
              {isVALane ? "Confirm VA Booking ($0)" : `Confirm — $${displayCost.toFixed(2)}`}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
