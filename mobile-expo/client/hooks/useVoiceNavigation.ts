import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system";
import {
  useAudioRecorder,
  requestRecordingPermissionsAsync,
  IOSOutputFormat,
  AudioQuality,
} from "expo-audio";
import { useNavigation } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";

/**
 * Custom recording preset chosen for GCP Medical Speech API compatibility.
 *
 * iOS  → Linear PCM (.wav)  → server encoding "LINEAR16"  (GCP native)
 * Android → AMR-NB (.3gp)  → server encoding "AMR"        (GCP native)
 * Web  → handled by SpeechRecognition in useWebVoice; this preset not used
 *
 * RecordingPresets.HIGH_QUALITY produces AAC/M4A which GCP does not accept.
 */
const VOICE_COMMAND_PRESET = {
  extension: ".wav",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 256000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: ".3gp",
    outputFormat: "3gp",
    audioEncoder: "amr_nb",
    sampleRate: 8000,
    numberOfChannels: 1,
    bitRate: 12200,
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 128000,
  },
};

/**
 * GCP encoding value that matches the VOICE_COMMAND_PRESET output per platform.
 * Passed to /api/voice/command so transcribeMedicalAudio uses the correct codec.
 */
const GCP_VOICE_ENCODING = Platform.select({
  ios: "LINEAR16",
  android: "AMR",
  default: "WEBM_OPUS",
}) as string;

export type VoiceIntent =
  | "NAVIGATE"
  | "FILL_FIELD"
  | "CONFIRM"
  | "CANCEL"
  | "READ_BACK"
  | "HELP"
  | "UNKNOWN";

export interface VoiceCommandResult {
  intent: VoiceIntent;
  entities: Record<string, string>;
  confidence: number;
  transcript: string;
  ttsReadBack: string;
}

export interface PendingFill {
  field: string;
  value: string;
}

export interface UseVoiceNavigationOptions {
  onFillField?: (field: string, value: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onReadBack?: () => void;
  ttsEnabled?: boolean;
}

export interface UseVoiceNavigationReturn {
  isRecording: boolean;
  isProcessing: boolean;
  pendingFill: PendingFill | null;
  lastResult: VoiceCommandResult | null;
  error: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  submitTranscript: (transcript: string) => Promise<void>;
  applyPendingFill: () => void;
  cancelPendingFill: () => void;
  speak: (text: string) => void;
  clearResult: () => void;
}

/**
 * Screen navigation map: screenKey (returned by intent classifier)
 * → { screen, params } for React Navigation.
 */
const SCREEN_NAVIGATE_MAP: Record<
  string,
  { screen: string; params?: Record<string, unknown> }
> = {
  HOME: { screen: "Main" },
  RECORDS: { screen: "Main", params: { screen: "RecordsTab" } },
  LAB_RESULTS: { screen: "Main", params: { screen: "RecordsTab" } },
  MEDICATIONS: { screen: "Main", params: { screen: "RecordsTab" } },
  TIMELINE: { screen: "Main", params: { screen: "TimelineTab" } },
  APPOINTMENTS: { screen: "Main", params: { screen: "TimelineTab" } },
  PROFILE: { screen: "Main", params: { screen: "ProfileTab" } },
  AI_ASSISTANT: { screen: "AIAssistant" },
  HEALTH_SUMMARY: { screen: "AIAssistant" },
  PROVIDER_SHARE: { screen: "ProviderShareSummary" },
  PRE_VISIT_PREP: { screen: "PreVisitChartPrep" },
  ADD_SOURCE: { screen: "AddSource" },
};

export function useVoiceNavigation(
  options: UseVoiceNavigationOptions = {}
): UseVoiceNavigationReturn {
  const {
    onFillField,
    onConfirm,
    onCancel,
    onReadBack,
    ttsEnabled = true,
  } = options;

  const navigation = useNavigation<any>();

  // Always call useAudioRecorder at hook top level (React hook rules).
  // On web this is a no-op stub; recording functions guard with Platform.OS check.
  // Cast to `any` so the custom per-platform preset satisfies the generic
  // RecordingOptions type that useAudioRecorder expects.
  const recorder = useAudioRecorder(VOICE_COMMAND_PRESET as any);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Staged fill: set on FILL_FIELD intent, applied only on CONFIRM
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const pendingFillRef = useRef<PendingFill | null>(null);
  // Auto-cancel timer if user doesn't confirm/cancel within 30 s
  const pendingFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || Platform.OS === "web") return;
      Speech.stop();
      Speech.speak(text, { language: "en-US", rate: 0.95, pitch: 1.0 });
    },
    [ttsEnabled]
  );

  const clearPendingFillTimer = useCallback(() => {
    if (pendingFillTimerRef.current) {
      clearTimeout(pendingFillTimerRef.current);
      pendingFillTimerRef.current = null;
    }
  }, []);

  const setStagedFill = useCallback(
    (fill: PendingFill | null) => {
      pendingFillRef.current = fill;
      setPendingFill(fill);
      clearPendingFillTimer();
      if (fill) {
        // Auto-cancel after 30 s if no CONFIRM/CANCEL received
        pendingFillTimerRef.current = setTimeout(() => {
          pendingFillRef.current = null;
          setPendingFill(null);
          speak("Voice fill cancelled — no confirmation received.");
        }, 30_000);
      }
    },
    [clearPendingFillTimer, speak]
  );

  const applyPendingFill = useCallback(() => {
    const fill = pendingFillRef.current;
    if (!fill) return;
    onFillField?.(fill.field, fill.value);
    setStagedFill(null);
    speak("Applied.");
  }, [onFillField, setStagedFill, speak]);

  const cancelPendingFill = useCallback(() => {
    setStagedFill(null);
    speak("Cancelled.");
  }, [setStagedFill, speak]);

  const dispatchAction = useCallback(
    (result: VoiceCommandResult) => {
      const { intent, entities } = result;

      switch (intent) {
        case "NAVIGATE": {
          const key = (entities as any).screenKey as string;
          if (key === "BACK") {
            navigation.goBack();
          } else if (SCREEN_NAVIGATE_MAP[key]) {
            const { screen, params } = SCREEN_NAVIGATE_MAP[key];
            navigation.navigate(screen as never, params as never);
          }
          break;
        }
        case "FILL_FIELD": {
          const field = (entities as any).field as string;
          const value = (entities as any).value as string;
          if (field && value !== undefined) {
            // Stage the fill — only apply on CONFIRM
            setStagedFill({ field, value });
          }
          break;
        }
        case "CONFIRM": {
          const fill = pendingFillRef.current;
          if (fill) {
            onFillField?.(fill.field, fill.value);
            setStagedFill(null);
          } else {
            onConfirm?.();
          }
          break;
        }
        case "CANCEL": {
          if (pendingFillRef.current) {
            setStagedFill(null);
          } else {
            onCancel?.();
          }
          break;
        }
        case "READ_BACK":
          onReadBack?.();
          break;
        default:
          break;
      }
    },
    [navigation, onFillField, onConfirm, onCancel, onReadBack, setStagedFill]
  );

  const processServerResponse = useCallback(
    async (body: object) => {
      // apiRequest automatically attaches Authorization + x-user-id headers
      // and throws on non-2xx responses.
      const resp = await apiRequest("POST", "/api/voice/command", body);
      const data: VoiceCommandResult = await resp.json();
      setLastResult(data);
      speak(data.ttsReadBack);
      dispatchAction(data);
    },
    [speak, dispatchAction]
  );

  const submitTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim()) return;
      setIsProcessing(true);
      setError(null);
      try {
        await processServerResponse({ transcript });
      } catch {
        const msg = "Voice command failed. Please try again.";
        setError(msg);
        speak(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [processServerResponse, speak]
  );

  const startRecording = useCallback(async () => {
    if (Platform.OS === "web") return;
    setError(null);
    try {
      const { status } = await requestRecordingPermissionsAsync();
      if (status !== "granted") {
        const msg = "Microphone permission is required for voice commands.";
        setError(msg);
        speak(msg);
        return;
      }
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      speak("Listening.");
    } catch {
      const msg = "Could not start recording. Please try again.";
      setError(msg);
      speak(msg);
    }
  }, [recorder, speak]);

  const stopRecording = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    setIsProcessing(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("No recording URI after stop");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await processServerResponse({ audioBase64: base64, encoding: GCP_VOICE_ENCODING });

      // Clean up temp file
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    } catch (e: any) {
      const msg = "Could not process voice command. Please try again.";
      setError(msg);
      speak(msg);
    } finally {
      setIsProcessing(false);
    }
  }, [isRecording, recorder, processServerResponse, speak]);

  const clearResult = useCallback(() => {
    setLastResult(null);
    setError(null);
  }, []);

  return {
    isRecording,
    isProcessing,
    pendingFill,
    lastResult,
    error,
    startRecording,
    stopRecording,
    submitTranscript,
    applyPendingFill,
    cancelPendingFill,
    speak,
    clearResult,
  };
}
