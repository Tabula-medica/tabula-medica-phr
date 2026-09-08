/**
 * eRx cancellations — patient-facing view of prescription cancellations sent to
 * the pharmacy, plus the manual cancellation form.
 *
 * The screen is deliberately blunt about delivery state. "Requested" is not
 * "cancelled": a pharmacy can decline, and a request awaiting prescriber
 * approval has not been sent at all. Every status here says which it is.
 */

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  PiggyBank,
  Send,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CancellationRequest {
  id: string;
  medicationName: string;
  previousDose: string | null;
  newDose: string | null;
  pharmacyName: string | null;
  triggerType: string;
  status: string;
  reasonText: string | null;
  responseText: string | null;
  requiresPrescriberApproval: boolean;
  estimatedWasteAvoidedCents: number | null;
  createdAt: string;
  transmittedAt: string | null;
}

interface SavingsSummary {
  totalRequests: number;
  acknowledged: number;
  pendingReview: number;
  inFlight: number;
  denied: number;
  failed: number;
  confirmedWasteAvoidedCents: number;
  projectedWasteAvoidedCents: number;
  byTrigger: Record<string, number>;
}

const TRIGGER_LABELS: Record<string, string> = {
  dose_change: "Dose changed",
  medication_discontinued: "Discontinued",
  therapy_completed: "Therapy complete",
  duplicate_therapy: "Duplicate therapy",
  adverse_reaction: "Adverse reaction",
  drug_interaction: "Drug interaction",
  patient_request: "You requested it",
  prescriber_request: "Prescriber requested it",
  patient_deceased: "Patient deceased",
};

/** Status presentation, keyed so an unknown status still renders safely. */
const STATUS_PRESENTATION: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; detail: string }
> = {
  pending_review: {
    label: "Awaiting prescriber",
    variant: "outline",
    detail: "Not yet sent to the pharmacy.",
  },
  queued: {
    label: "Queued",
    variant: "secondary",
    detail: "Approved and waiting to be sent to the pharmacy.",
  },
  transmitting: { label: "Sending", variant: "secondary", detail: "Being sent now." },
  transmitted: {
    label: "Sent to pharmacy",
    variant: "secondary",
    detail: "Delivered. Waiting for the pharmacy to confirm.",
  },
  acknowledged: {
    label: "Cancelled at pharmacy",
    variant: "default",
    detail: "The pharmacy confirmed the prescription is cancelled.",
  },
  denied: {
    label: "Pharmacy declined",
    variant: "destructive",
    detail: "The pharmacy did not cancel it — call them to confirm.",
  },
  failed: {
    label: "Could not send",
    variant: "destructive",
    detail: "Delivery failed. Contact the pharmacy directly.",
  },
  cancelled: {
    label: "Withdrawn",
    variant: "outline",
    detail: "You withdrew this request before it was sent.",
  },
};

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function StatusBadge({ status }: { status: string }) {
  const presentation = STATUS_PRESENTATION[status] ?? {
    label: status,
    variant: "outline" as const,
    detail: "",
  };
  return <Badge variant={presentation.variant} data-testid={`status-${status}`}>{presentation.label}</Badge>;
}

export default function ErxCancellations() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    medicationName: "",
    pharmacyName: "",
    triggerType: "patient_request",
    reasonText: "",
    daysSupplyRemaining: "",
  });

  const requestsQuery = useQuery<{ requests: CancellationRequest[]; disclaimer: string }>({
    queryKey: ["/api/erx-cancellation/requests"],
  });

  const savingsQuery = useQuery<{ summary: SavingsSummary; note: string }>({
    queryKey: ["/api/erx-cancellation/savings"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const days = Number.parseInt(form.daysSupplyRemaining, 10);
      const res = await apiRequest("POST", "/api/erx-cancellation/requests", {
        medicationName: form.medicationName.trim(),
        pharmacyName: form.pharmacyName.trim() || undefined,
        triggerType: form.triggerType,
        reasonText: form.reasonText.trim() || undefined,
        daysSupplyRemaining: Number.isFinite(days) ? days : undefined,
      });
      return res.json();
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Cancellation requested", description: data.message });
      setDialogOpen(false);
      setForm({
        medicationName: "",
        pharmacyName: "",
        triggerType: "patient_request",
        reasonText: "",
        daysSupplyRemaining: "",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/erx-cancellation/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/erx-cancellation/savings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not request the cancellation",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await apiRequest("POST", `/api/erx-cancellation/requests/${requestId}/withdraw`, {
        reason: "Withdrawn by the patient",
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Request withdrawn" });
      queryClient.invalidateQueries({ queryKey: ["/api/erx-cancellation/requests"] });
    },
    onError: (error: Error) => {
      toast({ title: "Could not withdraw", description: error.message, variant: "destructive" });
    },
  });

  const requests = requestsQuery.data?.requests ?? [];
  const summary = savingsQuery.data?.summary;

  return (
    <div className="container mx-auto space-y-6 p-4 md:p-6" data-testid="page-erx-cancellations">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prescription cancellations</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            When a dose changes or a medication stops, the prescription already sitting at your
            pharmacy is cancelled so the old one is not filled. Cancellations you request yourself
            are sent to your prescriber for approval first.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-request-cancellation">
              <Ban className="mr-2 h-4 w-4" />
              Request a cancellation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request a prescription cancellation</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="medicationName">Medication</Label>
                <Input
                  id="medicationName"
                  value={form.medicationName}
                  onChange={(e) => setForm({ ...form, medicationName: e.target.value })}
                  placeholder="e.g. Lisinopril 10 mg"
                  data-testid="input-medication-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pharmacyName">Pharmacy (optional)</Label>
                <Input
                  id="pharmacyName"
                  value={form.pharmacyName}
                  onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
                  placeholder="Where the prescription was sent"
                  data-testid="input-pharmacy-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="triggerType">Reason</Label>
                <Select
                  value={form.triggerType}
                  onValueChange={(value) => setForm({ ...form, triggerType: value })}
                >
                  <SelectTrigger id="triggerType" data-testid="select-trigger-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient_request">I no longer need it</SelectItem>
                    <SelectItem value="medication_discontinued">It was discontinued</SelectItem>
                    <SelectItem value="therapy_completed">The course is finished</SelectItem>
                    <SelectItem value="duplicate_therapy">It duplicates another medication</SelectItem>
                    <SelectItem value="adverse_reaction">I had a bad reaction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="daysSupplyRemaining">Days of supply left (optional)</Label>
                <Input
                  id="daysSupplyRemaining"
                  type="number"
                  min={0}
                  max={365}
                  value={form.daysSupplyRemaining}
                  onChange={(e) => setForm({ ...form, daysSupplyRemaining: e.target.value })}
                  data-testid="input-days-supply"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reasonText">Note for the pharmacy (optional)</Label>
                <Textarea
                  id="reasonText"
                  value={form.reasonText}
                  onChange={(e) => setForm({ ...form, reasonText: e.target.value })}
                  maxLength={500}
                  data-testid="input-reason-text"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!form.medicationName.trim() || createMutation.isPending}
                data-testid="button-submit-cancellation"
              >
                {createMutation.isPending ? "Sending…" : "Request cancellation"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PiggyBank className="h-4 w-4" />
            Waste avoided
          </CardTitle>
          <CardDescription>{savingsQuery.data?.note}</CardDescription>
        </CardHeader>
        <CardContent>
          {savingsQuery.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : summary ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <div className="text-2xl font-semibold" data-testid="text-confirmed-savings">
                  {formatCurrency(summary.confirmedWasteAvoidedCents)}
                </div>
                <div className="text-muted-foreground text-xs">Confirmed by pharmacies</div>
              </div>
              <div>
                <div className="text-2xl font-semibold" data-testid="text-projected-savings">
                  {formatCurrency(summary.projectedWasteAvoidedCents)}
                </div>
                <div className="text-muted-foreground text-xs">Including requests in flight</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{summary.acknowledged}</div>
                <div className="text-muted-foreground text-xs">Cancelled at the pharmacy</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{summary.pendingReview}</div>
                <div className="text-muted-foreground text-xs">Awaiting prescriber</div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No cancellations recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cancellation history</CardTitle>
          <CardDescription>{requestsQuery.data?.disclaimer}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requestsQuery.isLoading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : requests.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="text-empty-state">
              No prescription cancellations yet.
            </p>
          ) : (
            requests.map((request) => {
              const presentation = STATUS_PRESENTATION[request.status];
              const canWithdraw = ["pending_review", "queued"].includes(request.status);

              return (
                <div
                  key={request.id}
                  className="rounded-lg border p-4"
                  data-testid={`card-request-${request.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{request.medicationName}</span>
                        <StatusBadge status={request.status} />
                      </div>

                      <div className="text-muted-foreground mt-1 text-sm">
                        {TRIGGER_LABELS[request.triggerType] ?? request.triggerType}
                        {request.previousDose && request.newDose
                          ? ` — ${request.previousDose} → ${request.newDose}`
                          : ""}
                        {request.pharmacyName ? ` · ${request.pharmacyName}` : ""}
                      </div>

                      {presentation?.detail && (
                        <div className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
                          {request.status === "acknowledged" ? (
                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : request.status === "denied" || request.status === "failed" ? (
                            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : request.status === "transmitted" ? (
                            <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{presentation.detail}</span>
                        </div>
                      )}

                      {request.responseText && (
                        <div className="mt-2 flex items-start gap-1.5 text-xs">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{request.responseText}</span>
                        </div>
                      )}
                    </div>

                    {canWithdraw && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => withdrawMutation.mutate(request.id)}
                        disabled={withdrawMutation.isPending}
                        data-testid={`button-withdraw-${request.id}`}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
