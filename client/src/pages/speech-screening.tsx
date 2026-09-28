import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, BookOpen, CheckCircle2, Clock, ExternalLink, Info, Loader2, Mic, MicOff, ShieldCheck, TrendingDown, TrendingUp, Minus } from "lucide-react";
import {
  analyzeSustainedVowel,
  analyzeReadingPassage,
  type SpeechAcousticFeatures,
} from "@shared/speech-acoustics";

type TaskType = "sustained_vowel" | "reading_passage";

interface TaskDefinition {
  taskType: TaskType;
  title: string;
  instructions: string;
  minDurationSec: number;
  maxDurationSec: number;
}

interface EvidenceReference {
  group: "speech_biomarkers" | "rater_variability";
  citation: string;
  finding: string;
  doi: string;
}

interface TaskInfo {
  disclaimer: string;
  tasks: TaskDefinition[];
  evidence: EvidenceReference[];
}

const EVIDENCE_GROUPS: { key: EvidenceReference["group"]; title: string; description: string }[] = [
  {
    key: "speech_biomarkers",
    title: "Speech as a Parkinson's biomarker",
    description: "Research supports voice and speech measures for tracking Parkinson's, while noting validation gaps.",
  },
  {
    key: "rater_variability",
    title: "Why objective measures help",
    description: "Clinician ratings of motor symptoms vary between raters; quantitative tools can reduce, but not replace, that subjectivity.",
  },
];

type ScreeningFlagLevel = "typical" | "atypical";

interface ScreeningFlag {
  metric: string;
  value: number;
  unit: string;
  level: ScreeningFlagLevel;
  note: string;
}

interface SpeechScreeningResult {
  id: string;
  taskType: TaskType;
  features: SpeechAcousticFeatures;
  flags: ScreeningFlag[];
  atypicalCount: number;
  summary: string;
  trend?: { metric: string; direction: "increased" | "decreased" | "stable"; changePercent: number }[];
  assessedAt: string;
  disclaimer: string;
}

async function recordAudio(stream: MediaStream, durationMs: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
    recorder.onerror = e => reject(e);
    recorder.start();
    setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, durationMs);
  });
}

async function decodeToMonoPcm(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  try {
    const decoded = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = decoded.getChannelData(0);
    return { samples: new Float32Array(channelData), sampleRate: decoded.sampleRate };
  } finally {
    audioContext.close();
  }
}

export default function SpeechScreeningPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TaskType>("sustained_vowel");
  const [recordingState, setRecordingState] = useState<"idle" | "recording" | "processing">("idle");
  const [results, setResults] = useState<Partial<Record<TaskType, SpeechScreeningResult>>>({});
  const [micError, setMicError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const taskInfoQuery = useQuery<TaskInfo>({
    queryKey: ["/api/speech-screening/task-info"],
  });

  const historyQuery = useQuery<SpeechScreeningResult[]>({
    queryKey: ["/api/speech-screening/history"],
  });

  const analyzeMutation = useMutation({
    mutationFn: (features: SpeechAcousticFeatures) => apiRequest("POST", "/api/speech-screening/analyze", features),
    onSuccess: async (response) => {
      const data: SpeechScreeningResult = await response.json();
      setResults(prev => ({ ...prev, [data.taskType]: data }));
      queryClient.invalidateQueries({ queryKey: ["/api/speech-screening/history"] });
      toast({ title: "Recording analyzed" });
    },
    onError: (err: any) => {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const runTask = async (task: TaskDefinition) => {
    setMicError(null);
    setRecordingState("recording");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const blob = await recordAudio(stream, task.maxDurationSec * 1000);
      stream.getTracks().forEach(t => t.stop());
      streamRef.current = null;

      setRecordingState("processing");
      const { samples, sampleRate } = await decodeToMonoPcm(blob);
      const features: SpeechAcousticFeatures =
        task.taskType === "sustained_vowel" ? analyzeSustainedVowel(samples, sampleRate) : analyzeReadingPassage(samples, sampleRate);

      analyzeMutation.mutate(features);
    } catch (err: any) {
      setMicError(err?.message || "Could not access the microphone. Please check your browser permissions.");
    } finally {
      setRecordingState("idle");
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6" data-testid="speech-screening-page">
      <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800" data-testid="disclaimer-alert">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800 dark:text-amber-300">Not a Diagnostic Test</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
          {taskInfoQuery.data?.disclaimer ?? "This speech screening tool is not a diagnostic test and cannot diagnose or rule out Parkinson's disease. Discuss any result with your care team."}
        </AlertDescription>
      </Alert>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
          <Mic className="h-7 w-7 text-indigo-500" />
          Speech Screening
        </h1>
        <p className="text-muted-foreground text-sm">Acoustic voice-pattern tracking for Parkinson's-associated speech changes</p>
      </div>

      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" data-testid="privacy-note">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-300 text-sm">Your voice recording never leaves this device</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-400 text-xs">
          Audio is analyzed entirely in your browser. Only the numeric measurements below (pitch, loudness, timing) are sent to save your results — the recording itself is discarded immediately after analysis and is never uploaded or stored.
        </AlertDescription>
      </Alert>

      {micError && (
        <Alert variant="destructive" data-testid="mic-error-alert">
          <MicOff className="h-4 w-4" />
          <AlertDescription>{micError}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TaskType)}>
        <TabsList className="grid w-full grid-cols-2" data-testid="tabs-list">
          <TabsTrigger value="sustained_vowel" data-testid="tab-sustained-vowel">Sustained Vowel</TabsTrigger>
          <TabsTrigger value="reading_passage" data-testid="tab-reading-passage">Reading Passage</TabsTrigger>
        </TabsList>

        {taskInfoQuery.isLoading || !taskInfoQuery.data ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-32" />
          </div>
        ) : (
          taskInfoQuery.data.tasks.map(task => (
            <TabsContent key={task.taskType} value={task.taskType} className="space-y-4" data-testid={`task-tab-content-${task.taskType}`}>
              <Card data-testid={`card-task-${task.taskType}`}>
                <CardHeader>
                  <CardTitle>{task.title}</CardTitle>
                  <CardDescription>{task.instructions}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={() => runTask(task)}
                    disabled={recordingState !== "idle" || analyzeMutation.isPending}
                    size="lg"
                    className="w-full gap-2"
                    data-testid={`button-record-${task.taskType}`}
                  >
                    {recordingState === "recording" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Recording... (up to {task.maxDurationSec}s)</>
                    ) : recordingState === "processing" || analyzeMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing on-device...</>
                    ) : (
                      <><Mic className="h-4 w-4" /> Start Recording</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {results[task.taskType] ? (
                <ResultDisplay result={results[task.taskType]!} />
              ) : (
                <Card className="text-center py-10" data-testid={`card-no-result-${task.taskType}`}>
                  <CardContent>
                    <Mic className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-muted-foreground text-sm">Record a sample to see your results here.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          ))
        )}
      </Tabs>

      <HistoryPanel history={historyQuery.data || []} />

      {taskInfoQuery.data?.evidence && taskInfoQuery.data.evidence.length > 0 && (
        <EvidencePanel evidence={taskInfoQuery.data.evidence} />
      )}
    </div>
  );
}

function EvidencePanel({ evidence }: { evidence: EvidenceReference[] }) {
  return (
    <Card data-testid="card-evidence">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Why This Tool: The Evidence
        </CardTitle>
        <CardDescription>
          Published research behind this approach, and its limits. Sources retrieved from PubMed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {EVIDENCE_GROUPS.map(group => {
          const refs = evidence.filter(r => r.group === group.key);
          if (refs.length === 0) return null;
          return (
            <div key={group.key} className="space-y-2" data-testid={`evidence-group-${group.key}`}>
              <div>
                <p className="text-sm font-semibold">{group.title}</p>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
              <ul className="space-y-3">
                {refs.map(ref => (
                  <li key={ref.doi} className="text-sm space-y-0.5" data-testid={`evidence-${ref.doi}`}>
                    <p>{ref.finding}</p>
                    <p className="text-xs text-muted-foreground">
                      {ref.citation}{" "}
                      <a
                        href={`https://doi.org/${ref.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
                      >
                        doi:{ref.doi} <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground italic">
          These studies support the general approach. They do not validate this specific tool, which has not been clinically validated for Parkinson&apos;s screening.
        </p>
      </CardContent>
    </Card>
  );
}

function ResultDisplay({ result }: { result: SpeechScreeningResult }) {
  return (
    <div className="space-y-3" data-testid={`result-${result.id}`}>
      <Card data-testid="card-summary">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Result Summary</CardTitle>
            {result.atypicalCount > 0 ? (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                {result.atypicalCount} atypical
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Within typical range
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{result.summary}</p>
        </CardContent>
      </Card>

      <Card data-testid="card-flags">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Measurements</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {result.flags.map((flag, i) => (
              <li key={i} className="space-y-0.5" data-testid={`flag-${flag.metric}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{flag.metric.replace(/([A-Z])/g, " $1")}</span>
                  <span className="flex items-center gap-1.5">
                    {flag.level === "atypical" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                    {flag.value.toFixed(2)} {flag.unit}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{flag.note}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {result.trend && result.trend.length > 0 && (
        <Card data-testid="card-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trend vs. Previous Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.trend.map((t, i) => (
                <li key={i} className="flex items-center justify-between text-sm" data-testid={`trend-${t.metric}`}>
                  <span className="capitalize">{t.metric.replace(/([A-Z])/g, " $1")}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {t.direction === "increased" && <TrendingUp className="h-3.5 w-3.5" />}
                    {t.direction === "decreased" && <TrendingDown className="h-3.5 w-3.5" />}
                    {t.direction === "stable" && <Minus className="h-3.5 w-3.5" />}
                    {t.changePercent > 0 ? "+" : ""}{t.changePercent.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/10" data-testid="result-disclaimer">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">{result.disclaimer}</AlertDescription>
      </Alert>
    </div>
  );
}

function HistoryPanel({ history }: { history: SpeechScreeningResult[] }) {
  if (history.length === 0) return null;

  return (
    <Card data-testid="card-history">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4" /> Assessment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {history.map(r => (
            <li key={r.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0" data-testid={`history-${r.id}`}>
              <span className="capitalize">{r.taskType.replace("_", " ")}</span>
              <span className="text-muted-foreground text-xs">{new Date(r.assessedAt).toLocaleString()}</span>
              <Badge variant={r.atypicalCount > 0 ? "secondary" : "outline"} className="text-xs">
                {r.atypicalCount > 0 ? `${r.atypicalCount} atypical` : "typical"}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
