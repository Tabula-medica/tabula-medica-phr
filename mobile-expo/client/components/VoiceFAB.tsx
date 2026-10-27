/**
 * VoiceFAB — floating microphone button for voice navigation & form autofill.
 *
 * Usage:
 *   <VoiceFAB
 *     onFillField={(field, value) => { form.setValue(field, value); }}
 *     onConfirm={() => handleSubmit()}
 *     onCancel={() => setShowVoice(false)}
 *   />
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  Platform,
  Animated as RNAnimated,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { useVoiceNavigation } from "@/hooks/useVoiceNavigation";
import VoiceTutorial from "@/components/VoiceTutorial";

const VOICE_TUTORIAL_KEY = "@tabula_voice_tutorial_seen";

interface VoiceFABProps {
  onFillField?: (field: string, value: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onReadBack?: () => void;
  bottom?: number;
  right?: number;
  testID?: string;
}

export default function VoiceFAB({
  onFillField,
  onConfirm,
  onCancel,
  onReadBack,
  bottom,
  right = 20,
  testID = "voice-fab",
}: VoiceFABProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const feedbackOpacity = useRef(new RNAnimated.Value(0)).current;

  const {
    isRecording,
    isProcessing,
    pendingFill,
    lastResult,
    error,
    startRecording,
    stopRecording,
    applyPendingFill,
    cancelPendingFill,
    clearResult,
  } = useVoiceNavigation({ onFillField, onConfirm, onCancel, onReadBack });

  // Pulse animation when recording
  const pulseScale = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(1.0, { duration: 500, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1.0, { duration: 200 });
    }
  }, [isRecording]);

  // Show feedback pill on result or error
  useEffect(() => {
    const text =
      error ??
      (lastResult
        ? lastResult.intent === "FILL_FIELD"
          ? lastResult.ttsReadBack
          : lastResult.ttsReadBack
        : null);
    if (!text) return;
    setFeedbackText(text);
    RNAnimated.sequence([
      RNAnimated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      RNAnimated.delay(error ? 3000 : 2500),
      RNAnimated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFeedbackText(null);
      clearResult();
    });
  }, [lastResult, error]);

  // Check if tutorial has been seen
  useEffect(() => {
    AsyncStorage.getItem(VOICE_TUTORIAL_KEY)
      .then((v) => {
        if (!v) setShowTutorial(true);
        setTutorialChecked(true);
      })
      .catch(() => setTutorialChecked(true));
  }, []);

  const handleTutorialDone = useCallback(async () => {
    await AsyncStorage.setItem(VOICE_TUTORIAL_KEY, "true").catch(() => {});
    setShowTutorial(false);
  }, []);

  const handlePressIn = useCallback(() => {
    if (isProcessing) return;
    startRecording();
  }, [isProcessing, startRecording]);

  const handlePressOut = useCallback(() => {
    if (isRecording) stopRecording();
  }, [isRecording, stopRecording]);

  const fabBottom = bottom !== undefined ? bottom : insets.bottom + 80;

  const fabColor = isRecording
    ? "#E53E3E"
    : isProcessing
      ? theme.textSecondary
      : theme.primary;

  if (!tutorialChecked) return null;

  return (
    <>
      {/* Tutorial overlay on first use */}
      {showTutorial && <VoiceTutorial onDone={handleTutorialDone} />}

      {/* Pending-fill confirm/cancel bar — shown when FILL_FIELD is staged */}
      {pendingFill !== null && (
        <View
          style={[
            styles.pendingBar,
            {
              backgroundColor: theme.backgroundCard,
              borderColor: theme.primary,
              bottom: fabBottom + 64,
              right,
              left: right,
            },
          ]}
          accessibilityLiveRegion="assertive"
          accessibilityLabel={`Pending: set ${pendingFill.field} to ${pendingFill.value}. Say confirm to apply or cancel to discard.`}
        >
          <ThemedText
            type="caption"
            style={[styles.pendingLabel, { color: theme.text }]}
            numberOfLines={1}
          >
            Set {pendingFill.field}: {pendingFill.value}
          </ThemedText>
          <View style={styles.pendingActions}>
            <Pressable
              testID="voice-fab-confirm"
              onPress={applyPendingFill}
              accessibilityLabel="Confirm voice fill"
              accessibilityRole="button"
              style={[styles.pendingBtn, { backgroundColor: theme.primary }]}
            >
              <Feather name="check" size={14} color="#fff" />
            </Pressable>
            <Pressable
              testID="voice-fab-cancel"
              onPress={cancelPendingFill}
              accessibilityLabel="Cancel voice fill"
              accessibilityRole="button"
              style={[styles.pendingBtn, { backgroundColor: theme.textSecondary }]}
            >
              <Feather name="x" size={14} color="#fff" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Feedback pill (result / error) */}
      {feedbackText !== null && pendingFill === null && (
        <RNAnimated.View
          style={[
            styles.feedbackPill,
            {
              backgroundColor: theme.backgroundCard,
              borderColor: theme.border,
              bottom: fabBottom + 64,
              right,
              opacity: feedbackOpacity,
            },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={feedbackText}
        >
          <ThemedText type="caption" style={{ color: theme.text, flexShrink: 1 }}>
            {feedbackText}
          </ThemedText>
        </RNAnimated.View>
      )}

      {/* The FAB itself */}
      <Animated.View
        style={[styles.fabContainer, pulseStyle, { bottom: fabBottom, right }]}
      >
        <Pressable
          testID={testID}
          accessibilityLabel={
            isRecording
              ? "Release to send voice command"
              : isProcessing
                ? "Processing voice command"
                : pendingFill
                  ? "Listening — say confirm or cancel"
                  : "Hold to use voice commands"
          }
          accessibilityHint="Hold down to record a navigation or form-fill voice command"
          accessibilityRole="button"
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.fab, { backgroundColor: fabColor, shadowColor: fabColor }]}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Feather name="loader" size={22} color="#fff" />
          ) : pendingFill ? (
            <Feather name="alert-circle" size={22} color="#fff" />
          ) : (
            <Feather name="mic" size={22} color="#fff" />
          )}
        </Pressable>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: "absolute",
    zIndex: 999,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  feedbackPill: {
    position: "absolute",
    zIndex: 998,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  pendingBar: {
    position: "absolute",
    zIndex: 998,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 6,
  },
  pendingLabel: {
    flex: 1,
    marginRight: 8,
  },
  pendingActions: {
    flexDirection: "row",
    gap: 6,
  },
  pendingBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
});
