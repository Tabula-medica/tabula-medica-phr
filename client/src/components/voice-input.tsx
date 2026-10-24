import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { usePhiDictation } from "@/hooks/use-phi-dictation";

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
  const dictation = usePhiDictation();
  const [submitting, setSubmitting] = useState(false);

  const startListening = useCallback(() => {
    setSubmitting(false);
    void dictation.start({
      language: LANG_MAP[language] || "en-US",
      onTranscript: (text) => {
        setSubmitting(false);
        if (text.trim()) onResult(text);
      },
      onError: () => setSubmitting(false),
    });
  }, [dictation, language, onResult]);

  const stopListening = useCallback(() => {
    dictation.stop();
    setSubmitting(true);
  }, [dictation]);

  if (!dictation.available) return null;

  const busy = dictation.listening || submitting;

  return (
    <Button
      type="button"
      variant={dictation.listening ? "destructive" : "outline"}
      size="icon"
      onClick={dictation.listening ? stopListening : startListening}
      disabled={disabled || (submitting && !dictation.listening)}
      className={`shrink-0 h-9 w-9 ${className}`}
      aria-label={dictation.listening ? "Stop voice input" : label}
      aria-pressed={dictation.listening}
      data-testid="button-voice-input"
      title={dictation.listening ? "Recording... Click to stop" : label}
    >
      {busy && !dictation.listening ? (
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : dictation.listening ? (
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
