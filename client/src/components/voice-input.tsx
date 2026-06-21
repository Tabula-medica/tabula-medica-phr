import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface VoiceInputProps {
  onResult: (text: string) => void;
  language?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

const LANG_MAP: Record<string, string> = {
  en: "en-US", es: "es-ES", "zh-mandarin": "zh-CN", fr: "fr-FR",
  ko: "ko-KR", hi: "hi-IN", bn: "bn-BD", ta: "ta-IN", te: "te-IN",
  ur: "ur-PK", sw: "sw-KE", am: "am-ET", pt: "pt-BR", vi: "vi-VN",
  ar: "ar-SA", tl: "tl-PH",
};

export function VoiceInput({ onResult, language = "en", label = "Voice input", disabled = false, className = "" }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = LANG_MAP[language] || "en-US";
    recognition.maxAlternatives = 1;
    finalTranscriptRef.current = "";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      finalTranscriptRef.current = transcript;
      onResult(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [language, onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      variant={isListening ? "destructive" : "outline"}
      size="icon"
      onClick={isListening ? stopListening : startListening}
      disabled={disabled}
      className={`shrink-0 h-9 w-9 ${className}`}
      aria-label={isListening ? "Stop voice input" : label}
      aria-pressed={isListening}
      data-testid="button-voice-input"
      title={isListening ? "Recording... Click to stop" : label}
    >
      {isListening ? (
        <MicOff className="w-4 h-4 animate-pulse" aria-hidden="true" />
      ) : (
        <Mic className="w-4 h-4" aria-hidden="true" />
      )}
    </Button>
  );
}

interface VoiceInputFieldProps {
  value: string;
  onChange: (val: string) => void;
  language?: string;
  placeholder?: string;
  label?: string;
  inputId?: string;
  "data-testid"?: string;
}

export function VoiceInputField({ value, onChange, language = "en", placeholder, label, inputId, ...rest }: VoiceInputFieldProps) {
  return (
    <div className="flex gap-1 items-center">
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        data-testid={rest["data-testid"]}
      />
      <VoiceInput
        onResult={(text) => onChange(value ? `${value} ${text}` : text)}
        language={language}
        label={`Voice input for ${label || placeholder || "field"}`}
      />
    </div>
  );
}
