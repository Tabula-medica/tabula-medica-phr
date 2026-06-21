import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";

type SupportedLanguage = "en" | "es" | "zh" | "hi" | "ar" | "pt" | "bn" | "ru" | "ja" | "pa" | "de" | "ko" | "fr" | "vi" | "tl" | "it";

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventData {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorData {
  readonly error: string;
  readonly message: string;
}

interface WebkitSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventData) => void) | null;
  onerror: ((event: SpeechRecognitionErrorData) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

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

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState<VoiceResponse | null>(null);
  const [settings, setSettings] = useState<VoiceNavigationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [, setLocation] = useLocation();
  const recognitionRef = useRef<WebkitSpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

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

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition: WebkitSpeechRecognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language === "en" ? "en-US" : language;

    recognition.onresult = (event: SpeechRecognitionEventData) => {
      const results = event.results;
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        if (lastResult && lastResult[0]) {
          setTranscript(lastResult[0].transcript);
          if (lastResult.isFinal) {
            processCommand(lastResult[0].transcript);
          }
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorData) => {
      const errorMsg = `Speech recognition error: ${event.error}`;
      setError(errorMsg);
      setIsListening(false);
      onError?.(errorMsg);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  }, [isSupported, language]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    setError(null);
    setTranscript("");
    setIsListening(true);

    try {
      recognitionRef.current.start();
    } catch (err) {
      setIsListening(false);
      setError("Failed to start speech recognition");
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

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
          speak(response.responseText);
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
    } catch (err: any) {
      const errorMsg = err.message || "Failed to process voice command";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [userId, language, onNavigate, onResponse, onError, setLocation]);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "en" ? "en-US" : language;

    const rate = settings?.speechRate === "slow" ? 0.8 : settings?.speechRate === "fast" ? 1.2 : 1;
    utterance.rate = rate;

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language, settings?.speechRate]);

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
    isListening,
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
