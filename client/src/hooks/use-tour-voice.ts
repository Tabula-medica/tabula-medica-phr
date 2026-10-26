import { useCallback, useEffect, useRef, useState } from "react";
import { cancelPhiSpeech, speakPhiText } from "@/lib/phi-speech";
import { usePhiDictation } from "@/hooks/use-phi-dictation";

type CommandHandlers = {
  onNext?: () => void;
  onBack?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  onRepeat?: () => void;
};

export interface UseTourVoiceOptions {
  text: string;
  enabled: boolean;
  lang?: string;
  commands?: CommandHandlers;
}

export interface UseTourVoiceReturn {
  speaking: boolean;
  listening: boolean;
  ttsSupported: boolean;
  voiceSupported: boolean;
  speakNow: () => void;
  stopSpeaking: () => void;
  startListening: () => void;
  stopListening: () => void;
}

const COMMAND_MAP: Array<{ keywords: string[]; key: keyof CommandHandlers }> = [
  { keywords: ["next", "continue", "forward"], key: "onNext" },
  { keywords: ["back", "previous", "go back"], key: "onBack" },
  { keywords: ["skip", "cancel"], key: "onSkip" },
  { keywords: ["close", "exit", "stop tour", "done"], key: "onClose" },
  { keywords: ["repeat", "again", "say again"], key: "onRepeat" },
];

function pickCommand(transcript: string): keyof CommandHandlers | null {
  const t = transcript.toLowerCase().trim();
  for (const { keywords, key } of COMMAND_MAP) {
    if (keywords.some((k) => t === k || t.includes(k))) return key;
  }
  return null;
}

export function useTourVoice({
  text,
  enabled,
  lang = "en-US",
  commands,
}: UseTourVoiceOptions): UseTourVoiceReturn {
  const [speaking, setSpeaking] = useState(false);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;
  const dictation = usePhiDictation();

  const stopSpeaking = useCallback(() => {
    cancelPhiSpeech();
    setSpeaking(false);
  }, []);

  const speakNow = useCallback(() => {
    if (!text) return;
    cancelPhiSpeech();
    setSpeaking(true);
    void speakPhiText(text, {
      lang,
      rate: 1,
      onEnd: () => setSpeaking(false),
    });
  }, [text, lang]);

  useEffect(() => {
    if (!enabled) return;
    speakNow();
    return () => {
      cancelPhiSpeech();
      setSpeaking(false);
    };
  }, [enabled, text, speakNow]);

  const stopListening = useCallback(() => {
    dictation.stop();
  }, [dictation]);

  const startListening = useCallback(() => {
    if (!dictation.available) return;
    void dictation.start({
      language: lang,
      maxMs: 8_000,
      onTranscript: (transcript) => {
        const cmd = pickCommand(transcript);
        if (cmd && commandsRef.current?.[cmd]) commandsRef.current[cmd]?.();
      },
    });
  }, [dictation, lang]);

  useEffect(() => () => {
    cancelPhiSpeech();
  }, []);

  return {
    speaking,
    listening: dictation.listening,
    ttsSupported: true,
    voiceSupported: dictation.available,
    speakNow,
    stopSpeaking,
    startListening,
    stopListening,
  };
}
