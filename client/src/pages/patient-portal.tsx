import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ELI12Explainer } from "@/components/eli12-explainer";
import { HealthInsights } from "@/components/health-insights";
import { TimelineStoryMode } from "@/components/timeline-story";
import { SourceConfidenceView } from "@/components/source-confidence";
import { DeltaView } from "@/components/delta-view";
import { MedicalText, HighlightedTerm } from "@/components/tap-to-define";
import { VisitPrepPackButton } from "@/components/visit-prep-pack";
import { MedReconciliationFlow } from "@/components/med-reconciliation";
import { SmartSearchBar } from "@/components/smart-search";
import { ClinicalSnapshotCard } from "@/components/clinical-snapshot";
import { RecordQualityCard } from "@/components/record-quality-alerts";
import { DocumentAutoTaggingCard } from "@/components/document-auto-tagging";
import { ImagingTranslatorCard } from "@/components/imaging-report-translator";
import { HealthInboxCard } from "@/components/health-inbox";
import { CarePlanCard } from "@/components/care-plan-management";
import { CaregiverModeCard } from "@/components/caregiver-mode";
import { PrivacyCenterCard } from "@/components/privacy-center";
import { ELI12Card, TimelineStoryCard, WhatChangedCard, SmartSearchCard, SnapshotExportCard } from "@/components/usability-bundle";
import { DocumentSummaryCard } from "@/components/document-summary";
import { PatientDashboardCard } from "@/components/patient-dashboard";
import { RecordObservationsCard } from "@/components/record-observations";
import { QuickStartGuide } from "@/components/onboarding";
import { QuickShareModal } from "@/components/quick-share-modal";
import { PersonalizedHealthInsightsCard } from "@/components/personalized-health-insights";
import { SymptomTrackerCard } from "@/components/symptom-tracker";
import { HealthCoachCard } from "@/components/health-coach";
import { HealthVisualizationCard } from "@/components/health-visualization";
import { AppointmentAssistantCard } from "@/components/appointment-assistant";
import { HealthJournalCard } from "@/components/health-journal";
import { CaregiverSupportCard } from "@/components/caregiver-support";
import { ClinicianSummaryCard } from "@/components/clinician-summary";
import { ProactiveAlertsCard } from "@/components/proactive-alerts";
import { EHRConnectionsCard } from "@/components/ehr-connections";
import { ConsolidatedHealthRecordsCard } from "@/components/consolidated-health-records";
import { ConsolidatedLabResultsCard } from "@/components/consolidated-lab-results";
import { HealthRecordsSummaryCard } from "@/components/health-records-summary";
import { ConditionEducationCard } from "@/components/condition-education-card";
import { HealthGoalsCard } from "@/components/health-goals-card";
import { VitalsMonitoringCard } from "@/components/vitals-monitoring-card";
import { EnhancedInsightsCard } from "@/components/enhanced-insights-card";
import { PersonalizedEducationCard } from "@/components/personalized-education-card";
import { MedicationManagementCard } from "@/components/medication-management-card";
import { DentalRecordsCard } from "@/components/dental-records-card";
import { PediatricGrowthCharts } from "@/components/pediatric-growth-charts";
import { AdultVitalsTrends } from "@/components/adult-vitals-trends";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  MessageSquare,
  Send,
  GraduationCap,
  Pill,
  Users,
  Share2,
  Bell,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Plus,
  Calendar,
  Heart,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Stethoscope,
  Activity,
  TrendingUp,
  Award,
  BookOpen,
  Video,
  Settings,
  Shield,
  UserPlus,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Check,
  X,
  FlaskConical,
  MapPin,
  Phone,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ClipboardList,
  Camera,
  Mic,
  Volume2,
  Wifi,
  Globe,
  Languages,
  Syringe,
  Target,
  CalendarCheck,
  AlertTriangle,
  Info,
  Brain,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { clickable } from "@/lib/a11y";

interface PortalMessage {
  id: string;
  threadId: string;
  subject: string;
  snippet: string;
  senderName: string;
  senderRole: string;
  timestamp: string;
  isRead: boolean;
  priority: "normal" | "high" | "urgent";
}

interface EducationModule {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: string;
  progress: number;
  isRecommended: boolean;
  tags: string[];
}

interface MedicationReminder {
  id: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  status: "pending" | "taken" | "missed" | "snoozed";
  nextDue: string;
  adherenceRate: number;
  streak: number;
}

interface SharedRecord {
  id: string;
  recipientName: string;
  recipientEmail: string;
  relationship: string;
  sharedCategories: string[];
  accessLevel: "view" | "download" | "full";
  expiresAt: string | null;
  isActive: boolean;
  lastAccessed: string | null;
}

interface Caregiver {
  id: string;
  name: string;
  email: string;
  relationship: string;
  permissions: string[];
  status: "active" | "pending" | "revoked";
  invitedAt: string;
}

interface LabResult {
  id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: "normal" | "high" | "low" | "critical";
  category: string;
  orderedBy: string;
  performedAt: string;
  resultAt: string;
  isNew: boolean;
}

interface PortalAppointment {
  id: string;
  title: string;
  providerName: string;
  specialty: string;
  location: string;
  scheduledAt: string;
  duration: number;
  status: "confirmed" | "pending" | "cancelled";
  type: "in-person" | "telehealth";
  notes: string;
  hasPreVisitChecklist: boolean;
}

interface Prescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  pharmacy: string;
  refillsRemaining: number;
  lastFilledAt: string;
  nextRefillDate: string | null;
  status: "active" | "needs_renewal" | "expired";
  canRequestRefill: boolean;
}

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  isCompleted: boolean;
  isRequired: boolean;
  formUrl?: string;
  actionUrl?: string;
}

interface PreVisitChecklist {
  appointmentId: string;
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
  requiredCount: number;
  completedRequiredCount: number;
}

const inviteCaregiverSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Please select a relationship"),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});

type InviteCaregiverForm = z.infer<typeof inviteCaregiverSchema>;

const shareRecordSchema = z.object({
  recipientEmail: z.string().email("Please enter a valid email address"),
  recipientName: z.string().min(1, "Name is required"),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  accessLevel: z.enum(["view", "download", "full"]),
  expiresInDays: z.string().optional(),
});

type ShareRecordForm = z.infer<typeof shareRecordSchema>;

const appointmentRequestSchema = z.object({
  specialty: z.string().min(1, "Please select a specialty"),
  reason: z.string().min(10, "Please describe your reason for the visit"),
  preferredDates: z.string().min(1, "Please select preferred dates"),
  preferredTime: z.string().min(1, "Please select a preferred time"),
  appointmentType: z.enum(["in-person", "telehealth"]),
});

type AppointmentRequestForm = z.infer<typeof appointmentRequestSchema>;

function LabResultsSection() {
  const { data: labResults, isLoading } = useQuery<LabResult[]>({
    queryKey: ["/api/portal/lab-results"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  const newResults = labResults?.filter((r) => r.isNew) || [];

  return (
    <Card data-testid="card-lab-results">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-purple-500" />
            Lab Results
            {newResults.length > 0 && (
              <Badge variant="secondary" className="ml-1">{newResults.length} new</Badge>
            )}
          </CardTitle>
          <Link href="/documents">
            <Button variant="ghost" size="sm" data-testid="link-all-results">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>Your recent test results and lab work</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {labResults && labResults.length > 0 ? (
              labResults.map((result) => (
                <div key={result.id} className={`p-3 rounded-lg border ${result.isNew ? "bg-primary/5 border-primary/20" : ""}`} data-testid={`lab-result-${result.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <HighlightedTerm term={result.testName} className="text-sm font-medium" />
                        <ELI12Explainer
                          term={result.testName}
                          recordType="lab_result"
                          value={result.value}
                          unit={result.unit}
                          referenceRange={result.referenceRange}
                          variant="icon"
                        />
                        {result.isNew && <Badge className="text-xs">New</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-lg font-bold ${
                          result.status === "normal" ? "text-green-600" :
                          result.status === "high" ? "text-orange-500" :
                          result.status === "low" ? "text-blue-500" :
                          "text-red-500"
                        }`}>
                          {result.value}{result.unit && ` ${result.unit}`}
                        </span>
                        {result.status !== "normal" && (
                          <span className="flex items-center text-xs text-muted-foreground">
                            {result.status === "high" ? <ArrowUpRight className="h-3 w-3 text-orange-500" /> : 
                             result.status === "low" ? <ArrowDownRight className="h-3 w-3 text-blue-500" /> : null}
                            {result.referenceRange && `(ref: ${result.referenceRange})`}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {result.orderedBy} | {format(new Date(result.resultAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{result.category}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <FlaskConical className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No lab results yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function AppointmentsSection() {
  const { toast } = useToast();
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const { data: appointments, isLoading } = useQuery<PortalAppointment[]>({
    queryKey: ["/api/portal/appointments"],
  });

  const requestForm = useForm<AppointmentRequestForm>({
    resolver: zodResolver(appointmentRequestSchema),
    defaultValues: {
      specialty: "",
      reason: "",
      preferredDates: "",
      preferredTime: "morning",
      appointmentType: "in-person",
    },
  });

  const requestAppointmentMutation = useMutation({
    mutationFn: async (data: AppointmentRequestForm) => {
      return apiRequest("POST", "/api/portal/appointments/request", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/appointments"] });
      toast({ title: "Request Submitted", description: "Our scheduling team will contact you within 1-2 business days." });
      setIsRequestDialogOpen(false);
      requestForm.reset();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const upcomingAppointments = appointments?.filter(
    (a) => new Date(a.scheduledAt) > new Date() && a.status !== "cancelled"
  ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()) || [];

  return (
    <Card data-testid="card-appointments">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-pink-500" />
            Upcoming Appointments
          </CardTitle>
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-schedule-appointment">
                <Plus className="h-4 w-4 mr-1" />
                Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request an Appointment</DialogTitle>
                <DialogDescription>Tell us about your visit and we'll find the best time for you.</DialogDescription>
              </DialogHeader>
              <Form {...requestForm}>
                <form onSubmit={requestForm.handleSubmit((data) => requestAppointmentMutation.mutate(data))} className="space-y-4">
                  <FormField control={requestForm.control} name="specialty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>What type of visit do you need?</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-specialty">
                            <SelectValue placeholder="Select a specialty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="primary-care">Primary Care</SelectItem>
                          <SelectItem value="cardiology">Heart Doctor</SelectItem>
                          <SelectItem value="dermatology">Skin Doctor</SelectItem>
                          <SelectItem value="orthopedics">Bone & Joint Doctor</SelectItem>
                          <SelectItem value="mental-health">Mental Health</SelectItem>
                          <SelectItem value="lab-work">Lab Work</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={requestForm.control} name="reason" render={({ field }) => (
                    <FormItem>
                      <FormLabel>What's the reason for your visit?</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe your symptoms or reason for the visit..." {...field} data-testid="input-reason" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={requestForm.control} name="preferredDates" render={({ field }) => (
                    <FormItem>
                      <FormLabel>When works best for you?</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Next week, Jan 20-25" {...field} data-testid="input-dates" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={requestForm.control} name="preferredTime" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred time of day</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-time">
                            <SelectValue placeholder="Select time preference" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="morning">Morning (8am - 12pm)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12pm - 5pm)</SelectItem>
                          <SelectItem value="evening">Evening (5pm - 8pm)</SelectItem>
                          <SelectItem value="any">Any time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={requestForm.control} name="appointmentType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visit type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in-person">In-Person Visit</SelectItem>
                          <SelectItem value="telehealth">Video Visit</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={requestAppointmentMutation.isPending} data-testid="button-submit-request">
                      {requestAppointmentMutation.isPending ? "Submitting..." : "Submit Request"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>View and manage your upcoming visits</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map((apt) => (
                <div key={apt.id} className="p-3 rounded-lg border" data-testid={`appointment-${apt.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 px-2 py-1 min-w-[45px]">
                        <span className="text-xs font-medium text-primary">{format(new Date(apt.scheduledAt), "MMM")}</span>
                        <span className="text-lg font-bold text-primary">{format(new Date(apt.scheduledAt), "d")}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{apt.title}</p>
                        <p className="text-xs text-muted-foreground">{apt.providerName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(apt.scheduledAt), "h:mm a")}
                          </span>
                          <Badge variant={apt.type === "telehealth" ? "secondary" : "outline"} className="text-xs">
                            {apt.type === "telehealth" ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                            {apt.type === "telehealth" ? "Video" : "In-Person"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <VisitPrepPackButton
                        appointment={{
                          id: apt.id,
                          type: apt.title,
                          provider: apt.providerName,
                          specialty: apt.specialty || "General",
                          scheduledDate: apt.scheduledAt,
                        }}
                      />
                      {apt.hasPreVisitChecklist && (
                        <Link href={`/patient-portal?checklist=${apt.id}`}>
                          <Button variant="outline" size="sm" data-testid={`button-checklist-${apt.id}`}>
                            <ClipboardList className="h-3 w-3 mr-1" />
                            Checklist
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  {apt.notes && (
                    <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                      {apt.notes}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setIsRequestDialogOpen(true)} data-testid="button-schedule-first">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule a Visit
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PrescriptionsSection() {
  const { toast } = useToast();
  const { data: prescriptions, isLoading, refetch } = useQuery<Prescription[]>({
    queryKey: ["/api/portal/prescriptions"],
  });

  const requestRefillMutation = useMutation({
    mutationFn: async (prescriptionId: string) => {
      return apiRequest("POST", `/api/portal/prescriptions/${prescriptionId}/refill`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/prescriptions"] });
      toast({ title: "Refill Requested", description: "You'll be notified when your prescription is ready." });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const needsAttention = prescriptions?.filter((p) => p.status === "needs_renewal" || (p.refillsRemaining <= 1 && p.canRequestRefill)) || [];

  return (
    <Card data-testid="card-prescriptions">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-green-500" />
            Prescriptions
            {needsAttention.length > 0 && (
              <Badge variant="destructive" className="ml-1">{needsAttention.length} need attention</Badge>
            )}
          </CardTitle>
          <Link href="/medications">
            <Button variant="ghost" size="sm" data-testid="link-all-prescriptions">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <div className="flex items-center justify-between gap-2">
          <CardDescription>Request refills and manage your medications</CardDescription>
          <MedReconciliationFlow />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {prescriptions && prescriptions.length > 0 ? (
              prescriptions.map((rx) => (
                <div key={rx.id} className={`p-3 rounded-lg border ${rx.status === "needs_renewal" ? "border-orange-300 bg-orange-50/50 dark:bg-orange-950/20" : ""}`} data-testid={`prescription-${rx.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <HighlightedTerm term={rx.medicationName} className="text-sm font-medium" />
                        <ELI12Explainer
                          term={rx.medicationName}
                          recordType="medication"
                          context={`${rx.dosage}, ${rx.frequency}`}
                          variant="icon"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{rx.dosage} - {rx.frequency}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={rx.status === "active" ? "secondary" : "destructive"} className="text-xs">
                          {rx.status === "active" ? `${rx.refillsRemaining} refills left` : "Needs renewal"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{rx.pharmacy}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {rx.canRequestRefill ? (
                        <Button size="sm" onClick={() => requestRefillMutation.mutate(rx.id)} disabled={requestRefillMutation.isPending} data-testid={`button-refill-${rx.id}`}>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refill
                        </Button>
                      ) : rx.status === "needs_renewal" ? (
                        <Link href="/messages">
                          <Button size="sm" variant="outline" data-testid={`button-renew-${rx.id}`}>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Request
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <Pill className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No active prescriptions</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PreVisitChecklistSection({ appointmentId }: { appointmentId: string }) {
  const { toast } = useToast();
  const { data: checklist, isLoading, refetch } = useQuery<PreVisitChecklist>({
    queryKey: ["/api/portal/appointments", appointmentId, "checklist"],
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/portal/checklist/${itemId}`, { isCompleted });
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Checklist Updated" });
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!checklist) return null;

  return (
    <Card data-testid="card-previsit-checklist">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-indigo-500" />
          Pre-Visit Checklist
        </CardTitle>
        <CardDescription>
          Complete these items before your appointment ({checklist.completedRequiredCount}/{checklist.requiredCount} required items done)
        </CardDescription>
        <Progress value={(checklist.completedCount / checklist.totalCount) * 100} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.items.map((item) => (
            <div key={item.id} className={`p-3 rounded-lg border flex items-start gap-3 ${item.isCompleted ? "bg-green-50/50 dark:bg-green-950/20" : ""}`} data-testid={`checklist-item-${item.id}`}>
              <Button
                variant={item.isCompleted ? "default" : "outline"}
                size="icon"
                className="shrink-0 h-6 w-6"
                onClick={() => updateChecklistMutation.mutate({ itemId: item.id, isCompleted: !item.isCompleted })}
                data-testid={`button-toggle-${item.id}`}
              >
                {item.isCompleted && <Check className="h-3 w-3" />}
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {item.title}
                  </span>
                  {item.isRequired && <Badge variant="secondary" className="text-xs">Required</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                {item.actionUrl && !item.isCompleted && (
                  <Link href={item.actionUrl}>
                    <Button variant="ghost" size="sm" className="h-auto p-0 mt-1 text-primary" data-testid={`link-action-${item.id}`}>
                      Complete this step <ChevronRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MediaTestingSection() {
  const [cameraStatus, setCameraStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [speakerStatus, setSpeakerStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const testCamera = async () => {
    setCameraStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraStatus("success");
    } catch {
      setCameraStatus("error");
    }
  };

  const testMicrophone = async () => {
    setMicStatus("testing");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicStatus("success");
    } catch {
      setMicStatus("error");
    }
  };

  const testSpeakers = () => {
    setSpeakerStatus("testing");
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
    oscillator.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      setSpeakerStatus("success");
    }, 500);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "testing": return <RefreshCw className="h-4 w-4 animate-spin" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card data-testid="card-media-testing">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Video className="h-5 w-5 text-blue-500" />
          Video Visit Setup
        </CardTitle>
        <CardDescription>Test your camera, microphone, and speakers before your video visit</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Camera</p>
                <p className="text-xs text-muted-foreground">For video calls with your doctor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(cameraStatus)}
              <Button size="sm" variant="outline" onClick={testCamera} disabled={cameraStatus === "testing"} data-testid="button-test-camera">
                Test
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Mic className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Microphone</p>
                <p className="text-xs text-muted-foreground">So your doctor can hear you</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(micStatus)}
              <Button size="sm" variant="outline" onClick={testMicrophone} disabled={micStatus === "testing"} data-testid="button-test-mic">
                Test
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Speakers</p>
                <p className="text-xs text-muted-foreground">So you can hear your doctor</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon(speakerStatus)}
              <Button size="sm" variant="outline" onClick={testSpeakers} disabled={speakerStatus === "testing"} data-testid="button-test-speakers">
                Test
              </Button>
            </div>
          </div>
        </div>
        {cameraStatus === "success" && micStatus === "success" && speakerStatus === "success" && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-medium">All set! You're ready for your video visit.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessagesSection() {
  const { data: messages, isLoading } = useQuery<PortalMessage[]>({
    queryKey: ["/api/portal/messages/recent"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  return (
    <Card data-testid="card-messages">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Messages from Your Doctor
          </CardTitle>
          <Link href="/messages">
            <Button variant="ghost" size="sm" data-testid="link-all-messages">
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>Read and send private messages to your doctors and nurses</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {messages && messages.length > 0 ? (
              messages.map((msg) => (
                <Link key={msg.id} href={`/messages?thread=${msg.threadId}`}>
                  <div className={`p-3 rounded-lg border cursor-pointer hover-elevate ${!msg.isRead ? "bg-primary/5 border-primary/20" : ""}`} data-testid={`message-${msg.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{msg.senderName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{msg.senderName}</span>
                            {!msg.isRead && <Badge className="h-2 w-2 p-0 rounded-full bg-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{msg.senderRole}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {msg.priority !== "normal" && (
                          <Badge variant={msg.priority === "urgent" ? "destructive" : "default"} className="text-xs">
                            {msg.priority}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <p className="text-sm font-medium mt-2 truncate">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{msg.snippet}</p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
                <Link href="/messages">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="button-new-message">
                    <Plus className="h-4 w-4 mr-2" />
                    Start a Conversation
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="mt-4 pt-4 border-t">
          <Link href="/messages">
            <Button className="w-full" data-testid="button-compose-message">
              <Send className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function EducationSection() {
  const { data: modules, isLoading } = useQuery<EducationModule[]>({
    queryKey: ["/api/portal/education/recommended"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <Card data-testid="card-education">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5 text-emerald-500" />
            Learn About Your Health
          </CardTitle>
          <Link href="/learn">
            <Button variant="ghost" size="sm" data-testid="link-all-education">
              Browse All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>Easy-to-understand articles and videos about your health</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          <div className="space-y-3">
            {modules && modules.length > 0 ? (
              modules.map((module) => (
                <div key={module.id} className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`education-${module.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{module.title}</span>
                        {module.isRecommended && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{module.description}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-xs">{module.category}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {module.duration}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {module.progress > 0 && (
                        <div className="w-16">
                          <Progress value={module.progress} className="h-1.5" />
                          <span className="text-xs text-muted-foreground">{module.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No recommended content yet</p>
                <Link href="/learn">
                  <Button variant="outline" size="sm" className="mt-3" data-testid="button-explore-education">
                    Explore Library
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MedicationAdherenceSection() {
  const { toast } = useToast();
  const { data: reminders, isLoading, refetch } = useQuery<MedicationReminder[]>({
    queryKey: ["/api/portal/medications/reminders"],
  });

  const markTakenMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return apiRequest("POST", `/api/portal/medications/${reminderId}/taken`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/medications/reminders"] });
      toast({ title: "Medication Logged", description: "Great job staying on track!" });
    },
  });

  const snoozeReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      return apiRequest("POST", `/api/portal/medications/${reminderId}/snooze`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/medications/reminders"] });
      toast({ title: "Reminder Snoozed", description: "We'll remind you again in 30 minutes." });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const pendingReminders = reminders?.filter((r) => r.status === "pending") || [];
  const overallAdherence = reminders?.length ? Math.round(reminders.reduce((sum, r) => sum + r.adherenceRate, 0) / reminders.length) : 0;

  return (
    <Card data-testid="card-medications">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-orange-500" />
            Medication Reminders
          </CardTitle>
          <Link href="/medications">
            <Button variant="ghost" size="sm" data-testid="link-all-medications">
              All Medications <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>Track your medications and stay on schedule</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Overall Adherence</p>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${overallAdherence >= 80 ? "text-green-500" : overallAdherence >= 60 ? "text-yellow-500" : "text-red-500"}`} data-testid="text-adherence-rate">
              {overallAdherence}%
            </p>
          </div>
        </div>

        <ScrollArea className="h-[220px]">
          <div className="space-y-3">
            {pendingReminders.length > 0 ? (
              pendingReminders.map((reminder) => (
                <div key={reminder.id} className="p-3 rounded-lg border" data-testid={`reminder-${reminder.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{reminder.medicationName}</p>
                      <p className="text-xs text-muted-foreground">{reminder.dosage}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Due: {format(new Date(reminder.scheduledTime), "h:mm a")}</span>
                        {reminder.streak > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Award className="h-3 w-3 mr-1" />
                            {reminder.streak} day streak
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="icon" variant="outline" onClick={() => snoozeReminderMutation.mutate(reminder.id)} disabled={snoozeReminderMutation.isPending} data-testid={`button-snooze-${reminder.id}`}>
                        <Clock className="h-4 w-4" />
                      </Button>
                      <Button size="icon" onClick={() => markTakenMutation.mutate(reminder.id)} disabled={markTakenMutation.isPending} data-testid={`button-taken-${reminder.id}`}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                <p className="text-sm font-medium text-green-600">All caught up!</p>
                <p className="text-xs text-muted-foreground">No pending medication reminders</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function SharingSection() {
  const { toast } = useToast();
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const { data: caregivers, isLoading: caregiversLoading } = useQuery<Caregiver[]>({
    queryKey: ["/api/portal/caregivers"],
  });

  const { data: sharedRecords, isLoading: recordsLoading } = useQuery<SharedRecord[]>({
    queryKey: ["/api/portal/shared-records"],
  });

  const inviteForm = useForm<InviteCaregiverForm>({
    resolver: zodResolver(inviteCaregiverSchema),
    defaultValues: {
      email: "",
      name: "",
      relationship: "",
      permissions: ["view_records"],
    },
  });

  const shareForm = useForm<ShareRecordForm>({
    resolver: zodResolver(shareRecordSchema),
    defaultValues: {
      recipientEmail: "",
      recipientName: "",
      categories: [],
      accessLevel: "view",
      expiresInDays: "30",
    },
  });

  const inviteCaregiverMutation = useMutation({
    mutationFn: async (data: InviteCaregiverForm) => {
      return apiRequest("POST", "/api/portal/caregivers/invite", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/caregivers"] });
      toast({ title: "Invitation Sent", description: "Your caregiver will receive an email invitation." });
      setIsInviteDialogOpen(false);
      inviteForm.reset();
    },
  });

  const shareRecordMutation = useMutation({
    mutationFn: async (data: ShareRecordForm) => {
      return apiRequest("POST", "/api/portal/share-records", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/shared-records"] });
      toast({ title: "Records Shared", description: "A secure link has been sent to the recipient." });
      setIsShareDialogOpen(false);
      shareForm.reset();
    },
  });

  const revokeAccessMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/portal/shared-records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/shared-records"] });
      toast({ title: "Access Revoked", description: "The recipient can no longer view your records." });
    },
  });

  const isLoading = caregiversLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  const activeCaregivers = caregivers?.filter((c) => c.status === "active") || [];
  const activeShares = sharedRecords?.filter((r) => r.isActive) || [];

  return (
    <Card data-testid="card-sharing">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Share2 className="h-5 w-5 text-violet-500" />
            Share Health Records
          </CardTitle>
          <Link href="/caregivers">
            <Button variant="ghost" size="sm" data-testid="link-manage-caregivers">
              Manage <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <CardDescription>Share your records with family and caregivers</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="caregivers" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="caregivers" className="flex-1" data-testid="tab-caregivers">
              <Users className="h-4 w-4 mr-2" />
              Caregivers ({activeCaregivers.length})
            </TabsTrigger>
            <TabsTrigger value="shares" className="flex-1" data-testid="tab-shares">
              <FileText className="h-4 w-4 mr-2" />
              Shared Records ({activeShares.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="caregivers">
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {activeCaregivers.length > 0 ? (
                  activeCaregivers.map((caregiver) => (
                    <div key={caregiver.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border" data-testid={`caregiver-${caregiver.id}`}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{caregiver.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{caregiver.name}</p>
                          <p className="text-xs text-muted-foreground">{caregiver.relationship}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">{caregiver.permissions.length} permissions</Badge>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Users className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No caregivers added yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full mt-3" data-testid="button-invite-caregiver">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Caregiver
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a Caregiver</DialogTitle>
                  <DialogDescription>Give a family member or caregiver access to view and manage your health information.</DialogDescription>
                </DialogHeader>
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit((data) => inviteCaregiverMutation.mutate(data))} className="space-y-4">
                    <FormField control={inviteForm.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} data-testid="input-caregiver-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={inviteForm.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="caregiver@example.com" type="email" {...field} data-testid="input-caregiver-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={inviteForm.control} name="relationship" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-relationship">
                              <SelectValue placeholder="Select relationship" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="spouse">Spouse/Partner</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="child">Adult Child</SelectItem>
                            <SelectItem value="sibling">Sibling</SelectItem>
                            <SelectItem value="friend">Close Friend</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="submit" disabled={inviteCaregiverMutation.isPending} data-testid="button-send-invite">
                        {inviteCaregiverMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="shares">
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {activeShares.length > 0 ? (
                  activeShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border" data-testid={`share-${share.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10">
                          <FileText className="h-4 w-4 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{share.recipientName}</p>
                          <p className="text-xs text-muted-foreground">{share.sharedCategories.length} categories shared</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => revokeAccessMutation.mutate(share.id)} data-testid={`button-revoke-${share.id}`}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Lock className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No records shared yet</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full mt-3" data-testid="button-share-records">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Records
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Share Health Records</DialogTitle>
                  <DialogDescription>Securely share your health records with a provider, family member, or anyone you trust.</DialogDescription>
                </DialogHeader>
                <Form {...shareForm}>
                  <form onSubmit={shareForm.handleSubmit((data) => shareRecordMutation.mutate(data))} className="space-y-4">
                    <FormField control={shareForm.control} name="recipientName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Dr. Jane Smith" {...field} data-testid="input-recipient-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={shareForm.control} name="recipientEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Recipient Email</FormLabel>
                        <FormControl>
                          <Input placeholder="doctor@hospital.com" type="email" {...field} data-testid="input-recipient-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={shareForm.control} name="accessLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Level</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-access-level">
                              <SelectValue placeholder="Select access level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="view">View Only</SelectItem>
                            <SelectItem value="download">View & Download</SelectItem>
                            <SelectItem value="full">Full Access</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={shareForm.control} name="expiresInDays" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expires After</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-expiry">
                              <SelectValue placeholder="Select expiry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="7">7 days</SelectItem>
                            <SelectItem value="30">30 days</SelectItem>
                            <SelectItem value="90">90 days</SelectItem>
                            <SelectItem value="never">Never</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="submit" disabled={shareRecordMutation.isPending} data-testid="button-send-share">
                        {shareRecordMutation.isPending ? "Sharing..." : "Share Records"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface PreventiveCareData {
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  recommendations: any[];
  careGaps: any[];
  vaccinationHistory: any[];
  lastScreenings: any[];
  riskFactors: string[];
  aiSummary?: string;
  overallComplianceScore: number;
  nextActions: any[];
}

interface VaccinationData {
  history: any[];
  gaps: {
    vaccineName: string;
    status: "overdue" | "due_soon" | "up_to_date";
    lastDose?: string;
    nextDueDate?: string;
    recommendation: string;
  }[];
  recommendations: any[];
}

interface ProgressData {
  screeningsCompleted: number;
  screeningsTotal: number;
  vaccinationsUpToDate: number;
  vaccinationsTotal: number;
  overallProgress: number;
  streak: number;
}

interface AppointmentSlot {
  id: string;
  date: string;
  time: string;
  provider: string;
  specialty: string;
  available: boolean;
}

function PreventiveCareSection() {
  const { toast } = useToast();
  const [selectedGapId, setSelectedGapId] = useState<string | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery<PreventiveCareData>({
    queryKey: ["/api/preventive-care/summary"],
  });

  const { data: vaccinations, isLoading: vaccinationsLoading } = useQuery<VaccinationData>({
    queryKey: ["/api/preventive-care/vaccinations"],
  });

  const { data: progress } = useQuery<ProgressData>({
    queryKey: ["/api/preventive-care/progress"],
  });

  const { data: slots } = useQuery<AppointmentSlot[]>({
    queryKey: ["/api/preventive-care/appointment-slots"],
  });

  const scheduleMutation = useMutation({
    mutationFn: async (data: { slotId: string; careGapId?: string; notes?: string }) => {
      return await apiRequest("POST", "/api/preventive-care/schedule", data);
    },
    onSuccess: () => {
      toast({ title: "Appointment Scheduled", description: "Your preventive care appointment has been confirmed." });
      setShowScheduleDialog(false);
      setSelectedGapId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/appointment-slots"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment. Please try again.", variant: "destructive" });
    },
  });

  const updateGapMutation = useMutation({
    mutationFn: async ({ gapId, status, notes }: { gapId: string; status: string; notes?: string }) => {
      return await apiRequest("PATCH", `/api/preventive-care/care-gaps/${gapId}`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/preventive-care/recommendations"] });
      toast({ title: "Updated", description: "Care gap status has been updated." });
    },
  });

  const isLoading = summaryLoading || vaccinationsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const openGaps = summary?.careGaps?.filter((g: any) => g.status === "open") || [];
  const overdueVaccines = vaccinations?.gaps?.filter((g) => g.status === "overdue") || [];
  const dueSoonVaccines = vaccinations?.gaps?.filter((g) => g.status === "due_soon") || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
      case "high": return "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400";
      case "medium": return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400";
    }
  };

  const getVaccineStatusColor = (status: string) => {
    switch (status) {
      case "overdue": return "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
      case "due_soon": return "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400";
      default: return "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400";
    }
  };

  return (
    <div className="space-y-6" data-testid="section-preventive-care">
      <Card data-testid="card-progress-overview">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-violet-500" />
            Your Preventive Care Progress
          </CardTitle>
          <CardDescription>
            Track your screenings and vaccinations to stay healthy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">{progress?.overallProgress || 0}%</span>
            </div>
            <Progress value={progress?.overallProgress || 0} className="h-3" data-testid="progress-overall" />
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{progress?.screeningsCompleted || 0}</div>
                <div className="text-xs text-muted-foreground">Screenings Complete</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-orange-500">{openGaps.length}</div>
                <div className="text-xs text-muted-foreground">Screenings Due</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">{progress?.vaccinationsUpToDate || 0}</div>
                <div className="text-xs text-muted-foreground">Vaccines Up-to-Date</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-violet-500">{progress?.streak || 0}</div>
                <div className="text-xs text-muted-foreground">Month Streak</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary?.aiSummary && (
        <Card className="border-violet-200 dark:border-violet-800" data-testid="card-ai-summary">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h4 className="font-medium text-violet-700 dark:text-violet-300 mb-1">AI Health Summary</h4>
                <p className="text-sm text-muted-foreground">{summary.aiSummary}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-screenings">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Stethoscope className="h-5 w-5 text-blue-500" />
              Recommended Screenings
            </CardTitle>
            <CardDescription>
              Based on your age, gender, and health history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              {openGaps.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                  <p className="font-medium">You're all caught up!</p>
                  <p className="text-sm text-muted-foreground">No screenings are currently due.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {openGaps.map((gap: any) => (
                    <div
                      key={gap.id}
                      className="p-4 rounded-lg border bg-card hover-elevate"
                      data-testid={`care-gap-${gap.id}`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{gap.recommendation.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {gap.recommendation.description}
                          </p>
                        </div>
                        <Badge className={`text-xs shrink-0 ${getPriorityColor(gap.priority)}`}>
                          {gap.priority}
                        </Badge>
                      </div>
                      
                      {gap.dueDate && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {format(new Date(gap.dueDate), "MMM d, yyyy")}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedGapId(gap.id);
                            setShowScheduleDialog(true);
                          }}
                          data-testid={`button-schedule-${gap.id}`}
                        >
                          <CalendarCheck className="h-3 w-3 mr-1" />
                          Schedule
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateGapMutation.mutate({ gapId: gap.id, status: "declined", notes: "Patient declined" })}
                          data-testid={`button-decline-${gap.id}`}
                        >
                          Not Now
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Info className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{gap.recommendation.title}</DialogTitle>
                              <DialogDescription className="space-y-4 pt-4">
                                <div>
                                  <h5 className="font-medium text-foreground mb-1">Why This Matters</h5>
                                  <p className="text-sm">{gap.recommendation.evidenceSummary}</p>
                                </div>
                                <div>
                                  <h5 className="font-medium text-foreground mb-1">What to Expect</h5>
                                  <p className="text-sm">{gap.recommendation.patientEducation}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">USPSTF Grade: {gap.recommendation.grade}</Badge>
                                  <Badge variant="outline">{gap.recommendation.frequency}</Badge>
                                </div>
                              </DialogDescription>
                            </DialogHeader>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-vaccinations">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Syringe className="h-5 w-5 text-green-500" />
              Vaccinations
            </CardTitle>
            <CardDescription>
              Keep your immunizations up to date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-4">
                {overdueVaccines.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Overdue
                    </h4>
                    <div className="space-y-2">
                      {overdueVaccines.map((vax, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20"
                          data-testid={`vaccine-overdue-${i}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{vax.vaccineName}</p>
                              <p className="text-xs text-muted-foreground">{vax.recommendation}</p>
                            </div>
                            <Button size="sm" onClick={() => setShowScheduleDialog(true)}>
                              Schedule
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dueSoonVaccines.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      Due Soon
                    </h4>
                    <div className="space-y-2">
                      {dueSoonVaccines.map((vax, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20"
                          data-testid={`vaccine-due-soon-${i}`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{vax.vaccineName}</p>
                              <p className="text-xs text-muted-foreground">
                                {vax.nextDueDate && `Due: ${format(new Date(vax.nextDueDate), "MMM d, yyyy")}`}
                              </p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => setShowScheduleDialog(true)}>
                              Schedule
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Recent Vaccinations
                  </h4>
                  <div className="space-y-2">
                    {(vaccinations?.history || []).slice(0, 5).map((vax: any, i: number) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-muted/50"
                        data-testid={`vaccine-history-${i}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{vax.vaccineName}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(vax.administrationDate), "MMM d, yyyy")}
                              {vax.facility && ` - ${vax.facility}`}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-green-600 border-green-300 dark:border-green-700">
                            <Check className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {summary?.lastScreenings && summary.lastScreenings.length > 0 && (
        <Card data-testid="card-recent-screenings">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-teal-500" />
              Recent Screening Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {summary.lastScreenings.map((screening: any, i: number) => (
                <div key={i} className="p-4 rounded-lg bg-muted/50" data-testid={`screening-result-${i}`}>
                  <div className="text-sm font-medium">{screening.screeningType}</div>
                  <div className="text-lg font-semibold mt-1">{screening.result}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {format(new Date(screening.date), "MMM d, yyyy")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Preventive Care Appointment</DialogTitle>
            <DialogDescription>
              Choose an available time slot for your appointment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {(slots || []).map((slot) => (
                  <div
                    key={slot.id}
                    className="p-4 rounded-lg border hover-elevate cursor-pointer"
                    {...clickable(() => scheduleMutation.mutate({ slotId: slot.id, careGapId: selectedGapId || undefined }))}
                    data-testid={`slot-${slot.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {format(new Date(slot.date), "EEEE, MMMM d")} at {slot.time}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {slot.provider} - {slot.specialty}
                        </div>
                      </div>
                      <Button size="sm" disabled={scheduleMutation.isPending}>
                        {scheduleMutation.isPending ? "Booking..." : "Book"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickActionsCard() {
  return (
    <Card data-testid="card-quick-actions">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/messages">
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2 hover-elevate" data-testid="action-message-provider">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              <span className="text-xs">Message Provider</span>
            </Button>
          </Link>
          <Link href="/telehealth">
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2 hover-elevate" data-testid="action-telehealth">
              <Video className="h-5 w-5 text-blue-500" />
              <span className="text-xs">Video Visit</span>
            </Button>
          </Link>
          <Link href="/health-records">
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2 hover-elevate" data-testid="action-view-records">
              <FileText className="h-5 w-5 text-green-500" />
              <span className="text-xs">View Records</span>
            </Button>
          </Link>
          <Link href="/patient-portal">
            <Button variant="outline" className="w-full h-auto flex-col py-4 gap-2 hover-elevate" data-testid="action-preventive-care" onClick={() => {}}>
              <Shield className="h-5 w-5 text-violet-500" />
              <span className="text-xs">Preventive Care</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PatientPortal() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const userId = user?.id;

  return (
    <div className="p-6 space-y-6" data-testid="page-patient-portal">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Health Center</h1>
          <p className="text-lg text-muted-foreground">Everything you need in one place - view results, schedule visits, and manage your care</p>
        </div>
        <div className="flex items-center gap-2">
          <QuickShareModal />
          <Link href="/accessibility">
            <Button variant="outline" data-testid="button-accessibility-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">Health Goals</TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
          <TabsTrigger value="education" data-testid="tab-education">Learning</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Health Insights</TabsTrigger>
          <TabsTrigger value="story" data-testid="tab-story">Health Story</TabsTrigger>
          <TabsTrigger value="unified" data-testid="tab-unified">Unified Records</TabsTrigger>
          <TabsTrigger value="ehr" data-testid="tab-ehr">Connected EHRs</TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Lab Results</TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">Appointments</TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
          <TabsTrigger value="preventive" data-testid="tab-preventive">Preventive Care</TabsTrigger>
          <TabsTrigger value="records" data-testid="tab-records">Records</TabsTrigger>
          <TabsTrigger value="dental" data-testid="tab-dental">Dental</TabsTrigger>
          <TabsTrigger value="telehealth" data-testid="tab-telehealth">Video Visit Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SmartSearchBar />
          <DeltaView />
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <MessagesSection />
                <LabResultsSection />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <AppointmentsSection />
                <PrescriptionsSection />
              </div>
            </div>
            <div className="space-y-6">
              <QuickActionsCard />
              <Card data-testid="card-upcoming">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-pink-500" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex flex-col items-center justify-center rounded-md bg-blue-500/10 px-2 py-1 min-w-[40px]">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Jan</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">22</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Annual Physical</p>
                    <p className="text-xs text-muted-foreground">Dr. Chen - 9:30 AM</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex flex-col items-center justify-center rounded-md bg-orange-500/10 px-2 py-1 min-w-[40px]">
                    <span className="text-xs font-medium text-orange-500">Jan</span>
                    <span className="text-lg font-bold text-orange-500">25</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Lab Work</p>
                    <p className="text-xs text-muted-foreground">Quest Diagnostics</p>
                  </div>
                </div>
              </div>
              <Link href="/timeline">
                <Button variant="ghost" className="w-full mt-3" size="sm" data-testid="link-view-calendar">
                  View Full Calendar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
          <Card data-testid="card-alerts">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-yellow-500" />
                Health Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-yellow-500/10">
                  <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Flu vaccine due</p>
                    <p className="text-xs text-muted-foreground">Recommended for this season</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Lab results ready</p>
                    <p className="text-xs text-muted-foreground">Review your recent results</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
              <ClinicalSnapshotCard />
              <RecordQualityCard />
              <DocumentAutoTaggingCard />
              <ImagingTranslatorCard />
              <HealthInboxCard />
              <CarePlanCard />
              <CaregiverModeCard />
              <PrivacyCenterCard />
              <MedicationManagementCard />
              <SymptomTrackerCard />
              <HealthCoachCard />
              <HealthVisualizationCard />
              <AppointmentAssistantCard />
              <HealthJournalCard />
              <CaregiverSupportCard />
              <ClinicianSummaryCard />
              <ProactiveAlertsCard />
              <PersonalizedHealthInsightsCard />
              <QuickStartGuide />
              <PatientDashboardCard />
              <RecordObservationsCard />
              <DocumentSummaryCard />
              <ELI12Card />
              <TimelineStoryCard />
              <WhatChangedCard />
              <SmartSearchCard />
              <SnapshotExportCard />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="space-y-6">
          {userId ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <HealthGoalsCard userId={userId} />
              <EnhancedInsightsCard userId={userId} />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Please sign in to view and manage your health goals.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vitals" className="space-y-6">
          {userId ? (
            <Tabs defaultValue="monitor" className="space-y-4">
              <TabsList data-testid="vitals-sub-tabs">
                <TabsTrigger value="monitor" data-testid="tab-vitals-monitor">Monitor</TabsTrigger>
                <TabsTrigger value="adult-trends" data-testid="tab-adult-trends">Adult Trends</TabsTrigger>
                <TabsTrigger value="pediatric-growth" data-testid="tab-pediatric-growth">Pediatric Growth</TabsTrigger>
              </TabsList>
              <TabsContent value="monitor" className="space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  <VitalsMonitoringCard userId={userId} />
                  <EnhancedInsightsCard userId={userId} />
                </div>
              </TabsContent>
              <TabsContent value="adult-trends" className="space-y-6">
                <AdultVitalsTrends patientId="patient-001" />
              </TabsContent>
              <TabsContent value="pediatric-growth" className="space-y-6">
                <PediatricGrowthCharts patientId="patient-001" />
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Please sign in to track your vital signs.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="education" className="space-y-6">
          <ConditionEducationCard patientId="patient-001" />
          {userId ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <PersonalizedEducationCard userId={userId} />
              <EnhancedInsightsCard userId={userId} />
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Please sign in to access personalized health education.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <HealthInsights />
        </TabsContent>

        <TabsContent value="story" className="space-y-6">
          <TimelineStoryMode />
        </TabsContent>

        <TabsContent value="unified" className="space-y-6">
          {userId ? (
            <ConsolidatedHealthRecordsCard userId={userId} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Please sign in to view your consolidated health records.</p>
              </CardContent>
            </Card>
          )}
          <SourceConfidenceView />
        </TabsContent>

        <TabsContent value="ehr" className="space-y-6">
          {userId ? (
            <EHRConnectionsCard userId={userId} />
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Please sign in to connect your health records.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          <ConsolidatedLabResultsCard patientId="patient-001" />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <AppointmentsSection />
            <PreVisitChecklistSection appointmentId="apt-1" />
          </div>
        </TabsContent>

        <TabsContent value="medications" className="space-y-6">
          <MedicationManagementCard />
          <div className="grid lg:grid-cols-2 gap-6">
            <PrescriptionsSection />
            <MedicationAdherenceSection />
          </div>
        </TabsContent>

        <TabsContent value="preventive" className="space-y-6">
          <PreventiveCareSection />
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <HealthRecordsSummaryCard patientId="patient-001" />
          <SharingSection />
        </TabsContent>

        <TabsContent value="dental" className="space-y-6">
          <DentalRecordsCard patientId="patient-001" />
        </TabsContent>

        <TabsContent value="telehealth" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <MediaTestingSection />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Video className="h-5 w-5 text-blue-500" />
                  Tips for a Good Video Visit
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium shrink-0">1</div>
                    <div>
                      <p className="text-sm font-medium">Find a quiet, well-lit space</p>
                      <p className="text-xs text-muted-foreground">Make sure your face is visible and background noise is minimal</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium shrink-0">2</div>
                    <div>
                      <p className="text-sm font-medium">Have your medications ready</p>
                      <p className="text-xs text-muted-foreground">Keep your pill bottles nearby in case you need to show them</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium shrink-0">3</div>
                    <div>
                      <p className="text-sm font-medium">Write down your questions</p>
                      <p className="text-xs text-muted-foreground">Prepare a list of topics you want to discuss with your doctor</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-medium shrink-0">4</div>
                    <div>
                      <p className="text-sm font-medium">Join 5 minutes early</p>
                      <p className="text-xs text-muted-foreground">This gives you time to fix any technical issues</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
