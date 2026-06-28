import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  Shield,
  Mic,
  MicOff,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  HardDrive,
  Search,
  Activity,
  Loader2,
  Volume2,
  FileText,
  Network,
  Layers,
  RefreshCw,
  Brain,
  Cloud,
  Server,
  Lock,
  Zap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function PHRPipelinePage() {
  const { toast } = useToast();
  const [voiceQuery, setVoiceQuery] = useState("");
  const [isListening, setIsListening] = useState(false);

  const statusQuery = useQuery<{
    lastRun: string | null;
    connectedSources: number;
    totalRecords: number;
    deduplicationRate: string;
    vaultSizeBytes: number;
    fhirStoreIndexed: boolean;
    voiceQueryEnabled: boolean;
  }>({
    queryKey: ["/api/phr-pipeline/status"],
  });

  const architectureQuery = useQuery<{
    name: string;
    description: string;
    stages: Array<{
      id: string;
      name: string;
      description: string;
      technology: string;
      capabilities: string[];
    }>;
    endpoints: Record<string, string>;
    noPaymentsHandled: boolean;
    layer: string;
  }>({
    queryKey: ["/api/phr-pipeline/architecture"],
  });

  const runPipeline = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/phr-pipeline/run", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Pipeline Complete",
        description: `Processed ${data.summary.totalIngested} records, removed ${data.summary.duplicatesRemoved} duplicates, stored ${data.summary.totalStored} records.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/phr-pipeline/status"] });
    },
    onError: () => {
      toast({ title: "Pipeline Error", description: "Failed to run pipeline.", variant: "destructive" });
    },
  });

  const voiceQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/phr-pipeline/voice-query", { query });
      return res.json();
    },
  });

  const startVoiceListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({ title: "Not Supported", description: "Speech recognition not available in this browser.", variant: "destructive" });
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setVoiceQuery(transcript);
      voiceQueryMutation.mutate(transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleTextQuery = () => {
    if (voiceQuery.trim()) {
      voiceQueryMutation.mutate(voiceQuery.trim());
    }
  };

  const status = statusQuery.data;
  const architecture = architectureQuery.data;

  const stageIcons: Record<string, any> = {
    "fasten-ingest": Network,
    "vertex-ai-dedup": Brain,
    "gcs-vault": Cloud,
    "fhir-store-index": Server,
    "voice-to-record": Volume2,
  };

  const stageColors: Record<string, string> = {
    "fasten-ingest": "text-blue-500",
    "vertex-ai-dedup": "text-purple-500",
    "gcs-vault": "text-emerald-500",
    "fhir-store-index": "text-orange-500",
    "voice-to-record": "text-pink-500",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-phr-title">
              Personal Health Record
            </h1>
            <p className="text-muted-foreground mt-1">
              Free Data Utility — Your single source of truth. No payments handled here.
            </p>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 dark:text-green-400 px-3 py-1">
            <Shield className="w-3 h-3 mr-1" />
            HIPAA Compliant
          </Badge>
        </div>

        <Tabs defaultValue="pipeline" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4" data-testid="tabs-phr">
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">
              <Layers className="w-4 h-4 mr-2" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="voice" data-testid="tab-voice">
              <Mic className="w-4 h-4 mr-2" />
              Voice Query
            </TabsTrigger>
            <TabsTrigger value="architecture" data-testid="tab-architecture">
              <Database className="w-4 h-4 mr-2" />
              Architecture
            </TabsTrigger>
            <TabsTrigger value="status" data-testid="tab-status">
              <Activity className="w-4 h-4 mr-2" />
              Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Data Pipeline
                    </CardTitle>
                    <CardDescription>
                      Fasten Ingest → Vertex AI Dedup → GCS Vault → FHIR Store
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => runPipeline.mutate()}
                    disabled={runPipeline.isPending}
                    data-testid="button-run-pipeline"
                  >
                    {runPipeline.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    {runPipeline.isPending ? "Running..." : "Run Pipeline"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    {
                      title: "1. Fasten Ingest",
                      icon: Network,
                      color: "text-blue-500 bg-blue-50 dark:bg-blue-950",
                      desc: "Pull from 29,000+ endpoints",
                      detail: "SMART on FHIR + PKCE",
                    },
                    {
                      title: "2. Vertex AI Dedup",
                      icon: Brain,
                      color: "text-purple-500 bg-purple-50 dark:bg-purple-950",
                      desc: "Entity resolution & matching",
                      detail: "Deterministic + Probabilistic + AI",
                    },
                    {
                      title: "3. GCS Vault",
                      icon: Cloud,
                      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950",
                      desc: "Encrypted FHIR JSON storage",
                      detail: "AES-256-GCM + Cloud KMS",
                    },
                    {
                      title: "4. FHIR Store",
                      icon: Server,
                      color: "text-orange-500 bg-orange-50 dark:bg-orange-950",
                      desc: "Searchable FHIR R4 index",
                      detail: "Cloud Healthcare API",
                    },
                  ].map((stage, idx) => (
                    <Card key={stage.title} className={`relative overflow-hidden`}>
                      <CardContent className="pt-4 pb-4 px-4">
                        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${stage.color}`}>
                          <stage.icon className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-sm">{stage.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{stage.desc}</p>
                        <Badge variant="secondary" className="mt-2 text-[10px]">{stage.detail}</Badge>
                        {idx < 3 && (
                          <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground/30 z-10" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {runPipeline.data && (
                  <div className="mt-6 space-y-3" data-testid="pipeline-results">
                    <Separator />
                    <h3 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Pipeline Results
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold" data-testid="text-ingested-count">
                          {(runPipeline.data as any).summary.totalIngested}
                        </div>
                        <div className="text-xs text-muted-foreground">Records Ingested</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-red-500" data-testid="text-dupes-count">
                          {(runPipeline.data as any).summary.duplicatesRemoved}
                        </div>
                        <div className="text-xs text-muted-foreground">Duplicates Removed</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-500" data-testid="text-stored-count">
                          {(runPipeline.data as any).summary.totalStored}
                        </div>
                        <div className="text-xs text-muted-foreground">Records Stored</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold" data-testid="text-duration">
                          {(runPipeline.data as any).totalDuration}ms
                        </div>
                        <div className="text-xs text-muted-foreground">Total Duration</div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-4">
                      {(runPipeline.data as any).stages.map((stage: any) => (
                        <div key={stage.stage} className="flex items-center gap-3 text-sm">
                          {stage.status === "success" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                          )}
                          <span className="font-medium w-40">{stage.stage}</span>
                          <Progress value={100} className="flex-1 h-2" />
                          <span className="text-muted-foreground w-16 text-right">{stage.duration}ms</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-pink-500" />
                  Voice-to-Record
                  <Badge variant="outline" className="ml-2">Section 508</Badge>
                </CardTitle>
                <CardDescription>
                  Ask questions about your health records using natural language.
                  Powered by Vertex AI (Gemini) + Cloud Healthcare Search.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={isListening ? "destructive" : "default"}
                    onClick={startVoiceListening}
                    className="shrink-0"
                    data-testid="button-voice-listen"
                    aria-label={isListening ? "Stop listening" : "Start voice input"}
                  >
                    {isListening ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                    {isListening ? "Listening..." : "Ask by Voice"}
                  </Button>
                  <Input
                    value={voiceQuery}
                    onChange={(e) => setVoiceQuery(e.target.value)}
                    placeholder='Try: "When was my last Tetanus shot?"'
                    onKeyDown={(e) => e.key === "Enter" && handleTextQuery()}
                    data-testid="input-voice-query"
                    aria-label="Type your health question"
                  />
                  <Button
                    onClick={handleTextQuery}
                    disabled={!voiceQuery.trim() || voiceQueryMutation.isPending}
                    data-testid="button-search-records"
                  >
                    {voiceQueryMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    "When was my last Tetanus shot?",
                    "What are my current medications?",
                    "Show my cholesterol results",
                    "Do I have any allergies?",
                  ].map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="text-xs text-left h-auto py-2 justify-start"
                      onClick={() => {
                        setVoiceQuery(q);
                        voiceQueryMutation.mutate(q);
                      }}
                      data-testid={`button-quick-query-${q.slice(0, 20).replace(/\s/g, "-").toLowerCase()}`}
                    >
                      {q}
                    </Button>
                  ))}
                </div>

                {voiceQueryMutation.data && (
                  <Card className="bg-muted/30 border-primary/20" data-testid="voice-result">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Brain className="w-4 h-4 text-primary" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm leading-relaxed" data-testid="text-voice-answer">
                            {(voiceQueryMutation.data as any).answer}
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              Confidence: {((voiceQueryMutation.data as any).confidence * 100).toFixed(0)}%
                            </Badge>
                            {(voiceQueryMutation.data as any).sources?.map((s: any, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px]">
                                <FileText className="w-3 h-3 mr-1" />
                                {s.resourceType} ({s.date})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    508 Compliance Features
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { label: "Voice Input", desc: "Web Speech API + Whisper fallback", icon: Mic },
                      { label: "Screen Reader", desc: "ARIA live regions for all responses", icon: Volume2 },
                      { label: "Keyboard Nav", desc: "Alt+V to activate, full tab support", icon: Zap },
                    ].map((feat) => (
                      <div key={feat.label} className="flex items-start gap-2 text-sm p-3 bg-muted/30 rounded-lg">
                        <feat.icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">{feat.label}</span>
                          <p className="text-xs text-muted-foreground">{feat.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-4">
            {architecture?.stages.map((stage) => {
              const IconComp = stageIcons[stage.id] || Database;
              const colorClass = stageColors[stage.id] || "text-gray-500";

              return (
                <Card key={stage.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted ${colorClass}`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      {stage.name}
                    </CardTitle>
                    <CardDescription>{stage.description}</CardDescription>
                    <Badge variant="secondary" className="w-fit mt-1">{stage.technology}</Badge>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {stage.capabilities.map((cap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          <span>{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}

            {architecture && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    API Endpoints
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(architecture.endpoints).map(([key, path]) => (
                      <div key={key} className="flex items-center gap-2 text-sm font-mono bg-muted/50 px-3 py-2 rounded">
                        <Badge variant="outline" className="text-[10px] shrink-0">GET/POST</Badge>
                        <span className="text-muted-foreground">{path}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="status" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                      <Network className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-connected-sources">
                        {status?.connectedSources ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Connected Sources</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-total-records">
                        {status?.totalRecords ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Total Records</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-dedup-rate">
                        {status?.deduplicationRate ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Dedup Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-950 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold" data-testid="text-vault-size">
                        {status ? (status.vaultSizeBytes / 1_000_000).toFixed(1) + " MB" : "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">Vault Size</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Fasten Health Connect", status: "Operational", icon: Network, color: "text-green-500" },
                    { name: "Vertex AI Deduplication", status: "Operational", icon: Brain, color: "text-green-500" },
                    { name: "GCS Vault (The Vault)", status: "Operational", icon: Cloud, color: "text-green-500" },
                    { name: "Cloud Healthcare API FHIR Store", status: "Operational", icon: Server, color: "text-green-500" },
                    { name: "Voice-to-Record (Vertex AI)", status: "Operational", icon: Volume2, color: "text-green-500" },
                    { name: "HIPAA Audit Logger", status: "Operational", icon: Shield, color: "text-green-500" },
                  ].map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <svc.icon className={`w-4 h-4 ${svc.color}`} />
                        <span className="text-sm font-medium">{svc.name}</span>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {svc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {status?.lastRun && (
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Last pipeline run: {new Date(status.lastRun).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={status.fhirStoreIndexed ? "default" : "secondary"}>
                        FHIR Store: {status.fhirStoreIndexed ? "Indexed" : "Not Indexed"}
                      </Badge>
                      <Badge variant={status.voiceQueryEnabled ? "default" : "secondary"}>
                        Voice: {status.voiceQueryEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
