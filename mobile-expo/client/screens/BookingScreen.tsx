import React, { useState } from "react";
import { View, ScrollView, Pressable, StyleSheet, TextInput, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { PaymentLaneSelector, type PaymentLane } from "@/components/PaymentLaneSelector";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import Animated, { FadeInDown } from "react-native-reanimated";

type BookingStep = "services" | "payment" | "confirm" | "complete";

interface SelectedService {
  cptCode: string;
  description: string;
  price: number;
}

const COMMON_SERVICES: SelectedService[] = [
  { cptCode: "99213", description: "Office Visit (Level 3)", price: 82.40 },
  { cptCode: "99214", description: "Office Visit (Level 4)", price: 120.86 },
  { cptCode: "36415", description: "Blood Draw", price: 8.36 },
  { cptCode: "80053", description: "Comprehensive Metabolic Panel", price: 11.47 },
  { cptCode: "85025", description: "Complete Blood Count", price: 7.77 },
  { cptCode: "83036", description: "Hemoglobin A1C", price: 9.13 },
  { cptCode: "80061", description: "Lipid Panel", price: 13.39 },
  { cptCode: "71046", description: "Chest X-Ray (2 views)", price: 22.94 },
  { cptCode: "90834", description: "Therapy Session (45 min)", price: 100.14 },
  { cptCode: "99385", description: "Annual Physical (18-39)", price: 149.24 },
];

function formatCurrency(amount: number) {
  return `$${amount.toFixed(2)}`;
}

function StepIndicator({ currentStep, theme }: { currentStep: BookingStep; theme: any }) {
  const steps: { key: BookingStep; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { key: "services", label: "Services", icon: "list" },
    { key: "payment", label: "Payment", icon: "credit-card" },
    { key: "confirm", label: "Confirm", icon: "check-circle" },
  ];
  const currentIdx = steps.findIndex(s => s.key === currentStep);

  return (
    <View style={stepStyles.container}>
      {steps.map((step, idx) => {
        const isActive = idx <= currentIdx;
        const isCurrent = step.key === currentStep;
        return (
          <React.Fragment key={step.key}>
            <View style={stepStyles.stepItem}>
              <View style={[stepStyles.circle, { backgroundColor: isActive ? theme.primary : theme.backgroundTertiary }]}>
                <Feather name={step.icon} size={14} color={isActive ? "#FFF" : theme.textSecondary} />
              </View>
              <ThemedText type="small" style={{ color: isCurrent ? theme.primary : theme.textSecondary, fontWeight: isCurrent ? "700" : "500", fontSize: 10, marginTop: 4 }}>
                {step.label}
              </ThemedText>
            </View>
            {idx < steps.length - 1 ? (
              <View style={[stepStyles.connector, { backgroundColor: idx < currentIdx ? theme.primary : theme.backgroundTertiary }]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg },
  stepItem: { alignItems: "center" },
  circle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  connector: { height: 2, flex: 1, marginHorizontal: 8 },
});

export default function BookingScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<BookingStep>("services");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [paymentLane, setPaymentLane] = useState<PaymentLane | null>(null);
  const [vaReferral, setVaReferral] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const totalAmount = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const toggleService = (service: SelectedService) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.cptCode === service.cptCode);
      if (exists) return prev.filter(s => s.cptCode !== service.cptCode);
      return [...prev, service];
    });
  };

  const handleConfirmBooking = async () => {
    setProcessing(true);
    try {
      if (paymentLane === "B_VA_CCN" && vaReferral) {
        const verifyUrl = new URL("/api/optum-edi/verify-referral", getApiUrl());
        const verifyRes = await apiRequest("POST", verifyUrl.toString(), {
          referralNumber: vaReferral,
          veteranLastName: "Patient",
        });
        const verification = await verifyRes.json();
        if (!verification.verified || verification.eligibilityStatus !== "eligible") {
          Alert.alert("VA Referral Issue", `Referral status: ${verification.eligibilityStatus || "unknown"}. Please contact your VA care coordinator.`);
          setProcessing(false);
          return;
        }
      }

      if (paymentLane === "A_INSTAMED") {
        const chargeUrl = new URL("/api/instamed/charge", getApiUrl());
        const chargeRes = await apiRequest("POST", chargeUrl.toString(), {
          patientId: "current-patient",
          gfeId: `GFE-${Date.now()}`,
          amount: totalAmount,
          paymentMethod: "card",
        });
        const payment = await chargeRes.json();
        if (payment.status === "declined") {
          Alert.alert("Payment Declined", "Your payment was declined. Please try a different payment method.");
          setProcessing(false);
          return;
        }
      }

      const id = `BK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      setBookingId(id);
      setStep("complete");
    } catch (err: any) {
      Alert.alert("Booking Error", err.message || "Unable to complete booking");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100, paddingHorizontal: Spacing.lg }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step !== "complete" ? <StepIndicator currentStep={step} theme={theme} /> : null}

        {step === "services" ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
                  <Feather name="list" size={20} color="#3B82F6" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Select Services</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Choose what you need for your visit</ThemedText>
                </View>
              </View>

              {COMMON_SERVICES.map((svc) => {
                const isSelected = selectedServices.some(s => s.cptCode === svc.cptCode);
                return (
                  <Pressable key={svc.cptCode} testID={`service-${svc.cptCode}`} onPress={() => toggleService(svc)} style={[styles.serviceRow, { borderBottomColor: theme.border }]} accessibilityRole="checkbox" accessibilityLabel={`${svc.description}, CPT ${svc.cptCode}, ${formatCurrency(svc.price)}`} accessibilityState={{ checked: isSelected }}>
                    <View style={[styles.checkbox, { borderColor: isSelected ? "#10B981" : theme.border, backgroundColor: isSelected ? "#10B981" : "transparent" }]}>
                      {isSelected ? <Feather name="check" size={14} color="#FFF" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>{svc.description}</ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>CPT {svc.cptCode}</ThemedText>
                    </View>
                    <ThemedText style={{ fontWeight: "700", color: isSelected ? "#10B981" : theme.textSecondary }}>{formatCurrency(svc.price)}</ThemedText>
                  </Pressable>
                );
              })}
            </Card>

            {selectedServices.length > 0 ? (
              <Card style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Estimated Total</ThemedText>
                  <ThemedText type="subtitle" style={{ fontWeight: "800", color: "#10B981" }}>{formatCurrency(totalAmount)}</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>{selectedServices.length} service(s) selected</ThemedText>
              </Card>
            ) : null}

            <Pressable
              testID="button-next-payment"
              onPress={() => setStep("payment")}
              disabled={selectedServices.length === 0}
              style={[styles.primaryButton, { backgroundColor: selectedServices.length > 0 ? theme.primary : theme.backgroundTertiary }]}
              accessibilityRole="button"
              accessibilityLabel="Next: Payment Lane"
              accessibilityState={{ disabled: selectedServices.length === 0 }}
            >
              <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>Next: Payment Lane</ThemedText>
              <Feather name="arrow-right" size={18} color="#FFF" />
            </Pressable>
          </Animated.View>
        ) : null}

        {step === "payment" ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <PaymentLaneSelector selectedLane={paymentLane} onSelectLane={setPaymentLane} totalAmount={totalAmount} />

            {paymentLane === "B_VA_CCN" ? (
              <Card style={{ padding: Spacing.lg, marginTop: Spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
                  <Feather name="flag" size={18} color="#10B981" />
                  <ThemedText type="subtitle" style={{ fontWeight: "700", marginLeft: 8 }}>VA Referral</ThemedText>
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md, lineHeight: 18 }}>
                  Enter your VA Community Care referral number. This is required for VA to pay the provider directly.
                </ThemedText>
                <TextInput
                  testID="input-va-referral"
                  value={vaReferral}
                  onChangeText={setVaReferral}
                  placeholder="VA referral number (e.g., CCN-2026-123456)"
                  placeholderTextColor={theme.textSecondary}
                  accessibilityLabel="VA referral number"
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                />
              </Card>
            ) : null}

            <Card style={{ padding: Spacing.lg, marginTop: Spacing.md }}>
              <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.sm }}>Preferred Date</ThemedText>
              <TextInput
                testID="input-preferred-date"
                value={preferredDate}
                onChangeText={setPreferredDate}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Preferred date"
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              />
              <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: Spacing.sm, marginTop: Spacing.md }}>Notes for Provider</ThemedText>
              <TextInput
                testID="input-notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Symptoms, concerns, or special requests..."
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Notes for provider"
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              />
            </Card>

            <View style={{ flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg }}>
              <Pressable onPress={() => setStep("services")} style={[styles.secondaryButton, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Back to services">
                <Feather name="arrow-left" size={16} color={theme.text} />
                <ThemedText type="body" style={{ fontWeight: "600", marginLeft: 6 }}>Back</ThemedText>
              </Pressable>
              <Pressable
                testID="button-next-confirm"
                onPress={() => setStep("confirm")}
                disabled={!paymentLane || (paymentLane === "B_VA_CCN" && !vaReferral)}
                style={[styles.primaryButton, { flex: 2, backgroundColor: paymentLane ? theme.primary : theme.backgroundTertiary }]}
                accessibilityRole="button"
                accessibilityLabel="Review Booking"
                accessibilityState={{ disabled: !paymentLane || (paymentLane === "B_VA_CCN" && !vaReferral) }}
              >
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>Review Booking</ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {step === "confirm" ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Card style={{ padding: Spacing.lg, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginRight: Spacing.sm }}>
                  <Feather name="check-circle" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="subtitle" style={{ fontWeight: "700" }}>Booking Summary</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Review before confirming</ThemedText>
                </View>
              </View>

              <View style={[styles.summarySection, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 6 }}>SERVICES</ThemedText>
                {selectedServices.map(svc => (
                  <View key={svc.cptCode} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <ThemedText type="small">{svc.description} (CPT {svc.cptCode})</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: "600" }}>{formatCurrency(svc.price)}</ThemedText>
                  </View>
                ))}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: theme.border }}>
                  <ThemedText type="body" style={{ fontWeight: "700" }}>Total</ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "800", color: "#10B981" }}>{formatCurrency(totalAmount)}</ThemedText>
                </View>
              </View>

              <View style={[styles.summarySection, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 6 }}>PAYMENT</ThemedText>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {paymentLane === "A_INSTAMED" ? "Self-Pay (InstaMed)" : "VA Community Care (Optum CCN)"}
                </ThemedText>
                <ThemedText type="small" style={{ color: paymentLane === "B_VA_CCN" ? "#10B981" : theme.textSecondary, fontWeight: "600" }}>
                  Patient cost: {paymentLane === "B_VA_CCN" ? "$0.00" : formatCurrency(totalAmount)}
                </ThemedText>
                {vaReferral ? <ThemedText type="small" style={{ color: theme.textSecondary }}>VA Referral: {vaReferral}</ThemedText> : null}
              </View>

              {preferredDate ? (
                <View style={{ marginBottom: Spacing.sm }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 4 }}>PREFERRED DATE</ThemedText>
                  <ThemedText type="body">{preferredDate}</ThemedText>
                </View>
              ) : null}
              {notes ? (
                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, fontWeight: "700", marginBottom: 4 }}>NOTES</ThemedText>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>{notes}</ThemedText>
                </View>
              ) : null}
            </Card>

            <Card style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="shield" size={14} color="#3B82F6" />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 6, flex: 1, lineHeight: 16, fontSize: 10 }}>
                  Protected under the No Surprises Act. If your final bill exceeds this estimate by more than $400, you may dispute through the PPDR process.
                </ThemedText>
              </View>
            </Card>

            <View style={{ flexDirection: "row", gap: Spacing.md }}>
              <Pressable onPress={() => setStep("payment")} style={[styles.secondaryButton, { borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel="Back to payment">
                <Feather name="arrow-left" size={16} color={theme.text} />
                <ThemedText type="body" style={{ fontWeight: "600", marginLeft: 6 }}>Back</ThemedText>
              </Pressable>
              <Pressable
                testID="button-confirm-booking"
                onPress={handleConfirmBooking}
                disabled={processing}
                style={[styles.primaryButton, { flex: 2, backgroundColor: "#10B981" }]}
                accessibilityRole="button"
                accessibilityLabel={processing ? "Processing booking" : "Confirm Booking"}
                accessibilityState={{ disabled: processing }}
              >
                <Feather name="check" size={18} color="#FFF" />
                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700", marginLeft: 6 }}>
                  {processing ? "Processing..." : "Confirm Booking"}
                </ThemedText>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {step === "complete" ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Card style={{ padding: Spacing.xl, alignItems: "center", marginBottom: Spacing.lg }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B98120", alignItems: "center", justifyContent: "center", marginBottom: Spacing.md }}>
                <Feather name="check-circle" size={32} color="#10B981" />
              </View>
              <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: 4 }}>Booking Confirmed</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>Confirmation ID: {bookingId}</ThemedText>

              <View style={[styles.confirmCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Services</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "600" }}>{selectedServices.length} items</ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Payment</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "600" }}>{paymentLane === "B_VA_CCN" ? "VA CCN" : "Self-Pay"}</ThemedText>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>Your Cost</ThemedText>
                  <ThemedText type="small" style={{ fontWeight: "700", color: "#10B981" }}>{paymentLane === "B_VA_CCN" ? "$0.00" : formatCurrency(totalAmount)}</ThemedText>
                </View>
              </View>

              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", lineHeight: 18, marginTop: Spacing.md }}>
                A confirmation email will be sent to your registered address. The provider will contact you to finalize the appointment time.
              </ThemedText>
            </Card>

            <Pressable testID="button-done" onPress={() => navigation.goBack()} style={[styles.primaryButton, { backgroundColor: theme.primary }]} accessibilityRole="button" accessibilityLabel="Done, return to previous screen">
              <ThemedText type="body" style={{ color: "#FFF", fontWeight: "700" }}>Done</ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  serviceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 0.5 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginRight: Spacing.sm },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: BorderRadius.md },
  secondaryButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: 14 },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  summarySection: { marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 0.5 },
  confirmCard: { width: "100%", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
});
