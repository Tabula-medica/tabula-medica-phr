/**
 * Care Access Screen
 * ==================
 * Helps uninsured and underinsured patients find free/low-cost care.
 *
 * Nine panels:
 *   1. FQHC free clinic finder — contextual from patient's conditions
 *   2. Direct Primary Care (DPC) — Sesame Care transparent pricing
 *   3. Insurance claims history — FHIR Patient Access API (CMS-9115-F)
 *   4. Medicaid / CHIP eligibility screener
 *   5. ACA marketplace plans
 *   6. Drug savings — auto-populated from existing medication list
 *   7. Behavioral health locator
 *   8. SDoH community resources — FindHelp.org / Aunt Bertha
 *
 * What makes this unique vs any other care finder:
 *   The patient's health record is already in Tabula Medica.
 *   Conditions pre-filter the FQHC search. Medications pre-fill drug pricing.
 *   No typing. One tap to see everything relevant.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FQHCLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website?: string;
  distanceMiles?: number;
  services: string[];
  slidingFeeScale: boolean;
  acceptsUninsured: boolean;
  hours?: string;
}

interface EligibilityResult {
  estimatedStatus: "likely_eligible" | "possibly_eligible" | "likely_ineligible" | "check_required";
  fplPercentage: number;
  explanation: string;
  applyUrl: string;
  programsToCheck: Array<{
    name: string;
    description: string;
    incomeLimit: string;
    applyUrl: string;
  }>;
  chipEligible: boolean;
  marketplaceSubsidyEligible: boolean;
}

interface DrugSaving {
  drugName: string;
  genericName?: string;
  lowestPrice: number;
  lowestPharmacy: string;
  goodRxCouponUrl?: string;
  isGenericAvailable?: boolean;
  drugClass?: string;
  isLive?: boolean;
  patientAssistanceProgram?: string;
  patientAssistanceProgramUrl?: string;
  insuranceCopay?: {
    typicalCopayGeneric: number;
    typicalCopayBrand: number;
    typicalCopaySpecialty: number;
    couponBeatsInsurance: boolean;
    estimatedSavingsVsCopay: number;
  };
  prices?: Array<{
    pharmacy: string;
    cashPrice: number;
    withCouponPrice?: number;
  }>;
}

interface DrugSearchResult {
  brand: string;
  generic: string;
  drugClass: string;
  genericAvailable: boolean;
}

interface MarketplacePlan {
  id: string;
  name: string;
  issuerName: string;
  metalLevel: string;
  type: string;
  premiumBeforeSubsidy: number;
  premiumAfterSubsidy: number;
  deductible: number;
  maxOutOfPocket: number;
  hsaEligible: boolean;
  benefits: Array<{ name: string; covered: boolean; copay?: string; coinsurance?: string }>;
  urls: { summary: string; provider: string; formulary: string };
}

interface SubsidyEstimate {
  aptcAmount: number;
  csrLevel: string;
  estimatedMonthlyPremium: number;
  fplPercentage: number;
  isEligibleForMedicaid: boolean;
  isEligibleForCHIP: boolean;
  explanation: string;
}

interface PayerClaimRecord {
  id: string;
  claimNumber: string;
  dateOfService: string;
  datePaid?: string;
  claimType: string;
  status: string;
  provider: {
    name: string;
    npi?: string;
    specialty?: string;
    address?: string;
    phone?: string;
  };
  facility?: { name: string; type: string };
  diagnosis: Array<{ code: string; display: string; system: string }>;
  procedures: Array<{ code: string; display: string; system: string; quantity?: number }>;
  amounts: {
    billed: number;
    allowed: number;
    paid: number;
    patientResponsibility: number;
    deductible?: number;
    copay?: number;
    coinsurance?: number;
  };
  coverageInfo?: {
    planName: string;
    memberId: string;
    groupNumber?: string;
    network: string;
  };
  notes?: string;
}

interface PayerCoverageRecord {
  id: string;
  payerName: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  relationship: string;
  effectiveStart: string;
  effectiveEnd?: string;
  isActive: boolean;
  network: string;
  planType: string;
  benefits: {
    deductibleIndividual: number;
    deductibleFamily: number;
    oopMaxIndividual: number;
    oopMaxFamily: number;
    deductibleMet: number;
    oopMet: number;
  };
}

interface ClaimsHistoryData {
  claims: PayerClaimRecord[];
  totalCount: number;
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalPatientCost: number;
    claimsByType: Record<string, number>;
    claimsByStatus: Record<string, number>;
    dateRange: { earliest: string; latest: string };
    uniqueProviders: number;
    uniqueDiagnoses: number;
  };
  coverage?: PayerCoverageRecord;
  isLive: boolean;
  payerName: string;
  disclaimer: string;
}

type Panel = "overview" | "eligibility" | "clinics" | "drugs" | "behavioral" | "plans" | "resources" | "dpc" | "claims";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  likely_eligible: { label: "Likely eligible", color: "#34C759", icon: "check-circle" as const },
  possibly_eligible: { label: "Possibly eligible", color: "#FF9F0A", icon: "alert-circle" as const },
  check_required: { label: "Check your state", color: "#FF9F0A", icon: "info" as const },
  likely_ineligible: { label: "Other options available", color: "#8E8E93", icon: "info" as const },
};

const SERVICE_LABELS: Record<string, string> = {
  primary_care: "Primary care",
  dental: "Dental",
  mental_health: "Mental health",
  substance_use: "Substance use",
  pharmacy: "Pharmacy",
  vision: "Vision",
  behavioral_health: "Behavioral health",
};

function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
}

function openUrl(url: string) {
  Linking.openURL(url.startsWith("http") ? url : `https://${url}`);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {subtitle && (
        <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

function EligibilityBadge({ status }: { status: EligibilityResult["estimatedStatus"] }) {
  const config = STATUS_CONFIG[status];
  return (
    <View style={[styles.eligBadge, { backgroundColor: config.color + "20" }]}>
      <Feather name={config.icon} size={14} color={config.color} />
      <ThemedText style={[styles.eligBadgeText, { color: config.color }]}>
        {config.label}
      </ThemedText>
    </View>
  );
}

function ClinicCard({ clinic, index }: { clinic: FQHCLocation; index: number }) {
  const { theme } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * 60)}>
      <Card style={styles.clinicCard}>
        <View style={styles.clinicHeader}>
          <View style={styles.clinicInfo}>
            <ThemedText style={styles.clinicName}>{clinic.name}</ThemedText>
            <ThemedText style={[styles.clinicAddress, { color: theme.textSecondary }]}>
              {clinic.address}, {clinic.city}, {clinic.state}
              {clinic.distanceMiles != null && ` · ${clinic.distanceMiles.toFixed(1)} mi`}
            </ThemedText>
          </View>
          {clinic.slidingFeeScale && (
            <View style={styles.feeBadge}>
              <ThemedText style={styles.feeBadgeText}>Sliding fee</ThemedText>
            </View>
          )}
        </View>

        <View style={styles.serviceRow}>
          {clinic.services.slice(0, 4).map(s => (
            <View key={s} style={[styles.serviceChip, { borderColor: theme.border }]}>
              <ThemedText style={[styles.serviceChipText, { color: theme.textSecondary }]}>
                {SERVICE_LABELS[s] ?? s}
              </ThemedText>
            </View>
          ))}
        </View>

        <View style={styles.clinicActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.border }]}
            onPress={() => callPhone(clinic.phone)}
            accessibilityLabel={`Call ${clinic.name}`}
            accessibilityRole="button"
          >
            <Feather name="phone" size={14} color={theme.primary} />
            <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
              Call
            </ThemedText>
          </TouchableOpacity>
          {clinic.website && (
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: theme.border }]}
              onPress={() => openUrl(clinic.website!)}
              accessibilityLabel={`Visit ${clinic.name} website`}
              accessibilityRole="button"
            >
              <Feather name="globe" size={14} color={theme.primary} />
              <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                Website
              </ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { borderColor: theme.border }]}
            onPress={() =>
              Linking.openURL(
                `https://maps.apple.com/?q=${encodeURIComponent(clinic.address + " " + clinic.city)}`
              )
            }
            accessibilityLabel={`Get directions to ${clinic.name}`}
            accessibilityRole="button"
          >
            <Feather name="map-pin" size={14} color={theme.primary} />
            <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
              Directions
            </ThemedText>
          </TouchableOpacity>
        </View>
      </Card>
    </Animated.View>
  );
}

function DrugCard({ saving, index, expanded, onToggle }: { saving: DrugSaving; index: number; expanded: boolean; onToggle: () => void }) {
  const { theme } = useTheme();
  const copay = saving.insuranceCopay;
  const beatsInsurance = copay?.couponBeatsInsurance;

  return (
    <Animated.View entering={FadeInDown.delay(index * 60)}>
      <Card style={styles.drugCard}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7} accessibilityRole="button">
          <View style={styles.drugHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.drugName}>{saving.drugName}</ThemedText>
              {saving.drugClass ? (
                <ThemedText style={[styles.drugClassLabel, { color: theme.textSecondary }]}>
                  {saving.drugClass}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.drugPriceCol}>
              <ThemedText style={[styles.drugPrice, { color: theme.success }]}>
                ${saving.lowestPrice.toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.drugPharmacy, { color: theme.textSecondary }]}>
                {saving.lowestPharmacy}
              </ThemedText>
            </View>
          </View>

          {beatsInsurance ? (
            <View style={[styles.copayBadge, { backgroundColor: "#e8f5e9" }]}>
              <Feather name="trending-down" size={12} color="#2e7d32" />
              <ThemedText style={[styles.copayBadgeText, { color: "#2e7d32" }]}>
                ${Math.abs(copay!.estimatedSavingsVsCopay).toFixed(0)} cheaper than typical ${copay!.typicalCopayGeneric <= saving.lowestPrice ? "brand" : "generic"} copay
              </ThemedText>
            </View>
          ) : null}

          {saving.isGenericAvailable ? (
            <View style={[styles.genericBadge, { borderColor: theme.border }]}>
              <ThemedText style={[styles.genericBadgeText, { color: theme.textSecondary }]}>
                Generic available
              </ThemedText>
            </View>
          ) : null}
        </TouchableOpacity>

        {expanded ? (
          <Animated.View entering={FadeInDown.duration(200)}>
            {(saving.prices?.length ?? 0) > 0 ? (
              <View style={[styles.pharmacyList, { borderTopColor: theme.border }]}>
                <ThemedText style={[styles.pharmacyListTitle, { color: theme.textSecondary }]}>
                  Price comparison by pharmacy
                </ThemedText>
                {saving.prices!.map((p, pi) => (
                  <View key={pi} style={styles.pharmacyRow}>
                    <ThemedText style={styles.pharmacyName}>{p.pharmacy}</ThemedText>
                    <View style={styles.pharmacyPrices}>
                      {p.withCouponPrice ? (
                        <>
                          <ThemedText style={[styles.pharmacyCash, { color: theme.textSecondary, textDecorationLine: "line-through" }]}>
                            ${p.cashPrice.toFixed(2)}
                          </ThemedText>
                          <ThemedText style={[styles.pharmacyCoupon, { color: theme.success }]}>
                            ${p.withCouponPrice.toFixed(2)}
                          </ThemedText>
                        </>
                      ) : (
                        <ThemedText style={styles.pharmacyCash}>${p.cashPrice.toFixed(2)}</ThemedText>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {copay ? (
              <View style={[styles.copayCompare, { borderTopColor: theme.border }]}>
                <ThemedText style={[styles.copayCompareTitle, { color: theme.textSecondary }]}>
                  Insurance copay comparison
                </ThemedText>
                <View style={styles.copayGrid}>
                  <View style={styles.copayItem}>
                    <ThemedText style={[styles.copayLabel, { color: theme.textSecondary }]}>Generic</ThemedText>
                    <ThemedText style={styles.copayValue}>${copay.typicalCopayGeneric}</ThemedText>
                  </View>
                  <View style={styles.copayItem}>
                    <ThemedText style={[styles.copayLabel, { color: theme.textSecondary }]}>Brand</ThemedText>
                    <ThemedText style={styles.copayValue}>${copay.typicalCopayBrand}</ThemedText>
                  </View>
                  <View style={styles.copayItem}>
                    <ThemedText style={[styles.copayLabel, { color: theme.textSecondary }]}>Specialty</ThemedText>
                    <ThemedText style={styles.copayValue}>${copay.typicalCopaySpecialty}</ThemedText>
                  </View>
                </View>
              </View>
            ) : null}

            {saving.patientAssistanceProgram ? (
              <TouchableOpacity
                onPress={() => saving.patientAssistanceProgramUrl ? openUrl(saving.patientAssistanceProgramUrl) : null}
                style={[styles.papBtn, { backgroundColor: "#fff3e0" }]}
                accessibilityRole="button"
              >
                <Feather name="heart" size={14} color="#e65100" />
                <ThemedText style={[styles.papBtnText, { color: "#e65100" }]}>
                  Patient assistance: {saving.patientAssistanceProgram}
                </ThemedText>
              </TouchableOpacity>
            ) : null}

            {saving.goodRxCouponUrl ? (
              <TouchableOpacity
                onPress={() => openUrl(saving.goodRxCouponUrl!)}
                style={[styles.couponBtn, { backgroundColor: theme.backgroundSecondary }]}
                accessibilityLabel={`Get GoodRx coupon for ${saving.drugName}`}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.couponBtnText, { color: theme.primary }]}>
                  Get GoodRx coupon
                </ThemedText>
                <Feather name="external-link" size={12} color={theme.primary} />
              </TouchableOpacity>
            ) : null}

            {!saving.isLive ? (
              <ThemedText style={[styles.referenceNote, { color: theme.textSecondary }]}>
                Reference pricing. Connect GoodRx API for real-time prices.
              </ThemedText>
            ) : null}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CareAccessScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [activePanel, setActivePanel] = useState<Panel>("clinics");
  const [zipCode, setZipCode] = useState("");
  const [showEligibilityForm, setShowEligibilityForm] = useState(false);
  const [eligibilityInputs, setEligibilityInputs] = useState({
    householdSize: "1",
    annualIncome: "",
    state: "",
    hasChildren: false,
  });

  // Fetch summary (pre-populated from patient record)
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["care-access-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/care-access/summary");
      return res.json();
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // Fetch FQHCs
  const { data: fqhcData, isLoading: fqhcLoading, refetch: refetchFQHC } = useQuery({
    queryKey: ["fqhc", zipCode],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/care-access/fqhc", {
        zipCode: zipCode || summary?.zipCode,
        radiusMiles: 25,
      });
      return res.json();
    },
    enabled: activePanel === "clinics" && !!(zipCode || summary?.zipCode),
  });

  // Eligibility mutation
  const eligibilityMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/care-access/eligibility", {
        zipCode: zipCode || summary?.zipCode,
        state: eligibilityInputs.state,
        householdSize: parseInt(eligibilityInputs.householdSize),
        annualIncome: parseFloat(eligibilityInputs.annualIncome),
        hasChildren: eligibilityInputs.hasChildren,
      });
      return res.json() as Promise<EligibilityResult>;
    },
  });

  const [drugSearchQuery, setDrugSearchQuery] = useState("");
  const [drugSearchResults, setDrugSearchResults] = useState<DrugSearchResult[]>([]);
  const [selectedDrugResult, setSelectedDrugResult] = useState<DrugSaving | null>(null);
  const [expandedDrug, setExpandedDrug] = useState<string | null>(null);
  const [drugSearchLoading, setDrugSearchLoading] = useState(false);

  const { data: drugData, isLoading: drugLoading } = useQuery({
    queryKey: ["drug-savings"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/care-access/drug-savings", {
        medications: [],
        zipCode: zipCode || summary?.zipCode,
      });
      return res.json();
    },
    enabled: activePanel === "drugs",
  });

  const searchDrugs = useCallback(async (q: string) => {
    setDrugSearchQuery(q);
    if (q.length < 2) { setDrugSearchResults([]); return; }
    try {
      const res = await apiRequest("GET", `/api/care-access/drug-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setDrugSearchResults(data.results ?? []);
    } catch { setDrugSearchResults([]); }
  }, []);

  const lookupDrugPrice = useCallback(async (drugName: string) => {
    setDrugSearchLoading(true);
    setDrugSearchResults([]);
    setDrugSearchQuery(drugName);
    try {
      const zip = zipCode || summary?.zipCode || "10001";
      const res = await apiRequest("GET", `/api/care-access/drug-price?name=${encodeURIComponent(drugName)}&zipCode=${encodeURIComponent(zip)}`);
      const data = await res.json();
      setSelectedDrugResult(data);
      setExpandedDrug(data.drugName);
    } catch { setSelectedDrugResult(null); }
    setDrugSearchLoading(false);
  }, [zipCode, summary?.zipCode]);

  const [planInputs, setPlanInputs] = useState({
    age: "35",
    income: "",
    householdSize: "1",
    state: "",
  });
  const [showPlanForm, setShowPlanForm] = useState(false);

  const plansMutation = useMutation({
    mutationFn: async () => {
      const size = Math.max(1, parseInt(planInputs.householdSize) || 1);
      const members = [{ age: parseInt(planInputs.age) || 35, relationship: "Self" as const }];
      for (let i = 1; i < size; i++) {
        members.push({ age: 35, relationship: "Dependent" as any });
      }
      const res = await apiRequest("POST", "/api/care-access/marketplace/plans", {
        zipCode: zipCode || summary?.zipCode,
        state: planInputs.state || eligibilityInputs.state || "CA",
        householdIncome: parseFloat(planInputs.income) || 30000,
        householdMembers: members,
      });
      return res.json() as Promise<{
        plans: MarketplacePlan[];
        totalPlans: number;
        subsidy: SubsidyEstimate;
        year: number;
        disclaimer: string;
        enrollUrl: string;
      }>;
    },
  });

  const [sdohSearchQuery, setSdohSearchQuery] = useState("");
  const [selectedSdohCategories, setSelectedSdohCategories] = useState<string[]>([]);
  const [expandedResource, setExpandedResource] = useState<string | null>(null);

  const sdohMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/care-access/sdoh/search", {
        zipCode: zipCode || summary?.zipCode || "10001",
        categories: selectedSdohCategories.length > 0 ? selectedSdohCategories : undefined,
        query: sdohSearchQuery || undefined,
      });
      return res.json() as Promise<{
        resources: Array<{
          id: string;
          name: string;
          category: string;
          categoryLabel: string;
          description: string;
          address?: string;
          city?: string;
          state?: string;
          zip?: string;
          phone?: string;
          website?: string;
          email?: string;
          hours?: string;
          eligibility?: string;
          languages?: string[];
          isFree: boolean;
          acceptsUninsured: boolean;
          applicationUrl?: string;
          lastVerified?: string;
        }>;
        totalCount: number;
        categories: Array<{ category: string; label: string; count: number }>;
        isLive: boolean;
        disclaimer: string;
      }>;
    },
  });

  const [selectedDpcType, setSelectedDpcType] = useState<string>("");
  const [dpcTelehealthOnly, setDpcTelehealthOnly] = useState(false);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);

  const dpcMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/care-access/dpc/search", {
        zipCode: zipCode || summary?.zipCode || "10001",
        visitType: selectedDpcType || undefined,
        telehealth: dpcTelehealthOnly || undefined,
      });
      return res.json() as Promise<{
        visits: Array<{
          id: string;
          visitType: string;
          visitLabel: string;
          description: string;
          price: number;
          originalPrice?: number;
          duration: string;
          provider: {
            id: string;
            name: string;
            credentials: string;
            specialty: string;
            rating: number;
            reviewCount: number;
            city?: string;
            state?: string;
            languages: string[];
            acceptsNewPatients: boolean;
            nextAvailable?: string;
            bio?: string;
          };
          telehealth: boolean;
          inPerson: boolean;
          bookingUrl?: string;
          includes: string[];
          savingsVsER?: number;
          savingsVsUrgentCare?: number;
        }>;
        totalCount: number;
        visitTypes: Array<{ type: string; label: string; count: number; minPrice: number }>;
        isLive: boolean;
        savingsSummary: {
          avgSavingsVsER: number;
          avgSavingsVsUrgentCare: number;
          cheapestVisit: number;
        };
        disclaimer: string;
      }>;
    },
  });

  const [claimsFilter, setClaimsFilter] = useState<string>("");
  const [claimsStatusFilter, setClaimsStatusFilter] = useState<string>("");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const claimsMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (claimsFilter) body.claimType = claimsFilter;
      if (claimsStatusFilter) body.status = claimsStatusFilter;
      const res = await apiRequest("POST", "/api/care-access/payer/claims", body);
      return res.json() as Promise<ClaimsHistoryData>;
    },
  });

  const panels: Array<{ id: Panel; label: string; icon: keyof typeof Feather.glyphMap }> = [
    { id: "clinics", label: "Free clinics", icon: "map-pin" },
    { id: "dpc", label: "Book a visit", icon: "calendar" },
    { id: "claims", label: "Claims history", icon: "folder" },
    { id: "eligibility", label: "Benefits check", icon: "shield" },
    { id: "plans", label: "2026 Plans", icon: "file-text" },
    { id: "drugs", label: "Drug savings", icon: "package" },
    { id: "behavioral", label: "Mental health", icon: "heart" },
    { id: "resources", label: "Resources", icon: "life-buoy" },
  ];

  return (
    <ThemedView style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <ThemedText style={styles.headerTitle}>Care access</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Free and low-cost care near you
          </ThemedText>
        </View>

        {/* Summary strip */}
        {summary && !summaryLoading && (
          <Animated.View entering={FadeInDown} style={styles.summaryStrip}>
            {summary.relevantPrograms?.length > 0 && (
              <View style={[styles.summaryCard, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                  Programs available for you
                </ThemedText>
                <ThemedText style={styles.summaryValue}>
                  {summary.relevantPrograms.slice(0, 3).join(" · ")}
                </ThemedText>
                {summary.estimatedMonthlySavings > 0 && (
                  <ThemedText style={[styles.savingsLine, { color: theme.success }]}>
                    Estimated monthly savings: ${summary.estimatedMonthlySavings}
                  </ThemedText>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {/* Panel tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsRow}
          contentContainerStyle={styles.tabsContent}
        >
          {panels.map(panel => (
            <TouchableOpacity
              key={panel.id}
              style={[
                styles.tab,
                { borderColor: theme.border },
                activePanel === panel.id && {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.primaryVibrant ?? theme.primary,
                },
              ]}
              onPress={() => setActivePanel(panel.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activePanel === panel.id }}
            >
              <Feather
                name={panel.icon}
                size={14}
                color={activePanel === panel.id ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.tabText,
                  { color: activePanel === panel.id ? theme.primary : theme.textSecondary },
                  activePanel === panel.id && { fontWeight: "500" },
                ]}
              >
                {panel.label}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.panelBody}>

          {/* Free clinics panel */}
          {activePanel === "clinics" && (
            <View>
              <SectionHeader
                title="Free and sliding-scale clinics"
                subtitle="Federally funded health centers that treat everyone regardless of ability to pay."
              />
              {fqhcLoading ? (
                <LoadingState message="Finding clinics near you..." />
              ) : fqhcData?.locations?.length > 0 ? (
                fqhcData.locations.map((clinic: FQHCLocation, i: number) => (
                  <ClinicCard key={clinic.id} clinic={clinic} index={i} />
                ))
              ) : (
                <Card style={styles.emptyCard}>
                  <Feather name="map-pin" size={24} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No clinics found. Try a different zip code.
                  </ThemedText>
                  <TouchableOpacity
                    onPress={() => openUrl("https://findahealthcenter.hrsa.gov")}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                    accessibilityRole="button"
                  >
                    <ThemedText style={styles.primaryBtnText}>
                      Search on HRSA.gov
                    </ThemedText>
                  </TouchableOpacity>
                </Card>
              )}

              <TouchableOpacity
                onPress={() => openUrl("https://findahealthcenter.hrsa.gov")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Search all HRSA health centers
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {activePanel === "dpc" && (
            <View>
              <SectionHeader
                title="Book a doctor visit"
                subtitle="Transparent, upfront pricing. No insurance needed. Pay at the time of your visit."
              />

              <Card style={styles.dpcSearchCard} testID="dpc-search-card">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {[
                    { key: "", label: "All visits", icon: "grid" as const },
                    { key: "telehealth", label: "Telehealth", icon: "video" as const },
                    { key: "primary_care", label: "Primary care", icon: "activity" as const },
                    { key: "urgent_care", label: "Urgent care", icon: "clock" as const },
                    { key: "mental_health", label: "Mental health", icon: "heart" as const },
                    { key: "dental_cleaning", label: "Dental", icon: "smile" as const },
                    { key: "vision_exam", label: "Vision", icon: "eye" as const },
                    { key: "lab_panel", label: "Lab work", icon: "thermometer" as const },
                    { key: "dermatology", label: "Dermatology", icon: "sun" as const },
                    { key: "physical_exam", label: "Physical", icon: "clipboard" as const },
                  ].map(cat => {
                    const isSelected = selectedDpcType === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.sdohCatChip,
                          { borderColor: theme.border },
                          isSelected && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
                        ]}
                        onPress={() => setSelectedDpcType(cat.key)}
                        accessibilityRole="button"
                        testID={`dpc-type-${cat.key || "all"}`}
                      >
                        <Feather name={cat.icon} size={12} color={isSelected ? theme.primary : theme.textSecondary} />
                        <ThemedText style={[styles.sdohCatText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                          {cat.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.dpcToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.dpcToggle,
                      { borderColor: theme.border },
                      dpcTelehealthOnly && { backgroundColor: theme.primary + "15", borderColor: theme.primary },
                    ]}
                    onPress={() => setDpcTelehealthOnly(!dpcTelehealthOnly)}
                    accessibilityRole="button"
                    testID="dpc-telehealth-toggle"
                  >
                    <Feather name="video" size={14} color={dpcTelehealthOnly ? theme.primary : theme.textSecondary} />
                    <ThemedText style={[styles.dpcToggleText, { color: dpcTelehealthOnly ? theme.primary : theme.textSecondary }]}>
                      Telehealth only
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => dpcMutation.mutate()}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary, marginTop: 8 },
                    dpcMutation.isPending && { opacity: 0.6 },
                  ]}
                  disabled={dpcMutation.isPending}
                  accessibilityRole="button"
                  testID="button-dpc-search"
                >
                  <Feather name="search" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.primaryBtnText}>
                    {dpcMutation.isPending ? "Searching..." : "Find visits and prices"}
                  </ThemedText>
                </TouchableOpacity>
              </Card>

              {dpcMutation.data ? (
                <View>
                  {dpcMutation.data.savingsSummary.cheapestVisit > 0 ? (
                    <View style={[styles.dpcSavingsBanner, { backgroundColor: theme.backgroundSecondary }]}>
                      <View style={styles.dpcSavingsCol}>
                        <ThemedText style={[styles.dpcSavingsLabel, { color: theme.textSecondary }]}>
                          Starting from
                        </ThemedText>
                        <ThemedText style={[styles.dpcSavingsAmount, { color: theme.success }]}>
                          ${dpcMutation.data.savingsSummary.cheapestVisit}
                        </ThemedText>
                      </View>
                      {dpcMutation.data.savingsSummary.avgSavingsVsER > 0 ? (
                        <View style={styles.dpcSavingsCol}>
                          <ThemedText style={[styles.dpcSavingsLabel, { color: theme.textSecondary }]}>
                            Save vs ER
                          </ThemedText>
                          <ThemedText style={[styles.dpcSavingsAmount, { color: theme.success }]}>
                            ${dpcMutation.data.savingsSummary.avgSavingsVsER}+
                          </ThemedText>
                        </View>
                      ) : null}
                      <View style={styles.dpcSavingsCol}>
                        <ThemedText style={[styles.dpcSavingsLabel, { color: theme.textSecondary }]}>
                          Visits
                        </ThemedText>
                        <ThemedText style={styles.dpcSavingsAmount}>
                          {dpcMutation.data.totalCount}
                        </ThemedText>
                      </View>
                    </View>
                  ) : null}

                  {dpcMutation.data.visits.map((visit, idx) => {
                    const isExpanded = expandedVisit === visit.id;
                    const pctOff = visit.originalPrice
                      ? Math.round(((visit.originalPrice - visit.price) / visit.originalPrice) * 100)
                      : 0;
                    return (
                      <Animated.View key={visit.id} entering={FadeInDown.delay(idx * 40)}>
                        <Card style={styles.dpcVisitCard} testID={`dpc-visit-${idx}`}>
                          <TouchableOpacity
                            onPress={() => setExpandedVisit(isExpanded ? null : visit.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.dpcVisitHeader}>
                              <View style={{ flex: 1 }}>
                                <ThemedText style={styles.dpcVisitLabel}>{visit.visitLabel}</ThemedText>
                                <View style={styles.dpcBadgeRow}>
                                  {visit.telehealth ? (
                                    <View style={[styles.dpcBadge, { backgroundColor: "#5856D620" }]}>
                                      <Feather name="video" size={10} color="#5856D6" />
                                      <ThemedText style={{ fontSize: 10, fontWeight: "500", color: "#5856D6" }}>
                                        Telehealth
                                      </ThemedText>
                                    </View>
                                  ) : null}
                                  {visit.inPerson ? (
                                    <View style={[styles.dpcBadge, { backgroundColor: "#007AFF20" }]}>
                                      <ThemedText style={{ fontSize: 10, fontWeight: "500", color: "#007AFF" }}>
                                        In-person
                                      </ThemedText>
                                    </View>
                                  ) : null}
                                  <View style={[styles.dpcBadge, { backgroundColor: theme.backgroundSecondary }]}>
                                    <Feather name="clock" size={10} color={theme.textSecondary} />
                                    <ThemedText style={[styles.dpcBadgeText, { color: theme.textSecondary }]}>
                                      {visit.duration}
                                    </ThemedText>
                                  </View>
                                </View>
                              </View>
                              <View style={styles.dpcPriceCol}>
                                <ThemedText style={[styles.dpcPrice, { color: theme.success }]}>
                                  ${visit.price}
                                </ThemedText>
                                {visit.originalPrice ? (
                                  <ThemedText style={styles.dpcOriginalPrice}>
                                    ${visit.originalPrice}
                                  </ThemedText>
                                ) : null}
                                {pctOff > 0 ? (
                                  <View style={[styles.dpcSaveBadge, { backgroundColor: "#34C75920" }]}>
                                    <ThemedText style={{ fontSize: 9, fontWeight: "600", color: "#34C759" }}>
                                      {pctOff}% off
                                    </ThemedText>
                                  </View>
                                ) : null}
                              </View>
                            </View>

                            <View style={styles.dpcProviderRow}>
                              <View style={[styles.dpcProviderAvatar, { backgroundColor: theme.primary + "20" }]}>
                                <ThemedText style={[styles.dpcProviderInitial, { color: theme.primary }]}>
                                  {visit.provider.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                                </ThemedText>
                              </View>
                              <View style={{ flex: 1 }}>
                                <ThemedText style={styles.dpcProviderName}>
                                  {visit.provider.name}, {visit.provider.credentials}
                                </ThemedText>
                                <ThemedText style={[styles.dpcProviderDetail, { color: theme.textSecondary }]}>
                                  {visit.provider.specialty}
                                  {visit.provider.nextAvailable ? ` \u00B7 Next: ${visit.provider.nextAvailable}` : ""}
                                </ThemedText>
                              </View>
                              <View style={styles.dpcRating}>
                                <Feather name="star" size={12} color="#FFD60A" />
                                <ThemedText style={styles.dpcRatingText}>
                                  {visit.provider.rating.toFixed(1)}
                                </ThemedText>
                              </View>
                            </View>
                          </TouchableOpacity>

                          {isExpanded ? (
                            <View style={[styles.dpcExpandedSection, { borderTopColor: theme.border }]}>
                              {visit.includes.length > 0 ? (
                                <View style={styles.dpcIncludesSection}>
                                  <ThemedText style={[styles.dpcIncludesTitle, { color: theme.textSecondary }]}>
                                    Included in this visit
                                  </ThemedText>
                                  {visit.includes.map((item, j) => (
                                    <View key={j} style={styles.dpcIncludeRow}>
                                      <Feather name="check" size={12} color={theme.success} />
                                      <ThemedText style={styles.dpcIncludeText}>{item}</ThemedText>
                                    </View>
                                  ))}
                                </View>
                              ) : null}

                              {visit.provider.bio ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>
                                    About
                                  </ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {visit.provider.bio}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {visit.provider.languages.length > 0 ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>
                                    Languages
                                  </ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {visit.provider.languages.join(", ")}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {visit.savingsVsER ? (
                                <View style={[styles.dpcCompareRow, { backgroundColor: "#34C75910" }]}>
                                  <ThemedText style={[styles.dpcCompareText, { color: theme.success }]}>
                                    Save ${visit.savingsVsER} compared to an ER visit
                                  </ThemedText>
                                </View>
                              ) : null}

                              {visit.bookingUrl ? (
                                <TouchableOpacity
                                  onPress={() => openUrl(visit.bookingUrl!)}
                                  style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 10 }]}
                                  accessibilityRole="button"
                                  testID={`dpc-book-${idx}`}
                                >
                                  <Feather name="calendar" size={16} color="#fff" style={{ marginRight: 6 }} />
                                  <ThemedText style={styles.primaryBtnText}>
                                    Book this visit - ${visit.price}
                                  </ThemedText>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          ) : null}
                        </Card>
                      </Animated.View>
                    );
                  })}

                  <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                    {dpcMutation.data.disclaimer}
                  </ThemedText>
                </View>
              ) : null}

              {!dpcMutation.data && !dpcMutation.isPending ? (
                <Card style={styles.emptyCard}>
                  <Feather name="calendar" size={28} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    See a doctor without insurance. Search for transparent, upfront-priced visits — primary care from $49, telehealth from $29.
                  </ThemedText>
                </Card>
              ) : null}

              <TouchableOpacity
                onPress={() => openUrl("https://sesamecare.com")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Browse all providers on Sesame Care
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Claims History panel */}
          {activePanel === "claims" && (
            <View>
              <SectionHeader
                title="Insurance claims history"
                subtitle="Access your past claims, EOBs, and coverage data from your insurer's FHIR Patient Access API. Take your medical history with you."
              />

              <Card style={styles.dpcSearchCard} testID="claims-filter-card">
                <ThemedText style={[styles.claimsInfoText, { color: theme.textSecondary }]}>
                  Under CMS-9115-F, insurers must give you digital access to your claims and provider directories. Use this to download your medical history before transitioning off insurance.
                </ThemedText>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: 10 }}
                >
                  {[
                    { key: "", label: "All claims", icon: "grid" as const },
                    { key: "medical", label: "Medical", icon: "activity" as const },
                    { key: "pharmacy", label: "Pharmacy", icon: "package" as const },
                    { key: "dental", label: "Dental", icon: "smile" as const },
                    { key: "vision", label: "Vision", icon: "eye" as const },
                    { key: "behavioral", label: "Behavioral", icon: "heart" as const },
                    { key: "lab", label: "Lab", icon: "thermometer" as const },
                    { key: "imaging", label: "Imaging", icon: "monitor" as const },
                  ].map(cat => {
                    const isSelected = claimsFilter === cat.key;
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.sdohCatChip,
                          { borderColor: theme.border },
                          isSelected && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
                        ]}
                        onPress={() => setClaimsFilter(cat.key)}
                        accessibilityRole="button"
                        testID={`claims-type-${cat.key || "all"}`}
                      >
                        <Feather name={cat.icon} size={12} color={isSelected ? theme.primary : theme.textSecondary} />
                        <ThemedText style={[styles.sdohCatText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                          {cat.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, marginTop: 8 }}
                >
                  {[
                    { key: "", label: "Any status" },
                    { key: "paid", label: "Paid" },
                    { key: "denied", label: "Denied" },
                    { key: "pending", label: "Pending" },
                    { key: "adjusted", label: "Adjusted" },
                  ].map(s => {
                    const isSelected = claimsStatusFilter === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[
                          styles.sdohCatChip,
                          { borderColor: theme.border },
                          isSelected && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
                        ]}
                        onPress={() => setClaimsStatusFilter(s.key)}
                        accessibilityRole="button"
                        testID={`claims-status-${s.key || "any"}`}
                      >
                        <ThemedText style={[styles.sdohCatText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                          {s.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => claimsMutation.mutate()}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary, marginTop: 12 },
                    claimsMutation.isPending && { opacity: 0.6 },
                  ]}
                  disabled={claimsMutation.isPending}
                  accessibilityRole="button"
                  testID="button-claims-fetch"
                >
                  <Feather name="download" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.primaryBtnText}>
                    {claimsMutation.isPending ? "Loading claims..." : "Retrieve claims history"}
                  </ThemedText>
                </TouchableOpacity>
              </Card>

              {claimsMutation.data ? (
                <View>
                  {/* Summary banner */}
                  <View style={[styles.claimsSummaryBanner, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={styles.claimsSummaryRow}>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          Total billed
                        </ThemedText>
                        <ThemedText style={styles.claimsSummaryValue}>
                          ${claimsMutation.data.summary.totalBilled.toLocaleString()}
                        </ThemedText>
                      </View>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          Insurance paid
                        </ThemedText>
                        <ThemedText style={[styles.claimsSummaryValue, { color: theme.success }]}>
                          ${claimsMutation.data.summary.totalPaid.toLocaleString()}
                        </ThemedText>
                      </View>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          You paid
                        </ThemedText>
                        <ThemedText style={styles.claimsSummaryValue}>
                          ${claimsMutation.data.summary.totalPatientCost.toLocaleString()}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={[styles.claimsSummaryRow, { marginTop: 10 }]}>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          Claims
                        </ThemedText>
                        <ThemedText style={styles.claimsSummaryValue}>
                          {claimsMutation.data.totalCount}
                        </ThemedText>
                      </View>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          Providers
                        </ThemedText>
                        <ThemedText style={styles.claimsSummaryValue}>
                          {claimsMutation.data.summary.uniqueProviders}
                        </ThemedText>
                      </View>
                      <View style={styles.claimsSummaryItem}>
                        <ThemedText style={[styles.claimsSummaryLabel, { color: theme.textSecondary }]}>
                          Diagnoses
                        </ThemedText>
                        <ThemedText style={styles.claimsSummaryValue}>
                          {claimsMutation.data.summary.uniqueDiagnoses}
                        </ThemedText>
                      </View>
                    </View>
                    {claimsMutation.data.summary.dateRange.earliest ? (
                      <ThemedText style={[styles.claimsDateRange, { color: theme.textSecondary }]}>
                        {claimsMutation.data.summary.dateRange.earliest} to {claimsMutation.data.summary.dateRange.latest}
                      </ThemedText>
                    ) : null}
                  </View>

                  {/* Coverage card */}
                  {claimsMutation.data.coverage ? (
                    <Card style={styles.claimsCoverageCard}>
                      <View style={styles.claimsCoverageHeader}>
                        <Feather name="shield" size={16} color={theme.primary} />
                        <ThemedText style={styles.claimsCoveragePlan}>
                          {claimsMutation.data.coverage.planName}
                        </ThemedText>
                        <View style={[
                          styles.claimsCoverageStatusBadge,
                          { backgroundColor: claimsMutation.data.coverage.isActive ? "#34C75920" : "#FF3B3020" },
                        ]}>
                          <ThemedText style={{
                            fontSize: 10,
                            fontWeight: "600",
                            color: claimsMutation.data.coverage.isActive ? "#34C759" : "#FF3B30",
                          }}>
                            {claimsMutation.data.coverage.isActive ? "Active" : "Expired"}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.claimsCoverageDetails}>
                        <View style={styles.claimsCoverageRow}>
                          <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                            Member ID
                          </ThemedText>
                          <ThemedText style={styles.claimsCoverageValue}>
                            {claimsMutation.data.coverage.memberId}
                          </ThemedText>
                        </View>
                        {claimsMutation.data.coverage.groupNumber ? (
                          <View style={styles.claimsCoverageRow}>
                            <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                              Group
                            </ThemedText>
                            <ThemedText style={styles.claimsCoverageValue}>
                              {claimsMutation.data.coverage.groupNumber}
                            </ThemedText>
                          </View>
                        ) : null}
                        <View style={styles.claimsCoverageRow}>
                          <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                            Network
                          </ThemedText>
                          <ThemedText style={styles.claimsCoverageValue}>
                            {claimsMutation.data.coverage.network} {claimsMutation.data.coverage.planType}
                          </ThemedText>
                        </View>
                        <View style={styles.claimsCoverageRow}>
                          <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                            Deductible
                          </ThemedText>
                          <ThemedText style={styles.claimsCoverageValue}>
                            ${claimsMutation.data.coverage.benefits.deductibleMet.toLocaleString()} / ${claimsMutation.data.coverage.benefits.deductibleIndividual.toLocaleString()} met
                          </ThemedText>
                        </View>
                        <View style={styles.claimsCoverageRow}>
                          <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                            Out-of-pocket max
                          </ThemedText>
                          <ThemedText style={styles.claimsCoverageValue}>
                            ${claimsMutation.data.coverage.benefits.oopMet.toLocaleString()} / ${claimsMutation.data.coverage.benefits.oopMaxIndividual.toLocaleString()} met
                          </ThemedText>
                        </View>
                        <View style={styles.claimsCoverageRow}>
                          <ThemedText style={[styles.claimsCoverageLabel, { color: theme.textSecondary }]}>
                            Coverage period
                          </ThemedText>
                          <ThemedText style={styles.claimsCoverageValue}>
                            {claimsMutation.data.coverage.effectiveStart} to {claimsMutation.data.coverage.effectiveEnd ?? "present"}
                          </ThemedText>
                        </View>
                      </View>
                    </Card>
                  ) : null}

                  {/* Type breakdown chips */}
                  {Object.keys(claimsMutation.data.summary.claimsByType).length > 1 ? (
                    <View style={styles.claimsTypeBreakdown}>
                      {Object.entries(claimsMutation.data.summary.claimsByType).map(([type, count]) => (
                        <View key={type} style={[styles.claimsTypeChip, { backgroundColor: theme.backgroundSecondary }]}>
                          <ThemedText style={[styles.claimsTypeChipText, { color: theme.textSecondary }]}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}: {count}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/* Claims list */}
                  {claimsMutation.data.claims.map((claim, idx) => {
                    const isExpanded = expandedClaim === claim.id;
                    const statusColors: Record<string, string> = {
                      paid: "#34C759",
                      denied: "#FF3B30",
                      pending: "#FF9F0A",
                      appealed: "#5856D6",
                      adjusted: "#007AFF",
                    };
                    const statusColor = statusColors[claim.status] ?? theme.textSecondary;
                    const claimTypeIcons: Record<string, keyof typeof Feather.glyphMap> = {
                      medical: "activity",
                      pharmacy: "package",
                      dental: "smile",
                      vision: "eye",
                      behavioral: "heart",
                      lab: "thermometer",
                      imaging: "monitor",
                    };
                    const claimIcon = claimTypeIcons[claim.claimType] ?? "file-text";

                    return (
                      <Animated.View key={claim.id} entering={FadeInDown.delay(idx * 40)}>
                        <Card style={styles.claimCard} testID={`claim-${idx}`}>
                          <TouchableOpacity
                            onPress={() => setExpandedClaim(isExpanded ? null : claim.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.claimHeader}>
                              <View style={[styles.claimTypeIcon, { backgroundColor: theme.primary + "15" }]}>
                                <Feather name={claimIcon} size={16} color={theme.primary} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <ThemedText style={styles.claimProviderName}>{claim.provider.name}</ThemedText>
                                <View style={styles.claimMetaRow}>
                                  <ThemedText style={[styles.claimDate, { color: theme.textSecondary }]}>
                                    {claim.dateOfService}
                                  </ThemedText>
                                  <View style={[styles.claimStatusBadge, { backgroundColor: statusColor + "18" }]}>
                                    <ThemedText style={{ fontSize: 10, fontWeight: "600", color: statusColor }}>
                                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                                    </ThemedText>
                                  </View>
                                  <View style={[styles.claimTypeBadge, { backgroundColor: theme.backgroundSecondary }]}>
                                    <ThemedText style={[styles.claimTypeBadgeText, { color: theme.textSecondary }]}>
                                      {claim.claimType.charAt(0).toUpperCase() + claim.claimType.slice(1)}
                                    </ThemedText>
                                  </View>
                                </View>
                              </View>
                              <View style={styles.claimAmountCol}>
                                <ThemedText style={[styles.claimPatientAmount, { color: claim.amounts.patientResponsibility > 0 ? theme.text : theme.success }]}>
                                  ${claim.amounts.patientResponsibility.toFixed(0)}
                                </ThemedText>
                                <ThemedText style={[styles.claimBilledAmount, { color: theme.textSecondary }]}>
                                  of ${claim.amounts.billed.toFixed(0)}
                                </ThemedText>
                              </View>
                            </View>

                            {/* Diagnosis preview */}
                            {claim.diagnosis.length > 0 ? (
                              <View style={styles.claimDiagRow}>
                                {claim.diagnosis.slice(0, 2).map((d, di) => (
                                  <View key={di} style={[styles.claimDiagChip, { backgroundColor: theme.backgroundSecondary }]}>
                                    <ThemedText style={[styles.claimDiagCode, { color: theme.primary }]}>
                                      {d.code}
                                    </ThemedText>
                                    <ThemedText style={[styles.claimDiagText, { color: theme.textSecondary }]} numberOfLines={1}>
                                      {d.display}
                                    </ThemedText>
                                  </View>
                                ))}
                              </View>
                            ) : null}
                          </TouchableOpacity>

                          {isExpanded ? (
                            <View style={[styles.claimExpandedSection, { borderTopColor: theme.border }]}>
                              {/* Financial breakdown */}
                              <View style={styles.claimFinancials}>
                                <ThemedText style={[styles.claimFinancialsTitle, { color: theme.textSecondary }]}>
                                  Financial breakdown
                                </ThemedText>
                                <View style={styles.claimFinRow}>
                                  <ThemedText style={styles.claimFinLabel}>Provider billed</ThemedText>
                                  <ThemedText style={styles.claimFinValue}>${claim.amounts.billed.toFixed(2)}</ThemedText>
                                </View>
                                <View style={styles.claimFinRow}>
                                  <ThemedText style={styles.claimFinLabel}>Plan allowed</ThemedText>
                                  <ThemedText style={styles.claimFinValue}>${claim.amounts.allowed.toFixed(2)}</ThemedText>
                                </View>
                                <View style={styles.claimFinRow}>
                                  <ThemedText style={[styles.claimFinLabel, { color: theme.success }]}>Insurance paid</ThemedText>
                                  <ThemedText style={[styles.claimFinValue, { color: theme.success }]}>${claim.amounts.paid.toFixed(2)}</ThemedText>
                                </View>
                                {claim.amounts.copay != null && claim.amounts.copay > 0 ? (
                                  <View style={styles.claimFinRow}>
                                    <ThemedText style={styles.claimFinLabel}>Copay</ThemedText>
                                    <ThemedText style={styles.claimFinValue}>${claim.amounts.copay.toFixed(2)}</ThemedText>
                                  </View>
                                ) : null}
                                {claim.amounts.coinsurance != null && claim.amounts.coinsurance > 0 ? (
                                  <View style={styles.claimFinRow}>
                                    <ThemedText style={styles.claimFinLabel}>Coinsurance</ThemedText>
                                    <ThemedText style={styles.claimFinValue}>${claim.amounts.coinsurance.toFixed(2)}</ThemedText>
                                  </View>
                                ) : null}
                                {claim.amounts.deductible != null && claim.amounts.deductible > 0 ? (
                                  <View style={styles.claimFinRow}>
                                    <ThemedText style={styles.claimFinLabel}>Deductible</ThemedText>
                                    <ThemedText style={styles.claimFinValue}>${claim.amounts.deductible.toFixed(2)}</ThemedText>
                                  </View>
                                ) : null}
                                <View style={[styles.claimFinRow, { borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 6, marginTop: 4 }]}>
                                  <ThemedText style={[styles.claimFinLabel, { fontWeight: "600" }]}>Your total</ThemedText>
                                  <ThemedText style={[styles.claimFinValue, { fontWeight: "600" }]}>${claim.amounts.patientResponsibility.toFixed(2)}</ThemedText>
                                </View>
                              </View>

                              {/* Procedures */}
                              {claim.procedures.length > 0 ? (
                                <View style={styles.claimProcedures}>
                                  <ThemedText style={[styles.claimFinancialsTitle, { color: theme.textSecondary }]}>
                                    Procedures / Services
                                  </ThemedText>
                                  {claim.procedures.map((p, pi) => (
                                    <View key={pi} style={styles.claimProcRow}>
                                      <ThemedText style={[styles.claimProcCode, { color: theme.primary }]}>{p.code}</ThemedText>
                                      <ThemedText style={styles.claimProcDesc}>{p.display}</ThemedText>
                                    </View>
                                  ))}
                                </View>
                              ) : null}

                              {/* Full diagnoses */}
                              {claim.diagnosis.length > 0 ? (
                                <View style={styles.claimProcedures}>
                                  <ThemedText style={[styles.claimFinancialsTitle, { color: theme.textSecondary }]}>
                                    Diagnoses
                                  </ThemedText>
                                  {claim.diagnosis.map((d, di) => (
                                    <View key={di} style={styles.claimProcRow}>
                                      <ThemedText style={[styles.claimProcCode, { color: theme.primary }]}>{d.code}</ThemedText>
                                      <ThemedText style={styles.claimProcDesc}>{d.display}</ThemedText>
                                    </View>
                                  ))}
                                </View>
                              ) : null}

                              {/* Provider details */}
                              {claim.provider.specialty ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>Specialty</ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>{claim.provider.specialty}</ThemedText>
                                </View>
                              ) : null}
                              {claim.provider.npi ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>NPI</ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>{claim.provider.npi}</ThemedText>
                                </View>
                              ) : null}
                              {claim.facility ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>Facility</ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>{claim.facility.name} ({claim.facility.type})</ThemedText>
                                </View>
                              ) : null}
                              {claim.coverageInfo ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>Coverage</ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {claim.coverageInfo.planName} - {claim.coverageInfo.network}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {/* Notes / denial reason */}
                              {claim.notes ? (
                                <View style={[styles.claimNotesBox, { backgroundColor: claim.status === "denied" ? "#FF3B3010" : theme.backgroundSecondary }]}>
                                  <Feather
                                    name={claim.status === "denied" ? "alert-circle" : "info"}
                                    size={14}
                                    color={claim.status === "denied" ? "#FF3B30" : theme.textSecondary}
                                  />
                                  <ThemedText style={[styles.claimNotesText, { color: claim.status === "denied" ? "#FF3B30" : theme.textSecondary }]}>
                                    {claim.notes}
                                  </ThemedText>
                                </View>
                              ) : null}

                              <ThemedText style={[styles.claimNumber, { color: theme.textSecondary }]}>
                                Claim #{claim.claimNumber}
                                {claim.datePaid ? ` \u00B7 Paid ${claim.datePaid}` : ""}
                              </ThemedText>
                            </View>
                          ) : null}
                        </Card>
                      </Animated.View>
                    );
                  })}

                  <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                    {claimsMutation.data.disclaimer}
                  </ThemedText>
                </View>
              ) : null}

              {!claimsMutation.data && !claimsMutation.isPending ? (
                <Card style={styles.emptyCard}>
                  <Feather name="folder" size={28} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Your insurer is required to give you access to your claims data digitally. Tap "Retrieve claims history" to see your past medical claims, EOBs, and coverage details — all in one place.
                  </ThemedText>
                </Card>
              ) : null}

              <TouchableOpacity
                onPress={() => openUrl("https://www.cms.gov/priorities/interoperability/patient-access-api")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Learn about your rights under CMS-9115-F
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Eligibility panel */}
          {activePanel === "eligibility" && (
            <View>
              <SectionHeader
                title="Benefits eligibility check"
                subtitle="See if you qualify for Medicaid, CHIP, or ACA subsidies. No personal information is stored."
              />

              {!eligibilityMutation.data && !showEligibilityForm && (
                <Card style={styles.eligibilityPrompt}>
                  <ThemedText style={[styles.eligBody, { color: theme.textSecondary }]}>
                    Answer 3 quick questions to see what programs you may qualify for.
                    This is an estimate only — apply through your state to confirm.
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setShowEligibilityForm(true)}
                    accessibilityRole="button"
                  >
                    <ThemedText style={styles.primaryBtnText}>Check eligibility</ThemedText>
                  </TouchableOpacity>
                </Card>
              )}

              {showEligibilityForm && !eligibilityMutation.data && (
                <Card>
                  <ThemedText style={styles.formLabel}>Household size</ThemedText>
                  <View style={styles.stepperRow}>
                    {["1", "2", "3", "4", "5+"].map(n => (
                      <TouchableOpacity
                        key={n}
                        style={[
                          styles.stepperBtn,
                          { borderColor: theme.border },
                          eligibilityInputs.householdSize === n && {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => setEligibilityInputs(p => ({ ...p, householdSize: n === "5+" ? "5" : n }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: eligibilityInputs.householdSize === n }}
                      >
                        <ThemedText
                          style={[
                            styles.stepperText,
                            eligibilityInputs.householdSize === n && { color: "#fff" },
                          ]}
                        >
                          {n}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ThemedText style={[styles.formLabel, { marginTop: 16 }]}>
                    Approximate annual income ($)
                  </ThemedText>
                  <View style={styles.incomeRow}>
                    {["0", "15000", "25000", "40000", "60000"].map(amt => (
                      <TouchableOpacity
                        key={amt}
                        style={[
                          styles.incomeChip,
                          { borderColor: theme.border },
                          eligibilityInputs.annualIncome === amt && {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => setEligibilityInputs(p => ({ ...p, annualIncome: amt }))}
                        accessibilityRole="button"
                      >
                        <ThemedText
                          style={[
                            styles.incomeChipText,
                            eligibilityInputs.annualIncome === amt && { color: "#fff" },
                          ]}
                        >
                          {amt === "0" ? "None" : `$${parseInt(amt).toLocaleString()}`}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ThemedText style={[styles.formLabel, { marginTop: 16 }]}>State</ThemedText>
                  <View style={styles.stateRow}>
                    {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
                      "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
                      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
                      "VA","WA","WV","WI","WY"].slice(0, 10).map(st => (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.stateChip,
                          { borderColor: theme.border },
                          eligibilityInputs.state === st && {
                            backgroundColor: theme.primary,
                            borderColor: theme.primary,
                          },
                        ]}
                        onPress={() => setEligibilityInputs(p => ({ ...p, state: st }))}
                        accessibilityRole="button"
                      >
                        <ThemedText
                          style={[
                            styles.stateChipText,
                            eligibilityInputs.state === st && { color: "#fff" },
                          ]}
                        >
                          {st}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[styles.stateChip, { borderColor: theme.border }]}
                      onPress={() => openUrl("https://www.healthcare.gov/medicaid-chip/")}
                      accessibilityRole="button"
                    >
                      <ThemedText style={styles.stateChipText}>All states ↗</ThemedText>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: theme.primary, marginTop: 20 },
                      !eligibilityInputs.annualIncome && { opacity: 0.5 },
                    ]}
                    onPress={() => eligibilityMutation.mutate()}
                    disabled={eligibilityMutation.isPending || !eligibilityInputs.annualIncome}
                    accessibilityRole="button"
                  >
                    <ThemedText style={styles.primaryBtnText}>
                      {eligibilityMutation.isPending ? "Checking..." : "Check eligibility"}
                    </ThemedText>
                  </TouchableOpacity>
                </Card>
              )}

              {eligibilityMutation.data && (
                <Animated.View entering={FadeInDown}>
                  <Card style={styles.eligResultCard}>
                    <EligibilityBadge status={eligibilityMutation.data.estimatedStatus} />
                    <ThemedText style={[styles.eligExplanation, { color: theme.textSecondary }]}>
                      {eligibilityMutation.data.explanation}
                    </ThemedText>
                    <ThemedText style={[styles.eligFPL, { color: theme.textSecondary }]}>
                      Your income is approximately {eligibilityMutation.data.fplPercentage}% of the Federal Poverty Level.
                    </ThemedText>
                  </Card>

                  {eligibilityMutation.data.programsToCheck.map((prog, i) => (
                    <Animated.View key={i} entering={FadeInDown.delay(i * 80)}>
                      <Card style={styles.programCard}>
                        <ThemedText style={styles.programName}>{prog.name}</ThemedText>
                        <ThemedText style={[styles.programDesc, { color: theme.textSecondary }]}>
                          {prog.description}
                        </ThemedText>
                        <ThemedText style={[styles.programLimit, { color: theme.textSecondary }]}>
                          Income limit: {prog.incomeLimit}
                        </ThemedText>
                        <TouchableOpacity
                          onPress={() => openUrl(prog.applyUrl)}
                          style={[styles.applyBtn, { borderColor: theme.primary }]}
                          accessibilityRole="button"
                        >
                          <ThemedText style={[styles.applyBtnText, { color: theme.primary }]}>
                            Apply or learn more
                          </ThemedText>
                          <Feather name="external-link" size={13} color={theme.primary} />
                        </TouchableOpacity>
                      </Card>
                    </Animated.View>
                  ))}

                  <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                    This is an estimate only. Actual eligibility is determined by your state Medicaid office. Call 1-800-318-2596 to speak with a free navigator.
                  </ThemedText>

                  <TouchableOpacity
                    onPress={() => { eligibilityMutation.reset(); setShowEligibilityForm(true); }}
                    style={styles.linkRow}
                    accessibilityRole="button"
                  >
                    <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                      Try different inputs
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>
          )}

          {/* 2026 Marketplace Plans panel */}
          {activePanel === "plans" && (
            <View>
              <SectionHeader
                title="2026 Marketplace plans"
                subtitle="Real-time ACA plan costs and subsidy estimates from Healthcare.gov"
              />

              {!plansMutation.data && !showPlanForm ? (
                <Card style={styles.eligibilityPrompt}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Feather name="shield" size={20} color={theme.primary} />
                    <ThemedText style={{ fontSize: 15, fontWeight: "600" }}>
                      Find affordable coverage
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.eligBody, { color: theme.textSecondary }]}>
                    See 2026 health insurance plans available in your area with estimated subsidies. Enter basic info to get personalized plan costs.
                  </ThemedText>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setShowPlanForm(true)}
                    accessibilityRole="button"
                    testID="button-show-plan-form"
                  >
                    <ThemedText style={styles.primaryBtnText}>See 2026 plans</ThemedText>
                  </TouchableOpacity>
                </Card>
              ) : null}

              {showPlanForm && !plansMutation.data ? (
                <Card>
                  <ThemedText style={{ fontSize: 15, fontWeight: "600", marginBottom: 12 }}>
                    Your information
                  </ThemedText>

                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>Age</ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={planInputs.age}
                    onChangeText={(v) => setPlanInputs(p => ({ ...p, age: v }))}
                    keyboardType="number-pad"
                    placeholder="35"
                    placeholderTextColor={theme.textSecondary}
                    testID="input-plan-age"
                  />

                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Household size
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={planInputs.householdSize}
                    onChangeText={(v) => setPlanInputs(p => ({ ...p, householdSize: v }))}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor={theme.textSecondary}
                    testID="input-plan-household"
                  />

                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Annual household income
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={planInputs.income}
                    onChangeText={(v) => setPlanInputs(p => ({ ...p, income: v }))}
                    keyboardType="number-pad"
                    placeholder="30000"
                    placeholderTextColor={theme.textSecondary}
                    testID="input-plan-income"
                  />

                  <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    State (2-letter code)
                  </ThemedText>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={planInputs.state}
                    onChangeText={(v) => setPlanInputs(p => ({ ...p, state: v.toUpperCase().slice(0, 2) }))}
                    placeholder="CA"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="characters"
                    maxLength={2}
                    testID="input-plan-state"
                  />

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      { backgroundColor: theme.primary, marginTop: 20 },
                      (!planInputs.income || !planInputs.state) && { opacity: 0.5 },
                    ]}
                    onPress={() => plansMutation.mutate()}
                    disabled={plansMutation.isPending || !planInputs.income || planInputs.state.length !== 2}
                    accessibilityRole="button"
                    testID="button-search-plans"
                  >
                    <ThemedText style={styles.primaryBtnText}>
                      {plansMutation.isPending ? "Finding plans..." : "Search 2026 plans"}
                    </ThemedText>
                  </TouchableOpacity>
                </Card>
              ) : null}

              {plansMutation.data ? (
                <Animated.View entering={FadeInDown}>
                  {plansMutation.data.subsidy.aptcAmount > 0 ? (
                    <Card style={[styles.eligResultCard, { borderLeftWidth: 3, borderLeftColor: theme.success }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Feather name="dollar-sign" size={18} color={theme.success} />
                        <ThemedText style={{ fontSize: 16, fontWeight: "700", color: theme.success }}>
                          ${Math.round(plansMutation.data.subsidy.aptcAmount)}/mo subsidy
                        </ThemedText>
                      </View>
                      <ThemedText style={[styles.eligExplanation, { color: theme.textSecondary, marginTop: 8 }]}>
                        {plansMutation.data.subsidy.explanation}
                      </ThemedText>
                      {plansMutation.data.subsidy.csrLevel !== "none" ? (
                        <View style={[styles.feeBadge, { marginTop: 8 }]}>
                          <ThemedText style={styles.feeBadgeText}>
                            Cost-Sharing Reduction ({plansMutation.data.subsidy.csrLevel}% AV)
                          </ThemedText>
                        </View>
                      ) : null}
                    </Card>
                  ) : plansMutation.data.subsidy.isEligibleForMedicaid ? (
                    <Card style={[styles.eligResultCard, { borderLeftWidth: 3, borderLeftColor: "#34C759" }]}>
                      <EligibilityBadge status="likely_eligible" />
                      <ThemedText style={[styles.eligExplanation, { color: theme.textSecondary, marginTop: 8 }]}>
                        {plansMutation.data.subsidy.explanation}
                      </ThemedText>
                    </Card>
                  ) : (
                    <Card style={styles.eligResultCard}>
                      <ThemedText style={[styles.eligExplanation, { color: theme.textSecondary }]}>
                        {plansMutation.data.subsidy.explanation}
                      </ThemedText>
                    </Card>
                  )}

                  <ThemedText style={{ fontSize: 15, fontWeight: "600", marginTop: 16, marginBottom: 8 }}>
                    {plansMutation.data.totalPlans} plans available
                  </ThemedText>

                  {plansMutation.data.plans.map((plan, i) => (
                    <Animated.View key={plan.id} entering={FadeInDown.delay(i * 80)}>
                      <Card style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <ThemedText style={{ fontSize: 14, fontWeight: "600" }}>{plan.name}</ThemedText>
                            <ThemedText style={[{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }]}>
                              {plan.issuerName} · {plan.type}
                            </ThemedText>
                          </View>
                          <View style={[
                            styles.feeBadge,
                            {
                              backgroundColor:
                                plan.metalLevel === "Gold" ? "#FFD70030" :
                                plan.metalLevel === "Silver" ? "#C0C0C030" :
                                plan.metalLevel === "Bronze" ? "#CD7F3230" :
                                plan.metalLevel === "Platinum" ? "#E5E4E220" : "#3B82F620",
                            },
                          ]}>
                            <ThemedText style={[styles.feeBadgeText, {
                              color:
                                plan.metalLevel === "Gold" ? "#B8860B" :
                                plan.metalLevel === "Silver" ? "#808080" :
                                plan.metalLevel === "Bronze" ? "#CD7F32" :
                                plan.metalLevel === "Platinum" ? "#666" : theme.primary,
                            }]}>
                              {plan.metalLevel}
                            </ThemedText>
                          </View>
                        </View>

                        <View style={{ flexDirection: "row", marginTop: 12, gap: 16 }}>
                          <View>
                            <ThemedText style={[{ fontSize: 11, color: theme.textSecondary }]}>Monthly</ThemedText>
                            {plan.premiumAfterSubsidy < plan.premiumBeforeSubsidy ? (
                              <>
                                <ThemedText style={{ fontSize: 18, fontWeight: "700", color: theme.success }}>
                                  ${plan.premiumAfterSubsidy}
                                </ThemedText>
                                <ThemedText style={{ fontSize: 11, color: theme.textSecondary, textDecorationLine: "line-through" }}>
                                  ${plan.premiumBeforeSubsidy}
                                </ThemedText>
                              </>
                            ) : (
                              <ThemedText style={{ fontSize: 18, fontWeight: "700" }}>
                                ${plan.premiumBeforeSubsidy}
                              </ThemedText>
                            )}
                          </View>
                          <View>
                            <ThemedText style={[{ fontSize: 11, color: theme.textSecondary }]}>Deductible</ThemedText>
                            <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
                              ${plan.deductible.toLocaleString()}
                            </ThemedText>
                          </View>
                          <View>
                            <ThemedText style={[{ fontSize: 11, color: theme.textSecondary }]}>Max OOP</ThemedText>
                            <ThemedText style={{ fontSize: 16, fontWeight: "600" }}>
                              ${plan.maxOutOfPocket.toLocaleString()}
                            </ThemedText>
                          </View>
                        </View>

                        {plan.benefits.length > 0 ? (
                          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
                            {plan.benefits.slice(0, 4).map((b, bi) => (
                              <View key={bi} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                                <ThemedText style={{ fontSize: 12, color: theme.textSecondary, flex: 1 }}>
                                  {b.name}
                                </ThemedText>
                                <ThemedText style={{ fontSize: 12, fontWeight: "500" }}>
                                  {b.copay || b.coinsurance || (b.covered ? "Covered" : "Not covered")}
                                </ThemedText>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        {plan.hsaEligible ? (
                          <View style={[styles.feeBadge, { marginTop: 8, alignSelf: "flex-start" }]}>
                            <ThemedText style={styles.feeBadgeText}>HSA eligible</ThemedText>
                          </View>
                        ) : null}
                      </Card>
                    </Animated.View>
                  ))}

                  <TouchableOpacity
                    onPress={() => openUrl(plansMutation.data!.enrollUrl)}
                    style={[styles.primaryBtn, { backgroundColor: theme.primary, marginTop: 8 }]}
                    accessibilityRole="button"
                    testID="button-enroll-healthcare-gov"
                  >
                    <Feather name="external-link" size={14} color="#fff" style={{ marginRight: 6 }} />
                    <ThemedText style={styles.primaryBtnText}>
                      Enroll on Healthcare.gov
                    </ThemedText>
                  </TouchableOpacity>

                  <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                    {plansMutation.data.disclaimer}
                  </ThemedText>

                  <TouchableOpacity
                    onPress={() => { plansMutation.reset(); setShowPlanForm(true); }}
                    style={styles.linkRow}
                    accessibilityRole="button"
                  >
                    <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                      Try different inputs
                    </ThemedText>
                  </TouchableOpacity>
                </Animated.View>
              ) : null}
            </View>
          )}

          {/* Drug savings panel */}
          {activePanel === "drugs" && (
            <View>
              <SectionHeader
                title="Drug price search"
                subtitle="Compare cash prices, coupons, and insurance copays. Powered by GoodRx."
              />

              <Card style={styles.drugSearchCard}>
                <View style={[styles.drugSearchInputRow, { borderColor: theme.border }]}>
                  <Feather name="search" size={16} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.drugSearchInput, { color: theme.text }]}
                    value={drugSearchQuery}
                    onChangeText={searchDrugs}
                    placeholder="Search any medication (e.g., Lipitor, metformin)"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    testID="input-drug-search"
                  />
                  {drugSearchQuery.length > 0 ? (
                    <TouchableOpacity onPress={() => { setDrugSearchQuery(""); setDrugSearchResults([]); setSelectedDrugResult(null); }}>
                      <Feather name="x" size={16} color={theme.textSecondary} />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {drugSearchResults.length > 0 ? (
                  <View style={[styles.drugSearchDropdown, { borderColor: theme.border }]}>
                    {drugSearchResults.map((r, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[styles.drugSearchItem, i < drugSearchResults.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : {}]}
                        onPress={() => lookupDrugPrice(r.generic)}
                        testID={`drug-result-${i}`}
                      >
                        <View>
                          <ThemedText style={styles.drugSearchItemName}>
                            {r.generic}{r.brand !== r.generic ? ` (${r.brand})` : ""}
                          </ThemedText>
                          <ThemedText style={[styles.drugSearchItemClass, { color: theme.textSecondary }]}>
                            {r.drugClass}
                          </ThemedText>
                        </View>
                        {r.genericAvailable ? (
                          <View style={[styles.genericBadgeSmall, { borderColor: theme.border }]}>
                            <ThemedText style={[styles.genericBadgeSmallText, { color: theme.success }]}>Generic</ThemedText>
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </Card>

              {drugSearchLoading ? (
                <LoadingState message="Looking up prices..." />
              ) : null}

              {selectedDrugResult ? (
                <DrugCard
                  saving={selectedDrugResult}
                  index={0}
                  expanded={expandedDrug === selectedDrugResult.drugName}
                  onToggle={() => setExpandedDrug(expandedDrug === selectedDrugResult.drugName ? null : selectedDrugResult.drugName)}
                />
              ) : null}

              {drugLoading ? (
                <LoadingState message="Finding lowest prices for your medications..." />
              ) : (drugData?.savings?.length ?? 0) > 0 ? (
                <>
                  <SectionHeader
                    title="From your medication list"
                    subtitle="Prices based on medications in your health record."
                  />
                  {drugData.savings.map((s: DrugSaving, i: number) => (
                    <DrugCard
                      key={s.drugName}
                      saving={s}
                      index={i}
                      expanded={expandedDrug === s.drugName}
                      onToggle={() => setExpandedDrug(expandedDrug === s.drugName ? null : s.drugName)}
                    />
                  ))}
                  {drugData.estimatedMonthlySavings > 0 ? (
                    <Card style={[styles.savingsTotal, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText style={[styles.savingsTotalLabel, { color: theme.success }]}>
                        Estimated total monthly savings
                      </ThemedText>
                      <ThemedText style={[styles.savingsTotalAmount, { color: theme.success }]}>
                        ~${drugData.estimatedMonthlySavings}/month
                      </ThemedText>
                    </Card>
                  ) : null}
                </>
              ) : null}

              <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                Prices shown are estimates and may vary by pharmacy and location. GoodRx coupons are often cheaper than insurance copays. GoodRx is not insurance.
              </ThemedText>
            </View>
          )}

          {/* Behavioral health panel */}
          {activePanel === "behavioral" && (
            <View>
              <SectionHeader
                title="Mental health and substance use"
                subtitle="Free and low-cost behavioral health treatment near you."
              />
              <Card style={styles.bh_intro}>
                <ThemedText style={[styles.bh_body, { color: theme.textSecondary }]}>
                  SAMHSA's National Helpline is free, confidential, and available 24/7:
                </ThemedText>
                <TouchableOpacity
                  onPress={() => callPhone("18006624357")}
                  style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Call SAMHSA helpline 1-800-662-4357"
                >
                  <Feather name="phone" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.primaryBtnText}>
                    Call 1-800-662-4357 (free)
                  </ThemedText>
                </TouchableOpacity>
              </Card>
              <TouchableOpacity
                onPress={() => openUrl("https://findtreatment.samhsa.gov")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Find treatment facilities on SAMHSA
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openUrl("https://988lifeline.org")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  988 Suicide and Crisis Lifeline
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

          {activePanel === "resources" && (
            <View>
              <SectionHeader
                title="Community resources"
                subtitle="Food, housing, utilities, legal aid and more — powered by FindHelp.org"
              />

              <Card style={styles.sdohSearchCard} testID="sdoh-search-card">
                <View style={[styles.drugSearchInputRow, { borderColor: theme.border }]}>
                  <Feather name="search" size={16} color={theme.textSecondary} />
                  <TextInput
                    style={[styles.drugSearchInput, { color: theme.text }]}
                    placeholder="Search resources (e.g. food, rent help)"
                    placeholderTextColor={theme.textSecondary}
                    value={sdohSearchQuery}
                    onChangeText={setSdohSearchQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => sdohMutation.mutate()}
                    testID="input-sdoh-search"
                  />
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginTop: 10 }}
                  contentContainerStyle={{ gap: 6 }}
                >
                  {[
                    { key: "food", label: "Food", icon: "coffee" as const },
                    { key: "housing", label: "Housing", icon: "home" as const },
                    { key: "utilities", label: "Utilities", icon: "zap" as const },
                    { key: "financial", label: "Financial", icon: "dollar-sign" as const },
                    { key: "transportation", label: "Transit", icon: "truck" as const },
                    { key: "legal", label: "Legal", icon: "briefcase" as const },
                    { key: "employment", label: "Jobs", icon: "users" as const },
                    { key: "childcare", label: "Childcare", icon: "smile" as const },
                    { key: "disability", label: "Disability", icon: "award" as const },
                  ].map(cat => {
                    const isSelected = selectedSdohCategories.includes(cat.key);
                    return (
                      <TouchableOpacity
                        key={cat.key}
                        style={[
                          styles.sdohCatChip,
                          { borderColor: theme.border },
                          isSelected && { backgroundColor: theme.primary + "20", borderColor: theme.primary },
                        ]}
                        onPress={() => {
                          setSelectedSdohCategories(prev =>
                            isSelected ? prev.filter(c => c !== cat.key) : [...prev, cat.key]
                          );
                        }}
                        accessibilityRole="button"
                        testID={`sdoh-cat-${cat.key}`}
                      >
                        <Feather name={cat.icon} size={12} color={isSelected ? theme.primary : theme.textSecondary} />
                        <ThemedText style={[
                          styles.sdohCatText,
                          { color: isSelected ? theme.primary : theme.textSecondary },
                        ]}>
                          {cat.label}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => sdohMutation.mutate()}
                  style={[
                    styles.primaryBtn,
                    { backgroundColor: theme.primary, marginTop: 12 },
                    sdohMutation.isPending && { opacity: 0.6 },
                  ]}
                  disabled={sdohMutation.isPending}
                  accessibilityRole="button"
                  testID="button-sdoh-search"
                >
                  <Feather name="search" size={16} color="#fff" style={{ marginRight: 6 }} />
                  <ThemedText style={styles.primaryBtnText}>
                    {sdohMutation.isPending ? "Searching..." : "Find resources"}
                  </ThemedText>
                </TouchableOpacity>
              </Card>

              {sdohMutation.data ? (
                <View>
                  <ThemedText style={[styles.sdohResultCount, { color: theme.textSecondary }]}>
                    {sdohMutation.data.totalCount} resource{sdohMutation.data.totalCount !== 1 ? "s" : ""} found
                    {!sdohMutation.data.isLive ? " (national programs)" : ""}
                  </ThemedText>

                  {sdohMutation.data.categories.length > 0 && (
                    <View style={styles.sdohCatSummary}>
                      {sdohMutation.data.categories.map(c => (
                        <View key={c.category} style={[styles.sdohCatCount, { backgroundColor: theme.backgroundSecondary }]}>
                          <ThemedText style={[styles.sdohCatCountText, { color: theme.textSecondary }]}>
                            {c.label}: {c.count}
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  )}

                  {sdohMutation.data.resources.map((resource, idx) => {
                    const isExpanded = expandedResource === resource.id;
                    return (
                      <Animated.View key={resource.id} entering={FadeInDown.delay(idx * 40)}>
                        <Card style={styles.sdohResourceCard} testID={`sdoh-resource-${idx}`}>
                          <TouchableOpacity
                            onPress={() => setExpandedResource(isExpanded ? null : resource.id)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.sdohResourceHeader}>
                              <View style={{ flex: 1 }}>
                                <ThemedText style={styles.sdohResourceName}>{resource.name}</ThemedText>
                                <View style={styles.sdohBadgeRow}>
                                  <View style={[styles.sdohCategoryBadge, { backgroundColor: theme.primary + "15" }]}>
                                    <ThemedText style={[styles.sdohCategoryBadgeText, { color: theme.primary }]}>
                                      {resource.categoryLabel}
                                    </ThemedText>
                                  </View>
                                  {resource.isFree ? (
                                    <View style={[styles.sdohFreeBadge, { backgroundColor: "#34C75920" }]}>
                                      <ThemedText style={{ fontSize: 10, fontWeight: "600", color: "#34C759" }}>
                                        FREE
                                      </ThemedText>
                                    </View>
                                  ) : null}
                                </View>
                              </View>
                              <Feather
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color={theme.textSecondary}
                              />
                            </View>

                            <ThemedText
                              style={[styles.sdohResourceDesc, { color: theme.textSecondary }]}
                              numberOfLines={isExpanded ? undefined : 2}
                            >
                              {resource.description}
                            </ThemedText>
                          </TouchableOpacity>

                          {isExpanded ? (
                            <View style={[styles.sdohExpandedSection, { borderTopColor: theme.border }]}>
                              {resource.eligibility ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>
                                    Eligibility
                                  </ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {resource.eligibility}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {resource.languages && resource.languages.length > 0 ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>
                                    Languages
                                  </ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {resource.languages.join(", ")}
                                  </ThemedText>
                                </View>
                              ) : null}

                              {resource.hours ? (
                                <View style={styles.sdohDetailRow}>
                                  <ThemedText style={[styles.sdohDetailLabel, { color: theme.textSecondary }]}>
                                    Hours
                                  </ThemedText>
                                  <ThemedText style={styles.sdohDetailValue}>
                                    {resource.hours}
                                  </ThemedText>
                                </View>
                              ) : null}

                              <View style={styles.sdohActions}>
                                {resource.phone ? (
                                  <TouchableOpacity
                                    onPress={() => callPhone(resource.phone!)}
                                    style={[styles.actionBtn, { borderColor: theme.border }]}
                                    accessibilityRole="button"
                                    testID={`sdoh-call-${idx}`}
                                  >
                                    <Feather name="phone" size={14} color={theme.primary} />
                                    <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                                      Call
                                    </ThemedText>
                                  </TouchableOpacity>
                                ) : null}
                                {resource.website ? (
                                  <TouchableOpacity
                                    onPress={() => openUrl(resource.website!)}
                                    style={[styles.actionBtn, { borderColor: theme.border }]}
                                    accessibilityRole="button"
                                    testID={`sdoh-website-${idx}`}
                                  >
                                    <Feather name="external-link" size={14} color={theme.primary} />
                                    <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                                      Website
                                    </ThemedText>
                                  </TouchableOpacity>
                                ) : null}
                                {resource.applicationUrl ? (
                                  <TouchableOpacity
                                    onPress={() => openUrl(resource.applicationUrl!)}
                                    style={[styles.actionBtn, { borderColor: theme.primary, backgroundColor: theme.primary + "10" }]}
                                    accessibilityRole="button"
                                    testID={`sdoh-apply-${idx}`}
                                  >
                                    <Feather name="edit" size={14} color={theme.primary} />
                                    <ThemedText style={[styles.actionBtnText, { color: theme.primary }]}>
                                      Apply
                                    </ThemedText>
                                  </TouchableOpacity>
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                        </Card>
                      </Animated.View>
                    );
                  })}

                  <ThemedText style={[styles.disclaimer, { color: theme.textSecondary }]}>
                    {sdohMutation.data.disclaimer}
                  </ThemedText>
                </View>
              ) : null}

              {!sdohMutation.data && !sdohMutation.isPending ? (
                <Card style={styles.emptyCard}>
                  <Feather name="life-buoy" size={28} color={theme.textSecondary} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Search for community resources near you — food pantries, rent assistance, legal aid, job training, and more.
                  </ThemedText>
                </Card>
              ) : null}

              <TouchableOpacity
                onPress={() => openUrl("https://www.findhelp.org")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Browse all resources on FindHelp.org
                </ThemedText>
                <Feather name="external-link" size={14} color={theme.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => callPhone("211")}
                style={[styles.linkRow, { borderTopColor: theme.border }]}
                accessibilityRole="button"
              >
                <ThemedText style={[styles.linkText, { color: theme.primary }]}>
                  Call 2-1-1 for free referrals (24/7)
                </ThemedText>
                <Feather name="phone" size={14} color={theme.primary} />
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  headerTitle: { fontSize: Typography.h2.fontSize, fontWeight: "500", marginBottom: 4 },
  headerSubtitle: { fontSize: Typography.small.fontSize },
  summaryStrip: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  summaryCard: { borderRadius: BorderRadius.md, padding: Spacing.md },
  summaryLabel: { fontSize: 11, marginBottom: 3 },
  summaryValue: { fontSize: 13, fontWeight: "500" },
  savingsLine: { fontSize: 12, marginTop: 4 },
  tabsRow: { flexGrow: 0 },
  tabsContent: { paddingHorizontal: Spacing.lg, gap: 8, paddingBottom: Spacing.md },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BorderRadius.pill, borderWidth: 0.5,
  },
  tabText: { fontSize: 13 },
  panelBody: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, lineHeight: 19 },
  clinicCard: { marginBottom: Spacing.sm },
  clinicHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  clinicInfo: { flex: 1, marginRight: 8 },
  clinicName: { fontSize: 14, fontWeight: "500", marginBottom: 2 },
  clinicAddress: { fontSize: 12, lineHeight: 17 },
  feeBadge: {
    backgroundColor: "#34C75920", paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, alignSelf: "flex-start",
  },
  feeBadgeText: { fontSize: 11, color: "#34C759", fontWeight: "500" },
  serviceRow: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 10 },
  serviceChip: {
    borderWidth: 0.5, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  serviceChipText: { fontSize: 11 },
  clinicActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingVertical: 8, borderRadius: BorderRadius.sm, borderWidth: 0.5,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500" },
  eligibilityPrompt: { alignItems: "center", gap: 12 },
  eligBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: BorderRadius.button,
    minHeight: 44, alignSelf: "stretch",
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  inputLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderRadius: BorderRadius.sm,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15,
  },
  formLabel: { fontSize: 13, fontWeight: "500", marginBottom: 8 },
  stepperRow: { flexDirection: "row", gap: 8 },
  stepperBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.sm, borderWidth: 0.5,
    alignItems: "center",
  },
  stepperText: { fontSize: 14, fontWeight: "500" },
  incomeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  incomeChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.sm, borderWidth: 0.5,
  },
  incomeChipText: { fontSize: 12 },
  stateRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stateChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 0.5,
  },
  stateChipText: { fontSize: 12 },
  eligBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    alignSelf: "flex-start", marginBottom: 10,
  },
  eligBadgeText: { fontSize: 13, fontWeight: "500" },
  eligResultCard: { marginBottom: Spacing.sm },
  eligExplanation: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  eligFPL: { fontSize: 12 },
  programCard: { marginBottom: Spacing.sm },
  programName: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  programDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  programLimit: { fontSize: 12, marginBottom: 10 },
  applyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: BorderRadius.sm, borderWidth: 1,
    alignSelf: "flex-start",
  },
  applyBtnText: { fontSize: 13, fontWeight: "500" },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 8, marginBottom: 8 },
  linkRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, borderTopWidth: 0.5, marginTop: 4,
  },
  linkText: { fontSize: 13 },
  drugCard: { marginBottom: Spacing.sm },
  drugHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  drugName: { fontSize: 14, fontWeight: "500" },
  drugClassLabel: { fontSize: 11, marginTop: 2 },
  drugPriceCol: { alignItems: "flex-end", marginLeft: 8 },
  drugPrice: { fontSize: 18, fontWeight: "500" },
  drugPharmacy: { fontSize: 11 },
  drugSaved: { fontSize: 12, marginTop: 4 },
  copayBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: BorderRadius.sm, marginTop: 8, alignSelf: "flex-start",
  },
  copayBadgeText: { fontSize: 11, fontWeight: "600" },
  genericBadge: {
    borderWidth: 1, borderRadius: BorderRadius.xs,
    paddingVertical: 2, paddingHorizontal: 8, marginTop: 6, alignSelf: "flex-start",
  },
  genericBadgeText: { fontSize: 10, fontWeight: "500" },
  pharmacyList: { borderTopWidth: 1, marginTop: 12, paddingTop: 10 },
  pharmacyListTitle: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  pharmacyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  pharmacyName: { fontSize: 13, flex: 1 },
  pharmacyPrices: { flexDirection: "row", gap: 8, alignItems: "center" },
  pharmacyCash: { fontSize: 13 },
  pharmacyCoupon: { fontSize: 13, fontWeight: "600" },
  copayCompare: { borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  copayCompareTitle: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  copayGrid: { flexDirection: "row", gap: 16 },
  copayItem: { alignItems: "center" },
  copayLabel: { fontSize: 10 },
  copayValue: { fontSize: 14, fontWeight: "600" },
  papBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: BorderRadius.sm, marginTop: 10,
  },
  papBtnText: { fontSize: 12, fontWeight: "500", flex: 1 },
  referenceNote: { fontSize: 10, fontStyle: "italic" as const, marginTop: 8 },
  couponBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: BorderRadius.sm, marginTop: 8, alignSelf: "flex-start",
  },
  couponBtnText: { fontSize: 12, fontWeight: "500" },
  drugSearchCard: { marginBottom: Spacing.sm },
  drugSearchInputRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  drugSearchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  drugSearchDropdown: { borderWidth: 1, borderRadius: BorderRadius.sm, marginTop: 8 },
  drugSearchItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
  },
  drugSearchItemName: { fontSize: 13, fontWeight: "500" },
  drugSearchItemClass: { fontSize: 11, marginTop: 2 },
  genericBadgeSmall: { borderWidth: 1, borderRadius: BorderRadius.xs, paddingHorizontal: 6, paddingVertical: 1 },
  genericBadgeSmallText: { fontSize: 9, fontWeight: "600" },
  savingsTotal: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", marginBottom: Spacing.sm },
  savingsTotalLabel: { fontSize: 12 },
  savingsTotalAmount: { fontSize: 24, fontWeight: "500" },
  emptyCard: { alignItems: "center", gap: 12, paddingVertical: 24 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  bh_intro: { marginBottom: Spacing.sm },
  bh_body: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  sdohSearchCard: { marginBottom: Spacing.sm },
  sdohCatChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.pill, borderWidth: 0.5,
  },
  sdohCatText: { fontSize: 11, fontWeight: "500" },
  sdohResultCount: { fontSize: 12, marginBottom: 8, marginTop: 4 },
  sdohCatSummary: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  sdohCatCount: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sdohCatCountText: { fontSize: 10, fontWeight: "500" },
  sdohResourceCard: { marginBottom: Spacing.sm },
  sdohResourceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  sdohResourceName: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  sdohBadgeRow: { flexDirection: "row", gap: 6, marginBottom: 6 },
  sdohCategoryBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  sdohCategoryBadgeText: { fontSize: 10, fontWeight: "500" },
  sdohFreeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  sdohResourceDesc: { fontSize: 12, lineHeight: 17 },
  sdohExpandedSection: { borderTopWidth: 0.5, marginTop: 10, paddingTop: 10 },
  sdohDetailRow: { marginBottom: 8 },
  sdohDetailLabel: { fontSize: 11, fontWeight: "500", marginBottom: 2 },
  sdohDetailValue: { fontSize: 12, lineHeight: 17 },
  sdohActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  dpcSearchCard: { marginBottom: Spacing.sm },
  dpcToggleRow: { flexDirection: "row", marginTop: 10, gap: 8 },
  dpcToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: BorderRadius.pill, borderWidth: 0.5,
  },
  dpcToggleText: { fontSize: 12, fontWeight: "500" },
  dpcSavingsBanner: {
    flexDirection: "row", justifyContent: "space-around",
    padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm,
  },
  dpcSavingsCol: { alignItems: "center" },
  dpcSavingsLabel: { fontSize: 10, marginBottom: 2 },
  dpcSavingsAmount: { fontSize: 18, fontWeight: "600" },
  dpcVisitCard: { marginBottom: Spacing.sm },
  dpcVisitHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dpcVisitLabel: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  dpcBadgeRow: { flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 8 },
  dpcBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  dpcBadgeText: { fontSize: 10, fontWeight: "500" },
  dpcPriceCol: { alignItems: "flex-end", marginLeft: 8 },
  dpcPrice: { fontSize: 22, fontWeight: "600" },
  dpcOriginalPrice: { fontSize: 12, textDecorationLine: "line-through" as const, color: "#8E8E93" },
  dpcSaveBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  dpcProviderRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  dpcProviderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: "center", alignItems: "center",
  },
  dpcProviderInitial: { fontSize: 13, fontWeight: "600" },
  dpcProviderName: { fontSize: 13, fontWeight: "500" },
  dpcProviderDetail: { fontSize: 11, marginTop: 1 },
  dpcRating: { flexDirection: "row", alignItems: "center", gap: 3 },
  dpcRatingText: { fontSize: 12, fontWeight: "500" },
  dpcExpandedSection: { borderTopWidth: 0.5, marginTop: 12, paddingTop: 10 },
  dpcIncludesSection: { marginBottom: 10 },
  dpcIncludesTitle: { fontSize: 11, fontWeight: "600", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  dpcIncludeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dpcIncludeText: { fontSize: 12 },
  dpcCompareRow: { padding: 8, borderRadius: BorderRadius.sm, marginTop: 6 },
  dpcCompareText: { fontSize: 12, fontWeight: "500", textAlign: "center" as const },
  claimsInfoText: { fontSize: 12, lineHeight: 18 },
  claimsSummaryBanner: {
    padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm,
  },
  claimsSummaryRow: { flexDirection: "row", justifyContent: "space-around" },
  claimsSummaryItem: { alignItems: "center" as const },
  claimsSummaryLabel: { fontSize: 10, marginBottom: 2 },
  claimsSummaryValue: { fontSize: 16, fontWeight: "600" },
  claimsDateRange: { fontSize: 10, textAlign: "center" as const, marginTop: 8 },
  claimsCoverageCard: { marginBottom: Spacing.sm },
  claimsCoverageHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  claimsCoveragePlan: { fontSize: 14, fontWeight: "600", flex: 1 },
  claimsCoverageStatusBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  claimsCoverageDetails: { gap: 6 },
  claimsCoverageRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  claimsCoverageLabel: { fontSize: 12 },
  claimsCoverageValue: { fontSize: 12, fontWeight: "500" },
  claimsTypeBreakdown: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: Spacing.sm,
  },
  claimsTypeChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  claimsTypeChipText: { fontSize: 10, fontWeight: "500" },
  claimCard: { marginBottom: Spacing.sm },
  claimHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  claimTypeIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  claimProviderName: { fontSize: 13, fontWeight: "500", marginBottom: 3 },
  claimMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  claimDate: { fontSize: 11 },
  claimStatusBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  claimTypeBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
  },
  claimTypeBadgeText: { fontSize: 10, fontWeight: "500" },
  claimAmountCol: { alignItems: "flex-end" as const, marginLeft: 6 },
  claimPatientAmount: { fontSize: 16, fontWeight: "600" },
  claimBilledAmount: { fontSize: 10 },
  claimDiagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  claimDiagChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
    maxWidth: "48%" as unknown as number,
  },
  claimDiagCode: { fontSize: 10, fontWeight: "600" },
  claimDiagText: { fontSize: 10, flex: 1 },
  claimExpandedSection: { borderTopWidth: 0.5, marginTop: 12, paddingTop: 10 },
  claimFinancials: { marginBottom: 12 },
  claimFinancialsTitle: {
    fontSize: 11, fontWeight: "600", marginBottom: 8,
    textTransform: "uppercase" as const, letterSpacing: 0.5,
  },
  claimFinRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", marginBottom: 4,
  },
  claimFinLabel: { fontSize: 12 },
  claimFinValue: { fontSize: 12, fontWeight: "500" },
  claimProcedures: { marginBottom: 12 },
  claimProcRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 5,
  },
  claimProcCode: { fontSize: 11, fontWeight: "600", minWidth: 52 },
  claimProcDesc: { fontSize: 12, flex: 1 },
  claimNotesBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 10, borderRadius: BorderRadius.sm, marginTop: 6,
  },
  claimNotesText: { fontSize: 12, flex: 1, lineHeight: 17 },
  claimNumber: { fontSize: 10, marginTop: 10 },
});
