import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  Calendar, 
  Building2, 
  Stethoscope, 
  Heart, 
  Bone, 
  Eye, 
  Baby, 
  Scale, 
  Microscope,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Edit,
  ChevronRight,
} from "lucide-react";

interface CommonProcedure {
  id: string;
  name: string;
  category: string;
}

interface ProcedureCategory {
  id: string;
  name: string;
}

interface SurgicalRecord {
  id: string;
  patientId: string;
  procedureName: string;
  surgeryType: string;
  surgeryDate: string;
  facility: string;
  surgeon: string;
  outcome: string;
  patientNotes?: string;
  complications: Array<{
    id: string;
    type: string;
    description: string;
    severity: string;
    resolved: boolean;
  }>;
  implantsUsed: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  cardiac: <Heart className="w-4 h-4" />,
  orthopedic: <Bone className="w-4 h-4" />,
  ophthalmic: <Eye className="w-4 h-4" />,
  obstetric: <Baby className="w-4 h-4" />,
  bariatric: <Scale className="w-4 h-4" />,
  diagnostic: <Microscope className="w-4 h-4" />,
  default: <Stethoscope className="w-4 h-4" />,
};

const outcomeColors: Record<string, string> = {
  successful: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  partially_successful: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  unsuccessful: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  complicated: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function SurgeriesProceduresPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("questionnaire");
  const [selectedProcedures, setSelectedProcedures] = useState<Map<string, { year: number; month?: number; facility?: string; notes?: string }>>(new Map());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [customProcedure, setCustomProcedure] = useState({ name: "", year: new Date().getFullYear(), facility: "", notes: "" });
  const patientId = "patient-default";

  const { data: commonData } = useQuery<{ success: boolean; data: { procedures: CommonProcedure[]; categories: ProcedureCategory[] } }>({
    queryKey: ["/api/surgical-history/common-procedures"],
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{ success: boolean; data: SurgicalRecord[] }>({
    queryKey: ["/api/surgical-history/patient", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/surgical-history/patient/${patientId}`);
      return res.json();
    },
  });

  const { data: summaryData } = useQuery<{ success: boolean; data: {
    totalProcedures: number;
    majorSurgeries: number;
    minorProcedures: number;
    hasImplants: boolean;
    activeImplants: Array<{ name: string; status: string }>;
    recentProcedures: Array<{ id: string; name: string; date: string; outcome: string }>;
  }}>({
    queryKey: ["/api/surgical-history/summary", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/surgical-history/summary/${patientId}`);
      return res.json();
    },
  });

  const addProcedureMutation = useMutation({
    mutationFn: async (data: { procedureId: string; year: number; month?: number; facility?: string; notes?: string }) => {
      return apiRequest("POST", "/api/surgical-history/quick-add", { patientId, ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/summary", patientId] });
      toast({ title: "Procedure added", description: "Your surgical history has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add procedure.", variant: "destructive" });
    },
  });

  const addCustomProcedureMutation = useMutation({
    mutationFn: async (data: { customName: string; year: number; facility?: string; notes?: string }) => {
      return apiRequest("POST", "/api/surgical-history/quick-add", { patientId, procedureId: "other", ...data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/summary", patientId] });
      setIsAddDialogOpen(false);
      setCustomProcedure({ name: "", year: new Date().getFullYear(), facility: "", notes: "" });
      toast({ title: "Procedure added", description: "Your custom procedure has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add procedure.", variant: "destructive" });
    },
  });

  const deleteProcedureMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/surgical-history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/surgical-history/summary", patientId] });
      toast({ title: "Deleted", description: "Procedure removed from your history." });
    },
  });

  const procedures = commonData?.data?.procedures || [];
  const categories = commonData?.data?.categories || [];
  const history = historyData?.data || [];
  const summary = summaryData?.data;

  const handleProcedureToggle = (procedureId: string, checked: boolean) => {
    const newSelected = new Map(selectedProcedures);
    if (checked) {
      newSelected.set(procedureId, { year: new Date().getFullYear() });
    } else {
      newSelected.delete(procedureId);
    }
    setSelectedProcedures(newSelected);
  };

  const handleProcedureDetailChange = (procedureId: string, field: string, value: string | number) => {
    const current = selectedProcedures.get(procedureId) || { year: new Date().getFullYear() };
    selectedProcedures.set(procedureId, { ...current, [field]: value });
    setSelectedProcedures(new Map(selectedProcedures));
  };

  const handleSaveSelected = async () => {
    const entries = Array.from(selectedProcedures.entries());
    for (const [procedureId, details] of entries) {
      await addProcedureMutation.mutateAsync({
        procedureId,
        year: details.year,
        month: details.month,
        facility: details.facility,
        notes: details.notes,
      });
    }
    setSelectedProcedures(new Map());
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const getCategoryIcon = (categoryId: string) => categoryIcons[categoryId] || categoryIcons.default;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Surgeries & Procedures</h1>
        <p className="text-muted-foreground">Record your surgical and procedural history</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-total-procedures">{summary.totalProcedures}</div>
              <div className="text-sm text-muted-foreground">Total Procedures</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-major-surgeries">{summary.majorSurgeries}</div>
              <div className="text-sm text-muted-foreground">Major Surgeries</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-minor-procedures">{summary.minorProcedures}</div>
              <div className="text-sm text-muted-foreground">Minor Procedures</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold" data-testid="text-active-implants">{summary.activeImplants?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Active Implants</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="questionnaire" data-testid="tab-questionnaire">Add Procedures</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">My History</TabsTrigger>
        </TabsList>

        <TabsContent value="questionnaire">
          <Card>
            <CardHeader>
              <CardTitle>Have you had any surgeries or major procedures?</CardTitle>
              <CardDescription>Select all that apply and provide details</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {categories.map((category) => {
                  const categoryProcedures = procedures.filter((p) => p.category === category.id);
                  if (categoryProcedures.length === 0) return null;

                  return (
                    <div key={category.id} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        {getCategoryIcon(category.id)}
                        <h3 className="font-semibold">{category.name}</h3>
                      </div>
                      <div className="space-y-3">
                        {categoryProcedures.map((procedure) => {
                          const isSelected = selectedProcedures.has(procedure.id);
                          const details = selectedProcedures.get(procedure.id);

                          return (
                            <div key={procedure.id} className="border rounded-lg p-3">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={procedure.id}
                                  checked={isSelected}
                                  onCheckedChange={(checked) => handleProcedureToggle(procedure.id, checked as boolean)}
                                  data-testid={`checkbox-procedure-${procedure.id}`}
                                />
                                <Label htmlFor={procedure.id} className="flex-1 cursor-pointer">
                                  {procedure.name}
                                </Label>
                              </div>
                              
                              {isSelected && (
                                <div className="mt-3 pl-7 grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <FieldCaption className="text-xs text-muted-foreground">Year *</FieldCaption>
                                    <Select
                                      value={String(details?.year || currentYear)}
                                      onValueChange={(v) => handleProcedureDetailChange(procedure.id, "year", parseInt(v))}
                                    >
                                      <SelectTrigger aria-label="Year *" data-testid={`select-year-${procedure.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {years.slice(0, 50).map((year) => (
                                          <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <FieldCaption className="text-xs text-muted-foreground">Month (optional)</FieldCaption>
                                    <Select
                                      value={details?.month ? String(details.month) : ""}
                                      onValueChange={(v) => handleProcedureDetailChange(procedure.id, "month", parseInt(v))}
                                    >
                                      <SelectTrigger aria-label="Month (optional)" data-testid={`select-month-${procedure.id}`}>
                                        <SelectValue placeholder="Select month" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {months.map((m) => (
                                          <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <FieldCaption className="text-xs text-muted-foreground">Hospital/Clinic (optional)</FieldCaption>
                                    <Input aria-label="Hospital/Clinic (optional)"
                                      placeholder="Enter facility name"
                                      value={details?.facility || ""}
                                      onChange={(e) => handleProcedureDetailChange(procedure.id, "facility", e.target.value)}
                                      data-testid={`input-facility-${procedure.id}`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>

              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-add-custom">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Other Procedure
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Custom Procedure</DialogTitle>
                      <DialogDescription>Enter details for a procedure not listed above</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="surgeries-procedures-procedure-name">Procedure Name *</Label>
                        <Input id="surgeries-procedures-procedure-name"
                          placeholder="e.g., Knee Arthroscopy"
                          value={customProcedure.name}
                          onChange={(e) => setCustomProcedure({ ...customProcedure, name: e.target.value })}
                          data-testid="input-custom-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="surgeries-procedures-year">Year *</Label>
                        <Select
                          value={String(customProcedure.year)}
                          onValueChange={(v) => setCustomProcedure({ ...customProcedure, year: parseInt(v) })}
                        >
                          <SelectTrigger id="surgeries-procedures-year" data-testid="select-custom-year">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.slice(0, 50).map((year) => (
                              <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="surgeries-procedures-hospital-clinic-optional">Hospital/Clinic (optional)</Label>
                        <Input id="surgeries-procedures-hospital-clinic-optional"
                          placeholder="Enter facility name"
                          value={customProcedure.facility}
                          onChange={(e) => setCustomProcedure({ ...customProcedure, facility: e.target.value })}
                          data-testid="input-custom-facility"
                        />
                      </div>
                      <div>
                        <Label htmlFor="surgeries-procedures-notes-optional">Notes (optional)</Label>
                        <Textarea id="surgeries-procedures-notes-optional"
                          placeholder="Any additional details..."
                          value={customProcedure.notes}
                          onChange={(e) => setCustomProcedure({ ...customProcedure, notes: e.target.value })}
                          data-testid="input-custom-notes"
                        />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => addCustomProcedureMutation.mutate({
                          customName: customProcedure.name,
                          year: customProcedure.year,
                          facility: customProcedure.facility || undefined,
                          notes: customProcedure.notes || undefined,
                        })}
                        disabled={!customProcedure.name || addCustomProcedureMutation.isPending}
                        data-testid="button-save-custom"
                      >
                        {addCustomProcedureMutation.isPending ? "Adding..." : "Add Procedure"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  onClick={handleSaveSelected}
                  disabled={selectedProcedures.size === 0 || addProcedureMutation.isPending}
                  data-testid="button-save-selected"
                >
                  {addProcedureMutation.isPending ? "Saving..." : `Save ${selectedProcedures.size} Selected`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Your Surgical History</CardTitle>
              <CardDescription>Review and manage your recorded procedures</CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No procedures recorded yet.</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setActiveTab("questionnaire")}
                    data-testid="button-add-first"
                  >
                    Add Your First Procedure
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                      data-testid={`card-procedure-${record.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium" data-testid={`text-procedure-name-${record.id}`}>
                            {record.procedureName}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(record.surgeryDate).getFullYear()}
                            </span>
                            {record.facility && record.facility !== "Not specified" && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {record.facility}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={outcomeColors[record.outcome]}>
                          {record.outcome === "successful" && <CheckCircle className="w-3 h-3 mr-1" />}
                          {record.outcome === "complicated" && <AlertCircle className="w-3 h-3 mr-1" />}
                          {record.outcome === "unsuccessful" && <XCircle className="w-3 h-3 mr-1" />}
                          {record.outcome.replace("_", " ")}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProcedureMutation.mutate(record.id)}
                          data-testid={`button-delete-${record.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-surgeries-procedures-disclaimer" />
    </div>
  );
}