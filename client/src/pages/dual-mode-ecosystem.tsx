import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  HardDrive,
  Heart,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  TrendingDown,
  Zap,
  Activity,
  FileText,
  ArrowLeftRight,
  Lightbulb,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const DEMO_SAID = "SAID-26-CA-0047291-J";

function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { label: string; variant: "destructive" | "default" | "secondary" | "outline" }> = {
    overdue: { label: "Overdue", variant: "destructive" },
    "due-soon": { label: "Due Soon", variant: "default" },
    recommended: { label: "Recommended", variant: "secondary" },
  };
  const c = config[urgency] || config.recommended;
  return <Badge variant={c.variant} data-testid={`badge-urgency-${urgency}`}>{c.label}</Badge>;
}

function GapTypeIcon({ type }: { type: string }) {
  const icons: Record<string, typeof Heart> = {
    lab: Activity,
    screening: Shield,
    immunization: Zap,
    dental: Heart,
    followup: Clock,
  };
  const Icon = icons[type] || Activity;
  return <Icon className="h-5 w-5" />;
}

export default function DualModeEcosystemPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("care-gaps");

  const careGapsQuery = useQuery<{
    saidPatientId: string;
    totalGaps: number;
    overdue: number;
    dueSoon: number;
    recommended: number;
    potentialSavings: number;
    gaps: Array<{
      id: string;
      saidPatientId: string;
      gapType: string;
      title: string;
      description: string;
      urgency: string;
      cptCode: string;
      specialty: string;
      medicareRate: number;
      questRate: number;
      savings: number;
      lastPerformed: string | null;
      recommendedBy: string;
      guidelineSource: string;
      dueDate: string;
      detectedAt: string;
    }>;
  }>({
    queryKey: ["/api/dual-mode/care-gaps", DEMO_SAID],
    queryFn: async () => {
      const res = await fetch(`/api/dual-mode/care-gaps/${DEMO_SAID}`);
      return res.json();
    },
  });

  const financialQuery = useQuery<{
    saidPatientId: string;
    periodStart: string;
    periodEnd: string;
    totalSavings: number;
    totalSpent: number;
    totalRetailCost: number;
    savingsBreakdown: Array<{
      category: string;
      itemCount: number;
      retailTotal: number;
      paidTotal: number;
      saved: number;
    }>;
    insights: string[];
    projectedAnnualSavings: number;
    model: string;
  }>({
    queryKey: ["/api/dual-mode/financial-health", DEMO_SAID],
    queryFn: async () => {
      const res = await fetch(`/api/dual-mode/financial-health/${DEMO_SAID}`);
      return res.json();
    },
  });

  const gcsCrossTalkQuery = useQuery<{
    tabulaBucket: {
      bucket: string;
      purpose: string;
      iamRole: string;
      accessible: boolean;
      encryptionMethod: string;
    };
    uninsuranceBucket: {
      bucket: string;
      purpose: string;
      iamRole: string;
      accessible: boolean;
      encryptionMethod: string;
    };
    crossTalkEnabled: boolean;
    iamSeparation: string;
    vpcServiceControls: boolean;
  }>({
    queryKey: ["/api/dual-mode/gcs-cross-talk"],
  });

  const architectureQuery = useQuery<any>({
    queryKey: ["/api/dual-mode/architecture"],
  });

  const fixThisMutation = useMutation({
    mutationFn: async (gapId: string) => {
      const res = await apiRequest("POST", "/api/dual-mode/fix-this", {
        saidPatientId: DEMO_SAID,
        gapId,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Hand-Off Generated",
        description: `${data.orderPreview.testName} — Medicare rate $${data.orderPreview.medicareRate} (save $${data.orderPreview.savings}). Deep link ready.`,
      });
    },
    onError: () => {
      toast({ title: "Handoff Failed", description: "Could not generate deep link.", variant: "destructive" });
    },
  });

  const overviewQuery = useQuery<{
    handoffWorkflow: {
      steps: Array<{ step: number; title: string; description: string; system: string }>;
    };
  }>({
    queryKey: ["/api/dual-mode/overview", DEMO_SAID],
    queryFn: async () => {
      const res = await fetch(`/api/dual-mode/overview/${DEMO_SAID}`);
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 p-4 md:p-6" data-testid="dual-mode-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">
                Dual-Mode Ecosystem
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Tabula Medica + Uninsurance — connected by SAID™ Patient ID
              </p>
            </div>
          </div>
          <Badge variant="outline" className="w-fit text-xs" data-testid="badge-said-id">
            SAID: {DEMO_SAID}
          </Badge>
        </div>

        {careGapsQuery.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card data-testid="card-stat-overdue">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{careGapsQuery.data.overdue}</div>
                <div className="text-xs text-slate-500">Overdue</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-due-soon">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{careGapsQuery.data.dueSoon}</div>
                <div className="text-xs text-slate-500">Due Soon</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-recommended">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{careGapsQuery.data.recommended}</div>
                <div className="text-xs text-slate-500">Recommended</div>
              </CardContent>
            </Card>
            <Card data-testid="card-stat-savings">
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${careGapsQuery.data.potentialSavings}
                </div>
                <div className="text-xs text-slate-500">Potential Savings</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full" data-testid="tabs-list">
            <TabsTrigger value="care-gaps" data-testid="tab-care-gaps">Care Gaps</TabsTrigger>
            <TabsTrigger value="workflow" data-testid="tab-workflow">Hand-Off</TabsTrigger>
            <TabsTrigger value="financial" data-testid="tab-financial">Financial</TabsTrigger>
            <TabsTrigger value="gcs" data-testid="tab-gcs">GCS Buckets</TabsTrigger>
            <TabsTrigger value="architecture" data-testid="tab-architecture">Architecture</TabsTrigger>
          </TabsList>

          <TabsContent value="care-gaps" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Care Gap Detection
                </CardTitle>
                <CardDescription>
                  Tabula Medica continuously monitors your health records against USPSTF, ADA, ACC/AHA, and CDC guidelines to detect overdue or missing care.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {careGapsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <span className="ml-2 text-sm text-slate-500">Analyzing health records...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {careGapsQuery.data?.gaps.map((gap) => (
                      <Card key={gap.id} className="border-l-4" style={{
                        borderLeftColor: gap.urgency === "overdue" ? "#ef4444" : gap.urgency === "due-soon" ? "#f59e0b" : "#3b82f6",
                      }} data-testid={`card-gap-${gap.id}`}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <GapTypeIcon type={gap.gapType} />
                                <h3 className="font-semibold text-sm">{gap.title}</h3>
                                <UrgencyBadge urgency={gap.urgency} />
                                <Badge variant="outline" className="text-xs">CPT {gap.cptCode}</Badge>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">{gap.description}</p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                <span>Guideline: {gap.recommendedBy}</span>
                                {gap.lastPerformed && <span>Last: {gap.lastPerformed}</span>}
                                <span>Due: {gap.dueDate}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <div className="text-xs text-slate-500">Medicare</div>
                                <div className="font-bold text-emerald-600">${gap.medicareRate}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-slate-500 line-through">Quest Retail</div>
                                <div className="font-bold text-slate-400 line-through">${gap.questRate}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs text-emerald-600 font-medium">Save</div>
                                <div className="font-bold text-emerald-600">${gap.savings}</div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white hover:from-blue-700 hover:to-emerald-700"
                                onClick={() => fixThisMutation.mutate(gap.id)}
                                disabled={fixThisMutation.isPending}
                                data-testid={`button-fix-this-${gap.id}`}
                              >
                                {fixThisMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    Fix This <ArrowRight className="h-3 w-3 ml-1" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-500" />
                  The Hand-Off Workflow
                </CardTitle>
                <CardDescription>
                  How Tabula Medica and Uninsurance work together to close care gaps at the lowest possible cost.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {overviewQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {overviewQuery.data?.handoffWorkflow.steps.map((step, i) => (
                      <div key={step.step} className="flex items-start gap-4" data-testid={`step-${step.step}`}>
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          i === 0 ? "bg-blue-600" : i === 1 ? "bg-purple-600" : i === 2 ? "bg-emerald-600" : "bg-amber-600"
                        }`}>
                          {step.step}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{step.title}</h3>
                            <Badge variant="outline" className="text-xs">{step.system}</Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{step.description}</p>
                        </div>
                        {i < (overviewQuery.data?.handoffWorkflow.steps.length || 0) - 1 && (
                          <ArrowRight className="h-5 w-5 text-slate-300 mt-3 hidden md:block" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Separator className="my-6" />

                <div className="space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Shield className="h-4 w-4 text-blue-500" />
                    Security Architecture
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Card className="bg-blue-50 dark:bg-blue-950/30" data-testid="card-security-identity">
                      <CardContent className="p-3">
                        <div className="font-medium text-sm text-blue-800 dark:text-blue-300">Shared Identity</div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          SAID™ is the primary key for both systems. TM holds the history, Uninsurance holds the active orders.
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-purple-50 dark:bg-purple-950/30" data-testid="card-security-xtoken">
                      <CardContent className="p-3">
                        <div className="font-medium text-sm text-purple-800 dark:text-purple-300">JWT xtoken</div>
                        <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                          HMAC-SHA256 signed, 15-min TTL. Contains SAID + CPT code + specialty. Audience-locked to uninsurance.care.
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-emerald-50 dark:bg-emerald-950/30" data-testid="card-security-loopback">
                      <CardContent className="p-3">
                        <div className="font-medium text-sm text-emerald-800 dark:text-emerald-300">Result Loopback</div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                          Quest results auto-synced back to Tabula Medica via Fasten API. FHIR R4 resources ingested and deduplicated.
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-500" />
                  Financial Health Summary
                </CardTitle>
                <CardDescription>
                  Vertex AI analyzes both GCS buckets to show how much you have saved by using Medicare-rate pricing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {financialQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                    <span className="ml-2 text-sm text-slate-500">Analyzing cross-bucket data...</span>
                  </div>
                ) : financialQuery.data ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800" data-testid="card-total-savings">
                        <CardContent className="p-4 text-center">
                          <TrendingDown className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                            ${financialQuery.data.totalSavings.toFixed(0)}
                          </div>
                          <div className="text-sm text-emerald-600">Total Saved</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {financialQuery.data.periodStart} to {financialQuery.data.periodEnd}
                          </div>
                        </CardContent>
                      </Card>
                      <Card data-testid="card-total-spent">
                        <CardContent className="p-4 text-center">
                          <DollarSign className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                            ${financialQuery.data.totalSpent.toFixed(0)}
                          </div>
                          <div className="text-sm text-blue-600">You Paid (Medicare Rate)</div>
                        </CardContent>
                      </Card>
                      <Card data-testid="card-retail-cost">
                        <CardContent className="p-4 text-center">
                          <DollarSign className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                          <div className="text-3xl font-bold text-slate-500 line-through">
                            ${financialQuery.data.totalRetailCost.toFixed(0)}
                          </div>
                          <div className="text-sm text-slate-500">Quest Retail Would Cost</div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card data-testid="card-projected-annual">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Projected Annual Savings</div>
                            <div className="text-2xl font-bold text-emerald-600">${financialQuery.data.projectedAnnualSavings.toFixed(0)}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">{financialQuery.data.model}</Badge>
                        </div>
                        <Progress
                          value={Math.min((financialQuery.data.totalSavings / Math.max(financialQuery.data.projectedAnnualSavings, 1)) * 100, 100)}
                          className="mt-3 h-2"
                        />
                        <div className="text-xs text-slate-500 mt-1">
                          {((financialQuery.data.totalSavings / Math.max(financialQuery.data.projectedAnnualSavings, 1)) * 100).toFixed(0)}% of projected annual savings achieved
                        </div>
                      </CardContent>
                    </Card>

                    {financialQuery.data.savingsBreakdown.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-sm mb-3">Savings by Category</h3>
                        <div className="space-y-2">
                          {financialQuery.data.savingsBreakdown.map((cat, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg border" data-testid={`row-category-${i}`}>
                              <div className="flex items-center gap-3">
                                <FileText className="h-4 w-4 text-slate-400" />
                                <div>
                                  <div className="font-medium text-sm">{cat.category}</div>
                                  <div className="text-xs text-slate-500">{cat.itemCount} item(s)</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm">
                                <span className="text-slate-400 line-through">${cat.retailTotal}</span>
                                <span className="text-blue-600">${cat.paidTotal}</span>
                                <span className="font-bold text-emerald-600">-${cat.saved}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" data-testid="card-insights">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-amber-500" />
                          AI Insights
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2">
                          {financialQuery.data.insights.map((insight, i) => (
                            <li key={i} className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gcs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-blue-500" />
                  GCS Cross-Talk Architecture
                </CardTitle>
                <CardDescription>
                  Separate GCS buckets with strict IAM roles. Vertex AI has read-only access to both for cross-system analysis.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {gcsCrossTalkQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : gcsCrossTalkQuery.data ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="border-blue-200 dark:border-blue-800 border-2" data-testid="card-bucket-tabula">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-blue-500" />
                            Bucket A: Tabula Medica
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-2">
                          <div className="flex justify-between"><span className="text-slate-500">Bucket:</span><code className="bg-blue-50 dark:bg-blue-950 px-1 rounded">{gcsCrossTalkQuery.data.tabulaBucket.bucket}</code></div>
                          <div className="flex justify-between"><span className="text-slate-500">Purpose:</span><span className="text-right max-w-[200px]">{gcsCrossTalkQuery.data.tabulaBucket.purpose}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">IAM:</span><span className="text-right text-xs break-all max-w-[200px]">{gcsCrossTalkQuery.data.tabulaBucket.iamRole}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Encryption:</span><span>{gcsCrossTalkQuery.data.tabulaBucket.encryptionMethod}</span></div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status:</span>
                            <Badge variant={gcsCrossTalkQuery.data.tabulaBucket.accessible ? "default" : "secondary"}>
                              {gcsCrossTalkQuery.data.tabulaBucket.accessible ? "Connected" : "Configured"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-emerald-200 dark:border-emerald-800 border-2" data-testid="card-bucket-uninsurance">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <HardDrive className="h-4 w-4 text-emerald-500" />
                            Bucket B: Uninsurance
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-2">
                          <div className="flex justify-between"><span className="text-slate-500">Bucket:</span><code className="bg-emerald-50 dark:bg-emerald-950 px-1 rounded">{gcsCrossTalkQuery.data.uninsuranceBucket.bucket}</code></div>
                          <div className="flex justify-between"><span className="text-slate-500">Purpose:</span><span className="text-right max-w-[200px]">{gcsCrossTalkQuery.data.uninsuranceBucket.purpose}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">IAM:</span><span className="text-right text-xs break-all max-w-[200px]">{gcsCrossTalkQuery.data.uninsuranceBucket.iamRole}</span></div>
                          <div className="flex justify-between"><span className="text-slate-500">Encryption:</span><span>{gcsCrossTalkQuery.data.uninsuranceBucket.encryptionMethod}</span></div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status:</span>
                            <Badge variant={gcsCrossTalkQuery.data.uninsuranceBucket.accessible ? "default" : "secondary"}>
                              {gcsCrossTalkQuery.data.uninsuranceBucket.accessible ? "Connected" : "Configured"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="bg-slate-50 dark:bg-slate-900" data-testid="card-iam-details">
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Lock className="h-4 w-4 text-slate-500" />
                          IAM Separation & VPC Service Controls
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="p-2 bg-white dark:bg-slate-800 rounded border">
                            <div className="font-medium">IAM Separation</div>
                            <Badge className="mt-1">{gcsCrossTalkQuery.data.iamSeparation}</Badge>
                            <p className="text-slate-500 mt-1">Each bucket has its own service account. No cross-bucket write access.</p>
                          </div>
                          <div className="p-2 bg-white dark:bg-slate-800 rounded border">
                            <div className="font-medium">VPC Service Controls</div>
                            <Badge className="mt-1">{gcsCrossTalkQuery.data.vpcServiceControls ? "Enabled" : "Disabled"}</Badge>
                            <p className="text-slate-500 mt-1">PHI perimeter restricts storage.googleapis.com within the security boundary.</p>
                          </div>
                          <div className="p-2 bg-white dark:bg-slate-800 rounded border">
                            <div className="font-medium">Cross-Talk Policy</div>
                            <Badge className="mt-1">{gcsCrossTalkQuery.data.crossTalkEnabled ? "Active" : "Inactive"}</Badge>
                            <p className="text-slate-500 mt-1">Vertex AI service account has read-only access to both buckets for Financial Health analysis.</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  System Architecture
                </CardTitle>
                <CardDescription>
                  How the Dual-Mode Ecosystem connects Tabula Medica and Uninsurance.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {architectureQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : architectureQuery.data ? (
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-sm mb-2">Shared Identity</h3>
                      <Card className="bg-blue-50 dark:bg-blue-950/30">
                        <CardContent className="p-3 text-xs space-y-1">
                          <div><span className="font-medium">Primary Key:</span> {architectureQuery.data.sharedIdentity.primaryKey}</div>
                          <div><span className="font-medium">Format:</span> <code>{architectureQuery.data.sharedIdentity.format}</code></div>
                          <div><span className="font-medium">Tabula Medica:</span> {architectureQuery.data.sharedIdentity.tabulaRole}</div>
                          <div><span className="font-medium">Uninsurance:</span> {architectureQuery.data.sharedIdentity.uninsuranceRole}</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm mb-2">Hand-Off Workflow</h3>
                      <div className="space-y-1">
                        {architectureQuery.data.handoffWorkflow.steps.map((step: string, i: number) => (
                          <div key={i} className="text-xs p-2 bg-white dark:bg-slate-800 rounded border flex items-start gap-2">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm mb-2">GCS Cross-Talk</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Card className="border-blue-200 dark:border-blue-800">
                          <CardContent className="p-3 text-xs">
                            <div className="font-medium text-blue-700 dark:text-blue-300">{architectureQuery.data.gcsCrossTalk.bucketA.name}</div>
                            <div className="text-slate-500 mt-1">{architectureQuery.data.gcsCrossTalk.bucketA.purpose}</div>
                            <div className="text-slate-500">IAM: {architectureQuery.data.gcsCrossTalk.bucketA.iam}</div>
                          </CardContent>
                        </Card>
                        <Card className="border-emerald-200 dark:border-emerald-800">
                          <CardContent className="p-3 text-xs">
                            <div className="font-medium text-emerald-700 dark:text-emerald-300">{architectureQuery.data.gcsCrossTalk.bucketB.name}</div>
                            <div className="text-slate-500 mt-1">{architectureQuery.data.gcsCrossTalk.bucketB.purpose}</div>
                            <div className="text-slate-500">IAM: {architectureQuery.data.gcsCrossTalk.bucketB.iam}</div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm mb-2">AI Layer</h3>
                      <Card className="bg-amber-50 dark:bg-amber-950/30">
                        <CardContent className="p-3 text-xs space-y-1">
                          <div><span className="font-medium">Engine:</span> {architectureQuery.data.aiLayer.engine}</div>
                          <div><span className="font-medium">Purpose:</span> {architectureQuery.data.aiLayer.purpose}</div>
                          <div className="mt-2 font-medium">Inputs:</div>
                          {architectureQuery.data.aiLayer.inputs.map((input: string, i: number) => (
                            <div key={i} className="ml-2">- {input}</div>
                          ))}
                          <div className="mt-1 font-medium">Outputs:</div>
                          {architectureQuery.data.aiLayer.outputs.map((output: string, i: number) => (
                            <div key={i} className="ml-2">- {output}</div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm mb-2">API Endpoints</h3>
                      <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 text-xs font-mono text-green-400 space-y-1">
                        {Object.entries(architectureQuery.data.endpoints).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-500">{key}:</span> {String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
