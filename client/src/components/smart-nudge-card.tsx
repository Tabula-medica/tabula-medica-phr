import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Heart,
  Lightbulb,
  Trophy,
  MessageSquare,
  BookOpen,
  X,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Zap,
  Target,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface SmartNudge {
  id: string;
  type: "reminder" | "encouragement" | "tip" | "milestone" | "check_in" | "educational";
  title: string;
  message: string;
  tone: "supportive" | "motivational" | "informative" | "celebratory" | "gentle";
  priority: "low" | "medium" | "high";
  optimalDeliveryTime?: string;
  deliveryReason?: string;
  actionUrl?: string;
  actionLabel?: string;
  relatedGoal?: string;
  personalizationFactors?: string[];
  dismissed?: boolean;
}

interface SmartNudgeCardProps {
  nudge: SmartNudge;
  onDismiss: (id: string) => void;
  onAction: (id: string, url?: string) => void;
  showPersonalization?: boolean;
}

const nudgeTypeConfig: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  reminder: {
    icon: <Bell className="w-5 h-5" />,
    color: "text-blue-600",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  encouragement: {
    icon: <Heart className="w-5 h-5" />,
    color: "text-pink-600",
    bgColor: "bg-pink-100 dark:bg-pink-900/30",
  },
  tip: {
    icon: <Lightbulb className="w-5 h-5" />,
    color: "text-yellow-600",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
  },
  milestone: {
    icon: <Trophy className="w-5 h-5" />,
    color: "text-green-600",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  check_in: {
    icon: <MessageSquare className="w-5 h-5" />,
    color: "text-purple-600",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  educational: {
    icon: <BookOpen className="w-5 h-5" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 dark:bg-indigo-900/30",
  },
};

const toneStyles: Record<string, string> = {
  supportive: "border-l-blue-500",
  motivational: "border-l-orange-500",
  informative: "border-l-cyan-500",
  celebratory: "border-l-green-500",
  gentle: "border-l-purple-500",
};

const priorityStyles: Record<string, string> = {
  low: "",
  medium: "ring-1 ring-yellow-200 dark:ring-yellow-800",
  high: "ring-2 ring-red-200 dark:ring-red-800 animate-pulse",
};

export function SmartNudgeCard({ nudge, onDismiss, onAction, showPersonalization = false }: SmartNudgeCardProps) {
  const config = nudgeTypeConfig[nudge.type] || nudgeTypeConfig.tip;

  return (
    <Card
      className={cn(
        "border-l-4 hover-elevate transition-all",
        toneStyles[nudge.tone] || "border-l-primary",
        priorityStyles[nudge.priority]
      )}
      data-testid={`nudge-card-${nudge.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0", config.bgColor)}>
            <span className={config.color}>{config.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-sm">{nudge.title}</h4>
              {nudge.priority === "high" && (
                <Badge variant="destructive" className="text-xs py-0">
                  <Zap className="w-3 h-3 mr-1" />
                  Priority
                </Badge>
              )}
              {nudge.type === "milestone" && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs py-0">
                  <Trophy className="w-3 h-3 mr-1" />
                  Achievement
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{nudge.message}</p>

            {showPersonalization && nudge.personalizationFactors && nudge.personalizationFactors.length > 0 && (
              <div className="mt-2 flex items-center gap-1 flex-wrap">
                <Sparkles className="w-3 h-3 text-primary" />
                <span className="text-xs text-muted-foreground">Personalized based on:</span>
                {nudge.personalizationFactors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="text-xs py-0">
                    {factor}
                  </Badge>
                ))}
              </div>
            )}

            {nudge.relatedGoal && (
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="w-3 h-3" />
                <span>Goal: {nudge.relatedGoal}</span>
              </div>
            )}

            {nudge.optimalDeliveryTime && showPersonalization && (
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Best time: {nudge.optimalDeliveryTime}</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              {nudge.actionLabel && (
                <Button
                  size="sm"
                  onClick={() => onAction(nudge.id, nudge.actionUrl)}
                  data-testid={`nudge-action-${nudge.id}`}
                >
                  {nudge.actionLabel}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDismiss(nudge.id)}
                data-testid={`nudge-dismiss-${nudge.id}`}
              >
                Dismiss
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => onDismiss(nudge.id)}
            data-testid={`nudge-close-${nudge.id}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface SmartNudgeGeneratorProps {
  patientProfile: {
    patientId: string;
    name: string;
    healthLiteracyLevel: "basic" | "intermediate" | "advanced";
    preferredLanguage: string;
    communicationPreference: "formal" | "friendly" | "motivational";
    activeConditions: string[];
    learningStyle: "visual" | "reading" | "interactive" | "mixed";
  };
  pathwayContext: {
    pathwayId: string;
    pathwayName: string;
    currentPhase: string;
    phaseProgress: number;
    overallProgress: number;
    completedMilestones: string[];
    upcomingMilestones: string[];
    recentActivities: { activity: string; timestamp: string; success: boolean }[];
  };
  behaviorPattern: {
    taskCompletionRate: number;
    streakDays: number;
    preferredTimeOfDay: "morning" | "afternoon" | "evening" | "varies";
    successPatterns: string[];
    missedTaskPatterns: string[];
  };
  pendingTasks: { id: string; title: string; category: string; dueDate: string }[];
  onNudgesGenerated: (nudges: SmartNudge[]) => void;
}

export function SmartNudgeGenerator({
  patientProfile,
  pathwayContext,
  behaviorPattern,
  pendingTasks,
  onNudgesGenerated,
}: SmartNudgeGeneratorProps) {
  const { toast } = useToast();
  const [recentNudges, setRecentNudges] = useState<{ type: string; sentAt: string; dismissed: boolean }[]>([]);

  const generateNudgesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/ai-personalized-engagement/generate-nudges", {
        patientProfile,
        pathwayContext,
        behaviorPattern: {
          taskCompletionRate: behaviorPattern.taskCompletionRate,
          averageEngagementTime: 15,
          preferredTimeOfDay: behaviorPattern.preferredTimeOfDay,
          missedTaskPatterns: behaviorPattern.missedTaskPatterns,
          successPatterns: behaviorPattern.successPatterns,
          lastActiveDate: new Date().toISOString(),
          streakDays: behaviorPattern.streakDays,
          responseToNudgeTypes: [],
        },
        pendingTasks,
        recentNudges,
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.nudges && data.nudges.length > 0) {
        onNudgesGenerated(data.nudges);
        setRecentNudges((prev) => [
          ...prev,
          ...data.nudges.map((n: SmartNudge) => ({
            type: n.type,
            sentAt: new Date().toISOString(),
            dismissed: false,
          })),
        ]);
        toast({
          title: "Personalized Nudges Ready",
          description: `${data.nudges.length} new personalized notifications for you!`,
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not generate personalized nudges.",
        variant: "destructive",
      });
    },
  });

  return (
    <Button
      onClick={() => generateNudgesMutation.mutate()}
      disabled={generateNudgesMutation.isPending}
      variant="outline"
      className="w-full"
      data-testid="button-generate-nudges"
    >
      {generateNudgesMutation.isPending ? (
        <>
          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          Creating personalized nudges...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4 mr-2" />
          Get Personalized Encouragement
        </>
      )}
    </Button>
  );
}
