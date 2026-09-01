import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  Pill,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  Calendar,
  Clock,
  Building,
  Copy,
  Check,
  ChevronRight,
  Shield,
  TrendingUp,
  Layers,
  Send,
  Printer,
  Target,
} from "lucide-react";

type MedStatus = "taking" | "not_taking" | "unsure" | "unconfirmed";

interface Medication {
  id: string;
  name: string;
  genericName: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  pharmacy: string;
  lastFilled: string;
  source: string;
  status: MedStatus;
  isDuplicate: boolean;
  duplicateOf?: string;
  hasConflict: boolean;
  conflictDetails?: string;
}

interface AccuracyMetrics {
  totalMeds: number;
  confirmed: number;
  taking: number;
  notTaking: number;
  unsure: number;
  duplicates: number;
  conflicts: number;
}

const mockMedications: Medication[] = [
  {
    id: "med-1",
    name: "Lisinopril",
    genericName: "Lisinopril",
    dosage: "10mg",
    frequency: "Once daily",
    prescriber: "Dr. Sarah Johnson",
    pharmacy: "CVS Pharmacy",
    lastFilled: "2026-01-10",
    source: "Fasten Health",
    status: "taking",
    isDuplicate: false,
    hasConflict: false,
  },
  {
    id: "med-2",
    name: "Metformin",
    genericName: "Metformin HCL",
    dosage: "500mg",
    frequency: "Twice daily",
    prescriber: "Dr. Michael Chen",
    pharmacy: "Walgreens",
    lastFilled: "2026-01-05",
    source: "Fasten Health",
    status: "taking",
    isDuplicate: false,
    hasConflict: false,
  },
  {
    id: "med-3",
    name: "Atorvastatin",
    genericName: "Atorvastatin Calcium",
    dosage: "20mg",
    frequency: "Once daily at bedtime",
    prescriber: "Dr. Sarah Johnson",
    pharmacy: "CVS Pharmacy",
    lastFilled: "2025-12-20",
    source: "Fasten Health",
    status: "unconfirmed",
    isDuplicate: false,
    hasConflict: false,
  },
  {
    id: "med-4",
    name: "Lipitor",
    genericName: "Atorvastatin Calcium",
    dosage: "40mg",
    frequency: "Once daily",
    prescriber: "Dr. Robert Williams",
    pharmacy: "Rite Aid",
    lastFilled: "2025-11-15",
    source: "Fasten Health",
    status: "unconfirmed",
    isDuplicate: true,
    duplicateOf: "Atorvastatin",
    hasConflict: true,
    conflictDetails: "Dosage mismatch: 20mg vs 40mg from different sources",
  },
  {
    id: "med-5",
    name: "Omeprazole",
    genericName: "Omeprazole",
    dosage: "20mg",
    frequency: "Once daily before breakfast",
    prescriber: "Dr. Michael Chen",
    pharmacy: "CVS Pharmacy",
    lastFilled: "2025-12-28",
    source: "Fasten Health",
    status: "not_taking",
    isDuplicate: false,
    hasConflict: false,
  },
  {
    id: "med-6",
    name: "Amlodipine",
    genericName: "Amlodipine Besylate",
    dosage: "5mg",
    frequency: "Once daily",
    prescriber: "Dr. Sarah Johnson",
    pharmacy: "Walgreens",
    lastFilled: "2026-01-08",
    source: "Fasten Health",
    status: "unsure",
    isDuplicate: false,
    hasConflict: false,
  },
  {
    id: "med-7",
    name: "Norvasc",
    genericName: "Amlodipine Besylate",
    dosage: "5mg",
    frequency: "Once daily",
    prescriber: "Dr. Lisa Park",
    pharmacy: "CVS Pharmacy",
    lastFilled: "2025-10-20",
    source: "Fasten Health",
    status: "unconfirmed",
    isDuplicate: true,
    duplicateOf: "Amlodipine",
    hasConflict: false,
  },
  {
    id: "med-8",
    name: "Gabapentin",
    genericName: "Gabapentin",
    dosage: "300mg",
    frequency: "Three times daily",
    prescriber: "Dr. Robert Williams",
    pharmacy: "Rite Aid",
    lastFilled: "2025-12-15",
    source: "Fasten Health",
    status: "unconfirmed",
    isDuplicate: false,
    hasConflict: false,
  },
];

function getStatusIcon(status: MedStatus) {
  switch (status) {
    case "taking": return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "not_taking": return <XCircle className="h-5 w-5 text-red-600" />;
    case "unsure": return <HelpCircle className="h-5 w-5 text-yellow-600" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground" />;
  }
}

function getStatusBadge(status: MedStatus) {
  switch (status) {
    case "taking": return <Badge variant="default" className="bg-green-600">Taking</Badge>;
    case "not_taking": return <Badge variant="destructive">Not Taking</Badge>;
    case "unsure": return <Badge variant="secondary">Unsure</Badge>;
    default: return <Badge variant="outline">Unconfirmed</Badge>;
  }
}

export default function MedAccuracy() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("review");
  const [medications, setMedications] = useState<Medication[]>(mockMedications);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [selectedMed, setSelectedMed] = useState<Medication | null>(null);
  const [showMedDialog, setShowMedDialog] = useState(false);

  const metrics: AccuracyMetrics = {
    totalMeds: medications.length,
    confirmed: medications.filter(m => m.status !== "unconfirmed").length,
    taking: medications.filter(m => m.status === "taking").length,
    notTaking: medications.filter(m => m.status === "not_taking").length,
    unsure: medications.filter(m => m.status === "unsure").length,
    duplicates: medications.filter(m => m.isDuplicate).length,
    conflicts: medications.filter(m => m.hasConflict).length,
  };

  const confirmationRate = metrics.totalMeds > 0 
    ? Math.round((metrics.confirmed / metrics.totalMeds) * 100) 
    : 0;

  const handleStatusChange = (medId: string, newStatus: MedStatus) => {
    setMedications(medications.map(med => 
      med.id === medId ? { ...med, status: newStatus } : med
    ));
    toast({ title: "Status updated" });
  };

  const handleViewMed = (med: Medication) => {
    setSelectedMed(med);
    setShowMedDialog(true);
  };

  const handleExport = () => {
    const cleanMeds = medications.filter(m => 
      m.status === "taking" && !m.isDuplicate
    );
    toast({ 
      title: "Export started", 
      description: `Exporting ${cleanMeds.length} confirmed medications as ${exportFormat.toUpperCase()}` 
    });
    setShowExportDialog(false);
  };

  const unconfirmedMeds = medications.filter(m => m.status === "unconfirmed");
  const duplicateMeds = medications.filter(m => m.isDuplicate);
  const conflictMeds = medications.filter(m => m.hasConflict);

  return (
    <div className="p-6 space-y-6" data-testid="page-med-accuracy">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Pill className="h-6 w-6" />
            Medication Accuracy
          </h1>
          <p className="text-muted-foreground">
            Confirm your medication list for safe transitions of care
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowExportDialog(true)} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Clean List
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{confirmationRate}%</div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
            </div>
          </div>
          <Progress value={confirmationRate} className="mt-3" />
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.taking}</div>
              <div className="text-sm text-muted-foreground">Taking</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Layers className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.duplicates}</div>
              <div className="text-sm text-muted-foreground">Duplicates</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{metrics.conflicts}</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium">Why This Matters</h3>
            <p className="text-sm text-muted-foreground">
              An accurate medication list helps ensure safety during care transitions, 
              reduces duplicate prescriptions, and supports better coordination between your providers.
              This information is for organizational purposes only - discuss any medication questions with your healthcare provider.
            </p>
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="review" data-testid="tab-review">
            <Clock className="h-4 w-4 mr-2" />
            Needs Review ({unconfirmedMeds.length})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            <Pill className="h-4 w-4 mr-2" />
            All Medications ({medications.length})
          </TabsTrigger>
          <TabsTrigger value="issues" data-testid="tab-issues">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Duplicates & Conflicts ({duplicateMeds.length + conflictMeds.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-4">
          {unconfirmedMeds.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-medium mb-2">All Medications Confirmed</h3>
              <p className="text-muted-foreground">
                Great work! Your medication list is up to date.
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Please confirm whether you are currently taking each medication below.
              </p>
              {unconfirmedMeds.map((med) => (
                <Card key={med.id} className="p-4" data-testid={`card-med-${med.id}`}>
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{med.name}</h3>
                        {med.isDuplicate && (
                          <Badge variant="secondary">
                            <Layers className="h-3 w-3 mr-1" />
                            Possible Duplicate
                          </Badge>
                        )}
                        {med.hasConflict && (
                          <Badge variant="destructive">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Conflict
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {med.dosage} - {med.frequency}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {med.prescriber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Last filled: {med.lastFilled}
                        </span>
                      </div>
                      {med.conflictDetails && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-sm text-destructive">
                          {med.conflictDetails}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <FieldCaption className="text-sm font-medium">Are you taking this?</FieldCaption>
                      <RadioGroup
                        value={med.status}
                        onValueChange={(value) => handleStatusChange(med.id, value as MedStatus)}
                        className="flex gap-2"
                      >
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="taking" id={`${med.id}-taking`} />
                          <Label htmlFor={`${med.id}-taking`} className="text-sm cursor-pointer">
                            Taking
                          </Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="not_taking" id={`${med.id}-not-taking`} />
                          <Label htmlFor={`${med.id}-not-taking`} className="text-sm cursor-pointer">
                            Not Taking
                          </Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="unsure" id={`${med.id}-unsure`} />
                          <Label htmlFor={`${med.id}-unsure`} className="text-sm cursor-pointer">
                            Unsure
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Complete Medication List</CardTitle>
              <CardDescription>
                All medications from your connected health records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {medications.map((med) => (
                <div 
                  key={med.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                  {...clickable(() => handleViewMed(med))}
                  data-testid={`row-med-${med.id}`}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(med.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{med.name}</span>
                        <span className="text-sm text-muted-foreground">{med.dosage}</span>
                        {med.isDuplicate && (
                          <Badge variant="outline" className="text-yellow-600">
                            <Layers className="h-3 w-3 mr-1" />
                            Duplicate
                          </Badge>
                        )}
                        {med.hasConflict && (
                          <Badge variant="destructive">Conflict</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {med.frequency} | Source: {med.source}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(med.status)}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="issues" className="space-y-6">
          {duplicateMeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Possible Duplicates
                </CardTitle>
                <CardDescription>
                  These medications may be duplicates - same drug from different sources
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {duplicateMeds.map((med) => (
                  <div 
                    key={med.id}
                    className="p-4 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-900/20"
                    data-testid={`card-duplicate-${med.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{med.name}</span>
                          <Badge variant="secondary">{med.dosage}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {med.frequency} | Prescriber: {med.prescriber}
                        </p>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Possible duplicate of: </span>
                          <span className="font-medium">{med.duplicateOf}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Source: {med.source} | Last filled: {med.lastFilled}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleStatusChange(med.id, "not_taking")}
                        >
                          Mark Not Taking
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleViewMed(med)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {conflictMeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Conflicts Detected
                </CardTitle>
                <CardDescription>
                  These records have conflicting information that needs clarification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {conflictMeds.map((med) => (
                  <div 
                    key={med.id}
                    className="p-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20"
                    data-testid={`card-conflict-${med.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{med.name}</span>
                          <Badge variant="destructive">Conflict</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {med.dosage} - {med.frequency}
                        </p>
                        {med.conflictDetails && (
                          <div className="p-2 bg-destructive/10 rounded text-sm mb-2">
                            {med.conflictDetails}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          Source: {med.source} | Prescriber: {med.prescriber}
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleViewMed(med)}
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {duplicateMeds.length === 0 && conflictMeds.length === 0 && (
            <Card className="p-8 text-center">
              <CheckCircle className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Issues Found</h3>
              <p className="text-muted-foreground">
                Your medication list has no duplicates or conflicts.
              </p>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Clean Medication List
            </DialogTitle>
            <DialogDescription>
              Export your confirmed medications for sharing with providers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Confirmed "Taking"</div>
                  <div className="text-xl font-bold text-green-600">{metrics.taking}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Excluded (Not Taking)</div>
                  <div className="text-xl font-bold text-muted-foreground">{metrics.notTaking}</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="med-accuracy-export-format">Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger id="med-accuracy-export-format" data-testid="select-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="fhir">FHIR MedicationStatement</SelectItem>
                  <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Clean List Ready</p>
                  <p className="text-green-700 dark:text-green-300">
                    Only confirmed "Taking" medications will be included.
                    Duplicates and "Not Taking" items are excluded.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button onClick={handleExport} data-testid="button-do-export">
              <Download className="h-4 w-4 mr-2" />
              Export {metrics.taking} Medications
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMedDialog} onOpenChange={setShowMedDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Medication Details</DialogTitle>
          </DialogHeader>
          {selectedMed && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">{selectedMed.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedMed.genericName}</p>
                </div>
                {getStatusBadge(selectedMed.status)}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Dosage</div>
                  <div className="font-medium">{selectedMed.dosage}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Frequency</div>
                  <div className="font-medium">{selectedMed.frequency}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Prescriber</div>
                  <div className="font-medium">{selectedMed.prescriber}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Pharmacy</div>
                  <div className="font-medium">{selectedMed.pharmacy}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Last Filled</div>
                  <div className="font-medium">{selectedMed.lastFilled}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Data Source</div>
                  <div className="font-medium">{selectedMed.source}</div>
                </div>
              </div>

              {(selectedMed.isDuplicate || selectedMed.hasConflict) && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    {selectedMed.isDuplicate && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                          <Layers className="h-4 w-4" />
                          <span className="font-medium">Possible Duplicate</span>
                        </div>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          This may be the same medication as {selectedMed.duplicateOf}
                        </p>
                      </div>
                    )}
                    {selectedMed.hasConflict && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Conflict Detected</span>
                        </div>
                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {selectedMed.conflictDetails}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />

              <div>
                <FieldCaption className="text-sm font-medium mb-2 block">Update Status</FieldCaption>
                <RadioGroup
                  value={selectedMed.status}
                  onValueChange={(value) => {
                    handleStatusChange(selectedMed.id, value as MedStatus);
                    setSelectedMed({ ...selectedMed, status: value as MedStatus });
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="taking" id="dialog-taking" />
                    <Label htmlFor="dialog-taking" className="cursor-pointer">Taking</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="not_taking" id="dialog-not-taking" />
                    <Label htmlFor="dialog-not-taking" className="cursor-pointer">Not Taking</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="unsure" id="dialog-unsure" />
                    <Label htmlFor="dialog-unsure" className="cursor-pointer">Unsure</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMedDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
