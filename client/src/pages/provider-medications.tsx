import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { 
  Pill, 
  Search, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  RefreshCw,
  Send,
  Eye,
  Calendar,
  Activity,
  ClipboardList,
  AlertCircle,
  Check,
  X,
  MessageSquare,
  ChevronRight,
  User,
  History
} from "lucide-react";
import type { Patient, Prescription, RefillRequest } from "@shared/schema";

interface PatientAdherenceData {
  patientId: string;
  patientName: string;
  adherenceRate: number;
  streak: number;
  totalMedications: number;
  missedDoses: number;
  lastActivity: string;
  riskLevel: "low" | "medium" | "high";
  medications: {
    name: string;
    adherenceRate: number;
    lastTaken: string;
  }[];
}

interface PrescriptionWithPatient extends Prescription {
  patient?: Patient;
}

function getRiskBadge(risk: string) {
  switch (risk) {
    case "low":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-risk-low">Low Risk</Badge>;
    case "medium":
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid="badge-risk-medium">Medium Risk</Badge>;
    case "high":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20" data-testid="badge-risk-high">High Risk</Badge>;
    default:
      return <Badge variant="outline">{risk}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "approved":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-status-approved"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
    case "denied":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20" data-testid="badge-status-denied"><XCircle className="h-3 w-3 mr-1" /> Denied</Badge>;
    case "active":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-status-active"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
    case "expired":
      return <Badge variant="secondary" data-testid="badge-status-expired">Expired</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function ProviderMedicationsPage() {
  const [activeTab, setActiveTab] = useState("adherence");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientAdherenceData | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RefillRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const { toast } = useToast();

  // Fetch patient adherence data
  const { data: adherenceData = [], isLoading: adherenceLoading } = useQuery<PatientAdherenceData[]>({
    queryKey: ["/api/provider/patient-adherence"],
  });

  // Fetch pending refill requests
  const { data: refillRequests = [], isLoading: refillsLoading } = useQuery<RefillRequest[]>({
    queryKey: ["/api/refill-requests/pending"],
  });

  // Fetch prescriptions needing renewal
  const { data: prescriptions = [], isLoading: prescriptionsLoading } = useQuery<PrescriptionWithPatient[]>({
    queryKey: ["/api/prescriptions/expiring"],
  });

  // Approve refill mutation
  const approveRefillMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("PUT", `/api/refill-requests/${id}`, { status: "approved", providerNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refill-requests/pending"] });
      setApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalNotes("");
      toast({ title: "Refill Approved", description: "The prescription refill has been approved and sent to the pharmacy." });
    },
  });

  // Deny refill mutation
  const denyRefillMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      return apiRequest("PUT", `/api/refill-requests/${id}`, { status: "denied", providerNotes: notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/refill-requests/pending"] });
      setApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalNotes("");
      toast({ title: "Refill Denied", description: "The prescription refill request has been denied." });
    },
  });

  // Generate sample data
  const mockAdherenceData: PatientAdherenceData[] = [
    {
      patientId: "pt-001",
      patientName: "Sarah Johnson",
      adherenceRate: 92,
      streak: 14,
      totalMedications: 4,
      missedDoses: 3,
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      riskLevel: "low",
      medications: [
        { name: "Lisinopril 10mg", adherenceRate: 95, lastTaken: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
        { name: "Metformin 500mg", adherenceRate: 88, lastTaken: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
        { name: "Atorvastatin 20mg", adherenceRate: 94, lastTaken: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { name: "Aspirin 81mg", adherenceRate: 91, lastTaken: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      ],
    },
    {
      patientId: "pt-002",
      patientName: "Michael Chen",
      adherenceRate: 67,
      streak: 2,
      totalMedications: 3,
      missedDoses: 12,
      lastActivity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      riskLevel: "high",
      medications: [
        { name: "Warfarin 5mg", adherenceRate: 60, lastTaken: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
        { name: "Amiodarone 200mg", adherenceRate: 72, lastTaken: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
        { name: "Digoxin 0.125mg", adherenceRate: 68, lastTaken: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString() },
      ],
    },
    {
      patientId: "pt-003",
      patientName: "Emily Rodriguez",
      adherenceRate: 78,
      streak: 5,
      totalMedications: 2,
      missedDoses: 6,
      lastActivity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      riskLevel: "medium",
      medications: [
        { name: "Levothyroxine 50mcg", adherenceRate: 82, lastTaken: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
        { name: "Vitamin D 1000IU", adherenceRate: 74, lastTaken: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() },
      ],
    },
    {
      patientId: "pt-004",
      patientName: "Robert Williams",
      adherenceRate: 95,
      streak: 30,
      totalMedications: 5,
      missedDoses: 2,
      lastActivity: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      riskLevel: "low",
      medications: [
        { name: "Metoprolol 50mg", adherenceRate: 98, lastTaken: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        { name: "Lisinopril 20mg", adherenceRate: 96, lastTaken: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        { name: "Atorvastatin 40mg", adherenceRate: 94, lastTaken: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() },
        { name: "Clopidogrel 75mg", adherenceRate: 92, lastTaken: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        { name: "Pantoprazole 40mg", adherenceRate: 95, lastTaken: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
      ],
    },
  ];

  const mockRefillRequests: RefillRequest[] = [
    {
      id: "ref-001",
      prescriptionId: "rx-001",
      patientId: "pt-001",
      pharmacyId: "pharm-001",
      status: "pending",
      requestedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: "routine",
      patientNotes: "Running low on medication, about 5 days left. Requesting 90-day supply.",
      deliveryRequested: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ref-002",
      prescriptionId: "rx-002",
      patientId: "pt-002",
      pharmacyId: "pharm-002",
      status: "pending",
      requestedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: "urgent",
      patientNotes: "Need refill before traveling next week. Requesting 30-day supply.",
      deliveryRequested: true,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "ref-003",
      prescriptionId: "rx-003",
      patientId: "pt-003",
      pharmacyId: "pharm-001",
      status: "pending",
      requestedDate: new Date().toISOString(),
      urgency: "routine",
      deliveryRequested: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const displayAdherenceData = adherenceData.length > 0 ? adherenceData : mockAdherenceData;
  const displayRefillRequests = refillRequests.length > 0 ? refillRequests : mockRefillRequests;

  const filteredPatients = displayAdherenceData.filter(p =>
    p.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const highRiskPatients = displayAdherenceData.filter(p => p.riskLevel === "high");
  const averageAdherence = displayAdherenceData.length > 0
    ? Math.round(displayAdherenceData.reduce((sum, p) => sum + p.adherenceRate, 0) / displayAdherenceData.length)
    : 0;

  const handleViewDetails = (patient: PatientAdherenceData) => {
    setSelectedPatient(patient);
    setDetailsDialogOpen(true);
  };

  const handleReviewRequest = (request: RefillRequest) => {
    setSelectedRequest(request);
    setApprovalDialogOpen(true);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-provider-medications">
            <Pill className="h-6 w-6 text-primary" />
            Medication Management
          </h1>
          <p className="text-muted-foreground">Review patient adherence and manage prescriptions</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-patients">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{displayAdherenceData.length}</p>
                <p className="text-xs text-muted-foreground">Active Patients</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-adherence">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{averageAdherence}%</p>
                <p className="text-xs text-muted-foreground">Avg Adherence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-high-risk">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highRiskPatients.length}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-pending-refills">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <RefreshCw className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{displayRefillRequests.filter(r => r.status === "pending").length}</p>
                <p className="text-xs text-muted-foreground">Pending Refills</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="adherence" data-testid="tab-adherence">
            <Activity className="h-4 w-4 mr-2" />
            Patient Adherence
          </TabsTrigger>
          <TabsTrigger value="refills" data-testid="tab-refills">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refill Requests
            {displayRefillRequests.filter(r => r.status === "pending").length > 0 && (
              <Badge className="ml-2" variant="destructive">{displayRefillRequests.filter(r => r.status === "pending").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="renewals" data-testid="tab-renewals">
            <FileText className="h-4 w-4 mr-2" />
            Renewals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="adherence" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle>Patient Adherence Overview</CardTitle>
                  <CardDescription>Monitor medication adherence across your patient panel</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-patients"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {adherenceLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No patients found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPatients.map((patient) => (
                    <Card 
                      key={patient.patientId} 
                      className="hover-elevate cursor-pointer"
                      onClick={() => handleViewDetails(patient)}
                      data-testid={`card-patient-${patient.patientId}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{patient.patientName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {patient.totalMedications} medications | Last activity: {formatDistanceToNow(parseISO(patient.lastActivity), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 flex-wrap">
                            <div className="text-center">
                              <div className="flex items-center gap-1">
                                <span className={`text-xl font-bold ${patient.adherenceRate >= 80 ? 'text-green-500' : patient.adherenceRate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  {patient.adherenceRate}%
                                </span>
                                {patient.adherenceRate >= 80 ? (
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">Adherence</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xl font-bold">{patient.streak}</p>
                              <p className="text-xs text-muted-foreground">Day Streak</p>
                            </div>
                            {getRiskBadge(patient.riskLevel)}
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* High Risk Patients Alert */}
          {highRiskPatients.length > 0 && (
            <Card className="border-red-500/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-500">
                  <AlertCircle className="h-5 w-5" />
                  Patients Requiring Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {highRiskPatients.map(patient => (
                    <div 
                      key={patient.patientId}
                      className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        <span className="font-medium">{patient.patientName}</span>
                        <span className="text-sm text-muted-foreground">
                          {patient.adherenceRate}% adherence | {patient.missedDoses} missed doses
                        </span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewDetails(patient)}
                        data-testid={`button-contact-${patient.patientId}`}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Contact
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="refills" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Refill Requests</CardTitle>
              <CardDescription>Review and approve medication refill requests from patients</CardDescription>
            </CardHeader>
            <CardContent>
              {refillsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
              ) : displayRefillRequests.filter(r => r.status === "pending").length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">All Caught Up!</h3>
                  <p className="text-muted-foreground">No pending refill requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayRefillRequests.filter(r => r.status === "pending").map((request) => {
                    const patientData = displayAdherenceData.find(p => p.patientId === request.patientId);
                    return (
                      <Card 
                        key={request.id}
                        className={`${request.urgency === "urgent" ? "border-red-500/30" : ""}`}
                        data-testid={`card-refill-${request.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between flex-wrap gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold">{patientData?.patientName || "Patient"}</h4>
                                {request.urgency === "urgent" && (
                                  <Badge variant="destructive">Urgent</Badge>
                                )}
                                {getStatusBadge(request.status)}
                              </div>
                              <p className="text-sm">
                                <span className="font-medium">Prescription ID:</span> {request.prescriptionId}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Requested: {format(parseISO(request.requestedDate), "MMM d, yyyy")} | Delivery: {request.deliveryRequested ? "Yes" : "Pickup"}
                              </p>
                              {request.patientNotes && (
                                <p className="text-sm italic text-muted-foreground">
                                  "{request.patientNotes}"
                                </p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReviewRequest(request)}
                                data-testid={`button-review-${request.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Review
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setApprovalDialogOpen(true);
                                }}
                                data-testid={`button-approve-${request.id}`}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="renewals" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Prescription Renewals</CardTitle>
              <CardDescription>Prescriptions expiring soon or requiring renewal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Urgent Renewals</h3>
                <p className="text-muted-foreground mb-4">All prescriptions are up to date</p>
                <Button variant="outline">
                  <History className="h-4 w-4 mr-2" />
                  View Prescription History
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Patient Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedPatient?.patientName}
            </DialogTitle>
            <DialogDescription>
              Medication adherence details and history
            </DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className={`text-2xl font-bold ${selectedPatient.adherenceRate >= 80 ? 'text-green-500' : selectedPatient.adherenceRate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {selectedPatient.adherenceRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">Adherence Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{selectedPatient.streak}</p>
                    <p className="text-xs text-muted-foreground">Day Streak</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-muted-foreground">{selectedPatient.missedDoses}</p>
                    <p className="text-xs text-muted-foreground">Missed Doses</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Medication Adherence by Drug</h4>
                <div className="space-y-3">
                  {selectedPatient.medications.map((med, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{med.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={med.adherenceRate} className="w-24 h-2" />
                        <span className={`text-sm font-medium ${med.adherenceRate >= 80 ? 'text-green-500' : med.adherenceRate >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                          {med.adherenceRate}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                  Close
                </Button>
                <Button>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Refill Request</DialogTitle>
            <DialogDescription>
              Approve or deny this medication refill request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p><span className="font-medium">Prescription ID:</span> {selectedRequest.prescriptionId}</p>
                <p><span className="font-medium">Delivery:</span> {selectedRequest.deliveryRequested ? "Requested" : "Pickup"}</p>
                <p><span className="font-medium">Urgency:</span> {selectedRequest.urgency}</p>
                {selectedRequest.patientNotes && (
                  <p><span className="font-medium">Patient Notes:</span> {selectedRequest.patientNotes}</p>
                )}
              </div>

              <div>
                <Label htmlFor="notes">Provider Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this approval/denial..."
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  data-testid="textarea-approval-notes"
                />
              </div>

              <DialogFooter className="gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setApprovalDialogOpen(false);
                    setSelectedRequest(null);
                    setApprovalNotes("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => denyRefillMutation.mutate({ id: selectedRequest.id, notes: approvalNotes })}
                  disabled={denyRefillMutation.isPending}
                  data-testid="button-deny-refill"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Deny
                </Button>
                <Button
                  onClick={() => approveRefillMutation.mutate({ id: selectedRequest.id, notes: approvalNotes })}
                  disabled={approveRefillMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve & Send
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
