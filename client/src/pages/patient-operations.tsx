import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import type { IntakeFormAssignment, IntakeFormTemplateKind, PatientOperationsStatus } from "@shared/patient-operations";

const TEMPLATE_OPTIONS: { id: IntakeFormTemplateKind; label: string }[] = [
  { id: "new-patient-intake", label: "New Patient Intake" },
  { id: "insurance-update", label: "Insurance Information" },
  { id: "consent-to-treat", label: "Consent to Treat" },
];

const STEP_LABELS: Record<string, string> = {
  "intake-forms": "Intake Forms",
  "insurance-eligibility": "Insurance Eligibility",
  "welcome-message": "Welcome Message",
};

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "complete") return "default";
  if (status === "needs-attention") return "destructive";
  if (status === "in-progress") return "secondary";
  return "outline";
}

export default function PatientOperationsPage() {
  const [unifiedPatientId, setUnifiedPatientId] = useState("");
  const [templateId, setTemplateId] = useState<IntakeFormTemplateKind>("new-patient-intake");

  const statusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("GET", `/api/patient-operations/status?unifiedPatientId=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not load status.");
      return (await res.json()) as PatientOperationsStatus;
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/patient-operations/forms/assign", { unifiedPatientId, templateId });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not assign this form.");
      return (await res.json()) as IntakeFormAssignment;
    },
    onSuccess: () => {
      if (unifiedPatientId) statusMutation.mutate(unifiedPatientId);
    },
  });

  const intakeLink = assignMutation.data
    ? `${window.location.origin}/intake?token=${assignMutation.data.token}`
    : undefined;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Patient Operations
        </h1>
        <p className="text-muted-foreground">
          Assign intake forms and check status across onboarding, insurance eligibility, and welcome messaging —
          all keyed by unified patient identity, not one EHR connection alone.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Look up a patient</CardTitle>
          <CardDescription>Enter the unified patient id this patient's records are linked under.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="unifiedPatientId"
            value={unifiedPatientId}
            onChange={(e) => setUnifiedPatientId(e.target.value)}
            data-testid="input-unified-patient-id"
          />
          <Button
            onClick={() => statusMutation.mutate(unifiedPatientId)}
            disabled={!unifiedPatientId || statusMutation.isPending}
            data-testid="button-load-status"
          >
            {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load status"}
          </Button>
        </CardContent>
      </Card>

      {statusMutation.isError && (
        <p className="text-sm text-destructive" data-testid="text-status-error">
          {(statusMutation.error as Error).message}
        </p>
      )}

      {statusMutation.data && (
        <Card data-testid="card-operations-status">
          <CardHeader>
            <CardTitle>Operations status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusMutation.data.steps.map((step) => (
              <div key={step.id} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0" data-testid={`step-${step.id}`}>
                <div>
                  <p className="font-medium">{STEP_LABELS[step.id] ?? step.id}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
                <Badge variant={statusBadgeVariant(step.status)}>{step.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Assign an intake form</CardTitle>
          <CardDescription>Generates a one-time, 72-hour secure link — no patient login required.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium" id="form-template-label">
              Form template
            </p>
            <div className="flex gap-2" role="group" aria-labelledby="form-template-label">
              {TEMPLATE_OPTIONS.map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={templateId === opt.id ? "default" : "outline"}
                  onClick={() => setTemplateId(opt.id)}
                  data-testid={`button-template-${opt.id}`}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!unifiedPatientId || assignMutation.isPending}
            data-testid="button-assign-form"
          >
            {assignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate secure link"}
          </Button>

          {assignMutation.isError && (
            <p className="text-sm text-destructive" data-testid="text-assign-error">
              {(assignMutation.error as Error).message}
            </p>
          )}

          {intakeLink && (
            <div className="rounded-md bg-muted p-3 text-sm" data-testid="text-intake-link">
              Send this link to the patient: <span className="break-all font-mono">{intakeLink}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <ClinicalDisclaimer variant="card" />
    </div>
  );
}
