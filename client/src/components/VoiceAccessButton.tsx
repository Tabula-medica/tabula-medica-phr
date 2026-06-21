import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { Mic, MicOff, Loader2, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type VoiceState = "idle" | "recording" | "processing" | "speaking";

export function VoiceAccessButton() {
  const [state, setState] = useState<VoiceState>("idle");
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [language, setLanguage] = useState("en");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const browserLang = navigator.language.split("-")[0];
    setLanguage(browserLang);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      
      const recorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      setState("recording");
      setTranscript("");
      setResponse("");
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice features.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    return btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );
  };

  const playAudio = useCallback((base64Audio: string, autoClose = false) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioRef.current = audio;
    setState("speaking");
    
    audio.onended = () => {
      setState("idle");
      if (autoClose) {
        setTimeout(() => {
          setIsOpen(false);
          setTranscript("");
          setResponse("");
        }, 1500);
      }
    };
    
    audio.onerror = () => {
      setState("idle");
    };
    
    audio.play().catch(() => {
      setState("idle");
    });
  }, []);

  const processVoiceCommand = useCallback(async () => {
    setState("processing");
    
    try {
      const blob = await stopRecording();
      
      if (blob.size === 0) {
        setState("idle");
        return;
      }

      const base64Audio = await blobToBase64(blob);
      
      const res = await fetch("/api/voice/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          audio: base64Audio, 
          format: "webm",
          language 
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to process voice command");
      }

      const data = await res.json();
      
      setTranscript(data.transcript);
      setResponse(data.response);
      
      if (data.navigation) {
        setLocation(data.navigation);
        toast({
          title: "Navigating",
          description: `Going to ${data.navigation}`,
        });
        setTimeout(() => {
          setIsOpen(false);
          setState("idle");
        }, 1500);
      }
      
      if (data.audio) {
        playAudio(data.audio, !data.navigation);
      } else {
        setState("idle");
      }
    } catch (error) {
      console.error("Voice command error:", error);
      toast({
        title: "Voice Error",
        description: "Failed to process your voice command. Please try again.",
        variant: "destructive",
      });
      setState("idle");
    }
  }, [stopRecording, setLocation, toast, playAudio, language]);

  const handleVoiceButton = useCallback(() => {
    if (state === "idle") {
      setIsOpen(true);
      startRecording();
    } else if (state === "recording") {
      processVoiceCommand();
    } else if (state === "speaking") {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setState("idle");
    }
  }, [state, startRecording, processVoiceCommand]);

  const handleClose = useCallback(() => {
    if (state === "recording") {
      stopRecording();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
    setIsOpen(false);
    setTranscript("");
    setResponse("");
  }, [state, stopRecording]);

  const getButtonIcon = () => {
    switch (state) {
      case "recording":
        return <MicOff className="h-4 w-4" />;
      case "processing":
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case "speaking":
        return <Volume2 className="h-4 w-4" />;
      default:
        return <Mic className="h-4 w-4" />;
    }
  };

  const getDialogButtonIcon = () => {
    switch (state) {
      case "recording":
        return <MicOff className="h-6 w-6" />;
      case "processing":
        return <Loader2 className="h-6 w-6 animate-spin" />;
      case "speaking":
        return <Volume2 className="h-6 w-6" />;
      default:
        return <Mic className="h-6 w-6" />;
    }
  };

  const getStatusText = () => {
    switch (state) {
      case "recording":
        return "Listening... Tap to stop";
      case "processing":
        return "Processing your request...";
      case "speaking":
        return "Speaking...";
      default:
        return "Tap the microphone to speak";
    }
  };

  return (
    <>
      <Button
        size="icon"
        variant={state === "recording" ? "destructive" : "ghost"}
        onClick={handleVoiceButton}
        className={state === "recording" ? "animate-pulse" : ""}
        data-testid="button-voice-access"
        aria-label="Voice access"
      >
        {getButtonIcon()}
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Access
            </DialogTitle>
            <DialogDescription>
              Speak naturally to navigate, get explanations, or read your health data.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-6">
            <div className="relative flex items-center justify-center">
              <Button
                size="lg"
                variant={state === "recording" ? "destructive" : "default"}
                onClick={handleVoiceButton}
                disabled={state === "processing"}
                data-testid="button-voice-record"
              >
                {getDialogButtonIcon()}
                <span className="ml-2">{state === "recording" ? "Stop" : state === "processing" ? "..." : "Record"}</span>
              </Button>
              {state === "recording" && (
                <span className="absolute inset-0 rounded-md animate-pulse opacity-25 bg-destructive pointer-events-none" />
              )}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              {getStatusText()}
            </p>

            {transcript && (
              <div className="w-full p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">You said:</p>
                <p className="text-sm" data-testid="text-voice-transcript">{transcript}</p>
              </div>
            )}

            {response && (
              <div className="w-full p-3 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground mb-1">Response:</p>
                <p className="text-sm" data-testid="text-voice-response">{response}</p>
              </div>
            )}

            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>Try saying:</p>
              <p className="italic">"Show my medications"</p>
              <p className="italic">"What is hypertension?"</p>
              <p className="italic">"Read my allergies"</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="mt-2"
              data-testid="button-voice-close"
            >
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
