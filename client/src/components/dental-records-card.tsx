import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Calendar,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Scan,
  Stethoscope,
  ClipboardList,
  TrendingUp,
  Filter,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertDentalRecordSchema } from "@shared/schema";
import type { DentalRecord, DentalRecordType, ToothCondition, InsertDentalRecord } from "@shared/schema";
import { z } from "zod";

const typeLabels: Record<DentalRecordType, string> = {
  exam: "Examination",
  cleaning: "Cleaning",
  filling: "Filling",
  extraction: "Extraction",
  crown: "Crown",
  root_canal: "Root Canal",
  implant: "Implant",
  bridge: "Bridge",
  veneer: "Veneer",
  whitening: "Whitening",
  orthodontics: "Orthodontics",
  periodontal: "Periodontal",
  denture: "Denture",
  sealant: "Sealant",
  xray: "X-Ray",
  emergency: "Emergency",
  consultation: "Consultation",
  other: "Other",
};

const conditionColors: Record<ToothCondition, string> = {
  healthy: "bg-emerald-500",
  cavity: "bg-red-500",
  filled: "bg-blue-500",
  crowned: "bg-amber-500",
  missing: "bg-gray-400",
  impacted: "bg-orange-500",
  root_canal: "bg-purple-500",
  fractured: "bg-red-600",
  sensitive: "bg-yellow-500",
  decayed: "bg-red-400",
};

const conditionLabels: Record<ToothCondition, string> = {
  healthy: "Healthy",
  cavity: "Cavity",
  filled: "Filled",
  crowned: "Crowned",
  missing: "Missing",
  impacted: "Impacted",
  root_canal: "Root Canal",
  fractured: "Fractured",
  sensitive: "Sensitive",
  decayed: "Decayed",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return <Badge variant="default" data-testid={`badge-status-${status}`}><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
  }
  if (status === "scheduled") {
    return <Badge variant="secondary" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
  }
  if (status === "in_progress") {
    return <Badge variant="outline" data-testid={`badge-status-${status}`}><AlertCircle className="h-3 w-3 mr-1" />In Progress</Badge>;
  }
  return <Badge variant="destructive" data-testid={`badge-status-${status}`}><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
}

function ClaimStatusBadge({ status }: { status: string }) {
  if (status === "approved") return <Badge variant="default" data-testid={`badge-claim-${status}`}>Approved</Badge>;
  if (status === "pending") return <Badge variant="secondary" data-testid={`badge-claim-${status}`}>Pending</Badge>;
  if (status === "denied") return <Badge variant="destructive" data-testid={`badge-claim-${status}`}>Denied</Badge>;
  return <Badge variant="outline" data-testid={`badge-claim-${status}`}>{status}</Badge>;
}

function ToothChart({ chart }: { chart: { tooth: number; condition: string; notes?: string }[] }) {
  const upperTeeth = chart.filter((t) => t.tooth >= 1 && t.tooth <= 16);
  const lowerTeeth = chart.filter((t) => t.tooth >= 17 && t.tooth <= 32);

  return (
    <div className="space-y-4" data-testid="container-tooth-chart">
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(conditionColors).map(([condition, color]) => (
          <div key={condition} className="flex items-center gap-1" data-testid={`legend-${condition}`}>
            <div className={`h-3 w-3 rounded-full ${color}`} />
            <span className="text-xs text-muted-foreground">{conditionLabels[condition as ToothCondition]}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground text-center">Upper Jaw (Maxillary)</p>
        <div className="flex justify-center gap-1 flex-wrap">
          {upperTeeth.map((t) => (
            <ToothIcon key={t.tooth} tooth={t.tooth} condition={t.condition as ToothCondition} notes={t.notes} />
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-center gap-1 flex-wrap">
          {lowerTeeth.map((t) => (
            <ToothIcon key={t.tooth} tooth={t.tooth} condition={t.condition as ToothCondition} notes={t.notes} />
          ))}
        </div>
        <p className="text-xs font-medium text-muted-foreground text-center">Lower Jaw (Mandibular)</p>
      </div>
    </div>
  );
}

function ToothIcon({ tooth, condition, notes }: { tooth: number; condition: ToothCondition; notes?: string }) {
  const color = conditionColors[condition] || "bg-gray-300";
  const isHealthy = condition === "healthy";

  return (
    <div
      className="group relative flex flex-col items-center"
      data-testid={`tooth-${tooth}`}
    >
      <div
        className={`w-7 h-8 rounded-md border flex items-center justify-center text-xs font-medium transition-colors ${
          isHealthy
            ? "bg-muted/50 border-border text-muted-foreground"
            : `${color} text-white border-transparent`
        }`}
      >
        {tooth}
      </div>
      {notes && (
        <div className="invisible group-hover:visible absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-50 w-40 p-2 rounded-md bg-popover border text-xs text-popover-foreground shadow-md">
          <p className="font-medium">{conditionLabels[condition]}</p>
          <p className="text-muted-foreground">{notes}</p>
        </div>
      )}
    </div>
  );
}

function RecordCard({ record }: { record: DentalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const recordDate = new Date(record.date).toLocaleDateString();

  return (
    <Card className="hover-elevate" data-testid={`card-dental-record-${record.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-blue-500 shrink-0" />
              <span data-testid={`text-record-type-${record.id}`}>{typeLabels[record.type]}</span>
            </CardTitle>
            <CardDescription data-testid={`text-record-provider-${record.id}`}>
              {record.dentistName} - {record.clinicName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={record.status} />
            <Badge variant="outline" className="text-xs" data-testid={`badge-date-${record.id}`}>
              <Calendar className="h-3 w-3 mr-1" />
              {recordDate}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {record.diagnosis && (
          <p className="text-sm text-muted-foreground" data-testid={`text-diagnosis-${record.id}`}>{record.diagnosis}</p>
        )}

        {record.toothNumbers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">Teeth:</span>
            {record.toothNumbers.map((t) => (
              <Badge key={t} variant="outline" className="text-xs" data-testid={`badge-tooth-${record.id}-${t}`}>#{t}</Badge>
            ))}
          </div>
        )}

        {record.toothConditions.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {record.toothConditions.map((tc, i) => (
              <div key={i} className="flex items-center gap-1" data-testid={`condition-${record.id}-${tc.tooth}`}>
                <div className={`h-2 w-2 rounded-full ${conditionColors[tc.condition]}`} />
                <span className="text-xs">#{tc.tooth} {conditionLabels[tc.condition]}</span>
              </div>
            ))}
          </div>
        )}

        {record.insuranceClaim && (
          <div className="flex items-center gap-3 p-2 rounded-md bg-muted/50 flex-wrap">
            <DollarSign className="h-4 w-4 text-green-500 shrink-0" />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium" data-testid={`text-claim-id-${record.id}`}>Claim: {record.insuranceClaim.claimId}</span>
              <ClaimStatusBadge status={record.insuranceClaim.status} />
              <span className="text-xs text-muted-foreground" data-testid={`text-claim-amount-${record.id}`}>
                ${record.insuranceClaim.amount.toFixed(2)}
                {record.insuranceClaim.coveredAmount !== undefined && (
                  <> (Covered: ${record.insuranceClaim.coveredAmount.toFixed(2)})</>
                )}
              </span>
            </div>
          </div>
        )}

        {expanded && (
          <div className="space-y-2 pt-2 border-t">
            {record.treatment && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Treatment</p>
                <p className="text-sm" data-testid={`text-treatment-${record.id}`}>{record.treatment}</p>
              </div>
            )}
            {record.notes && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Notes</p>
                <p className="text-sm" data-testid={`text-notes-${record.id}`}>{record.notes}</p>
              </div>
            )}
            {record.nextAppointment && (
              <div className="flex items-center gap-2" data-testid={`text-next-appt-${record.id}`}>
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Next appointment: {new Date(record.nextAppointment).toLocaleDateString()}</span>
              </div>
            )}
            {record.xrayImageIds.length > 0 && (
              <div className="flex items-center gap-2" data-testid={`text-xray-count-${record.id}`}>
                <Scan className="h-4 w-4 text-purple-500" />
                <span className="text-sm">{record.xrayImageIds.length} X-Ray image(s) on file</span>
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
          data-testid={`button-expand-${record.id}`}
        >
          {expanded ? "Show Less" : "Show Details"}
        </Button>
      </CardContent>
    </Card>
  );
}

function InsuranceSummary({ patientId }: { patientId: string }) {
  const { data, isLoading } = useQuery<{
    totalBilled: number;
    totalCovered: number;
    outOfPocket: number;
    claimCount: number;
    pendingCount: number;
    approvedCount: number;
    claims: any[];
  }>({
    queryKey: [`/api/dental-records/patient/${patientId}/insurance-summary`],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading insurance summary...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card data-testid="card-insurance-summary">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-green-500" />
          Insurance Summary
        </CardTitle>
        <CardDescription>Overview of your dental insurance claims</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-foreground" data-testid="text-total-billed">${data.totalBilled.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Total Billed</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-covered">${data.totalCovered.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Covered</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-out-of-pocket">${data.outOfPocket.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Out of Pocket</p>
          </div>
          <div className="text-center p-3 rounded-md bg-muted/50">
            <p className="text-2xl font-bold text-foreground" data-testid="text-claim-count">{data.claimCount}</p>
            <p className="text-xs text-muted-foreground">Total Claims</p>
          </div>
        </div>
        {data.pendingCount > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" data-testid="text-pending-claims">
            <Clock className="h-4 w-4" />
            <span className="text-sm">{data.pendingCount} claim(s) pending review</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const addRecordFormSchema = insertDentalRecordSchema.pick({
  type: true,
  status: true,
  dentistName: true,
  clinicName: true,
  date: true,
  diagnosis: true,
  treatment: true,
  notes: true,
}).extend({
  date: z.string().min(1, "Date is required"),
});

type AddRecordFormValues = z.infer<typeof addRecordFormSchema>;

function AddRecordDialog({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddRecordFormValues>({
    resolver: zodResolver(addRecordFormSchema),
    defaultValues: {
      type: "exam",
      status: "completed",
      dentistName: "",
      clinicName: "",
      date: new Date().toISOString().split("T")[0],
      diagnosis: "",
      treatment: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDentalRecord) => {
      const res = await apiRequest("POST", "/api/dental-records", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dental-records"] });
      queryClient.invalidateQueries({ queryKey: [`/api/dental-records/patient/${patientId}/tooth-chart`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dental-records/patient/${patientId}/insurance-summary`] });
      toast({ title: "Record created", description: "Dental record has been added successfully." });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create dental record.", variant: "destructive" });
    },
  });

  const onSubmit = (values: AddRecordFormValues) => {
    createMutation.mutate({
      ...values,
      patientId,
      date: new Date(values.date).toISOString(),
      toothNumbers: [],
      toothConditions: [],
      xrayImageIds: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-dental-record">
          <Plus className="h-4 w-4 mr-2" />
          Add Record
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Dental Record</DialogTitle>
          <DialogDescription>Record a new dental visit or procedure.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-record-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-record-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dentistName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dentist Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dr. Smith" {...field} data-testid="input-dentist-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="clinicName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Downtown Dental" {...field} data-testid="input-clinic-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-record-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe findings..." className="resize-none" {...field} data-testid="input-diagnosis" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="treatment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe treatment performed..." className="resize-none" {...field} data-testid="input-treatment" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." className="resize-none" {...field} data-testid="input-record-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-record">Cancel</Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-dental-record"
              >
                {createMutation.isPending ? "Saving..." : "Save Record"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function DentalRecordsCard({ patientId = "patient-001" }: { patientId?: string }) {
  const [activeTab, setActiveTab] = useState("records");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: recordsData, isLoading: recordsLoading, refetch: refetchRecords } = useQuery<{ records: DentalRecord[] }>({
    queryKey: [`/api/dental-records?patientId=${patientId}`],
  });

  const { data: chartData, isLoading: chartLoading } = useQuery<{ chart: { tooth: number; condition: string; notes?: string }[] }>({
    queryKey: [`/api/dental-records/patient/${patientId}/tooth-chart`],
  });

  const records = recordsData?.records || [];
  const filteredRecords = typeFilter === "all" ? records : records.filter((r) => r.type === typeFilter);
  const scheduledCount = records.filter((r) => r.status === "scheduled").length;
  const completedCount = records.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6" data-testid="container-dental-records">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" data-testid="text-dental-title">
            <Stethoscope className="h-5 w-5 text-blue-500" />
            Dental Records
          </h2>
          <p className="text-sm text-muted-foreground">Track your dental visits, procedures, and tooth health</p>
        </div>
        <AddRecordDialog patientId={patientId} onSuccess={() => refetchRecords()} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-records">{records.length}</p>
            <p className="text-xs text-muted-foreground">Total Records</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-completed-count">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-scheduled-count">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400" data-testid="text-xray-count">
              {records.reduce((s, r) => s + r.xrayImageIds.length, 0)}
            </p>
            <p className="text-xs text-muted-foreground">X-Ray Images</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="records" data-testid="tab-dental-records">
            <ClipboardList className="h-4 w-4 mr-1" />
            Records
          </TabsTrigger>
          <TabsTrigger value="tooth-chart" data-testid="tab-tooth-chart">
            <TrendingUp className="h-4 w-4 mr-1" />
            Tooth Chart
          </TabsTrigger>
          <TabsTrigger value="insurance" data-testid="tab-dental-insurance">
            <DollarSign className="h-4 w-4 mr-1" />
            Insurance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-type-filter">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(typeLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recordsLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">Loading dental records...</p>
              </CardContent>
            </Card>
          ) : filteredRecords.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">No dental records found.</p>
                <p className="text-sm text-muted-foreground">Add your first dental record to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredRecords.map((record) => (
                <RecordCard key={record.id} record={record} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tooth-chart" className="space-y-4">
          <Card data-testid="card-tooth-chart">
            <CardHeader>
              <CardTitle className="text-base">Interactive Tooth Chart</CardTitle>
              <CardDescription>
                Visual overview of your dental health. Hover over colored teeth for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading tooth chart...</p>
              ) : chartData ? (
                <ToothChart chart={chartData.chart} />
              ) : (
                <p className="text-center text-muted-foreground py-4">No tooth chart data available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insurance" className="space-y-4">
          <InsuranceSummary patientId={patientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
