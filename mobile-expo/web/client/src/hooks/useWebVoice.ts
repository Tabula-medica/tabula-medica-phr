/**
 * useWebVoice — browser SpeechRecognition-based voice command hook for web.
 *
 * Mirrors the intent dispatch API of the mobile useVoiceNavigation hook so
 * shared logic (onFillField, onConfirm, onCancel) can be used uniformly.
 *
 * FILL_FIELD intents are staged (pendingFill) and only applied after a
 * subsequent CONFIRM command or an explicit applyPendingFill() call.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

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

export interface UseWebVoiceOptions {
  onFillField?: (field: string, value: string) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onNavigate?: (screenKey: string) => void;
  ttsEnabled?: boolean;
  continuous?: boolean;
}

export interface UseWebVoiceReturn {
  isListening: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  pendingFill: PendingFill | null;
  lastResult: VoiceCommandResult | null;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  applyPendingFill: () => void;
  cancelPendingFill: () => void;
  clearResult: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }
}

const WEB_SCREEN_MAP: Record<string, string> = {
  HOME: "/",
  RECORDS: "/records",
  LAB_RESULTS: "/records",
  MEDICATIONS: "/records",
  TIMELINE: "/timeline",
  APPOINTMENTS: "/timeline",
  PROFILE: "/profile",
  AI_ASSISTANT: "/patient-assistant",
  HEALTH_SUMMARY: "/patient-assistant",
};

export function useWebVoice(options: UseWebVoiceOptions = {}): UseWebVoiceReturn {
  const {
    onFillField,
    onConfirm,
    onCancel,
    onNavigate,
    ttsEnabled = true,
    continuous = false,
  } = options;

  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;

  const isSupported = !!SpeechRecognitionClass;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<VoiceCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stage-and-confirm: FILL_FIELD is held here until CONFIRM or applyPendingFill()
  const [pendingFill, setPendingFill] = useState<PendingFill | null>(null);
  const pendingFillRef = useRef<PendingFill | null>(null);
  const pendingFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recognizerRef = useRef<SpeechRecognition | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = "en-US";
      utt.rate = 0.95;
      window.speechSynthesis.speak(utt);
    },
    [ttsEnabled]
  );

  const clearPendingTimer = useCallback(() => {
    if (pendingFillTimerRef.current) {
      clearTimeout(pendingFillTimerRef.current);
      pendingFillTimerRef.current = null;
    }
  }, []);

  const setStagedFill = useCallback(
    (fill: PendingFill | null) => {
      pendingFillRef.current = fill;
      setPendingFill(fill);
      clearPendingTimer();
      if (fill) {
        // Auto-cancel after 30 s if user doesn't confirm
        pendingFillTimerRef.current = setTimeout(() => {
          pendingFillRef.current = null;
          setPendingFill(null);
          speak("Voice fill cancelled — no confirmation received.");
        }, 30_000);
      }
    },
    [clearPendingTimer, speak]
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

  const sendToServer = useCallback(
    async (transcript: string) => {
      setIsProcessing(true);
      setError(null);
      try {
        const resp = await apiRequest("POST", "/api/voice/command", { transcript });
        if (!resp.ok) throw new Error(`Server ${resp.status}`);
        const data: VoiceCommandResult = await resp.json();
        setLastResult(data);
        speak(data.ttsReadBack);

        switch (data.intent) {
          case "FILL_FIELD": {
            const field = (data.entities as any).field as string;
            const value = (data.entities as any).value as string;
            if (field && value !== undefined) {
              // Stage — do NOT apply immediately; wait for CONFIRM
              setStagedFill({ field, value });
            }
            break;
          }
          case "CONFIRM": {
            if (pendingFillRef.current) {
              onFillField?.(pendingFillRef.current.field, pendingFillRef.current.value);
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
          case "NAVIGATE": {
            const key = (data.entities as any).screenKey as string;
            if (onNavigate) {
              onNavigate(key);
            } else if (key === "BACK") {
              window.history.back();
            } else if (WEB_SCREEN_MAP[key]) {
              window.location.href = WEB_SCREEN_MAP[key];
            }
            break;
          }
        }
      } catch {
        const msg = "Voice command failed. Please try again.";
        setError(msg);
        speak(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [speak, setStagedFill, onFillField, onConfirm, onCancel, onNavigate]
  );

  const startListening = useCallback(() => {
    if (!SpeechRecognitionClass || isListening) return;
    setError(null);

    const recognizer = new SpeechRecognitionClass();
    recognizer.lang = "en-US";
    recognizer.interimResults = false;
    recognizer.maxAlternatives = 1;
    recognizer.continuous = continuous;

    recognizer.onstart = () => setIsListening(true);
    recognizer.onend = () => setIsListening(false);
    recognizer.onerror = (e: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      if (e.error !== "no-speech") {
        setError("Speech recognition error. Please try again.");
      }
    };
    recognizer.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) sendToServer(transcript.trim());
    };

    recognizer.start();
    recognizerRef.current = recognizer;
  }, [SpeechRecognitionClass, isListening, continuous, sendToServer]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    recognizerRef.current = null;
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognizerRef.current?.abort();
      window.speechSynthesis?.cancel();
      clearPendingTimer();
    };
  }, [clearPendingTimer]);

  const clearResult = useCallback(() => {
    setLastResult(null);
    setError(null);
  }, []);

  return {
    isListening,
    isProcessing,
    isSupported,
    pendingFill,
    lastResult,
    error,
    startListening,
    stopListening,
    applyPendingFill,
    cancelPendingFill,
    clearResult,
  };
}
