import { useCallback, useEffect, useRef, useState } from "react";

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
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const voiceSupported =
    typeof window !== "undefined" &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  const stopSpeaking = useCallback(() => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  const speakNow = useCallback(() => {
    if (!ttsSupported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  }, [ttsSupported, text, lang]);

  useEffect(() => {
    if (!enabled || !ttsSupported) return;
    speakNow();
    return () => {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [enabled, text, speakNow, ttsSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!voiceSupported) return;
    const Ctor: any =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = lang;
    rec.onresult = (e: any) => {
      const last = e.results?.[e.results.length - 1];
      const transcript = last?.[0]?.transcript;
      if (!transcript) return;
      const cmd = pickCommand(String(transcript));
      if (cmd && commandsRef.current?.[cmd]) {
        commandsRef.current[cmd]?.();
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  }, [voiceSupported, lang]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [ttsSupported]);

  return {
    speaking,
    listening,
    ttsSupported,
    voiceSupported,
    speakNow,
    stopSpeaking,
    startListening,
    stopListening,
  };
}
