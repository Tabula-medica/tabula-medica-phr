/**
 * Provider / Lab / Hospital Onboarding Hub — Web Page (Task #296)
 *
 * Five persona tabs, each with its own step sequence:
 *   Clinician/Practice — 5 steps
 *   Lab               — 4 steps
 *   Radiology         — 3 steps
 *   Hospital          — 4 steps
 *   DPC               — 4 steps
 *
 * Session is persisted server-side so the user can resume across devices.
 */

import { useState, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  SkipForward,
  Stethoscope,
  FlaskConical,
  Scan,
  Building2,
  Heart,
  Globe,
  Webhook,
  ShieldCheck,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Upload,
  Users,
  CreditCard,
  CheckSquare,
  Activity,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProviderPersona = "provider" | "lab" | "radiology" | "hospital" | "dpc";

type StepStatus = "pending" | "in_progress" | "completed" | "skipped";

interface StepState {
  stepId: string;
  label: string;
  status: StepStatus;
  data?: Record<string, unknown>;
}

interface ProviderOnboardingSession {
  sessionId: string;
  persona: ProviderPersona;
  orgName: string;
  contactEmail: string;
  npiNumber?: string;
  steps: StepState[];
  overallStatus: "in_progress" | "completed";
  fhirBaseUrl?: string;
  fhirTestResult?: FhirTestResult;
  webhookEndpointUrl?: string;
}

interface FhirTestResult {
  ok: boolean;
  statusCode?: number;
  fhirVersion?: string;
  softwareName?: string;
  error?: string;
  testedAt: string;
}

interface WebhookProvision {
  endpointUrl: string;
  secretPlaintext: string;
  algorithm: string;
  headerName: string;
}

// ─── Persona metadata ─────────────────────────────────────────────────────────

const PERSONA_META: Record<ProviderPersona, { label: string; icon: React.ReactNode; shortLabel: string }> = {
  provider:  { label: "Clinician / Practice", shortLabel: "Clinician", icon: <Stethoscope className="h-4 w-4" /> },
  lab:       { label: "Clinical Laboratory",  shortLabel: "Lab",       icon: <FlaskConical className="h-4 w-4" /> },
  radiology: { label: "Radiology / Imaging",  shortLabel: "Radiology", icon: <Scan className="h-4 w-4" /> },
  hospital:  { label: "Hospital / Health System", shortLabel: "Hospital", icon: <Building2 className="h-4 w-4" /> },
  dpc:       { label: "DPC Practice",         shortLabel: "DPC",       icon: <Heart className="h-4 w-4" /> },
};

const EHR_OPTIONS = [
  { id: "epic",           label: "Epic",           note: "MyApps / SMART-on-FHIR" },
  { id: "eclinicalworks", label: "eClinicalWorks",  note: "healow / FHIR R4" },
  { id: "athena",         label: "athenahealth",    note: "FHIR R4" },
  { id: "fhir_generic",   label: "Generic FHIR R4", note: "Any FHIR R4 endpoint" },
];

const RESULT_DELIVERY_OPTIONS = [
  { id: "fhir_webhook", label: "FHIR R4 DiagnosticReport webhook", note: "RESTful push via HTTPS" },
  { id: "hl7_sftp",     label: "HL7 v2 SFTP",                      note: "Secure File Transfer Protocol" },
];

// ─── Step helpers ─────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "skipped")   return <SkipForward   className="h-5 w-5 text-muted-foreground" />;
  if (status === "in_progress") return <Clock       className="h-5 w-5 text-yellow-500" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

function calcProgress(steps: StepState[]): number {
  const done = steps.filter((s) => s.status === "completed" || s.status === "skipped").length;
  return Math.round((done / steps.length) * 100);
}

// ─── Common field components ─────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function ProviderOnboarding() {
  const { toast } = useToast();

  // Pre-session state
  const [activePersona, setActivePersona] = useState<ProviderPersona>("provider");
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [npiNumber, setNpiNumber] = useState("");

  // Active session
  const [session, setSession] = useState<ProviderOnboardingSession | null>(null);

  // Webhook modal
  const [webhookProvision, setWebhookProvision] = useState<WebhookProvision | null>(null);
  const [webhookModalOpen, setWebhookModalOpen] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  // ── Resume: restore prior session for authenticated user (cross-device) ────
  // Calls the user-scoped status endpoint so any device can resume the same session.

  const resumeQuery = useQuery({
    queryKey: ["/api/onboarding/provider/status"],
    queryFn: async () => {
      const resp = await fetch("/api/onboarding/provider/status", {
        credentials: "include",
      });
      if (!resp.ok) return null;
      return resp.json() as Promise<{ session: ProviderOnboardingSession | null }>;
    },
    retry: false,
    enabled: !session,
  });

  useEffect(() => {
    if (resumeQuery.data?.session && !session) {
      const s = resumeQuery.data.session;
      if (s.overallStatus !== "abandoned") {
        setSession(s);
      }
    }
  }, [resumeQuery.data, session]);

  // ── Start mutation ────────────────────────────────────────────────────────

  const startMutation = useMutation({
    mutationFn: async (persona: ProviderPersona) => {
      const resp = await apiRequest("POST", "/api/onboarding/provider/start", {
        persona,
        orgName: orgName.trim(),
        contactEmail: contactEmail.trim(),
        npiNumber: npiNumber.trim() || undefined,
      });
      return resp.json() as Promise<{ session: ProviderOnboardingSession }>;
    },
    onSuccess: (data) => {
      setSession(data.session);
      toast({ title: "Session started", description: `Welcome, ${data.session.orgName}` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── Step mutation ─────────────────────────────────────────────────────────

  const stepMutation = useMutation({
    mutationFn: async (params: {
      stepId: string;
      data?: Record<string, unknown>;
      skip?: boolean;
    }) => {
      const resp = await apiRequest("POST", "/api/onboarding/provider/step", {
        sessionId: session!.sessionId,
        ...params,
      });
      return resp.json() as Promise<{ session: ProviderOnboardingSession }>;
    },
    onSuccess: (data) => {
      setSession(data.session);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // ── FHIR test mutation ────────────────────────────────────────────────────

  const fhirMutation = useMutation({
    mutationFn: async (fhirBaseUrl: string) => {
      const resp = await apiRequest("POST", "/api/onboarding/provider/test-fhir", {
        sessionId: session!.sessionId,
        fhirBaseUrl,
      });
      return resp.json() as Promise<{ result: FhirTestResult }>;
    },
    onSuccess: (data) => {
      if (data.result.ok) {
        toast({ title: "FHIR endpoint reachable", description: `FHIR ${data.result.fhirVersion ?? "R4"}` });
      } else {
        toast({ title: "FHIR test failed", description: data.result.error, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Test error", description: err.message, variant: "destructive" });
    },
  });

  // ── Webhook provision mutation ────────────────────────────────────────────

  const webhookMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiRequest("POST", "/api/onboarding/provider/provision-webhook", {
        sessionId: session!.sessionId,
      });
      return resp.json() as Promise<{ provision: WebhookProvision }>;
    },
    onSuccess: (data) => {
      setWebhookProvision(data.provision);
      setWebhookModalOpen(true);
      stepMutation.mutate({
        stepId: "webhook_provision",
        data: { endpointUrl: data.provision.endpointUrl },
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied to clipboard" }));
  }, [toast]);

  // ── Pre-session persona picker ────────────────────────────────────────────

  if (!session) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Provider Onboarding Hub
            </h1>
            <p className="text-muted-foreground">
              Connect your practice, lab, or hospital to Tabula Medica in minutes
            </p>
          </div>
        </div>

        <Tabs value={activePersona} onValueChange={(v) => setActivePersona(v as ProviderPersona)}>
          <TabsList className="grid w-full grid-cols-5 mb-6">
            {(Object.entries(PERSONA_META) as [ProviderPersona, typeof PERSONA_META[ProviderPersona]][]).map(
              ([id, meta]) => (
                <TabsTrigger key={id} value={id} data-testid={`tab-persona-${id}`} className="flex items-center gap-1.5 text-xs">
                  {meta.icon}
                  {meta.shortLabel}
                </TabsTrigger>
              ),
            )}
          </TabsList>

          {(Object.keys(PERSONA_META) as ProviderPersona[]).map((persona) => (
            <TabsContent key={persona} value={persona}>
              <div className="grid gap-6 lg:grid-cols-2">
                <PersonaInfoCard persona={persona} />
                <Card>
                  <CardHeader>
                    <CardTitle>Start Onboarding</CardTitle>
                    <CardDescription>
                      Enter your organization details to begin
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Organization / Practice Name *">
                      <Input
                        data-testid="input-orgName"
                        placeholder="e.g. Riverside Family Medicine"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                      />
                    </Field>
                    <Field label="Primary Contact Email *">
                      <Input
                        type="email"
                        data-testid="input-contactEmail"
                        placeholder="admin@yourpractice.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                      />
                    </Field>
                    {(persona === "provider" || persona === "dpc") && (
                      <Field
                        label="NPI Number"
                        hint="10-digit National Provider Identifier — required by HIPAA for billing"
                      >
                        <Input
                          data-testid="input-npiNumber"
                          placeholder="10-digit NPI"
                          maxLength={10}
                          value={npiNumber}
                          onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, ""))}
                        />
                      </Field>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      data-testid="button-start-onboarding"
                      disabled={
                        !orgName.trim() ||
                        !contactEmail.includes("@") ||
                        startMutation.isPending
                      }
                      onClick={() => startMutation.mutate(persona)}
                    >
                      {startMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Begin Onboarding
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    );
  }

  // ── Active wizard ─────────────────────────────────────────────────────────

  const progress = calcProgress(session.steps);
  const currentStep = session.steps.find((s) => s.status === "in_progress");
  const isComplete = session.overallStatus === "completed";

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {PERSONA_META[session.persona].icon}
          <div>
            <h1 className="text-xl font-bold" data-testid="text-session-org">
              {session.orgName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {PERSONA_META[session.persona].label} onboarding
            </p>
          </div>
        </div>
        <Badge
          className={
            isComplete
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
          }
        >
          {isComplete ? "Complete" : `${progress}%`}
        </Badge>
      </div>

      <Progress value={progress} className="mb-6 h-2" data-testid="progress-overall" />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Step sidebar */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-1">
            {session.steps.map((step, idx) => (
              <div
                key={step.stepId}
                data-testid={`step-item-${step.stepId}`}
                className={`flex items-center gap-2 p-2 rounded-md text-sm ${
                  step.status === "in_progress" ? "bg-accent" : ""
                }`}
              >
                <StepIcon status={step.status} />
                <span
                  className={`font-medium ${step.status === "pending" ? "text-muted-foreground" : ""}`}
                >
                  {idx + 1}. {step.label}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active step panel */}
        <div className="lg:col-span-2">
          {isComplete ? (
            <CompletionPanel session={session} />
          ) : (
            <ActiveStepPanel
              session={session}
              currentStep={currentStep}
              fhirMutation={fhirMutation}
              stepMutation={stepMutation}
              webhookMutation={webhookMutation}
            />
          )}
        </div>
      </div>

      {/* Webhook secret modal */}
      <Dialog open={webhookModalOpen} onOpenChange={setWebhookModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Webhook Endpoint Provisioned</DialogTitle>
            <DialogDescription>
              Save your webhook signing secret now — it will <strong>not</strong> be shown again.
            </DialogDescription>
          </DialogHeader>
          {webhookProvision && (
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Endpoint URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate text-xs bg-muted px-2 py-1.5 rounded">
                    {webhookProvision.endpointUrl}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(webhookProvision.endpointUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Signing Secret — {webhookProvision.algorithm} via {webhookProvision.headerName}
                </p>
                <div className="flex items-center gap-2">
                  <code
                    className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono"
                    data-testid="text-webhook-secret"
                  >
                    {secretVisible ? webhookProvision.secretPlaintext : "•".repeat(64)}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => setSecretVisible((v) => !v)}>
                    {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(webhookProvision.secretPlaintext)}
                    data-testid="button-copy-secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-destructive font-semibold">
                This secret will not be displayed again. Store it securely now.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => setWebhookModalOpen(false)}
              data-testid="button-close-webhook-modal"
            >
              I have saved the secret
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Persona info card (pre-session) ─────────────────────────────────────────

function PersonaInfoCard({ persona }: { persona: ProviderPersona }) {
  const configs: Record<ProviderPersona, { title: string; steps: string[]; note: string }> = {
    provider: {
      title: "5-step setup",
      steps: ["Practice info", "EHR selection (Epic, Athena, eCW, FHIR R4)", "FHIR endpoint test", "Team invites", "Go-live checklist"],
      note: "Connects your EHR so patients can pull records directly.",
    },
    lab: {
      title: "4-step setup",
      steps: ["Lab information", "Result delivery method (FHIR webhook or HL7 v2 SFTP)", "Webhook endpoint + HMAC secret", "Send test result"],
      note: "Lab results push to patients in real time with HIPAA-compliant delivery.",
    },
    radiology: {
      title: "3-step setup",
      steps: ["Facility information", "DICOM / FHIR ImagingStudy endpoint", "Live connection test"],
      note: "Images available to patients and referring clinicians instantly after reading.",
    },
    hospital: {
      title: "4-step setup",
      steps: ["Organization information", "Bulk FHIR R4 Patient/$match consent scope", "TEFCA participation checkbox", "BAA signature upload"],
      note: "Enterprise integration covering all departments under a single BAA.",
    },
    dpc: {
      title: "4-step setup",
      steps: ["Practice information", "Panel size + subscription tier", "Patient import (CSV or FHIR Bundle)", "RevenueCat billing link"],
      note: "Flat-fee DPC model — no insurance billing overhead.",
    },
  };
  const cfg = configs[persona];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {PERSONA_META[persona].icon}
          {PERSONA_META[persona].label}
        </CardTitle>
        <CardDescription>{cfg.title}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="space-y-1.5">
          {cfg.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex-shrink-0 flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <Separator />
        <p className="text-xs text-muted-foreground">{cfg.note}</p>
      </CardContent>
    </Card>
  );
}

// ─── Active step panel dispatcher ────────────────────────────────────────────

function ActiveStepPanel({
  session,
  currentStep,
  fhirMutation,
  stepMutation,
  webhookMutation,
}: {
  session: ProviderOnboardingSession;
  currentStep: StepState | undefined;
  fhirMutation: ReturnType<typeof useMutation<{ result: FhirTestResult }, Error, string>>;
  stepMutation: ReturnType<typeof useMutation<{ session: ProviderOnboardingSession }, Error, { stepId: string; data?: Record<string, unknown>; skip?: boolean }>>;
  webhookMutation: ReturnType<typeof useMutation<{ provision: WebhookProvision }, Error, void>>;
}) {
  const stepId = currentStep?.stepId;
  const advance = (data?: Record<string, unknown>) =>
    stepMutation.mutate({ stepId: stepId!, data });
  const skip = () => stepMutation.mutate({ stepId: stepId!, skip: true });
  const isPending = stepMutation.isPending;

  if (!currentStep) return null;

  // org_info — used by all personas
  if (stepId === "org_info") {
    return (
      <StepShell
        title="Organization Information"
        icon={<Building2 className="h-5 w-5" />}
        description="Review and confirm your organization details"
        hint="This information appears on your provider profile and is used for BAA countersigning."
      >
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Detail label="Organization" value={session.orgName} />
          <Detail label="Contact Email" value={session.contactEmail} />
          <Detail label="Persona" value={PERSONA_META[session.persona].label} />
          {session.npiNumber && <Detail label="NPI" value={session.npiNumber} />}
        </div>
        <Button
          className="w-full mt-4"
          data-testid="button-complete-org_info"
          onClick={() => advance({ confirmed: true })}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Confirm & Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </StepShell>
    );
  }

  // ehr_selection — clinician persona
  if (stepId === "ehr_selection") {
    return <EhrSelectionStep onComplete={advance} onSkip={skip} isPending={isPending} />;
  }

  // fhir_test — clinician + radiology
  if (stepId === "fhir_test") {
    return (
      <FhirTestStep
        initialUrl={session.fhirBaseUrl}
        lastResult={session.fhirTestResult}
        fhirMutation={fhirMutation}
        onComplete={(url) => advance({ fhirBaseUrl: url })}
        onSkip={skip}
        isPending={isPending}
        isOptional
      />
    );
  }

  // dicom_endpoint — radiology
  if (stepId === "dicom_endpoint") {
    return (
      <FhirTestStep
        initialUrl={session.fhirBaseUrl}
        lastResult={session.fhirTestResult}
        fhirMutation={fhirMutation}
        onComplete={(url) => advance({ fhirBaseUrl: url })}
        onSkip={skip}
        isPending={isPending}
        isOptional={false}
        title="DICOM / FHIR ImagingStudy Endpoint"
        description="Enter your DICOM WADO-RS or FHIR ImagingStudy base URL"
        hint="HIPAA requires that imaging data remain in BAA-covered storage. We proxy all DICOM/FHIR requests server-side."
        placeholder="https://dicom.example.com/wado/rs"
      />
    );
  }

  // team_invites — clinician
  if (stepId === "team_invites") {
    return (
      <StepShell
        title="Team Invites"
        icon={<Users className="h-5 w-5" />}
        description="Invite clinical staff to access the provider portal"
        hint="Each invited team member receives a BAA acknowledgment email before gaining access to patient data."
        optional
      >
        <p className="text-sm text-muted-foreground">
          Team invite emails can be sent from Settings → Team after onboarding is complete.
        </p>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={skip} disabled={isPending} className="flex-1" data-testid="button-skip-team_invites">
            <SkipForward className="h-4 w-4 mr-1" /> Skip for now
          </Button>
          <Button onClick={() => advance({ deferred: true })} disabled={isPending} className="flex-1" data-testid="button-complete-team_invites">
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Continue
          </Button>
        </div>
      </StepShell>
    );
  }

  // golive_checklist — clinician
  if (stepId === "golive_checklist") {
    return <GoLiveChecklist onComplete={() => advance({ allChecked: true })} isPending={isPending} />;
  }

  // result_delivery — lab
  if (stepId === "result_delivery") {
    return <ResultDeliveryStep onComplete={(method) => advance({ method })} isPending={isPending} />;
  }

  // webhook_provision — lab
  if (stepId === "webhook_provision") {
    return (
      <StepShell
        title="Webhook Provisioning"
        icon={<Webhook className="h-5 w-5" />}
        description="Generate your HMAC-SHA256 endpoint and signing secret"
        hint="Your server must validate the X-Tabula-Signature header on every inbound request. The secret is stored encrypted and shown exactly once."
      >
        <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
          <p className="font-medium">What you will receive:</p>
          <p className="text-muted-foreground">• A unique HTTPS endpoint URL for your lab</p>
          <p className="text-muted-foreground">• A 32-byte HMAC-SHA256 signing secret (shown once)</p>
          <p className="text-muted-foreground">• Algorithm: HMAC-SHA256 via <code className="bg-background px-1 rounded">X-Tabula-Signature</code></p>
        </div>
        <Button
          className="w-full mt-4"
          onClick={() => webhookMutation.mutate()}
          disabled={webhookMutation.isPending || Boolean(session.webhookEndpointUrl)}
          data-testid="button-provision-webhook"
        >
          {webhookMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          <Webhook className="h-4 w-4 mr-2" />
          {session.webhookEndpointUrl ? "Already provisioned — continue" : "Provision Webhook"}
        </Button>
        {session.webhookEndpointUrl && (
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => advance({ endpointUrl: session.webhookEndpointUrl })}
            disabled={isPending}
            data-testid="button-continue-after-webhook"
          >
            Continue <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </StepShell>
    );
  }

  // test_result_send — lab
  if (stepId === "test_result_send") {
    return (
      <LabTestResultStep
        session={session}
        onComplete={(data) => advance(data)}
        isPending={isPending}
      />
    );
  }

  // bulk_fhir_consent — hospital
  if (stepId === "bulk_fhir_consent") {
    return <BulkFhirConsentStep onComplete={(scope) => advance({ scope })} isPending={isPending} />;
  }

  // tefca_participation — hospital
  if (stepId === "tefca_participation") {
    return <TefcaStep onComplete={(participate) => advance({ participate })} isPending={isPending} />;
  }

  // baa_upload — hospital
  if (stepId === "baa_upload") {
    return (
      <StepShell
        title="BAA Signature"
        icon={<ShieldCheck className="h-5 w-5" />}
        description="Complete your Business Associate Agreement"
        hint="A HIPAA BAA is required before any PHI can be exchanged. Review and sign via the BAA documentation portal, or upload a countersigned copy."
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("/baa-documentation", "_blank")}
            data-testid="button-open-baa-documentation"
          >
            <Upload className="h-4 w-4 mr-2" />
            Open BAA Documentation Portal
          </Button>
          <Button
            className="w-full"
            onClick={() => advance({ baaAccepted: true })}
            disabled={isPending}
            data-testid="button-complete-baa_upload"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            I have signed the BAA — Continue
          </Button>
        </div>
      </StepShell>
    );
  }

  // panel_size — DPC
  if (stepId === "panel_size") {
    return <PanelSizeStep onComplete={(data) => advance(data)} isPending={isPending} />;
  }

  // patient_import — DPC
  if (stepId === "patient_import") {
    return (
      <DpcPatientImportStep
        onComplete={(data) => advance(data)}
        onSkip={skip}
        isPending={isPending}
      />
    );
  }

  // revenuecat_link — DPC
  if (stepId === "revenuecat_link") {
    return (
      <StepShell
        title="Billing Setup"
        icon={<CreditCard className="h-5 w-5" />}
        description="Link your RevenueCat account for DPC membership billing"
        hint="RevenueCat handles subscription management, dunning, and analytics. Tabula Medica never stores card details — all billing flows through RevenueCat."
      >
        <div className="space-y-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://app.revenuecat.com", "_blank")}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Open RevenueCat Dashboard
          </Button>
          <Button
            className="w-full"
            onClick={() => advance({ revenueCatLinked: true })}
            disabled={isPending}
            data-testid="button-complete-revenuecat_link"
          >
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Billing configured — Continue
          </Button>
        </div>
      </StepShell>
    );
  }

  return null;
}

// ─── Sub-step components ─────────────────────────────────────────────────────

function StepShell({
  title,
  icon,
  description,
  hint,
  optional = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
          {optional && <Badge variant="outline" className="ml-auto text-xs">Optional</Badge>}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {children}
        {hint && (
          <>
            <Separator />
            <p className="text-xs text-muted-foreground">{hint}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function EhrSelectionStep({
  onComplete,
  onSkip,
  isPending,
}: {
  onComplete: (data: Record<string, unknown>) => void;
  onSkip: () => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <StepShell
      title="EHR Selection"
      icon={<Globe className="h-5 w-5" />}
      description="Choose your Electronic Health Record system"
      hint="We support Epic MyApps / SMART-on-FHIR, eClinicalWorks healow, athenahealth, and any FHIR R4-compliant endpoint. Full OAuth flows are handled in the Connections section post-onboarding."
    >
      <div className="grid grid-cols-2 gap-2">
        {EHR_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            data-testid={`button-ehr-${o.id}`}
            onClick={() => setSelected(o.id)}
            className={`p-3 rounded-lg border text-left transition-colors ${
              selected === o.id ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <p className="font-medium text-sm">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.note}</p>
          </button>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <Button variant="ghost" onClick={onSkip} disabled={isPending} className="flex-1" data-testid="button-skip-ehr_selection">
          <SkipForward className="h-4 w-4 mr-1" /> Skip
        </Button>
        <Button
          className="flex-1"
          onClick={() => onComplete({ ehrSystem: selected })}
          disabled={!selected || isPending}
          data-testid="button-complete-ehr_selection"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </StepShell>
  );
}

function FhirTestStep({
  initialUrl,
  lastResult,
  fhirMutation,
  onComplete,
  onSkip,
  isPending,
  isOptional,
  title = "FHIR Endpoint Test",
  description = "Test your FHIR R4 endpoint connection",
  hint = "We ping your /metadata (CapabilityStatement) endpoint server-side to avoid CORS. No PHI is transmitted during the test.",
  placeholder = "https://your-ehr.example.com/fhir/r4",
}: {
  initialUrl?: string;
  lastResult?: FhirTestResult;
  fhirMutation: ReturnType<typeof useMutation<{ result: FhirTestResult }, Error, string>>;
  onComplete: (url: string) => void;
  onSkip: () => void;
  isPending: boolean;
  isOptional: boolean;
  title?: string;
  description?: string;
  hint?: string;
  placeholder?: string;
}) {
  const [url, setUrl] = useState(initialUrl || "");
  const result = fhirMutation.data?.result ?? lastResult;

  return (
    <StepShell title={title} icon={<Globe className="h-5 w-5" />} description={description} hint={hint} optional={isOptional}>
      <Field label="FHIR R4 Base URL">
        <div className="flex gap-2">
          <Input
            data-testid="input-fhirUrl"
            placeholder={placeholder}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="outline"
            onClick={() => fhirMutation.mutate(url.trim())}
            disabled={!url.trim() || fhirMutation.isPending}
            data-testid="button-test-fhir"
          >
            {fhirMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
          </Button>
        </div>
      </Field>

      {result && (
        <div
          className={`rounded-lg p-3 text-sm border ${
            result.ok
              ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
              : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
          }`}
        >
          {result.ok ? (
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">Endpoint reachable</p>
                <p className="text-green-700 dark:text-green-300">
                  FHIR {result.fhirVersion ?? "R4"}
                  {result.softwareName ? ` — ${result.softwareName}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Circle className="h-4 w-4 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Test failed</p>
                <p className="text-red-700 dark:text-red-300">{result.error}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {isOptional && (
          <Button variant="ghost" onClick={onSkip} disabled={isPending} className="flex-1" data-testid="button-skip-fhir">
            <SkipForward className="h-4 w-4 mr-1" /> Skip
          </Button>
        )}
        <Button
          className="flex-1"
          onClick={() => onComplete(url)}
          disabled={isPending}
          data-testid="button-complete-fhir"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save & Continue <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </StepShell>
  );
}

function GoLiveChecklist({ onComplete, isPending }: { onComplete: () => void; isPending: boolean }) {
  const items = [
    "HIPAA BAA reviewed and signed",
    "PHI encryption confirmed (AES-256-GCM at rest, TLS 1.3 in transit)",
    "Audit logging enabled for all data access",
    "Staff training on HIPAA Minimum Necessary Standard completed",
    "Patient notification of data sharing obtained",
  ];
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const allChecked = items.every((_, i) => checked[i]);

  return (
    <StepShell
      title="Go-Live Checklist"
      icon={<CheckSquare className="h-5 w-5" />}
      description="Confirm all compliance items before activating your connection"
      hint="This checklist mirrors HIPAA Technical Safeguards (45 CFR §164.312) and is required before patient data flows."
    >
      <div className="space-y-2">
        {items.map((item, i) => (
          <label key={i} className="flex items-start gap-2 cursor-pointer" data-testid={`label-checklist-${i}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={Boolean(checked[i])}
              onChange={(e) => setChecked((prev) => ({ ...prev, [i]: e.target.checked }))}
              data-testid={`checkbox-golive-${i}`}
            />
            <span className="text-sm">{item}</span>
          </label>
        ))}
      </div>
      <Button
        className="w-full mt-3"
        onClick={onComplete}
        disabled={!allChecked || isPending}
        data-testid="button-complete-golive_checklist"
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Go Live — Activate Connection
      </Button>
    </StepShell>
  );
}

function ResultDeliveryStep({
  onComplete,
  isPending,
}: {
  onComplete: (method: string) => void;
  isPending: boolean;
}) {
  const [method, setMethod] = useState<string | null>(null);
  return (
    <StepShell
      title="Result Delivery Method"
      icon={<Activity className="h-5 w-5" />}
      description="Choose how your lab delivers results to Tabula Medica"
      hint="FHIR R4 DiagnosticReport webhook delivers results in near-real-time. HL7 v2 SFTP is available for labs using legacy LIS systems."
    >
      <div className="space-y-2">
        {RESULT_DELIVERY_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            data-testid={`button-delivery-${o.id}`}
            onClick={() => setMethod(o.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              method === o.id ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <p className="font-medium text-sm">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.note}</p>
          </button>
        ))}
      </div>
      <Button
        className="w-full mt-2"
        onClick={() => onComplete(method!)}
        disabled={!method || isPending}
        data-testid="button-complete-result_delivery"
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Continue <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </StepShell>
  );
}

function BulkFhirConsentStep({
  onComplete,
  isPending,
}: {
  onComplete: (scope: string) => void;
  isPending: boolean;
}) {
  const scopes = [
    { id: "patient_match_only", label: "Patient/$match only", note: "Identity resolution without PHI transfer" },
    { id: "patient_everything",  label: "Patient/$everything", note: "Full longitudinal record access" },
    { id: "bulk_data_export",    label: "Bulk Data Export (FHIR Bulk)",  note: "NDJSON population-level export" },
  ];
  const [scope, setScope] = useState<string | null>(null);
  return (
    <StepShell
      title="Bulk FHIR Consent Scope"
      icon={<Globe className="h-5 w-5" />}
      description="Select the FHIR R4 Patient access scope your system supports"
      hint="Scope determines which FHIR operations Tabula Medica may invoke. Narrow scope reduces your HIPAA exposure surface."
    >
      <div className="space-y-2">
        {scopes.map((s) => (
          <button
            key={s.id}
            type="button"
            data-testid={`button-scope-${s.id}`}
            onClick={() => setScope(s.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              scope === s.id ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <p className="font-medium text-sm">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.note}</p>
          </button>
        ))}
      </div>
      <Button
        className="w-full mt-2"
        onClick={() => onComplete(scope!)}
        disabled={!scope || isPending}
        data-testid="button-complete-bulk_fhir_consent"
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Continue <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </StepShell>
  );
}

function TefcaStep({
  onComplete,
  isPending,
}: {
  onComplete: (participate: boolean) => void;
  isPending: boolean;
}) {
  const [participate, setParticipate] = useState<boolean | null>(null);
  return (
    <StepShell
      title="TEFCA Participation"
      icon={<CheckSquare className="h-5 w-5" />}
      description="Indicate whether your organization participates in TEFCA"
      hint="TEFCA (Trusted Exchange Framework and Common Agreement) enables nationwide health information exchange via QHINs. Participation is voluntary but expands interoperability."
    >
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          data-testid="button-tefca-yes"
          onClick={() => setParticipate(true)}
          className={`p-4 rounded-lg border text-center transition-colors ${
            participate === true ? "border-primary bg-accent" : "hover:bg-accent/50"
          }`}
        >
          <p className="font-medium">Yes, we participate</p>
          <p className="text-xs text-muted-foreground mt-1">QHIN-connected</p>
        </button>
        <button
          type="button"
          data-testid="button-tefca-no"
          onClick={() => setParticipate(false)}
          className={`p-4 rounded-lg border text-center transition-colors ${
            participate === false ? "border-primary bg-accent" : "hover:bg-accent/50"
          }`}
        >
          <p className="font-medium">Not currently</p>
          <p className="text-xs text-muted-foreground mt-1">Direct FHIR only</p>
        </button>
      </div>
      <Button
        className="w-full mt-3"
        onClick={() => onComplete(participate!)}
        disabled={participate === null || isPending}
        data-testid="button-complete-tefca_participation"
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Continue <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </StepShell>
  );
}

function PanelSizeStep({
  onComplete,
  isPending,
}: {
  onComplete: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [panelSize, setPanelSize] = useState("");
  const [tier, setTier] = useState<string | null>(null);
  const tiers = [
    { id: "solo",        label: "Solo DPC",      note: "1 physician, up to 600 patients" },
    { id: "group",       label: "Group Practice", note: "2–10 physicians" },
    { id: "enterprise",  label: "Enterprise DPC", note: "11+ physicians / corporate" },
  ];
  return (
    <StepShell
      title="Panel Size & Subscription Tier"
      icon={<Users className="h-5 w-5" />}
      description="Tell us about your DPC panel and select your tier"
      hint="Panel size determines your RevenueCat product SKU. You can adjust this later in billing settings."
    >
      <Field label="Current Panel Size (patients)">
        <Input
          data-testid="input-panelSize"
          type="number"
          placeholder="e.g. 350"
          value={panelSize}
          onChange={(e) => setPanelSize(e.target.value)}
        />
      </Field>
      <div className="space-y-2">
        {tiers.map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`button-tier-${t.id}`}
            onClick={() => setTier(t.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              tier === t.id ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <p className="font-medium text-sm">{t.label}</p>
            <p className="text-xs text-muted-foreground">{t.note}</p>
          </button>
        ))}
      </div>
      <Button
        className="w-full mt-2"
        onClick={() => onComplete({ panelSize: Number(panelSize), tier })}
        disabled={!panelSize || !tier || isPending}
        data-testid="button-complete-panel_size"
      >
        {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        Continue <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </StepShell>
  );
}

function LabTestResultStep({
  session,
  onComplete,
  isPending,
}: {
  session: ProviderOnboardingSession;
  onComplete: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [deliveryOk, setDeliveryOk] = useState<boolean | null>(null);

  const handleSend = async () => {
    if (sending || !session.webhookEndpointUrl) return;
    setSending(true);
    try {
      const resp = await fetch("/api/onboarding/provider/send-test-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const data = (await resp.json()) as { sent: boolean; deliveryOk: boolean };
      setSent(true);
      setDeliveryOk(data.deliveryOk);
      if (data.deliveryOk) {
        toast({ title: "Test result delivered", description: "DiagnosticReport received by your endpoint" });
      } else {
        toast({ title: "Test result sent", description: "Delivery could not be confirmed — check your server logs", variant: "default" });
      }
    } catch (err: Error | unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Send failed", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <StepShell
      title="Send Test Result"
      icon={<Activity className="h-5 w-5" />}
      description="Verify your webhook receives a synthetic FHIR R4 DiagnosticReport"
      hint="A synthetic (non-PHI) FHIR DiagnosticReport resource is delivered server-side to your provisioned endpoint. Check your server logs to confirm receipt before going live."
    >
      {!session.webhookEndpointUrl && (
        <p className="text-sm text-destructive">Webhook must be provisioned first (complete the previous step).</p>
      )}
      {session.webhookEndpointUrl && (
        <div className="text-xs bg-muted rounded p-2 font-mono truncate">
          {session.webhookEndpointUrl}
        </div>
      )}
      {sent && (
        <div
          className={`rounded-lg p-3 text-sm border ${
            deliveryOk
              ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
              : "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800"
          }`}
        >
          <p className={`font-medium ${deliveryOk ? "text-green-800 dark:text-green-200" : "text-yellow-800 dark:text-yellow-200"}`}>
            {deliveryOk ? "Delivered successfully" : "Sent — check your server logs"}
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            Synthetic FHIR DiagnosticReport (CBC panel, non-PHI)
          </p>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleSend}
          disabled={sending || !session.webhookEndpointUrl || isPending}
          data-testid="button-send-test-result"
        >
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
          Send Test Result
        </Button>
        <Button
          className="flex-1"
          onClick={() => onComplete({ testSent: sent, deliveryOk })}
          disabled={isPending}
          data-testid="button-complete-test_result_send"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {sent ? "Confirm & Complete" : "Skip Confirmation"}
        </Button>
      </div>
    </StepShell>
  );
}

function DpcPatientImportStep({
  onComplete,
  onSkip,
  isPending,
}: {
  onComplete: (data: Record<string, unknown>) => void;
  onSkip: () => void;
  isPending: boolean;
}) {
  const [importMethod, setImportMethod] = useState<"csv" | "fhir_bundle" | null>(null);

  const importOptions = [
    {
      id: "csv" as const,
      label: "CSV Import",
      note: "Upload a CSV file with patient name, DOB, and contact info",
    },
    {
      id: "fhir_bundle" as const,
      label: "FHIR Bundle",
      note: "Upload a FHIR R4 Bundle containing Patient resources",
    },
  ];

  return (
    <StepShell
      title="Patient Import"
      icon={<Users className="h-5 w-5" />}
      description="Import your existing panel via CSV or FHIR R4 Bundle"
      hint="Imported records are encrypted at rest using AES-256-GCM in our GCP BAA-covered environment. The import is idempotent — re-uploading the same file is safe."
      optional
    >
      <div className="space-y-2">
        {importOptions.map((opt) => (
          <button
            key={opt.id}
            type="button"
            data-testid={`button-import-${opt.id}`}
            onClick={() => setImportMethod(opt.id)}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              importMethod === opt.id ? "border-primary bg-accent" : "hover:bg-accent/50"
            }`}
          >
            <p className="font-medium text-sm">{opt.label}</p>
            <p className="text-xs text-muted-foreground">{opt.note}</p>
          </button>
        ))}
      </div>

      {importMethod && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p>
            {importMethod === "csv"
              ? "Drag & drop your CSV file, or click to browse"
              : "Drag & drop your FHIR Bundle JSON/NDJSON, or click to browse"}
          </p>
          <p className="text-xs mt-1 text-muted-foreground">Full import pipeline available after onboarding in Settings → Patient Import</p>
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <Button
          variant="outline"
          onClick={onSkip}
          disabled={isPending}
          className="flex-1"
          data-testid="button-skip-patient_import"
        >
          <SkipForward className="h-4 w-4 mr-1" /> Skip for now
        </Button>
        <Button
          onClick={() => onComplete({ importMethod: importMethod ?? "deferred", deferred: !importMethod })}
          disabled={isPending}
          className="flex-1"
          data-testid="button-complete-patient_import"
        >
          {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {importMethod ? "Start Import" : "Continue"}
        </Button>
      </div>
    </StepShell>
  );
}

function CompletionPanel({ session }: { session: ProviderOnboardingSession }) {
  return (
    <Card className="text-center">
      <CardContent className="pt-10 pb-10 space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <div>
          <h2 className="text-xl font-bold" data-testid="text-completion-title">
            Onboarding Complete
          </h2>
          <p className="text-muted-foreground mt-1">
            {session.orgName} is now connected to Tabula Medica
          </p>
        </div>
        <Separator />
        <div className="text-left space-y-2 text-sm mx-auto max-w-sm">
          <p className="font-medium">Next steps:</p>
          <p className="text-muted-foreground">• Your account team will reach out within 1 business day</p>
          {session.fhirBaseUrl && (
            <p className="text-muted-foreground">• FHIR endpoint: <code className="text-xs bg-muted px-1 rounded">{session.fhirBaseUrl}</code></p>
          )}
          {session.webhookEndpointUrl && (
            <p className="text-muted-foreground">• Webhook endpoint configured and active</p>
          )}
          <p className="text-muted-foreground">• Test your integration in our sandbox: <a href="/connections" className="text-primary underline">Connections</a></p>
        </div>
      </CardContent>
    </Card>
  );
}
