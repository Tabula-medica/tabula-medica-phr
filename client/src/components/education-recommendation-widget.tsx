import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Sparkles,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Eye,
  FileText,
  HelpCircle,
  Video,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface EducationRecommendation {
  id: string;
  patientId: string;
  contentId: string;
  contentType: "article" | "faq" | "video";
  title: string;
  summary: string;
  category: string;
  relevanceScore: number;
  matchReason: string;
  matchedFactors: string[];
  priority: "low" | "medium" | "high";
  estimatedReadTime?: number;
  generatedAt: string;
  status: "pending" | "viewed" | "dismissed" | "helpful" | "not_helpful";
}

interface RecommendationSet {
  patientId: string;
  patientName: string;
  recommendations: EducationRecommendation[];
  generatedAt: string;
  contextSummary: string;
  aiGenerated: boolean;
}

interface EducationRecommendationWidgetProps {
  patientId: string;
  maxItems?: number;
  showActions?: boolean;
  compact?: boolean;
}

export function EducationRecommendationWidget({
  patientId,
  maxItems = 3,
  showActions = true,
  compact = false,
}: EducationRecommendationWidgetProps) {
  const { toast } = useToast();

  const { data: recommendationSet, isLoading, error } = useQuery<RecommendationSet>({
    queryKey: ["/api/education-recommendations/patient", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/education-recommendations/patient/${patientId}`);
      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error("Failed to fetch recommendations");
      }
      return response.json();
    },
    enabled: !!patientId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ recommendationId, status }: { recommendationId: string; status: string }) => {
      return apiRequest("POST", `/api/education-recommendations/patient/${patientId}/recommendation/${recommendationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education-recommendations/patient", patientId] });
    },
  });

  const contentTypeIcon = (type: string) => {
    switch (type) {
      case "article": return <FileText className="h-4 w-4" />;
      case "faq": return <HelpCircle className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-500";
      case "medium": return "bg-amber-500/10 text-amber-500";
      default: return "bg-blue-500/10 text-blue-500";
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="widget-education-recommendations-loading">
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendationSet || recommendationSet.recommendations.length === 0) {
    return (
      <Card data-testid="widget-education-recommendations-empty">
        <CardHeader className={compact ? "pb-2" : ""}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Recommended For You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No recommendations available yet. Your care team will add personalized education materials based on your health profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayedRecs = recommendationSet.recommendations
    .filter(r => r.status === "pending" || r.status === "viewed")
    .slice(0, maxItems);

  return (
    <Card data-testid="widget-education-recommendations">
      <CardHeader className={compact ? "pb-2" : ""}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            Recommended For You
          </CardTitle>
          {recommendationSet.aiGenerated && (
            <Badge variant="outline" className="text-purple-500">
              <Sparkles className="h-3 w-3 mr-1" />
              AI Curated
            </Badge>
          )}
        </div>
        {!compact && (
          <CardDescription>
            Education materials selected based on your health profile
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={compact ? "pt-0" : ""}>
        <ScrollArea className={compact ? "max-h-48" : "max-h-72"}>
          <div className="space-y-3">
            {displayedRecs.map((rec) => (
              <div role="presentation"
                key={rec.id}
                className="flex items-start gap-3 p-3 rounded-md border hover-elevate cursor-pointer"
                onClick={() => {
                  if (rec.status === "pending") {
                    updateStatusMutation.mutate({ recommendationId: rec.id, status: "viewed" });
                  }
                }}
                data-testid={`widget-rec-${rec.id}`}
              >
                <div className="p-2 rounded-md bg-muted shrink-0">
                  {contentTypeIcon(rec.contentType)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">{rec.title}</h4>
                  {!compact && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{rec.summary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={priorityColor(rec.priority)} variant="outline">
                      {rec.priority}
                    </Badge>
                    {rec.estimatedReadTime && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {rec.estimatedReadTime}m
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {rec.relevanceScore}%
                    </span>
                  </div>
                </div>
                {showActions && rec.status === "viewed" && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatusMutation.mutate({ recommendationId: rec.id, status: "helpful" });
                        toast({ title: "Thanks for your feedback!" });
                      }}
                      data-testid={`widget-helpful-${rec.id}`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateStatusMutation.mutate({ recommendationId: rec.id, status: "not_helpful" });
                      }}
                      data-testid={`widget-not-helpful-${rec.id}`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 self-center" />
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      {recommendationSet.recommendations.length > maxItems && (
        <CardFooter className="pt-0">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <a href="/education-library" data-testid="link-view-all-education">
              View All Education Materials
              <ChevronRight className="h-4 w-4 ml-1" />
            </a>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default EducationRecommendationWidget;
