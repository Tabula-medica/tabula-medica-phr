import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVoiceNavigation } from "@/hooks/use-voice-navigation";
import { useAccessibility } from "@/components/accessibility-provider";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Settings,
  Minimize2,
  Maximize2,
  HelpCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface VoiceNavigationControlProps {
  userId?: string;
  language?: "en" | "es" | "zh" | "hi" | "ar" | "pt" | "bn" | "ru" | "ja" | "pa" | "de" | "ko" | "fr" | "vi" | "tl" | "it";
  className?: string;
  defaultExpanded?: boolean;
}

const VOICE_COMMANDS = [
  { command: "Go to medications", description: "Navigate to medications page" },
  { command: "Show my appointments", description: "View upcoming appointments" },
  { command: "Open health summary", description: "View health summary" },
  { command: "Read my vitals", description: "Hear your recent vital signs" },
  { command: "Help", description: "Get list of available commands" },
  { command: "Go back", description: "Return to previous page" },
  { command: "Scroll down", description: "Scroll the page down" },
  { command: "Search for [term]", description: "Search for something" },
];

export function VoiceNavigationControl({
  userId = "current-user",
  language = "en",
  className,
  defaultExpanded = false,
}: VoiceNavigationControlProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showHelp, setShowHelp] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const { settings: accessibilitySettings } = useAccessibility();

  const {
    isListening,
    isProcessing,
    transcript,
    lastResponse,
    startListening,
    stopListening,
    speak,
    error,
    isSupported,
  } = useVoiceNavigation({
    userId,
    language,
    onResponse: (response) => {
      if (!isMuted && response.responseText) {
        speak(response.responseText);
      }
    },
  });

  useEffect(() => {
    if (accessibilitySettings?.voiceNavigation && isSupported) {
      const timer = setTimeout(() => {
        speak("Voice navigation is ready. Say 'help' for available commands.");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [accessibilitySettings?.voiceNavigation, isSupported]);

  if (!accessibilitySettings?.voiceNavigation) {
    return null;
  }

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      window.speechSynthesis.cancel();
    }
  };

  const minimizedView = (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            onClick={handleMicClick}
            disabled={!isSupported || isProcessing}
            data-testid="button-voice-mic"
            aria-label={isListening ? "Stop listening" : "Start voice command"}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isListening ? (
              <Mic className="h-4 w-4" />
            ) : (
              <MicOff className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {isListening ? "Listening... Click to stop" : "Click to speak a command"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsExpanded(true)}
            data-testid="button-voice-expand"
            aria-label="Expand voice controls"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Expand voice controls</TooltipContent>
      </Tooltip>
    </div>
  );

  const expandedView = (
    <Card className="w-80 shadow-xl" data-testid="card-voice-control">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-primary" />
            Voice Navigation
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowHelp(true)}
              className="h-7 w-7"
              data-testid="button-voice-help"
              aria-label="Voice commands help"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsExpanded(false)}
              className="h-7 w-7"
              data-testid="button-voice-minimize"
              aria-label="Minimize voice controls"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            size="lg"
            variant={isListening ? "destructive" : "default"}
            onClick={handleMicClick}
            disabled={!isSupported || isProcessing}
            className="flex-1"
            data-testid="button-voice-listen"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : isListening ? (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Listening...
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4 mr-2" />
                Tap to Speak
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
                aria-label={isMuted ? "Unmute responses" : "Mute responses"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isMuted ? "Unmute voice responses" : "Mute voice responses"}
            </TooltipContent>
          </Tooltip>
        </div>

        {transcript && (
          <div className="p-2 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">You said:</p>
            <p className="text-sm font-medium" data-testid="text-voice-transcript">
              "{transcript}"
            </p>
          </div>
        )}

        {lastResponse && (
          <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm" data-testid="text-voice-response">
                  {lastResponse.responseText}
                </p>
                {lastResponse.navigation && (
                  <Badge variant="secondary" className="mt-1">
                    Navigating to {lastResponse.navigation.description}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-2 bg-destructive/10 rounded-md border border-destructive/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive" data-testid="text-voice-error">
                {error}
              </p>
            </div>
          </div>
        )}

        {!isSupported && (
          <div className="p-2 bg-amber-500/10 rounded-md border border-amber-500/20">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Voice commands are not supported in this browser. Please try Chrome or Edge.
            </p>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Say "help" for a list of available commands
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div
        className={cn(
          "fixed bottom-20 right-4 z-50 md:bottom-4",
          className
        )}
        role="region"
        aria-label="Voice navigation controls"
      >
        {isExpanded ? expandedView : minimizedView}
      </div>

      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-md" data-testid="dialog-voice-help">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Voice Commands
            </DialogTitle>
            <DialogDescription>
              Here are some commands you can say to navigate the app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {VOICE_COMMANDS.map((cmd, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-2 rounded-md hover-elevate"
              >
                <Badge variant="outline" className="shrink-0 font-mono text-xs">
                  "{cmd.command}"
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {cmd.description}
                </span>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded-md">
            Voice navigation works best with clear speech in a quiet environment.
            Commands are available in 16 languages.
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VoiceNavigationControl;
