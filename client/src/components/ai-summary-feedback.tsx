import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, AlertTriangle, ThumbsUp, Send, MessageSquare, Flag } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiFeedbackType, InsertAiFeedback } from "@shared/schema";

interface AiSummaryFeedbackProps {
  feedbackType: AiFeedbackType;
  summaryId: string;
  onFeedbackSubmitted?: () => void;
}

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-1">
      <FieldCaption className="text-sm">{label}</FieldCaption>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-1 hover-elevate rounded"
            data-testid={`star-${label.toLowerCase().replace(/\s+/g, "-")}-${star}`}
          >
            <Star
              className={`h-5 w-5 transition-colors ${
                star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AiSummaryFeedback({ feedbackType, summaryId, onFeedbackSubmitted }: AiSummaryFeedbackProps) {
  const { toast } = useToast();
  const [accuracyRating, setAccuracyRating] = useState(0);
  const [usefulnessRating, setUsefulnessRating] = useState(0);
  const [textFeedback, setTextFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [inaccuracyDetails, setInaccuracyDetails] = useState("");

  const feedbackMutation = useMutation({
    mutationFn: async (data: InsertAiFeedback) => {
      const res = await apiRequest("POST", "/api/ai-feedback", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Feedback Submitted",
          description: data.message,
        });
        setSubmitted(true);
        setShowFeedback(false);
        onFeedbackSubmitted?.();
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitFeedback = () => {
    if (accuracyRating === 0 || usefulnessRating === 0) {
      toast({
        title: "Missing Ratings",
        description: "Please rate both accuracy and usefulness.",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate({
      feedbackType,
      summaryId,
      accuracyRating,
      usefulnessRating,
      textFeedback: textFeedback || undefined,
      isInaccurate: false,
    });
  };

  const handleReportInaccuracy = () => {
    if (!inaccuracyDetails.trim()) {
      toast({
        title: "Details Required",
        description: "Please describe what was inaccurate.",
        variant: "destructive",
      });
      return;
    }

    feedbackMutation.mutate({
      feedbackType,
      summaryId,
      accuracyRating: 1,
      usefulnessRating: 1,
      isInaccurate: true,
      inaccuracyDetails,
    });
    setReportDialogOpen(false);
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-md border border-green-200 dark:border-green-800">
        <ThumbsUp className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700 dark:text-green-300">Thank you for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-4">
      {!showFeedback ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Was this summary helpful?</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFeedback(true)}
            data-testid="button-rate-summary"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Rate Summary
          </Button>
          <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                data-testid="button-report-inaccuracy"
              >
                <Flag className="h-4 w-4 mr-2" />
                Report Inaccuracy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Report Inaccurate Summary
                </DialogTitle>
                <DialogDescription>
                  Help us improve by describing what was inaccurate in this summary.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="inaccuracy-details">What was inaccurate?</Label>
                  <Textarea
                    id="inaccuracy-details"
                    placeholder="Please describe the specific inaccuracy..."
                    value={inaccuracyDetails}
                    onChange={(e) => setInaccuracyDetails(e.target.value)}
                    className="mt-2"
                    rows={4}
                    data-testid="input-inaccuracy-details"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReportInaccuracy}
                    disabled={feedbackMutation.isPending}
                    data-testid="button-submit-inaccuracy"
                  >
                    {feedbackMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4" />
              Rate This Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <StarRating
                label="Accuracy"
                value={accuracyRating}
                onChange={setAccuracyRating}
              />
              <StarRating
                label="Usefulness"
                value={usefulnessRating}
                onChange={setUsefulnessRating}
              />
            </div>
            <div>
              <Label htmlFor="text-feedback">Additional Feedback (Optional)</Label>
              <Textarea
                id="text-feedback"
                placeholder="Tell us how we can improve..."
                value={textFeedback}
                onChange={(e) => setTextFeedback(e.target.value)}
                className="mt-2"
                rows={3}
                data-testid="input-text-feedback"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowFeedback(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={feedbackMutation.isPending || accuracyRating === 0 || usefulnessRating === 0}
                data-testid="button-submit-feedback"
              >
                {feedbackMutation.isPending ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function FeedbackStatsDisplay({ type }: { type?: AiFeedbackType }) {
  return null;
}
