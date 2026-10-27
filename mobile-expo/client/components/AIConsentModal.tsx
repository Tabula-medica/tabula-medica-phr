import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface AIConsentModalProps {
  isVisible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const AIConsentModal = ({ isVisible, onAccept, onDecline }: AIConsentModalProps) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={[styles.overlay, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
        <View style={styles.container}>
          <View style={styles.iconRow}>
            <View style={styles.iconCircle}>
              <Feather name="shield" size={28} color="#007AFF" />
            </View>
          </View>

          <Text style={styles.title}>AI Privacy Commitment</Text>

          <ScrollView style={styles.content} bounces={false}>
            <Text style={styles.text}>
              To provide personalized health insights, Tabula Medica uses advanced AI processing.
              {"\n\n"}
              <Text style={styles.bold}>Your Privacy is Protected:</Text>
              {"\n\n"}
            </Text>

            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={16} color="#34C759" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                All data is <Text style={styles.bold}>anonymized</Text> before processing
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={16} color="#34C759" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                No personal identifiers (Name, Email, Phone) are shared
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={16} color="#34C759" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                Data is not used to train AI models
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Feather name="check-circle" size={16} color="#34C759" style={styles.bulletIcon} />
              <Text style={styles.bulletText}>
                You can revoke this consent at any time in Settings
              </Text>
            </View>

            <Text style={styles.disclaimer}>
              By tapping "I Agree & Continue," you consent to the processing of your de-identified health data by our AI services. This consent is required for AI-powered features only and does not affect core app functionality.
            </Text>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.acceptBtn]}
              onPress={onAccept}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Accept AI data processing consent"
            >
              <Text style={styles.acceptText}>I Agree & Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.declineBtn]}
              onPress={onDecline}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Decline AI data processing"
            >
              <Text style={styles.declineText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  container: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EBF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700" as const,
    marginBottom: 16,
    textAlign: "center",
    color: "#1C1C1E",
  },
  content: {
    marginBottom: 20,
  },
  text: {
    fontSize: 15,
    color: "#3A3A3C",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "600" as const,
    color: "#1C1C1E",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingLeft: 4,
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    color: "#3A3A3C",
    lineHeight: 21,
  },
  disclaimer: {
    fontSize: 12,
    color: "#8E8E93",
    lineHeight: 17,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  acceptBtn: {
    backgroundColor: "#007AFF",
  },
  acceptText: {
    color: "white",
    fontWeight: "600" as const,
    fontSize: 17,
  },
  declineBtn: {
    backgroundColor: "#F2F2F7",
  },
  declineText: {
    color: "#8E8E93",
    fontWeight: "500" as const,
    fontSize: 15,
  },
});
