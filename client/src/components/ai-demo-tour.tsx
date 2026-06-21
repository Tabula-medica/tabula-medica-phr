import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  X,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useTourVoice } from "@/hooks/use-tour-voice";

export type AIDemoTourStep = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  bullets?: string[];
};

interface AIDemoTourProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: AIDemoTourStep[];
  onFinish?: () => void;
  finishLabel?: string;
  ariaLabel?: string;
  language?: string;
}

export function AIDemoTour({
  open,
  onOpenChange,
  steps,
  onFinish,
  finishLabel = "Get started",
  ariaLabel = "AI guided tour",
  language = "en-US",
}: AIDemoTourProps) {
  const [step, setStep] = useState(0);
  const [narrationOn, setNarrationOn] = useState(true);
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const current = steps[step];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const close = () => {
    onOpenChange(false);
  };

  const next = () => {
    if (isLast) {
      onFinish?.();
      onOpenChange(false);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const narrationText = useMemo(() => {
    if (!current) return "";
    const bullets = current.bullets?.join(". ") ?? "";
    return `${current.title}. ${current.body}${bullets ? ". " + bullets : ""}`;
  }, [current]);

  const {
    speaking,
    listening,
    ttsSupported,
    voiceSupported,
    speakNow,
    stopSpeaking,
    startListening,
    stopListening,
  } = useTourVoice({
    text: narrationText,
    enabled: open && narrationOn,
    lang: language,
    commands: {
      onNext: next,
      onBack: back,
      onSkip: close,
      onClose: close,
      onRepeat: () => speakNow(),
    },
  });

  const toggleNarration = () => {
    if (narrationOn) stopSpeaking();
    setNarrationOn((v) => !v);
  };

  const toggleListening = () => {
    if (listening) stopListening();
    else startListening();
  };

  if (!current) return null;
  const Icon = current.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden gap-0"
        data-testid="modal-ai-demo-tour"
        aria-label={ariaLabel}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close tour"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
          data-testid="button-tour-close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 pb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge variant="secondary" className="gap-1 text-[11px]">
              <Sparkles className="h-3 w-3" /> AI guided tour
            </Badge>
          </div>

          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${current.iconBg}`}
            data-testid={`icon-tour-step-${step}`}
          >
            <Icon className={`h-8 w-8 ${current.iconColor}`} />
          </div>

          <DialogTitle
            className="text-center text-2xl font-semibold tracking-tight"
            data-testid="text-tour-title"
          >
            {current.title}
          </DialogTitle>
          <DialogDescription
            className="mt-3 text-center text-base leading-relaxed text-muted-foreground"
            data-testid="text-tour-body"
          >
            {current.body}
          </DialogDescription>

          {current.bullets && (
            <ul
              className="mt-6 space-y-2.5 text-sm text-foreground/90"
              data-testid="list-tour-bullets"
            >
              {current.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {(ttsSupported || voiceSupported) && (
            <div
              className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
              role="group"
              aria-label="Accessibility controls"
            >
              {ttsSupported && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleNarration}
                  aria-pressed={narrationOn}
                  className="gap-1.5 h-8"
                  data-testid="button-tour-narration-toggle"
                >
                  {narrationOn ? (
                    <Volume2 className="h-3.5 w-3.5" />
                  ) : (
                    <VolumeX className="h-3.5 w-3.5" />
                  )}
                  {narrationOn ? (speaking ? "Reading…" : "Narration on") : "Narration off"}
                </Button>
              )}
              {voiceSupported && (
                <Button
                  type="button"
                  variant={listening ? "default" : "outline"}
                  size="sm"
                  onClick={toggleListening}
                  aria-pressed={listening}
                  className="gap-1.5 h-8"
                  data-testid="button-tour-voice-toggle"
                >
                  {listening ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  {listening ? "Listening" : "Voice commands"}
                </Button>
              )}
            </div>
          )}
          {voiceSupported && listening && (
            <p
              className="mt-2 text-center text-[11px] text-muted-foreground"
              data-testid="text-voice-hint"
            >
              Say <strong>next</strong>, <strong>back</strong>, <strong>skip</strong>, <strong>close</strong>, or <strong>repeat</strong>.
            </p>
          )}
        </div>

        <div className="border-t bg-muted/30 px-8 py-4">
          <div
            className="flex items-center justify-center gap-1.5 mb-4"
            role="tablist"
            aria-label="Tour progress"
          >
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1} of ${steps.length}`}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                data-testid={`button-tour-dot-${i}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            {isFirst ? (
              <Button variant="ghost" onClick={close} data-testid="button-tour-skip">
                Skip
              </Button>
            ) : (
              <Button variant="ghost" onClick={back} data-testid="button-tour-back">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
              </Button>
            )}
            <span
              className="text-xs text-muted-foreground tabular-nums"
              data-testid="text-tour-step-counter"
            >
              {step + 1} of {steps.length}
            </span>
            <Button onClick={next} data-testid="button-tour-next">
              {isLast ? finishLabel : "Next"}
              {!isLast && <ArrowRight className="ml-1.5 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AIDemoTour;
