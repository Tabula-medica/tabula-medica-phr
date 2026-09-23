import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  ThumbsUp, 
  ThumbsDown,
  Star,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import type { AiFeedbackType, InsertAiFeedback } from "@shared/schema";

interface AIFeedbackControlsProps {
  feedbackType: AiFeedbackType;
  summaryId: string;
  compact?: boolean;
  onFeedbackSubmitted?: () => void;
}

export function AIFeedbackControls({
  feedbackType,
  summaryId,
  compact = false,
  onFeedbackSubmitted
}: AIFeedbackControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [accuracyRating, setAccuracyRating] = useState<number>(0);
  const [usefulnessRating, setUsefulnessRating] = useState<number>(0);
  const [textFeedback, setTextFeedback] = useState("");
  const [isInaccurate, setIsInaccurate] = useState(false);
  const [inaccuracyDetails, setInaccuracyDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [quickRating, setQuickRating] = useState<"helpful" | "not_helpful" | null>(null);
  
  const queryClient = useQueryClient();

  const submitFeedback = useMutation({
    mutationFn: async (feedback: InsertAiFeedback) => {
      return apiRequest("POST", "/api/ai-feedback", feedback);
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-feedback"] });
      onFeedbackSubmitted?.();
      setTimeout(() => setSubmitted(false), 3000);
    }
  });

  const handleQuickFeedback = (rating: "helpful" | "not_helpful") => {
    setQuickRating(rating);
    if (rating === "helpful") {
      submitFeedback.mutate({
        feedbackType,
        summaryId,
        accuracyRating: 4,
        usefulnessRating: 5,
      });
    } else {
      setIsOpen(true);
    }
  };

  const handleSubmit = () => {
    if (accuracyRating === 0 || usefulnessRating === 0) return;
    
    submitFeedback.mutate({
      feedbackType,
      summaryId,
      accuracyRating,
      usefulnessRating,
      textFeedback: textFeedback || undefined,
      isInaccurate,
      inaccuracyDetails: isInaccurate ? inaccuracyDetails : undefined,
    });
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    label: string;
  }) => (
    <div className="space-y-1">
      <FieldCaption className="text-xs text-muted-foreground">{label}</FieldCaption>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5 transition-colors hover-elevate"
            data-testid={`star-${label.toLowerCase().replace(/\s+/g, '-')}-${star}`}
          >
            <Star 
              className={cn(
                "h-4 w-4 transition-colors",
                star <= value 
                  ? "fill-yellow-400 text-yellow-400" 
                  : "text-muted-foreground/40"
              )} 
            />
          </button>
        ))}
      </div>
    </div>
  );

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 p-2" data-testid="text-feedback-submitted">
        <CheckCircle className="h-4 w-4" />
        <span>Thank you for your feedback!</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2" data-testid="ai-feedback-compact">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex gap-1">
          <Button
            variant={quickRating === "helpful" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleQuickFeedback("helpful")}
            disabled={submitFeedback.isPending}
            data-testid="button-feedback-helpful"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant={quickRating === "not_helpful" ? "default" : "ghost"}
            size="icon"
            onClick={() => handleQuickFeedback("not_helpful")}
            disabled={submitFeedback.isPending}
            data-testid="button-feedback-not-helpful"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed" data-testid="ai-feedback-panel">
        <CardHeader className="py-3 px-4">
          <CollapsibleTrigger asChild>
            <button 
              className="flex items-center justify-between w-full text-left"
              data-testid="button-toggle-feedback"
            >
              <div>
                <CardTitle className="text-sm font-medium">Provide Feedback</CardTitle>
                <CardDescription className="text-xs">
                  Help us improve AI-generated insights
                </CardDescription>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-4">
            <div className="flex gap-6">
              <StarRating 
                value={accuracyRating} 
                onChange={setAccuracyRating} 
                label="Accuracy" 
              />
              <StarRating 
                value={usefulnessRating} 
                onChange={setUsefulnessRating} 
                label="Usefulness" 
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="feedback-text" className="text-xs text-muted-foreground">
                Additional comments (optional)
              </Label>
              <Textarea
                id="feedback-text"
                placeholder="Tell us what could be improved..."
                value={textFeedback}
                onChange={(e) => setTextFeedback(e.target.value)}
                className="min-h-[60px] text-sm"
                data-testid="input-feedback-text"
              />
            </div>

            <div className="space-y-3 p-3 border border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-950/30">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is-inaccurate"
                  checked={isInaccurate}
                  onCheckedChange={(checked) => setIsInaccurate(checked === true)}
                  data-testid="checkbox-inaccurate"
                />
                <Label 
                  htmlFor="is-inaccurate" 
                  className="text-sm font-medium flex items-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Report Inaccuracy
                </Label>
              </div>
              
              {isInaccurate && (
                <Textarea
                  placeholder="Please describe what was inaccurate..."
                  value={inaccuracyDetails}
                  onChange={(e) => setInaccuracyDetails(e.target.value)}
                  className="min-h-[60px] text-sm"
                  data-testid="input-inaccuracy-details"
                />
              )}
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={accuracyRating === 0 || usefulnessRating === 0 || submitFeedback.isPending}
              className="w-full"
              size="sm"
              data-testid="button-submit-feedback"
            >
              {submitFeedback.isPending ? (
                "Submitting..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1" />
                  Submit Feedback
                </>
              )}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
