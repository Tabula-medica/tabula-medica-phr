import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Activity, 
  AlertTriangle, 
  BookOpen, 
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Edit,
  ExternalLink,
  FileText,
  Filter,
  Heart,
  Info,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Stethoscope,
  Syringe,
  Target,
  Users,
  Zap
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface RuleCitation {
  id: string;
  source: string;
  documentTitle: string;
  version?: string;
  publicationDate: string;
  effectiveDate: string;
  expirationDate?: string;
  url?: string;
  section?: string;
  accessedAt: string;
}

interface RuleVersion {
  version: string;
  effectiveDate: string;
  expirationDate?: string;
  publishedAt: string;
  publishedBy: string;
  approvalStatus: "draft" | "pending_review" | "approved" | "deprecated" | "retired";
  approvedBy?: string;
  approvedAt?: string;
}

interface ActivationGuardrail {
  id: string;
  name: string;
  description: string;
  condition: {
    type: string;
    operator: string;
    field: string;
    value: string | number | boolean | string[];
  };
  action: "allow" | "block" | "require_review" | "warn";
  message: string;
  requiresOverride: boolean;
  auditRequired: boolean;
}

interface EligibilityCriterion {
  id: string;
  type: string;
  operator: string;
  field: string;
  value: string | number | boolean | string[];
  required: boolean;
  description: string;
}

interface TaskDefinition {
  title: string;
  titleTemplate: string;
  description: string;
  descriptionTemplate: string;
  category: string;
  defaultPriority: string;
  estimatedDurationMinutes?: number;
  requiresProvider: boolean;
  providerTypes?: string[];
  associatedCodes?: {
    icd10?: string[];
    cpt?: string[];
    loinc?: string[];
    cvx?: string[];
  };
}

interface PopulationAdaptation {
  population: string;
  titleOverride?: string;
  descriptionOverride?: string;
  priorityOverride?: string;
  simplifiedView: boolean;
  largeText: boolean;
  iconEmphasis: boolean;
  voiceEnabled: boolean;
  additionalInstructions?: string;
}

interface RuleTemplate {
  id: string;
  domain: string;
  name: string;
  description: string;
  version: RuleVersion;
  citations: RuleCitation[];
  guardrails: ActivationGuardrail[];
  eligibilityCriteria: EligibilityCriterion[];
  taskDefinition: TaskDefinition;
  cadence: {
    type: string;
    intervalMonths?: number;
    intervalDays?: number;
    gracePeriodDays: number;
    overdueThresholdDays: number;
  };
  populationAdaptations: PopulationAdaptation[];
  metadata: {
    tags: string[];
    targetPopulations: string[];
    riskFlags: string[];
    contraindications: string[];
    relatedRules: string[];
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Domain {
  id: string;
  name: string;
  description: string;
}

interface Population {
  id: string;
  name: string;
  description: string;
  features: string[];
}

interface GeneratedTask {
  id: string;
  ruleTemplateId: string;
  domain: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  dueDate: string;
  citations: RuleCitation[];
  guardrailResults: { guardrailName: string; action: string; triggered: boolean; message?: string }[];
  requiresReview: boolean;
  disclaimer: string;
}

const domainIcons: Record<string, typeof Activity> = {
  diabetes_screening: Heart,
  vaccine_reminder: Syringe,
  cancer_followup: Target,
  pediatric_schedule: Users,
  geriatric_care: Users,
  preventive_care: Shield,
  chronic_disease: Activity,
  medication_adherence: FileText
};

const domainColors: Record<string, string> = {
  diabetes_screening: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  vaccine_reminder: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancer_followup: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  pediatric_schedule: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  geriatric_care: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  preventive_care: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  chronic_disease: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  medication_adherence: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  deprecated: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  retired: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

const actionColors: Record<string, string> = {
  allow: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  warn: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  require_review: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  block: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
};

export default function ClinicalRuleEngine() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRule, setSelectedRule] = useState<RuleTemplate | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSimulateDialogOpen, setIsSimulateDialogOpen] = useState(false);

  const [newRule, setNewRule] = useState({
    domain: "",
    name: "",
    description: "",
    category: "screening",
    priority: "medium",
    intervalMonths: 12,
    gracePeriodDays: 14,
    overdueThresholdDays: 30
  });

  const [simulationContext, setSimulationContext] = useState({
    patientId: "patient-001",
    profileId: "profile-001",
    ageYears: 55,
    conditions: ["diabetes", "hypertension"],
    medications: ["metformin", "lisinopril"],
    allergies: [] as string[],
    populationView: "standard"
  });

  const { data: metadata, isLoading: metadataLoading } = useQuery<{
    engineVersion: string;
    effectiveDate: string;
    supportedDomains: number;
    supportedPopulations: number;
    noCdsCompliance: boolean;
    disclaimer: string;
  }>({
    queryKey: ["/api/clinical-rules/metadata"]
  });

  const { data: rulesData, isLoading: rulesLoading, refetch: refetchRules } = useQuery<{
    rules: RuleTemplate[];
    count: number;
    disclaimer: string;
  }>({
    queryKey: ["/api/clinical-rules/rules", selectedDomain],
    queryFn: async () => {
      const url = selectedDomain === "all" 
        ? "/api/clinical-rules/rules" 
        : `/api/clinical-rules/rules?domain=${selectedDomain}`;
      const response = await fetch(url);
      return response.json();
    }
  });

  const { data: domainsData, isLoading: domainsLoading } = useQuery<{ domains: Domain[] }>({
    queryKey: ["/api/clinical-rules/domains"]
  });

  const { data: populationsData, isLoading: populationsLoading } = useQuery<{ populations: Population[] }>({
    queryKey: ["/api/clinical-rules/populations"]
  });

  const { data: citationsData, isLoading: citationsLoading } = useQuery<{
    citations: RuleCitation[];
    count: number;
  }>({
    queryKey: ["/api/clinical-rules/citations"]
  });

  const createRuleMutation = useMutation({
    mutationFn: async (ruleData: typeof newRule) => {
      const response = await apiRequest("POST", "/api/clinical-rules/rules", {
        domain: ruleData.domain,
        name: ruleData.name,
        description: ruleData.description,
        taskDefinition: {
          title: ruleData.name,
          titleTemplate: `${ruleData.name} Due`,
          description: ruleData.description,
          descriptionTemplate: ruleData.description,
          category: ruleData.category,
          defaultPriority: ruleData.priority,
          requiresProvider: true
        },
        cadence: {
          type: "recurring",
          intervalMonths: ruleData.intervalMonths,
          gracePeriodDays: ruleData.gracePeriodDays,
          overdueThresholdDays: ruleData.overdueThresholdDays
        }
      });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Rule created successfully" });
      setIsCreateDialogOpen(false);
      setNewRule({
        domain: "",
        name: "",
        description: "",
        category: "screening",
        priority: "medium",
        intervalMonths: 12,
        gracePeriodDays: 14,
        overdueThresholdDays: 30
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-rules/rules"] });
    },
    onError: () => {
      toast({ title: "Failed to create rule", variant: "destructive" });
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: Partial<RuleTemplate> }) => {
      const response = await apiRequest("PATCH", `/api/clinical-rules/rules/${ruleId}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Rule updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-rules/rules"] });
    },
    onError: () => {
      toast({ title: "Failed to update rule", variant: "destructive" });
    }
  });

  const [simulationResults, setSimulationResults] = useState<{
    tasks: GeneratedTask[];
    blockedTasks: { ruleId: string; reason: string; guardrail: string }[];
    warnings: { ruleId: string; message: string }[];
  } | null>(null);

  const simulateTasksMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/clinical-rules/generate-tasks", {
        patientContext: {
          patientId: simulationContext.patientId,
          profileId: simulationContext.profileId,
          dateOfBirth: new Date(Date.now() - simulationContext.ageYears * 365.25 * 24 * 60 * 60 * 1000).toISOString(),
          ageMonths: simulationContext.ageYears * 12,
          ageYears: simulationContext.ageYears,
          conditions: simulationContext.conditions,
          medications: simulationContext.medications,
          allergies: simulationContext.allergies,
          riskFlags: [],
          labResults: [],
          procedures: [],
          immunizations: [],
          familyHistory: [],
          isPregnant: false,
          populationView: simulationContext.populationView
        }
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      setSimulationResults(data);
      toast({ title: `Generated ${data.tasks?.length || 0} tasks` });
    },
    onError: () => {
      toast({ title: "Failed to generate tasks", variant: "destructive" });
    }
  });

  const filteredRules = rulesData?.rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const rulesByDomain = filteredRules.reduce((acc, rule) => {
    if (!acc[rule.domain]) acc[rule.domain] = [];
    acc[rule.domain].push(rule);
    return acc;
  }, {} as Record<string, RuleTemplate[]>);

  const isLoading = metadataLoading || rulesLoading || domainsLoading || populationsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Clinical Rule Engine</h1>
          <p className="text-muted-foreground">Manage clinical rules for diabetes, vaccines, cancer, and more</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            onClick={() => refetchRules()}
            data-testid="button-refresh-rules"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isSimulateDialogOpen} onOpenChange={setIsSimulateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-simulate-tasks">
                <Play className="w-4 h-4 mr-2" />
                Simulate Tasks
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Simulate Task Generation</DialogTitle>
                <DialogDescription>
                  Test how rules would generate tasks for a sample patient
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-patient-age-years">Patient Age (Years)</Label>
                    <Input id="clinical-rule-engine-patient-age-years" 
                      type="number" 
                      value={simulationContext.ageYears}
                      onChange={(e) => setSimulationContext({ ...simulationContext, ageYears: parseInt(e.target.value) || 0 })}
                      data-testid="input-simulation-age"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-population-view">Population View</Label>
                    <Select 
                      value={simulationContext.populationView}
                      onValueChange={(value) => setSimulationContext({ ...simulationContext, populationView: value })}
                    >
                      <SelectTrigger id="clinical-rule-engine-population-view" data-testid="select-population-view">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="pediatric">Pediatric</SelectItem>
                        <SelectItem value="geriatric">Geriatric</SelectItem>
                        <SelectItem value="caregiver">Caregiver</SelectItem>
                        <SelectItem value="oncology">Oncology</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical-rule-engine-conditions-comma-separated">Conditions (comma-separated)</Label>
                  <Input id="clinical-rule-engine-conditions-comma-separated" 
                    value={simulationContext.conditions.join(", ")}
                    onChange={(e) => setSimulationContext({ 
                      ...simulationContext, 
                      conditions: e.target.value.split(",").map(c => c.trim()).filter(Boolean) 
                    })}
                    placeholder="e.g., diabetes, hypertension"
                    data-testid="input-simulation-conditions"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical-rule-engine-medications-comma-separated">Medications (comma-separated)</Label>
                  <Input id="clinical-rule-engine-medications-comma-separated" 
                    value={simulationContext.medications.join(", ")}
                    onChange={(e) => setSimulationContext({ 
                      ...simulationContext, 
                      medications: e.target.value.split(",").map(m => m.trim()).filter(Boolean) 
                    })}
                    placeholder="e.g., metformin, lisinopril"
                    data-testid="input-simulation-medications"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical-rule-engine-allergies-comma-separated">Allergies (comma-separated)</Label>
                  <Input id="clinical-rule-engine-allergies-comma-separated" 
                    value={simulationContext.allergies.join(", ")}
                    onChange={(e) => setSimulationContext({ 
                      ...simulationContext, 
                      allergies: e.target.value.split(",").map(a => a.trim()).filter(Boolean) 
                    })}
                    placeholder="e.g., penicillin, egg"
                    data-testid="input-simulation-allergies"
                  />
                </div>

                {simulationResults && (
                  <div className="mt-4 space-y-4">
                    <Separator />
                    <h4 className="font-semibold">Simulation Results</h4>
                    
                    {simulationResults.tasks.length > 0 && (
                      <div className="space-y-2">
                        <FieldCaption className="text-green-600 dark:text-green-400">Generated Tasks ({simulationResults.tasks.length})</FieldCaption>
                        <ScrollArea className="h-40 rounded border p-2">
                          {simulationResults.tasks.map((task) => (
                            <div key={task.id} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="text-sm text-muted-foreground">{task.domain}</p>
                              </div>
                              <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    )}

                    {simulationResults.warnings.length > 0 && (
                      <div className="space-y-2">
                        <FieldCaption className="text-yellow-600 dark:text-yellow-400">Warnings ({simulationResults.warnings.length})</FieldCaption>
                        {simulationResults.warnings.map((warn, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                            <AlertTriangle className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm">{warn.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {simulationResults.blockedTasks.length > 0 && (
                      <div className="space-y-2">
                        <FieldCaption className="text-red-600 dark:text-red-400">Blocked Tasks ({simulationResults.blockedTasks.length})</FieldCaption>
                        {simulationResults.blockedTasks.map((blocked, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                            <Shield className="w-4 h-4 text-red-600" />
                            <span className="text-sm">{blocked.reason} (Guardrail: {blocked.guardrail})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Close</Button>
                </DialogClose>
                <Button 
                  onClick={() => simulateTasksMutation.mutate()}
                  disabled={simulateTasksMutation.isPending}
                  data-testid="button-run-simulation"
                >
                  {simulateTasksMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Run Simulation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-rule">
                <Plus className="w-4 h-4 mr-2" />
                Create Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Rule Template</DialogTitle>
                <DialogDescription>
                  Define a new clinical rule for task generation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-domain">Domain</Label>
                    <Select 
                      value={newRule.domain}
                      onValueChange={(value) => setNewRule({ ...newRule, domain: value })}
                    >
                      <SelectTrigger id="clinical-rule-engine-domain" data-testid="select-new-rule-domain">
                        <SelectValue placeholder="Select domain" />
                      </SelectTrigger>
                      <SelectContent>
                        {domainsData?.domains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-category">Category</Label>
                    <Select 
                      value={newRule.category}
                      onValueChange={(value) => setNewRule({ ...newRule, category: value })}
                    >
                      <SelectTrigger id="clinical-rule-engine-category" data-testid="select-new-rule-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="screening">Screening</SelectItem>
                        <SelectItem value="lab">Lab Test</SelectItem>
                        <SelectItem value="appointment">Appointment</SelectItem>
                        <SelectItem value="vaccination">Vaccination</SelectItem>
                        <SelectItem value="self_care">Self Care</SelectItem>
                        <SelectItem value="medication">Medication</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="followup">Follow-up</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical-rule-engine-rule-name">Rule Name</Label>
                  <Input id="clinical-rule-engine-rule-name" 
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Annual Eye Exam"
                    data-testid="input-new-rule-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinical-rule-engine-description">Description</Label>
                  <Textarea id="clinical-rule-engine-description" 
                    value={newRule.description}
                    onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                    placeholder="Describe when and why this task should be generated..."
                    data-testid="input-new-rule-description"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-priority">Priority</Label>
                    <Select 
                      value={newRule.priority}
                      onValueChange={(value) => setNewRule({ ...newRule, priority: value })}
                    >
                      <SelectTrigger id="clinical-rule-engine-priority" data-testid="select-new-rule-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-interval-months">Interval (Months)</Label>
                    <Input id="clinical-rule-engine-interval-months" 
                      type="number"
                      value={newRule.intervalMonths}
                      onChange={(e) => setNewRule({ ...newRule, intervalMonths: parseInt(e.target.value) || 0 })}
                      data-testid="input-new-rule-interval"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinical-rule-engine-grace-period-days">Grace Period (Days)</Label>
                    <Input id="clinical-rule-engine-grace-period-days" 
                      type="number"
                      value={newRule.gracePeriodDays}
                      onChange={(e) => setNewRule({ ...newRule, gracePeriodDays: parseInt(e.target.value) || 0 })}
                      data-testid="input-new-rule-grace"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button 
                  onClick={() => createRuleMutation.mutate(newRule)}
                  disabled={createRuleMutation.isPending || !newRule.domain || !newRule.name}
                  data-testid="button-submit-create-rule"
                >
                  {createRuleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {metadata && (
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Zap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold">Engine Version {metadata.engineVersion}</p>
                  <p className="text-sm text-muted-foreground">
                    {metadata.supportedDomains} domains, {metadata.supportedPopulations} population views
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {metadata.noCdsCompliance && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    NO-CDS Compliant
                  </Badge>
                )}
                <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300 border-purple-200">
                  <Shield className="w-3 h-3 mr-1" />
                  HIPAA Audit Logging
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
          <TabsTrigger value="domains" data-testid="tab-domains">Domains</TabsTrigger>
          <TabsTrigger value="citations" data-testid="tab-citations">Citations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-rules">{rulesData?.count || 0}</div>
                <p className="text-xs text-muted-foreground">Active rule templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Domains</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-domains">{domainsData?.domains.length || 0}</div>
                <p className="text-xs text-muted-foreground">Clinical categories</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Populations</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-populations">{populationsData?.populations.length || 0}</div>
                <p className="text-xs text-muted-foreground">View adaptations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium">Citations</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-citations">{citationsData?.count || 0}</div>
                <p className="text-xs text-muted-foreground">Reference sources</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Rules by Domain</CardTitle>
                <CardDescription>Distribution of clinical rules across care domains</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(rulesByDomain).map(([domain, rules]) => {
                    const Icon = domainIcons[domain] || Activity;
                    return (
                      <div key={domain} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded ${domainColors[domain]?.split(' ')[0] || 'bg-gray-100'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <span className="font-medium capitalize">{domain.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge variant="secondary">{rules.length}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Population Adaptations</CardTitle>
                <CardDescription>Customized experiences for different patient groups</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {populationsData?.populations.map((pop) => (
                    <div key={pop.id} className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{pop.name}</span>
                        <Badge variant="outline">{pop.id}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{pop.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {pop.features.map((feature, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">{feature}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Rule Templates</CardTitle>
                  <CardDescription>Manage clinical rule definitions</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search rules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                      data-testid="input-search-rules"
                    />
                  </div>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="w-48" data-testid="select-filter-domain">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="All domains" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Domains</SelectItem>
                      {domainsData?.domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>{domain.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No rules found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRules.map((rule) => {
                    const Icon = domainIcons[rule.domain] || Activity;
                    return (
                      <Card key={rule.id} className="hover-elevate cursor-pointer" data-testid={`rule-card-${rule.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 rounded-lg ${domainColors[rule.domain]?.split(' ')[0] || 'bg-gray-100'}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold">{rule.name}</h3>
                                  <Badge className={domainColors[rule.domain]}>{rule.domain.replace(/_/g, ' ')}</Badge>
                                  <Badge className={statusColors[rule.version.approvalStatus]}>{rule.version.approvalStatus}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{rule.description}</p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {rule.cadence.intervalMonths ? `Every ${rule.cadence.intervalMonths} months` : 'One-time'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" />
                                    {rule.citations.length} citations
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Shield className="w-3 h-3" />
                                    {rule.guardrails.length} guardrails
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    {rule.populationAdaptations.length} adaptations
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={rule.isActive}
                                onCheckedChange={(checked) => {
                                  updateRuleMutation.mutate({ ruleId: rule.id, updates: { isActive: checked } });
                                }}
                                data-testid={`switch-rule-active-${rule.id}`}
                              />
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => setSelectedRule(rule)}
                                    data-testid={`button-view-rule-${rule.id}`}
                                  >
                                    <ChevronRight className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle className="flex items-center gap-2">
                                      <Icon className="w-5 h-5" />
                                      {rule.name}
                                    </DialogTitle>
                                    <DialogDescription>{rule.description}</DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-6 py-4">
                                    <div className="flex flex-wrap gap-2">
                                      <Badge className={domainColors[rule.domain]}>{rule.domain.replace(/_/g, ' ')}</Badge>
                                      <Badge className={statusColors[rule.version.approvalStatus]}>{rule.version.approvalStatus}</Badge>
                                      <Badge className={priorityColors[rule.taskDefinition.defaultPriority]}>{rule.taskDefinition.defaultPriority}</Badge>
                                      <Badge variant="outline">v{rule.version.version}</Badge>
                                    </div>

                                    <Accordion type="multiple" className="w-full" defaultValue={["task", "eligibility"]}>
                                      <AccordionItem value="task">
                                        <AccordionTrigger>
                                          <div className="flex items-center gap-2">
                                            <Stethoscope className="w-4 h-4" />
                                            Task Definition
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                                            <div>
                                              <FieldCaption className="text-xs text-muted-foreground">Title</FieldCaption>
                                              <p className="font-medium">{rule.taskDefinition.title}</p>
                                            </div>
                                            <div>
                                              <FieldCaption className="text-xs text-muted-foreground">Category</FieldCaption>
                                              <p className="font-medium capitalize">{rule.taskDefinition.category}</p>
                                            </div>
                                            <div className="col-span-2">
                                              <FieldCaption className="text-xs text-muted-foreground">Description</FieldCaption>
                                              <p className="text-sm">{rule.taskDefinition.description}</p>
                                            </div>
                                            {rule.taskDefinition.estimatedDurationMinutes && (
                                              <div>
                                                <FieldCaption className="text-xs text-muted-foreground">Duration</FieldCaption>
                                                <p className="font-medium">{rule.taskDefinition.estimatedDurationMinutes} minutes</p>
                                              </div>
                                            )}
                                            {rule.taskDefinition.providerTypes && (
                                              <div>
                                                <FieldCaption className="text-xs text-muted-foreground">Provider Types</FieldCaption>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  {rule.taskDefinition.providerTypes.map((type, idx) => (
                                                    <Badge key={idx} variant="secondary" className="text-xs">{type}</Badge>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>

                                      <AccordionItem value="eligibility">
                                        <AccordionTrigger>
                                          <div className="flex items-center gap-2">
                                            <Target className="w-4 h-4" />
                                            Eligibility Criteria ({rule.eligibilityCriteria.length})
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          <div className="space-y-2">
                                            {rule.eligibilityCriteria.map((criterion) => (
                                              <div key={criterion.id} className="p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-medium">{criterion.description}</span>
                                                  {criterion.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                  {criterion.field} {criterion.operator} {JSON.stringify(criterion.value)}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>

                                      <AccordionItem value="guardrails">
                                        <AccordionTrigger>
                                          <div className="flex items-center gap-2">
                                            <Shield className="w-4 h-4" />
                                            Guardrails ({rule.guardrails.length})
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          {rule.guardrails.length === 0 ? (
                                            <p className="text-muted-foreground text-sm py-2">No guardrails configured</p>
                                          ) : (
                                            <div className="space-y-2">
                                              {rule.guardrails.map((guardrail) => (
                                                <div key={guardrail.id} className="p-3 bg-muted/30 rounded-lg">
                                                  <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium">{guardrail.name}</span>
                                                    <Badge className={actionColors[guardrail.action]}>{guardrail.action}</Badge>
                                                  </div>
                                                  <p className="text-sm text-muted-foreground mb-2">{guardrail.description}</p>
                                                  <p className="text-xs bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                                                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                                                    {guardrail.message}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </AccordionContent>
                                      </AccordionItem>

                                      <AccordionItem value="citations">
                                        <AccordionTrigger>
                                          <div className="flex items-center gap-2">
                                            <BookOpen className="w-4 h-4" />
                                            Citations ({rule.citations.length})
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          <div className="space-y-2">
                                            {rule.citations.map((citation) => (
                                              <div key={citation.id} className="p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-medium">{citation.documentTitle}</span>
                                                  <Badge variant="outline">{citation.source}</Badge>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                                  <span>Published: {new Date(citation.publicationDate).toLocaleDateString()}</span>
                                                  <span>Effective: {new Date(citation.effectiveDate).toLocaleDateString()}</span>
                                                </div>
                                                {citation.url && (
                                                  <a 
                                                    href={citation.url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                                                  >
                                                    View Source <ExternalLink className="w-3 h-3" />
                                                  </a>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>

                                      <AccordionItem value="populations">
                                        <AccordionTrigger>
                                          <div className="flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            Population Adaptations ({rule.populationAdaptations.length})
                                          </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                          <div className="space-y-2">
                                            {rule.populationAdaptations.map((adaptation, idx) => (
                                              <div key={idx} className="p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="font-medium capitalize">{adaptation.population}</span>
                                                  <div className="flex gap-1">
                                                    {adaptation.simplifiedView && <Badge variant="secondary" className="text-xs">Simplified</Badge>}
                                                    {adaptation.largeText && <Badge variant="secondary" className="text-xs">Large Text</Badge>}
                                                    {adaptation.voiceEnabled && <Badge variant="secondary" className="text-xs">Voice</Badge>}
                                                  </div>
                                                </div>
                                                {adaptation.titleOverride && (
                                                  <p className="text-sm"><strong>Title:</strong> {adaptation.titleOverride}</p>
                                                )}
                                                {adaptation.descriptionOverride && (
                                                  <p className="text-sm text-muted-foreground">{adaptation.descriptionOverride}</p>
                                                )}
                                                {adaptation.additionalInstructions && (
                                                  <p className="text-xs mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                                                    <Info className="w-3 h-3 inline mr-1" />
                                                    {adaptation.additionalInstructions}
                                                  </p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </AccordionContent>
                                      </AccordionItem>
                                    </Accordion>
                                  </div>
                                </DialogContent>
                              </Dialog>
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

        <TabsContent value="domains" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domainsData?.domains.map((domain) => {
              const Icon = domainIcons[domain.id] || Activity;
              const rulesInDomain = rulesData?.rules.filter(r => r.domain === domain.id) || [];
              return (
                <Card key={domain.id} data-testid={`domain-card-${domain.id}`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${domainColors[domain.id]?.split(' ')[0] || 'bg-gray-100'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{domain.name}</CardTitle>
                        <CardDescription>{domain.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{rulesInDomain.length} rules</span>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setSelectedDomain(domain.id);
                          setActiveTab("rules");
                        }}
                        data-testid={`button-view-domain-rules-${domain.id}`}
                      >
                        View Rules
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="citations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Clinical Citations & References</CardTitle>
              <CardDescription>Authoritative sources backing rule definitions</CardDescription>
            </CardHeader>
            <CardContent>
              {citationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {citationsData?.citations.map((citation) => (
                    <Card key={citation.id} data-testid={`citation-card-${citation.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                {citation.source}
                              </Badge>
                              {citation.version && <Badge variant="secondary">v{citation.version}</Badge>}
                            </div>
                            <h3 className="font-semibold">{citation.documentTitle}</h3>
                            {citation.section && (
                              <p className="text-sm text-muted-foreground">Section: {citation.section}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Published: {new Date(citation.publicationDate).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Effective: {new Date(citation.effectiveDate).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          {citation.url && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={citation.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View Source
                              </a>
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">NO-CDS Compliance Notice</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                This Clinical Rule Engine is for educational and tracking purposes only. It does NOT constitute medical advice 
                and should NOT replace professional medical consultation. All generated tasks include mandatory NO-CDS disclaimers.
                HIPAA-compliant audit logging is enabled for all operations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
