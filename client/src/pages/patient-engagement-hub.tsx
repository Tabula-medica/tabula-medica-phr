import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarX,
  CheckCircle,
  Clock,
  ClipboardList,
  Edit,
  Heart,
  HeartPulse,
  Info,
  Loader2,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Scale,
  Stethoscope,
  Thermometer,
  TrendingDown,
  TrendingUp,
  User,
  Video,
  Minus
} from "lucide-react";
import { format, formatDistanceToNow, isPast, isFuture, addDays } from "date-fns";

const PATIENT_ID = "patient-001";

interface Appointment {
  id: string;
  patientId: string;
  providerName: string;
  providerSpecialty?: string;
  facilityName: string;
  facilityAddress?: string;
  type: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: string;
  telehealth: boolean;
  telehealthUrl?: string;
  confirmationCode?: string;
  preVisitInstructions?: string;
  notes?: string;
}

interface VitalSubmission {
  id: string;
  patientId: string;
  vitalType: string;
  value: number;
  unit: string;
  secondaryValue?: number;
  recordedAt: string;
  source: string;
  deviceName?: string;
  notes?: string;
  isAbnormal: boolean;
  abnormalReason?: string;
  reviewedByProvider: boolean;
}

interface HealthStatusUpdate {
  id: string;
  patientId: string;
  type: string;
  title: string;
  description: string;
  overallFeeling: number;
  submittedAt: string;
  reviewedByProvider: boolean;
  flaggedForAttention: boolean;
}

interface VitalTrend {
  vitalType: string;
  average: number;
  min: number;
  max: number;
  trend: string;
  dataPoints: number;
  unit: string;
}

const VITAL_TYPE_LABELS: Record<string, { label: string; icon: any; unit: string }> = {
  blood_pressure_systolic: { label: "Blood Pressure (Systolic)", icon: Heart, unit: "mmHg" },
  blood_pressure_diastolic: { label: "Blood Pressure (Diastolic)", icon: Heart, unit: "mmHg" },
  heart_rate: { label: "Heart Rate", icon: HeartPulse, unit: "bpm" },
  temperature: { label: "Temperature", icon: Thermometer, unit: "°F" },
  weight: { label: "Weight", icon: Scale, unit: "lbs" },
  oxygen_saturation: { label: "Oxygen Saturation", icon: Activity, unit: "%" },
  respiratory_rate: { label: "Respiratory Rate", icon: Activity, unit: "/min" },
  blood_glucose: { label: "Blood Glucose", icon: Activity, unit: "mg/dL" },
  pain_level: { label: "Pain Level", icon: Activity, unit: "/10" },
  peak_flow: { label: "Peak Flow", icon: Activity, unit: "L/min" }
};

export default function PatientEngagementHub() {
  const [activeTab, setActiveTab] = useState("appointments");
  const { toast } = useToast();
  
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [vitalDialogOpen, setVitalDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  const [newVitalType, setNewVitalType] = useState("");
  const [newVitalValue, setNewVitalValue] = useState("");
  const [newVitalNotes, setNewVitalNotes] = useState("");
  
  const [statusTitle, setStatusTitle] = useState("");
  const [statusDescription, setStatusDescription] = useState("");
  const [overallFeeling, setOverallFeeling] = useState([7]);
  const [statusType, setStatusType] = useState("wellness_check");

  const { data: upcomingAppointments, isLoading: loadingUpcoming } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/patient-engagement/appointments", PATIENT_ID, "upcoming=true"]
  });

  const { data: pastAppointments } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["/api/patient-engagement/appointments", PATIENT_ID, "past=true"]
  });

  const { data: vitalsData, isLoading: loadingVitals } = useQuery<{ vitals: VitalSubmission[] }>({
    queryKey: ["/api/patient-engagement/monitoring/vitals", PATIENT_ID]
  });

  const { data: statusUpdates } = useQuery<{ updates: HealthStatusUpdate[] }>({
    queryKey: ["/api/patient-engagement/monitoring/status-updates", PATIENT_ID]
  });

  const { data: trendsData } = useQuery<{ trends: VitalTrend[] }>({
    queryKey: ["/api/patient-engagement/monitoring/trends", PATIENT_ID]
  });

  const { data: dashboard } = useQuery<{ dashboard: any }>({
    queryKey: ["/api/patient-engagement/monitoring/dashboard", PATIENT_ID]
  });

  const submitVitalMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/patient-engagement/monitoring/vitals", data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement/monitoring/vitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement/monitoring/trends"] });
      setVitalDialogOpen(false);
      setNewVitalType("");
      setNewVitalValue("");
      setNewVitalNotes("");
      toast({
        title: "Vital signs recorded",
        description: data.warning ? `Warning: ${data.warning}` : "Your vital signs have been submitted for review."
      });
    }
  });

  const submitStatusMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/patient-engagement/monitoring/status-update", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement/monitoring/status-updates"] });
      setStatusDialogOpen(false);
      setStatusTitle("");
      setStatusDescription("");
      setOverallFeeling([7]);
      toast({ title: "Health status submitted", description: "Your care team will review your update." });
    }
  });

  const cancelAppointmentMutation = useMutation({
    mutationFn: async ({ appointmentId, reason }: { appointmentId: string; reason?: string }) => {
      const response = await apiRequest("POST", `/api/patient-engagement/appointments/${appointmentId}/cancel`, { reason });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement/appointments"] });
      toast({ title: "Appointment cancelled", description: "Your appointment has been cancelled." });
    }
  });

  const confirmAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const response = await apiRequest("POST", `/api/patient-engagement/appointments/${appointmentId}/confirm`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-engagement/appointments"] });
      toast({ title: "Appointment confirmed", description: "Your appointment has been confirmed." });
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "rescheduled": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable": return <Minus className="h-4 w-4 text-blue-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const handleSubmitVital = () => {
    if (!newVitalType || !newVitalValue) return;
    
    const vitalInfo = VITAL_TYPE_LABELS[newVitalType];
    submitVitalMutation.mutate({
      patientId: PATIENT_ID,
      vitalType: newVitalType,
      value: parseFloat(newVitalValue),
      unit: vitalInfo?.unit || "",
      recordedAt: new Date().toISOString(),
      source: "manual_entry",
      notes: newVitalNotes || undefined
    });
  };

  const handleSubmitStatus = () => {
    if (!statusTitle || !statusDescription) return;
    
    submitStatusMutation.mutate({
      patientId: PATIENT_ID,
      type: statusType,
      title: statusTitle,
      description: statusDescription,
      overallFeeling: overallFeeling[0]
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-patient-engagement-hub">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-patient-engagement">
            <HeartPulse className="h-8 w-8 text-primary" />
            Patient Engagement Hub
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage appointments, track your health, and stay connected with your care team
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {upcomingAppointments?.appointments?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">appointments scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Recent Vitals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {vitalsData?.vitals?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">readings this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {dashboard?.dashboard?.complianceScore || 85}%
            </div>
            <p className="text-xs text-muted-foreground">monitoring adherence</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Flagged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">
              {dashboard?.dashboard?.flaggedItems || 0}
            </div>
            <p className="text-xs text-muted-foreground">items need attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="vitals" data-testid="tab-vitals">
            <HeartPulse className="h-4 w-4 mr-2" />
            Vital Signs
          </TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-status">
            <ClipboardList className="h-4 w-4 mr-2" />
            Health Updates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold">Upcoming Appointments</h2>
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-schedule-appointment">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule New Appointment</DialogTitle>
                  <DialogDescription>
                    Contact your provider's office to schedule a new appointment.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <Alert>
                    <Phone className="h-4 w-4" />
                    <AlertDescription>
                      To schedule a new appointment, please call your provider's office or use their patient portal.
                      This feature will be available for online scheduling soon.
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setScheduleOpen(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {loadingUpcoming ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {upcomingAppointments?.appointments?.map((apt) => (
                <Card key={apt.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{apt.title}</CardTitle>
                        <CardDescription>{apt.providerName}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(apt.status)}>{apt.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(apt.scheduledAt), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(apt.scheduledAt), "h:mm a")} ({apt.duration} min)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {apt.telehealth ? (
                        <>
                          <Video className="h-4 w-4 text-blue-500" />
                          <span className="text-blue-600">Telehealth Visit</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{apt.facilityName}</span>
                        </>
                      )}
                    </div>
                    {apt.preVisitInstructions && (
                      <Alert className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription className="text-xs">{apt.preVisitInstructions}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter className="flex gap-2 flex-wrap">
                    {apt.status === "scheduled" && (
                      <Button 
                        size="sm" 
                        onClick={() => confirmAppointmentMutation.mutate(apt.id)}
                        disabled={confirmAppointmentMutation.isPending}
                        data-testid={`button-confirm-${apt.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Confirm
                      </Button>
                    )}
                    {apt.telehealth && apt.telehealthUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={apt.telehealthUrl} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-1" />
                          Join Visit
                        </a>
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedAppointment(apt);
                        setRescheduleOpen(true);
                      }}
                      data-testid={`button-reschedule-${apt.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Reschedule
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-red-600"
                      onClick={() => cancelAppointmentMutation.mutate({ appointmentId: apt.id })}
                      disabled={cancelAppointmentMutation.isPending}
                      data-testid={`button-cancel-${apt.id}`}
                    >
                      <CalendarX className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </CardFooter>
                </Card>
              ))}
              {(!upcomingAppointments?.appointments || upcomingAppointments.appointments.length === 0) && (
                <Card className="col-span-2">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarCheck className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No upcoming appointments</p>
                    <Button className="mt-4" onClick={() => setScheduleOpen(true)}>
                      Schedule an Appointment
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {pastAppointments?.appointments && pastAppointments.appointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Appointments</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {pastAppointments.appointments.slice(0, 5).map((apt) => (
                      <div key={apt.id} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="font-medium text-sm">{apt.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {apt.providerName} - {format(new Date(apt.scheduledAt), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge className={getStatusColor(apt.status)}>{apt.status}</Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="vitals" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold">Vital Signs Tracking</h2>
            <Dialog open={vitalDialogOpen} onOpenChange={setVitalDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-record-vital">
                  <Plus className="h-4 w-4 mr-2" />
                  Record Vital Signs
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Vital Signs</DialogTitle>
                  <DialogDescription>
                    Enter your vital signs reading. This will be sent to your care team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-vital-type">Vital Type</Label>
                    <Select value={newVitalType} onValueChange={setNewVitalType}>
                      <SelectTrigger id="patient-engagement-hub-vital-type" data-testid="select-vital-type">
                        <SelectValue placeholder="Select vital type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(VITAL_TYPE_LABELS).map(([key, info]) => (
                          <SelectItem key={key} value={key}>{info.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-value">Value {newVitalType && `(${VITAL_TYPE_LABELS[newVitalType]?.unit})`}</Label>
                    <Input id="patient-engagement-hub-value" 
                      type="number" 
                      value={newVitalValue}
                      onChange={(e) => setNewVitalValue(e.target.value)}
                      placeholder="Enter value..."
                      data-testid="input-vital-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-notes-optional">Notes (optional)</Label>
                    <Textarea id="patient-engagement-hub-notes-optional" 
                      value={newVitalNotes}
                      onChange={(e) => setNewVitalNotes(e.target.value)}
                      placeholder="Any additional notes..."
                      data-testid="input-vital-notes"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVitalDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleSubmitVital}
                    disabled={!newVitalType || !newVitalValue || submitVitalMutation.isPending}
                    data-testid="button-submit-vital"
                  >
                    {submitVitalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent Readings</CardTitle>
                <CardDescription>Your vital signs from the past week</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVitals ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <ScrollArea className="h-[350px]">
                    <div className="space-y-3">
                      {vitalsData?.vitals?.map((vital) => {
                        const info = VITAL_TYPE_LABELS[vital.vitalType];
                        const Icon = info?.icon || Activity;
                        return (
                          <div key={vital.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${vital.isAbnormal ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
                                <Icon className={`h-4 w-4 ${vital.isAbnormal ? "text-amber-600" : "text-muted-foreground"}`} />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{info?.label || vital.vitalType}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(vital.recordedAt), "MMM d, h:mm a")}
                                  {vital.deviceName && ` via ${vital.deviceName}`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${vital.isAbnormal ? "text-amber-600" : ""}`}>
                                {vital.value} {vital.unit}
                              </p>
                              {vital.isAbnormal && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Abnormal
                                </Badge>
                              )}
                              {vital.reviewedByProvider && (
                                <Badge variant="outline" className="text-green-600 border-green-300 ml-1">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Reviewed
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {(!vitalsData?.vitals || vitalsData.vitals.length === 0) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No vital signs recorded yet</p>
                          <Button className="mt-4" onClick={() => setVitalDialogOpen(true)}>
                            Record Your First Reading
                          </Button>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trends</CardTitle>
                <CardDescription>30-day vital sign trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trendsData?.trends?.map((trend) => {
                    const info = VITAL_TYPE_LABELS[trend.vitalType];
                    return (
                      <div key={trend.vitalType} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">{info?.label || trend.vitalType}</span>
                          {getTrendIcon(trend.trend)}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Avg</p>
                            <p className="font-medium">{trend.average} {trend.unit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Min</p>
                            <p className="font-medium">{trend.min}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Max</p>
                            <p className="font-medium">{trend.max}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">{trend.dataPoints} readings</p>
                      </div>
                    );
                  })}
                  {(!trendsData?.trends || trendsData.trends.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Record more readings to see trends
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="status" className="space-y-6 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold">Health Status Updates</h2>
            <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-update">
                  <Plus className="h-4 w-4 mr-2" />
                  New Update
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Submit Health Status Update</DialogTitle>
                  <DialogDescription>
                    Let your care team know how you're feeling today.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-update-type">Update Type</Label>
                    <Select value={statusType} onValueChange={setStatusType}>
                      <SelectTrigger id="patient-engagement-hub-update-type" data-testid="select-status-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wellness_check">Daily Wellness Check</SelectItem>
                        <SelectItem value="symptom_report">Symptom Report</SelectItem>
                        <SelectItem value="medication_adherence">Medication Check</SelectItem>
                        <SelectItem value="general_update">General Update</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-title">Title</Label>
                    <Input id="patient-engagement-hub-title" 
                      value={statusTitle}
                      onChange={(e) => setStatusTitle(e.target.value)}
                      placeholder="Brief title for your update..."
                      data-testid="input-status-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-how-are-you-feeling-overall-10">How are you feeling overall? ({overallFeeling[0]}/10)</Label>
                    <Slider id="patient-engagement-hub-how-are-you-feeling-overall-10"
                      value={overallFeeling}
                      onValueChange={setOverallFeeling}
                      max={10}
                      min={1}
                      step={1}
                      className="py-4"
                      data-testid="slider-feeling"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Very Poor</span>
                      <span>Excellent</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patient-engagement-hub-description">Description</Label>
                    <Textarea id="patient-engagement-hub-description" 
                      value={statusDescription}
                      onChange={(e) => setStatusDescription(e.target.value)}
                      placeholder="Describe how you're feeling, any symptoms, or other updates..."
                      className="min-h-[100px]"
                      data-testid="input-status-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleSubmitStatus}
                    disabled={!statusTitle || !statusDescription || submitStatusMutation.isPending}
                    data-testid="button-submit-status"
                  >
                    {submitStatusMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Submit Update
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Updates</CardTitle>
                <CardDescription>Your health status submissions</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {statusUpdates?.updates?.map((update) => (
                      <div key={update.id} className="p-4 border rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{update.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(update.submittedAt), "MMM d, yyyy h:mm a")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {update.flaggedForAttention && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Flagged
                              </Badge>
                            )}
                            {update.reviewedByProvider && (
                              <Badge variant="outline" className="text-green-600 border-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Reviewed
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">Feeling:</span>
                          <Progress value={update.overallFeeling * 10} className="h-2 flex-1" />
                          <span className="text-sm font-medium">{update.overallFeeling}/10</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{update.description}</p>
                        <Badge variant="outline" className="text-xs">{update.type.replace("_", " ")}</Badge>
                      </div>
                    ))}
                    {(!statusUpdates?.updates || statusUpdates.updates.length === 0) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No health updates submitted yet</p>
                        <Button className="mt-4" onClick={() => setStatusDialogOpen(true)}>
                          Submit Your First Update
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common health tracking tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    setStatusType("wellness_check");
                    setStatusDialogOpen(true);
                  }}
                  data-testid="button-quick-wellness"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Daily Wellness Check
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    setStatusType("symptom_report");
                    setStatusDialogOpen(true);
                  }}
                  data-testid="button-quick-symptom"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Symptoms
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => {
                    setStatusType("medication_adherence");
                    setStatusDialogOpen(true);
                  }}
                  data-testid="button-quick-medication"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Medication Check-in
                </Button>
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => setVitalDialogOpen(true)}
                  data-testid="button-quick-vitals"
                >
                  <HeartPulse className="h-4 w-4 mr-2" />
                  Record Vital Signs
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Contact your provider's office to reschedule this appointment.
            </DialogDescription>
          </DialogHeader>
          {selectedAppointment && (
            <div className="py-4">
              <div className="p-4 bg-muted rounded-lg mb-4">
                <p className="font-medium">{selectedAppointment.title}</p>
                <p className="text-sm text-muted-foreground">{selectedAppointment.providerName}</p>
                <p className="text-sm">Currently scheduled: {format(new Date(selectedAppointment.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}</p>
              </div>
              <Alert>
                <Phone className="h-4 w-4" />
                <AlertDescription>
                  Please call your provider's office to reschedule. Online rescheduling will be available soon.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
