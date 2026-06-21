import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Volume2, X, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAnnounce } from "@/components/screen-reader-announcer";
import { useAccessibility } from "@/components/accessibility-provider";

interface VoiceCommand {
  patterns: string[];
  action: () => void;
  description: string;
  category: string;
}

export function VoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { announce } = useAnnounce();
  const { settings } = useAccessibility();
  const helpDialogRef = useRef<HTMLDivElement>(null);
  const closeHelpRef = useRef<HTMLButtonElement>(null);
  const voiceBtnRef = useRef<HTMLButtonElement>(null);

  const navigateAndAnnounce = useCallback((path: string, label: string) => {
    setLocation(path);
    announce(`Navigated to ${label}`, "assertive");
    setLastCommand(label);
    setTimeout(() => {
      const main = document.getElementById("main-content");
      if (main) {
        main.focus();
      }
    }, 300);
  }, [setLocation, announce]);

  const commands: VoiceCommand[] = [
    { patterns: ["go to dashboard", "go home", "home", "dashboard"], action: () => navigateAndAnnounce("/", "Dashboard"), description: "Go to Dashboard", category: "Navigation" },
    { patterns: ["go to timeline", "show timeline", "timeline", "my timeline", "health timeline"], action: () => navigateAndAnnounce("/timeline", "Timeline"), description: "Go to Timeline", category: "Navigation" },
    { patterns: ["go to medications", "show medications", "medications", "my medications", "meds", "show my meds"], action: () => navigateAndAnnounce("/medications", "Medications"), description: "Go to Medications", category: "Navigation" },
    { patterns: ["go to documents", "show documents", "documents", "my documents", "records"], action: () => navigateAndAnnounce("/documents", "Documents"), description: "Go to Documents", category: "Navigation" },
    { patterns: ["go to identity", "show identity", "identity", "verify identity"], action: () => navigateAndAnnounce("/identity", "Identity"), description: "Go to Identity", category: "Navigation" },
    { patterns: ["go to connections", "show connections", "connections", "data sources", "health systems"], action: () => navigateAndAnnounce("/connections", "Connections"), description: "Go to Connections", category: "Navigation" },
    { patterns: ["go to appointments", "show appointments", "appointments", "my appointments"], action: () => navigateAndAnnounce("/appointments", "Appointments"), description: "Go to Appointments", category: "Navigation" },
    { patterns: ["go to lab results", "show lab results", "lab results", "labs", "test results"], action: () => navigateAndAnnounce("/lab-results", "Lab Results"), description: "Go to Lab Results", category: "Navigation" },
    { patterns: ["go to vitals", "show vitals", "vitals", "vital signs", "my vitals"], action: () => navigateAndAnnounce("/vitals", "Vitals"), description: "Go to Vitals", category: "Navigation" },
    { patterns: ["go to allergies", "show allergies", "allergies", "my allergies"], action: () => navigateAndAnnounce("/allergies", "Allergies"), description: "Go to Allergies", category: "Navigation" },
    { patterns: ["go to immunizations", "show immunizations", "immunizations", "vaccinations", "vaccines"], action: () => navigateAndAnnounce("/immunizations", "Immunizations"), description: "Go to Immunizations", category: "Navigation" },
    { patterns: ["go to care team", "show care team", "care team", "my doctors", "providers"], action: () => navigateAndAnnounce("/care-team", "Care Team"), description: "Go to Care Team", category: "Navigation" },
    { patterns: ["go to messaging", "show messages", "messages", "secure messaging", "inbox"], action: () => navigateAndAnnounce("/messaging", "Secure Messaging"), description: "Go to Messaging", category: "Navigation" },
    { patterns: ["go to accessibility", "accessibility", "accessibility settings", "a11y"], action: () => navigateAndAnnounce("/accessibility", "Accessibility Settings"), description: "Go to Accessibility", category: "Navigation" },
    { patterns: ["go to settings", "settings", "my settings", "preferences"], action: () => navigateAndAnnounce("/settings", "Settings"), description: "Go to Settings", category: "Navigation" },
    { patterns: ["go to health records", "health records", "all records"], action: () => navigateAndAnnounce("/health-records", "Health Records"), description: "Go to Health Records", category: "Navigation" },
    { patterns: ["go to ai advisor", "ai advisor", "health advisor", "ask ai"], action: () => navigateAndAnnounce("/ai-advisor", "AI Health Advisor"), description: "Go to AI Advisor", category: "Navigation" },
    {
      patterns: ["read page", "read this page", "what's on this page", "describe page"],
      action: () => {
        const main = document.getElementById("main-content");
        if (main && window.speechSynthesis) {
          const headings = main.querySelectorAll("h1, h2, h3");
          const texts: string[] = [];
          headings.forEach(h => texts.push(h.textContent || ""));
          const summary = texts.length > 0
            ? `This page contains: ${texts.join(". ")}`
            : "This page has no headings to summarize.";
          const utterance = new SpeechSynthesisUtterance(summary);
          utterance.rate = 0.9;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
          announce(summary);
        }
      },
      description: "Read page headings aloud",
      category: "Accessibility",
    },
    {
      patterns: ["stop reading", "stop talking", "be quiet", "stop", "silence"],
      action: () => {
        window.speechSynthesis?.cancel();
        announce("Speech stopped");
      },
      description: "Stop reading aloud",
      category: "Accessibility",
    },
    {
      patterns: ["increase font", "bigger text", "larger text", "make text bigger"],
      action: () => {
        document.documentElement.classList.add("large-text");
        announce("Text size increased");
      },
      description: "Increase text size",
      category: "Accessibility",
    },
    {
      patterns: ["high contrast", "more contrast", "contrast mode"],
      action: () => {
        document.documentElement.classList.add("high-contrast");
        announce("High contrast mode enabled");
      },
      description: "Enable high contrast",
      category: "Accessibility",
    },
    {
      patterns: ["help", "what can I say", "show commands", "voice help", "list commands"],
      action: () => {
        setShowHelp(true);
        announce("Voice commands help opened. Listing available commands.");
      },
      description: "Show voice commands",
      category: "Help",
    },
    {
      patterns: ["close help", "hide help", "close", "dismiss"],
      action: () => {
        setShowHelp(false);
        announce("Help panel closed");
      },
      description: "Close help panel",
      category: "Help",
    },
  ];

  const processCommand = useCallback((spokenText: string) => {
    const normalizedText = spokenText.toLowerCase().trim();

    for (const command of commands) {
      for (const pattern of command.patterns) {
        if (normalizedText.includes(pattern)) {
          command.action();
          toast({
            title: "Voice Command",
            description: command.description,
          });
          return true;
        }
      }
    }

    const msg = `Command not recognized: "${spokenText}". Say "help" for available commands.`;
    announce(msg, "assertive");
    toast({
      title: "Command not recognized",
      description: `Try saying "help" to see available commands`,
      variant: "destructive",
    });
    return false;
  }, [commands, toast, announce]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      const msg = "Voice not supported. Your browser doesn't support voice commands. Try Chrome or Safari.";
      announce(msg, "assertive");
      toast({ title: "Voice not supported", description: msg, variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
      announce("Listening for voice command. Speak now.", "assertive");
    };

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const result = event.results[current];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal) {
        announce(`Heard: ${text}. Processing command.`);
        processCommand(text);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error === "no-speech") {
        announce("No speech detected. Please try again.");
      } else {
        announce("Could not hear you clearly. Please try again.", "assertive");
        toast({ title: "Voice error", description: "Could not hear you clearly. Please try again.", variant: "destructive" });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [processCommand, toast, announce]);

  useEffect(() => {
    if (showHelp) {
      closeHelpRef.current?.focus();
    }
  }, [showHelp]);

  useEffect(() => {
    const altVHandler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
        if (!isListening) {
          e.preventDefault();
          startListening();
        }
      }
    };
    window.addEventListener("keydown", altVHandler);
    return () => window.removeEventListener("keydown", altVHandler);
  }, [isListening, startListening]);

  useEffect(() => {
    if (!showHelp) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowHelp(false);
        voiceBtnRef.current?.focus();
      }
      if (e.key === "Tab" && helpDialogRef.current) {
        const focusable = helpDialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showHelp]);

  if (!isSupported) {
    return null;
  }

  const grouped = commands.reduce<Record<string, VoiceCommand[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  return (
    <>
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
        role="region"
        aria-label="Voice command controls"
      >
        {isListening && (
          <Card className="animate-in slide-in-from-bottom-2 w-72" role="status" aria-live="polite">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" aria-hidden="true" />
                <span className="text-sm font-semibold">Listening...</span>
              </div>
              {transcript && (
                <p className="text-sm text-muted-foreground italic" aria-live="polite">
                  Heard: "{transcript}"
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Say a command or "help" for options
              </p>
            </CardContent>
          </Card>
        )}

        {lastCommand && !isListening && (
          <div className="sr-only" role="status" aria-live="polite">
            Last command: {lastCommand}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowHelp(!showHelp)}
            className="rounded-full shadow-lg bg-background border min-w-[48px] min-h-[48px]"
            aria-label="Show voice command help. Lists all available voice commands."
            aria-expanded={showHelp}
            data-testid="button-voice-help"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Button
            ref={voiceBtnRef}
            size="lg"
            onClick={startListening}
            disabled={isListening}
            className={`rounded-full shadow-lg min-h-[48px] min-w-[120px] ${isListening ? "bg-red-500 hover:bg-red-600" : ""}`}
            aria-label={isListening ? "Voice commands active. Listening for your command." : "Activate voice commands. Press to speak a navigation command. Keyboard shortcut: Alt plus V."}
            aria-pressed={isListening}
            aria-keyshortcuts="Alt+V"
            data-testid="button-voice-command"
          >
            {isListening ? (
              <>
                <MicOff className="h-5 w-5 mr-2" aria-hidden="true" />
                <span>Listening...</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 mr-2" aria-hidden="true" />
                <span>Voice</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-help-title"
          onClick={() => {
            setShowHelp(false);
            voiceBtnRef.current?.focus();
          }}
          data-testid="dialog-voice-help"
        >
          <Card
            ref={helpDialogRef}
            className="w-full max-w-md max-h-[80vh] overflow-auto animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
                  <h2 id="voice-help-title" className="text-lg font-semibold">
                    Voice Commands
                  </h2>
                </div>
                <Button
                  ref={closeHelpRef}
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowHelp(false);
                    voiceBtnRef.current?.focus();
                  }}
                  aria-label="Close voice commands help"
                  data-testid="button-close-voice-help"
                  className="min-w-[44px] min-h-[44px]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                Press the microphone button or use <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">Alt+V</kbd> then say any command below:
              </p>

              {Object.entries(grouped).map(([category, cmds]) => (
                <div key={category} className="mb-4">
                  <h3 className="text-sm font-medium mb-2 text-muted-foreground">{category}</h3>
                  <ul className="space-y-1" role="list">
                    {cmds.map((cmd, i) => (
                      <li key={i} className="flex items-start gap-2 py-1">
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          "{cmd.patterns[0]}"
                        </Badge>
                        <span className="text-sm text-muted-foreground">{cmd.description}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Tips for best results</h3>
                <ul className="text-xs text-muted-foreground space-y-1" role="list">
                  <li>Speak clearly and at a normal pace</li>
                  <li>Use a quiet environment for best accuracy</li>
                  <li>Say "read page" to have the current page read aloud</li>
                  <li>Say "stop" to stop any speech</li>
                  <li>Keyboard shortcut: Alt+V to activate voice</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
