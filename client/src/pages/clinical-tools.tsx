import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { TrendSparkline } from "@/components/trend-sparkline";
import {
  AlertTriangle,
  Shield,
  UserCheck,
  Brain,
  QrCode,
  Download,
  Activity,
  ChevronRight,
  CircleAlert,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Link2,
  Loader2,
  Copy,
  ArrowRight,
} from "lucide-react";

const PATIENT_ID = "patient-001";

function NMNTab() {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  const { data: nmnRecords, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools/nmn/records"],
  });

  const validateMutation = useMutation({
    mutationFn: async (data: { firstName: string; middleName: string | null; lastName: string }) => {
      const res = await apiRequest("POST", "/api/infrastructure/clinical-tools/nmn/validate", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "NMN Validation Complete",
        description: data.result?.validationMessage || "Name validated",
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({ patientId, hasMiddleName, middleName }: { patientId: string; hasMiddleName: boolean; middleName?: string }) => {
      const res = await apiRequest("POST", `/api/infrastructure/clinical-tools/nmn/${patientId}/confirm`, { hasMiddleName, middleName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/clinical-tools/nmn/records"] });
      toast({ title: "NMN Status Updated", description: "Patient NMN status has been confirmed" });
    },
  });

  const statusColor = (status: string) => {
    switch (status) {
      case "CONFIRMED_NMN": return "default";
      case "HAS_MIDDLE_NAME": return "secondary";
      case "UNCONFIRMED": return "destructive";
      default: return "outline";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "CONFIRMED_NMN": return "NMN Confirmed";
      case "HAS_MIDDLE_NAME": return "Has Middle Name";
      case "UNCONFIRMED": return "Needs Confirmation";
      case "INITIAL_MISSING": return "Missing";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            NMN Validation Tool
          </CardTitle>
          <CardDescription>
            Validate and standardize patient names with explicit NMN (No Middle Name) enforcement per the NMN standard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="nmn-first-name">First Name</Label>
              <Input id="nmn-first-name" data-testid="input-nmn-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Sarah" />
            </div>
            <div>
              <Label htmlFor="nmn-middle-name">Middle Name</Label>
              <Input id="nmn-middle-name" data-testid="input-nmn-middle-name" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Leave empty for NMN" />
            </div>
            <div>
              <Label htmlFor="nmn-last-name">Last Name</Label>
              <Input id="nmn-last-name" data-testid="input-nmn-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Chen" />
            </div>
          </div>
          <Button
            data-testid="button-validate-nmn"
            onClick={() => validateMutation.mutate({ firstName, middleName: middleName || null, lastName })}
            disabled={!firstName || !lastName || validateMutation.isPending}
          >
            {validateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            <span className="ml-2">Validate Name</span>
          </Button>

          {validateMutation.data?.result && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={validateMutation.data.result.isNMN ? "default" : "secondary"} data-testid="badge-nmn-result">
                    {validateMutation.data.result.isNMN ? "NMN" : "Middle Name Present"}
                  </Badge>
                  {validateMutation.data.result.requiresConfirmation && (
                    <Badge variant="destructive">Requires Confirmation</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-nmn-message">{validateMutation.data.result.validationMessage}</p>
                <div className="text-sm">
                  <span className="font-medium">Standardized: </span>
                  <span data-testid="text-nmn-standardized">
                    {validateMutation.data.result.standardizedName.firstName}{" "}
                    <span className={validateMutation.data.result.isNMN ? "text-muted-foreground italic" : ""}>
                      {validateMutation.data.result.standardizedName.middleName}
                    </span>{" "}
                    {validateMutation.data.result.standardizedName.lastName}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Patient NMN Registry</CardTitle>
          <CardDescription>Track NMN status across all patient records</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {nmnRecords?.records?.map((record: any) => (
                <div key={record.patientId} className="flex items-center justify-between gap-4 p-3 rounded-md border" data-testid={`row-nmn-${record.patientId}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {record.firstName} {record.middleName || ""} {record.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{record.patientId}</p>
                  </div>
                  <Badge variant={statusColor(record.nmnStatus) as any} data-testid={`badge-nmn-status-${record.patientId}`}>
                    {statusLabel(record.nmnStatus)}
                  </Badge>
                  {record.nmnStatus === "UNCONFIRMED" && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-confirm-nmn-${record.patientId}`}
                        onClick={() => confirmMutation.mutate({ patientId: record.patientId, hasMiddleName: false })}
                        disabled={confirmMutation.isPending}
                      >
                        Confirm NMN
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SafetyAlertsTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools", PATIENT_ID, "safety-alerts"],
    queryFn: async () => {
      const res = await fetch(`/api/infrastructure/clinical-tools/${PATIENT_ID}/safety-alerts`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      return res.json();
    },
  });

  const { data: rangesData } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools/clinical-ranges"],
  });

  const alertIcon = (type: string) => {
    switch (type) {
      case "CRITICAL": return <CircleAlert className="h-5 w-5 text-red-500" />;
      case "WARNING": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      default: return <Activity className="h-5 w-5 text-blue-500" />;
    }
  };

  const alertBg = (type: string) => {
    switch (type) {
      case "CRITICAL": return "border-red-500/30 bg-red-500/5";
      case "WARNING": return "border-amber-500/30 bg-amber-500/5";
      default: return "border-blue-500/30 bg-blue-500/5";
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "RESOLVED": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "ACKNOWLEDGED": return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <CircleAlert className="h-4 w-4 text-red-500" />;
    }
  };

  const alerts = data?.alerts || [];
  const critical = alerts.filter((a: any) => a.type === "CRITICAL").length;
  const warning = alerts.filter((a: any) => a.type === "WARNING").length;
  const newAlerts = alerts.filter((a: any) => a.status === "NEW").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-500" data-testid="text-critical-count">{critical}</p>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-amber-500" data-testid="text-warning-count">{warning}</p>
            <p className="text-xs text-muted-foreground">Warning</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-alerts">{alerts.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-500" data-testid="text-new-alerts">{newAlerts}</p>
            <p className="text-xs text-muted-foreground">New</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Active Alerts
          </CardTitle>
          <CardDescription>Out-of-range vitals and lab values requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div key={alert.id} className={`p-4 rounded-md border ${alertBg(alert.type)}`} data-testid={`card-alert-${alert.id}`}>
                  <div className="flex items-start gap-3">
                    {alertIcon(alert.type)}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{alert.observationType}</span>
                        <Badge variant={alert.type === "CRITICAL" ? "destructive" : "secondary"}>
                          {alert.type}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {statusIcon(alert.status)}
                          <span className="text-xs text-muted-foreground">{alert.status}</span>
                        </div>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span>Value: <strong className="text-foreground">{alert.observedValue} {alert.unit}</strong></span>
                        <span>Normal: {alert.expectedRange.low}-{alert.expectedRange.high} {alert.unit}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{alert.recommendation}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {rangesData?.ranges && (
        <Card>
          <CardHeader>
            <CardTitle>Reference Ranges</CardTitle>
            <CardDescription>{rangesData.ranges.length} clinical parameters monitored</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {rangesData.ranges.map((range: any) => (
                <div key={range.code} className="flex items-center justify-between gap-2 p-2 text-sm rounded-md border" data-testid={`range-${range.code}`}>
                  <span className="truncate">{range.name}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{range.normalRange.low}-{range.normalRange.high} {range.unit}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
        <p className="text-xs text-muted-foreground" data-testid="text-safety-disclaimer">INFORMATIONAL ONLY: These alerts are for informational purposes and do not constitute clinical decision support (NO-CDS compliant). Always consult your healthcare provider for medical decisions.</p>
      </div>
    </div>
  );
}

function EpisodesTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools", PATIENT_ID, "episodes"],
    queryFn: async () => {
      const res = await fetch(`/api/infrastructure/clinical-tools/${PATIENT_ID}/episodes`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      return res.json();
    },
  });

  const outcomeIcon = (status: string) => {
    switch (status) {
      case "resolved": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "improving": return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case "stable": return <Minus className="h-4 w-4 text-amber-500" />;
      case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: string) => type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Episodes of Care
          </CardTitle>
          <CardDescription>Related clinical events grouped into unified care journeys</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              {data?.episodes?.map((ep: any) => (
                <div key={ep.id} className="p-4 rounded-md border" data-testid={`card-episode-${ep.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: ep.color }} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{ep.title}</span>
                        <Badge variant={ep.status === "active" ? "default" : ep.status === "ongoing" ? "secondary" : "outline"}>
                          {ep.status}
                        </Badge>
                        <Badge variant="outline">{typeLabel(ep.type)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{ep.primaryCondition}</p>
                      <p className="text-sm">{ep.careSummary}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {ep.startDate} {ep.endDate ? `to ${ep.endDate}` : "- Present"}
                        </span>
                        <span>{ep.eventCount} events</span>
                        {ep.outcomeStatus && (
                          <span className="flex items-center gap-1">
                            {outcomeIcon(ep.outcomeStatus)}
                            {typeLabel(ep.outcomeStatus)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
        <p className="text-xs text-muted-foreground" data-testid="text-episodes-disclaimer">INFORMATIONAL ONLY: Episode groupings are for organizational purposes and do not constitute clinical decision support (NO-CDS compliant). Always consult your healthcare provider for care decisions.</p>
      </div>
    </div>
  );
}

function AISummaryTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools", PATIENT_ID, "ai-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/infrastructure/clinical-tools/${PATIENT_ID}/ai-summary`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      return res.json();
    },
  });

  const summary = data?.summary;

  const trendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Care Summary (Last 6 Months)
          </CardTitle>
          {summary && (
            <CardDescription>
              Period: {summary.periodStart} to {summary.periodEnd} | Generated: {new Date(summary.generatedAt).toLocaleDateString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : summary ? (
            <div className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {summary.narrativeSummary.split("\n\n").map((para: string, i: number) => (
                  <p key={i} className="text-sm leading-relaxed" data-testid={`text-summary-para-${i}`}>{para}</p>
                ))}
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Key Highlights</h4>
                <div className="space-y-2">
                  {summary.keyHighlights.map((h: string, i: number) => (
                    <div key={i} className="flex items-start gap-2" data-testid={`text-highlight-${i}`}>
                      <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="text-sm">{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Health Trends</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summary.healthTrends.map((t: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-md border" data-testid={`card-trend-${i}`}>
                      {trendIcon(t.trend)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.metric}</p>
                        <p className="text-xs text-muted-foreground">{t.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold" data-testid="text-active-meds">{summary.activeMedications}</p>
                    <p className="text-xs text-muted-foreground">Active Medications</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold" data-testid="text-recent-encounters">{summary.recentEncounters}</p>
                    <p className="text-xs text-muted-foreground">Recent Encounters</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-medium mb-3">Upcoming Actions</h4>
                <div className="space-y-2">
                  {summary.upcomingActions.map((a: string, i: number) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`text-action-${i}`}>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{a}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                <p className="text-xs text-muted-foreground" data-testid="text-ai-disclaimer">{summary.disclaimer}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SmartHealthCardsTab() {
  const { toast } = useToast();
  const [cardType, setCardType] = useState<string>("combined");
  const [generatedCard, setGeneratedCard] = useState<any>(null);

  const generateMutation = useMutation({
    mutationFn: async (type: string) => {
      const res = await apiRequest("POST", `/api/infrastructure/clinical-tools/${PATIENT_ID}/smart-health-card`, { type });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedCard(data.card);
      toast({ title: "Smart Health Card Generated", description: `${data.card.type} card created successfully` });
    },
  });

  const copyQR = () => {
    if (generatedCard?.qrData) {
      navigator.clipboard.writeText(generatedCard.qrData);
      toast({ title: "Copied", description: "QR data copied to clipboard" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Smart Health Card Generator
          </CardTitle>
          <CardDescription>
            Generate SMART Health Cards (SHC) for secure sharing of vaccination, medication, and lab data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {["vaccination", "medication", "lab_result", "combined"].map((type) => (
              <Button
                key={type}
                variant={cardType === type ? "default" : "outline"}
                className="toggle-elevate"
                onClick={() => setCardType(type)}
                data-testid={`button-shc-type-${type}`}
              >
                {type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
              </Button>
            ))}
          </div>
          <Button
            onClick={() => generateMutation.mutate(cardType)}
            disabled={generateMutation.isPending}
            data-testid="button-generate-shc"
          >
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
            <span className="ml-2">Generate Card</span>
          </Button>
        </CardContent>
      </Card>

      {generatedCard && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Card</CardTitle>
            <CardDescription>
              ID: {generatedCard.id} | Type: {generatedCard.type} | Expires: {new Date(generatedCard.expiresAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-center p-6 bg-white rounded-md border">
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-md">
                  <div className="text-center" data-testid="qr-placeholder">
                    <QrCode className="h-16 w-16 mx-auto text-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">SHC QR Code</p>
                    <p className="text-[10px] text-muted-foreground">{generatedCard.type}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>QR Payload</Label>
                <Button size="icon" variant="ghost" onClick={copyQR} data-testid="button-copy-qr">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-2 bg-muted rounded-md">
                <code className="text-xs break-all" data-testid="text-qr-data">{generatedCard.qrData}</code>
              </div>
            </div>

            <div className="space-y-2">
              <Label>FHIR Bundle Contents</Label>
              <div className="space-y-1">
                {generatedCard.payload.vc.credentialSubject.fhirBundle.entry.map((entry: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-sm p-2 rounded-md border" data-testid={`text-shc-entry-${i}`}>
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{entry.resource.resourceType}</span>
                    {entry.resource.name && (
                      <span className="text-muted-foreground">- {entry.resource.name[0]?.given?.[0]} {entry.resource.name[0]?.family}</span>
                    )}
                    {entry.resource.vaccineCode && (
                      <span className="text-muted-foreground">- {entry.resource.vaccineCode.coding[0]?.display}</span>
                    )}
                    {entry.resource.medicationCodeableConcept && (
                      <span className="text-muted-foreground">- {entry.resource.medicationCodeableConcept.coding[0]?.display}</span>
                    )}
                    {entry.resource.code && entry.resource.resourceType === "Observation" && (
                      <span className="text-muted-foreground">- {entry.resource.code.coding[0]?.display}: {entry.resource.valueQuantity?.value}{entry.resource.valueQuantity?.unit}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Verification URL: {generatedCard.verificationUrl}</p>
              <p>Issuer: {generatedCard.payload.iss}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BulkExportTab() {
  const { toast } = useToast();
  const [exportJob, setExportJob] = useState<any>(null);

  const exportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/infrastructure/clinical-tools/${PATIENT_ID}/fhir/bulk-export`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setExportJob(data.job);
      toast({ title: "Export Complete", description: `${data.job.totalResources} resources exported in NDJSON format` });
    },
  });

  const downloadExport = async () => {
    if (!exportJob) return;
    try {
      const res = await fetch(`/api/infrastructure/clinical-tools/fhir/export/${exportJob.jobId}/download`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fhir-export-${exportJob.jobId}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "NDJSON file saved" });
    } catch {
      toast({ title: "Error", description: "Failed to download export", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            FHIR Bulk Export
          </CardTitle>
          <CardDescription>
            One-click NDJSON export of all patient health data for portability and interoperability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-md border space-y-2">
            <h4 className="font-medium text-sm">Export includes:</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {["Patient", "Condition", "Observation", "MedicationStatement", "Immunization", "AllergyIntolerance", "Encounter", "DiagnosticReport"].map((type) => (
                <div key={type} className="flex items-center gap-1">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span>{type}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            data-testid="button-start-export"
          >
            {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="ml-2">Export All Data (NDJSON)</span>
          </Button>
        </CardContent>
      </Card>

      {exportJob && (
        <Card>
          <CardHeader>
            <CardTitle>Export Results</CardTitle>
            <CardDescription>
              Job: {exportJob.jobId} | Status: {exportJob.status} | Total: {exportJob.totalResources} resources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {exportJob.outputFiles.map((file: any) => (
                <div key={file.type} className="flex items-center justify-between gap-4 p-2 rounded-md border" data-testid={`row-export-${file.type}`}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{file.type}</span>
                  </div>
                  <Badge variant="secondary">{file.count} {file.count === 1 ? "resource" : "resources"}</Badge>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={downloadExport} data-testid="button-download-ndjson">
                <Download className="h-4 w-4" />
                <span className="ml-2">Download NDJSON</span>
              </Button>
              <Button variant="outline" onClick={() => {
                if (exportJob?.ndjsonContent) {
                  navigator.clipboard.writeText(exportJob.ndjsonContent);
                  toast({ title: "Copied", description: "NDJSON content copied to clipboard" });
                }
              }} data-testid="button-copy-ndjson">
                <Copy className="h-4 w-4" />
                <span className="ml-2">Copy to Clipboard</span>
              </Button>
            </div>

            {exportJob.ndjsonContent && (
              <div className="max-h-64 overflow-auto">
                <pre className="p-3 bg-muted rounded-md text-xs whitespace-pre-wrap break-all" data-testid="text-ndjson-preview">
                  {exportJob.ndjsonContent.split("\n").slice(0, 10).join("\n")}
                  {exportJob.ndjsonContent.split("\n").length > 10 && `\n... and ${exportJob.ndjsonContent.split("\n").length - 10} more lines`}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SparklineLabsTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/infrastructure/clinical-tools", PATIENT_ID, "lab-sparklines"],
    queryFn: async () => {
      const res = await fetch(`/api/infrastructure/clinical-tools/${PATIENT_ID}/lab-sparklines`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      return res.json();
    },
  });

  const labs = data?.labs || [];
  const abnormal = labs.filter((l: any) => l.isAbnormal);
  const normal = labs.filter((l: any) => !l.isAbnormal);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-labs">{labs.length}</p>
            <p className="text-xs text-muted-foreground">Total Labs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-red-500" data-testid="text-abnormal-labs">{abnormal.length}</p>
            <p className="text-xs text-muted-foreground">Abnormal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-green-500" data-testid="text-normal-labs">{normal.length}</p>
            <p className="text-xs text-muted-foreground">Normal</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Lab Results with Trend Sparklines
          </CardTitle>
          <CardDescription>Micro-visualizations showing 6-month trends for each lab result</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {labs.map((lab: any) => (
                <div
                  key={lab.id}
                  className={`flex items-center gap-3 p-3 rounded-md border ${lab.isAbnormal ? "border-red-500/30 bg-red-500/5" : ""}`}
                  data-testid={`row-lab-${lab.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{lab.name}</span>
                      <span className="text-xs text-muted-foreground">({lab.code})</span>
                      {lab.isAbnormal && (
                        <Badge variant="destructive">Abnormal</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>
                        <strong className={`text-sm ${lab.isAbnormal ? "text-red-500" : "text-foreground"}`}>
                          {lab.latestValue}
                        </strong>{" "}
                        {lab.unit}
                      </span>
                      <span>Range: {lab.normalRange.min}-{lab.normalRange.max}</span>
                      <span>{lab.latestDate}</span>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <TrendSparkline
                      data={lab.history}
                      width={100}
                      height={28}
                      unit={lab.unit}
                      normalRange={lab.normalRange}
                      label={lab.name}
                      showTrendIndicator
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
        <p className="text-xs text-muted-foreground" data-testid="text-sparklines-disclaimer">INFORMATIONAL ONLY: Trend visualizations are for informational purposes and do not constitute clinical decision support (NO-CDS compliant). Always consult your healthcare provider for interpretation of lab results.</p>
      </div>
    </div>
  );
}

export default function ClinicalTools() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Clinical Tools</h1>
          <p className="text-muted-foreground mt-1">
            Advanced clinical data management, safety monitoring, and health record portability
          </p>
        </div>

        <Tabs defaultValue="safety-alerts">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="nmn" data-testid="tab-nmn">
              <UserCheck className="h-4 w-4 mr-1" />
              NMN
            </TabsTrigger>
            <TabsTrigger value="safety-alerts" data-testid="tab-safety-alerts">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Safety Alerts
            </TabsTrigger>
            <TabsTrigger value="episodes" data-testid="tab-episodes">
              <Link2 className="h-4 w-4 mr-1" />
              Episodes
            </TabsTrigger>
            <TabsTrigger value="ai-summary" data-testid="tab-ai-summary">
              <Brain className="h-4 w-4 mr-1" />
              AI Summary
            </TabsTrigger>
            <TabsTrigger value="smart-health-cards" data-testid="tab-smart-health-cards">
              <QrCode className="h-4 w-4 mr-1" />
              SHC
            </TabsTrigger>
            <TabsTrigger value="bulk-export" data-testid="tab-bulk-export">
              <Download className="h-4 w-4 mr-1" />
              FHIR Export
            </TabsTrigger>
            <TabsTrigger value="sparklines" data-testid="tab-sparklines">
              <Activity className="h-4 w-4 mr-1" />
              Sparklines
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nmn">
            <NMNTab />
          </TabsContent>
          <TabsContent value="safety-alerts">
            <SafetyAlertsTab />
          </TabsContent>
          <TabsContent value="episodes">
            <EpisodesTab />
          </TabsContent>
          <TabsContent value="ai-summary">
            <AISummaryTab />
          </TabsContent>
          <TabsContent value="smart-health-cards">
            <SmartHealthCardsTab />
          </TabsContent>
          <TabsContent value="bulk-export">
            <BulkExportTab />
          </TabsContent>
          <TabsContent value="sparklines">
            <SparklineLabsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
