import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  FileText,
  User,
  Stethoscope,
  Heart,
  Pill,
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShieldAlert,
  Users,
  History,
  ClipboardList,
  XCircle,
} from "lucide-react";

interface Patient {
  id: string;
  name: string;
  mrn: string;
}

interface PatientSummarySection {
  title: string;
  content: string;
  priority: "high" | "medium" | "low";
}

interface RecentUpdate {
  date: string;
  resourceType: string;
  description: string;
  isNew: boolean;
}

interface AttentionArea {
  title: string;
  description: string;
  relatedResources: string[];
  note: string;
}

interface FHIRResourceSummary {
  resourceType: string;
  count: number;
  items: Array<{
    id: string;
    display: string;
    date?: string;
    status?: string;
    category?: string;
  }>;
}

interface PatientSummary {
  id: string;
  patientId: string;
  role: string;
  generatedAt: string;
  summary: string;
  sections: PatientSummarySection[];
  recentUpdates: RecentUpdate[];
  attentionAreas: AttentionArea[];
  sourceResources: FHIRResourceSummary[];
  disclaimer: string;
}

const ROLE_ICONS: Record<string, typeof Stethoscope> = {
  physician: Stethoscope,
  nurse: Heart,
  care_coordinator: Users,
  pharmacist: Pill,
  specialist: Activity,
};

const ROLE_LABELS: Record<string, string> = {
  physician: "Physician",
  nurse: "Nurse",
  care_coordinator: "Care Coordinator",
  pharmacist: "Pharmacist",
  specialist: "Specialist",
};

const FOCUS_AREAS = [
  { id: "medications", label: "Medications" },
  { id: "vitals", label: "Vital Signs" },
  { id: "labs", label: "Laboratory Results" },
  { id: "conditions", label: "Conditions" },
  { id: "care_plan", label: "Care Plan Goals" },
  { id: "encounters", label: "Recent Encounters" },
];

export default function PatientSummaryGenerator() {
  const { toast } = useToast();
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<string[]>([]);
  const [includeRecentUpdates, setIncludeRecentUpdates] = useState(true);
  const [generatedSummary, setGeneratedSummary] = useState<PatientSummary | null>(null);

  const patientsQuery = useQuery<{ patients: Patient[] }>({
    queryKey: ["/api/patient-summary/patients"],
  });

  const rolesQuery = useQuery<{ roles: string[] }>({
    queryKey: ["/api/patient-summary/roles"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/patient-summary/generate", {
        patientId: selectedPatient,
        role: selectedRole,
        focusAreas: selectedFocusAreas.length > 0 ? selectedFocusAreas : undefined,
        includeRecentUpdates,
        timeframeDays: 30,
      });
      return response.json();
    },
    onSuccess: (data: { success: boolean; summary: PatientSummary }) => {
      setGeneratedSummary(data.summary);
      toast({ title: "Summary Generated", description: "Patient summary has been created successfully." });
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to generate summary";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const toggleFocusArea = (areaId: string) => {
    setSelectedFocusAreas((prev) =>
      prev.includes(areaId) ? prev.filter((a) => a !== areaId) : [...prev, areaId]
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
      default:
        return "";
    }
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case "Condition":
        return <Activity className="h-4 w-4" />;
      case "MedicationStatement":
        return <Pill className="h-4 w-4" />;
      case "Observation":
        return <ClipboardList className="h-4 w-4" />;
      case "Encounter":
        return <User className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Patient Summary Generator</h1>
          <p className="text-muted-foreground">Generate role-specific patient summaries from FHIR data</p>
        </div>
      </div>

      <Alert className="mb-6">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Compliance Notice</AlertTitle>
        <AlertDescription>
          This tool generates informational summaries only. It does not provide clinical decision support,
          diagnoses, or treatment recommendations. All clinical decisions must be made by qualified healthcare professionals.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Generate Summary</CardTitle>
            <CardDescription>Select patient and configure summary options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Patient</Label>
              {patientsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading patients...</p>
              ) : patientsQuery.isError ? (
                <p className="text-sm text-red-500">Failed to load patients</p>
              ) : (
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger data-testid="select-patient">
                    <SelectValue placeholder="Choose a patient" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientsQuery.data?.patients.map((patient) => (
                      <SelectItem key={patient.id} value={patient.id}>
                        {patient.name} ({patient.mrn})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Your Role</Label>
              {rolesQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading roles...</p>
              ) : rolesQuery.isError ? (
                <p className="text-sm text-red-500">Failed to load roles</p>
              ) : (
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesQuery.data?.roles.map((role) => {
                      const Icon = ROLE_ICONS[role] || User;
                      return (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {ROLE_LABELS[role] || role}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Focus Areas (Optional)</Label>
              <div className="space-y-2">
                {FOCUS_AREAS.map((area) => (
                  <div key={area.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={area.id}
                      checked={selectedFocusAreas.includes(area.id)}
                      onCheckedChange={() => toggleFocusArea(area.id)}
                      data-testid={`checkbox-focus-${area.id}`}
                    />
                    <label htmlFor={area.id} className="text-sm cursor-pointer">
                      {area.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-updates"
                checked={includeRecentUpdates}
                onCheckedChange={(checked) => setIncludeRecentUpdates(checked === true)}
                data-testid="checkbox-include-updates"
              />
              <label htmlFor="include-updates" className="text-sm cursor-pointer">
                Include recent updates (last 30 days)
              </label>
            </div>

            <Button
              className="w-full"
              onClick={() => generateMutation.mutate()}
              disabled={!selectedPatient || !selectedRole || generateMutation.isPending}
              data-testid="button-generate-summary"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Patient Summary
            </CardTitle>
            <CardDescription>
              {generatedSummary
                ? `Generated for ${ROLE_LABELS[generatedSummary.role] || generatedSummary.role} on ${new Date(generatedSummary.generatedAt).toLocaleString()}`
                : "Configure options and generate a summary"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {generateMutation.isPending ? (
              <div className="text-center py-12">
                <RefreshCw className="h-12 w-12 mx-auto text-muted-foreground animate-spin mb-4" />
                <p className="text-muted-foreground">Generating AI-powered summary...</p>
                <p className="text-sm text-muted-foreground mt-2">Aggregating FHIR resources and analyzing data</p>
              </div>
            ) : generatedSummary ? (
              <Tabs defaultValue="summary">
                <TabsList>
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="sections">Sections</TabsTrigger>
                  <TabsTrigger value="attention">Attention Areas</TabsTrigger>
                  <TabsTrigger value="updates">Recent Updates</TabsTrigger>
                  <TabsTrigger value="sources">Source Data</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="mt-4">
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <p className="text-sm leading-relaxed">{generatedSummary.summary}</p>
                    </div>

                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {generatedSummary.disclaimer}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded border">
                        <p className="text-2xl font-bold">
                          {generatedSummary.sourceResources.reduce((sum, r) => sum + r.count, 0)}
                        </p>
                        <p className="text-xs text-muted-foreground">Data Points</p>
                      </div>
                      <div className="p-3 rounded border">
                        <p className="text-2xl font-bold">{generatedSummary.sections.length}</p>
                        <p className="text-xs text-muted-foreground">Sections</p>
                      </div>
                      <div className="p-3 rounded border">
                        <p className="text-2xl font-bold">{generatedSummary.attentionAreas.length}</p>
                        <p className="text-xs text-muted-foreground">Attention Areas</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="sections" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {generatedSummary.sections.map((section, index) => (
                        <div key={index} className="p-4 rounded border">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium">{section.title}</h4>
                            <Badge className={getPriorityColor(section.priority)}>
                              {section.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{section.content}</p>
                        </div>
                      ))}
                      {generatedSummary.sections.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No sections generated.</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="attention" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {generatedSummary.attentionAreas.map((area, index) => (
                        <div key={index} className="p-4 rounded border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/50">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-medium">{area.title}</h4>
                              <p className="text-sm mt-1">{area.description}</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {area.relatedResources.map((resource, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {resource}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 italic">{area.note}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {generatedSummary.attentionAreas.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No attention areas identified.</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="updates" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {generatedSummary.recentUpdates.map((update, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded border flex items-start gap-3 ${
                            update.isNew ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {getResourceIcon(update.resourceType)}
                            {update.isNew && (
                              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs">
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline" className="text-xs">
                                {update.resourceType}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(update.date).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm mt-1">{update.description}</p>
                          </div>
                        </div>
                      ))}
                      {generatedSummary.recentUpdates.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No recent updates in the selected timeframe.</p>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="sources" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {generatedSummary.sourceResources.map((resource, index) => (
                        <div key={index} className="p-4 rounded border">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getResourceIcon(resource.resourceType)}
                              <h4 className="font-medium">{resource.resourceType}</h4>
                            </div>
                            <Badge variant="secondary">{resource.count} items</Badge>
                          </div>
                          <div className="space-y-1">
                            {resource.items.slice(0, 5).map((item, idx) => (
                              <div key={idx} className="text-sm flex items-center justify-between py-1 border-b last:border-0">
                                <span className="truncate flex-1">{item.display}</span>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  {item.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {item.status}
                                    </Badge>
                                  )}
                                  {item.date && (
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(item.date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                            {resource.items.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center pt-2">
                                +{resource.items.length - 5} more items
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a patient and role to generate a summary.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Summaries are tailored for your care team role and highlight key information.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
