import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  CreditCard,
  DollarSign,
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Calendar,
  Heart,
  FileText,
  User,
  Shield,
  Settings,
  Activity,
  TrendingUp,
  BookOpen,
  Brain,
  Sparkles,
  AlertTriangle,
  Info,
  Phone,
  Mail,
  MapPin,
  Building,
  Stethoscope,
  Pill,
  FlaskConical,
  Syringe,
  Download,
  Edit,
  Plus,
  Eye,
  Users,
  Table,
  Lock,
  FileDown,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { clickable } from "@/lib/a11y";

const SAMPLE_PATIENT_ID = "patient-default";

const personalInfoSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(10, "Valid phone number required"),
  street: z.string().min(1, "Street address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zipCode: z.string().min(5, "Valid ZIP code required"),
  emergencyName: z.string().min(1, "Emergency contact name required"),
  emergencyRelationship: z.string().min(1, "Relationship required"),
  emergencyPhone: z.string().min(10, "Valid phone number required"),
});

const messageSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(10, "Message must be at least 10 characters"),
  providerId: z.string().min(1, "Please select a provider"),
});

function HealthSummarySection() {
  const { data, isLoading } = useQuery<{ success: boolean; summary: any }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "health-summary"],
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>;
  }

  const summary = data?.summary;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card data-testid="card-conditions">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Heart className="h-5 w-5 text-red-500" />
            Active Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary?.conditions?.map((condition: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{condition.name}</p>
                  <p className="text-sm text-muted-foreground">Since {format(new Date(condition.since), "MMM yyyy")}</p>
                </div>
                <Badge variant={condition.status === "Controlled" ? "default" : "secondary"}>
                  {condition.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-medications">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-blue-500" />
            Current Medications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary?.medications?.map((med: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg border">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{med.name}</p>
                  <Badge variant="outline">{med.dosage}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{med.frequency} - {med.purpose}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-vitals">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-green-500" />
            Recent Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {summary?.vitals && Object.entries(summary.vitals).map(([key, vital]: [string, any]) => (
              <div key={key} className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <p className="text-lg font-bold">{vital.value}</p>
                <Badge variant={vital.status === "normal" ? "default" : "secondary"} className="text-xs mt-1">
                  {vital.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-labs">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-purple-500" />
            Recent Labs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {summary?.recentLabs?.map((lab: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium">{lab.test}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(lab.date), "MMM d, yyyy")}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">{lab.value}</p>
                  <Badge variant={lab.status === "normal" ? "default" : "secondary"} className="text-xs">
                    {lab.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-allergies" className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Allergies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {summary?.allergies?.map((allergy: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <div>
                  <span className="font-medium text-red-700 dark:text-red-400">{allergy.substance}</span>
                  <span className="text-sm text-muted-foreground ml-2">({allergy.reaction})</span>
                </div>
                <Badge variant={allergy.severity === "Severe" ? "destructive" : "secondary"} className="ml-2">
                  {allergy.severity}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AIInsightsSection() {
  const { data, isLoading } = useQuery<{ success: boolean; insights: any }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "ai-insights"],
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const insights = data?.insights;

  return (
    <div className="space-y-6">
      <Card className="border-yellow-500/20 bg-yellow-500/5" data-testid="card-ai-disclaimer">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">Educational Information Only</p>
              <p className="text-sm text-muted-foreground">{insights?.disclaimer}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {insights?.educationalInsights?.map((insight: any) => (
          <Card key={insight.id} className="hover-elevate" data-testid={`card-insight-${insight.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                </div>
                <Badge variant="outline">{insight.category}</Badge>
              </div>
              <CardTitle className="text-base mt-2">{insight.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{insight.content}</p>
              <p className="text-xs text-muted-foreground mt-3 italic">{insight.relevance}</p>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm" className="w-full" data-testid={`button-learn-more-${insight.id}`}>
                <BookOpen className="h-4 w-4 mr-2" />
                Learn More
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Card data-testid="card-health-trends">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Health Trends
          </CardTitle>
          <CardDescription>AI-analyzed patterns in your health data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights?.healthTrends?.map((trend: any, idx: number) => (
              <div key={idx} className="flex items-start gap-4 p-4 rounded-lg border">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  trend.trend === "improving" ? "bg-green-500/10" :
                  trend.trend === "stable" ? "bg-blue-500/10" : "bg-yellow-500/10"
                }`}>
                  {trend.trend === "improving" ? (
                    <TrendingUp className="h-5 w-5 text-green-500" />
                  ) : trend.trend === "stable" ? (
                    <Activity className="h-5 w-5 text-blue-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{trend.metric}</p>
                    <Badge variant={trend.trend === "improving" ? "default" : "secondary"}>
                      {trend.trend}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{trend.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-500/20" data-testid="card-suggested-topics">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-blue-500" />
            Suggested Learning Topics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {insights?.suggestedTopics?.map((topic: any, idx: number) => (
              <Button key={idx} variant="outline" data-testid={`button-topic-${idx}`}>
                <BookOpen className="h-4 w-4 mr-2" />
                {topic.topic}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AppointmentsSection() {
  const { data, isLoading } = useQuery<{ success: boolean; summary: any }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "health-summary"],
  });

  const appointments = data?.summary?.upcomingAppointments || [];
  const careTeam = data?.summary?.careTeam || [];

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card data-testid="card-upcoming-appointments">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5 text-blue-500" />
            Upcoming Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments.map((apt: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 p-4 rounded-lg border">
                <div className="flex flex-col items-center justify-center rounded-lg bg-blue-500/10 px-3 py-2 min-w-[60px]">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    {format(new Date(apt.date), "MMM")}
                  </span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {format(new Date(apt.date), "d")}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">{apt.type}</p>
                  <p className="text-sm text-muted-foreground">{apt.provider}</p>
                  <p className="text-sm text-muted-foreground">{format(new Date(apt.date), "h:mm a")}</p>
                </div>
                <Button variant="outline" size="sm" data-testid={`button-apt-details-${idx}`}>
                  Details
                </Button>
              </div>
            ))}
            {appointments.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No upcoming appointments</p>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button className="w-full" data-testid="button-schedule-appointment">
            <Plus className="h-4 w-4 mr-2" />
            Schedule New Appointment
          </Button>
        </CardFooter>
      </Card>

      <Card data-testid="card-care-team">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-purple-500" />
            Your Care Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {careTeam.map((member: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4 p-3 rounded-lg border">
                <Avatar>
                  <AvatarFallback>{member.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{member.name}</p>
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                <Button variant="ghost" size="icon" data-testid={`button-message-${idx}`}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingSection() {
  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  
  const { data, isLoading } = useQuery<{ success: boolean; invoices: any[]; summary: any }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "invoices"],
  });

  const payMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      return apiRequest("POST", `/api/patient-portal/${SAMPLE_PATIENT_ID}/invoices/${invoiceId}/pay`, {});
    },
    onSuccess: () => {
      toast({ title: "Payment Successful", description: "Your payment has been processed." });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "invoices"] });
      setSelectedInvoice(null);
    },
    onError: () => {
      toast({ title: "Payment Failed", description: "Please try again or contact support.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>;
  }

  const { invoices, summary } = data || { invoices: [], summary: {} };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <Card data-testid="card-total-outstanding">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold">${summary.totalOutstanding?.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-paid">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Paid This Year</p>
                <p className="text-2xl font-bold">${summary.totalPaid?.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{summary.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-overdue-count">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{summary.overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-invoices-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-blue-500" />
            Billing History
          </CardTitle>
          <CardDescription>View and pay your medical bills</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {invoices.map((invoice: any) => (
                <div key={invoice.id} className="flex items-center gap-4 p-4 rounded-lg border hover-elevate" data-testid={`invoice-${invoice.id}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{invoice.description}</p>
                      <Badge variant={
                        invoice.status === "paid" ? "default" :
                        invoice.status === "overdue" ? "destructive" :
                        invoice.status === "pending" ? "secondary" : "outline"
                      }>
                        {invoice.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{invoice.provider}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Service: {format(new Date(invoice.serviceDate), "MMM d, yyyy")} | 
                      Due: {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">${invoice.patientResponsibility.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">of ${invoice.amount.toFixed(2)} total</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedInvoice(invoice)} data-testid={`button-view-invoice-${invoice.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Invoice {invoice.invoiceNumber}</DialogTitle>
                          <DialogDescription>{invoice.description}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-muted-foreground">Provider:</span> {invoice.provider}</div>
                            <div><span className="text-muted-foreground">Service Date:</span> {format(new Date(invoice.serviceDate), "MMM d, yyyy")}</div>
                            <div><span className="text-muted-foreground">Due Date:</span> {format(new Date(invoice.dueDate), "MMM d, yyyy")}</div>
                            <div><span className="text-muted-foreground">Status:</span> <Badge variant={invoice.status === "paid" ? "default" : "secondary"}>{invoice.status}</Badge></div>
                          </div>
                          <Separator />
                          <div>
                            <p className="font-medium mb-3">Services</p>
                            <div className="space-y-2">
                              {invoice.services.map((service: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                                  <div>
                                    <span className="font-mono text-xs text-muted-foreground">{service.code}</span>
                                    <span className="ml-2">{service.description}</span>
                                  </div>
                                  <span>${service.total.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <Separator />
                          <div className="flex justify-between text-sm">
                            <span>Total Charges</span>
                            <span className="font-medium">${invoice.amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-green-600">
                            <span>Insurance Covered</span>
                            <span>-${invoice.insuranceCovered.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-lg font-bold">
                            <span>Your Responsibility</span>
                            <span>${invoice.patientResponsibility.toFixed(2)}</span>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" data-testid="button-download-invoice">
                            <Download className="h-4 w-4 mr-2" />
                            Download PDF
                          </Button>
                          {invoice.status !== "paid" && (
                            <Button onClick={() => payMutation.mutate(invoice.id)} disabled={payMutation.isPending} data-testid="button-pay-invoice">
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay ${invoice.patientResponsibility.toFixed(2)}
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    {invoice.status !== "paid" && (
                      <Button size="sm" onClick={() => payMutation.mutate(invoice.id)} disabled={payMutation.isPending} data-testid={`button-pay-${invoice.id}`}>
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function MessagingSection() {
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const { data: threadsData, isLoading: threadsLoading } = useQuery<{ threads: any[] }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "message-threads"],
  });

  const { data: messagesData, isLoading: messagesLoading } = useQuery<{ messages: any[] }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "messages", selectedThread],
    enabled: !!selectedThread,
  });

  const { data: providersData } = useQuery<{ success: boolean; providers: any[] }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "providers"],
  });

  const form = useForm({
    resolver: zodResolver(messageSchema),
    defaultValues: { subject: "", body: "", providerId: "" },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", `/api/patient-portal/${SAMPLE_PATIENT_ID}/threads`, {
        recipientId: data.providerId,
        recipientName: providersData?.providers?.find((p: any) => p.id === data.providerId)?.name || "",
        recipientRole: providersData?.providers?.find((p: any) => p.id === data.providerId)?.specialty || "",
        subject: data.subject,
        content: data.body,
        isUrgent: false,
      });
    },
    onSuccess: () => {
      toast({ title: "Message Sent", description: "Your message has been sent to your provider." });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "message-threads"] });
      setShowNewMessage(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to Send", description: "Please try again.", variant: "destructive" });
    },
  });

  const threads = threadsData?.threads || [];
  const messages = messagesData?.messages || [];
  const providers = providersData?.providers || [];

  return (
    <div className="grid lg:grid-cols-3 gap-6 h-[600px]">
      <Card className="lg:col-span-1" data-testid="card-message-threads">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Messages
            </CardTitle>
            <Dialog open={showNewMessage} onOpenChange={setShowNewMessage}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-new-message">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Message</DialogTitle>
                  <DialogDescription>Send a secure message to your healthcare provider</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => sendMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="providerId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>To</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-provider">
                                <SelectValue placeholder="Select a provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {providers.map((provider: any) => (
                                <SelectItem key={provider.id} value={provider.id}>
                                  {provider.name} - {provider.specialty}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subject</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Message subject" data-testid="input-subject" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="body"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Type your message..." rows={5} data-testid="textarea-message" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={sendMutation.isPending} data-testid="button-send-message">
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {threadsLoading ? (
              <div className="p-4 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : (
              <div>
                {threads.map((thread: any) => (
                  <div
                    key={thread.id}
                    className={`p-4 border-b cursor-pointer hover-elevate ${selectedThread === thread.id ? "bg-muted" : ""}`}
                    {...clickable(() => setSelectedThread(thread.id))}
                    data-testid={`thread-${thread.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{thread.participants?.[0]?.charAt(0) || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${!thread.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                            {thread.subject}
                          </p>
                          {!thread.isRead && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{thread.latestMessage?.substring(0, 50)}...</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {thread.timestamp && formatDistanceToNow(new Date(thread.timestamp), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2" data-testid="card-message-detail">
        <CardContent className="p-6 h-full">
          {selectedThread ? (
            messagesLoading ? (
              <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
            ) : (
              <ScrollArea className="h-[520px]">
                <div className="space-y-4">
                  {messages.map((message: any) => (
                    <div key={message.id} className={`flex ${message.isFromPatient ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] p-4 rounded-lg ${message.isFromPatient ? "bg-blue-500 text-white" : "bg-muted"}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-sm">{message.senderName}</span>
                          <span className="text-xs opacity-70">{message.senderRole}</span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className="text-xs opacity-70 mt-2">
                          {message.timestamp && format(new Date(message.timestamp), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a conversation to view messages</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ExportDataSection() {
  const { toast } = useToast();
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const { data: formatsData, isLoading } = useQuery<{ success: boolean; formats: any[]; dataTypes: any[] }>({
    queryKey: ["/api/patient-export/formats"],
  });

  const toggleDataType = (dataTypeId: string) => {
    setSelectedDataTypes((prev) =>
      prev.includes(dataTypeId)
        ? prev.filter((id) => id !== dataTypeId)
        : [...prev, dataTypeId]
    );
  };

  const handleExport = async () => {
    if (!selectedFormat || selectedDataTypes.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select a format and at least one data type to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch("/api/patient-export/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: selectedFormat,
          dataTypes: selectedDataTypes,
          patientId: SAMPLE_PATIENT_ID,
        }),
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition");
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `health-export.${selectedFormat}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Your ${selectedFormat.toUpperCase()} file has been downloaded securely.`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error generating your export. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { formats = [], dataTypes = [] } = formatsData || {};

  return (
    <div className="space-y-6">
      <Card className="border-blue-500/20 bg-blue-500/5" data-testid="card-export-privacy">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">Secure Data Export</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your health data is protected. All exports are logged for security compliance and include audit information.
                Downloaded files contain sensitive health information - please store them securely.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-select-format">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-blue-500" />
              Select Export Format
            </CardTitle>
            <CardDescription>Choose how you want your data exported</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {formats.map((fmt: any) => (
              <div
                key={fmt.id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedFormat === fmt.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-border hover:border-blue-500/50"
                }`}
                {...clickable(() => setSelectedFormat(fmt.id))}
                data-testid={`format-${fmt.id}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    selectedFormat === fmt.id ? "bg-blue-500 text-white" : "bg-muted"
                  }`}>
                    {fmt.id === "pdf" ? <FileText className="h-5 w-5" /> : <Table className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium">{fmt.name}</p>
                    <p className="text-sm text-muted-foreground">{fmt.description}</p>
                  </div>
                  {selectedFormat === fmt.id && (
                    <CheckCircle className="h-5 w-5 text-blue-500 ml-auto" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="card-select-data">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-500" />
              Select Data to Export
            </CardTitle>
            <CardDescription>Choose which health data to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataTypes.map((dt: any) => (
              <div
                key={dt.id}
                className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedDataTypes.includes(dt.id)
                    ? "border-green-500 bg-green-500/10"
                    : "border-border hover:border-green-500/50"
                }`}
                {...clickable(() => toggleDataType(dt.id))}
                data-testid={`datatype-${dt.id}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{dt.name}</p>
                    <p className="text-sm text-muted-foreground">{dt.description}</p>
                  </div>
                  {selectedDataTypes.includes(dt.id) && (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-export-action">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Download className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Ready to Export</p>
                <p className="text-sm text-muted-foreground">
                  {selectedFormat && selectedDataTypes.length > 0
                    ? `${selectedFormat.toUpperCase()} with ${selectedDataTypes.length} data type${selectedDataTypes.length > 1 ? "s" : ""}`
                    : "Select format and data types above"}
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handleExport}
              disabled={!selectedFormat || selectedDataTypes.length === 0 || isExporting}
              data-testid="button-export"
            >
              {isExporting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Export
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-500/20 bg-yellow-500/5" data-testid="card-ai-disclaimer">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700 dark:text-yellow-400">About AI Insights Export</p>
              <p className="text-sm text-muted-foreground mt-1">
                AI insights included in exports are for educational purposes only and do NOT constitute medical advice.
                Always consult your healthcare provider for medical decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileSection() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  const { data: personalData, isLoading: personalLoading } = useQuery<{ success: boolean; personalInfo: any }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "personal-info"],
  });

  const { data: insuranceData, isLoading: insuranceLoading } = useQuery<{ success: boolean; insurance: any[] }>({
    queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "insurance"],
  });

  const form = useForm({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      street: "",
      city: "",
      state: "",
      zipCode: "",
      emergencyName: "",
      emergencyRelationship: "",
      emergencyPhone: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PUT", `/api/patient-portal/${SAMPLE_PATIENT_ID}/personal-info`, {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: { street: data.street, city: data.city, state: data.state, zipCode: data.zipCode, country: "United States" },
        emergencyContact: { name: data.emergencyName, relationship: data.emergencyRelationship, phone: data.emergencyPhone },
      });
    },
    onSuccess: () => {
      toast({ title: "Profile Updated", description: "Your information has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/patient-portal", SAMPLE_PATIENT_ID, "personal-info"] });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Update Failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const personalInfo = personalData?.personalInfo;
  const insurance = insuranceData?.insurance || [];

  if (personalLoading || insuranceLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <Card data-testid="card-personal-info">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-500" />
              Personal Information
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)} data-testid="button-edit-profile">
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? "Cancel" : "Edit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.firstName} data-testid="input-firstname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.lastName} data-testid="input-lastname" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" defaultValue={personalInfo?.email} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.phone} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Separator />
                <p className="font-medium">Address</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="street"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Street Address</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.address?.street} data-testid="input-street" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.address?.city} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>State</FormLabel>
                          <FormControl>
                            <Input {...field} defaultValue={personalInfo?.address?.state} data-testid="input-state" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ZIP</FormLabel>
                          <FormControl>
                            <Input {...field} defaultValue={personalInfo?.address?.zipCode} data-testid="input-zip" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <Separator />
                <p className="font-medium">Emergency Contact</p>
                <div className="grid md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="emergencyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.emergencyContact?.name} data-testid="input-emergency-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyRelationship"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Relationship</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.emergencyContact?.relationship} data-testid="input-emergency-relationship" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="emergencyPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <Input {...field} defaultValue={personalInfo?.emergencyContact?.phone} data-testid="input-emergency-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-profile">
                  Save Changes
                </Button>
              </form>
            </Form>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                    <p className="font-medium">{personalInfo?.firstName} {personalInfo?.lastName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{personalInfo?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{personalInfo?.phone}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium">{personalInfo?.address?.street}</p>
                    <p className="text-sm">{personalInfo?.address?.city}, {personalInfo?.address?.state} {personalInfo?.address?.zipCode}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{personalInfo?.emergencyContact?.name}</p>
                    <p className="text-sm">{personalInfo?.emergencyContact?.relationship} - {personalInfo?.emergencyContact?.phone}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-insurance">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-green-500" />
              Insurance Information
            </CardTitle>
            <Button variant="outline" size="sm" data-testid="button-add-insurance">
              <Plus className="h-4 w-4 mr-2" />
              Add Insurance
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insurance.map((ins: any) => (
              <div key={ins.id} className="p-4 rounded-lg border" data-testid={`insurance-${ins.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Building className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{ins.provider}</p>
                        <Badge variant={ins.type === "primary" ? "default" : "secondary"}>{ins.type}</Badge>
                        {ins.isVerified && <Badge variant="outline" className="text-green-600 border-green-600">Verified</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{ins.planName}</p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                        <div><span className="text-muted-foreground">Member ID:</span> {ins.memberId}</div>
                        <div><span className="text-muted-foreground">Group:</span> {ins.groupNumber}</div>
                        <div><span className="text-muted-foreground">Copay:</span> ${ins.copay}</div>
                        <div><span className="text-muted-foreground">Deductible:</span> ${ins.deductibleMet}/${ins.deductible}</div>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" data-testid={`button-edit-insurance-${ins.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Deductible Progress</span>
                    <span>{Math.round((ins.deductibleMet / ins.deductible) * 100)}%</span>
                  </div>
                  <Progress value={(ins.deductibleMet / ins.deductible) * 100} className="h-2" />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Out-of-Pocket Max</span>
                    <span>${ins.outOfPocketMet} of ${ins.outOfPocketMax}</span>
                  </div>
                  <Progress value={(ins.outOfPocketMet / ins.outOfPocketMax) * 100} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PatientHub() {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div className="p-6 space-y-6" data-testid="page-patient-hub">
      <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">My Health Portal</h1>
          <p className="text-lg text-muted-foreground">Your complete health dashboard - records, appointments, billing, and more</p>
        </div>
        <Button variant="outline" data-testid="button-settings">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="summary" data-testid="tab-summary">
            <Heart className="h-4 w-4 mr-2" />
            Health Summary
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Brain className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="h-4 w-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="billing" data-testid="tab-billing">
            <Receipt className="h-4 w-4 mr-2" />
            Billing
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">
            <User className="h-4 w-4 mr-2" />
            Profile & Insurance
          </TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-export">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <HealthSummarySection />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <AIInsightsSection />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <AppointmentsSection />
        </TabsContent>

        <TabsContent value="billing" className="space-y-6">
          <BillingSection />
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <MessagingSection />
        </TabsContent>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="export" className="space-y-6">
          <ExportDataSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
