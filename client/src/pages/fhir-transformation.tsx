import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowRight, Play, Sparkles, Plus, Check, AlertTriangle, X, RefreshCw, Settings, Zap, Database, FileCode, GitBranch, Target, Layers, Wand2 } from "lucide-react";

interface TransformationRule {
  id: string;
  name: string;
  description: string;
  sourceResourceType: string;
  targetResourceType: string;
  transformationType: string;
  sourcePath: string;
  targetPath: string;
  sourceDataType: string;
  targetDataType: string;
  transformationLogic: string;
  condition?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  tags: string[];
}

interface TransformationMapping {
  id: string;
  name: string;
  description: string;
  sourceSchema: string;
  targetSchema: string;
  rules: string[];
  version: string;
  isActive: boolean;
  executionCount: number;
  successRate: number;
  averageExecutionTimeMs: number;
  tags: string[];
}

interface TargetDataModel {
  id: string;
  name: string;
  description: string;
  requiredFields: string[];
  optionalFields: string[];
}

interface TransformationSuggestion {
  id: string;
  sourceField: string;
  targetField: string;
  suggestedTransformationType: string;
  suggestedLogic: string;
  confidence: number;
  reasoning: string;
  dataTypeCompatibility: {
    isCompatible: boolean;
    conversionRequired: boolean;
    lossyConversion: boolean;
    notes: string;
  };
  complexityScore: number;
  estimatedPerformanceImpact: string;
}

interface TransformationStats {
  totalRules: number;
  activeRules: number;
  totalMappings: number;
  activeMappings: number;
  totalExecutions: number;
  successfulExecutions: number;
  averageExecutionTimeMs: number;
  rulesByType: Record<string, number>;
  topMappings: Array<{ id: string; name: string; executionCount: number; successRate: number }>;
}

const transformationTypes = [
  { value: "field_mapping", label: "Field Mapping" },
  { value: "type_conversion", label: "Type Conversion" },
  { value: "value_normalization", label: "Value Normalization" },
  { value: "structure_flattening", label: "Structure Flattening" },
  { value: "structure_nesting", label: "Structure Nesting" },
  { value: "code_system_mapping", label: "Code System Mapping" },
  { value: "date_format", label: "Date Format" },
  { value: "unit_conversion", label: "Unit Conversion" },
  { value: "conditional", label: "Conditional" },
  { value: "aggregate", label: "Aggregate" },
  { value: "split", label: "Split" },
  { value: "merge", label: "Merge" },
];

const dataTypes = [
  "string", "integer", "decimal", "boolean", "date", "dateTime", "time",
  "uri", "code", "id", "reference", "coding", "codeableConcept", "quantity",
  "period", "address", "humanName", "contactPoint", "identifier"
];

function StatsCard({ title, value, subtitle, icon: Icon }: { 
  title: string; 
  value: string | number; 
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function RulesTab() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    sourceResourceType: "Patient",
    targetResourceType: "FlatPatient",
    transformationType: "field_mapping",
    sourcePath: "",
    targetPath: "",
    sourceDataType: "string",
    targetDataType: "string",
    transformationLogic: "value",
    priority: 1,
    isActive: true,
    createdBy: "user",
    tags: [] as string[],
  });

  const { data: rulesData, isLoading } = useQuery<{ rules: TransformationRule[] }>({
    queryKey: ["/api/fhir-transformation/rules"],
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: typeof newRule) => {
      const res = await apiRequest("POST", "/api/fhir-transformation/rules", rule);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-transformation/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-transformation/stats"] });
      toast({ title: "Transformation rule created" });
      setShowCreateDialog(false);
      setNewRule({
        name: "",
        description: "",
        sourceResourceType: "Patient",
        targetResourceType: "FlatPatient",
        transformationType: "field_mapping",
        sourcePath: "",
        targetPath: "",
        sourceDataType: "string",
        targetDataType: "string",
        transformationLogic: "value",
        priority: 1,
        isActive: true,
        createdBy: "user",
        tags: [],
      });
    },
    onError: () => {
      toast({ title: "Failed to create rule", variant: "destructive" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/fhir-transformation/rules/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-transformation/rules"] });
      toast({ title: "Rule status updated" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rules = rulesData?.rules || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Transformation Rules</h3>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-rule">
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Transformation Rule</DialogTitle>
              <DialogDescription>
                Define a new rule for transforming FHIR resources.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    data-testid="input-rule-name"
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="Patient Name Flattening"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transformationType">Transformation Type</Label>
                  <Select
                    value={newRule.transformationType}
                    onValueChange={(v) => setNewRule({ ...newRule, transformationType: v })}
                  >
                    <SelectTrigger data-testid="select-transformation-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transformationTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  data-testid="input-rule-description"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Describe what this rule does..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Resource Type</Label>
                  <Input
                    data-testid="input-source-resource"
                    value={newRule.sourceResourceType}
                    onChange={(e) => setNewRule({ ...newRule, sourceResourceType: e.target.value })}
                    placeholder="Patient"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Resource Type</Label>
                  <Input
                    data-testid="input-target-resource"
                    value={newRule.targetResourceType}
                    onChange={(e) => setNewRule({ ...newRule, targetResourceType: e.target.value })}
                    placeholder="FlatPatient"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Path</Label>
                  <Input
                    data-testid="input-source-path"
                    value={newRule.sourcePath}
                    onChange={(e) => setNewRule({ ...newRule, sourcePath: e.target.value })}
                    placeholder="name[0].family"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Path</Label>
                  <Input
                    data-testid="input-target-path"
                    value={newRule.targetPath}
                    onChange={(e) => setNewRule({ ...newRule, targetPath: e.target.value })}
                    placeholder="lastName"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source Data Type</Label>
                  <Select
                    value={newRule.sourceDataType}
                    onValueChange={(v) => setNewRule({ ...newRule, sourceDataType: v })}
                  >
                    <SelectTrigger data-testid="select-source-data-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Target Data Type</Label>
                  <Select
                    value={newRule.targetDataType}
                    onValueChange={(v) => setNewRule({ ...newRule, targetDataType: v })}
                  >
                    <SelectTrigger data-testid="select-target-data-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dataTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Transformation Logic</Label>
                <Textarea
                  data-testid="input-transformation-logic"
                  value={newRule.transformationLogic}
                  onChange={(e) => setNewRule({ ...newRule, transformationLogic: e.target.value })}
                  placeholder="value"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={newRule.isActive}
                  onCheckedChange={(c) => setNewRule({ ...newRule, isActive: c })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button 
                data-testid="button-submit-rule"
                onClick={() => createRuleMutation.mutate(newRule)}
                disabled={!newRule.name || !newRule.sourcePath || !newRule.targetPath || createRuleMutation.isPending}
              >
                {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id} data-testid={`row-rule-${rule.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {rule.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {transformationTypes.find(t => t.value === rule.transformationType)?.label || rule.transformationType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{rule.sourceResourceType}</div>
                      <code className="text-xs text-muted-foreground">{rule.sourcePath}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{rule.targetResourceType}</div>
                      <code className="text-xs text-muted-foreground">{rule.targetPath}</code>
                    </div>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "secondary"}>
                      {rule.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, isActive: checked })}
                      data-testid={`switch-rule-${rule.id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No transformation rules defined
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}

function MappingsTab() {
  const { toast } = useToast();
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [testInput, setTestInput] = useState('{\n  "resourceType": "Patient",\n  "id": "123",\n  "name": [{ "family": "Smith", "given": ["John"] }],\n  "birthDate": "1990-01-15",\n  "gender": "male"\n}');
  const [testOutput, setTestOutput] = useState<any>(null);

  const { data: mappingsData, isLoading } = useQuery<{ mappings: TransformationMapping[] }>({
    queryKey: ["/api/fhir-transformation/mappings"],
  });

  const { data: rulesData } = useQuery<{ rules: TransformationRule[] }>({
    queryKey: ["/api/fhir-transformation/rules"],
  });

  const executeMutation = useMutation({
    mutationFn: async ({ mappingId, inputResource }: { mappingId: string; inputResource: Record<string, unknown> }) => {
      const res = await apiRequest("POST", "/api/fhir-transformation/execute", { mappingId, inputResource });
      return res.json();
    },
    onSuccess: (data) => {
      setTestOutput(data.execution);
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-transformation/stats"] });
      toast({ title: data.execution.success ? "Transformation successful" : "Transformation completed with errors" });
    },
    onError: () => {
      toast({ title: "Transformation failed", variant: "destructive" });
    },
  });

  const handleTest = () => {
    if (!selectedMapping) return;
    try {
      const parsed = JSON.parse(testInput);
      executeMutation.mutate({ mappingId: selectedMapping, inputResource: parsed });
    } catch {
      toast({ title: "Invalid JSON input", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const mappings = mappingsData?.mappings || [];
  const rules = rulesData?.rules || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold">Transformation Mappings</h3>
      </div>

      <div className="grid gap-4">
        {mappings.map((mapping) => (
          <Card key={mapping.id} data-testid={`card-mapping-${mapping.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{mapping.name}</CardTitle>
                  <Badge variant={mapping.isActive ? "default" : "secondary"}>
                    {mapping.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">v{mapping.version}</Badge>
                </div>
                <Dialog open={testDialogOpen && selectedMapping === mapping.id} onOpenChange={(open) => {
                  setTestDialogOpen(open);
                  if (open) setSelectedMapping(mapping.id);
                  else setTestOutput(null);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid={`button-test-mapping-${mapping.id}`}>
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Test Transformation: {mapping.name}</DialogTitle>
                      <DialogDescription>
                        Provide a sample FHIR resource to test the transformation.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Input Resource (JSON)</Label>
                        <Textarea
                          data-testid="input-test-resource"
                          value={testInput}
                          onChange={(e) => setTestInput(e.target.value)}
                          className="font-mono text-sm h-[300px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Output</Label>
                        <div className="bg-muted rounded-md p-4 h-[300px] overflow-auto">
                          {testOutput ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                {testOutput.success ? (
                                  <Badge className="bg-green-600"><Check className="h-3 w-3 mr-1" /> Success</Badge>
                                ) : (
                                  <Badge variant="destructive"><X className="h-3 w-3 mr-1" /> Errors</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {testOutput.executionTimeMs}ms
                                </span>
                              </div>
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {JSON.stringify(testOutput.outputResource, null, 2)}
                              </pre>
                              {testOutput.errors.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-sm font-medium text-destructive">Errors:</div>
                                  {testOutput.errors.map((err: any, i: number) => (
                                    <div key={i} className="text-xs text-destructive">{err.error}</div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-muted-foreground text-sm">
                              Click "Run Test" to see the transformation output
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Close</Button>
                      <Button 
                        data-testid="button-run-test"
                        onClick={handleTest}
                        disabled={executeMutation.isPending}
                      >
                        {executeMutation.isPending ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        Run Test
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>{mapping.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Source</div>
                  <div className="font-medium flex items-center gap-1">
                    <Database className="h-4 w-4" />
                    {mapping.sourceSchema}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Target</div>
                  <div className="font-medium flex items-center gap-1">
                    <Target className="h-4 w-4" />
                    {mapping.targetSchema}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Executions</div>
                  <div className="font-medium">{mapping.executionCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Success Rate</div>
                  <div className="font-medium text-green-600">{mapping.successRate}%</div>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">Rules ({mapping.rules.length})</div>
                <div className="flex flex-wrap gap-2">
                  {mapping.rules.map((ruleId) => {
                    const rule = rules.find(r => r.id === ruleId);
                    return (
                      <Badge key={ruleId} variant="outline" className="text-xs">
                        {rule?.name || ruleId}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {mappings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No transformation mappings defined
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SuggestionsTab() {
  const { toast } = useToast();
  const [sampleResource, setSampleResource] = useState('{\n  "resourceType": "Patient",\n  "id": "example-123",\n  "name": [{ "family": "Johnson", "given": ["Alice", "Marie"] }],\n  "birthDate": "1985-06-20",\n  "gender": "female",\n  "telecom": [{ "system": "phone", "value": "555-1234" }],\n  "address": [{ "city": "Boston", "state": "MA" }]\n}');
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [suggestions, setSuggestions] = useState<TransformationSuggestion[]>([]);

  const { data: modelsData, isLoading: modelsLoading } = useQuery<{ models: TargetDataModel[] }>({
    queryKey: ["/api/fhir-transformation/target-models"],
  });

  const suggestMutation = useMutation({
    mutationFn: async ({ sourceResource, targetModelId }: { sourceResource: Record<string, unknown>; targetModelId: string }) => {
      const res = await apiRequest("POST", "/api/fhir-transformation/suggest", { sourceResource, targetModelId });
      return res.json();
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      toast({ title: `Generated ${data.suggestions?.length || 0} suggestions` });
    },
    onError: () => {
      toast({ title: "Failed to generate suggestions", variant: "destructive" });
    },
  });

  const handleGenerateSuggestions = () => {
    if (!selectedModel) {
      toast({ title: "Please select a target model", variant: "destructive" });
      return;
    }
    try {
      const parsed = JSON.parse(sampleResource);
      suggestMutation.mutate({ sourceResource: parsed, targetModelId: selectedModel });
    } catch {
      toast({ title: "Invalid JSON input", variant: "destructive" });
    }
  };

  const models = modelsData?.models || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Transformation Suggestions
          </CardTitle>
          <CardDescription>
            Provide a sample FHIR resource and target model to get AI-powered transformation recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sample FHIR Resource</Label>
              <Textarea
                data-testid="input-sample-resource"
                value={sampleResource}
                onChange={(e) => setSampleResource(e.target.value)}
                className="font-mono text-sm h-[200px]"
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Target Data Model</Label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger data-testid="select-target-model">
                    <SelectValue placeholder="Select target model..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedModel && (
                <div className="bg-muted rounded-md p-3">
                  <div className="text-sm font-medium mb-2">
                    {models.find(m => m.id === selectedModel)?.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {models.find(m => m.id === selectedModel)?.description}
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-muted-foreground">Required fields:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {models.find(m => m.id === selectedModel)?.requiredFields.map((f) => (
                        <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <Button
                data-testid="button-generate-suggestions"
                className="w-full"
                onClick={handleGenerateSuggestions}
                disabled={suggestMutation.isPending || !selectedModel}
              >
                {suggestMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate AI Suggestions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Suggested Transformations</CardTitle>
            <CardDescription>
              AI-generated mapping suggestions based on your source resource and target model.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <Card key={suggestion.id || idx} className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <code className="text-sm bg-background px-2 py-1 rounded">
                            {suggestion.sourceField}
                          </code>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <code className="text-sm bg-background px-2 py-1 rounded">
                            {suggestion.targetField}
                          </code>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">
                            {transformationTypes.find(t => t.value === suggestion.suggestedTransformationType)?.label || suggestion.suggestedTransformationType}
                          </Badge>
                          <Badge 
                            variant={suggestion.confidence > 0.7 ? "default" : suggestion.confidence > 0.4 ? "secondary" : "outline"}
                          >
                            {Math.round(suggestion.confidence * 100)}% confidence
                          </Badge>
                          {suggestion.dataTypeCompatibility.conversionRequired && (
                            <Badge variant="outline" className="text-yellow-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Conversion needed
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{suggestion.reasoning}</p>
                        <div className="mt-2">
                          <code className="text-xs bg-background px-2 py-1 rounded block">
                            {suggestion.suggestedLogic}
                          </code>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Complexity</div>
                        <div className="font-medium">{suggestion.complexityScore}/10</div>
                        <div className="text-xs text-muted-foreground mt-1">Performance</div>
                        <Badge variant="outline">
                          {suggestion.estimatedPerformanceImpact}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground">
                These are AI-generated suggestions for data transformation only. Not for clinical decision-making.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FhirTransformation() {
  const { data: statsData, isLoading: statsLoading } = useQuery<TransformationStats>({
    queryKey: ["/api/fhir-transformation/stats"],
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            FHIR Resource Transformation
          </h1>
          <p className="text-muted-foreground">
            AI-driven transformation rules and mappings for FHIR data integration
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <StatsCard
              title="Active Rules"
              value={statsData?.activeRules || 0}
              subtitle={`of ${statsData?.totalRules || 0} total`}
              icon={FileCode}
            />
            <StatsCard
              title="Active Mappings"
              value={statsData?.activeMappings || 0}
              subtitle={`of ${statsData?.totalMappings || 0} total`}
              icon={Layers}
            />
            <StatsCard
              title="Total Executions"
              value={statsData?.totalExecutions || 0}
              subtitle={`${statsData?.successfulExecutions || 0} successful`}
              icon={Zap}
            />
            <StatsCard
              title="Avg Execution Time"
              value={`${statsData?.averageExecutionTimeMs || 0}ms`}
              subtitle="Per transformation"
              icon={Settings}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <FileCode className="h-4 w-4 mr-2" />
            Rules
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <Layers className="h-4 w-4 mr-2" />
            Mappings
          </TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Suggestions
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="mt-4">
          <RulesTab />
        </TabsContent>
        <TabsContent value="mappings" className="mt-4">
          <MappingsTab />
        </TabsContent>
        <TabsContent value="suggestions" className="mt-4">
          <SuggestionsTab />
        </TabsContent>
      </Tabs>

      <div className="p-3 bg-muted rounded-md">
        <p className="text-xs text-muted-foreground text-center">
          Data transformation features are for technical data mapping only. Not for clinical decision-making.
        </p>
      </div>
    </div>
  );
}
