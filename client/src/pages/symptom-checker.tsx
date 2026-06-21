import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Stethoscope,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Phone,
  Clock,
  X,
  ShieldAlert,
  Heart,
} from "lucide-react";

const BODY_REGIONS = [
  { id: "head", label: "Head / face" },
  { id: "chest", label: "Chest" },
  { id: "abdomen", label: "Abdomen / stomach" },
  { id: "back", label: "Back" },
  { id: "arms", label: "Arms / shoulders" },
  { id: "legs", label: "Legs / hips" },
  { id: "skin", label: "Skin" },
  { id: "general", label: "General / whole body" },
  { id: "mental", label: "Mental / emotional" },
];

const COMMON_SYMPTOMS: Record<string, string[]> = {
  head: ["headache", "dizziness", "facial droop", "slurred speech", "vision change", "ear pain"],
  chest: ["chest pain", "shortness of breath", "palpitations", "cough", "left arm pain"],
  abdomen: ["nausea", "vomiting", "abdominal pain", "diarrhea", "constipation", "loss of appetite"],
  back: ["back pain", "stiffness", "muscle spasm"],
  arms: ["arm pain", "weakness one side", "numbness", "tingling"],
  legs: ["leg pain", "swelling", "weakness", "numbness"],
  skin: ["rash", "itching", "swelling face", "uncontrolled bleeding"],
  general: ["fever", "fatigue", "chills", "weight loss", "night sweats"],
  mental: ["anxiety", "low mood", "suicidal thoughts", "insomnia", "panic"],
};

type Urgency = "SELF_CARE" | "PRIMARY_CARE" | "URGENT_CARE" | "ER";
interface TriageResult {
  urgency: Urgency;
  recommendedAction: string;
  rationale: string;
  selfCareSteps: string[];
  whenToSeekCare: string[];
  redFlagRuleId?: string;
  modelGenerated: boolean;
  disclaimer: string;
}
interface SymptomSession {
  id: string;
  transcript: { bodyRegion: string; symptoms: string[]; severity: number };
  triageResult: TriageResult;
  createdAt: string;
}

const URGENCY_META: Record<
  Urgency,
  { label: string; icon: typeof Heart; cardClass: string; badgeClass: string }
> = {
  ER: {
    label: "Emergency — call 911",
    icon: Phone,
    cardClass: "border-red-500 bg-red-50 dark:bg-red-950/30",
    badgeClass: "bg-red-600 text-white",
  },
  URGENT_CARE: {
    label: "Urgent care today",
    icon: AlertTriangle,
    cardClass: "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
    badgeClass: "bg-amber-600 text-white",
  },
  PRIMARY_CARE: {
    label: "Primary care soon",
    icon: Stethoscope,
    cardClass: "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
    badgeClass: "bg-blue-600 text-white",
  },
  SELF_CARE: {
    label: "Self-care may be appropriate",
    icon: CheckCircle2,
    cardClass: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    badgeClass: "bg-emerald-600 text-white",
  },
};

function PersistentDisclaimer() {
  return (
    <Alert className="mb-4" data-testid="alert-disclaimer">
      <ShieldAlert className="h-4 w-4" />
      <AlertTitle>Not a medical diagnosis</AlertTitle>
      <AlertDescription>
        This Symptom Checker is an informational tool to help you decide what level of care to seek. It does not replace evaluation by a qualified clinician.
      </AlertDescription>
    </Alert>
  );
}

export default function SymptomCheckerPage() {
  const [step, setStep] = useState(0);
  const [bodyRegion, setBodyRegion] = useState<string>("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [onsetHours, setOnsetHours] = useState<number | undefined>(undefined);
  const [severity, setSeverity] = useState<number>(5);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);

  const triageMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/symptom-checker/triage", {
        bodyRegion,
        symptoms,
        onsetHours,
        severity,
        notes: notes || undefined,
      });
      return res.json();
    },
    onSuccess: (data: { success: boolean; result: TriageResult }) => {
      setResult(data.result);
      setStep(5);
    },
  });

  const sessionsQuery = useQuery<{ success: boolean; sessions: SymptomSession[] }>({
    queryKey: ["/api/symptom-checker/sessions"],
    staleTime: 60_000,
  });

  function reset() {
    setStep(0);
    setBodyRegion("");
    setSymptoms([]);
    setCustomSymptom("");
    setOnsetHours(undefined);
    setSeverity(5);
    setNotes("");
    setResult(null);
  }

  function toggleSymptom(s: string) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length >= 8 ? prev : [...prev, s]
    );
  }

  function addCustomSymptom() {
    const s = customSymptom.trim().toLowerCase();
    if (!s) return;
    if (symptoms.includes(s) || symptoms.length >= 8) return;
    setSymptoms((p) => [...p, s]);
    setCustomSymptom("");
  }

  const totalSteps = 5;
  const progressPct = step >= totalSteps ? 100 : Math.round((step / totalSteps) * 100);

  return (
    <div className="container mx-auto max-w-3xl py-6 px-4" data-testid="page-symptom-checker">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
          <Stethoscope className="h-8 w-8 text-primary" />
          Symptom Checker
        </h1>
        <p className="text-muted-foreground mt-1">
          Answer a few questions to find out what level of care to seek.
        </p>
      </div>

      <PersistentDisclaimer />

      {step < 5 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground mb-1">
            <span>Step {step + 1} of {totalSteps}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
              data-testid="bar-progress"
            />
          </div>
        </div>
      )}

      {step === 0 && (
        <Card data-testid="card-step-region">
          <CardHeader>
            <CardTitle>Where is the problem?</CardTitle>
            <CardDescription>Pick the body region most affected.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BODY_REGIONS.map((r) => (
                <Button
                  key={r.id}
                  variant={bodyRegion === r.id ? "default" : "outline"}
                  onClick={() => setBodyRegion(r.id)}
                  className="h-auto py-4 justify-start"
                  data-testid={`button-region-${r.id}`}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                onClick={() => setStep(1)}
                disabled={!bodyRegion}
                data-testid="button-step-next"
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card data-testid="card-step-symptoms">
          <CardHeader>
            <CardTitle>What are you feeling?</CardTitle>
            <CardDescription>Pick up to 8 symptoms. Add your own if you don't see them.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(COMMON_SYMPTOMS[bodyRegion] ?? []).map((s) => (
                <Badge
                  key={s}
                  variant={symptoms.includes(s) ? "default" : "outline"}
                  onClick={() => toggleSymptom(s)}
                  className="cursor-pointer text-sm py-1.5 px-3"
                  data-testid={`badge-symptom-${s.replace(/\s+/g, "-")}`}
                >
                  {s}
                </Badge>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Input
                placeholder="Add another symptom…"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSymptom())}
                data-testid="input-custom-symptom"
              />
              <Button onClick={addCustomSymptom} variant="outline" data-testid="button-add-custom-symptom">
                Add
              </Button>
            </div>

            {symptoms.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground mb-2">Selected:</p>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((s) => (
                    <Badge key={s} className="gap-1" data-testid={`badge-selected-${s.replace(/\s+/g, "-")}`}>
                      {s}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => toggleSymptom(s)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)} data-testid="button-step-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={symptoms.length === 0} data-testid="button-step-next">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card data-testid="card-step-onset">
          <CardHeader>
            <CardTitle>When did this start?</CardTitle>
            <CardDescription>An approximate time helps us judge urgency.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Just now", val: 1 },
                { label: "A few hours", val: 6 },
                { label: "Today", val: 12 },
                { label: "1–2 days", val: 36 },
                { label: "3–7 days", val: 120 },
                { label: "1–2 weeks", val: 240 },
                { label: "Longer", val: 720 },
                { label: "Not sure", val: undefined },
              ].map((opt) => (
                <Button
                  key={opt.label}
                  variant={onsetHours === opt.val ? "default" : "outline"}
                  onClick={() => setOnsetHours(opt.val)}
                  className="h-auto py-3"
                  data-testid={`button-onset-${opt.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {opt.label}
                </Button>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="button-step-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} data-testid="button-step-next">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card data-testid="card-step-severity">
          <CardHeader>
            <CardTitle>How severe is it?</CardTitle>
            <CardDescription>1 = barely noticeable · 10 = worst you can imagine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="py-4">
              <Slider
                value={[severity]}
                onValueChange={(v) => setSeverity(v[0])}
                min={1}
                max={10}
                step={1}
                data-testid="slider-severity"
              />
              <div className="mt-3 text-center">
                <span className="text-4xl font-bold" data-testid="text-severity-value">{severity}</span>
                <span className="text-muted-foreground"> / 10</span>
              </div>
            </div>
            <Textarea
              placeholder="Anything else you'd like to add? (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 2000))}
              className="mt-4"
              data-testid="input-notes"
            />
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="button-step-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(4)} data-testid="button-step-next">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card data-testid="card-step-review">
          <CardHeader>
            <CardTitle>Review and submit</CardTitle>
            <CardDescription>We'll combine your answers with safety rules to suggest a level of care.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div><span className="text-muted-foreground">Region: </span><span data-testid="review-region">{bodyRegion}</span></div>
            <div><span className="text-muted-foreground">Symptoms: </span><span data-testid="review-symptoms">{symptoms.join(", ")}</span></div>
            <div><span className="text-muted-foreground">Onset: </span><span data-testid="review-onset">{onsetHours == null ? "Not sure" : `${onsetHours} h`}</span></div>
            <div><span className="text-muted-foreground">Severity: </span><span data-testid="review-severity">{severity}/10</span></div>
            {notes && <div><span className="text-muted-foreground">Notes: </span><span data-testid="review-notes">{notes}</span></div>}

            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} data-testid="button-step-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => triageMutation.mutate()}
                disabled={triageMutation.isPending}
                data-testid="button-submit-triage"
              >
                {triageMutation.isPending ? "Analyzing…" : "Get recommendation"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && result && (
        <ResultView result={result} onReset={reset} />
      )}

      {step < 5 && sessionsQuery.data?.sessions && sessionsQuery.data.sessions.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3">Your recent checks</h2>
          <div className="space-y-2">
            {sessionsQuery.data.sessions.slice(0, 5).map((s) => {
              const meta = URGENCY_META[s.triageResult.urgency];
              const Icon = meta.icon;
              return (
                <Card key={s.id} data-testid={`card-session-${s.id}`}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {s.transcript.bodyRegion} · {s.transcript.symptoms.slice(0, 3).join(", ")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Badge className={meta.badgeClass}>{meta.label}</Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultView({ result, onReset }: { result: TriageResult; onReset: () => void }) {
  const meta = URGENCY_META[result.urgency];
  const Icon = meta.icon;
  return (
    <Card className={`border-2 ${meta.cardClass}`} data-testid="card-result">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Icon className="h-8 w-8" />
          <div>
            <Badge className={meta.badgeClass} data-testid="badge-urgency">{meta.label}</Badge>
            <CardTitle className="mt-2" data-testid="text-result-action">{result.recommendedAction}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Why</h3>
          <p className="text-sm" data-testid="text-result-rationale">{result.rationale}</p>
        </div>

        {result.selfCareSteps.length > 0 && (
          <div>
            <h3 className="font-semibold mb-1">What you can do</h3>
            <ul className="text-sm list-disc list-inside space-y-1" data-testid="list-self-care">
              {result.selfCareSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        {result.whenToSeekCare.length > 0 && (
          <div>
            <h3 className="font-semibold mb-1">Seek care sooner if</h3>
            <ul className="text-sm list-disc list-inside space-y-1" data-testid="list-when-to-seek">
              {result.whenToSeekCare.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        <Separator />
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span data-testid="text-disclaimer">{result.disclaimer}</span>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onReset} data-testid="button-start-over">
            Start over
          </Button>
          {result.urgency === "ER" && (
            <a href="tel:911" data-testid="link-call-911">
              <Button className="bg-red-600 hover:bg-red-700 text-white">
                <Phone className="h-4 w-4 mr-2" />
                Call 911
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
