import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Send,
  Sparkles,
  Heart,
  Brain,
  Apple,
  Activity,
  Pill,
  Shield,
  Clock,
  ChevronRight,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  RefreshCw,
  Bot,
  User,
  ArrowRight,
  TrendingUp,
  Zap,
  ShieldAlert,
  TrendingDown,
  HelpCircle,
  Gauge,
  Map,
  Play,
  Calendar,
  CalendarPlus,
  ClipboardCheck,
  FileText,
  Bell,
  Timer,
  MapPin,
  Phone,
  Mail,
  Check,
  X,
  AlertCircle,
  UserCircle,
  Stethoscope,
  Filter,
  SlidersHorizontal,
  TestTube,
  Beaker,
  ChevronDown,
  ChevronUp,
  CalendarRange,
  ListFilter,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, parseISO, addDays } from "date-fns";

interface MedicationReminder {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  nextDose: string;
  instructions: string;
  refillDate?: string;
  refillReminder: boolean;
  adherenceScore: number;
  missedDoses: number;
  tips: string[];
}

interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  location: string;
  duration: number;
  available: boolean;
}

interface VisitGuidance {
  id: string;
  appointmentId: string;
  appointmentType: string;
  provider: string;
  date: string;
  phase: "pre_visit" | "post_visit";
  checklist: Array<{
    id: string;
    task: string;
    description: string;
    completed: boolean;
    required: boolean;
  }>;
  preparations: string[];
  questionsToAsk: string[];
  documentsToReview: string[];
  instructions: string[];
  followUpActions?: string[];
  noCdsDisclaimer: string;
}

interface HealthRiskIndicator {
  id: string;
  category: "vital_trend" | "lab_abnormality" | "medication_interaction" | "adherence" | "lifestyle" | "chronic_progression";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  dataPoints: string[];
  suggestedQuestions: string[];
  lastUpdated: string;
}

interface ProactiveRiskSummary {
  patientId: string;
  overallRiskScore: number;
  riskLevel: "low" | "moderate" | "elevated" | "high";
  lastAnalyzedAt: string;
  indicators: HealthRiskIndicator[];
  trendingFactors: {
    improving: string[];
    stable: string[];
    worsening: string[];
  };
  nextReviewDate: string;
}

interface HealthRecommendation {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  actionSteps: string[];
  benefits: string[];
  relatedCondition?: string;
  timeframe?: string;
  evidenceLevel: string;
  personalizationFactors: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  requiresFollowUp?: boolean;
}

interface EducationContent {
  id: string;
  title: string;
  summary: string;
  content: string;
  readingLevel: string;
  format: string;
  targetConditions: string[];
  keyTakeaways: string[];
  actionItems: string[];
  relatedTopics: string[];
  estimatedReadTime: number;
  personalizationNote: string;
}

interface HealthSummaryData {
  summary: string;
  upcomingAppointments: number;
  activeMedications: number;
  pendingReminders: number;
}

interface ReminderItem {
  id: string;
  type: "appointment" | "medication" | "preventive_care" | "follow_up" | "document_review";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  dueDate?: string;
  actionUrl?: string;
}

const categoryIcons: Record<string, any> = {
  lifestyle: Activity,
  nutrition: Apple,
  exercise: Heart,
  medication: Pill,
  preventive: Shield,
  mental_health: Brain,
  monitoring: TrendingUp,
};

const priorityColors: Record<string, string> = {
  high: "text-red-500 bg-red-50 dark:bg-red-950/30",
  medium: "text-orange-500 bg-orange-50 dark:bg-orange-950/30",
  low: "text-green-500 bg-green-50 dark:bg-green-950/30",
};

interface ActiveProfile {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

function useActiveProfile() {
  const { data } = useQuery<{ profile: ActiveProfile }>({
    queryKey: ["/api/profiles/active"],
  });
  return data?.profile?.id || "default";
}

function UserProfileCard({ profileId }: { profileId: string }) {
  const { data: healthSummary, isLoading } = useQuery<{ summary: string }>({
    queryKey: ["/api/health-assistant/summary", profileId],
  });

  const { data: remindersData } = useQuery<{ reminders: ReminderItem[] }>({
    queryKey: ["/api/health-assistant/reminders", profileId],
  });

  const { data: medicationsData } = useQuery<{ reminders: MedicationReminder[] }>({
    queryKey: ["/api/health-assistant/medication-reminders", profileId],
  });

  const reminders = remindersData?.reminders || [];
  const medications = medicationsData?.reminders || [];
  const summary = healthSummary?.summary;

  const upcomingAppointments = reminders.filter(r => r.type === "appointment").length;
  const highPriorityReminders = reminders.filter(r => r.priority === "high").length;

  if (isLoading) {
    return <Skeleton className="h-40" />;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            <AvatarImage src="" alt="User" />
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              <UserCircle className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              Welcome Back
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI-Powered
              </Badge>
            </CardTitle>
            <CardDescription className="mt-1">
              Your personalized health assistant is ready to help
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && (
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <p className="line-clamp-3">{summary}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-background rounded-lg">
            <Pill className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{medications.length}</p>
            <p className="text-xs text-muted-foreground">Medications</p>
          </div>
          <div className="p-3 bg-background rounded-lg">
            <Calendar className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{upcomingAppointments}</p>
            <p className="text-xs text-muted-foreground">Appointments</p>
          </div>
          <div className="p-3 bg-background rounded-lg">
            <Bell className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{highPriorityReminders}</p>
            <p className="text-xs text-muted-foreground">Reminders</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MedicationsSection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const { data, isLoading, refetch, isFetching } = useQuery<{ reminders: MedicationReminder[]; noCdsDisclaimer: string }>({
    queryKey: ["/api/health-assistant/medication-reminders", profileId],
  });

  const [selectedMedication, setSelectedMedication] = useState<MedicationReminder | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const reminders = data?.reminders || [];
  const disclaimer = data?.noCdsDisclaimer;

  const getAdherenceColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-100 dark:bg-green-950/50";
    if (score >= 70) return "text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50";
    return "text-red-600 bg-red-100 dark:bg-red-950/50";
  };

  const getTimeUntilDose = (nextDose: string) => {
    try {
      const doseTime = parseISO(nextDose);
      return formatDistanceToNow(doseTime, { addSuffix: true });
    } catch {
      return "scheduled";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-500" />
            Medication Reminders
          </h3>
          <p className="text-sm text-muted-foreground">
            Stay on track with personalized medication schedules
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-medications">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {reminders.length > 0 ? (
        <div className="grid md:grid-cols-2 gap-4">
          {reminders.map((med) => (
            <Card key={med.id} className="hover-elevate" data-testid={`medication-${med.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/50">
                      <Pill className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{med.medicationName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{med.dosage}</p>
                    </div>
                  </div>
                  <Badge className={getAdherenceColor(med.adherenceScore)}>
                    {med.adherenceScore}% adherence
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span>{med.frequency}</span>
                  </div>
                  {med.missedDoses > 0 && (
                    <div className="flex items-center gap-1 text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{med.missedDoses} missed</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-primary/5 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Next dose</span>
                  </div>
                  <p className="text-lg font-semibold text-primary">
                    {getTimeUntilDose(med.nextDose)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(parseISO(med.nextDose), "EEEE, MMMM d 'at' h:mm a")}
                  </p>
                </div>

                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Instructions:</span> {med.instructions}
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedMedication(med)} data-testid={`button-medication-tips-${med.id}`}>
                      <Lightbulb className="h-4 w-4 mr-2" />
                      View Tips & Details
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pill className="h-5 w-5 text-blue-500" />
                        {med.medicationName}
                      </DialogTitle>
                      <DialogDescription>{med.dosage} - {med.frequency}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          Helpful Tips
                        </h4>
                        <ul className="space-y-2">
                          {med.tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-4 bg-muted rounded-lg">
                        <h4 className="font-medium mb-2">Adherence Progress</h4>
                        <Progress value={med.adherenceScore} className="h-3" />
                        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                          <span>Current: {med.adherenceScore}%</span>
                          <span>Goal: 95%</span>
                        </div>
                      </div>

                      {med.refillReminder && med.refillDate && (
                        <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                          <div className="flex items-center gap-2 text-orange-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="font-medium text-sm">Refill needed by {format(parseISO(med.refillDate), "MMMM d")}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Pill className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">No medication reminders available</p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Add medications to your profile to receive personalized reminders
            </p>
          </CardContent>
        </Card>
      )}

      {disclaimer && (
        <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {disclaimer}
        </div>
      )}
    </div>
  );
}

function AppointmentsSection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null);
  const [appointmentReason, setAppointmentReason] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("");
  const [showGuidanceDialog, setShowGuidanceDialog] = useState(false);
  const [schedulingDisclaimer, setSchedulingDisclaimer] = useState<string | null>(null);

  const slotsQueryKey = selectedSpecialty 
    ? `/api/health-assistant/appointment-slots?profileId=${profileId}&specialty=${encodeURIComponent(selectedSpecialty)}`
    : `/api/health-assistant/appointment-slots?profileId=${profileId}`;

  const { data: slotsData, isLoading: slotsLoading, refetch: refetchSlots } = useQuery<{ slots: AppointmentSlot[] }>({
    queryKey: [slotsQueryKey],
  });

  const { data: remindersData } = useQuery<{ reminders: ReminderItem[] }>({
    queryKey: ["/api/health-assistant/reminders", profileId],
  });

  const guidanceQueryKey = `/api/health-assistant/visit-guidance?profileId=${profileId}&appointmentId=apt-1&phase=pre_visit`;
  const { data: guidanceData, refetch: refetchGuidance, isLoading: guidanceLoading } = useQuery<{ guidance: VisitGuidance }>({
    queryKey: [guidanceQueryKey],
    enabled: showGuidanceDialog,
  });

  const scheduleMutation = useMutation({
    mutationFn: async (slot: AppointmentSlot) => {
      const response = await apiRequest("POST", "/api/health-assistant/appointments", {
        profileId,
        type: "schedule",
        preferredDate: slot.date,
        preferredTime: slot.time,
        provider: slot.provider,
        specialty: slot.specialty,
        reason: appointmentReason,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Appointment Scheduled", description: data.message });
      if (data.noCdsDisclaimer) {
        setSchedulingDisclaimer(data.noCdsDisclaimer);
      }
      setShowScheduleDialog(false);
      setSelectedSlot(null);
      setAppointmentReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/reminders", profileId] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment", variant: "destructive" });
    },
  });

  const slots = slotsData?.slots || [];
  const upcomingAppointments = remindersData?.reminders?.filter(r => r.type === "appointment") || [];
  const guidanceDisclaimer = guidanceData?.guidance?.noCdsDisclaimer;

  const specialties = ["Primary Care", "Cardiology", "Endocrinology", "Dermatology", "Ophthalmology"];

  const groupedSlots = slots.reduce((acc, slot) => {
    const date = slot.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(slot);
    return acc;
  }, {} as Record<string, AppointmentSlot[]>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-500" />
            Appointment Scheduling
          </h3>
          <p className="text-sm text-muted-foreground">
            Schedule, manage, and prepare for your appointments
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={showGuidanceDialog} onOpenChange={setShowGuidanceDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-visit-prep">
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Visit Preparation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-green-500" />
                  Pre-Visit Preparation Guide
                </DialogTitle>
                <DialogDescription>
                  Get ready for your upcoming appointment
                </DialogDescription>
              </DialogHeader>
              {guidanceLoading ? (
                <div className="space-y-4 py-4">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : guidanceData?.guidance ? (
                <div className="space-y-6 py-4">
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Preparation Checklist
                    </h4>
                    <div className="space-y-2">
                      {guidanceData.guidance.checklist.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <Checkbox id={item.id} />
                          <div className="flex-1">
                            <Label htmlFor={item.id} className="font-medium text-sm cursor-pointer">
                              {item.task}
                              {item.required && <span className="text-red-500 ml-1">*</span>}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-blue-500" />
                      Questions to Ask Your Provider
                    </h4>
                    <ul className="space-y-2">
                      {guidanceData.guidance.questionsToAsk.map((q, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-purple-500" />
                      Documents to Bring
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {guidanceData.guidance.documentsToReview.map((doc, i) => (
                        <Badge key={i} variant="secondary">{doc}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                    <AlertCircle className="h-4 w-4 inline mr-2" />
                    {guidanceData.guidance.noCdsDisclaimer}
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming appointments to prepare for</p>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-schedule-appointment">
                <CalendarPlus className="h-4 w-4 mr-2" />
                Schedule New
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5 text-green-500" />
                  Schedule New Appointment
                </DialogTitle>
                <DialogDescription>
                  Choose a time that works for you
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div>
                  <Label htmlFor="ai-health-assistant-filter-by-specialty">Filter by Specialty</Label>
                  <Select value={selectedSpecialty} onValueChange={(v) => { setSelectedSpecialty(v); refetchSlots(); }}>
                    <SelectTrigger id="ai-health-assistant-filter-by-specialty" className="mt-2" data-testid="select-specialty">
                      <SelectValue placeholder="All Specialties" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Specialties</SelectItem>
                      {specialties.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {slotsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-32" />
                  </div>
                ) : (
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-6">
                      {Object.entries(groupedSlots).map(([date, dateSlots]) => (
                        <div key={date}>
                          <h4 className="font-medium mb-3 flex items-center gap-2 sticky top-0 bg-background py-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(date), "EEEE, MMMM d, yyyy")}
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {dateSlots.map((slot) => (
                              <Button
                                key={slot.id}
                                variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                                className="flex flex-col items-start h-auto py-3 px-4"
                                onClick={() => setSelectedSlot(slot)}
                                data-testid={`slot-${slot.id}`}
                              >
                                <span className="font-semibold">{slot.time}</span>
                                <span className="text-xs opacity-80">{slot.provider}</span>
                                <span className="text-xs opacity-60">{slot.specialty}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {selectedSlot && (
                  <div className="space-y-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium">Selected Appointment</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-2 font-medium">{format(parseISO(selectedSlot.date), "MMMM d, yyyy")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Time:</span>
                        <span className="ml-2 font-medium">{selectedSlot.time}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Provider:</span>
                        <span className="ml-2 font-medium">{selectedSlot.provider}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <span className="ml-2 font-medium">{selectedSlot.location}</span>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="reason">Reason for Visit</Label>
                      <Textarea
                        id="reason"
                        placeholder="Briefly describe the reason for your appointment..."
                        value={appointmentReason}
                        onChange={(e) => setAppointmentReason(e.target.value)}
                        className="mt-2"
                        data-testid="input-appointment-reason"
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => scheduleMutation.mutate(selectedSlot)}
                      disabled={scheduleMutation.isPending}
                      data-testid="button-confirm-schedule"
                    >
                      {scheduleMutation.isPending ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Scheduling...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Confirm Appointment
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {upcomingAppointments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-500" />
              Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-muted rounded-lg" data-testid={`appointment-${apt.id}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${apt.priority === "high" ? "bg-red-100 dark:bg-red-950/50" : "bg-green-100 dark:bg-green-950/50"}`}>
                      <Stethoscope className={`h-5 w-5 ${apt.priority === "high" ? "text-red-600" : "text-green-600"}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{apt.title}</p>
                      <p className="text-xs text-muted-foreground">{apt.description}</p>
                      {apt.dueDate && (
                        <p className="text-xs text-primary mt-1">
                          {format(parseISO(apt.dueDate), "EEEE, MMMM d 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowGuidanceDialog(true)} data-testid={`button-prep-${apt.id}`}>
                      <ClipboardCheck className="h-4 w-4 mr-1" />
                      Prepare
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => setShowScheduleDialog(true)} data-testid="button-quick-schedule">
              <CalendarPlus className="h-6 w-6 mb-2 text-green-500" />
              <span className="text-sm">Schedule Visit</span>
            </Button>
            <Button variant="outline" className="flex flex-col h-auto py-4" onClick={() => setShowGuidanceDialog(true)} data-testid="button-quick-prep">
              <ClipboardCheck className="h-6 w-6 mb-2 text-blue-500" />
              <span className="text-sm">Visit Prep</span>
            </Button>
            <Link href="/appointments">
              <Button variant="outline" className="flex flex-col h-auto py-4 w-full" data-testid="button-quick-history">
                <FileText className="h-6 w-6 mb-2 text-purple-500" />
                <span className="text-sm">View History</span>
              </Button>
            </Link>
            <Link href="/telehealth">
              <Button variant="outline" className="flex flex-col h-auto py-4 w-full" data-testid="button-quick-telehealth">
                <Phone className="h-6 w-6 mb-2 text-teal-500" />
                <span className="text-sm">Telehealth</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {guidanceDisclaimer && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          {guidanceDisclaimer}
        </div>
      )}

      {schedulingDisclaimer && (
        <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-xs text-muted-foreground flex items-start gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-green-500" />
          {schedulingDisclaimer}
        </div>
      )}

      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        Appointment scheduling is for informational purposes only. Please contact your healthcare provider's office directly to confirm your appointment.
      </div>
    </div>
  );
}

function RecommendationsSection({ profileId }: { profileId: string }) {
  const { data, isLoading, refetch, isFetching } = useQuery<{ recommendations: HealthRecommendation[] }>({
    queryKey: [`/api/ai-engagement/recommendations/${profileId}`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const recommendations = data?.recommendations || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Your Personalized Recommendations
          </h3>
          <p className="text-sm text-muted-foreground">AI-powered health guidance based on your profile</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-recommendations">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {recommendations.map((rec) => {
          const Icon = categoryIcons[rec.category] || Lightbulb;
          return (
            <Card key={rec.id} className="hover-elevate" data-testid={`recommendation-${rec.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${priorityColors[rec.priority] || priorityColors.medium}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{rec.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-xs capitalize">{rec.category.replace("_", " ")}</Badge>
                        {rec.timeframe && (
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {rec.timeframe}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={rec.priority === "high" ? "destructive" : "secondary"} className="text-xs capitalize shrink-0">
                    {rec.priority}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                <div className="space-y-2">
                  <p className="text-xs font-medium">Action Steps:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {rec.actionSteps.slice(0, 3).map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                        {step}
                      </li>
                    ))}
                  </ul>
                </div>
                {rec.benefits.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex flex-wrap gap-1">
                      {rec.benefits.slice(0, 2).map((benefit, i) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {recommendations.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recommendations available yet</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Generate Recommendations
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ContextOption {
  id: string;
  label: string;
  [key: string]: any;
}

interface ContextOptions {
  labResults: ContextOption[];
  conditions: ContextOption[];
  medications: ContextOption[];
  vitals: ContextOption[];
  documents: ContextOption[];
}

interface ContextSelectionState {
  useFullContext: boolean;
  labResultIds: string[];
  conditionIds: string[];
  medicationIds: string[];
  vitalIds: string[];
  documentIds: string[];
  timeRange: { start: string; end: string } | null;
}

const CATEGORY_CONFIG = [
  { key: "labResults" as const, label: "Lab Results", icon: TestTube, idKey: "labResultIds" as const, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950" },
  { key: "conditions" as const, label: "Conditions", icon: Heart, idKey: "conditionIds" as const, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-50 dark:bg-red-950" },
  { key: "medications" as const, label: "Medications", icon: Pill, idKey: "medicationIds" as const, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-50 dark:bg-green-950" },
  { key: "vitals" as const, label: "Vitals", icon: Activity, idKey: "vitalIds" as const, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-50 dark:bg-purple-950" },
  { key: "documents" as const, label: "Documents", icon: FileText, idKey: "documentIds" as const, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950" },
];

function ContextPickerPanel({
  profileId,
  selection,
  onSelectionChange,
}: {
  profileId: string;
  selection: ContextSelectionState;
  onSelectionChange: (sel: ContextSelectionState) => void;
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: contextData, isLoading } = useQuery<{ options: ContextOptions }>({
    queryKey: ["/api/health-assistant/context-options", profileId],
    enabled: !selection.useFullContext,
  });

  const options = contextData?.options;

  const totalSelected = selection.labResultIds.length + selection.conditionIds.length +
    selection.medicationIds.length + selection.vitalIds.length + selection.documentIds.length;

  const toggleItem = (categoryIdKey: keyof ContextSelectionState, itemId: string) => {
    const current = selection[categoryIdKey] as string[];
    const updated = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];
    onSelectionChange({ ...selection, [categoryIdKey]: updated });
  };

  const toggleAllInCategory = (categoryKey: keyof ContextOptions, idKey: keyof ContextSelectionState) => {
    const items = options?.[categoryKey] || [];
    const current = selection[idKey] as string[];
    const allSelected = items.every((item) => current.includes(item.id));
    onSelectionChange({
      ...selection,
      [idKey]: allSelected ? [] : items.map((item) => item.id),
    });
  };

  const clearAll = () => {
    onSelectionChange({
      useFullContext: false,
      labResultIds: [],
      conditionIds: [],
      medicationIds: [],
      vitalIds: [],
      documentIds: [],
      timeRange: null,
    });
  };

  if (selection.useFullContext) {
    return (
      <div className="p-3 border rounded-lg bg-muted/30 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Context: All patient data</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelectionChange({ ...selection, useFullContext: false })}
            data-testid="button-switch-granular"
          >
            <SlidersHorizontal className="h-3 w-3 mr-1" />
            Select specific data
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border rounded-lg mb-3 overflow-hidden" data-testid="context-picker-panel">
      <div className="p-3 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Context Control</span>
          {totalSelected > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-context-count">
              {totalSelected} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {totalSelected > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll} data-testid="button-clear-context">
              <XCircle className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onSelectionChange({ ...selection, useFullContext: true })}
            data-testid="button-use-full-context"
          >
            Use all data
          </Button>
        </div>
      </div>

      {selection.timeRange && (
        <div className="px-3 py-2 bg-blue-50 dark:bg-blue-950/50 border-b flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <CalendarRange className="h-3 w-3 text-blue-600" />
            <span>Time range: {selection.timeRange.start} to {selection.timeRange.end}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs p-1"
            onClick={() => onSelectionChange({ ...selection, timeRange: null })}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="px-3 py-2 border-b flex items-center gap-2">
        <CalendarRange className="h-3 w-3 text-muted-foreground" />
        <input
          type="date"
          className="text-xs bg-transparent border rounded px-2 py-1 w-28"
          placeholder="From"
          value={selection.timeRange?.start || ""}
          onChange={(e) =>
            onSelectionChange({
              ...selection,
              timeRange: { start: e.target.value, end: selection.timeRange?.end || "" },
            })
          }
          data-testid="input-time-start"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          className="text-xs bg-transparent border rounded px-2 py-1 w-28"
          placeholder="To"
          value={selection.timeRange?.end || ""}
          onChange={(e) =>
            onSelectionChange({
              ...selection,
              timeRange: { start: selection.timeRange?.start || "", end: e.target.value },
            })
          }
          data-testid="input-time-end"
        />
      </div>

      {isLoading ? (
        <div className="p-4 flex items-center justify-center">
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground ml-2">Loading data...</span>
        </div>
      ) : (
        <div className="max-h-[250px] overflow-y-auto">
          {CATEGORY_CONFIG.map((cat) => {
            const items = options?.[cat.key] || [];
            const selectedIds = selection[cat.idKey] as string[];
            const isExpanded = expandedCategory === cat.key;
            const Icon = cat.icon;

            return (
              <div key={cat.key} className="border-b last:border-b-0">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedCategory(isExpanded ? null : cat.key)}
                  data-testid={`category-toggle-${cat.key}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${cat.color}`} />
                    <span className="text-sm">{cat.label}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                    {selectedIds.length > 0 && (
                      <Badge variant="default" className="text-[10px] h-4 px-1">
                        {selectedIds.length}
                      </Badge>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {isExpanded && (
                  <div className="px-3 pb-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 pl-6">No {cat.label.toLowerCase()} available</p>
                    ) : (
                      <>
                        <button
                          className="text-xs text-primary hover:underline mb-1 pl-6"
                          onClick={() => toggleAllInCategory(cat.key, cat.idKey)}
                          data-testid={`select-all-${cat.key}`}
                        >
                          {items.every((i) => selectedIds.includes(i.id)) ? "Deselect all" : "Select all"}
                        </button>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <label
                              key={item.id}
                              className="flex items-start gap-2 pl-6 py-1 rounded hover:bg-muted/30 cursor-pointer"
                              data-testid={`context-item-${item.id}`}
                            >
                              <Checkbox
                                checked={selectedIds.includes(item.id)}
                                onCheckedChange={() => toggleItem(cat.idKey, item.id)}
                                className="mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium block truncate">{item.label}</span>
                                {item.value && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.value}{item.unit ? ` ${item.unit}` : ""}
                                    {item.flag ? ` [${item.flag}]` : ""}
                                  </span>
                                )}
                                {item.dosage && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {item.dosage}{item.frequency ? ` — ${item.frequency}` : ""}
                                  </span>
                                )}
                                {item.date && (
                                  <span className="text-[10px] text-muted-foreground block">{item.date}</span>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActiveContextChips({ selection, onRemove }: {
  selection: ContextSelectionState;
  onRemove: (idKey: keyof ContextSelectionState, itemId: string) => void;
}) {
  const totalSelected = selection.labResultIds.length + selection.conditionIds.length +
    selection.medicationIds.length + selection.vitalIds.length + selection.documentIds.length;

  if (selection.useFullContext || totalSelected === 0) return null;

  const chips: Array<{ label: string; idKey: keyof ContextSelectionState; itemId: string; color: string }> = [];

  CATEGORY_CONFIG.forEach((cat) => {
    const ids = selection[cat.idKey] as string[];
    if (ids.length > 3) {
      chips.push({ label: `${cat.label} (${ids.length})`, idKey: cat.idKey, itemId: "__all__", color: cat.color });
    } else {
      ids.forEach((id) => {
        chips.push({ label: `${cat.label.slice(0, 3)}:${id.substring(0, 12)}`, idKey: cat.idKey, itemId: id, color: cat.color });
      });
    }
  });

  return (
    <div className="flex flex-wrap gap-1 mb-2" data-testid="active-context-chips">
      <span className="text-[10px] text-muted-foreground self-center mr-1">Active context:</span>
      {chips.map((chip, i) => (
        <Badge
          key={i}
          variant="outline"
          className="text-[10px] h-5 px-1.5 gap-1 cursor-pointer hover:bg-destructive/10"
          onClick={() => {
            if (chip.itemId === "__all__") {
              onRemove(chip.idKey, "__all__");
            } else {
              onRemove(chip.idKey, chip.itemId);
            }
          }}
          data-testid={`chip-${chip.idKey}-${i}`}
        >
          <span className={chip.color}>{chip.label}</span>
          <X className="h-2 w-2" />
        </Badge>
      ))}
    </div>
  );
}

function ChatbotSection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Hello! I'm your AI health assistant. I can help you with:\n\n- Medication reminders and schedules\n- Appointment scheduling and preparation\n- Understanding your health records\n- General health information\n\nYou can select specific health data to focus our conversation using the Context Control panel above.\n\nHow can I help you today?",
      timestamp: new Date(),
      suggestions: ["When is my next appointment?", "Tell me about my medications", "Help me prepare for my visit"],
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [contextSelection, setContextSelection] = useState<ContextSelectionState>({
    useFullContext: true,
    labResultIds: [],
    conditionIds: [],
    medicationIds: [],
    vitalIds: [],
    documentIds: [],
    timeRange: null,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleRemoveChip = (idKey: keyof ContextSelectionState, itemId: string) => {
    if (itemId === "__all__") {
      setContextSelection((prev) => ({ ...prev, [idKey]: [] }));
    } else {
      setContextSelection((prev) => ({
        ...prev,
        [idKey]: (prev[idKey] as string[]).filter((id) => id !== itemId),
      }));
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    const query = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);

    const totalSelected = contextSelection.labResultIds.length + contextSelection.conditionIds.length +
      contextSelection.medicationIds.length + contextSelection.vitalIds.length + contextSelection.documentIds.length;

    const bodyPayload: any = { message: query, profileId };
    if (!contextSelection.useFullContext && totalSelected > 0) {
      bodyPayload.contextSelection = {
        useFullContext: false,
        labResultIds: contextSelection.labResultIds.length > 0 ? contextSelection.labResultIds : undefined,
        conditionIds: contextSelection.conditionIds.length > 0 ? contextSelection.conditionIds : undefined,
        medicationIds: contextSelection.medicationIds.length > 0 ? contextSelection.medicationIds : undefined,
        vitalIds: contextSelection.vitalIds.length > 0 ? contextSelection.vitalIds : undefined,
        documentIds: contextSelection.documentIds.length > 0 ? contextSelection.documentIds : undefined,
        timeRange: contextSelection.timeRange?.start ? contextSelection.timeRange : undefined,
      };
    }

    try {
      const response = await fetch("/api/health-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) throw new Error("Failed to get response");
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      let assistantMessage = "";
      const decoder = new TextDecoder();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", timestamp: new Date() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                assistantMessage += data.content;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: assistantMessage,
                  };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      if (assistantMessage) {
        try {
          const persistRes = await fetch("/api/health-assistant/persist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              profileId,
              userMessage: query,
              assistantResponse: assistantMessage,
              conversationId: activeConversationId,
            }),
          });
          if (persistRes.ok) {
            const result = await persistRes.json();
            if (!activeConversationId) {
              setActiveConversationId(result.conversationId);
            }
            queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/history"] });
          }
        } catch {}
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to get a response. Please try again.", variant: "destructive" });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">AI Health Assistant</h3>
            <p className="text-xs text-muted-foreground">Ask about appointments, medications, or health questions</p>
          </div>
        </div>
        <Button
          variant={showContextPicker ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setShowContextPicker(!showContextPicker)}
          data-testid="button-toggle-context"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Context
          {!contextSelection.useFullContext && (
            <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
              {contextSelection.labResultIds.length + contextSelection.conditionIds.length +
                contextSelection.medicationIds.length + contextSelection.vitalIds.length +
                contextSelection.documentIds.length || "Custom"}
            </Badge>
          )}
        </Button>
      </div>

      {showContextPicker && (
        <ContextPickerPanel
          profileId={profileId}
          selection={contextSelection}
          onSelectionChange={setContextSelection}
        />
      )}

      <ActiveContextChips selection={contextSelection} onRemove={handleRemoveChip} />

      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={`max-w-[80%] ${message.role === "user" ? "order-first" : ""}`}>
                <div
                  className={`rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.requiresFollowUp && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-orange-500">
                    <AlertTriangle className="h-3 w-3" />
                    Consider following up with your healthcare provider
                  </div>
                )}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-auto py-1"
                        onClick={() => handleSuggestionClick(suggestion)}
                        data-testid={`suggestion-${i}`}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {format(message.timestamp, "h:mm a")}
                </p>
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-secondary">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isStreaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-4 flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={contextSelection.useFullContext ? "Type your question..." : "Ask about selected health data..."}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          disabled={isStreaming}
          data-testid="input-chat"
        />
        <Button onClick={handleSend} disabled={!inputValue.trim() || isStreaming} data-testid="button-send">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface ConversationEntry {
  id: string;
  userId: string;
  patientId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messageCount: number;
  fingerprint: string | null;
  summary: string | null;
  mergedInto: string | null;
  tags: string[];
}

interface ConversationMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  fingerprint: string | null;
  createdAt: string;
}

interface InsightEntry {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  conversationIds: string[];
  topicsExtracted: string[];
  createdAt: string;
}

interface DuplicateGroup {
  fingerprint: string;
  conversations: ConversationEntry[];
}

function HistorySection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const { data: historyData, isLoading: historyLoading } = useQuery<{ conversations: ConversationEntry[] }>({
    queryKey: ["/api/health-assistant/history"],
  });

  const { data: conversationDetail, isLoading: detailLoading } = useQuery<{
    conversation: ConversationEntry;
    messages: ConversationMessage[];
  }>({
    queryKey: ["/api/health-assistant/history", selectedConversation],
    queryFn: async () => {
      const res = await fetch(`/api/health-assistant/history/${selectedConversation}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!selectedConversation,
  });

  const { data: insightsData } = useQuery<{ insights: InsightEntry[] }>({
    queryKey: ["/api/health-assistant/insights"],
    enabled: showInsights,
  });

  const { data: duplicatesData } = useQuery<{ duplicates: DuplicateGroup[] }>({
    queryKey: ["/api/health-assistant/duplicates"],
    enabled: showDuplicates,
  });

  const summarizeMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await apiRequest("POST", `/api/health-assistant/history/${conversationId}/summarize`);
      return res.json();
    },
    onSuccess: (_data, conversationId) => {
      toast({ title: "Summary Generated", description: "AI summary has been created for this conversation." });
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/history", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/insights"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate summary.", variant: "destructive" });
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ targetId, sourceIds }: { targetId: string; sourceIds: string[] }) => {
      const res = await apiRequest("POST", "/api/health-assistant/merge", { targetId, sourceIds });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Merged", description: "Duplicate conversations have been merged." });
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/duplicates"] });
      setShowDuplicates(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to merge conversations.", variant: "destructive" });
    },
  });

  const deleteInsightMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/health-assistant/insights/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-assistant/insights"] });
    },
  });

  const conversations = historyData?.conversations || [];
  const insights = insightsData?.insights || [];
  const duplicates = duplicatesData?.duplicates || [];

  const groupedByDate = conversations.reduce<Record<string, ConversationEntry[]>>((acc, conv) => {
    const dateKey = format(new Date(conv.createdAt), "MMMM d, yyyy");
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(conv);
    return acc;
  }, {});

  if (selectedConversation && conversationDetail) {
    const conv = conversationDetail.conversation;
    const msgs = conversationDetail.messages || [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setSelectedConversation(null)} data-testid="button-back-history">
            <ChevronRight className="h-4 w-4 rotate-180 mr-1" />
            Back to History
          </Button>
          <div className="flex-1" />
          {!conv.summary && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => summarizeMutation.mutate(conv.id)}
              disabled={summarizeMutation.isPending}
              data-testid="button-summarize-conversation"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {summarizeMutation.isPending ? "Generating..." : "Generate Summary"}
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base" data-testid="text-conversation-title">{conv.title}</CardTitle>
                <CardDescription data-testid="text-conversation-meta">
                  {format(new Date(conv.createdAt), "MMM d, yyyy 'at' h:mm a")} &middot; {conv.messageCount || msgs.length} messages
                </CardDescription>
              </div>
              {conv.tags && conv.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {conv.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-tag-${i}`}>{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          {conv.summary && (
            <CardContent className="pt-0 pb-4">
              <div className="p-3 bg-muted/50 rounded-lg" data-testid="section-ai-summary">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">AI Summary</span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-ai-summary">{conv.summary}</p>
              </div>
            </CardContent>
          )}
        </Card>

        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : msgs.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No messages in this conversation</p>
                  </div>
                ) : (
                  msgs.filter(m => m.role !== "system").map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`} data-testid={`message-${msg.role}-${msg.id}`}>
                      {msg.role === "assistant" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Bot className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="max-w-[80%]">
                        <div className={`rounded-lg p-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </p>
                      </div>
                      {msg.role === "user" && (
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="bg-secondary">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-500" />
            Conversation History
          </h3>
          <p className="text-sm text-muted-foreground">
            Browse past conversations and generate AI summaries
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={showInsights ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowInsights(!showInsights); setShowDuplicates(false); }}
            data-testid="button-toggle-insights"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Insights
          </Button>
          <Button
            variant={showDuplicates ? "default" : "outline"}
            size="sm"
            onClick={() => { setShowDuplicates(!showDuplicates); setShowInsights(false); }}
            data-testid="button-toggle-duplicates"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Find Duplicates
          </Button>
        </div>
      </div>

      {showInsights && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              AI-Generated Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insights.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No insights yet. Generate summaries from your conversations to create insights.
              </p>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div key={insight.id} className="p-3 border rounded-lg space-y-2" data-testid={`card-insight-${insight.id}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="text-sm font-medium" data-testid={`text-insight-title-${insight.id}`}>{insight.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{insight.type.replace("_", " ")}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteInsightMutation.mutate(insight.id)}
                          data-testid={`button-delete-insight-${insight.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{insight.content}</p>
                    {insight.topicsExtracted.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {insight.topicsExtracted.map((topic, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(insight.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {showDuplicates && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-orange-500" />
              Duplicate Conversations
            </CardTitle>
            <CardDescription>
              Conversations with similar content detected by fingerprinting
            </CardDescription>
          </CardHeader>
          <CardContent>
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No duplicate conversations found.
              </p>
            ) : (
              <div className="space-y-4">
                {duplicates.map((group) => (
                  <div key={group.fingerprint} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {group.conversations.length} duplicates
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Fingerprint: {group.fingerprint.slice(0, 8)}...
                      </span>
                    </div>
                    {group.conversations.map((conv) => (
                      <div key={conv.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-muted/50 rounded">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{conv.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(conv.createdAt), "MMM d, yyyy")} &middot; {conv.messageCount} messages
                          </p>
                        </div>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const [target, ...sources] = group.conversations;
                        mergeMutation.mutate({ targetId: target.id, sourceIds: sources.map(s => s.id) });
                      }}
                      disabled={mergeMutation.isPending}
                      data-testid={`button-merge-${group.fingerprint.slice(0, 8)}`}
                    >
                      {mergeMutation.isPending ? "Merging..." : "Merge into oldest"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {historyLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
            <h4 className="font-medium mb-1">No conversations yet</h4>
            <p className="text-sm text-muted-foreground">
              Start chatting with the AI Health Assistant to build your history
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, convs]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground font-medium">{dateLabel}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {convs.map((conv) => (
                  <Card
                    key={conv.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`card-conversation-${conv.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 rounded-lg bg-indigo-500/10 shrink-0 mt-0.5">
                            <MessageSquare className="h-4 w-4 text-indigo-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{conv.title}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(conv.createdAt), "h:mm a")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                &middot; {conv.messageCount || 0} messages
                              </span>
                              {conv.summary && (
                                <Badge variant="secondary" className="text-xs">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  Summarized
                                </Badge>
                              )}
                            </div>
                            {conv.tags && conv.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {conv.tags.slice(0, 3).map((tag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EducationSection({ profileId }: { profileId: string }) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { data, isLoading, refetch, isFetching } = useQuery<{ education: EducationContent[] }>({
    queryKey: [`/api/ai-engagement/education/${profileId}`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  const education = data?.education || [];
  const selectedContent = selectedTopic ? education.find((e) => e.id === selectedTopic) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Personalized Health Education
          </h3>
          <p className="text-sm text-muted-foreground">Learn about topics relevant to your health</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setSelectedTopic(null); refetch(); }} disabled={isFetching} data-testid="button-refresh-education">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          New Topics
        </Button>
      </div>

      {selectedContent ? (
        <Card data-testid="education-detail">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTopic(null)} data-testid="button-back">
                <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                Back to topics
              </Button>
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {selectedContent.estimatedReadTime} min read
              </Badge>
            </div>
            <CardTitle className="mt-2">{selectedContent.title}</CardTitle>
            <CardDescription>{selectedContent.personalizationNote}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {selectedContent.content.split("\n\n").map((paragraph, i) => (
                <p key={i} className="text-sm text-muted-foreground mb-3">
                  {paragraph.startsWith("**") ? (
                    <span className="font-semibold text-foreground">{paragraph.replace(/\*\*/g, "")}</span>
                  ) : (
                    paragraph
                  )}
                </p>
              ))}
            </div>

            <div className="p-4 bg-primary/5 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Key Takeaways
              </h4>
              <ul className="space-y-2">
                {selectedContent.keyTakeaways.map((takeaway, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    {takeaway}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                What You Can Do
              </h4>
              <ul className="space-y-2">
                {selectedContent.actionItems.map((action, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <ArrowRight className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            {selectedContent.relatedTopics.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Related Topics</p>
                <div className="flex flex-wrap gap-2">
                  {selectedContent.relatedTopics.map((topic, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {education.map((content) => (
            <Card key={content.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedTopic(content.id)} data-testid={`education-${content.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <BookOpen className="h-6 w-6 text-blue-500" />
                  <Badge variant="secondary" className="text-xs">
                    {content.estimatedReadTime} min
                  </Badge>
                </div>
                <CardTitle className="text-base mt-2">{content.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">{content.summary}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {content.targetConditions.slice(0, 2).map((condition, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{condition}</Badge>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-3 w-full" data-testid={`button-read-${content.id}`}>
                  Read Article <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {education.length === 0 && !selectedContent && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No education content available yet</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Generate Content
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const severityConfig = {
  critical: { color: "text-red-600 bg-red-100 dark:bg-red-950/50", border: "border-red-200 dark:border-red-800" },
  high: { color: "text-orange-600 bg-orange-100 dark:bg-orange-950/50", border: "border-orange-200 dark:border-orange-800" },
  medium: { color: "text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50", border: "border-yellow-200 dark:border-yellow-800" },
  low: { color: "text-green-600 bg-green-100 dark:bg-green-950/50", border: "border-green-200 dark:border-green-800" },
};

const riskLevelConfig = {
  high: { color: "text-red-600", bg: "bg-red-500", label: "High Risk" },
  elevated: { color: "text-orange-600", bg: "bg-orange-500", label: "Elevated" },
  moderate: { color: "text-yellow-600", bg: "bg-yellow-500", label: "Moderate" },
  low: { color: "text-green-600", bg: "bg-green-500", label: "Low Risk" },
};

const categoryLabels: Record<string, string> = {
  vital_trend: "Vital Signs",
  lab_abnormality: "Lab Results",
  medication_interaction: "Medications",
  adherence: "Adherence",
  lifestyle: "Lifestyle",
  chronic_progression: "Condition Progress",
};

function ProactiveRiskSection({ profileId }: { profileId: string }) {
  const [selectedIndicator, setSelectedIndicator] = useState<HealthRiskIndicator | null>(null);

  const { data: riskSummary, isLoading, refetch, isFetching } = useQuery<ProactiveRiskSummary>({
    queryKey: [`/api/proactive-risk/analyze?profileId=${profileId}`],
  });

  useEffect(() => {
    fetch("/api/proactive-risk/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ 
        event: "proactive_risk_dashboard_opened",
        platform: "web",
        appVersion: "1.0.0",
        source: "ai_health_assistant",
        profileId,
      }),
    }).catch(() => {});
  }, [profileId]);

  const handleViewIndicator = (indicator: HealthRiskIndicator) => {
    setSelectedIndicator(indicator);
    fetch("/api/proactive-risk/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ 
        event: "proactive_risk_indicator_viewed",
        indicatorId: indicator.id,
        platform: "web",
        appVersion: "1.0.0",
        source: "ai_health_assistant",
      }),
    }).catch(() => {});
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!riskSummary) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Unable to analyze health risks</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const levelConfig = riskLevelConfig[riskSummary.riskLevel];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-blue-500" />
            Proactive Health Risk Analysis
          </h3>
          <p className="text-sm text-muted-foreground">AI-powered analysis of your health data patterns</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="button-refresh-risk">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh Analysis
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Gauge className="h-16 w-16 text-muted-foreground" />
                <div className={`absolute inset-0 flex items-center justify-center font-bold text-xl ${levelConfig.color}`}>
                  {riskSummary.overallRiskScore}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Risk Score</p>
                <Badge className={`${levelConfig.bg} text-white mt-1`} data-testid="badge-risk-level">
                  {levelConfig.label}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  Analyzed {formatDistanceToNow(new Date(riskSummary.lastAnalyzedAt), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Improving</p>
                <p className="font-semibold text-green-600">{riskSummary.trendingFactors.improving.length}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Activity className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Stable</p>
                <p className="font-semibold text-gray-600">{riskSummary.trendingFactors.stable.length}</p>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Needs Attention</p>
                <p className="font-semibold text-red-600">{riskSummary.trendingFactors.worsening.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {riskSummary.indicators.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {riskSummary.indicators.map((indicator) => {
            const config = severityConfig[indicator.severity];
            return (
              <Card key={indicator.id} className={`${config.border} hover-elevate`} data-testid={`indicator-${indicator.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldAlert className={`h-4 w-4 ${config.color.split(" ")[0]}`} />
                      {indicator.title}
                    </CardTitle>
                    <Badge className={config.color}>{indicator.severity}</Badge>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs">{categoryLabels[indicator.category]}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{indicator.description}</p>
                  {indicator.dataPoints.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium">Data points:</span> {indicator.dataPoints.slice(0, 2).join(", ")}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleViewIndicator(indicator)} data-testid={`button-view-${indicator.id}`}>
                    View Details
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground flex items-start gap-2">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        Risk analysis is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider for medical decisions.
      </div>
    </div>
  );
}

export default function AIHealthAssistant() {
  const [activeTab, setActiveTab] = useState("medications");
  const profileId = useActiveProfile();

  return (
    <div className="p-6 space-y-6" data-testid="page-ai-health-assistant">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            AI Health Assistant
          </h1>
          <p className="text-lg text-muted-foreground">
            Your personal AI-powered health guide with medication reminders, appointment scheduling, and personalized insights
          </p>
        </div>
      </div>

      <UserProfileCard profileId={profileId} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Ask Questions
          </TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">
            <ShieldAlert className="h-4 w-4 mr-2" />
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Sparkles className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">
            <BookOpen className="h-4 w-4 mr-2" />
            Learn
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="medications">
          <MedicationsSection profileId={profileId} />
        </TabsContent>

        <TabsContent value="appointments">
          <AppointmentsSection profileId={profileId} />
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardContent className="pt-6">
              <ChatbotSection profileId={profileId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <ProactiveRiskSection profileId={profileId} />
        </TabsContent>

        <TabsContent value="recommendations">
          <RecommendationsSection profileId={profileId} />
        </TabsContent>

        <TabsContent value="education">
          <EducationSection profileId={profileId} />
        </TabsContent>

        <TabsContent value="history">
          <HistorySection profileId={profileId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
