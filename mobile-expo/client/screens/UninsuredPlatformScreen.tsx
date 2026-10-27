import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import GFEModal, { type GoodFaithEstimate as GFEType } from "@/components/GFEModal";

interface MedicareRate {
  cptCode: string;
  description: string;
  category: string;
  medicareRate: number;
  discountedRate: number;
  typicalRetailRate: number;
  savingsPercent: number;
}

interface RatesData {
  rates: MedicareRate[];
  categories: string[];
  totalRates: number;
  disclaimer: string;
  lastUpdated: string;
  source: string;
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  type: string;
  location: string;
  acceptingPatients: boolean;
  rating: number;
  description: string;
}

interface ProvidersData {
  providers: Provider[];
  totalProviders: number;
  programInfo: {
    name: string;
    tagline: string;
    description: string;
    benefits: string[];
    eligibility: string;
  };
}

interface HRSAClinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  distanceMiles: number | null;
  acceptsUninsured: boolean;
  services: string[];
  languages: string[];
  clinicType: string;
  hoursNote: string | null;
}

type ActiveTab = "rates" | "providers" | "gfe" | "hsa" | "vault" | "sliding" | "veteran" | "signup";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  "Office Visits": "user",
  "Preventive Care": "shield",
  "Lab Work": "activity",
  "Imaging": "image",
  "Cardiology": "heart",
  "Emergency": "alert-circle",
  "Mental Health": "smile",
  "Physical Therapy": "trending-up",
  "Dental": "sun",
  "Surgery": "tool",
};

const CATEGORY_COLORS: Record<string, string> = {
  "Office Visits": "#3B82F6",
  "Preventive Care": "#10B981",
  "Lab Work": "#8B5CF6",
  "Imaging": "#F97316",
  "Cardiology": "#EF4444",
  "Emergency": "#DC2626",
  "Mental Health": "#06B6D4",
  "Physical Therapy": "#14B8A6",
  "Dental": "#F59E0B",
  "Surgery": "#EC4899",
};

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function SectionHeader({ icon, iconColor, title, subtitle }: { icon: keyof typeof Feather.glyphMap; iconColor: string; title: string; subtitle: string }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: iconColor + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{title}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>{subtitle}</ThemedText>
      </View>
    </View>
  );
}

function LegalBadge({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: color + "15", borderWidth: 1, borderColor: color + "30", alignSelf: "flex-start", marginBottom: 6 }}>
      <Feather name="shield" size={10} color={color} />
      <ThemedText type="small" style={{ color, fontWeight: "700", fontSize: 10, marginLeft: 4 }}>{text}</ThemedText>
    </View>
  );
}

function RateCard({ rate, theme }: { rate: MedicareRate; theme: any }) {
  const [expanded, setExpanded] = useState(false);
  const catColor = CATEGORY_COLORS[rate.category] || "#6B7280";
  const savings = rate.typicalRetailRate - rate.discountedRate;

  return (
    <Pressable testID={`rate-${rate.cptCode}`} accessibilityRole="button" accessibilityLabel={`CPT ${rate.cptCode}, ${rate.description}, discounted price ${formatCurrency(rate.discountedRate)}`} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}>
      <Card style={{ marginBottom: Spacing.sm, padding: Spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: catColor + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
            <Feather name={CATEGORY_ICONS[rate.category] || "file-text"} size={18} color={catColor} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="small" style={{ fontWeight: "700" }}>CPT {rate.cptCode}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }} numberOfLines={expanded ? 3 : 1}>{rate.description}</ThemedText>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <ThemedText type="subtitle" style={{ fontWeight: "800", color: "#10B981" }}>{formatCurrency(rate.discountedRate)}</ThemedText>
            <ThemedText type="small" style={{ textDecorationLine: "line-through", color: theme.textSecondary, fontSize: 11 }}>{formatCurrency(rate.typicalRetailRate)}</ThemedText>
          </View>
        </View>
        {expanded ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: Spacing.md }}>
            <View style={{ backgroundColor: "#10B98115", borderRadius: BorderRadius.md, padding: Spacing.sm, marginBottom: Spacing.sm }}>
              <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700", marginBottom: 4 }}>You Save {formatCurrency(savings)} ({rate.savingsPercent}% off retail)</ThemedText>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ flex: 1 }}><ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Medicare Rate</ThemedText><ThemedText type="body" style={{ fontWeight: "600" }}>{formatCurrency(rate.medicareRate)}</ThemedText></View>
              <View style={{ flex: 1 }}><ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Our Price</ThemedText><ThemedText type="body" style={{ fontWeight: "700", color: "#10B981" }}>{formatCurrency(rate.discountedRate)}</ThemedText></View>
              <View style={{ flex: 1 }}><ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 2 }}>Retail Price</ThemedText><ThemedText type="body" style={{ fontWeight: "600", color: theme.error }}>{formatCurrency(rate.typicalRetailRate)}</ThemedText></View>
            </View>
          </Animated.View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function ProviderCard({ provider, theme }: { provider: Provider; theme: any }) {
  const catColor = CATEGORY_COLORS[provider.specialty] || "#3B82F6";
  return (
    <Card style={{ marginBottom: Spacing.md, padding: Spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: catColor + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
          <Feather name={CATEGORY_ICONS[provider.specialty] || "briefcase"} size={20} color={catColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{provider.name}</ThemedText>
          <ThemedText type="small" style={{ color: catColor, fontWeight: "600" }}>{provider.specialty}</ThemedText>
        </View>
        {provider.acceptingPatients ? (
          <View style={{ backgroundColor: "#10B98120", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
            <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600", fontSize: 10 }}>Accepting</ThemedText>
          </View>
        ) : null}
      </View>
      <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 20, marginBottom: 8 }}>{provider.description}</ThemedText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}><Feather name="map-pin" size={12} color={theme.textSecondary} /><ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary }}>{provider.location}</ThemedText></View>
        <View style={{ flexDirection: "row", alignItems: "center" }}><Feather name="star" size={12} color="#F59E0B" /><ThemedText type="small" style={{ marginLeft: 4, fontWeight: "600" }}>{provider.rating}</ThemedText></View>
      </View>
    </Card>
  );
}

function GoodFaithEstimateTab({ theme, isDark }: { theme: any; isDark: boolean }) {
  const [services, setServices] = useState([
    { id: "1", cpt: "99213", desc: "Office Visit (Level 3)", provider: "Primary Care", npi: "1234567890", price: 82.40, enabled: true },
    { id: "2", cpt: "36415", desc: "Blood Draw (Venipuncture)", provider: "Lab Tech", npi: "1234567891", price: 8.36, enabled: true },
    { id: "3", cpt: "80053", desc: "Comprehensive Metabolic Panel", provider: "Laboratory", npi: "1234567892", price: 11.47, enabled: true },
  ]);
  const [addCpt, setAddCpt] = useState("");
  const [generated, setGenerated] = useState(false);
  const [showGfeModal, setShowGfeModal] = useState(false);
  const [currentGfe, setCurrentGfe] = useState<GFEType | null>(null);
  const [confirmedGfe, setConfirmedGfe] = useState<{ gfeId: string; cost: number } | null>(null);

  const totalPrice = services.filter(s => s.enabled).reduce((sum, s) => sum + s.price, 0);

  const toggleService = (id: string) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const generateAndShowGFE = () => {
    const enabledServices = services.filter(s => s.enabled);
    if (enabledServices.length === 0) return;
    const primary = enabledServices[0];
    const ancillary = enabledServices.slice(1);
    const now = new Date();
    const expires = new Date(now);
    expires.setFullYear(expires.getFullYear() + 1);
    const apptDate = new Date();
    apptDate.setDate(apptDate.getDate() + 7);

    const gfe: GFEType = {
      gfeId: `GFE-${Date.now()}`,
      issuedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      appointmentDate: apptDate.toISOString().split("T")[0],
      patientName: "Patient",
      patientDOB: "1990-01-01",
      patientId: "demo-patient",
      conveningEntity: "Tabula Medica, Inc. DBA Uninsurance",
      primaryProviderName: primary.provider,
      primaryProviderNPI: primary.npi,
      primaryProviderAddress: "Community Health Center",
      lineItems: enabledServices.map((s, idx) => ({
        cptCode: s.cpt,
        serviceDescription: s.desc,
        providerName: s.provider,
        providerNPI: s.npi,
        providerRole: idx === 0 ? "primary" as const : "ancillary" as const,
        expectedCost: s.price,
      })),
      totalExpectedCost: Math.round(totalPrice * 100) / 100,
      totalMaxBeforeDispute: Math.round((totalPrice + 400) * 100) / 100,
      hsaEligible: totalPrice <= 150,
      dpcSafeHarbor: false,
      noSurprisesActApplies: true,
      tefcaIASEnabled: false,
      paymentLane: "A_INSTAMED",
      currency: "USD",
      disclaimer: "NOTICE: Good Faith Estimate — Your Rights Under the No Surprises Act\n\nYou are receiving this Good Faith Estimate because you are not using insurance to pay for these items and services, or because you asked for this estimate.\n\nThis estimate is based on information known at the time of the estimate. The Good Faith Estimate does not include unexpected costs that could arise during treatment.\n\nYOUR RIGHTS:\n• If you receive a bill that is at least $400 more than your Good Faith Estimate for any provider or facility listed on the estimate, you may be able to dispute the bill through the Patient-Provider Dispute Resolution (PPDR) process.\n• You can start the PPDR process within 120 calendar days (about 4 months) after the date on the bill.\n• The PPDR process will not affect your credit score, collections activities, or the ability to receive future health care services.\n\nFor questions or more information about your right to a Good Faith Estimate, visit www.cms.gov/nosurprises or call the CMS No Surprises Help Desk at 1-800-985-3059.\n\nTabula Medica, Inc. DBA Uninsurance acts as the Convening Entity for this bundled Good Faith Estimate pursuant to 45 CFR § 149.610(b)(1).",
    };

    setCurrentGfe(gfe);
    setShowGfeModal(true);
  };

  const handleGfeAccept = (gfe: GFEType, adjustedRate?: number) => {
    setShowGfeModal(false);
    setGenerated(true);
    setConfirmedGfe({ gfeId: gfe.gfeId, cost: adjustedRate ?? gfe.totalExpectedCost });
  };

  return (
    <View>
      <GFEModal visible={showGfeModal} gfe={currentGfe} onAccept={handleGfeAccept} onDecline={() => setShowGfeModal(false)} />

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="file-text" iconColor="#3B82F6" title="Good Faith Estimate" subtitle="Binding price protection under No Surprises Act" />
        <LegalBadge text="NO SURPRISES ACT 2026" color="#3B82F6" />
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: 8 }}>
          Generate a legally binding Good Faith Estimate (GFE) for any combination of services. If your final bill exceeds the GFE by more than $400, you have a federal right to dispute it through the Patient-Provider Dispute Resolution process.
        </ThemedText>
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Selected Services</ThemedText>
        {services.map((svc) => (
          <Pressable key={svc.id} testID={`gfe-service-${svc.id}`} accessibilityRole="checkbox" accessibilityLabel={`${svc.desc}, ${formatCurrency(svc.price)}`} accessibilityState={{ checked: svc.enabled }} onPress={() => toggleService(svc.id)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: svc.enabled ? "#10B981" : theme.border, backgroundColor: svc.enabled ? "#10B981" : "transparent", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
              {svc.enabled ? <Feather name="check" size={14} color="#FFF" /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" style={{ fontWeight: "600" }}>{svc.desc}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>CPT {svc.cpt} | {svc.provider}</ThemedText>
            </View>
            <ThemedText style={{ fontWeight: "700", color: svc.enabled ? "#10B981" : theme.textSecondary }}>{formatCurrency(svc.price)}</ThemedText>
          </Pressable>
        ))}

        <View style={{ flexDirection: "row", alignItems: "center", marginTop: Spacing.md, gap: 8 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border }}>
            <Feather name="plus" size={14} color={theme.textSecondary} />
            <TextInput testID="input-add-cpt" accessibilityLabel="Add CPT code" value={addCpt} onChangeText={setAddCpt} placeholder="Add CPT code..." placeholderTextColor={theme.textSecondary} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 6, fontSize: 13, color: theme.text }} />
          </View>
          <Pressable testID="button-add-service" accessibilityRole="button" accessibilityLabel="Add service" onPress={() => {
            if (addCpt.trim()) {
              setServices(prev => [...prev, { id: String(prev.length + 1), cpt: addCpt.trim(), desc: `Procedure ${addCpt.trim()}`, provider: "Provider", npi: "0000000000", price: 82.40, enabled: true }]);
              setAddCpt("");
            }
          }} style={{ backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md }}>
            <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700" }}>Add</ThemedText>
          </Pressable>
        </View>
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
          <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Bundled Estimate</ThemedText>
          <LegalBadge text="CONVENING ENTITY" color="#8B5CF6" />
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md, lineHeight: 18 }}>
          As a Convening Entity under the No Surprises Act (2026), we bundle costs from all providers into one transparent price.
        </ThemedText>
        <View style={{ backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: BorderRadius.md, padding: Spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Services selected</ThemedText>
            <ThemedText type="small" style={{ fontWeight: "600" }}>{services.filter(s => s.enabled).length}</ThemedText>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Providers included</ThemedText>
            <ThemedText type="small" style={{ fontWeight: "600" }}>{new Set(services.filter(s => s.enabled).map(s => s.provider)).size}</ThemedText>
          </View>
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 6 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <ThemedText style={{ fontWeight: "700" }}>Total Fixed Price</ThemedText>
            <ThemedText style={{ fontWeight: "800", color: "#10B981", fontSize: 20 }}>{formatCurrency(totalPrice)}</ThemedText>
          </View>
        </View>
        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 8, fontStyle: "italic", lineHeight: 16 }}>
          Dispute protection: If billed more than {formatCurrency(totalPrice + 400)}, you may file a federal dispute at no cost.
        </ThemedText>
      </Card>

      <Pressable testID="button-generate-gfe" accessibilityRole="button" accessibilityLabel={generated ? "Regenerate Good Faith Estimate" : "Generate Good Faith Estimate"} onPress={generateAndShowGFE} style={{ backgroundColor: "#3B82F6", borderRadius: BorderRadius.lg, paddingVertical: 16, alignItems: "center", marginBottom: Spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="file-text" size={18} color="#FFF" />
          <ThemedText style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>{generated ? "Regenerate Good Faith Estimate" : "Generate Good Faith Estimate"}</ThemedText>
        </View>
      </Pressable>

      {confirmedGfe ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={{ padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: "#10B981" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Feather name="check-circle" size={20} color="#10B981" />
              <ThemedText style={{ fontWeight: "700", marginLeft: 8, color: "#10B981" }}>GFE Confirmed</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18, marginBottom: 4 }}>
              Your Good Faith Estimate has been acknowledged with {services.filter(s => s.enabled).length} services totaling {formatCurrency(confirmedGfe.cost)}. This is a binding price estimate protected under federal law.
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, fontFamily: "monospace" }}>
              {confirmedGfe.gfeId}
            </ThemedText>
            <View style={{ flexDirection: "row", gap: 8, marginTop: Spacing.sm }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Download PDF" style={{ flex: 1, backgroundColor: "#10B98120", paddingVertical: 10, borderRadius: BorderRadius.md, alignItems: "center" }}>
                <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700" }}>Download PDF</ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Share with provider" style={{ flex: 1, backgroundColor: "#3B82F620", paddingVertical: 10, borderRadius: BorderRadius.md, alignItems: "center" }}>
                <ThemedText type="small" style={{ color: "#3B82F6", fontWeight: "700" }}>Share with Provider</ThemedText>
              </Pressable>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function HSAVerificationTab({ theme, isDark }: { theme: any; isDark: boolean }) {
  const [planType, setPlanType] = useState<"individual" | "family">("individual");
  const [monthlyFee, setMonthlyFee] = useState("125");
  const [verified, setVerified] = useState(false);

  const limit = planType === "individual" ? 150 : 300;
  const fee = parseFloat(monthlyFee) || 0;
  const qualifies = fee <= limit;
  const annualCost = fee * 12;
  const hsaLimit2026 = planType === "individual" ? 4300 : 8550;

  return (
    <View>
      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="credit-card" iconColor="#8B5CF6" title="HSA/FSA Verification" subtitle="Check if your plan qualifies for tax-advantaged payments" />
        <LegalBadge text="2026 HSA LAW UPDATE" color="#8B5CF6" />
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: 8 }}>
          New for 2026: Direct Primary Care (DPC) fees up to $150/month (individual) or $300/month (family) can now be paid using HSA funds, making fixed-price healthcare tax-advantaged.
        </ThemedText>
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Plan Configuration</ThemedText>

        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 6 }}>Coverage Type</ThemedText>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: Spacing.md }}>
          {(["individual", "family"] as const).map((type) => {
            const typeLimit = type === "individual" ? 150 : 300;
            return (
              <Pressable key={type} testID={`hsa-plan-${type}`} accessibilityRole="radio" accessibilityLabel={`${type} plan, max $${typeLimit} per month`} accessibilityState={{ selected: planType === type }} onPress={() => setPlanType(type)} style={{ flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: planType === type ? "#8B5CF6" : theme.border, backgroundColor: planType === type ? "#8B5CF620" : "transparent", alignItems: "center" }}>
                <Feather name={type === "individual" ? "user" : "users"} size={20} color={planType === type ? "#8B5CF6" : theme.textSecondary} />
                <ThemedText type="small" style={{ fontWeight: "700", marginTop: 4, color: planType === type ? "#8B5CF6" : theme.textSecondary, textTransform: "capitalize" }}>{type}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>Max ${typeLimit}/mo</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 6 }}>Monthly DPC Fee</ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border, marginBottom: Spacing.md }}>
          <ThemedText style={{ fontWeight: "600", marginRight: 4 }}>$</ThemedText>
          <TextInput testID="input-monthly-fee" accessibilityLabel="Monthly DPC fee" value={monthlyFee} onChangeText={setMonthlyFee} keyboardType="numeric" style={{ flex: 1, paddingVertical: 12, fontSize: Typography.sizes.body, color: theme.text }} placeholderTextColor={theme.textSecondary} placeholder="Monthly fee" />
        </View>

        <Pressable testID="button-verify-hsa" accessibilityRole="button" accessibilityLabel="Verify HSA eligibility" onPress={() => setVerified(true)} style={{ backgroundColor: "#8B5CF6", borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="check-circle" size={16} color="#FFF" />
            <ThemedText style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>Verify HSA Eligibility</ThemedText>
          </View>
        </Pressable>
      </Card>

      {verified ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={{ padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: qualifies ? "#10B981" : "#F59E0B" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
              <Feather name={qualifies ? "check-circle" : "alert-triangle"} size={24} color={qualifies ? "#10B981" : "#F59E0B"} />
              <ThemedText style={{ fontWeight: "700", marginLeft: 8, color: qualifies ? "#10B981" : "#F59E0B", fontSize: 16 }}>
                {qualifies ? "HSA Eligible" : "Exceeds HSA Limit"}
              </ThemedText>
            </View>

            <View style={{ backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: BorderRadius.md, padding: Spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Monthly DPC fee</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>${fee}/mo</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>2026 DPC limit ({planType})</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>${limit}/mo</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Annual cost</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{formatCurrency(annualCost)}</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>2026 HSA contribution limit</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{formatCurrency(hsaLimit2026)}</ThemedText>
              </View>
              {qualifies ? (
                <View style={{ backgroundColor: "#10B98115", borderRadius: BorderRadius.sm, padding: 8, marginTop: 8 }}>
                  <ThemedText type="small" style={{ color: "#10B981", fontWeight: "700" }}>Tax savings estimate: {formatCurrency(annualCost * 0.25)} (at 25% marginal rate)</ThemedText>
                </View>
              ) : (
                <View style={{ backgroundColor: "#F59E0B15", borderRadius: BorderRadius.sm, padding: 8, marginTop: 8 }}>
                  <ThemedText type="small" style={{ color: "#F59E0B", fontWeight: "600", lineHeight: 16 }}>Your fee exceeds the ${limit}/mo limit. Only ${limit}/mo is HSA-eligible. The remaining ${formatCurrency(fee - limit)}/mo must be paid with after-tax funds.</ThemedText>
                </View>
              )}
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function IdentityVaultTab({ theme, isDark }: { theme: any; isDark: boolean }) {
  const [documents, setDocuments] = useState([
    { id: "1", type: "Passport", country: "Mexico", number: "G****1234", expires: "2029-08-15", status: "verified" },
    { id: "2", type: "State ID", country: "United States", number: "D****5678", expires: "2027-03-20", status: "verified" },
  ]);

  const docTypes = [
    { type: "Passport", icon: "globe" as keyof typeof Feather.glyphMap, color: "#3B82F6", desc: "Foreign or US passport" },
    { type: "State ID", icon: "credit-card" as keyof typeof Feather.glyphMap, color: "#10B981", desc: "Driver's license or state ID" },
    { type: "Consular ID", icon: "flag" as keyof typeof Feather.glyphMap, color: "#F59E0B", desc: "Matricula consular or equivalent" },
    { type: "ITIN Letter", icon: "file-text" as keyof typeof Feather.glyphMap, color: "#8B5CF6", desc: "IRS ITIN assignment letter" },
    { type: "Work Permit", icon: "briefcase" as keyof typeof Feather.glyphMap, color: "#06B6D4", desc: "Employment authorization (EAD)" },
    { type: "Refugee Card", icon: "heart" as keyof typeof Feather.glyphMap, color: "#EF4444", desc: "I-94 or refugee travel document" },
  ];

  return (
    <View>
      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="lock" iconColor="#06B6D4" title="Identity Vault" subtitle="Secure document storage accepted by provider network" />
        <LegalBadge text="256-BIT ENCRYPTED" color="#06B6D4" />
        <LegalBadge text="HIPAA COMPLIANT" color="#10B981" />
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: 8 }}>
          Store identification documents securely in lieu of a Social Security Number. Our provider network accepts passport, consular ID, ITIN, and other government-issued IDs for patient registration.
        </ThemedText>
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Your Documents</ThemedText>
        {documents.map((doc) => (
          <View key={doc.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: theme.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
              <Feather name="file" size={18} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText type="small" style={{ fontWeight: "700" }}>{doc.type}</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>{doc.country} | {doc.number} | Exp: {doc.expires}</ThemedText>
            </View>
            <View style={{ backgroundColor: "#10B98120", paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full }}>
              <ThemedText type="small" style={{ color: "#10B981", fontWeight: "600", fontSize: 10 }}>Verified</ThemedText>
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Accepted Document Types</ThemedText>
        <View style={{ gap: 10 }}>
          {docTypes.map((dt) => (
            <Pressable key={dt.type} testID={`vault-add-${dt.type.replace(/\s/g, "-").toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`Add ${dt.type} document`} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: BorderRadius.md }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: dt.color + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
                <Feather name={dt.icon} size={16} color={dt.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{dt.type}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>{dt.desc}</ThemedText>
              </View>
              <Feather name="plus-circle" size={20} color={theme.primary} />
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: "#06B6D4" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="info" size={14} color="#06B6D4" />
          <ThemedText type="small" style={{ color: "#06B6D4", marginLeft: 8, flex: 1, lineHeight: 16 }}>
            Under TEFCA IAS (2026), you can pull records from any previous clinic and share them with new providers using your vault identity, no SSN required.
          </ThemedText>
        </View>
      </Card>
    </View>
  );
}

function SlidingScaleTab({ theme, isDark }: { theme: any; isDark: boolean }) {
  const [income, setIncome] = useState("32000");
  const [householdSize, setHouseholdSize] = useState("1");
  const [calculated, setCalculated] = useState(false);

  const annualIncome = parseFloat(income) || 0;
  const hhSize = parseInt(householdSize) || 1;
  const fpl2026 = 15650 + (hhSize - 1) * 5580;
  const fplPercent = Math.round((annualIncome / fpl2026) * 100);

  let discountTier = "Full Price";
  let discountPercent = 0;
  let tierColor = "#6B7280";
  if (fplPercent <= 100) { discountTier = "Tier A — Maximum Discount"; discountPercent = 80; tierColor = "#10B981"; }
  else if (fplPercent <= 150) { discountTier = "Tier B — High Discount"; discountPercent = 65; tierColor = "#06B6D4"; }
  else if (fplPercent <= 200) { discountTier = "Tier C — Moderate Discount"; discountPercent = 50; tierColor = "#3B82F6"; }
  else if (fplPercent <= 250) { discountTier = "Tier D — Standard Discount"; discountPercent = 35; tierColor = "#8B5CF6"; }
  else if (fplPercent <= 300) { discountTier = "Tier E — Reduced Discount"; discountPercent = 20; tierColor = "#F59E0B"; }
  else if (fplPercent <= 400) { discountTier = "Tier F — Minimal Discount"; discountPercent = 10; tierColor = "#F97316"; }

  const exampleVisit = 82.40;
  const adjustedPrice = exampleVisit * (1 - discountPercent / 100);

  return (
    <View>
      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="sliders" iconColor="#F59E0B" title="Sliding Scale Calculator" subtitle="Income-based pricing adjustment" />
        <LegalBadge text="HRSA SLIDING FEE SCALE" color="#F59E0B" />
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: 8 }}>
          Automatically adjusts your fixed price based on household income relative to the 2026 Federal Poverty Level (FPL). Upload a 1040, W-2, or recent pay stubs for verification.
        </ThemedText>
      </Card>

      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Income Information</ThemedText>

        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 6 }}>Annual Household Income</ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border, marginBottom: Spacing.md }}>
          <ThemedText style={{ fontWeight: "600", marginRight: 4 }}>$</ThemedText>
          <TextInput testID="input-annual-income" accessibilityLabel="Annual household income" value={income} onChangeText={setIncome} keyboardType="numeric" style={{ flex: 1, paddingVertical: 12, fontSize: Typography.sizes.body, color: theme.text }} placeholderTextColor={theme.textSecondary} placeholder="Annual income" />
        </View>

        <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 6 }}>Household Size</ThemedText>
        <View style={{ flexDirection: "row", gap: 6, marginBottom: Spacing.md, flexWrap: "wrap" }}>
          {["1", "2", "3", "4", "5", "6+"].map((size) => (
            <Pressable key={size} testID={`hh-size-${size}`} accessibilityRole="radio" accessibilityLabel={`Household size ${size}`} accessibilityState={{ selected: householdSize === (size === "6+" ? "6" : size) }} onPress={() => setHouseholdSize(size === "6+" ? "6" : size)} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2, borderColor: householdSize === (size === "6+" ? "6" : size) ? "#F59E0B" : theme.border, backgroundColor: householdSize === (size === "6+" ? "6" : size) ? "#F59E0B20" : "transparent" }}>
              <ThemedText type="small" style={{ fontWeight: "700", color: householdSize === (size === "6+" ? "6" : size) ? "#F59E0B" : theme.textSecondary }}>{size}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable testID="button-upload-docs" accessibilityRole="button" accessibilityLabel="Upload income documents" style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: "dashed", borderColor: theme.border, marginBottom: Spacing.md }}>
          <Feather name="upload" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "600", marginLeft: 8 }}>Upload 1040, W-2, or Pay Stubs</ThemedText>
        </Pressable>

        <Pressable testID="button-calculate-sliding" accessibilityRole="button" accessibilityLabel="Calculate discount" onPress={() => setCalculated(true)} style={{ backgroundColor: "#F59E0B", borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="percent" size={16} color="#FFF" />
            <ThemedText style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>Calculate Discount</ThemedText>
          </View>
        </Pressable>
      </Card>

      {calculated ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={{ padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: tierColor }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
              <Feather name="tag" size={24} color={tierColor} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <ThemedText style={{ fontWeight: "700", color: tierColor, fontSize: 16 }}>{discountTier}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>{discountPercent}% discount applied</ThemedText>
              </View>
            </View>

            <View style={{ backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: BorderRadius.md, padding: Spacing.md }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>2026 FPL ({hhSize} person{hhSize > 1 ? "s" : ""})</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{formatCurrency(fpl2026)}</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Your income as % of FPL</ThemedText>
                <ThemedText type="small" style={{ fontWeight: "600" }}>{fplPercent}%</ThemedText>
              </View>
              <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 6 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Example: Office Visit (CPT 99213)</ThemedText>
                <ThemedText type="small" style={{ textDecorationLine: "line-through", color: theme.textSecondary }}>{formatCurrency(exampleVisit)}</ThemedText>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                <ThemedText style={{ fontWeight: "700" }}>Your adjusted price</ThemedText>
                <ThemedText style={{ fontWeight: "800", color: tierColor, fontSize: 20 }}>{formatCurrency(adjustedPrice)}</ThemedText>
              </View>
            </View>
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function VeteranBridgeTab({ theme, isDark }: { theme: any; isDark: boolean }) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [enrolled, setEnrolled] = useState(false);

  const plans = [
    {
      id: "primary",
      name: "Primary Care Bridge",
      price: 89,
      duration: "3 months",
      color: "#3B82F6",
      icon: "user" as keyof typeof Feather.glyphMap,
      includes: ["Unlimited primary care visits", "Basic lab work (CBC, CMP, A1C)", "Prescription management", "Telehealth access 24/7", "Care coordinator"],
      desc: "For veterans waiting on VA Community Care referrals for primary care.",
    },
    {
      id: "mental",
      name: "Mental Health Bridge",
      price: 129,
      duration: "3 months",
      color: "#8B5CF6",
      icon: "heart" as keyof typeof Feather.glyphMap,
      includes: ["Weekly therapy sessions (virtual)", "Psychiatric med management", "Crisis support line", "Peer support group access", "PTSD-informed care"],
      desc: "For veterans experiencing VA mental health backlogs (avg 36-day wait in 2026).",
    },
    {
      id: "comprehensive",
      name: "Comprehensive Bridge",
      price: 149,
      duration: "3 months",
      color: "#10B981",
      icon: "shield" as keyof typeof Feather.glyphMap,
      includes: ["All Primary Care benefits", "All Mental Health benefits", "Specialty referral coordination", "Urgent care visits (2/mo)", "Imaging (X-ray, ultrasound)", "HSA-eligible ($149 < $150 limit)"],
      desc: "Complete bridge coverage while awaiting VA authorization. HSA-eligible under 2026 DPC rules.",
    },
  ];

  return (
    <View>
      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="flag" iconColor="#10B981" title="Veteran Bridge Care" subtitle="Immediate care while awaiting VA referrals" />
        <LegalBadge text="VA-INTERIM BRIDGE" color="#10B981" />
        <LegalBadge text="HSA ELIGIBLE (DPC)" color="#8B5CF6" />
        <ThemedText type="body" style={{ color: theme.textSecondary, lineHeight: 22, marginTop: 8 }}>
          3-month fixed-price subscriptions for veterans waiting on VA Community Care referrals. Lower cost than a single private ER visit. All plans qualify as DPC under the 2026 HSA rules.
        </ThemedText>
      </Card>

      <Card style={{ padding: Spacing.md, marginBottom: Spacing.md, borderLeftWidth: 3, borderLeftColor: "#F59E0B" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="alert-triangle" size={16} color="#F59E0B" />
          <ThemedText type="small" style={{ color: "#F59E0B", marginLeft: 8, fontWeight: "600", flex: 1, lineHeight: 16 }}>
            2026 VA backlog: Average Community Care referral wait is 28-45 days. Mental health waits average 36 days. Bridge care fills this gap.
          </ThemedText>
        </View>
      </Card>

      {plans.map((plan) => (
        <Pressable key={plan.id} testID={`vet-plan-${plan.id}`} accessibilityRole="button" accessibilityLabel={`${plan.name}, $${plan.price} per month, ${plan.duration}`} accessibilityState={{ selected: selectedPlan === plan.id }} onPress={() => setSelectedPlan(selectedPlan === plan.id ? null : plan.id)}>
          <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: selectedPlan === plan.id ? 2 : 1, borderColor: selectedPlan === plan.id ? plan.color : theme.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: plan.color + "20", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                <Feather name={plan.icon} size={22} color={plan.color} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{plan.name}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>{plan.duration} subscription</ThemedText>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <ThemedText style={{ fontWeight: "800", color: plan.color, fontSize: 22 }}>${plan.price}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10 }}>/month</ThemedText>
              </View>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18, marginBottom: Spacing.sm }}>{plan.desc}</ThemedText>

            {selectedPlan === plan.id ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <View style={{ backgroundColor: isDark ? "#1E293B" : "#F8FAFC", borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm }}>
                  <ThemedText type="small" style={{ fontWeight: "700", marginBottom: 8 }}>What's Included</ThemedText>
                  {plan.includes.map((item, i) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4 }}>
                      <Feather name="check" size={12} color={plan.color} style={{ marginTop: 3, marginRight: 6 }} />
                      <ThemedText type="small" style={{ flex: 1, lineHeight: 16 }}>{item}</ThemedText>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>3-month total</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "700" }}>${plan.price * 3}</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontStyle: "italic", lineHeight: 16 }}>
                  Compare: Average ER visit without insurance costs $2,200+. This plan provides 3 months of comprehensive care for ${plan.price * 3}.
                </ThemedText>
              </Animated.View>
            ) : null}
          </Card>
        </Pressable>
      ))}

      {selectedPlan ? (
        <Pressable testID="button-enroll-veteran" accessibilityRole="button" accessibilityLabel={enrolled ? "Enrolled in bridge care" : "Enroll in bridge care"} onPress={() => setEnrolled(true)} style={{ backgroundColor: "#10B981", borderRadius: BorderRadius.lg, paddingVertical: 16, alignItems: "center", marginBottom: Spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="flag" size={18} color="#FFF" />
            <ThemedText style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>{enrolled ? "Enrolled" : "Enroll in Bridge Care"}</ThemedText>
          </View>
        </Pressable>
      ) : null}

      {enrolled ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={{ padding: Spacing.lg, borderLeftWidth: 3, borderLeftColor: "#10B981" }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Feather name="check-circle" size={20} color="#10B981" />
              <ThemedText style={{ fontWeight: "700", marginLeft: 8, color: "#10B981" }}>Bridge Care Activated</ThemedText>
            </View>
            <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18 }}>
              Your Veteran Bridge Care subscription is active. A care coordinator will contact you within 24 hours to schedule your first appointment. This is a Service Agreement, not an indemnity plan.
            </ThemedText>
            <LegalBadge text="DPC SERVICE AGREEMENT" color="#3B82F6" />
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SignupForm({ theme, programInfo }: { theme: any; programInfo: any }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [memberId, setMemberId] = useState("");

  const signupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/savings/uninsured/signup", { firstName, lastName, email, phone, zipCode });
      return res.json();
    },
    onSuccess: (data: any) => { setMemberId(data.memberId); setShowSuccess(true); },
  });

  if (showSuccess) {
    return (
      <Animated.View entering={FadeIn.duration(400)}>
        <Card style={{ padding: Spacing.xl, alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md }}>
            <Feather name="check-circle" size={32} color="#10B981" />
          </View>
          <ThemedText type="title" style={{ fontWeight: "800", marginBottom: Spacing.sm }}>Welcome!</ThemedText>
          <ThemedText type="body" style={{ textAlign: "center", color: theme.textSecondary, marginBottom: Spacing.md }}>Your Tabula Direct Access account has been created.</ThemedText>
          <Card style={{ padding: Spacing.md, backgroundColor: theme.primary + "10", width: "100%" }}>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 4 }}>Your Member ID</ThemedText>
            <ThemedText type="title" style={{ fontWeight: "800", color: theme.primary, letterSpacing: 1 }}>{memberId}</ThemedText>
          </Card>
        </Card>
      </Animated.View>
    );
  }

  return (
    <View>
      <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
        <SectionHeader icon="user-plus" iconColor="#10B981" title={programInfo?.name || "Tabula Direct Access"} subtitle="Free enrollment — no membership fees" />
        {programInfo?.benefits ? (
          <View style={{ marginTop: Spacing.sm }}>
            {programInfo.benefits.slice(0, 4).map((b: string, i: number) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
                <Feather name="check" size={14} color="#10B981" style={{ marginTop: 3, marginRight: 8 }} />
                <ThemedText type="small" style={{ flex: 1, lineHeight: 18 }}>{b}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ padding: Spacing.lg }}>
        <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.md }}>Your Information</ThemedText>
        {[
          { label: "First Name", value: firstName, setter: setFirstName, key: "firstName", icon: "user" as keyof typeof Feather.glyphMap },
          { label: "Last Name", value: lastName, setter: setLastName, key: "lastName", icon: "user" as keyof typeof Feather.glyphMap },
          { label: "Email", value: email, setter: setEmail, key: "email", icon: "mail" as keyof typeof Feather.glyphMap },
          { label: "Phone (optional)", value: phone, setter: setPhone, key: "phone", icon: "phone" as keyof typeof Feather.glyphMap },
          { label: "ZIP Code (optional)", value: zipCode, setter: setZipCode, key: "zipCode", icon: "map-pin" as keyof typeof Feather.glyphMap },
        ].map((field) => (
          <View key={field.key} style={{ marginBottom: Spacing.md }}>
            <ThemedText type="small" style={{ fontWeight: "600", marginBottom: 4 }}>{field.label}</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border }}>
              <Feather name={field.icon} size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput testID={`input-${field.key}`} accessibilityLabel={field.label} value={field.value} onChangeText={field.setter} style={{ flex: 1, paddingVertical: 12, fontSize: Typography.sizes.body, color: theme.text }} placeholderTextColor={theme.textSecondary} placeholder={field.label.replace(" (optional)", "")} keyboardType={field.key === "email" ? "email-address" : field.key === "phone" ? "phone-pad" : field.key === "zipCode" ? "number-pad" : "default"} autoCapitalize={field.key === "email" ? "none" : "words"} />
            </View>
          </View>
        ))}
        <Pressable testID="button-signup" accessibilityRole="button" accessibilityLabel="Sign up for free" accessibilityState={{ disabled: !firstName || !lastName || !email || signupMutation.isPending }} onPress={() => signupMutation.mutate()} disabled={!firstName || !lastName || !email || signupMutation.isPending} style={{ backgroundColor: !firstName || !lastName || !email ? theme.backgroundTertiary : "#10B981", borderRadius: BorderRadius.lg, paddingVertical: 16, alignItems: "center", marginTop: Spacing.sm }}>
          {signupMutation.isPending ? (
            <ThemedText style={{ color: "#FFF", fontWeight: "700" }}>Creating Account...</ThemedText>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Feather name="user-plus" size={18} color="#FFF" />
              <ThemedText style={{ color: "#FFF", fontWeight: "700", marginLeft: 8 }}>Sign Up — It's Free</ThemedText>
            </View>
          )}
        </Pressable>
        {signupMutation.isError ? (
          <ThemedText type="small" style={{ color: theme.error, marginTop: Spacing.sm, textAlign: "center" }}>Something went wrong. Please try again.</ThemedText>
        ) : null}
      </Card>
    </View>
  );
}

export default function UninsuredPlatformScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ActiveTab>("rates");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hrsaZip, setHrsaZip] = useState("");
  const [hrsaClinics, setHrsaClinics] = useState<HRSAClinic[]>([]);
  const [hrsaSearching, setHrsaSearching] = useState(false);
  const [hrsaSource, setHrsaSource] = useState<string | null>(null);

  const { data: ratesData, isLoading: ratesLoading } = useQuery<RatesData>({ queryKey: ["/api/savings/uninsured/rates"] });
  const { data: providersData, isLoading: providersLoading } = useQuery<ProvidersData>({ queryKey: ["/api/savings/uninsured/providers"] });

  const [hrsaSearched, setHrsaSearched] = useState(false);

  const searchHRSAClinics = async () => {
    const zip = hrsaZip.trim().replace(/\D/g, "");
    if (zip.length !== 5) return;
    setHrsaSearching(true);
    setHrsaSearched(true);
    try {
      const url = new URL(`/api/hrsa/search?zip=${zip}&radius=25`, getApiUrl());
      const resp = await fetch(url.toString());
      if (!resp.ok) { setHrsaClinics([]); setHrsaSource("error"); setHrsaSearching(false); return; }
      const data = await resp.json();
      setHrsaClinics(data.clinics || []);
      setHrsaSource(data.source || "api");
    } catch { setHrsaClinics([]); setHrsaSource("error"); }
    setHrsaSearching(false);
  };

  const filteredRates = useMemo(() => {
    if (!ratesData) return [];
    let rates = ratesData.rates;
    if (selectedCategory) rates = rates.filter(r => r.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      rates = rates.filter(r => r.cptCode.includes(q) || r.description.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    }
    return rates;
  }, [ratesData, selectedCategory, searchQuery]);

  const isLoading = (activeTab === "rates" && ratesLoading) || (activeTab === "providers" && providersLoading);
  if (isLoading) return <LoadingState fullScreen />;

  const tabs: { key: ActiveTab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "rates", label: "Rates", icon: "dollar-sign" },
    { key: "providers", label: "Providers", icon: "briefcase" },
    { key: "gfe", label: "GFE", icon: "file-text" },
    { key: "hsa", label: "HSA/FSA", icon: "credit-card" },
    { key: "vault", label: "ID Vault", icon: "lock" },
    { key: "sliding", label: "Scale", icon: "sliders" },
    { key: "veteran", label: "Veterans", icon: "flag" },
    { key: "signup", label: "Sign Up", icon: "user-plus" },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.lg }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)}>
          <Card style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.md }}>
                <Feather name="heart" size={22} color="#10B981" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Tabula Direct Access</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Quality care at Medicare-based prices</ThemedText>
              </View>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22, color: theme.textSecondary }}>
              No insurance? No problem. Access healthcare at transparent rates based on 2026 Medicare pricing — typically 60-95% less than hospital retail. HSA-eligible DPC plans available under new 2026 federal rules.
            </ThemedText>
          </Card>
        </Animated.View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
          <View style={styles.tabContainer}>
            {tabs.map((tab) => (
              <Pressable key={tab.key} testID={`tab-${tab.key}`} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected: activeTab === tab.key }} style={[styles.tab, { backgroundColor: activeTab === tab.key ? theme.primary : theme.backgroundSecondary, borderColor: activeTab === tab.key ? theme.primary : theme.border }]} onPress={() => setActiveTab(tab.key)}>
                <Feather name={tab.icon} size={13} color={activeTab === tab.key ? "#FFFFFF" : theme.textSecondary} />
                <ThemedText type="small" style={{ color: activeTab === tab.key ? "#FFFFFF" : theme.textSecondary, marginLeft: 4, fontWeight: "600", fontSize: 11 }}>{tab.label}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {activeTab === "rates" ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, marginBottom: Spacing.md, borderWidth: 1, borderColor: theme.border }}>
              <Feather name="search" size={16} color={theme.textSecondary} />
              <TextInput testID="input-search-rates" accessibilityLabel="Search CPT code or procedure" value={searchQuery} onChangeText={setSearchQuery} placeholder="Search CPT code or procedure..." placeholderTextColor={theme.textSecondary} style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 8, fontSize: Typography.sizes.body, color: theme.text }} />
              {searchQuery ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearchQuery("")}><Feather name="x" size={16} color={theme.textSecondary} /></Pressable> : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable testID="filter-all-categories" accessibilityRole="radio" accessibilityLabel="All categories" accessibilityState={{ selected: !selectedCategory }} onPress={() => setSelectedCategory(null)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: !selectedCategory ? theme.primary : theme.backgroundSecondary, borderWidth: 1, borderColor: !selectedCategory ? theme.primary : theme.border }}>
                  <ThemedText type="small" style={{ fontWeight: "600", color: !selectedCategory ? "#FFF" : theme.textSecondary, fontSize: 11 }}>All</ThemedText>
                </Pressable>
                {(ratesData?.categories || []).map((cat) => (
                  <Pressable key={cat} testID={`filter-${cat}`} accessibilityRole="radio" accessibilityLabel={`Category: ${cat}`} accessibilityState={{ selected: selectedCategory === cat }} onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, backgroundColor: selectedCategory === cat ? (CATEGORY_COLORS[cat] || theme.primary) : theme.backgroundSecondary, borderWidth: 1, borderColor: selectedCategory === cat ? (CATEGORY_COLORS[cat] || theme.primary) : theme.border }}>
                    <ThemedText type="small" style={{ fontWeight: "600", color: selectedCategory === cat ? "#FFF" : theme.textSecondary, fontSize: 11 }}>{cat}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
              {filteredRates.length} procedures found{ratesData?.lastUpdated ? ` | Updated ${ratesData.lastUpdated}` : ""}
            </ThemedText>
            {filteredRates.map((rate) => <RateCard key={rate.cptCode} rate={rate} theme={theme} />)}
            {filteredRates.length === 0 ? (
              <Card style={{ padding: Spacing.xl, alignItems: "center" }}>
                <Feather name="search" size={32} color={theme.textSecondary} />
                <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No procedures found</ThemedText>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeTab === "providers" ? (
          <>
            <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
              <SectionHeader icon="map-pin" iconColor="#10B981" title="HRSA Clinic Finder" subtitle="Search 1,400+ FQHCs by ZIP code" />
              <LegalBadge text="42 U.S.C. 254b SLIDING FEE" color="#10B981" />
              <ThemedText type="small" style={{ color: theme.textSecondary, lineHeight: 18, marginTop: 6, marginBottom: Spacing.md }}>
                Federally Qualified Health Centers are legally required to see all patients regardless of ability to pay, on a sliding fee scale.
              </ThemedText>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: theme.border }}>
                  <Feather name="map-pin" size={14} color={theme.textSecondary} />
                  <TextInput testID="input-hrsa-zip" accessibilityLabel="ZIP code for clinic search" value={hrsaZip} onChangeText={(v) => setHrsaZip(v.replace(/\D/g, "").slice(0, 5))} placeholder="ZIP code" placeholderTextColor={theme.textSecondary} keyboardType="number-pad" maxLength={5} returnKeyType="search" onSubmitEditing={searchHRSAClinics} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 6, fontSize: 14, color: theme.text }} />
                </View>
                <Pressable testID="button-search-hrsa" accessibilityRole="button" accessibilityLabel="Search HRSA clinics" onPress={searchHRSAClinics} disabled={hrsaSearching || hrsaZip.length !== 5} style={{ backgroundColor: hrsaZip.length === 5 ? "#10B981" : theme.backgroundTertiary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, justifyContent: "center" }}>
                  <ThemedText type="small" style={{ color: "#FFF", fontWeight: "700" }}>{hrsaSearching ? "..." : "Search"}</ThemedText>
                </Pressable>
              </View>
            </Card>

            {hrsaSearched && hrsaClinics.length === 0 && !hrsaSearching ? (
              <Card style={{ padding: Spacing.lg, alignItems: "center", marginBottom: Spacing.md }}>
                <Feather name={hrsaSource === "error" ? "alert-circle" : "map"} size={28} color={hrsaSource === "error" ? "#EF4444" : theme.textSecondary} />
                <ThemedText type="small" style={{ color: hrsaSource === "error" ? "#EF4444" : theme.textSecondary, marginTop: Spacing.sm, fontWeight: "600" }}>
                  {hrsaSource === "error" ? "Unable to search clinics. Please try again." : "No clinics found near this ZIP code."}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4, fontSize: 11 }}>
                  {hrsaSource === "error" ? "Check your connection and retry." : "Try a different ZIP code or expand your search."}
                </ThemedText>
              </Card>
            ) : null}

            {hrsaClinics.length > 0 ? (
              <Animated.View entering={FadeIn.duration(300)}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                  {hrsaClinics.length} clinics found near {hrsaZip}{hrsaSource === "demo" ? " (demo data)" : ""}
                </ThemedText>
                {hrsaClinics.map((clinic) => (
                  <Card key={clinic.id} style={{ padding: Spacing.md, marginBottom: Spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
                        <Feather name="map-pin" size={18} color="#10B981" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="small" style={{ fontWeight: "700" }}>{clinic.name}</ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11, lineHeight: 16 }}>{clinic.address}</ThemedText>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                          <View style={{ backgroundColor: "#10B98115", paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                            <ThemedText type="small" style={{ color: "#10B981", fontSize: 9, fontWeight: "700" }}>{clinic.clinicType}</ThemedText>
                          </View>
                          {clinic.acceptsUninsured ? (
                            <View style={{ backgroundColor: "#3B82F615", paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full }}>
                              <ThemedText type="small" style={{ color: "#3B82F6", fontSize: 9, fontWeight: "700" }}>Sliding Scale</ThemedText>
                            </View>
                          ) : null}
                        </View>
                        {clinic.languages.length > 0 ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4 }}>
                            Languages: {clinic.languages.slice(0, 3).join(", ")}
                          </ThemedText>
                        ) : null}
                        {clinic.phone ? (
                          <ThemedText type="small" style={{ color: theme.primary, fontSize: 11, marginTop: 2 }}>{clinic.phone}</ThemedText>
                        ) : null}
                      </View>
                      {clinic.distanceMiles != null ? (
                        <View style={{ alignItems: "flex-end" }}>
                          <ThemedText type="small" style={{ fontWeight: "700", color: "#10B981" }}>{clinic.distanceMiles} mi</ThemedText>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                ))}
              </Animated.View>
            ) : null}

            <ThemedText type="subtitle" style={{ fontWeight: "700", marginTop: Spacing.lg, marginBottom: Spacing.sm }}>Network Providers</ThemedText>
            {providersData?.providers?.map((p) => <ProviderCard key={p.id} provider={p} theme={theme} />) || null}
            {!providersData?.providers?.length ? (
              <Card style={{ padding: Spacing.xl, alignItems: "center" }}>
                <Feather name="briefcase" size={32} color={theme.textSecondary} />
                <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>No providers found</ThemedText>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeTab === "gfe" ? <GoodFaithEstimateTab theme={theme} isDark={isDark} /> : null}
        {activeTab === "hsa" ? <HSAVerificationTab theme={theme} isDark={isDark} /> : null}
        {activeTab === "vault" ? <IdentityVaultTab theme={theme} isDark={isDark} /> : null}
        {activeTab === "sliding" ? <SlidingScaleTab theme={theme} isDark={isDark} /> : null}
        {activeTab === "veteran" ? <VeteranBridgeTab theme={theme} isDark={isDark} /> : null}
        {activeTab === "signup" ? <SignupForm theme={theme} programInfo={providersData?.programInfo} /> : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabContainer: { flexDirection: "row", gap: 6 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
});
