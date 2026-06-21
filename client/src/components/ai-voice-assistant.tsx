import { useState, useCallback, useRef, useEffect } from "react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLanguage, SUPPORTED_LANGUAGES } from "./language-provider";
import { cn } from "@/lib/utils";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Globe,
  MessageSquare,
  AlertTriangle,
  Check,
} from "lucide-react";

interface AIVoiceAssistantProps {
  userId?: string;
  onTranscript?: (text: string, language: string) => void;
  onAIResponse?: (text: string) => void;
  compact?: boolean;
  className?: string;
}

interface VoiceResponse {
  success: boolean;
  transcript?: string;
  response?: string;
  language?: string;
  audioUrl?: string;
}

const LANGUAGE_TO_SPEECH_CODE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
  hi: "hi-IN",
  ar: "ar-SA",
  pt: "pt-BR",
  bn: "bn-BD",
  ru: "ru-RU",
  ja: "ja-JP",
  pa: "pa-IN",
  de: "de-DE",
  ko: "ko-KR",
  fr: "fr-FR",
  vi: "vi-VN",
  tl: "fil-PH",
  it: "it-IT",
};

export function AIVoiceAssistant({
  userId = "current-user",
  onTranscript,
  onAIResponse,
  compact = false,
  className,
}: AIVoiceAssistantProps) {
  const { language, languageInfo, t } = useLanguage();
  const { toast } = useToast();

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAIResponse] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== "undefined" && 
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const processVoiceCommand = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/voice-navigation/process", {
        userId,
        command: text,
        language,
      });
      return response.json() as Promise<{
        success: boolean;
        response: string;
        action?: { type: string; target?: string };
      }>;
    },
    onSuccess: (data) => {
      if (data.success && data.response) {
        const disclaimer = t("disclaimer.noMedicalAdvice");
        const responseWithDisclaimer = data.response + ". " + disclaimer;
        setAIResponse(data.response);
        onAIResponse?.(data.response);
        if (!isMuted) {
          speakResponse(responseWithDisclaimer);
        }
      }
    },
    onError: () => {
      setError(t("common.error"));
      toast({
        title: t("common.error"),
        description: t("voice.processing") + " " + t("common.error"),
        variant: "destructive",
      });
    },
  });

  const isProcessing = processVoiceCommand.isPending;

  const initRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = LANGUAGE_TO_SPEECH_CODE[language] || "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript("");
    };

    recognition.onresult = (event: any) => {
      const results = Array.from(event.results) as any[];
      const transcript = results
        .map((result: any) => result[0].transcript)
        .join("");
      setTranscript(transcript);

      if (results.some((result: any) => result.isFinal)) {
        onTranscript?.(transcript, language);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== "aborted") {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcript) {
        processVoiceCommand.mutate(transcript);
      }
    };

    return recognition;
  }, [language, isSupported, transcript, onTranscript, processVoiceCommand]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    recognitionRef.current = initRecognition();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        setError("Failed to start speech recognition");
      }
    }
  }, [isSupported, initRecognition, toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const speakResponse = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_TO_SPEECH_CODE[language] || "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const langCode = LANGUAGE_TO_SPEECH_CODE[language] || "en-US";
    const voice = voices.find((v) => v.lang.startsWith(langCode.split("-")[0]));
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
    }
    setIsMuted(!isMuted);
  }, [isMuted, isSpeaking, stopSpeaking]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = LANGUAGE_TO_SPEECH_CODE[language] || "en-US";
    }
  }, [language]);

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2", className)} data-testid="ai-voice-assistant-compact">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={isListening ? "destructive" : "outline"}
              onClick={isListening ? stopListening : startListening}
              disabled={!isSupported || processVoiceCommand.isPending}
              data-testid="button-voice-compact"
            >
              {processVoiceCommand.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isListening ? (
                <Mic className="h-4 w-4" />
              ) : (
                <MicOff className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isListening ? t("voice.listening") : t("voice.speak")}
          </TooltipContent>
        </Tooltip>

        <Badge variant="secondary" className="text-xs">
          <Globe className="h-3 w-3 mr-1" />
          {languageInfo.code.toUpperCase()}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn("", className)} data-testid="ai-voice-assistant">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            AI Voice Assistant
          </div>
          <Badge variant="outline" className="text-xs">
            <Globe className="h-3 w-3 mr-1" />
            {languageInfo.nativeName}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Button
            size="lg"
            variant={isListening ? "destructive" : "default"}
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported || processVoiceCommand.isPending}
            className="gap-2"
            data-testid="button-voice-main"
          >
            {processVoiceCommand.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("voice.processing")}
              </>
            ) : isListening ? (
              <>
                <Mic className="h-5 w-5" />
                {t("voice.listening")}
              </>
            ) : (
              <>
                <MicOff className="h-5 w-5" />
                {t("voice.speak")}
              </>
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isMuted ? "outline" : "secondary"}
                onClick={toggleMute}
                data-testid="button-voice-mute"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isMuted ? "Unmute AI responses" : "Mute AI responses"}
            </TooltipContent>
          </Tooltip>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-md text-sm" data-testid="text-voice-error">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {transcript && (
          <div className="p-3 bg-muted rounded-md" data-testid="text-transcript">
            <p className="text-xs text-muted-foreground mb-1">You said:</p>
            <p className="text-sm">{transcript}</p>
          </div>
        )}

        {aiResponse && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md" data-testid="text-ai-response">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">AI Response:</p>
              {isSpeaking && (
                <Badge variant="secondary" className="text-[10px]">Speaking...</Badge>
              )}
            </div>
            <p className="text-sm">{aiResponse}</p>
          </div>
        )}

        {!isSupported && (
          <div className="p-3 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-md text-sm" data-testid="text-not-supported">
            <AlertTriangle className="h-4 w-4 inline mr-2" />
            Speech recognition is not supported in this browser. Try using Chrome, Edge, or Safari.
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {t("disclaimer.noMedicalAdvice")}
        </p>
      </CardContent>
    </Card>
  );
}
