import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import { 
  ArrowRight,
  ArrowLeftRight,
  Plus,
  Trash2,
  Edit,
  Copy,
  Play,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  Settings,
  Layers,
  Code,
  Database,
  RefreshCw,
  Shield,
  Zap,
  Target,
  GitMerge,
  FileJson,
  Server,
  Link2,
  Loader2,
  Info,
  Eye,
  Save,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  dataType: string;
  required: boolean;
  transformation?: {
    type: string;
    params: Record<string, any>;
  };
  defaultValue?: any;
}

interface CustomMapping {
  id: string;
  name: string;
  description: string;
  version: string;
  fhirVersion: "R4" | "R5";
  sourceEntityType: string;
  targetResourceType: string;
  targetProfile?: string;
  fieldMappings: FieldMapping[];
  extensionMappings: any[];
  nestedMappings: any[];
  validationRules: ValidationRule[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ValidationRule {
  id: string;
  field: string;
  rule: string;
  params?: Record<string, any>;
  errorMessage: string;
}

interface ValidationResult {
  valid: boolean;
  mappingId: string;
  errors: Array<{ field: string; message: string; severity: string }>;
  warnings: Array<{ field: string; message: string }>;
  score: number;
}

interface FHIRConnection {
  id: string;
  name: string;
  baseUrl: string;
  fhirVersion: "R4" | "R5" | "STU3";
  status: string;
}

const RESOURCE_TYPES = [
  "Patient", "Observation", "Condition", "MedicationRequest", "Procedure",
  "Encounter", "AllergyIntolerance", "Immunization", "DiagnosticReport", "CarePlan"
];

const LOCAL_ENTITY_TYPES = [
  "patient", "vital_sign", "diagnosis", "medication", "allergy",
  "procedure", "immunization", "lab_result", "care_plan", "goal"
];

const TRANSFORMATION_TYPES = [
  { value: "direct", label: "Direct Copy" },
  { value: "concat", label: "Concatenate" },
  { value: "split", label: "Split" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "trim", label: "Trim Whitespace" },
  { value: "date_format", label: "Date Format" },
  { value: "code_lookup", label: "Code Lookup" },
  { value: "reference", label: "FHIR Reference" },
  { value: "codeable_concept", label: "CodeableConcept" },
  { value: "quantity", label: "Quantity" },
  { value: "period", label: "Period" },
  { value: "custom_script", label: "Custom Script" },
];

const DATA_TYPES = [
  "string", "boolean", "integer", "decimal", "date", "dateTime", "instant",
  "uri", "code", "Identifier", "HumanName", "Address", "ContactPoint",
  "CodeableConcept", "Coding", "Quantity", "Period", "Reference"
];

export default function FHIRDataMappingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("mappings");
  const [selectedMapping, setSelectedMapping] = useState<CustomMapping | null>(null);
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showValidationDialog, setShowValidationDialog] = useState(false);
  const [editingField, setEditingField] = useState<FieldMapping | null>(null);
  const [expandedMappings, setExpandedMappings] = useState<Set<string>>(new Set());
  
  const [newMapping, setNewMapping] = useState({
    name: "",
    description: "",
    fhirVersion: "R4" as "R4" | "R5",
    sourceEntityType: "",
    targetResourceType: "",
    targetProfile: "",
  });

  const [newField, setNewField] = useState({
    sourceField: "",
    targetField: "",
    dataType: "string",
    required: false,
    transformationType: "direct",
    transformationParams: "",
    defaultValue: "",
  });

  const [newValidationRule, setNewValidationRule] = useState({
    field: "",
    rule: "required",
    params: "",
    errorMessage: "",
  });

  const { data: mappings, isLoading: mappingsLoading } = useQuery<CustomMapping[]>({
    queryKey: ["/api/fhir-mapping/mappings"],
  });

  const { data: connections } = useQuery<FHIRConnection[]>({
    queryKey: ["/api/fhir-data-integration/connections"],
  });

  const { data: validationResults } = useQuery<Record<string, ValidationResult>>({
    queryKey: ["/api/fhir-mapping/validation-results"],
  });

  const createMappingMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/fhir-mapping/mappings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      setShowMappingDialog(false);
      setNewMapping({ name: "", description: "", fhirVersion: "R4", sourceEntityType: "", targetResourceType: "", targetProfile: "" });
      toast({ title: "Mapping Created", description: "New data mapping has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create mapping.", variant: "destructive" });
    },
  });

  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/fhir-mapping/mappings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      toast({ title: "Mapping Updated", description: "Data mapping has been updated successfully." });
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/fhir-mapping/mappings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      setSelectedMapping(null);
      toast({ title: "Mapping Deleted", description: "Data mapping has been removed." });
    },
  });

  const validateMappingMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/fhir-mapping/mappings/${id}/validate`);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/validation-results"] });
      toast({
        title: data.valid ? "Validation Passed" : "Validation Issues Found",
        description: data.valid 
          ? `Mapping scored ${data.score}% for data quality.`
          : `Found ${data.errors?.length || 0} errors and ${data.warnings?.length || 0} warnings.`,
        variant: data.valid ? "default" : "destructive",
      });
    },
  });

  const testMappingMutation = useMutation({
    mutationFn: async ({ mappingId, testData }: { mappingId: string; testData: any }) => {
      return apiRequest("POST", "/api/fhir-mapping/execute", { mappingId, sourceEntity: testData });
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success ? "Test Successful" : "Test Failed",
        description: data.success 
          ? `Transformation completed in ${data.executionTimeMs}ms`
          : `Errors: ${data.errors?.map((e: any) => e.message).join(", ")}`,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const handleCreateMapping = () => {
    if (!newMapping.name || !newMapping.sourceEntityType || !newMapping.targetResourceType) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createMappingMutation.mutate({
      ...newMapping,
      version: "1.0.0",
      fieldMappings: [],
      extensionMappings: [],
      nestedMappings: [],
      validationRules: [],
      isActive: true,
      isDefault: false,
      createdBy: "user",
    });
  };

  const handleAddField = () => {
    if (!selectedMapping || !newField.sourceField || !newField.targetField) {
      toast({ title: "Validation Error", description: "Please fill in source and target fields.", variant: "destructive" });
      return;
    }
    
    let transformParams = {};
    if (newField.transformationType !== "direct" && newField.transformationParams) {
      try {
        transformParams = JSON.parse(newField.transformationParams);
      } catch (e) {
        toast({ 
          title: "Invalid JSON", 
          description: "Transformation parameters must be valid JSON. Example: {\"format\": \"YYYY-MM-DD\"}", 
          variant: "destructive" 
        });
        return;
      }
    }

    const fieldMapping: FieldMapping = {
      id: `fm-${Date.now()}`,
      sourceField: newField.sourceField,
      targetField: newField.targetField,
      dataType: newField.dataType,
      required: newField.required,
      transformation: newField.transformationType !== "direct" ? {
        type: newField.transformationType,
        params: transformParams,
      } : undefined,
      defaultValue: newField.defaultValue || undefined,
    };
    updateMappingMutation.mutate({
      id: selectedMapping.id,
      data: { fieldMappings: [...selectedMapping.fieldMappings, fieldMapping] },
    });
    setShowFieldDialog(false);
    setNewField({ sourceField: "", targetField: "", dataType: "string", required: false, transformationType: "direct", transformationParams: "", defaultValue: "" });
  };

  const handleDeleteField = (fieldId: string) => {
    if (!selectedMapping) return;
    updateMappingMutation.mutate({
      id: selectedMapping.id,
      data: { fieldMappings: selectedMapping.fieldMappings.filter(f => f.id !== fieldId) },
    });
  };

  const handleAddValidationRule = () => {
    if (!selectedMapping || !newValidationRule.field || !newValidationRule.errorMessage) {
      toast({ title: "Validation Error", description: "Please fill in required fields.", variant: "destructive" });
      return;
    }
    
    let ruleParams;
    if (newValidationRule.params) {
      try {
        ruleParams = JSON.parse(newValidationRule.params);
      } catch (e) {
        toast({ 
          title: "Invalid JSON", 
          description: "Rule parameters must be valid JSON. Example: {\"pattern\": \"^[A-Z].*\"}", 
          variant: "destructive" 
        });
        return;
      }
    }

    const rule: ValidationRule = {
      id: `vr-${Date.now()}`,
      field: newValidationRule.field,
      rule: newValidationRule.rule,
      params: ruleParams,
      errorMessage: newValidationRule.errorMessage,
    };
    updateMappingMutation.mutate({
      id: selectedMapping.id,
      data: { validationRules: [...selectedMapping.validationRules, rule] },
    });
    setShowValidationDialog(false);
    setNewValidationRule({ field: "", rule: "required", params: "", errorMessage: "" });
  };

  const toggleMappingExpanded = (id: string) => {
    const newExpanded = new Set(expandedMappings);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedMappings(newExpanded);
  };

  const getValidationStatusBadge = (mapping: CustomMapping) => {
    const result = validationResults?.[mapping.id];
    if (!result) return <Badge variant="outline">Not Validated</Badge>;
    if (result.valid) return <Badge className="bg-green-500">Valid ({result.score}%)</Badge>;
    return <Badge variant="destructive">{result.errors?.length || 0} Issues</Badge>;
  };

  if (mappingsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <GitMerge className="h-8 w-8 text-primary" />
          Data Mapping & Transformation
        </h1>
        <p className="text-muted-foreground mt-1">
          Define mapping rules between internal models and external FHIR servers with validation
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Mappings</p>
                <p className="text-2xl font-bold">{mappings?.length || 0}</p>
              </div>
              <Layers className="h-8 w-8 text-primary opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Mappings</p>
                <p className="text-2xl font-bold text-green-600">
                  {mappings?.filter(m => m.isActive).length || 0}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connected Servers</p>
                <p className="text-2xl font-bold text-blue-600">
                  {connections?.filter(c => c.status === "connected").length || 0}
                </p>
              </div>
              <Server className="h-8 w-8 text-blue-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Validation Score</p>
                <p className="text-2xl font-bold text-amber-600">
                  {validationResults 
                    ? Math.round(Object.values(validationResults).reduce((acc, r) => acc + (r.score || 0), 0) / Math.max(Object.keys(validationResults).length, 1))
                    : 0}%
                </p>
              </div>
              <Shield className="h-8 w-8 text-amber-600 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-4 gap-1">
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <Layers className="h-4 w-4 mr-2" />
            Mappings
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="h-4 w-4 mr-2" />
            Transform Rules
          </TabsTrigger>
          <TabsTrigger value="validation" data-testid="tab-validation">
            <Shield className="h-4 w-4 mr-2" />
            Validation
          </TabsTrigger>
          <TabsTrigger value="connections" data-testid="tab-connections">
            <Link2 className="h-4 w-4 mr-2" />
            Server Config
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mappings" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Data Mapping Rules</h2>
            <Button onClick={() => setShowMappingDialog(true)} data-testid="button-add-mapping">
              <Plus className="h-4 w-4 mr-2" />
              New Mapping
            </Button>
          </div>

          <div className="grid gap-4">
            {mappings?.map((mapping) => (
              <Card key={mapping.id} className="hover-elevate" data-testid={`card-mapping-${mapping.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 cursor-pointer" {...clickable(() => toggleMappingExpanded(mapping.id))}>
                      {expandedMappings.has(mapping.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-lg">{mapping.name}</CardTitle>
                        <CardDescription>{mapping.description}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={mapping.fhirVersion === "R5" ? "default" : "secondary"}>
                        FHIR {mapping.fhirVersion}
                      </Badge>
                      {mapping.isActive ? (
                        <Badge className="bg-green-500">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                      {getValidationStatusBadge(mapping)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{mapping.sourceEntityType}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md">
                      <FileJson className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{mapping.targetResourceType}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {mapping.fieldMappings.length} field mappings
                    </span>
                  </div>

                  {expandedMappings.has(mapping.id) && (
                    <div className="mt-4 space-y-4">
                      <Separator />
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Field Mappings</h4>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => {
                            setSelectedMapping(mapping);
                            setShowFieldDialog(true);
                          }}
                          data-testid={`button-add-field-${mapping.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Field
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {mapping.fieldMappings.map((field) => (
                          <div 
                            key={field.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                          >
                            <div className="flex items-center gap-4">
                              <code className="text-sm bg-background px-2 py-1 rounded">{field.sourceField}</code>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                              <code className="text-sm bg-background px-2 py-1 rounded">{field.targetField}</code>
                              <Badge variant="outline" className="text-xs">{field.dataType}</Badge>
                              {field.required && <Badge className="text-xs">Required</Badge>}
                              {field.transformation && (
                                <Badge variant="secondary" className="text-xs">
                                  <Zap className="h-3 w-3 mr-1" />
                                  {field.transformation.type}
                                </Badge>
                              )}
                            </div>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              onClick={() => {
                                setSelectedMapping(mapping);
                                handleDeleteField(field.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ))}
                        {mapping.fieldMappings.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No field mappings configured. Add fields to define the transformation.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => validateMappingMutation.mutate(mapping.id)}
                      disabled={validateMappingMutation.isPending}
                    >
                      {validateMappingMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Shield className="h-4 w-4 mr-2" />
                      )}
                      Validate
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => testMappingMutation.mutate({ mappingId: mapping.id, testData: { id: "test-1", firstName: "John", lastName: "Doe" } })}
                      disabled={testMappingMutation.isPending}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Test
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedMapping(mapping);
                        setShowValidationDialog(true);
                      }}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Rules
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateMappingMutation.mutate({ id: mapping.id, data: { isActive: !mapping.isActive } })}
                    >
                      {mapping.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteMappingMutation.mutate(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!mappings || mappings.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Layers className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                  <h3 className="text-lg font-medium">No Mapping Rules</h3>
                  <p className="text-muted-foreground">Create your first data mapping to transform between internal models and FHIR resources.</p>
                  <Button onClick={() => setShowMappingDialog(true)} className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Mapping
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <h2 className="text-xl font-semibold">Transformation Rules</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {TRANSFORMATION_TYPES.map((transform) => (
              <Card key={transform.value}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    {transform.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {transform.value === "direct" && "Copies the source value directly to the target field without modification."}
                    {transform.value === "concat" && "Combines multiple source fields into a single target value."}
                    {transform.value === "split" && "Splits a source field into multiple target values based on delimiter."}
                    {transform.value === "uppercase" && "Converts the source value to uppercase."}
                    {transform.value === "lowercase" && "Converts the source value to lowercase."}
                    {transform.value === "trim" && "Removes leading and trailing whitespace from the value."}
                    {transform.value === "date_format" && "Converts date values to the specified format (e.g., YYYY-MM-DD)."}
                    {transform.value === "code_lookup" && "Maps source codes to FHIR-compliant codes using a lookup table."}
                    {transform.value === "reference" && "Creates a FHIR Reference type pointing to another resource."}
                    {transform.value === "codeable_concept" && "Builds a CodeableConcept with system, code, and display values."}
                    {transform.value === "quantity" && "Creates a Quantity type with value, unit, system, and code."}
                    {transform.value === "period" && "Creates a Period type with start and end dates."}
                    {transform.value === "custom_script" && "Executes custom JavaScript transformation logic."}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="validation" className="space-y-4">
          <h2 className="text-xl font-semibold">Validation & Data Consistency</h2>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Bidirectional Sync Validation</AlertTitle>
            <AlertDescription>
              Validation rules ensure data consistency when synchronizing between your internal models and external FHIR servers.
              Define required fields, format patterns, and custom validation logic.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Import Validation</CardTitle>
                <CardDescription>Rules applied when importing from external FHIR servers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Required Field Validation</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Data Type Validation</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Reference Integrity Check</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Code System Validation</span>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export Validation</CardTitle>
                <CardDescription>Rules applied when exporting to external FHIR servers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">FHIR Profile Conformance</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Must-Support Field Check</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Terminology Binding</span>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">Cardinality Constraints</span>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conflict Resolution Strategy</CardTitle>
              <CardDescription>How to handle conflicts during bidirectional synchronization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer bg-primary/5 border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">Newest Wins</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Most recent modification takes precedence</p>
                </div>
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="h-4 w-4" />
                    <span className="font-medium text-sm">Local Wins</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Local data always takes precedence</p>
                </div>
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="h-4 w-4" />
                    <span className="font-medium text-sm">Remote Wins</span>
                  </div>
                  <p className="text-xs text-muted-foreground">External server data takes precedence</p>
                </div>
                <div className="p-4 border rounded-lg hover-elevate cursor-pointer">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium text-sm">Manual Review</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Flag conflicts for manual resolution</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connections" className="space-y-4">
          <h2 className="text-xl font-semibold">Server Mapping Configuration</h2>
          
          <div className="grid gap-4">
            {connections?.map((connection) => (
              <Card key={connection.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Server className="h-5 w-5 text-primary" />
                      <div>
                        <CardTitle className="text-base">{connection.name}</CardTitle>
                        <CardDescription>{connection.baseUrl}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={connection.fhirVersion === "R5" ? "default" : "secondary"}>
                        FHIR {connection.fhirVersion}
                      </Badge>
                      <Badge className={connection.status === "connected" ? "bg-green-500" : "bg-amber-500"}>
                        {connection.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <FieldCaption>Assigned Mappings</FieldCaption>
                    <div className="flex flex-wrap gap-2">
                      {mappings?.filter(m => m.fhirVersion === connection.fhirVersion || connection.fhirVersion === "STU3").map((mapping) => (
                        <Badge key={mapping.id} variant="outline" className="cursor-pointer hover-elevate">
                          {mapping.name}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="mt-2">
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Mappings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!connections || connections.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center">
                  <Server className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                  <h3 className="text-lg font-medium">No Server Connections</h3>
                  <p className="text-muted-foreground">Configure FHIR server connections to apply mapping rules.</p>
                  <Button variant="outline" className="mt-4" onClick={() => window.location.href = "/fhir-server-connections"}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Go to Connections
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Mapping</DialogTitle>
            <DialogDescription>Define a new data mapping between internal models and FHIR resources.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mapping-name">Mapping Name *</Label>
              <Input
                id="mapping-name"
                placeholder="e.g., Patient to FHIR Patient"
                value={newMapping.name}
                onChange={(e) => setNewMapping({ ...newMapping, name: e.target.value })}
                data-testid="input-mapping-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapping-description">Description</Label>
              <Textarea
                id="mapping-description"
                placeholder="Describe the purpose of this mapping..."
                value={newMapping.description}
                onChange={(e) => setNewMapping({ ...newMapping, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fhir-data-mapping-fhir-version">FHIR Version *</Label>
                <Select value={newMapping.fhirVersion} onValueChange={(v) => setNewMapping({ ...newMapping, fhirVersion: v as "R4" | "R5" })}>
                  <SelectTrigger id="fhir-data-mapping-fhir-version" data-testid="select-fhir-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R4">FHIR R4</SelectItem>
                    <SelectItem value="R5">FHIR R5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fhir-data-mapping-target-resource">Target Resource *</Label>
                <Select value={newMapping.targetResourceType} onValueChange={(v) => setNewMapping({ ...newMapping, targetResourceType: v })}>
                  <SelectTrigger id="fhir-data-mapping-target-resource" data-testid="select-target-resource">
                    <SelectValue placeholder="Select resource" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fhir-data-mapping-source-entity-type">Source Entity Type *</Label>
              <Select value={newMapping.sourceEntityType} onValueChange={(v) => setNewMapping({ ...newMapping, sourceEntityType: v })}>
                <SelectTrigger id="fhir-data-mapping-source-entity-type" data-testid="select-source-entity">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  {LOCAL_ENTITY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-profile">Target Profile URL (optional)</Label>
              <Input
                id="target-profile"
                placeholder="e.g., http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"
                value={newMapping.targetProfile}
                onChange={(e) => setNewMapping({ ...newMapping, targetProfile: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMappingDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateMapping} disabled={createMappingMutation.isPending} data-testid="button-create-mapping">
              {createMappingMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFieldDialog} onOpenChange={setShowFieldDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Field Mapping</DialogTitle>
            <DialogDescription>Define how a source field maps to a FHIR target field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="source-field">Source Field *</Label>
                <Input
                  id="source-field"
                  placeholder="e.g., firstName"
                  value={newField.sourceField}
                  onChange={(e) => setNewField({ ...newField, sourceField: e.target.value })}
                  data-testid="input-source-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-field">Target Field *</Label>
                <Input
                  id="target-field"
                  placeholder="e.g., name[0].given[0]"
                  value={newField.targetField}
                  onChange={(e) => setNewField({ ...newField, targetField: e.target.value })}
                  data-testid="input-target-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fhir-data-mapping-data-type">Data Type</Label>
                <Select value={newField.dataType} onValueChange={(v) => setNewField({ ...newField, dataType: v })}>
                  <SelectTrigger id="fhir-data-mapping-data-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fhir-data-mapping-transformation">Transformation</Label>
                <Select value={newField.transformationType} onValueChange={(v) => setNewField({ ...newField, transformationType: v })}>
                  <SelectTrigger id="fhir-data-mapping-transformation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFORMATION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newField.transformationType !== "direct" && (
              <div className="space-y-2">
                <Label htmlFor="transform-params">Transformation Parameters (JSON)</Label>
                <Textarea
                  id="transform-params"
                  placeholder='e.g., {"format": "YYYY-MM-DD"}'
                  value={newField.transformationParams}
                  onChange={(e) => setNewField({ ...newField, transformationParams: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="default-value">Default Value (optional)</Label>
              <Input
                id="default-value"
                placeholder="Value if source is empty"
                value={newField.defaultValue}
                onChange={(e) => setNewField({ ...newField, defaultValue: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="required"
                checked={newField.required}
                onCheckedChange={(checked) => setNewField({ ...newField, required: checked })}
              />
              <Label htmlFor="required">Required Field</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFieldDialog(false)}>Cancel</Button>
            <Button onClick={handleAddField} data-testid="button-add-field">Add Field</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Validation Rule</DialogTitle>
            <DialogDescription>Define validation rules for data consistency during sync.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-field">Field Path *</Label>
              <Input
                id="rule-field"
                placeholder="e.g., name[0].family"
                value={newValidationRule.field}
                onChange={(e) => setNewValidationRule({ ...newValidationRule, field: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fhir-data-mapping-validation-rule">Validation Rule</Label>
              <Select value={newValidationRule.rule} onValueChange={(v) => setNewValidationRule({ ...newValidationRule, rule: v })}>
                <SelectTrigger id="fhir-data-mapping-validation-rule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="pattern">Regex Pattern</SelectItem>
                  <SelectItem value="min_length">Minimum Length</SelectItem>
                  <SelectItem value="max_length">Maximum Length</SelectItem>
                  <SelectItem value="code_system">Code System</SelectItem>
                  <SelectItem value="custom">Custom Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newValidationRule.rule !== "required" && (
              <div className="space-y-2">
                <Label htmlFor="rule-params">Rule Parameters (JSON)</Label>
                <Textarea
                  id="rule-params"
                  placeholder='e.g., {"pattern": "^[A-Z].*"}'
                  value={newValidationRule.params}
                  onChange={(e) => setNewValidationRule({ ...newValidationRule, params: e.target.value })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="error-message">Error Message *</Label>
              <Input
                id="error-message"
                placeholder="Message to show when validation fails"
                value={newValidationRule.errorMessage}
                onChange={(e) => setNewValidationRule({ ...newValidationRule, errorMessage: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidationDialog(false)}>Cancel</Button>
            <Button onClick={handleAddValidationRule}>Add Rule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
