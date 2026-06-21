import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { StatusBadge } from "@/components/shared";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Heart,
  Activity,
  Pill,
  FileText,
  Bell,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Flame,
  Trophy,
  Target,
  Star,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { format, isToday, isTomorrow, isThisWeek, addDays } from "date-fns";

interface Appointment {
  id: string;
  profileId: string;
  title: string;
  appointmentType: string;
  providerName: string;
  facilityName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  description: string | null;
  isTelehealth: boolean;
}

interface HealthSummary {
  id: string;
  profileId: string;
  lastUpdated: string;
  conditions: Array<{ name: string; status: string; diagnosedDate: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string; prescribedBy: string }>;
  allergies: Array<{ allergen: string; reaction: string; severity: string }>;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    weight: number;
    height: number;
    lastChecked: string;
  };
  preventiveCare: Array<{ name: string; lastDate: string; nextDue: string; status: string }>;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  category: string;
  targetValue: number;
  targetUnit: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  pointsReward: number;
}

interface UserProgress {
  id: string;
  challengeId: string;
  currentValue: number;
  completedAt: string | null;
  lastUpdated: string;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  requirement: string;
  pointsValue: number;
}

interface UserAchievement {
  id: string;
  achievementId: string;
  earnedAt: string;
}

interface Points {
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  pointsToNextLevel: number;
}

export default function PatientDashboardNew() {
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<{ data: Appointment[] }>({
    queryKey: ["/api/patient-dashboard/appointments"],
  });
  const appointments = appointmentsData?.data || [];

  const { data: healthSummaryData, isLoading: healthLoading } = useQuery<{ data: HealthSummary }>({
    queryKey: ["/api/patient-dashboard/health-summary"],
  });
  const healthSummary = healthSummaryData?.data;

  const { data: challengesData } = useQuery<{ data: Challenge[] }>({
    queryKey: ["/api/gamification/challenges"],
  });
  const challenges = challengesData?.data || [];

  const { data: progressData } = useQuery<{ data: UserProgress[] }>({
    queryKey: ["/api/gamification/progress"],
  });
  const userProgress = progressData?.data || [];

  const { data: achievementsData } = useQuery<{ data: Achievement[] }>({
    queryKey: ["/api/gamification/achievements"],
  });
  const achievements = achievementsData?.data || [];

  const { data: userAchievementsData } = useQuery<{ data: UserAchievement[] }>({
    queryKey: ["/api/gamification/achievements/user"],
  });
  const userAchievements = userAchievementsData?.data || [];

  const { data: pointsData } = useQuery<{ data: Points }>({
    queryKey: ["/api/gamification/points"],
  });
  const points = pointsData?.data;

  const upcomingAppointments = appointments
    .filter(a => a.status !== "cancelled" && new Date(a.scheduledAt) >= new Date())
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .slice(0, 5);

  const activeChallenges = challenges.filter(c => c.isActive);
  const earnedAchievementIds = userAchievements.map(ua => ua.achievementId);
  const earnedAchievements = achievements.filter(a => earnedAchievementIds.includes(a.id));

  const getProgressForChallenge = (challengeId: string) => {
    return userProgress.find(p => p.challengeId === challengeId);
  };

  const getAppointmentDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    if (isThisWeek(date)) return format(date, "EEEE");
    return format(date, "MMM d");
  };

  const getAppointmentTypeIcon = (type: string) => {
    switch (type) {
      case "checkup": return <Heart className="h-4 w-4" />;
      case "follow-up": return <Activity className="h-4 w-4" />;
      case "specialist": return <User className="h-4 w-4" />;
      case "lab": return <FileText className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getChallengeIcon = (category: string) => {
    switch (category) {
      case "activity": return <Activity className="h-5 w-5 text-green-500" />;
      case "nutrition": return <Heart className="h-5 w-5 text-red-500" />;
      case "medication": return <Pill className="h-5 w-5 text-blue-500" />;
      case "wellness": return <Star className="h-5 w-5 text-yellow-500" />;
      default: return <Target className="h-5 w-5 text-purple-500" />;
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Health Information - NOT Medical Advice
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                This dashboard displays your health records for informational purposes only.
                Always consult your healthcare provider for medical decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Health Dashboard</h1>
          <p className="text-muted-foreground">
            Your health at a glance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/messages">
            <Button variant="outline" data-testid="button-messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Messages
            </Button>
          </Link>
        </div>
      </div>

      {points && (
        <Card className="mb-6 bg-gradient-to-r from-primary/10 to-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{points.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="flex items-center gap-2">
                  <Flame className="h-6 w-6 text-orange-500" />
                  <div>
                    <p className="text-xl font-bold">{points.currentStreak}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                  </div>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="flex items-center gap-2">
                  <Star className="h-6 w-6 text-purple-500" />
                  <div>
                    <p className="text-xl font-bold">Level {points.level}</p>
                    <p className="text-xs text-muted-foreground">{points.pointsToNextLevel} to next</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {earnedAchievements.slice(0, 4).map((achievement) => (
                  <Badge key={achievement.id} variant="secondary" className="px-2 py-1" title={achievement.name}>
                    <Trophy className="h-4 w-4" />
                  </Badge>
                ))}
                {earnedAchievements.length > 4 && (
                  <Badge variant="outline">+{earnedAchievements.length - 4}</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">Health Summary</TabsTrigger>
          <TabsTrigger value="challenges" data-testid="tab-challenges">Challenges</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {appointmentsLoading ? (
                  <p className="text-muted-foreground text-sm">Loading...</p>
                ) : upcomingAppointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No upcoming appointments</p>
                ) : (
                  <div className="space-y-3">
                    {upcomingAppointments.slice(0, 3).map((apt) => (
                      <div key={apt.id} className="flex items-start gap-3" data-testid={`appointment-preview-${apt.id}`}>
                        <div className="p-2 rounded-full bg-primary/10">
                          {getAppointmentTypeIcon(apt.appointmentType)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">{apt.providerName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {getAppointmentDateLabel(apt.scheduledAt)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(apt.scheduledAt), "h:mm a")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Active Challenges</CardTitle>
                <Target className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {activeChallenges.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No active challenges</p>
                ) : (
                  <div className="space-y-3">
                    {activeChallenges.slice(0, 3).map((challenge) => {
                      const progress = getProgressForChallenge(challenge.id);
                      const percentage = progress 
                        ? Math.min((progress.currentValue / challenge.targetValue) * 100, 100)
                        : 0;
                      return (
                        <div key={challenge.id} data-testid={`challenge-preview-${challenge.id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            {getChallengeIcon(challenge.category)}
                            <span className="font-medium text-sm flex-1 truncate">{challenge.title}</span>
                            <Badge variant="secondary" className="text-xs">
                              +{challenge.pointsReward}
                            </Badge>
                          </div>
                          <Progress value={percentage} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {progress?.currentValue || 0} / {challenge.targetValue} {challenge.targetUnit}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Quick Stats</CardTitle>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {healthSummary?.vitals ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Blood Pressure</span>
                      <span className="font-medium">{healthSummary.vitals.bloodPressure}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Heart Rate</span>
                      <span className="font-medium">{healthSummary.vitals.heartRate} bpm</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Weight</span>
                      <span className="font-medium">{healthSummary.vitals.weight} lbs</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-2">
                      Last updated: {format(new Date(healthSummary.vitals.lastChecked), "MMM d, yyyy")}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No vitals recorded</p>
                )}
              </CardContent>
            </Card>
          </div>

          {healthSummary?.medications && healthSummary.medications.length > 0 && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Current Medications</CardTitle>
                <Pill className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {healthSummary.medications.map((med, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/50" data-testid={`medication-${index}`}>
                      <p className="font-medium">{med.name}</p>
                      <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                      <p className="text-xs text-muted-foreground mt-1">Prescribed by {med.prescribedBy}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>All Appointments</CardTitle>
              <CardDescription>View and manage your upcoming appointments</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                {appointmentsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading appointments...</p>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="text-muted-foreground">No appointments scheduled</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {appointments.map((apt) => (
                      <Card key={apt.id} className="hover-elevate" data-testid={`appointment-${apt.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-full bg-primary/10">
                                {getAppointmentTypeIcon(apt.appointmentType)}
                              </div>
                              <div>
                                <p className="font-medium">{apt.title}</p>
                                <p className="text-sm text-muted-foreground">{apt.providerName}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(apt.scheduledAt), "MMMM d, yyyy")}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(apt.scheduledAt), "h:mm a")}
                                  </div>
                                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    {apt.facilityName || "Virtual"}
                                  </div>
                                </div>
                                {apt.description && (
                                  <p className="text-sm text-muted-foreground mt-2">{apt.description}</p>
                                )}
                              </div>
                            </div>
                            <StatusBadge status={apt.status} />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : healthSummary?.conditions?.length ? (
                  <div className="space-y-3">
                    {healthSummary.conditions.map((condition, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{condition.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Diagnosed: {format(new Date(condition.diagnosedDate), "MMM yyyy")}
                          </p>
                        </div>
                        <Badge variant={condition.status === "active" ? "default" : "secondary"}>
                          {condition.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No conditions recorded</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Allergies</CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : healthSummary?.allergies?.length ? (
                  <div className="space-y-3">
                    {healthSummary.allergies.map((allergy, index) => (
                      <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium">{allergy.allergen}</p>
                          <p className="text-sm text-muted-foreground">{allergy.reaction}</p>
                        </div>
                        <Badge variant={allergy.severity === "severe" ? "destructive" : "secondary"}>
                          {allergy.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No allergies recorded</p>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Preventive Care</CardTitle>
              </CardHeader>
              <CardContent>
                {healthLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : healthSummary?.preventiveCare?.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {healthSummary.preventiveCare.map((care, index) => (
                      <div key={index} className="p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{care.name}</p>
                          {care.status === "current" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Bell className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Last: {format(new Date(care.lastDate), "MMM yyyy")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Next due: {format(new Date(care.nextDue), "MMM yyyy")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No preventive care recorded</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="challenges">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Active Challenges</CardTitle>
                  <CardDescription>Complete challenges to earn points and achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  {activeChallenges.length === 0 ? (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No active challenges</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activeChallenges.map((challenge) => {
                        const progress = getProgressForChallenge(challenge.id);
                        const percentage = progress 
                          ? Math.min((progress.currentValue / challenge.targetValue) * 100, 100)
                          : 0;
                        const isCompleted = progress?.completedAt !== null;
                        return (
                          <Card key={challenge.id} className={isCompleted ? "border-green-500" : ""} data-testid={`challenge-${challenge.id}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-4">
                                <div className="p-3 rounded-full bg-muted">
                                  {getChallengeIcon(challenge.category)}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="font-medium">{challenge.title}</p>
                                    <Badge variant="secondary">
                                      +{challenge.pointsReward} pts
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {challenge.description}
                                  </p>
                                  <Progress value={percentage} className="h-2 mb-2" />
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {progress?.currentValue || 0} / {challenge.targetValue} {challenge.targetUnit}
                                    </span>
                                    <span className="text-muted-foreground">
                                      Ends {format(new Date(challenge.endDate), "MMM d")}
                                    </span>
                                  </div>
                                </div>
                                {isCompleted && (
                                  <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Achievements</CardTitle>
                </CardHeader>
                <CardContent>
                  {earnedAchievements.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No achievements earned yet</p>
                  ) : (
                    <div className="space-y-3">
                      {earnedAchievements.map((achievement) => (
                        <div key={achievement.id} className="flex items-center gap-3" data-testid={`achievement-${achievement.id}`}>
                          <Trophy className="h-6 w-6 text-yellow-500" />
                          <div>
                            <p className="font-medium text-sm">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">{achievement.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Available Achievements</CardTitle>
                </CardHeader>
                <CardContent>
                  {achievements.filter(a => !earnedAchievementIds.includes(a.id)).length === 0 ? (
                    <p className="text-muted-foreground text-sm">All achievements earned!</p>
                  ) : (
                    <div className="space-y-3">
                      {achievements.filter(a => !earnedAchievementIds.includes(a.id)).slice(0, 5).map((achievement) => (
                        <div key={achievement.id} className="flex items-center gap-3 opacity-50">
                          <Trophy className="h-6 w-6 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{achievement.name}</p>
                            <p className="text-xs text-muted-foreground">{achievement.requirement}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
