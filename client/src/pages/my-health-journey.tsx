import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Target, 
  TrendingUp, 
  Trophy, 
  Calendar,
  Sparkles,
  ChevronRight,
  BookOpen,
  Pill,
  Heart,
  Activity,
  Apple,
  Moon,
  Brain,
  Footprints,
  Clock,
  RefreshCw,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  Lightbulb
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area } from "recharts";

interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "nutrition" | "weight" | "blood_pressure" | "blood_sugar" | "mental_health" | "sleep" | "custom";
  targetValue?: number;
  targetUnit?: string;
  currentValue?: number;
  startValue?: number;
  startDate: string;
  targetDate: string;
  status: "active" | "achieved" | "paused" | "abandoned";
  progress: number;
  milestones: {
    id: string;
    title: string;
    targetValue?: number;
    achieved: boolean;
    achievedDate?: string;
  }[];
  aiInsights?: string;
  nextSteps?: string[];
  relatedResources?: { title: string; url: string }[];
}

interface PatientHealthTimeline {
  patientId: string;
  patientName: string;
  goals: HealthGoal[];
  historicalData: {
    category: string;
    dataPoints: { date: string; value: number; unit: string; note?: string }[];
  }[];
  achievements: {
    id: string;
    title: string;
    description: string;
    achievedDate: string;
    icon: string;
  }[];
  upcomingMilestones: {
    goalId: string;
    goalTitle: string;
    milestoneTitle: string;
    targetDate: string;
    daysRemaining: number;
  }[];
  aiSummary: {
    overallProgress: string;
    strengths: string[];
    areasForImprovement: string[];
    encouragement: string;
  };
  generatedAt: string;
}

interface HealthEducationResource {
  id: string;
  title: string;
  summary: string;
  category: string;
  format: string;
  difficulty: string;
  estimatedTime: number;
  relevanceScore: number;
  targetConditions: string[];
  tags: string[];
  url: string;
  source: string;
  personalizedReason: string;
}

interface EducationRecommendationResult {
  patientId: string;
  recommendations: HealthEducationResource[];
  basedOn: {
    conditions: string[];
    medications: string[];
    recentActivity: string[];
    preferences: string[];
  };
  generatedAt: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  medication: Pill,
  exercise: Footprints,
  nutrition: Apple,
  weight: Activity,
  blood_pressure: Heart,
  blood_sugar: Activity,
  mental_health: Brain,
  sleep: Moon,
  custom: Target,
};

const categoryColors: Record<string, string> = {
  medication: "text-blue-500",
  exercise: "text-green-500",
  nutrition: "text-orange-500",
  weight: "text-purple-500",
  blood_pressure: "text-red-500",
  blood_sugar: "text-pink-500",
  mental_health: "text-indigo-500",
  sleep: "text-violet-500",
  custom: "text-gray-500",
};

const formatCategories: Record<string, string> = {
  article: "Article",
  video: "Video",
  infographic: "Infographic",
  checklist: "Checklist",
  faq: "FAQ",
  interactive: "Interactive",
};

function GoalCard({ goal }: { goal: HealthGoal }) {
  const Icon = categoryIcons[goal.category] || Target;
  const colorClass = categoryColors[goal.category] || "text-foreground";
  const achievedMilestones = goal.milestones.filter(m => m.achieved).length;
  const totalMilestones = goal.milestones.length;
  
  return (
    <Card className="hover-elevate" data-testid={`goal-card-${goal.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg bg-muted ${colorClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{goal.title}</h3>
              <Badge variant={goal.status === "active" ? "default" : goal.status === "achieved" ? "secondary" : "outline"} className="text-xs">
                {goal.status === "active" ? "In Progress" : goal.status === "achieved" ? "Achieved" : goal.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
            
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{goal.progress}%</span>
              </div>
              <Progress value={goal.progress} className="h-2" data-testid={`goal-progress-${goal.id}`} />
              
              {goal.targetValue !== undefined && goal.currentValue !== undefined && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Current: {goal.currentValue} {goal.targetUnit}</span>
                  <span>Target: {goal.targetValue} {goal.targetUnit}</span>
                </div>
              )}
            </div>
            
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {achievedMilestones}/{totalMilestones} milestones
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(goal.targetDate).toLocaleDateString()}
              </span>
            </div>
            
            {goal.aiInsights && (
              <div className="mt-3 p-2 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">{goal.aiInsights}</p>
                </div>
              </div>
            )}
            
            {goal.nextSteps && goal.nextSteps.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-medium mb-1">Next Steps:</p>
                <ul className="space-y-1">
                  {goal.nextSteps.slice(0, 2).map((step, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <ChevronRight className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EducationCard({ resource }: { resource: HealthEducationResource }) {
  return (
    <Card className="hover-elevate min-w-[280px] max-w-[300px]" data-testid={`education-card-${resource.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className="text-xs">
            {formatCategories[resource.format] || resource.format}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {resource.estimatedTime} min
          </div>
        </div>
        <h4 className="font-semibold text-sm mt-2 line-clamp-2">{resource.title}</h4>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.summary}</p>
        <p className="text-xs text-muted-foreground/80 mt-2 italic">{resource.personalizedReason}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{resource.source}</span>
          <Button size="sm" variant="ghost" className="gap-1" data-testid={`btn-read-${resource.id}`}>
            Read <ArrowUpRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AchievementBadge({ achievement }: { achievement: { id: string; title: string; description: string; achievedDate: string; icon: string } }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg" data-testid={`achievement-${achievement.id}`}>
      <div className="p-2 bg-accent rounded-full">
        <Trophy className="h-4 w-4 text-accent-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{achievement.title}</p>
        <p className="text-xs text-muted-foreground">{achievement.description}</p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {new Date(achievement.achievedDate).toLocaleDateString()}
      </span>
    </div>
  );
}

function HistoricalChart({ data }: { data: { category: string; dataPoints: { date: string; value: number; unit: string }[] } }) {
  const chartData = data.dataPoints.map(dp => ({
    date: new Date(dp.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: dp.value,
    unit: dp.unit,
  }));

  return (
    <Card data-testid={`chart-${data.category}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{data.category}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${data.category}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--background))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
                formatter={(value: number, name: string, props: any) => [`${value} ${props.payload.unit}`, data.category]}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fill={`url(#gradient-${data.category})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyHealthJourney() {
  const [activeTab, setActiveTab] = useState("goals");
  const patientId = "patient_001"; // In real app, get from auth context

  const { data: timeline, isLoading: timelineLoading, isError: timelineError, refetch: refetchTimeline } = useQuery<PatientHealthTimeline>({
    queryKey: ["/api/ai-engagement/health-timeline", patientId],
  });

  const { data: education, isLoading: educationLoading, isError: educationError, refetch: refetchEducation } = useQuery<EducationRecommendationResult>({
    queryKey: ["/api/ai-engagement/education-recommendations", patientId],
  });

  const handleRefresh = () => {
    refetchTimeline();
    refetchEducation();
  };

  if (timelineLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (timelineError) {
    return (
      <div className="container mx-auto p-4 space-y-6" data-testid="my-health-journey-page">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Health Journey</h1>
            <p className="text-muted-foreground">Track your progress, goals, and health milestones</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h3 className="font-semibold">Unable to load your health data</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              We encountered an issue loading your health journey. Please try again.
            </p>
            <Button onClick={handleRefresh} className="gap-2" data-testid="btn-retry">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeGoals = timeline?.goals.filter(g => g.status === "active") || [];
  const completedGoals = timeline?.goals.filter(g => g.status === "achieved") || [];

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="my-health-journey-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Health Journey</h1>
          <p className="text-muted-foreground">Track your progress, goals, and health milestones</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2" data-testid="btn-refresh">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {timeline?.aiSummary && (
        <Card className="bg-gradient-to-r from-accent/50 to-accent/30 border-accent" data-testid="ai-summary-card">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Sparkles className="h-5 w-5 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">Your Health Summary</h3>
                <p className="text-sm text-muted-foreground">{timeline.aiSummary.overallProgress}</p>
                <p className="text-sm text-foreground/80 mt-2 italic">{timeline.aiSummary.encouragement}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="journey-tabs">
          <TabsTrigger value="goals" data-testid="tab-goals">
            <Target className="h-4 w-4 mr-2" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <TrendingUp className="h-4 w-4 mr-2" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">
            <Trophy className="h-4 w-4 mr-2" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="learn" data-testid="tab-learn">
            <BookOpen className="h-4 w-4 mr-2" />
            Learn
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goals" className="space-y-4" data-testid="content-goals">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Health Goals</h2>
            <Badge variant="outline">{activeGoals.length} active</Badge>
          </div>
          
          {activeGoals.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No active goals yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We'll generate personalized health goals based on your health profile.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeGoals.map(goal => (
                <GoalCard key={goal.id} goal={goal} />
              ))}
            </div>
          )}

          {timeline?.upcomingMilestones && timeline.upcomingMilestones.length > 0 && (
            <Card data-testid="upcoming-milestones-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Upcoming Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {timeline.upcomingMilestones.slice(0, 4).map((milestone, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CircleDashed className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="font-medium">{milestone.milestoneTitle}</span>
                          <span className="text-muted-foreground ml-2">({milestone.goalTitle})</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {milestone.daysRemaining} days left
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4" data-testid="content-progress">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Health Trends</h2>
            <span className="text-sm text-muted-foreground">Based on your lab results and vitals</span>
          </div>
          
          {timeline?.historicalData && timeline.historicalData.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {timeline.historicalData.map((data, i) => (
                <HistoricalChart key={i} data={data} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No historical data yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  As we collect more lab results and vitals, we'll show your health trends here.
                </p>
              </CardContent>
            </Card>
          )}

          {timeline?.aiSummary && (
            <Card data-testid="strengths-improvements-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Strengths
                  </h4>
                  <ul className="space-y-1">
                    {timeline.aiSummary.strengths.map((strength, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Areas for Improvement
                  </h4>
                  <ul className="space-y-1">
                    {timeline.aiSummary.areasForImprovement.map((area, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4" data-testid="content-achievements">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Achievements</h2>
            <Badge variant="outline">{timeline?.achievements?.length || 0} earned</Badge>
          </div>
          
          {timeline?.achievements && timeline.achievements.length > 0 ? (
            <div className="space-y-3">
              {timeline.achievements.map(achievement => (
                <AchievementBadge key={achievement.id} achievement={achievement} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">Start earning achievements</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete milestones and reach your goals to unlock achievements.
                </p>
              </CardContent>
            </Card>
          )}

          {completedGoals.length > 0 && (
            <Card data-testid="completed-goals-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Completed Goals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {completedGoals.map(goal => (
                    <div key={goal.id} className="flex items-center justify-between p-2 bg-green-500/10 rounded-lg">
                      <span className="text-sm font-medium">{goal.title}</span>
                      <Badge variant="secondary">Achieved</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="learn" className="space-y-4" data-testid="content-learn">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Personalized Learning</h2>
              <p className="text-sm text-muted-foreground">
                Education content recommended based on your health profile
              </p>
            </div>
          </div>
          
          {educationLoading ? (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-48 w-[280px] shrink-0" />
              ))}
            </div>
          ) : educationError ? (
            <Card>
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                <h3 className="font-semibold">Unable to load learning content</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  We couldn't load personalized education content. Please try again.
                </p>
                <Button onClick={() => refetchEducation()} variant="outline" className="gap-2" data-testid="btn-retry-education">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          ) : education?.recommendations && education.recommendations.length > 0 ? (
            <>
              <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-4 pb-4">
                  {education.recommendations.map(resource => (
                    <EducationCard key={resource.id} resource={resource} />
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              
              {education.basedOn && (
                <Card data-testid="personalization-basis-card">
                  <CardContent className="p-4">
                    <h4 className="text-sm font-medium mb-2">Why these recommendations?</h4>
                    <div className="flex flex-wrap gap-2">
                      {education.basedOn.conditions.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                      {education.basedOn.medications.slice(0, 3).map((m, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">Learning content loading</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We're preparing personalized education content for you.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
