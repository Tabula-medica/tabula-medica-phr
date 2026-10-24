import { useCallback, useEffect, useRef, useState } from "react";
import { phiSpeechAvailable, transcribePhiBlob } from "@/lib/phi-speech";

export interface PhiDictationHandlers {
  language?: string;
  maxMs?: number;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}

const UNAVAILABLE = "Voice input is unavailable. Type instead.";

/**
 * Records a short clip in the browser and sends it to Cloud Speech-to-Text.
 * Never constructs the browser speech recognizer. When the server flag is
 * off, `available` stays false and callers leave the text field in place.
 */
export function usePhiDictation() {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const handlersRef = useRef<PhiDictationHandlers | null>(null);
  const discardRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void phiSpeechAvailable().then((enabled) => {
      if (!cancelled) setAvailable(enabled);
    });
    return () => {
      cancelled = true;
      discardRef.current = true;
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    };
  }, []);

  const stop = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  const start = useCallback(
    async (handlers: PhiDictationHandlers) => {
      handlersRef.current = handlers;
      if (!available) {
        handlers.onError?.(UNAVAILABLE);
        return;
      }
      discardRef.current = false;
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
        const mimeType = preferred.find((type) => MediaRecorder.isTypeSupported(type));
        const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const chunks: Blob[] = [];
        const maxMs = handlers.maxMs ?? 30_000;
        const timer = window.setTimeout(() => {
          if (rec.state !== "inactive") rec.stop();
        }, maxMs);
        rec.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        rec.onstop = () => {
          window.clearTimeout(timer);
          stream?.getTracks().forEach((track) => track.stop());
          setListening(false);
          recorderRef.current = null;
          if (discardRef.current) return;
          const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
          if (blob.size === 0) {
            handlersRef.current?.onError?.(UNAVAILABLE);
            return;
          }
          void transcribePhiBlob(blob, handlersRef.current?.language).then((result) => {
            if (result.enabled) handlersRef.current?.onTranscript(result.transcript);
            else handlersRef.current?.onError?.(UNAVAILABLE);
          });
        };
        recorderRef.current = rec;
        rec.start();
        setListening(true);
      } catch {
        stream?.getTracks().forEach((track) => track.stop());
        setListening(false);
        handlers.onError?.(UNAVAILABLE);
      }
    },
    [available],
  );

  return { available, listening, start, stop };
}
