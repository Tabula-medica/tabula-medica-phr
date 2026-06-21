import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/components/language-provider";
import { useTourVoice } from "@/hooks/use-tour-voice";
import {
  Heart,
  Network,
  Sparkles,
  QrCode,
  Shield,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

const STORAGE_KEY = "tabula:welcome-seen-v1";

type Slide = {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  body: string;
  bullets?: string[];
};

const SLIDES: Slide[] = [
  {
    icon: Heart,
    iconBg: "bg-rose-100 dark:bg-rose-950",
    iconColor: "text-rose-600 dark:text-rose-300",
    title: "Welcome to Tabula Medica",
    body:
      "Your complete health record — from every doctor, every hospital, every visit — in one private, easy-to-read place.",
    bullets: [
      "Built for patients, not paperwork",
      "Works on your phone, tablet, or computer",
      "Available in 22 languages",
    ],
  },
  {
    icon: Network,
    iconBg: "bg-blue-100 dark:bg-blue-950",
    iconColor: "text-blue-600 dark:text-blue-300",
    title: "Connect your records once",
    body:
      "Securely pull your history from over 70,000 hospitals, clinics, and labs across the country. We handle the heavy lifting.",
    bullets: [
      "Sign in to your hospital's patient portal — we do the rest",
      "Records keep updating automatically",
      "Family members can be added with your permission",
    ],
  },
  {
    icon: Sparkles,
    iconBg: "bg-violet-100 dark:bg-violet-950",
    iconColor: "text-violet-600 dark:text-violet-300",
    title: "An AI assistant that speaks plain English",
    body:
      "Ask what a result means, summarize a long visit note, or translate a medication label. The assistant always cites where the answer comes from.",
    bullets: [
      "Explain medical terms in everyday language",
      "Summarize a long chart in seconds",
      "Voice access in over 50 languages",
    ],
  },
  {
    icon: QrCode,
    iconBg: "bg-emerald-100 dark:bg-emerald-950",
    iconColor: "text-emerald-600 dark:text-emerald-300",
    title: "Share safely, on your terms",
    body:
      "Send a secure link or QR code to a new doctor, a family caregiver, or your kid's school. You control who sees what, and for how long.",
    bullets: [
      "Time-limited share links",
      "Revoke access anytime",
      "Every view is logged in your audit trail",
    ],
  },
  {
    icon: Shield,
    iconBg: "bg-amber-100 dark:bg-amber-950",
    iconColor: "text-amber-600 dark:text-amber-300",
    title: "Your data, your rules",
    body:
      "Tabula Medica is HIPAA-aligned, encrypted end-to-end, and never sold to third parties. Export or delete your data anytime.",
    bullets: [
      "Encrypted in transit and at rest",
      "Granular consent controls",
      "Full audit log of every access",
    ],
  },
];

function readQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function WelcomeModal() {
  const { isAuthenticated, isLoading } = useAuth();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Decide whether to auto-open. Runs once on mount and whenever auth state
  // settles. Skipped while auth is still loading to avoid flashing the
  // modal before we know who the user is.
  useEffect(() => {
    if (isLoading) return;
    const forced = readQueryParam("welcome") === "1";
    if (forced) {
      setOpen(true);
      setStep(0);
      return;
    }
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setOpen(true);
        setStep(0);
      }
    } catch {
      // localStorage unavailable (private mode, etc.) — silently skip.
    }
  }, [isLoading]);

  // Persist "seen" flag whenever the modal closes by any path so we don't
  // pester the user on every navigation.
  const markSeen = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) markSeen();
  };

  const slide = SLIDES[step];
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;

  const Icon = slide.icon;

  const ctaLabel = useMemo(() => {
    if (!isLast) return "Next";
    return isAuthenticated ? "Go to my dashboard" : "Get started";
  }, [isLast, isAuthenticated]);

  const handlePrimary = () => {
    if (!isLast) {
      setStep((s) => Math.min(s + 1, SLIDES.length - 1));
      return;
    }
    markSeen();
    setOpen(false);
    if (isAuthenticated) {
      setLocation("/");
    } else {
      // Visitor — send to GCIP sign-up (Auth0 is OFF the patient path).
      setLocation("/auth/register");
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSkip = () => {
    markSeen();
    setOpen(false);
  };

  const [narrationOn, setNarrationOn] = useState(true);
  const narrationText = useMemo(() => {
    const bullets = slide.bullets?.join(". ") ?? "";
    return `${slide.title}. ${slide.body}${bullets ? ". " + bullets : ""}`;
  }, [slide]);

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
    lang: language || "en-US",
    commands: {
      onNext: handlePrimary,
      onBack: handleBack,
      onSkip: handleSkip,
      onClose: handleSkip,
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden gap-0"
        data-testid="modal-welcome"
        // Hide the default shadcn close X so we can render our own that
        // matches the layout and is keyboard-accessible.
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Custom close — top-right */}
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Skip welcome tour"
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
          data-testid="button-welcome-close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 pb-6" lang={language}>
          {/* Icon */}
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${slide.iconBg}`}
            data-testid={`icon-welcome-step-${step}`}
          >
            <Icon className={`h-8 w-8 ${slide.iconColor}`} />
          </div>

          {/* Title + body */}
          <DialogTitle className="text-center text-2xl font-semibold tracking-tight" data-testid="text-welcome-title">
            {slide.title}
          </DialogTitle>
          <DialogDescription className="mt-3 text-center text-base leading-relaxed text-muted-foreground" data-testid="text-welcome-body">
            {slide.body}
          </DialogDescription>

          {/* Bullets */}
          {slide.bullets && (
            <ul className="mt-6 space-y-2.5" data-testid="list-welcome-bullets">
              {slide.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {(ttsSupported || voiceSupported) && (
            <div
              className="mt-6 flex items-center justify-center gap-2"
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
                  className="gap-1.5 h-8 text-xs"
                  data-testid="button-welcome-narration-toggle"
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
                  className="gap-1.5 h-8 text-xs"
                  data-testid="button-welcome-voice-toggle"
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
              data-testid="text-welcome-voice-hint"
            >
              Say <strong>next</strong>, <strong>back</strong>, <strong>skip</strong>, or <strong>repeat</strong>.
            </p>
          )}

          {/* Trust footer on last slide */}
          {isLast && !isAuthenticated && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link href="/terms" className="underline hover:text-foreground">Terms</Link> and{" "}
              <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
            </p>
          )}
        </div>

        {/* Footer: progress dots + nav buttons */}
        <div className="border-t bg-muted/30 px-8 py-4">
          {/* Step dots */}
          <div className="flex items-center justify-center gap-1.5 mb-4" role="tablist" aria-label="Welcome tour progress">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1} of ${SLIDES.length}`}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                data-testid={`button-welcome-dot-${i}`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between gap-3">
            {isFirst ? (
              <Button
                variant="ghost"
                onClick={handleSkip}
                data-testid="button-welcome-skip"
              >
                Skip
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleBack}
                data-testid="button-welcome-back"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
            )}

            <span className="text-xs text-muted-foreground tabular-nums" data-testid="text-welcome-step-counter">
              {step + 1} of {SLIDES.length}
            </span>

            <Button onClick={handlePrimary} data-testid="button-welcome-next">
              {ctaLabel}
              {!isLast && <ArrowRight className="ml-1.5 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WelcomeModal;
