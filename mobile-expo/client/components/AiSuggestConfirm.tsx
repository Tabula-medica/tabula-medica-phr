/**
 * AI Suggestion Confirm Gate — Mobile component (Task #297)
 *
 * Bottom sheet / modal that asks the user to confirm before AI-suggested
 * content fills any form field or document. Dismissed suggestions are
 * logged fire-and-forget.
 *
 * Usage:
 *   <AiSuggestConfirm
 *     suggestion={aiText}
 *     onUse={(text) => { field.onChange(text); }}
 *     onDismiss={() => setSuggestion(null)}
 *   />
 */
import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiUrl } from "@/lib/query-client";

interface AiSuggestConfirmProps {
  suggestion: string | null;
  onUse: (text: string) => void;
  onDismiss: () => void;
  fieldLabel?: string;
  sourceRoute?: string;
}

export function AiSuggestConfirm({
  suggestion,
  onUse,
  onDismiss,
  fieldLabel,
  sourceRoute,
}: AiSuggestConfirmProps) {
  const insets = useSafeAreaInsets();

  const logDismiss = () => {
    if (!suggestion) return;
    const url = new URL("/api/ai-review/submit", getApiUrl()).toString();
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        route: sourceRoute ?? "mobile-suggest-confirm-dismissed",
        aiOutput: suggestion,
        requestContext: { action: "user_dismissed", fieldLabel },
      }),
    }).catch(() => {});
  };

  const handleDismiss = () => {
    logDismiss();
    onDismiss();
  };

  return (
    <Modal
      visible={!!suggestion}
      transparent
      animationType="slide"
      onRequestClose={handleDismiss}
      testID="modal-ai-suggest-confirm"
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 16 },
          ]}
        >
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>AI Suggestion</Text>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>AI-generated</Text>
            </View>
          </View>

          {fieldLabel ? (
            <Text style={styles.subtitle}>
              Review the AI suggestion for "{fieldLabel}" before using it.
            </Text>
          ) : (
            <Text style={styles.subtitle}>
              Review this AI-generated suggestion before adding it to your record.
            </Text>
          )}

          {/* Suggestion content */}
          <ScrollView
            style={styles.contentBox}
            contentContainerStyle={styles.contentBoxInner}
            testID="text-ai-suggestion"
          >
            <Text style={styles.contentText}>{suggestion ?? ""}</Text>
          </ScrollView>

          <Text style={styles.disclaimer}>
            This content is AI-generated. Review it carefully before using it in a medical record or form.
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={handleDismiss}
              testID="button-dismiss-suggestion"
              accessibilityLabel="Dismiss AI suggestion"
            >
              <Text style={styles.btnOutlineText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => {
                if (suggestion) onUse(suggestion);
              }}
              testID="button-use-suggestion"
              accessibilityLabel="Use this AI suggestion"
            >
              <Text style={styles.btnPrimaryText}>Use this suggestion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
    ...(Platform.OS === "android" && { paddingTop: 20 }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0e0",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  aiBadge: {
    backgroundColor: "#ede9fe",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7c3aed",
  },
  subtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
    lineHeight: 18,
  },
  contentBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    maxHeight: 180,
    marginBottom: 10,
  },
  contentBoxInner: {
    padding: 14,
  },
  contentText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 21,
  },
  disclaimer: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 16,
    lineHeight: 15,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    backgroundColor: "transparent",
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  btnPrimary: {
    backgroundColor: "#2563eb",
  },
  btnPrimaryText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
});
