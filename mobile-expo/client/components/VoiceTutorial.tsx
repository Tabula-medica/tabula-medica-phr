/**
 * VoiceTutorial — 3-step animated first-use guide for voice commands.
 */
import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import Animated, { FadeIn, SlideInRight, SlideOutLeft } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

interface VoiceTutorialProps {
  onDone: () => void;
}

const STEPS = [
  {
    icon: "navigation" as const,
    title: "Navigate by voice",
    body: 'Say "Go to records", "Open lab results", "Go home", or "Go back" to navigate without touching the screen.',
    hint: 'Try: "Go to my records"',
  },
  {
    icon: "edit-3" as const,
    title: "Fill forms hands-free",
    body: 'Hold the mic button and say things like "Set first name to Alex" or "Set date of birth to March 5, 1985".',
    hint: 'Try: "Set email to alex@example.com"',
  },
  {
    icon: "check-circle" as const,
    title: "Confirm or cancel",
    body: 'After a field is filled, say "Confirm" to accept it or "Cancel" to undo. Say "Help" anytime to hear available commands.',
    hint: 'Try: "Confirm" or "Cancel"',
  },
];

export default function VoiceTutorial({ onDone }: VoiceTutorialProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const handleNext = () => {
    if (isLast) {
      onDone();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => onDone();

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[
            styles.card,
            { backgroundColor: theme.backgroundCard, borderColor: theme.border },
          ]}
        >
          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i <= step ? theme.primary : theme.border,
                    width: i === step ? 20 : 8,
                  },
                ]}
                accessibilityLabel={`Step ${i + 1} of ${STEPS.length}${i < step ? ", completed" : i === step ? ", current" : ""}`}
              />
            ))}
          </View>

          {/* Icon */}
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: theme.primary + "18" },
            ]}
          >
            <Feather name={current.icon} size={36} color={theme.primary} />
          </View>

          {/* Title + body */}
          <ThemedText
            type="subtitle"
            style={[styles.title, { color: theme.text }]}
            accessibilityRole="header"
          >
            {current.title}
          </ThemedText>
          <ThemedText
            style={[styles.body, { color: theme.textSecondary }]}
          >
            {current.body}
          </ThemedText>

          {/* Example hint */}
          <View
            style={[
              styles.hintBox,
              { backgroundColor: theme.primary + "0F", borderColor: theme.primary + "30" },
            ]}
          >
            <Feather name="mic" size={14} color={theme.primary} />
            <ThemedText
              type="caption"
              style={[styles.hintText, { color: theme.primary }]}
            >
              {current.hint}
            </ThemedText>
          </View>

          {/* Step counter */}
          <ThemedText
            type="caption"
            style={[styles.counter, { color: theme.textSecondary }]}
          >
            {step + 1} of {STEPS.length}
          </ThemedText>

          {/* Buttons */}
          <View style={styles.buttons}>
            <Pressable
              onPress={handleSkip}
              style={styles.skipBtn}
              accessibilityLabel="Skip tutorial"
              accessibilityRole="button"
            >
              <ThemedText
                type="caption"
                style={{ color: theme.textSecondary }}
              >
                Skip
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleNext}
              style={[styles.nextBtn, { backgroundColor: theme.primary }]}
              accessibilityLabel={isLast ? "Get started with voice" : "Next step"}
              accessibilityRole="button"
            >
              <ThemedText style={{ color: "#fff", fontWeight: "600" }}>
                {isLast ? "Get started" : "Next"}
              </ThemedText>
              {!isLast && (
                <Feather
                  name="arrow-right"
                  size={16}
                  color="#fff"
                  style={{ marginLeft: 6 }}
                />
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  hintText: {
    fontStyle: "italic",
  },
  counter: {
    marginBottom: Spacing.lg,
  },
  buttons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    width: "100%",
  },
  skipBtn: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
  },
  nextBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
});
