import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  ShieldAlert,
  Activity,
  Brain,
  Clock,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Server,
  Database,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Download,
  Eye,
  EyeOff,
  Zap,
  Target,
  Award,
  Loader2,
  Info,
  ArrowRight,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

export default function InternalAnalytics() {
  const [demoMode, setDemoMode] = useState(false);
  const [dupFilter, setDupFilter] = useState("all");

  const { data: dashboard, isLoading: dashLoading } = useQuery<any>({
    queryKey: ["/api/internal-analytics/dashboard"],
  });

  const { data: duplicates, isLoading: dupsLoading } = useQuery<any>({
    queryKey: ["/api/internal-analytics/duplicates", dupFilter],
    queryFn: () => fetch(`/api/internal-analytics/duplicates?status=${dupFilter}`).then(r => r.json()),
  });

  const { data: pivots } = useQuery<any>({
    queryKey: ["/api/internal-analytics/clinical-pivots"],
  });

  const { data: integrity } = useQuery<any>({
    queryKey: ["/api/internal-analytics/data-integrity"],
  });

  const { data: systemLoad } = useQuery<any>({
    queryKey: ["/api/internal-analytics/system-load"],
  });

  const { data: aiAccuracy } = useQuery<any>({
    queryKey: ["/api/internal-analytics/ai-accuracy"],
  });

  const { data: timeROI } = useQuery<any>({
    queryKey: ["/api/internal-analytics/time-roi"],
  });

  const { data: benchmarks } = useQuery<any>({
    queryKey: ["/api/internal-analytics/benchmarks"],
  });

  const { data: demoReport } = useQuery<any>({
    queryKey: ["/api/internal-analytics/demo-report"],
    enabled: demoMode,
  });

  const formatCurrency = (amount: number) => `$${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-status-${status}`}>Confirmed</Badge>;
      case "flagged": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" data-testid={`badge-status-${status}`}>Flagged</Badge>;
      case "dismissed": return <Badge variant="secondary" data-testid={`badge-status-${status}`}>Dismissed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (dashLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-8 w-8 text-primary" />
            Internal Analytics
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Silent metrics, waste monitoring, and performance benchmarking — PII/PHI stripped
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch id="demo-mode" checked={demoMode} onCheckedChange={setDemoMode} data-testid="switch-demo-mode" />
            <Label htmlFor="demo-mode" className="flex items-center gap-1">
              {demoMode ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Demo Mode
            </Label>
          </div>
          {demoMode && (
            <Button variant="outline" size="sm" data-testid="btn-export-report">
              <Download className="h-4 w-4 mr-1" /> Export PDF Report
            </Button>
          )}
        </div>
      </div>

      {demoMode && demoReport && (
        <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <FileText className="h-4 w-4 text-blue-600" />
          <AlertDescription data-testid="text-demo-mode-active">
            <strong>Demo Mode Active</strong> — Showing sales-ready aggregate data. {demoReport.reportPeriod}.
            All data is de-identified. <span className="text-muted-foreground text-xs">{demoReport.disclaimer}</span>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card data-testid="card-kpi-duplicates">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Duplicates Blocked</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-kpi-duplicates">{dashboard?.summary?.duplicatesConfirmed || 0}</p>
            <p className="text-xs text-green-600">of {dashboard?.summary?.totalDuplicatesFlagged || 0} flagged</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-savings">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Ghost Savings</span>
            </div>
            <p className="text-2xl font-bold text-green-600" data-testid="text-kpi-savings">{formatCurrency(dashboard?.summary?.combinedSavings || 0)}</p>
            <p className="text-xs text-muted-foreground">waste prevented this period</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-accuracy">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-muted-foreground">AI Accuracy</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-kpi-accuracy">{dashboard?.summary?.aiAccuracyRate || 0}%</p>
            <p className="text-xs text-muted-foreground">clinical extraction rate</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-time">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Avg. Time/Record</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-kpi-time">{dashboard?.summary?.avgTimePerRecord || 0}s</p>
            <p className="text-xs text-muted-foreground">vs 240s manual (82% faster)</p>
          </CardContent>
        </Card>
        <Card data-testid="card-kpi-integrity">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Target className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">Data Integrity</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-kpi-integrity">{dashboard?.summary?.dataIntegrityScore || 0}%</p>
            <p className="text-xs text-muted-foreground">record cleanliness score</p>
          </CardContent>
        </Card>
      </div>

      {demoMode && dashboard?.salesPitch && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Sales Talking Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(dashboard.salesPitch).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 p-3 rounded-lg bg-background border">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <p className="text-sm" data-testid={`text-pitch-${key}`}>{value as string}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="waste" className="space-y-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-6" data-testid="tabs-analytics">
          <TabsTrigger value="waste" data-testid="tab-waste">
            <ShieldAlert className="h-4 w-4 mr-1" /> Waste
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Server className="h-4 w-4 mr-1" /> System
          </TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">
            <Brain className="h-4 w-4 mr-1" /> AI
          </TabsTrigger>
          <TabsTrigger value="time" data-testid="tab-time">
            <Clock className="h-4 w-4 mr-1" /> Time ROI
          </TabsTrigger>
          <TabsTrigger value="integrity" data-testid="tab-integrity">
            <Target className="h-4 w-4 mr-1" /> Integrity
          </TabsTrigger>
          <TabsTrigger value="benchmarks" data-testid="tab-benchmarks">
            <Award className="h-4 w-4 mr-1" /> Benchmarks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="waste" className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-green-600" />
              Waste Monitor — Duplicate Test Prevention
            </h2>
            <Select value={dupFilter} onValueChange={setDupFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-dup-filter">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dashboard?.wasteMonitor && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-waste-flagged">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Total Flagged</p>
                  <p className="text-3xl font-bold">{dashboard.wasteMonitor.duplicatesFlagged}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-waste-blocked">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Confirmed Blocked</p>
                  <p className="text-3xl font-bold text-green-600">{dashboard.wasteMonitor.duplicatesBlocked}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-waste-month">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">Savings This Month</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(dashboard.wasteMonitor.savingsThisMonth)}</p>
                </CardContent>
              </Card>
              <Card data-testid="card-waste-alltime">
                <CardContent className="pt-4 text-center">
                  <p className="text-sm text-muted-foreground">All-Time Savings</p>
                  <p className="text-3xl font-bold text-green-600">{formatCurrency(dashboard.wasteMonitor.savingsAllTime)}</p>
                </CardContent>
              </Card>
            </div>
          )}

          {dashboard?.wasteMonitor?.topDuplicateTypes && (
            <Card data-testid="card-top-dup-types">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top Duplicate Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboard.wasteMonitor.topDuplicateTypes.map((t: any) => (
                    <div key={t.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium w-40">{t.type}</span>
                        <Badge variant="outline">{t.count} blocked</Badge>
                      </div>
                      <span className="font-semibold text-green-600">{formatCurrency(t.savings)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {dashboard?.wasteMonitor?.byHospital && (
            <Card data-testid="card-by-hospital">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Savings by Hospital / Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Organization</th>
                        <th className="text-center py-2 pr-4">Duplicates</th>
                        <th className="text-right py-2">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.wasteMonitor.byHospital.map((h: any) => (
                        <tr key={h.hospital} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{h.hospital}</td>
                          <td className="py-2 pr-4 text-center">{h.duplicates}</td>
                          <td className="py-2 text-right text-green-600 font-semibold">{formatCurrency(h.savings)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {dupsLoading ? (
            <div className="flex items-center justify-center h-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-base font-semibold">Individual Duplicate Flags</h3>
              {duplicates?.duplicates?.map((dup: any) => (
                <Card key={dup.id} data-testid={`card-dup-${dup.id}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{dup.testType}</span>
                          {getStatusBadge(dup.status)}
                          <Badge variant="outline" className="text-xs">{dup.hospitalId}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Original: {dup.originalDate} → Duplicate attempt: {dup.duplicateDate}
                        </p>
                        <p className="text-xs text-muted-foreground">Provider: {dup.provider} | User: {dup.userId}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(dup.estimatedCost)}</p>
                        <p className="text-xs text-muted-foreground">ghost savings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {pivots && (
            <Card data-testid="card-clinical-pivots">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Clinical Decision Pivots
                </CardTitle>
                <CardDescription>
                  Users who viewed an old lab result instead of ordering a new one — tracked by session flow
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Viewed Old Result</p>
                    <p className="text-2xl font-bold text-green-600">{pivots.viewedOldCount}</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Ordered New</p>
                    <p className="text-2xl font-bold text-orange-600">{pivots.orderedNewCount}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Deferred</p>
                    <p className="text-2xl font-bold text-blue-600">{pivots.deferredCount}</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="text-sm text-muted-foreground">Pivot Savings</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(pivots.totalSavings)}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Pivot Rate: <strong>{pivots.pivotRate}%</strong> of users chose to reference existing results rather than ordering a new test.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Load & EHR Sync Status
          </h2>

          {systemLoad && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-sys-active-syncs">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Active EHR Syncs</p>
                    <p className="text-3xl font-bold text-blue-600">{systemLoad.ehrSyncs.active}</p>
                    <p className="text-xs text-muted-foreground">{systemLoad.ehrSyncs.queued} queued</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-sys-completed">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Completed (24h)</p>
                    <p className="text-3xl font-bold text-green-600">{systemLoad.ehrSyncs.completed24h.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{systemLoad.ehrSyncs.failed24h} failed</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-sys-uptime">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Uptime</p>
                    <p className="text-3xl font-bold text-green-600">{systemLoad.apiHealth.uptime}%</p>
                    <p className="text-xs text-muted-foreground">Avg latency: {systemLoad.apiHealth.avgLatency}ms</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-sys-records">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <p className="text-3xl font-bold">{(systemLoad.storage.totalRecords / 1000000).toFixed(1)}M</p>
                    <p className="text-xs text-muted-foreground">{systemLoad.storage.storageUsedGB} GB used</p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-ehr-platforms">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">EHR Platform Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Platform</th>
                          <th className="text-center py-2 pr-4">Active Syncs</th>
                          <th className="text-center py-2 pr-4">Total Connections</th>
                          <th className="text-center py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {systemLoad.ehrSyncs.platforms.map((p: any) => (
                          <tr key={p.name} className="border-b last:border-0" data-testid={`row-ehr-${p.name.replace(/\s+/g, '-').toLowerCase()}`}>
                            <td className="py-2 pr-4 font-medium">{p.name}</td>
                            <td className="py-2 pr-4 text-center">{p.active}</td>
                            <td className="py-2 pr-4 text-center">{p.total.toLocaleString()}</td>
                            <td className="py-2 text-center">
                              <Badge className={p.status === "healthy" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"}>
                                {p.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-api-health">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">API Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2 p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Requests/Minute</p>
                      <p className="text-xl font-bold">{systemLoad.apiHealth.requestsPerMinute.toLocaleString()}</p>
                    </div>
                    <div className="space-y-2 p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">P95 Latency</p>
                      <p className="text-xl font-bold">{systemLoad.apiHealth.p95Latency}ms</p>
                    </div>
                    <div className="space-y-2 p-3 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Error Rate</p>
                      <p className="text-xl font-bold">{systemLoad.apiHealth.errorsPerMinute}/min</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Clinical Extraction Accuracy
          </h2>

          {aiAccuracy && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card data-testid="card-ai-total">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Extractions</p>
                    <p className="text-3xl font-bold">{aiAccuracy.overall.totalExtractions.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-ai-correct">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Correct</p>
                    <p className="text-3xl font-bold text-green-600">{aiAccuracy.overall.correctExtractions.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-ai-overrides">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Manual Overrides</p>
                    <p className="text-3xl font-bold text-orange-600">{aiAccuracy.overall.manualOverrides}</p>
                    <p className="text-xs text-muted-foreground">{aiAccuracy.overall.overrideRate}% override rate</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-ai-accuracy-overall">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                    <p className="text-3xl font-bold text-green-600">{aiAccuracy.overall.accuracyRate}%</p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-ai-by-category">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Accuracy by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Category</th>
                          <th className="text-center py-2 pr-4">Extractions</th>
                          <th className="text-center py-2 pr-4">Overrides</th>
                          <th className="text-center py-2 pr-4">Accuracy</th>
                          <th className="text-center py-2">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiAccuracy.byCategory.map((c: any) => (
                          <tr key={c.category} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{c.category}</td>
                            <td className="py-2 pr-4 text-center">{c.extractions.toLocaleString()}</td>
                            <td className="py-2 pr-4 text-center">{c.overrides}</td>
                            <td className="py-2 pr-4 text-center font-semibold">{c.accuracy}%</td>
                            <td className="py-2 text-center">
                              <Badge variant={c.trend === "improving" ? "default" : "outline"} className="text-xs">
                                {c.trend === "improving" ? <TrendingUp className="h-3 w-3 mr-1" /> : <ArrowRight className="h-3 w-3 mr-1" />}
                                {c.trend}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-recent-overrides">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recent Manual Overrides</CardTitle>
                  <CardDescription>Cases where clinicians corrected the AI — used for continuous model improvement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {aiAccuracy.recentOverrides.map((ovr: any) => (
                      <div key={ovr.id} className="p-3 border rounded-lg space-y-1" data-testid={`card-override-${ovr.id}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">{ovr.category}</Badge>
                          <span className="text-xs text-muted-foreground">{new Date(ovr.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="line-through text-muted-foreground">{ovr.original}</span>
                          <ArrowRight className="h-3 w-3 shrink-0" />
                          <span className="font-medium text-green-600">{ovr.corrected}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ovr.reason}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="time" className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Return on Investment
          </h2>

          {timeROI && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-time-manual">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Manual Lookup</p>
                    <p className="text-3xl font-bold text-red-500">{timeROI.avgSecondsPerRecord.manual}s</p>
                    <p className="text-xs text-muted-foreground">industry average</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-time-ehr">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Typical EHR</p>
                    <p className="text-3xl font-bold text-orange-500">{timeROI.avgSecondsPerRecord.typicalEHR}s</p>
                    <p className="text-xs text-muted-foreground">with search tools</p>
                  </CardContent>
                </Card>
                <Card data-testid="card-time-tm">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Tabula Medica</p>
                    <p className="text-3xl font-bold text-green-600">{timeROI.avgSecondsPerRecord.tabulaMedica}s</p>
                    <p className="text-xs text-muted-foreground">AI-powered</p>
                  </CardContent>
                </Card>
                <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20" data-testid="card-time-improvement">
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm text-muted-foreground">Improvement</p>
                    <p className="text-3xl font-bold text-green-600">{timeROI.avgSecondsPerRecord.percentImprovement}%</p>
                    <p className="text-xs text-muted-foreground">faster than manual</p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-total-time-saved">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" /> Total Time Saved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Records Processed</p>
                      <p className="text-xl font-bold">{timeROI.totalTimeSaved.totalRecordsProcessed.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Hours Saved</p>
                      <p className="text-xl font-bold text-green-600">{timeROI.totalTimeSaved.totalHoursSaved.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Days Saved</p>
                      <p className="text-xl font-bold text-green-600">{timeROI.totalTimeSaved.totalDaysSaved}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Equivalent FTEs</p>
                      <p className="text-xl font-bold text-purple-600">{timeROI.totalTimeSaved.equivalentFTEs}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-time-by-task">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Time Savings by Task</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4">Task</th>
                          <th className="text-center py-2 pr-4">Manual (s)</th>
                          <th className="text-center py-2 pr-4">Tabula Medica (s)</th>
                          <th className="text-center py-2">Savings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {timeROI.byTask.map((t: any) => (
                          <tr key={t.task} className="border-b last:border-0">
                            <td className="py-2 pr-4 font-medium">{t.task}</td>
                            <td className="py-2 pr-4 text-center text-red-500">{t.manualSeconds}s</td>
                            <td className="py-2 pr-4 text-center text-green-600 font-semibold">{t.tmSeconds}s</td>
                            <td className="py-2 text-center">
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t.savings}%</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-weekly-trend">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Weekly Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-6">
                    {timeROI.weeklyTrend.map((w: any) => (
                      <div key={w.week} className="text-center p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">{w.week}</p>
                        <p className="text-sm font-bold">{(w.records / 1000).toFixed(1)}K</p>
                        <p className="text-xs text-green-600">{w.avgTime}s avg</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="integrity" className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Target className="h-5 w-5" />
            Data Integrity Score
          </h2>

          {integrity && (
            <>
              <Card className="border-green-500/30" data-testid="card-integrity-overall">
                <CardContent className="pt-6">
                  <div className="text-center mb-6">
                    <p className="text-sm text-muted-foreground mb-1">Overall Data Integrity Score</p>
                    <p className="text-6xl font-bold text-green-600">{integrity.overallScore}%</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <TrendingUp className="h-3 w-3 mr-1" /> {integrity.trend}
                      </Badge>
                      <Badge variant="outline">Risk: {integrity.riskLevel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{integrity.riskDescription}</p>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-integrity-components">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Score Components</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {integrity.components.map((c: any) => (
                      <div key={c.name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">(weight: {(c.weight * 100).toFixed(0)}%)</span>
                          </div>
                          <span className="font-semibold">{c.score}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div className={`h-2 rounded-full ${c.score >= 97 ? 'bg-green-500' : c.score >= 95 ? 'bg-blue-500' : 'bg-yellow-500'}`}
                            style={{ width: `${c.score}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-integrity-history">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Historical Scores</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 md:grid-cols-6">
                    {integrity.historicalScores.map((h: any) => (
                      <div key={h.month} className="text-center p-3 border rounded-lg">
                        <p className="text-xs text-muted-foreground">{h.month}</p>
                        <p className="text-lg font-bold">{h.score}%</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="benchmarks" className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Award className="h-5 w-5" />
            Industry Benchmark Comparison
          </h2>

          {benchmarks && (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Benchmarks sourced from AHIMA, CHIME, and ONC reports on healthcare data quality and interoperability standards.
                  Tabula Medica outperforms industry averages across all measured dimensions.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                {benchmarks.ourPerformance && Object.entries(benchmarks.ourPerformance).map(([key, perf]: [string, any]) => (
                  <Card key={key} data-testid={`card-benchmark-${key}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="space-y-1">
                          <p className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Industry</p>
                              <p className="text-lg font-semibold text-orange-500">
                                {typeof perf.benchmark === 'object'
                                  ? `${perf.benchmark.industry || perf.benchmark.average || perf.benchmark.manual}${perf.benchmark.unit}`
                                  : perf.benchmark}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-xs text-muted-foreground">Tabula Medica</p>
                              <p className="text-lg font-semibold text-green-600">
                                {typeof perf.value === 'number' ? `${perf.value}${perf.benchmark?.unit || ''}` : perf.value}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-sm px-3 py-1">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {perf.verdict}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}

          {demoMode && demoReport?.sections?.benchmarkComparison && (
            <Card className="border-primary/30 bg-primary/5" data-testid="card-demo-benchmarks">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Demo Report — Benchmark Summary Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Metric</th>
                        <th className="text-center py-2 pr-4">Industry Standard</th>
                        <th className="text-center py-2 pr-4">Tabula Medica</th>
                        <th className="text-center py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {demoReport.sections.benchmarkComparison.metrics.map((m: any) => (
                        <tr key={m.metric} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{m.metric}</td>
                          <td className="py-2 pr-4 text-center text-orange-500">{m.industry}</td>
                          <td className="py-2 pr-4 text-center text-green-600 font-semibold">{m.tabulaMedica}</td>
                          <td className="py-2 text-center">
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{m.verdict}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
