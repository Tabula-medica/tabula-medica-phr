import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared";
import { 
  Lightbulb, 
  BookOpen, 
  Play, 
  CheckSquare, 
  Bell,
  Bookmark,
  BookmarkCheck,
  Star,
  Sparkles,
  Clock,
  TrendingUp,
  Heart,
  Pill,
  Apple,
  Moon,
  Brain,
  Shield,
  Activity,
  Loader2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface HealthTip {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  format: string;
  readTimeMinutes: number;
  isAiGenerated: boolean;
}

interface PatientHealthTip {
  id: string;
  healthTipId: string;
  reason: string;
  relevanceScore: number;
  isRead: boolean;
  readAt?: string;
  isBookmarked: boolean;
  feedbackRating?: number;
  deliveredAt: string;
  healthTip?: HealthTip;
}

interface EngagementMetrics {
  promCompletionRate: number;
  streakDays: number;
  tipsViewed: number;
  tipsBookmarked: number;
  engagementScore: number;
  engagementTrend: string;
}

const categoryIcons: Record<string, any> = {
  medication: Pill,
  nutrition: Apple,
  exercise: Activity,
  sleep: Moon,
  mental_health: Brain,
  chronic_disease: Heart,
  prevention: Shield,
  lifestyle: Sparkles,
};

const formatIcons: Record<string, any> = {
  tip: Lightbulb,
  article: BookOpen,
  video_link: Play,
  checklist: CheckSquare,
  reminder: Bell,
};

export default function HealthTipsPage() {
  const { toast } = useToast();
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  const { data: tips = [], isLoading } = useQuery<PatientHealthTip[]>({
    queryKey: ["/api/my-health-tips"],
  });

  const { data: metrics } = useQuery<EngagementMetrics>({
    queryKey: ["/api/engagement-metrics"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (tipId: string) => {
      const response = await apiRequest("POST", `/api/my-health-tips/${tipId}/read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-health-tips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement-metrics"] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ tipId, bookmarked }: { tipId: string; bookmarked: boolean }) => {
      const response = await apiRequest("POST", `/api/my-health-tips/${tipId}/bookmark`, { bookmarked });
      return response.json();
    },
    onSuccess: (_, { bookmarked }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-health-tips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagement-metrics"] });
      toast({
        title: bookmarked ? "Tip bookmarked" : "Bookmark removed",
        description: bookmarked ? "You can find this in your saved tips" : "Tip removed from bookmarks",
      });
    },
  });

  const rateTipMutation = useMutation({
    mutationFn: async ({ tipId, rating }: { tipId: string; rating: number }) => {
      const response = await apiRequest("POST", `/api/my-health-tips/${tipId}/rate`, { rating });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-health-tips"] });
      toast({
        title: "Thanks for your feedback!",
        description: "This helps us provide better health tips for you.",
      });
    },
  });

  const generateTipsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/health-tips/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-health-tips"] });
      toast({
        title: "New tips generated!",
        description: "We've created personalized health tips based on your profile.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate tips. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleTipClick = (tip: PatientHealthTip) => {
    if (!tip.isRead) {
      markReadMutation.mutate(tip.id);
    }
    setExpandedTip(expandedTip === tip.id ? null : tip.id);
  };

  const unreadTips = tips.filter(t => !t.isRead);
  const bookmarkedTips = tips.filter(t => t.isBookmarked);
  const readTips = tips.filter(t => t.isRead);

  const getCategoryIcon = (category: string) => {
    const Icon = categoryIcons[category] || Lightbulb;
    return <Icon className="h-4 w-4" />;
  };

  const getFormatIcon = (format: string) => {
    const Icon = formatIcons[format] || Lightbulb;
    return <Icon className="h-4 w-4" />;
  };

  const renderTipCard = (patientTip: PatientHealthTip) => {
    const tip = patientTip.healthTip;
    if (!tip) return null;

    const isExpanded = expandedTip === patientTip.id;

    return (
      <Card
        key={patientTip.id}
        className={`cursor-pointer transition-all ${!patientTip.isRead ? "border-primary/50 bg-primary/5" : ""}`}
        onClick={() => handleTipClick(patientTip)}
        data-testid={`card-tip-${patientTip.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {getCategoryIcon(tip.category)}
              <CardTitle className="text-base">{tip.title}</CardTitle>
              {tip.isAiGenerated && (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  bookmarkMutation.mutate({ tipId: patientTip.id, bookmarked: !patientTip.isBookmarked });
                }}
                data-testid={`button-bookmark-${patientTip.id}`}
              >
                {patientTip.isBookmarked ? (
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{tip.readTimeMinutes} min read</span>
            <span className="mx-1">•</span>
            <span className="capitalize">{tip.category.replace("_", " ")}</span>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{tip.summary}</p>
          
          {isExpanded && (
            <div className="mt-4 space-y-4" data-testid={`content-tip-${patientTip.id}`}>
              <div className="border-t pt-4">
                <p className="text-sm whitespace-pre-wrap">{tip.content}</p>
              </div>
              
              {patientTip.reason && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Why this tip?</strong> {patientTip.reason}
                  </p>
                </div>
              )}

              {!patientTip.feedbackRating && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground mb-2">Was this tip helpful?</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Button
                        key={rating}
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          rateTipMutation.mutate({ tipId: patientTip.id, rating });
                        }}
                        data-testid={`button-rate-${patientTip.id}-${rating}`}
                      >
                        <Star className={`h-4 w-4 ${rating <= 3 ? "" : "text-yellow-500"}`} />
                        {rating}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="container py-6 space-y-6">
        <PageHeader
          title="Health Tips"
          subtitle="Personalized health information based on your profile"
          actions={
            <Button
              onClick={() => generateTipsMutation.mutate()}
              disabled={generateTipsMutation.isPending}
              data-testid="button-generate-tips"
            >
              {generateTipsMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate New Tips
                </>
              )}
            </Button>
          }
        />

        {metrics && (
          <Card data-testid="card-engagement-metrics">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Your Engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Engagement Score</p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold">{metrics.engagementScore}</span>
                    <Progress value={metrics.engagementScore} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Streak</p>
                  <p className="text-2xl font-bold">{metrics.streakDays} days</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tips Viewed</p>
                  <p className="text-2xl font-bold">{metrics.tipsViewed}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Bookmarked</p>
                  <p className="text-2xl font-bold">{metrics.tipsBookmarked}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new" data-testid="tab-new">
              New {unreadTips.length > 0 && <Badge className="ml-2" variant="secondary">{unreadTips.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved">Saved</TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all">All Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading tips...</p>
                </CardContent>
              </Card>
            ) : unreadTips.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You're all caught up!</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => generateTipsMutation.mutate()}
                    disabled={generateTipsMutation.isPending}
                    data-testid="button-generate-more"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate New Tips
                  </Button>
                </CardContent>
              </Card>
            ) : (
              unreadTips.map(renderTipCard)
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            {bookmarkedTips.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No saved tips yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Bookmark tips you want to revisit later
                  </p>
                </CardContent>
              </Card>
            ) : (
              bookmarkedTips.map(renderTipCard)
            )}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {tips.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No health tips yet</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => generateTipsMutation.mutate()}
                    disabled={generateTipsMutation.isPending}
                    data-testid="button-generate-first"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Your First Tips
                  </Button>
                </CardContent>
              </Card>
            ) : (
              tips.map(renderTipCard)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
