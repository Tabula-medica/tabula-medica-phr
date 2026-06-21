import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Shield,
  Download,
  FileJson,
  UserX,
  UserCog,
  Settings,
  Building2,
  History,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Mail,
  Phone,
  ArrowRight,
} from "lucide-react";

interface DataRightsRequest {
  id: string;
  accountId: string;
  type: string;
  status: string;
  framework: string;
  notes: string | null;
  fulfillmentRef: string | null;
  scheduledFor: string | null;
  requestedAt: string;
  completedAt: string | null;
}

interface PrivacyPrefs {
  accountId: string;
  aiProcessingOptOut: boolean;
  marketingEmailsOptOut: boolean;
  analyticsOptOut: boolean;
  doNotSell: boolean;
  limitSensitivePi: boolean;
  optOutAutomatedDecisions: boolean;
  updatedAt: string;
}

interface DpoCard {
  name: string;
  email: string;
  address: string;
  euRepresentative: { name: string; email: string; address: string };
  responseSlaDays: number;
  escalation: string;
}

const REQUEST_LABEL: Record<string, string> = {
  access: "Right to access",
  portability: "Right to portability",
  erasure: "Right to erasure",
  rectification: "Right to rectification",
  do_not_sell: "Do not sell",
  limit_sensitive: "Limit sensitive PI",
  opt_out_automated_decisions: "Opt out of automated decisions",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
    completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
    in_progress: { label: "In progress", variant: "secondary", icon: Clock },
    pending: { label: "Pending", variant: "outline", icon: Clock },
    cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
    failed: { label: "Failed", variant: "destructive", icon: AlertTriangle },
  };
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1" data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

export default function GdprDashboardPage() {
  const { toast } = useToast();
  const [erasureOpen, setErasureOpen] = useState(false);

  const requestsQ = useQuery<{ requests: DataRightsRequest[] }>({
    queryKey: ["/api/gdpr/requests"],
  });
  const prefsQ = useQuery<{ preferences: PrivacyPrefs }>({
    queryKey: ["/api/gdpr/preferences"],
  });
  const dpoQ = useQuery<{ dpo: DpoCard }>({
    queryKey: ["/api/gdpr/dpo"],
  });

  const accessMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gdpr/access-request", { framework: "gdpr" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Access request started", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/requests"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not start access request", description: err.message, variant: "destructive" }),
  });

  const portabilityMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gdpr/portability-request", { framework: "gdpr" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Portability request started", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/requests"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not start portability request", description: err.message, variant: "destructive" }),
  });

  const erasureMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gdpr/erasure-request", { framework: "gdpr" });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Account scheduled for deletion",
        description: data.message,
      });
      setErasureOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/requests"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not schedule deletion", description: err.message, variant: "destructive" }),
  });

  const cancelErasureMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/gdpr/erasure-cancel/${id}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Erasure cancelled", description: "Your account will not be deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/requests"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" }),
  });

  const prefsMut = useMutation({
    mutationFn: async (patch: Partial<PrivacyPrefs>) => {
      const res = await apiRequest("PATCH", "/api/gdpr/processing-prefs", patch);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Preferences updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/preferences"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not update preferences", description: err.message, variant: "destructive" }),
  });

  const prefs = prefsQ.data?.preferences;
  const requests = requestsQ.data?.requests ?? [];
  const pendingErasure = requests.find((r) => r.type === "erasure" && r.status === "pending");
  const dpo = dpoQ.data?.dpo;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Your data rights — GDPR
          </h1>
          <p className="text-sm text-muted-foreground">
            Under the EU General Data Protection Regulation, you have the right to access,
            correct, port, and erase your personal data — and to control how it's processed.
            Use the controls below to exercise those rights.
          </p>
        </div>
        <Badge variant="secondary">Free for everyone</Badge>
      </div>

      {pendingErasure && (
        <Alert variant="destructive" data-testid="alert-pending-erasure">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Your account is scheduled for deletion</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Permanent deletion is scheduled for{" "}
              <strong>
                {pendingErasure.scheduledFor
                  ? new Date(pendingErasure.scheduledFor).toLocaleDateString()
                  : "the end of the 30-day grace period"}
              </strong>
              . You can cancel any time before then.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cancelErasureMut.mutate(pendingErasure.id)}
              disabled={cancelErasureMut.isPending}
              data-testid="button-cancel-erasure"
            >
              Cancel deletion
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1 · Right to access */}
        <Card data-testid="card-right-access">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" /> Right to access
            </CardTitle>
            <CardDescription>
              Get a complete copy of every piece of data we hold about you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => accessMut.mutate()}
              disabled={accessMut.isPending}
              data-testid="button-access-request"
            >
              {accessMut.isPending ? "Starting…" : "Download all my data"}
            </Button>
          </CardContent>
        </Card>

        {/* 2 · Right to portability */}
        <Card data-testid="card-right-portability">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-primary" /> Right to portability
            </CardTitle>
            <CardDescription>
              Receive your health record as a portable FHIR R4 JSON bundle that any
              compliant system can import.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => portabilityMut.mutate()}
              disabled={portabilityMut.isPending}
              data-testid="button-portability-request"
            >
              {portabilityMut.isPending ? "Starting…" : "Export FHIR R4 bundle"}
            </Button>
          </CardContent>
        </Card>

        {/* 3 · Right to rectification */}
        <Card data-testid="card-right-rectification">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-primary" /> Right to rectification
            </CardTitle>
            <CardDescription>
              Edit inaccurate personal information directly in your profile.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/profile">
              <Button className="w-full" variant="outline" data-testid="button-edit-profile">
                Edit my profile
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 4 · Right to erasure */}
        <Card data-testid="card-right-erasure">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" /> Right to erasure
            </CardTitle>
            <CardDescription>
              Permanently delete your account and all associated data after a 30-day
              grace period. You can cancel any time before deletion is final.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Dialog open={erasureOpen} onOpenChange={setErasureOpen}>
              <DialogTrigger asChild>
                <Button
                  className="w-full"
                  variant="destructive"
                  disabled={Boolean(pendingErasure)}
                  data-testid="button-open-erasure"
                >
                  {pendingErasure ? "Already scheduled" : "Delete my account"}
                </Button>
              </DialogTrigger>
              <DialogContent data-testid="dialog-erasure-confirm">
                <DialogHeader>
                  <DialogTitle>Confirm permanent deletion</DialogTitle>
                  <DialogDescription className="space-y-2">
                    <span className="block">
                      This will permanently delete your account, profiles, health
                      records, and shared data <strong>30 days from now</strong>.
                    </span>
                    <span className="block">
                      You can cancel any time before then by returning to this page.
                      After 30 days, deletion is irreversible.
                    </span>
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setErasureOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => erasureMut.mutate()}
                    disabled={erasureMut.isPending}
                    data-testid="button-confirm-erasure"
                  >
                    {erasureMut.isPending ? "Scheduling…" : "Yes, schedule deletion"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* 5 · Object / restrict processing */}
      <Card data-testid="card-processing-prefs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" /> Right to object & restrict processing
          </CardTitle>
          <CardDescription>
            Turn off specific kinds of data processing. Changes apply immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefsQ.isLoading || !prefs ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <PrefRow
                id="ai_opt_out"
                label="Opt out of AI processing"
                description="Stop our AI features from analyzing your records (summaries, deduplication, predictions)."
                checked={prefs.aiProcessingOptOut}
                onChange={(v) => prefsMut.mutate({ aiProcessingOptOut: v })}
              />
              <Separator />
              <PrefRow
                id="marketing_opt_out"
                label="Opt out of marketing emails"
                description="Stop receiving product announcements and feature update emails. Account-related emails (security, billing) are not affected."
                checked={prefs.marketingEmailsOptOut}
                onChange={(v) => prefsMut.mutate({ marketingEmailsOptOut: v })}
              />
              <Separator />
              <PrefRow
                id="analytics_opt_out"
                label="Opt out of usage analytics"
                description="Stop us from collecting anonymized product-usage telemetry to improve the experience."
                checked={prefs.analyticsOptOut}
                onChange={(v) => prefsMut.mutate({ analyticsOptOut: v })}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* 6 · DPO contact */}
      <Card data-testid="card-dpo-contact">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Data Protection Officer
          </CardTitle>
          <CardDescription>
            Contact our DPO directly with any privacy-related concern. We respond within 30 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {dpoQ.isLoading || !dpo ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div>
                <div className="font-medium">{dpo.name}</div>
                <a
                  href={`mailto:${dpo.email}`}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-dpo-email"
                >
                  <Mail className="h-4 w-4" />
                  {dpo.email}
                </a>
                <div className="text-muted-foreground">{dpo.address}</div>
              </div>
              <Separator />
              <div>
                <div className="font-medium">EU representative</div>
                <a
                  href={`mailto:${dpo.euRepresentative.email}`}
                  className="inline-flex items-center gap-2 text-primary hover:underline"
                  data-testid="link-eu-rep-email"
                >
                  <Mail className="h-4 w-4" />
                  {dpo.euRepresentative.email}
                </a>
                <div className="text-muted-foreground">{dpo.euRepresentative.address}</div>
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">
                Response SLA: {dpo.responseSlaDays} days. Escalation: {dpo.escalation}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 7 · History */}
      <Card data-testid="card-request-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Last 12 months of requests
          </CardTitle>
          <CardDescription>
            Every data-rights request you've submitted, with status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requestsQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-requests">
              You haven't submitted any data-rights requests yet.
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border rounded p-3"
                  data-testid={`row-request-${r.id}`}
                >
                  <div>
                    <div className="font-medium text-sm">
                      {REQUEST_LABEL[r.type] ?? r.type}
                      <Badge variant="outline" className="ml-2 text-xs uppercase">
                        {r.framework}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Requested {new Date(r.requestedAt).toLocaleString()}
                      {r.completedAt && (
                        <> · completed {new Date(r.completedAt).toLocaleString()}</>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-audit-trail-link">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Your audit trail
          </CardTitle>
          <CardDescription>
            See every recorded event involving your data — disclosures, access,
            and your own activity. Required by HIPAA §164.528.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/my-audit-trail">
            <Button variant="outline" className="w-full" data-testid="button-open-audit-trail">
              Open my audit trail
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Every action on this page is recorded in our audit log. For US California
        residents, see the{" "}
        <Link href="/ccpa" className="underline">
          CCPA dashboard
        </Link>{" "}
        for additional rights.
      </p>
    </div>
  );
}

function PrefRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label htmlFor={`switch-${id}`} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
      <Switch
        id={`switch-${id}`}
        checked={checked}
        onCheckedChange={onChange}
        data-testid={`switch-${id}`}
      />
    </div>
  );
}
