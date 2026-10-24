import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { speakPhiText } from "@/lib/phi-speech";
import { usePhiDictation } from "@/hooks/use-phi-dictation";

type SupportedLanguage = "en" | "es" | "zh" | "hi" | "ar" | "pt" | "bn" | "ru" | "ja" | "pa" | "de" | "ko" | "fr" | "vi" | "tl" | "it";

interface VoiceNavigationSettings {
  userId: string;
  primaryLanguage: SupportedLanguage;
  voiceEnabled: boolean;
  speechRate: "slow" | "normal" | "fast";
  voiceType: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  continuousListening: boolean;
  wakeWord: string;
  screenReaderOptimized: boolean;
  simplifiedResponses: boolean;
  confirmBeforeNavigation: boolean;
}

interface VoiceResponse {
  id: string;
  commandId: string;
  responseText: string;
  translatedText?: string;
  targetLanguage?: SupportedLanguage;
  audioBase64?: string;
  navigation?: {
    route: string;
    description: string;
  };
  actionPerformed?: string;
  requiresConfirmation?: boolean;
  followUpPrompt?: string;
  noCdsDisclaimer?: string;
}

interface UseVoiceNavigationOptions {
  userId: string;
  language?: SupportedLanguage;
  onNavigate?: (route: string) => void;
  onResponse?: (response: VoiceResponse) => void;
  onError?: (error: string) => void;
}

interface UseVoiceNavigationReturn {
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  lastResponse: VoiceResponse | null;
  settings: VoiceNavigationSettings | null;
  startListening: () => void;
  stopListening: () => void;
  processCommand: (text: string) => Promise<void>;
  speak: (text: string) => void;
  updateSettings: (updates: Partial<VoiceNavigationSettings>) => Promise<void>;
  error: string | null;
  isSupported: boolean;
}

export function useVoiceNavigation(options: UseVoiceNavigationOptions): UseVoiceNavigationReturn {
  const { userId, language = "en", onNavigate, onResponse, onError } = options;

  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState<VoiceResponse | null>(null);
  const [settings, setSettings] = useState<VoiceNavigationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const dictation = usePhiDictation();
  const isSupported = dictation.available;
  const processCommandRef = useRef<(text: string) => Promise<void>>(async () => {});
  const speakRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    const initSettings = async () => {
      try {
        const res = await fetch("/api/voice-navigation/settings/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, language }),
        });
        const data = await res.json();
        if (data.success) {
          setSettings(data.data);
        }
      } catch (err) {
        console.error("Failed to init voice settings:", err);
      }
    };

    if (userId) {
      initSettings();
    }
  }, [userId, language]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError("Voice input is unavailable. Type a command instead.");
      return;
    }

    setError(null);
    setTranscript("");

    void dictation.start({
      language: language === "en" ? "en-US" : language,
      maxMs: 12_000,
      onTranscript: (text) => {
        setTranscript(text);
        void processCommandRef.current(text);
      },
      onError: (message) => {
        setError(message);
        onError?.(message);
      },
    });
  }, [isSupported, dictation, language, onError]);

  const stopListening = useCallback(() => {
    dictation.stop();
  }, [dictation]);

  const processCommand = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/voice-navigation/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          transcript: text,
          language,
        }),
      });

      const data = await res.json();

      if (data.success) {
        const response: VoiceResponse = data.data;
        setLastResponse(response);
        onResponse?.(response);

        if (response.responseText) {
          speakRef.current(response.responseText);
        }

        if (response.navigation && !response.requiresConfirmation) {
          setTimeout(() => {
            if (onNavigate) {
              onNavigate(response.navigation!.route);
            } else {
              setLocation(response.navigation!.route);
            }
          }, 500);
        }
      } else {
        throw new Error(data.error || "Failed to process command");
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to process voice command";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [userId, language, onNavigate, onResponse, onError, setLocation]);

  processCommandRef.current = processCommand;

  const speak = useCallback((text: string) => {
    const rate = settings?.speechRate === "slow" ? 0.8 : settings?.speechRate === "fast" ? 1.2 : 1;
    void speakPhiText(text, { lang: language === "en" ? "en-US" : language, rate });
  }, [language, settings?.speechRate]);
  speakRef.current = speak;

  const updateSettings = useCallback(async (updates: Partial<VoiceNavigationSettings>) => {
    try {
      const res = await fetch(`/api/voice-navigation/settings/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (err) {
      console.error("Failed to update voice settings:", err);
    }
  }, [userId]);

  return {
    isListening: dictation.listening,
    isProcessing,
    transcript,
    lastResponse,
    settings,
    startListening,
    stopListening,
    processCommand,
    speak,
    updateSettings,
    error,
    isSupported,
  };
}

export default useVoiceNavigation;
