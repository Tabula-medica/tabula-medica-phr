/**
 * AI Clinician Review Queue (Task #297)
 *
 * Provider-facing page for reviewing AI outputs flagged by the clinical
 * advice classifier. Clinicians can approve (release to patient context)
 * or reject (discard) each item and leave optional notes.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  XCircle,
} from "lucide-react";

interface ReviewItem {
  id: string;
  userId: string;
  route: string;
  aiOutput: string;
  guardrailFlags: {
    reviewRequired: boolean;
    blockedPhrases: string[];
    matchedSentences: string[];
  } | null;
  blockedPhrases: string[] | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

interface QueueStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

function StatusBadge({ status }: { status: ReviewItem["status"] }) {
  if (status === "approved")
    return (
      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" data-testid="badge-approved">
        <CheckCircle2 className="h-3 w-3 mr-1" />Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" data-testid="badge-rejected">
        <XCircle className="h-3 w-3 mr-1" />Rejected
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400" data-testid="badge-pending">
      <Clock className="h-3 w-3 mr-1" />Pending Review
    </Badge>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AiReviewQueue() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">("approve");
  const [reviewerNotes, setReviewerNotes] = useState("");

  const statsQ = useQuery<QueueStats>({
    queryKey: ["/api/ai-review/stats"],
    refetchInterval: 30_000,
  });

  const queueQ = useQuery<{ items: ReviewItem[]; count: number }>({
    queryKey: ["/api/ai-review/queue", statusFilter],
    queryFn: () =>
      apiRequest("GET", `/api/ai-review/queue?status=${statusFilter}`).then((r: Response) => r.json()),
    refetchInterval: 30_000,
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: string;
      action: "approve" | "reject";
      notes: string;
    }) =>
      apiRequest("PUT", `/api/ai-review/${action === "approve" ? "approve" : "reject"}/${id}`, {
        reviewerNotes: notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-review/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-review/stats"] });
      setSelectedItem(null);
      setReviewerNotes("");
      toast({
        title: reviewAction === "approve" ? "AI output approved" : "AI output rejected",
        description:
          reviewAction === "approve"
            ? "The output has been cleared for patient context."
            : "The output has been discarded.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const openDialog = (item: ReviewItem, action: "approve" | "reject") => {
    setSelectedItem(item);
    setReviewAction(action);
    setReviewerNotes("");
  };

  const items = queueQ.data?.items ?? [];
  const stats = statsQ.data;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2" data-testid="text-page-title">
            <Stethoscope className="h-7 w-7 text-primary" />
            AI Clinical Review Queue
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI outputs flagged by the clinical-advice classifier — approve or reject before patient delivery
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            queueQ.refetch();
            statsQ.refetch();
          }}
          data-testid="button-refresh-queue"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending", key: "pending", color: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", key: "approved", color: "text-green-600 dark:text-green-400" },
          { label: "Rejected", key: "rejected", color: "text-red-600 dark:text-red-400" },
        ].map(({ label, key, color }) => (
          <Card
            key={key}
            className={`cursor-pointer transition-all border-2 ${statusFilter === key ? "border-primary" : "border-transparent"}`}
            onClick={() => setStatusFilter(key as typeof statusFilter)}
            data-testid={`stat-${key}`}
          >
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>
                {stats ? stats[key as keyof QueueStats] : "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Provider-only notice */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription className="text-sm">
          This queue is visible to providers only. AI outputs held here are not delivered to patients until approved.
        </AlertDescription>
      </Alert>

      {/* Queue items */}
      {queueQ.isLoading ? (
        <QueueSkeleton />
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="queue-empty">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No {statusFilter} items</p>
          <p className="text-sm mt-1">
            {statusFilter === "pending"
              ? "The review queue is clear."
              : `No ${statusFilter} items to display.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="border" data-testid={`review-item-${item.id}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm font-mono text-muted-foreground">
                    {item.route}
                  </CardTitle>
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Flagged phrases */}
                {item.blockedPhrases && item.blockedPhrases.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.blockedPhrases.map((phrase, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="border-amber-400 text-amber-700 dark:text-amber-400 text-xs"
                        data-testid={`flag-phrase-${i}`}
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* AI output */}
                <div className="bg-muted/40 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap" data-testid="ai-output-text">
                  {item.aiOutput}
                </div>

                {/* Reviewer notes (if reviewed) */}
                {item.reviewerNotes && (
                  <p className="text-xs text-muted-foreground italic">
                    Reviewer note: {item.reviewerNotes}
                  </p>
                )}

                {/* Actions (pending only) */}
                {item.status === "pending" && (
                  <div className="flex gap-2" data-testid={`actions-${item.id}`}>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => openDialog(item, "approve")}
                      data-testid="button-approve-item"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openDialog(item, "reject")}
                      data-testid="button-reject-item"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Approve / Reject dialog */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent data-testid="review-action-dialog">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve AI Output" : "Reject AI Output"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "This output will be cleared for patient context. Add an optional note for audit purposes."
                : "This output will be discarded. The patient will not see it."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="bg-muted/40 rounded-lg p-3 text-sm max-h-40 overflow-y-auto whitespace-pre-wrap">
              {selectedItem?.aiOutput}
            </div>
            <Textarea
              placeholder="Optional reviewer note (visible in audit log)…"
              value={reviewerNotes}
              onChange={(e) => setReviewerNotes(e.target.value)}
              rows={3}
              data-testid="input-reviewer-notes"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              disabled={actionMutation.isPending}
              onClick={() => {
                if (!selectedItem) return;
                actionMutation.mutate({
                  id: selectedItem.id,
                  action: reviewAction,
                  notes: reviewerNotes,
                });
              }}
              data-testid="button-confirm-review-action"
            >
              {actionMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : reviewAction === "approve" ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              {reviewAction === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
