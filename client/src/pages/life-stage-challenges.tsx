import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { HeartPulse, CalendarCheck, ShieldCheck, CheckCircle2, Circle, Loader2, Info, Trophy } from "lucide-react";

interface ChallengeData {
  id: string;
  title: string;
  description: string;
  category: string;
  completed: boolean;
  completedAt: string | null;
}

interface ChallengesResponse {
  ageBand: "50-59" | "60-69" | "70-plus" | null;
  age: number | null;
  message?: string;
  tierBadge?: { name: string; description: string; icon: string };
  tierBadgeEarned?: boolean;
  totalPoints?: number;
  completedCount?: number;
  totalCount?: number;
  challenges?: ChallengeData[];
}

const TIER_LABEL: Record<string, string> = {
  "50-59": "Your 50s",
  "60-69": "Your 60s",
  "70-plus": "70 and Beyond",
};

const TIER_ICON: Record<string, any> = {
  "50-59": HeartPulse,
  "60-69": CalendarCheck,
  "70-plus": ShieldCheck,
};

export default function LifeStageChallenges() {
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ChallengesResponse>({
    queryKey: ["/api/life-stage/challenges"],
  });

  const completeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const response = await apiRequest("POST", `/api/life-stage/challenges/${challengeId}/complete`, {});
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/life-stage/challenges"] });
      if (result.completed) {
        toast({ title: "Nice work", description: `+${result.points} points logged.` });
        if (result.allComplete && result.tierBadgeEarned) {
          toast({ title: "Tier badge earned!", description: result.tierBadge?.name });
        }
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Couldn't save that — try again.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data?.ageBand) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">Life Stage Health Challenges</h1>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Not available yet</AlertTitle>
          <AlertDescription>
            {data?.message ?? "This section unlocks once your profile's date of birth puts you in the 50+ range."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const TierIcon = TIER_ICON[data.ageBand] ?? HeartPulse;
  const progressPct = data.totalCount ? Math.round(((data.completedCount ?? 0) / data.totalCount) * 100) : 0;

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6" data-testid="page-life-stage-challenges">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TierIcon className="h-6 w-6 text-rose-500" />
          Life Stage Health Challenges — {TIER_LABEL[data.ageBand]}
        </h1>
        <p className="text-muted-foreground mt-1">
          Simple, general nudges toward the preventive care most people your age benefit from. These are
          educational reminders, not medical advice or a diagnosis — always follow your own doctor's guidance.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {data.completedCount} of {data.totalCount} completed
            </span>
            <span className="font-semibold">{data.totalPoints} points</span>
          </div>
          <Progress value={progressPct} />
          {data.tierBadgeEarned && data.tierBadge && (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
              <Trophy className="h-3 w-3 mr-1" />
              {data.tierBadge.name}
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {data.challenges?.map((c) => (
          <Card key={c.id} className={c.completed ? "border-green-400/50" : undefined}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {c.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    {c.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{c.description}</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant={c.completed ? "outline" : "default"}
                  disabled={c.completed || completeMutation.isPending}
                  onClick={() => completeMutation.mutate(c.id)}
                  data-testid={`button-complete-${c.id}`}
                >
                  {c.completed ? "Done" : "Mark done"}
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
