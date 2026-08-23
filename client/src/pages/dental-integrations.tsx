import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw, Link2, Unlink, Calendar, FileText, DollarSign,
  Activity, Send, Bot, AlertTriangle, CheckCircle2, Clock,
  Building2, Phone, MapPin, ChevronRight, Loader2, Shield,
  ClipboardList, Stethoscope, Sparkles, TrendingUp
} from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { SoftUpgradePrompt, useSoftUpgradePrompt } from "@/components/soft-upgrade-prompt";

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    connected: { variant: "default", label: "Connected" },
    syncing: { variant: "secondary", label: "Syncing..." },
    pending: { variant: "outline", label: "Pending" },
    error: { variant: "destructive", label: "Error" },
    disconnected: { variant: "outline", label: "Disconnected" },
    scheduled: { variant: "secondary", label: "Scheduled" },
    confirmed: { variant: "default", label: "Confirmed" },
    completed: { variant: "default", label: "Completed" },
    cancelled: { variant: "outline", label: "Cancelled" },
    paid: { variant: "default", label: "Paid" },
    submitted: { variant: "secondary", label: "Submitted" },
    denied: { variant: "destructive", label: "Denied" },
    active: { variant: "default", label: "Active" },
    proposed: { variant: "outline", label: "Proposed" },
  };
  const v = variants[status] || { variant: "outline" as const, label: status };
  return <Badge data-testid={`badge-status-${status}`} variant={v.variant}>{v.label}</Badge>;
}

function SoftwareIcon({ software, size = 36 }: { software: string; size?: number }) {
  const colors: Record<string, string> = {
    "open-dental": "#2563eb",
    "dentrix": "#059669",
    "eaglesoft": "#7c3aed"
  };
  const labels: Record<string, string> = {
    "open-dental": "OD",
    "dentrix": "DX",
    "eaglesoft": "ES"
  };
  return (
    <div
      className="rounded-lg flex items-center justify-center text-white font-bold"
      style={{ width: size, height: size, backgroundColor: colors[software] || "#6b7280", fontSize: size * 0.35 }}
    >
      {labels[software] || "??"}
    </div>
  );
}

export default function DentalIntegrations() {
  const [activeTab, setActiveTab] = useState("overview");
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [connectSoftware, setConnectSoftware] = useState("");
  const { toast } = useToast();
  const { hasFeature, isLoading: subLoading } = useSubscription();
  const { open: upgradeOpen, setOpen: setUpgradeOpen, trigger: upgradeTrigger, show: showUpgrade } =
    useSoftUpgradePrompt("dental_integrations");
  const dentalUnlocked = subLoading || hasFeature("dental_integrations");

  const { data: softwareData } = useQuery<{ software: any[] }>({ queryKey: ["/api/dental-integrations/software"] });
  const { data: connectionsData, isLoading: connectionsLoading } = useQuery<{ connections: any[]; total: number }>({ queryKey: ["/api/dental-integrations/connections"] });
  const { data: summaryData } = useQuery<any>({ queryKey: ["/api/dental-integrations/unified-summary"] });
  const { data: appointmentsData } = useQuery<{ appointments: any[] }>({ queryKey: ["/api/dental-integrations/appointments"] });
  const { data: plansData } = useQuery<{ treatmentPlans: any[]; summary: any }>({ queryKey: ["/api/dental-integrations/treatment-plans"] });
  const { data: claimsData } = useQuery<{ claims: any[]; summary: any }>({ queryKey: ["/api/dental-integrations/claims"] });
  const { data: perioData } = useQuery<{ perioCharts: any[] }>({ queryKey: ["/api/dental-integrations/perio-charts"] });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("POST", `/api/dental-integrations/connections/${connectionId}/sync`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dental-integrations"] });
      toast({ title: "Sync complete", description: "Dental records synced successfully." });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const res = await apiRequest("DELETE", `/api/dental-integrations/connections/${connectionId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dental-integrations"] });
      toast({ title: "Disconnected", description: "Practice disconnected." });
    }
  });

  const connectMutation = useMutation({
    mutationFn: async (data: { software: string; practiceName: string; credentials: any }) => {
      const res = await apiRequest("POST", "/api/dental-integrations/connections", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dental-integrations"] });
      setConnectSoftware("");
      toast({ title: "Connected!", description: "New dental practice connected." });
    }
  });

  const aiMutation = useMutation({
    mutationFn: async (question: string) => {
      const res = await apiRequest("POST", "/api/dental-integrations/ai-dental-insights", { question });
      return res.json();
    },
    onSuccess: (data) => {
      setAiAnswer(data.answer);
    }
  });

  const connections = connectionsData?.connections || [];
  const software = softwareData?.software || [];
  const summary = summaryData || {};
  const appts = appointmentsData?.appointments || [];
  const plans = plansData?.treatmentPlans || [];
  const allClaims = claimsData?.claims || [];
  const perio = perioData?.perioCharts || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50/30 dark:from-gray-950 dark:to-blue-950/20">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-page-title">Dental Software Integration</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Connect Open Dental, Dentrix & Eaglesoft for a complete dental picture</p>
          </div>
        </div>

        {summary.connectedPractices > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span className="text-xs font-medium">Practices</span>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100" data-testid="text-practice-count">{summary.connectedPractices}</p>
              </CardContent>
            </Card>
            <Card className="bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-1">
                  <FileText className="w-4 h-4" />
                  <span className="text-xs font-medium">Records Synced</span>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100" data-testid="text-records-synced">{summary.totalRecordsSynced}</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium">Upcoming</span>
                </div>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100" data-testid="text-upcoming-count">{summary.upcomingAppointments}</p>
              </CardContent>
            </Card>
            <Card className="bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-medium">Out-of-Pocket</span>
                </div>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100" data-testid="text-oop-estimate">${summary.outOfPocketEstimate?.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
            <TabsTrigger value="treatment" data-testid="tab-treatment">Treatment</TabsTrigger>
            <TabsTrigger value="claims" data-testid="tab-claims">Claims</TabsTrigger>
            <TabsTrigger value="perio" data-testid="tab-perio">Perio</TabsTrigger>
            <TabsTrigger value="connect" data-testid="tab-connect">Connect</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {connectionsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : connections.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Stethoscope className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Dental Practices Connected</h3>
                  <p className="text-gray-500 mb-4">Connect your dental software to see all your records in one place.</p>
                  <Button data-testid="button-go-connect" onClick={() => setActiveTab("connect")}>Connect a Practice</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  {connections.map((conn: any) => (
                    <Card key={conn.id} data-testid={`card-connection-${conn.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <SoftwareIcon software={conn.software} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 dark:text-white">{conn.practiceName}</h3>
                              <StatusBadge status={conn.status} />
                              <Badge variant="outline" className="text-xs">{conn.softwareName}</Badge>
                            </div>
                            {conn.dentistName && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{conn.dentistName}</p>}
                            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                              {conn.practicePhone && (
                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{conn.practicePhone}</span>
                              )}
                              {conn.practiceAddress && (
                                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{conn.practiceAddress}</span>
                              )}
                              <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{conn.recordCount} records</span>
                              {conn.lastSyncAt && (
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Last sync: {new Date(conn.lastSyncAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              data-testid={`button-sync-${conn.id}`}
                              variant="outline" size="sm"
                              onClick={() =>
                                dentalUnlocked
                                  ? syncMutation.mutate(conn.id)
                                  : showUpgrade("dental_integrations")
                              }
                              disabled={syncMutation.isPending}
                            >
                              <RefreshCw className={`w-3 h-3 mr-1 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                              Sync
                            </Button>
                            <Button
                              data-testid={`button-disconnect-${conn.id}`}
                              variant="ghost" size="sm"
                              onClick={() => disconnectMutation.mutate(conn.id)}
                              disabled={disconnectMutation.isPending}
                            >
                              <Unlink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {summary.treatmentProgress > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                        Treatment Progress
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Progress value={summary.treatmentProgress} className="flex-1" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300" data-testid="text-treatment-progress">{summary.treatmentProgress}%</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {summary.activeTreatmentPlans} active treatment plan(s) across your connected practices
                      </p>
                    </CardContent>
                  </Card>
                )}

                {summary.periodontalStatus && (
                  <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Activity className="w-5 h-5 text-amber-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">Periodontal Status</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Risk: <span className="font-medium capitalize">{summary.periodontalStatus.risk}</span>
                            {summary.periodontalStatus.stage && <> · {summary.periodontalStatus.stage}</>}
                            {" "}· Last exam: {new Date(summary.periodontalStatus.lastExamDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      AI Dental Assistant
                    </CardTitle>
                    <CardDescription>Ask about your dental records, treatment plans, or insurance coverage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      <Input
                        data-testid="input-ai-question"
                        placeholder="e.g., What procedures are still pending in my treatment plan?"
                        value={aiQuestion}
                        onChange={(e) => setAiQuestion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && aiQuestion.trim()) {
                            aiMutation.mutate(aiQuestion);
                          }
                        }}
                      />
                      <Button
                        data-testid="button-ask-ai"
                        onClick={() => aiQuestion.trim() && aiMutation.mutate(aiQuestion)}
                        disabled={aiMutation.isPending || !aiQuestion.trim()}
                      >
                        {aiMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["What procedures do I still need?", "How much will I owe out-of-pocket?", "When is my next cleaning?", "Explain my perio status"].map(q => (
                        <button
                          key={q}
                          data-testid={`button-quick-${q.slice(0, 10)}`}
                          className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                          onClick={() => { setAiQuestion(q); aiMutation.mutate(q); }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    {(aiAnswer || aiMutation.data?.answer) && (
                      <div className="mt-4 p-4 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="w-4 h-4 text-violet-600" />
                          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">AI Dental Assistant</span>
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{aiAnswer || aiMutation.data?.answer}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="appointments" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dental Appointments</h2>
              <Badge variant="outline">{appts.length} total</Badge>
            </div>

            {appts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-gray-500">No appointments found.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {appts.map((apt: any) => (
                  <Card key={apt.id} data-testid={`card-appointment-${apt.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <SoftwareIcon software={apt.software} size={32} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-gray-900 dark:text-white">{apt.type}</h3>
                            <StatusBadge status={apt.status} />
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{apt.providerName} · {apt.practiceName}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(apt.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} at {apt.time}
                            </span>
                            <span>{apt.duration} min</span>
                          </div>
                          {apt.procedures?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {apt.procedures.map((p: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                            </div>
                          )}
                          {apt.notes && <p className="text-xs text-gray-500 mt-2 italic">{apt.notes}</p>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="treatment" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Treatment Plans</h2>
              {plansData?.summary && (
                <div className="text-sm text-gray-500">
                  Total: <span className="font-medium text-gray-900 dark:text-white">${plansData.summary.totalEstimate?.toLocaleString()}</span>
                  {" "}· Insurance: <span className="text-green-600">${plansData.summary.totalInsurance?.toLocaleString()}</span>
                  {" "}· You: <span className="text-amber-600">${plansData.summary.totalPatient?.toLocaleString()}</span>
                </div>
              )}
            </div>

            {plans.map((plan: any) => (
              <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <SoftwareIcon software={plan.software} size={28} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{plan.planName}</CardTitle>
                        <StatusBadge status={plan.status} />
                      </div>
                      <CardDescription>Created {new Date(plan.createdDate).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white">${plan.patientEstimate.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">your estimated cost</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {plan.procedures.map((proc: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <div className="w-5 h-5 flex items-center justify-center">
                          {proc.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : proc.status === "scheduled" ? (
                            <Clock className="w-4 h-4 text-blue-500" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-400">{proc.code}</span>
                            <span className="text-sm text-gray-900 dark:text-white">{proc.description}</span>
                            {proc.toothNumber && <Badge variant="outline" className="text-xs">#{proc.toothNumber}</Badge>}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-gray-900 dark:text-white">${proc.fee}</span>
                          <span className="text-xs text-gray-500 ml-1">(you: ${proc.patientPays})</span>
                        </div>
                        <Badge variant={proc.priority === "urgent" ? "destructive" : proc.priority === "high" ? "default" : "outline"} className="text-xs">{proc.priority}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="claims" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Insurance Claims</h2>
              {claimsData?.summary && (
                <div className="text-sm text-gray-500">
                  Charged: <span className="font-medium">${claimsData.summary.totalCharged?.toLocaleString()}</span>
                  {" "}· Paid: <span className="text-green-600">${claimsData.summary.totalPaid?.toLocaleString()}</span>
                  {" "}· Owed: <span className="text-amber-600">${claimsData.summary.totalOwed?.toLocaleString()}</span>
                </div>
              )}
            </div>

            {allClaims.map((claim: any) => (
              <Card key={claim.id} data-testid={`card-claim-${claim.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <SoftwareIcon software={claim.software} size={28} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-gray-900 dark:text-white">{claim.claimNumber}</h3>
                        <StatusBadge status={claim.status} />
                        <Badge variant="outline" className="text-xs">{claim.carrier}</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Service: {new Date(claim.dateOfService).toLocaleDateString()} · Filed: {new Date(claim.dateFiled).toLocaleDateString()}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {claim.procedures.map((p: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-xs">{p.code} - {p.description} (${p.fee})</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">${claim.totalCharged}</p>
                      {claim.insurancePaid > 0 && <p className="text-xs text-green-600">-${claim.insurancePaid} insurance</p>}
                      <p className="text-xs font-medium text-amber-600">You owe: ${claim.patientOwes}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="perio" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Periodontal Charts</h2>
              <Badge variant="outline">{perio.length} exam(s)</Badge>
            </div>

            {perio.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-gray-500">No periodontal data synced yet.</CardContent></Card>
            ) : perio.map((chart: any) => (
              <Card key={chart.id} data-testid={`card-perio-${chart.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <SoftwareIcon software={chart.software} size={28} />
                    <div className="flex-1">
                      <CardTitle className="text-base">Periodontal Examination</CardTitle>
                      <CardDescription>{chart.providerName} · {new Date(chart.date).toLocaleDateString()}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={chart.gingivitisRisk === "high" ? "destructive" : chart.gingivitisRisk === "moderate" ? "default" : "secondary"}>
                        {chart.gingivitisRisk} risk
                      </Badge>
                      {chart.periodontitisStage && <Badge variant="outline">{chart.periodontitisStage}</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-gray-700 dark:text-gray-300">{chart.overallAssessment}</p>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Pocket Depth Readings</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {chart.readings.map((r: any) => {
                        const maxDepth = Math.max(...r.buccal, ...r.lingual);
                        const depthColor = maxDepth >= 5 ? "bg-red-100 dark:bg-red-950 border-red-300" : maxDepth >= 4 ? "bg-amber-100 dark:bg-amber-950 border-amber-300" : "bg-green-100 dark:bg-green-950 border-green-300";
                        return (
                          <div key={r.tooth} className={`rounded-lg border p-2 ${depthColor}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold">#{r.tooth}</span>
                              <div className="flex items-center gap-1">
                                {r.bleedingOnProbing && <span className="w-2 h-2 rounded-full bg-red-500" title="Bleeding on probing" />}
                                {r.mobility && <span className="text-xs text-red-600">M{r.mobility}</span>}
                              </div>
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              <div>B: {r.buccal.join("-")}</div>
                              <div>L: {r.lingual.join("-")}</div>
                              {r.recession && <div className="text-red-600">Rec: {r.recession}mm</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> 1-3mm Normal</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-400" /> 4mm Watch</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-400" /> 5mm+ Concern</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Bleeding</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="connect" className="space-y-4 mt-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Connect Dental Software</h2>
              <p className="text-sm text-gray-500">Link your dental practice's software to automatically sync your records</p>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {software.map((sw: any) => {
                const isConnected = connections.some((c: any) => c.software === sw.id);
                return (
                  <Card key={sw.id} data-testid={`card-software-${sw.id}`} className={connectSoftware === sw.id ? "ring-2 ring-blue-500" : ""}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <SoftwareIcon software={sw.id} size={40} />
                        <div>
                          <CardTitle className="text-base">{sw.name}</CardTitle>
                          <CardDescription className="text-xs">{sw.vendor}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{sw.description}</p>
                      <div>
                        <p className="text-xs font-medium mb-1">Capabilities:</p>
                        <div className="flex flex-wrap gap-1">
                          {sw.capabilities.slice(0, 6).map((cap: string) => (
                            <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                          ))}
                          {sw.capabilities.length > 6 && <Badge variant="secondary" className="text-xs">+{sw.capabilities.length - 6} more</Badge>}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">API:</span> {sw.apiType.toUpperCase()} · <span className="font-medium">Auth:</span> {sw.authMethod} · <span className="font-medium">Versions:</span> {sw.supportedVersions.join(", ")}
                      </div>
                      {isConnected ? (
                        <Button variant="outline" className="w-full" disabled>
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          Already Connected
                        </Button>
                      ) : (
                        <Button
                          data-testid={`button-connect-${sw.id}`}
                          className="w-full"
                          onClick={() => setConnectSoftware(connectSoftware === sw.id ? "" : sw.id)}
                        >
                          <Link2 className="w-4 h-4 mr-2" />
                          Connect {sw.name}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {connectSoftware && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader>
                  <CardTitle className="text-base">Connect to {software.find((s: any) => s.id === connectSoftware)?.name}</CardTitle>
                  <CardDescription>Follow these steps to link your dental practice</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {software.find((s: any) => s.id === connectSoftware)?.setupSteps.map((step: string, i: number) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const formData = new FormData(form);
                      connectMutation.mutate({
                        software: connectSoftware,
                        practiceName: formData.get("practiceName") as string,
                        credentials: {
                          apiKey: formData.get("apiKey"),
                          serverUrl: formData.get("serverUrl"),
                        }
                      });
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label htmlFor="dental-integrations-practice-name" className="text-sm font-medium">Practice Name</label>
                      <Input id="dental-integrations-practice-name" data-testid="input-practice-name" name="practiceName" placeholder="e.g., Smile Dental Care" required className="mt-1" />
                    </div>
                    <div>
                      <label htmlFor="dental-integrations-api-key-credentials" className="text-sm font-medium">API Key / Credentials</label>
                      <Input id="dental-integrations-api-key-credentials" data-testid="input-api-key" name="apiKey" type="password" placeholder="Enter your API key or credentials" required className="mt-1" />
                    </div>
                    <div>
                      <label htmlFor="dental-integrations-server-url-optional" className="text-sm font-medium">Server URL <span className="text-gray-400">(optional)</span></label>
                      <Input id="dental-integrations-server-url-optional" data-testid="input-server-url" name="serverUrl" placeholder="e.g., https://your-practice.opendental.com/api" className="mt-1" />
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <p className="text-xs text-blue-700 dark:text-blue-300">Your credentials are encrypted and stored securely. We never share your data with third parties.</p>
                    </div>
                    <Button data-testid="button-submit-connect" type="submit" className="w-full" disabled={connectMutation.isPending}>
                      {connectMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                      Connect Practice
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gray-50 dark:bg-gray-900/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">Don't see your dental software?</h4>
                    <p className="text-xs text-gray-500 mt-1">We currently support Open Dental, Dentrix, and Eaglesoft. Additional integrations (Curve Dental, Dentimax, Practice-Web) are coming soon. Contact your practice to ask which software they use.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <SoftUpgradePrompt
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        trigger={upgradeTrigger}
      />
    </div>
  );
}
