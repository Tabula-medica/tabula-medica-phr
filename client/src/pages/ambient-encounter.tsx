import { useEffect, useRef, useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Mic,
  MicOff,
  Square,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Stage = "consent" | "ready" | "recording" | "processing" | "results" | "denied";

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface ActionItem {
  type: string;
  description: string;
  priority: "high" | "medium" | "low";
  dueWindow?: string;
}

interface EncounterResult {
  transcript: string;
  soapNote: SoapNote;
  actionItems: ActionItem[];
  language?: string;
  audioRetained: false;
  processedAt: string;
}

const PRIORITY_CLASSES: Record<ActionItem["priority"], string> = {
  high: "border-red-300 dark:border-red-800 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200",
  medium: "border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200",
  low: "border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200",
};

const TYPE_LABEL: Record<string, string> = {
  follow_up: "Follow-up",
  prescription: "Prescription",
  referral: "Referral",
  lab_order: "Lab",
  imaging_order: "Imaging",
  lifestyle: "Lifestyle",
  other: "Other",
};

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const t of candidates) {
    if ((MediaRecorder as any).isTypeSupported?.(t)) return t;
  }
  return "audio/webm";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function AmbientEncounterPage() {
  const [stage, setStage] = useState<Stage>("consent");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<EncounterResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopStream();
      if (tickRef.current != null) window.clearInterval(tickRef.current);
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const handleAcceptConsent = () => {
    if (!consentChecked) return;
    setStage("ready");
  };

  const startRecording = async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support audio recording. Please use a modern browser.");
      setStage("denied");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = pickMimeType();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        if (tickRef.current != null) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
        await uploadAndProcess(mime);
      };

      recorder.start(1000);
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed((Date.now() - startedAtRef.current) / 1000);
      }, 250);
      setStage("recording");
    } catch (err: any) {
      console.error("Microphone access error:", err);
      stopStream();
      setStage("denied");
      setError(
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Microphone access was blocked. To enable it, click the lock or microphone icon in your browser's address bar, allow microphone access for this site, and try again."
          : err?.message || "Could not start recording.",
      );
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const uploadAndProcess = async (mime: string) => {
    setStage("processing");
    try {
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];

      if (blob.size < 1024) {
        throw new Error("Recording was too short. Please try again.");
      }

      const form = new FormData();
      const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "mp4" : "ogg";
      form.append("audio", blob, `encounter.${ext}`);

      const res = await fetch("/api/ambient-encounter/process", {
        method: "POST",
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
        body: form,
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`${res.status}: ${t}`);
      }

      const data = (await res.json()) as EncounterResult;
      setResult(data);
      setStage("results");
    } catch (err: any) {
      console.error("Processing error:", err);
      setError(err?.message || "Processing failed.");
      setStage("ready");
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setElapsed(0);
    setStage("ready");
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Mic className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Visit Recorder
          </h1>
        </div>
        <p className="text-muted-foreground">
          Record your doctor visit to get a written summary, structured notes,
          and a list of follow-ups. The recording is processed by AI and is not
          saved.
        </p>
      </header>

      {stage === "consent" && (
        <ConsentScreen
          checked={consentChecked}
          onCheckedChange={setConsentChecked}
          onAccept={handleAcceptConsent}
        />
      )}

      {(stage === "ready" || stage === "recording" || stage === "processing") && (
        <RecorderCard
          stage={stage}
          elapsed={elapsed}
          error={error}
          onStart={startRecording}
          onStop={stopRecording}
        />
      )}

      {stage === "denied" && <PermissionDeniedCard error={error} onRetry={reset} />}

      {stage === "results" && result && <ResultsView result={result} onReset={reset} />}

      <ClinicalDisclaimer variant="card" />
    </div>
  );
}

function ConsentScreen({
  checked,
  onCheckedChange,
  onAccept,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onAccept: () => void;
}) {
  return (
    <Card data-testid="card-consent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Before You Record</CardTitle>
        </div>
        <CardDescription>
          You must read and accept this consent before recording.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3 text-sm">
          <p>
            <strong>This session will record audio during your visit.</strong>{" "}
            The audio is sent to a transcription service to create a written
            summary of what was said.
          </p>
          <p>
            <strong>The audio recording is not saved.</strong> It is held in
            memory only while the summary is being created, then discarded. Only
            the written transcript and summary are kept in your records.
          </p>
          <p>
            <strong>You can stop recording at any time</strong> by tapping
            "Stop". A red indicator will be visible the entire time recording is
            active.
          </p>
          <p>
            <strong>Local laws may require all parties to consent</strong> to
            being recorded. You are responsible for telling everyone in the room
            that the visit is being recorded.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Checkbox
            id="checkbox-consent"
            data-testid="checkbox-consent"
            checked={checked}
            onCheckedChange={(v) => onCheckedChange(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="checkbox-consent"
            className="text-sm font-medium cursor-pointer"
          >
            I consent to recording this visit, I understand the audio will not
            be saved, and I will inform everyone in the room before recording
            starts.
          </Label>
        </div>

        <div className="flex justify-end">
          <Button
            data-testid="button-accept-consent"
            onClick={onAccept}
            disabled={!checked}
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RecorderCard({
  stage,
  elapsed,
  error,
  onStart,
  onStop,
}: {
  stage: Stage;
  elapsed: number;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <Card data-testid="card-recorder">
      <CardContent className="pt-6 space-y-5">
        <div className="flex flex-col items-center gap-4">
          {stage === "recording" && (
            <div
              data-testid="indicator-recording"
              className="flex items-center gap-2 rounded-full border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-1.5 text-red-700 dark:text-red-200"
            >
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
              </span>
              <span className="text-sm font-semibold tracking-wide uppercase">
                Recording
              </span>
            </div>
          )}

          {stage === "processing" && (
            <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">Processing your visit…</span>
            </div>
          )}

          <div
            className="font-mono text-4xl tabular-nums"
            data-testid="text-elapsed"
          >
            {formatDuration(elapsed)}
          </div>

          <div className="flex gap-3">
            {stage === "ready" && (
              <Button
                size="lg"
                data-testid="button-start-recording"
                onClick={onStart}
                className="gap-2"
              >
                <Mic className="h-5 w-5" />
                Start Recording
              </Button>
            )}
            {stage === "recording" && (
              <Button
                size="lg"
                variant="destructive"
                data-testid="button-stop-recording"
                onClick={onStop}
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Stop &amp; Summarize
              </Button>
            )}
            {stage === "processing" && (
              <Button size="lg" disabled className="gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Working…
              </Button>
            )}
          </div>

          {error && stage === "ready" && (
            <p
              data-testid="text-error"
              className="text-sm text-red-600 dark:text-red-400 text-center"
            >
              {error}
            </p>
          )}
        </div>

        <Separator />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="flex items-start gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            Audio is processed in memory and never saved to disk.
          </p>
          <p>
            Best results: place your phone or laptop within 3 feet of you and the
            clinician. Avoid loud background noise.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PermissionDeniedCard({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <Card data-testid="card-permission-denied">
      <CardHeader>
        <div className="flex items-center gap-2">
          <MicOff className="h-5 w-5 text-red-500" />
          <CardTitle>Microphone Access Required</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span data-testid="text-permission-error">
            {error || "We couldn't access your microphone."}
          </span>
        </div>
        <div className="text-sm space-y-2">
          <p className="font-medium">To enable microphone access:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Click the lock or microphone icon in your browser's address bar.</li>
            <li>Set "Microphone" to "Allow" for this site.</li>
            <li>Reload the page and try again.</li>
          </ol>
        </div>
        <div className="flex justify-end">
          <Button data-testid="button-retry" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsView({
  result,
  onReset,
}: {
  result: EncounterResult;
  onReset: () => void;
}) {
  return (
    <div className="space-y-4" data-testid="section-results">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <CardTitle>Visit Summary Ready</CardTitle>
            </div>
            <CardDescription>
              Processed {new Date(result.processedAt).toLocaleString()} ·
              Audio not retained.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            data-testid="button-new-recording"
            onClick={onReset}
          >
            Record Another
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            <CardTitle>Action Items</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.actionItems.length === 0 ? (
            <p
              data-testid="text-no-action-items"
              className="text-sm text-muted-foreground"
            >
              No specific action items were identified in this visit.
            </p>
          ) : (
            result.actionItems.map((item, i) => (
              <div
                key={i}
                data-testid={`card-action-item-${i}`}
                className={cn(
                  "rounded-md border p-3 flex items-start gap-3",
                  PRIORITY_CLASSES[item.priority],
                )}
              >
                <Badge variant="outline" className="bg-background text-xs">
                  {TYPE_LABEL[item.type] ?? item.type}
                </Badge>
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium">{item.description}</p>
                  {item.dueWindow && (
                    <p className="text-xs opacity-80">Due: {item.dueWindow}</p>
                  )}
                </div>
                <Badge variant="secondary" className="capitalize text-xs">
                  {item.priority}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <CardTitle>SOAP Note</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {(["subjective", "objective", "assessment", "plan"] as const).map((k) => (
            <div key={k}>
              <h3 className="font-semibold capitalize mb-1">{k}</h3>
              <p
                data-testid={`text-soap-${k}`}
                className="text-muted-foreground whitespace-pre-wrap"
              >
                {result.soapNote[k] || <em className="opacity-60">Not noted in this visit.</em>}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Full Transcript</CardTitle>
          {result.language && (
            <CardDescription>
              Detected language: <span className="uppercase">{result.language}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <p
            data-testid="text-transcript"
            className="text-sm text-muted-foreground whitespace-pre-wrap"
          >
            {result.transcript}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
