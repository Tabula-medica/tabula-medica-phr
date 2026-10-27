import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";
import * as Haptics from "expo-haptics";

interface ExplainabilityTooltipProps {
  insights: string[];
  children: React.ReactNode;
}

export function ExplainabilityTooltip({ insights, children }: ExplainabilityTooltipProps) {
  const { theme: colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, width: 0 });
  const anchorRef = useRef<View>(null);

  const show = useCallback(() => {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      setPosition({ x, y: y - 8, width });
      setVisible(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });
  }, []);

  const hide = useCallback(() => setVisible(false), []);

  const tooltipWidth = 260;
  const screenWidth = Dimensions.get("window").width;
  const leftPos = Math.max(12, Math.min(position.x, screenWidth - tooltipWidth - 12));

  return (
    <View ref={anchorRef} collapsable={false}>
      <Pressable
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel="Show Med-Gemini reasoning"
        accessibilityHint="Tap to see why the AI produced this confidence score"
      >
        {children}
      </Pressable>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
        <Pressable style={styles.backdrop} onPress={hide}>
          <View
            style={[
              styles.tooltip,
              {
                top: position.y - 8,
                left: leftPos,
                width: tooltipWidth,
                transform: [{ translateY: -999 }],
              },
            ]}
            onLayout={(e) => {
              const tooltipHeight = e.nativeEvent.layout.height;
              setPosition((prev) => ({ ...prev, y: prev.y }));
            }}
          />

          <View
            style={[
              styles.tooltip,
              {
                bottom: Dimensions.get("window").height - position.y + 8,
                left: leftPos,
                width: tooltipWidth,
              },
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerDot} />
              <ThemedText style={styles.headerLabel}>Med-Gemini Reasoning</ThemedText>
            </View>

            {insights.map((note, index) => (
              <View key={index} style={styles.insightRow}>
                <View style={styles.bullet} />
                <ThemedText style={styles.insightText}>{note}</ThemedText>
              </View>
            ))}

            <View style={[styles.arrow, { left: Math.max(12, position.x - leftPos + (position.width / 2) - 6) }]} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const DARK_BG = "#0F172A";

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  tooltip: {
    position: "absolute",
    backgroundColor: DARK_BG,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#34D399",
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34D399",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  insightRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "flex-start",
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
    marginTop: 5,
  },
  insightText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#CBD5E1",
    flex: 1,
  },
  arrow: {
    position: "absolute",
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: DARK_BG,
  },
});
