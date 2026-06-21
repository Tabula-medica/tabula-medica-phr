import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useMutation } from "@tanstack/react-query";
import api from "../services/api";
import QRCode from "react-native-qrcode-svg";
import { Feather } from "@expo/vector-icons";

interface ShareLink {
  url: string;
  expiresAt: string;
  accessCode?: string;
}

export default function ShareQRScreen() {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [expiryHours, setExpiryHours] = useState(24);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ShareLink>("/api/share-links", {
        expiresInHours: expiryHours,
        includeConditions: true,
        includeMedications: true,
        includeLabResults: true,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setShareLink(data);
    },
    onError: () => {
      Alert.alert("Error", "Failed to generate share link. Please try again.");
    },
  });

  const expiryOptions = [
    { label: "1 Hour", value: 1 },
    { label: "24 Hours", value: 24 },
    { label: "7 Days", value: 168 },
  ];

  function getTimeRemaining() {
    if (!shareLink) return "";
    const expires = new Date(shareLink.expiresAt);
    const now = new Date();
    const diff = expires.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      return `${Math.floor(hours / 24)} days remaining`;
    }
    return `${hours}h ${minutes}m remaining`;
  }

  return (
    <View style={styles.container}>
      {!shareLink ? (
        <View style={styles.setupContainer}>
          <View style={styles.headerCard}>
            <Feather name="share-2" size={32} color="#0F766E" />
            <Text style={styles.headerTitle}>Share Your Records</Text>
            <Text style={styles.headerSubtitle}>
              Generate a secure QR code that providers can scan to view your health summary
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Link Expiration</Text>
          <View style={styles.expiryOptions}>
            {expiryOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.expiryOption,
                  expiryHours === option.value && styles.expiryOptionActive,
                ]}
                onPress={() => setExpiryHours(option.value)}
                testID={`button-expiry-${option.value}`}
              >
                <Text
                  style={[
                    styles.expiryOptionText,
                    expiryHours === option.value && styles.expiryOptionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.generateButton, generateMutation.isPending && styles.generateButtonDisabled]}
            onPress={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            testID="button-generate-qr"
          >
            {generateMutation.isPending ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.generateButtonText}>Generating...</Text>
              </>
            ) : (
              <>
                <Feather name="zap" size={20} color="#fff" />
                <Text style={styles.generateButtonText}>Generate QR Code</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.securityNote}>
            <Feather name="lock" size={16} color="#065F46" />
            <Text style={styles.securityText}>
              Links are encrypted and expire automatically. You can revoke access at any time.
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.qrContainer}>
          <View style={styles.qrCard}>
            <QRCode
              value={shareLink.url}
              size={200}
              backgroundColor="#fff"
              color="#111827"
            />
          </View>

          <Text style={styles.expiryLabel}>{getTimeRemaining()}</Text>

          {shareLink.accessCode && (
            <View style={styles.accessCodeCard}>
              <Text style={styles.accessCodeLabel}>Access Code</Text>
              <Text style={styles.accessCode}>{shareLink.accessCode}</Text>
            </View>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShareLink(null)}
              testID="button-new-qr"
            >
              <Feather name="refresh-cw" size={20} color="#0F766E" />
              <Text style={styles.actionButtonText}>New Code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.revokeButton]}
              onPress={() => {
                Alert.alert(
                  "Revoke Access",
                  "This will invalidate the current QR code. Continue?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { text: "Revoke", style: "destructive", onPress: () => setShareLink(null) },
                  ]
                );
              }}
              testID="button-revoke-qr"
            >
              <Feather name="x-circle" size={20} color="#DC2626" />
              <Text style={[styles.actionButtonText, styles.revokeButtonText]}>Revoke</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.instructionCard}>
            <Feather name="info" size={16} color="#0369A1" />
            <Text style={styles.instructionText}>
              Show this QR code to your healthcare provider. They can scan it to view your health
              summary securely.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          For informational purposes only. Not for clinical decision-making.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  setupContainer: {
    flex: 1,
    padding: 16,
  },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 12,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  expiryOptions: {
    flexDirection: "row",
    gap: 12,
  },
  expiryOption: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  expiryOptionActive: {
    borderColor: "#0F766E",
    backgroundColor: "#ECFDF5",
  },
  expiryOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  expiryOptionTextActive: {
    color: "#0F766E",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0F766E",
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  securityNote: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
    alignItems: "flex-start",
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: "#065F46",
    lineHeight: 18,
  },
  qrContainer: {
    flex: 1,
    padding: 16,
    alignItems: "center",
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  expiryLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 16,
  },
  accessCodeCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: "center",
  },
  accessCodeLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  accessCode: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F766E",
    letterSpacing: 4,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    width: "100%",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F766E",
  },
  revokeButton: {
    borderColor: "#FEE2E2",
    backgroundColor: "#FEF2F2",
  },
  revokeButtonText: {
    color: "#DC2626",
  },
  instructionCard: {
    flexDirection: "row",
    backgroundColor: "#E0F2FE",
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
    alignItems: "flex-start",
    width: "100%",
  },
  instructionText: {
    flex: 1,
    fontSize: 13,
    color: "#0369A1",
    lineHeight: 18,
  },
  disclaimer: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#92400E",
    textAlign: "center",
  },
});
