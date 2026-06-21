import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ArrowRight,
  Plus,
  Trash2,
  Edit,
  GripVertical,
  Settings,
  Code,
  AlertCircle,
  CheckCircle,
  ArrowUpDown,
  Link2,
  Type,
  Calendar,
  Hash,
  ToggleLeft,
  FileText,
  Brackets,
  ChevronDown,
  ChevronRight,
  Save,
  X
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
  condition?: {
    field: string;
    operator: string;
    value?: any;
  };
}

interface ExtensionMapping {
  id: string;
  extensionUrl: string;
  sourceField: string;
  valueType: string;
  transformation?: {
    type: string;
    params: Record<string, any>;
  };
}

interface ValidationRule {
  id: string;
  field: string;
  rule: string;
  params?: Record<string, any>;
  errorMessage: string;
}

interface MappingEditorProps {
  mappingId: string;
  mappingName: string;
  fhirVersion: "R4" | "R5";
  sourceEntityType: string;
  targetResourceType: string;
  fieldMappings: FieldMapping[];
  extensionMappings: ExtensionMapping[];
  validationRules: ValidationRule[];
  onSave: (data: {
    fieldMappings: FieldMapping[];
    extensionMappings: ExtensionMapping[];
    validationRules: ValidationRule[];
  }) => void;
  onClose: () => void;
}

const DATA_TYPES = [
  { value: "string", label: "String", icon: Type },
  { value: "boolean", label: "Boolean", icon: ToggleLeft },
  { value: "integer", label: "Integer", icon: Hash },
  { value: "decimal", label: "Decimal", icon: Hash },
  { value: "date", label: "Date", icon: Calendar },
  { value: "dateTime", label: "DateTime", icon: Calendar },
  { value: "code", label: "Code", icon: Code },
  { value: "Reference", label: "Reference", icon: Link2 },
  { value: "CodeableConcept", label: "CodeableConcept", icon: Brackets },
  { value: "Identifier", label: "Identifier", icon: FileText },
  { value: "HumanName", label: "HumanName", icon: Type },
  { value: "Address", label: "Address", icon: FileText },
  { value: "ContactPoint", label: "ContactPoint", icon: Type },
  { value: "Quantity", label: "Quantity", icon: Hash },
  { value: "Period", label: "Period", icon: Calendar },
];

const TRANSFORMATION_TYPES = [
  { value: "direct", label: "Direct Copy", description: "Copy value as-is" },
  { value: "uppercase", label: "Uppercase", description: "Convert to uppercase" },
  { value: "lowercase", label: "Lowercase", description: "Convert to lowercase" },
  { value: "trim", label: "Trim", description: "Remove whitespace" },
  { value: "concat", label: "Concatenate", description: "Join multiple values" },
  { value: "split", label: "Split", description: "Split and take part" },
  { value: "date_format", label: "Date Format", description: "Format date value" },
  { value: "code_lookup", label: "Code Lookup", description: "Map to code system" },
  { value: "reference", label: "FHIR Reference", description: "Create resource reference" },
  { value: "codeable_concept", label: "CodeableConcept", description: "Create coded value" },
  { value: "quantity", label: "Quantity", description: "Create quantity with unit" },
  { value: "period", label: "Period", description: "Create time period" },
  { value: "custom_script", label: "Custom Script", description: "Custom transformation" },
];

const CONDITION_OPERATORS = [
  { value: "equals", label: "Equals" },
  { value: "not_equals", label: "Not Equals" },
  { value: "contains", label: "Contains" },
  { value: "exists", label: "Exists" },
  { value: "not_exists", label: "Does Not Exist" },
];

const VALIDATION_RULES = [
  { value: "required", label: "Required", description: "Field must have a value" },
  { value: "pattern", label: "Pattern", description: "Must match regex pattern" },
  { value: "min_length", label: "Min Length", description: "Minimum string length" },
  { value: "max_length", label: "Max Length", description: "Maximum string length" },
  { value: "code_system", label: "Code System", description: "Must be valid code" },
  { value: "custom", label: "Custom", description: "Custom validation logic" },
];

function TransformationEditor({
  transformation,
  onChange
}: {
  transformation?: { type: string; params: Record<string, any> };
  onChange: (t: { type: string; params: Record<string, any> } | undefined) => void;
}) {
  const [type, setType] = useState(transformation?.type || "direct");
  const [params, setParams] = useState<Record<string, any>>(transformation?.params || {});

  const handleTypeChange = (newType: string) => {
    setType(newType);
    const newParams: Record<string, any> = {};
    onChange(newType === "direct" ? undefined : { type: newType, params: newParams });
    setParams(newParams);
  };

  const handleParamChange = (key: string, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onChange({ type, params: newParams });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Transformation Type</Label>
        <Select value={type} onValueChange={handleTypeChange}>
          <SelectTrigger data-testid="select-transform-type">
            <SelectValue placeholder="Select transformation" />
          </SelectTrigger>
          <SelectContent>
            {TRANSFORMATION_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>
                <div className="flex flex-col">
                  <span>{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {type === "concat" && (
        <div className="space-y-2">
          <div>
            <Label>Separator</Label>
            <Input
              value={params.separator || ""}
              onChange={(e) => handleParamChange("separator", e.target.value)}
              placeholder="e.g., ' ' or '-'"
              data-testid="input-concat-separator"
            />
          </div>
          <div>
            <Label>Additional Fields (comma-separated)</Label>
            <Input
              value={params.fields?.join(",") || ""}
              onChange={(e) => handleParamChange("fields", e.target.value.split(",").filter(Boolean))}
              placeholder="field1, field2"
              data-testid="input-concat-fields"
            />
          </div>
        </div>
      )}

      {type === "split" && (
        <div className="space-y-2">
          <div>
            <Label>Delimiter</Label>
            <Input
              value={params.delimiter || ""}
              onChange={(e) => handleParamChange("delimiter", e.target.value)}
              placeholder="e.g., ',' or ' '"
              data-testid="input-split-delimiter"
            />
          </div>
          <div>
            <Label>Index (0-based)</Label>
            <Input
              type="number"
              value={params.index || 0}
              onChange={(e) => handleParamChange("index", parseInt(e.target.value))}
              min={0}
              data-testid="input-split-index"
            />
          </div>
        </div>
      )}

      {type === "date_format" && (
        <div>
          <Label>Date Format</Label>
          <Select
            value={params.format || "YYYY-MM-DD"}
            onValueChange={(v) => handleParamChange("format", v)}
          >
            <SelectTrigger data-testid="select-date-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              <SelectItem value="YYYY-MM-DDTHH:mm:ss">DateTime (ISO)</SelectItem>
              <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
              <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {type === "code_lookup" && (
        <div>
          <Label>Lookup Table</Label>
          <Select
            value={params.table || ""}
            onValueChange={(v) => handleParamChange("table", v)}
          >
            <SelectTrigger data-testid="select-lookup-table">
              <SelectValue placeholder="Select lookup table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gender_codes">Gender Codes</SelectItem>
              <SelectItem value="condition_clinical_status">Condition Status</SelectItem>
              <SelectItem value="vital_sign_codes">Vital Sign Codes</SelectItem>
              <SelectItem value="observation_status">Observation Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {type === "reference" && (
        <div>
          <Label>Resource Type</Label>
          <Input
            value={params.resourceType || ""}
            onChange={(e) => handleParamChange("resourceType", e.target.value)}
            placeholder="e.g., Patient, Practitioner"
            data-testid="input-ref-resource-type"
          />
        </div>
      )}

      {type === "codeable_concept" && (
        <div className="space-y-2">
          <div>
            <Label>Code System URL</Label>
            <Input
              value={params.system || ""}
              onChange={(e) => handleParamChange("system", e.target.value)}
              placeholder="e.g., http://loinc.org"
              data-testid="input-code-system"
            />
          </div>
          <div>
            <Label>Lookup Table (optional)</Label>
            <Select
              value={params.table || ""}
              onValueChange={(v) => handleParamChange("table", v)}
            >
              <SelectTrigger data-testid="select-code-table">
                <SelectValue placeholder="Select lookup table" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="vital_sign_codes">Vital Sign Codes</SelectItem>
                <SelectItem value="condition_clinical_status">Condition Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {type === "quantity" && (
        <div className="space-y-2">
          <div>
            <Label>Unit</Label>
            <Input
              value={params.unit || ""}
              onChange={(e) => handleParamChange("unit", e.target.value)}
              placeholder="e.g., kg, mmHg"
              data-testid="input-quantity-unit"
            />
          </div>
          <div>
            <Label>UCUM Code (optional)</Label>
            <Input
              value={params.ucumCode || ""}
              onChange={(e) => handleParamChange("ucumCode", e.target.value)}
              placeholder="e.g., kg, mm[Hg]"
              data-testid="input-ucum-code"
            />
          </div>
          <div>
            <Label>System URL (optional)</Label>
            <Input
              value={params.system || "http://unitsofmeasure.org"}
              onChange={(e) => handleParamChange("system", e.target.value)}
              placeholder="http://unitsofmeasure.org"
              data-testid="input-quantity-system"
            />
          </div>
        </div>
      )}

      {type === "period" && (
        <div className="space-y-2">
          <div>
            <Label>Start Field</Label>
            <Input
              value={params.startField || ""}
              onChange={(e) => handleParamChange("startField", e.target.value)}
              placeholder="e.g., startDate"
              data-testid="input-period-start"
            />
          </div>
          <div>
            <Label>End Field</Label>
            <Input
              value={params.endField || ""}
              onChange={(e) => handleParamChange("endField", e.target.value)}
              placeholder="e.g., endDate"
              data-testid="input-period-end"
            />
          </div>
          <div>
            <Label>Date Format</Label>
            <Select
              value={params.format || "YYYY-MM-DD"}
              onValueChange={(v) => handleParamChange("format", v)}
            >
              <SelectTrigger data-testid="select-period-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="YYYY-MM-DDTHH:mm:ss">DateTime (ISO)</SelectItem>
                <SelectItem value="YYYY-MM-DDTHH:mm:ssZ">DateTime (UTC)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {type === "custom_script" && (
        <div>
          <Label>Custom Script (JavaScript)</Label>
          <Textarea
            value={params.script || ""}
            onChange={(e) => handleParamChange("script", e.target.value)}
            placeholder="return value.toUpperCase();"
            className="font-mono text-sm"
            rows={4}
            data-testid="input-custom-script"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Variable 'value' contains the source field value
          </p>
        </div>
      )}
    </div>
  );
}

function FieldMappingRow({
  mapping,
  onEdit,
  onDelete,
  onToggleRequired
}: {
  mapping: FieldMapping;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRequired: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const DataTypeIcon = DATA_TYPES.find(d => d.value === mapping.dataType)?.icon || Type;

  return (
    <Card className="hover-elevate">
      <CardContent className="pt-4">
        <div className="flex items-center gap-4">
          <div className="cursor-move text-muted-foreground">
            <GripVertical className="w-4 h-4" />
          </div>
          
          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-sm truncate" title={mapping.sourceField}>
                {mapping.sourceField}
              </span>
            </div>
            
            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <div className="flex items-center gap-2">
              <DataTypeIcon className="w-4 h-4 text-primary" />
              <span className="font-mono text-sm truncate" title={mapping.targetField}>
                {mapping.targetField}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {mapping.dataType}
              </Badge>
              {mapping.transformation && (
                <Badge variant="secondary" className="text-xs">
                  {mapping.transformation.type}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2 justify-end">
              <div className="flex items-center gap-1">
                <Switch
                  checked={mapping.required}
                  onCheckedChange={onToggleRequired}
                  data-testid={`switch-required-${mapping.id}`}
                />
                <span className="text-xs text-muted-foreground">Required</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setExpanded(!expanded)}
                data-testid={`btn-expand-${mapping.id}`}
              >
                {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onEdit}
                data-testid={`btn-edit-field-${mapping.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={onDelete}
                data-testid={`btn-delete-field-${mapping.id}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4">
            {mapping.transformation && (
              <div>
                <Label className="text-xs text-muted-foreground">Transformation</Label>
                <div className="bg-muted rounded p-2 mt-1">
                  <p className="text-sm font-medium">{mapping.transformation.type}</p>
                  {Object.keys(mapping.transformation.params || {}).length > 0 && (
                    <pre className="text-xs mt-1 text-muted-foreground">
                      {JSON.stringify(mapping.transformation.params, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
            
            {mapping.defaultValue !== undefined && (
              <div>
                <Label className="text-xs text-muted-foreground">Default Value</Label>
                <p className="text-sm font-mono mt-1">{JSON.stringify(mapping.defaultValue)}</p>
              </div>
            )}
            
            {mapping.condition && (
              <div>
                <Label className="text-xs text-muted-foreground">Condition</Label>
                <div className="bg-muted rounded p-2 mt-1 text-sm">
                  {mapping.condition.field} {mapping.condition.operator} {mapping.condition.value}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function FHIRFieldMappingEditor({
  mappingId,
  mappingName,
  fhirVersion,
  sourceEntityType,
  targetResourceType,
  fieldMappings: initialFieldMappings,
  extensionMappings: initialExtensionMappings,
  validationRules: initialValidationRules,
  onSave,
  onClose
}: MappingEditorProps) {
  const { toast } = useToast();
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(initialFieldMappings);
  const [extensionMappings, setExtensionMappings] = useState<ExtensionMapping[]>(initialExtensionMappings);
  const [validationRules, setValidationRules] = useState<ValidationRule[]>(initialValidationRules);
  const [editingField, setEditingField] = useState<FieldMapping | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [showAddExtension, setShowAddExtension] = useState(false);
  const [showAddValidation, setShowAddValidation] = useState(false);

  const [newFieldForm, setNewFieldForm] = useState({
    sourceField: "",
    targetField: "",
    dataType: "string",
    required: false,
    defaultValue: "",
    transformation: undefined as { type: string; params: Record<string, any> } | undefined
  });

  const [newExtensionForm, setNewExtensionForm] = useState({
    extensionUrl: "",
    sourceField: "",
    valueType: "string"
  });

  const [newValidationForm, setNewValidationForm] = useState({
    field: "",
    rule: "required",
    params: {} as Record<string, any>,
    errorMessage: ""
  });

  const handleAddField = () => {
    if (!newFieldForm.sourceField || !newFieldForm.targetField) {
      toast({ title: "Please fill in source and target fields", variant: "destructive" });
      return;
    }

    const newField: FieldMapping = {
      id: `fm-${Date.now()}`,
      sourceField: newFieldForm.sourceField,
      targetField: newFieldForm.targetField,
      dataType: newFieldForm.dataType,
      required: newFieldForm.required,
      transformation: newFieldForm.transformation,
      defaultValue: newFieldForm.defaultValue || undefined
    };

    setFieldMappings([...fieldMappings, newField]);
    setShowAddField(false);
    setNewFieldForm({
      sourceField: "",
      targetField: "",
      dataType: "string",
      required: false,
      defaultValue: "",
      transformation: undefined
    });
    toast({ title: "Field mapping added" });
  };

  const handleUpdateField = (id: string, updates: Partial<FieldMapping>) => {
    setFieldMappings(fieldMappings.map(f => 
      f.id === id ? { ...f, ...updates } : f
    ));
  };

  const handleDeleteField = (id: string) => {
    setFieldMappings(fieldMappings.filter(f => f.id !== id));
    toast({ title: "Field mapping removed" });
  };

  const handleAddExtension = () => {
    if (!newExtensionForm.extensionUrl || !newExtensionForm.sourceField) {
      toast({ title: "Please fill in extension URL and source field", variant: "destructive" });
      return;
    }

    const newExt: ExtensionMapping = {
      id: `ext-${Date.now()}`,
      extensionUrl: newExtensionForm.extensionUrl,
      sourceField: newExtensionForm.sourceField,
      valueType: newExtensionForm.valueType
    };

    setExtensionMappings([...extensionMappings, newExt]);
    setShowAddExtension(false);
    setNewExtensionForm({ extensionUrl: "", sourceField: "", valueType: "string" });
    toast({ title: "Extension mapping added" });
  };

  const handleDeleteExtension = (id: string) => {
    setExtensionMappings(extensionMappings.filter(e => e.id !== id));
    toast({ title: "Extension mapping removed" });
  };

  const handleAddValidation = () => {
    if (!newValidationForm.field || !newValidationForm.errorMessage) {
      toast({ title: "Please fill in field and error message", variant: "destructive" });
      return;
    }

    const newRule: ValidationRule = {
      id: `vr-${Date.now()}`,
      field: newValidationForm.field,
      rule: newValidationForm.rule,
      params: newValidationForm.params,
      errorMessage: newValidationForm.errorMessage
    };

    setValidationRules([...validationRules, newRule]);
    setShowAddValidation(false);
    setNewValidationForm({ field: "", rule: "required", params: {}, errorMessage: "" });
    toast({ title: "Validation rule added" });
  };

  const handleDeleteValidation = (id: string) => {
    setValidationRules(validationRules.filter(v => v.id !== id));
    toast({ title: "Validation rule removed" });
  };

  const handleSave = () => {
    onSave({ fieldMappings, extensionMappings, validationRules });
    toast({ title: "Mapping configuration saved" });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-bold">{mappingName}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">{sourceEntityType}</Badge>
            <ArrowRight className="w-4 h-4" />
            <Badge variant="default">FHIR {fhirVersion} {targetResourceType}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} data-testid="btn-close-editor">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="btn-save-mappings">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields" className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList>
            <TabsTrigger value="fields" data-testid="tab-fields">
              <Code className="w-4 h-4 mr-2" />
              Field Mappings ({fieldMappings.length})
            </TabsTrigger>
            <TabsTrigger value="extensions" data-testid="tab-extensions">
              <Brackets className="w-4 h-4 mr-2" />
              Extensions ({extensionMappings.length})
            </TabsTrigger>
            <TabsTrigger value="validation" data-testid="tab-validation">
              <CheckCircle className="w-4 h-4 mr-2" />
              Validation ({validationRules.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="fields" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Define how source entity fields map to FHIR resource fields
              </p>
              <Button onClick={() => setShowAddField(true)} data-testid="btn-add-field">
                <Plus className="w-4 h-4 mr-2" />
                Add Field Mapping
              </Button>
            </div>

            <div className="space-y-2">
              {fieldMappings.map(mapping => (
                <FieldMappingRow
                  key={mapping.id}
                  mapping={mapping}
                  onEdit={() => setEditingField(mapping)}
                  onDelete={() => handleDeleteField(mapping.id)}
                  onToggleRequired={() => handleUpdateField(mapping.id, { required: !mapping.required })}
                />
              ))}

              {fieldMappings.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Code className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No field mappings defined</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setShowAddField(true)}
                    >
                      Add First Mapping
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="extensions" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Map source fields to FHIR extensions
              </p>
              <Button onClick={() => setShowAddExtension(true)} data-testid="btn-add-extension">
                <Plus className="w-4 h-4 mr-2" />
                Add Extension
              </Button>
            </div>

            <div className="space-y-2">
              {extensionMappings.map(ext => (
                <Card key={ext.id} className="hover-elevate">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-mono text-sm">{ext.sourceField}</p>
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          {ext.extensionUrl}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {ext.valueType}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteExtension(ext.id)}
                        data-testid={`btn-delete-ext-${ext.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {extensionMappings.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Brackets className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No extension mappings defined</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="validation" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Define validation rules for mapped fields
              </p>
              <Button onClick={() => setShowAddValidation(true)} data-testid="btn-add-validation">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>

            <div className="space-y-2">
              {validationRules.map(rule => (
                <Card key={rule.id} className="hover-elevate">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-500" />
                          <span className="font-mono text-sm">{rule.field}</span>
                          <Badge variant="secondary">{rule.rule}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{rule.errorMessage}</p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteValidation(rule.id)}
                        data-testid={`btn-delete-rule-${rule.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {validationRules.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No validation rules defined</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <Dialog open={showAddField} onOpenChange={setShowAddField}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Field Mapping</DialogTitle>
            <DialogDescription>
              Define how a source field maps to a FHIR field
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Source Field</Label>
                <Input
                  value={newFieldForm.sourceField}
                  onChange={(e) => setNewFieldForm({ ...newFieldForm, sourceField: e.target.value })}
                  placeholder="e.g., firstName"
                  data-testid="input-source-field"
                />
              </div>
              <div>
                <Label>Target Field</Label>
                <Input
                  value={newFieldForm.targetField}
                  onChange={(e) => setNewFieldForm({ ...newFieldForm, targetField: e.target.value })}
                  placeholder="e.g., name[0].given[0]"
                  data-testid="input-target-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Type</Label>
                <Select
                  value={newFieldForm.dataType}
                  onValueChange={(v) => setNewFieldForm({ ...newFieldForm, dataType: v })}
                >
                  <SelectTrigger data-testid="select-data-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map(dt => (
                      <SelectItem key={dt.value} value={dt.value}>
                        {dt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Default Value (optional)</Label>
                <Input
                  value={newFieldForm.defaultValue}
                  onChange={(e) => setNewFieldForm({ ...newFieldForm, defaultValue: e.target.value })}
                  placeholder="Default if empty"
                  data-testid="input-default-value"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newFieldForm.required}
                onCheckedChange={(v) => setNewFieldForm({ ...newFieldForm, required: v })}
                data-testid="switch-field-required"
              />
              <Label>Required field</Label>
            </div>
            <Separator />
            <TransformationEditor
              transformation={newFieldForm.transformation}
              onChange={(t) => setNewFieldForm({ ...newFieldForm, transformation: t })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddField(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddField} data-testid="btn-confirm-add-field">
              Add Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddExtension} onOpenChange={setShowAddExtension}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extension Mapping</DialogTitle>
            <DialogDescription>
              Map a source field to a FHIR extension
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Extension URL</Label>
              <Input
                value={newExtensionForm.extensionUrl}
                onChange={(e) => setNewExtensionForm({ ...newExtensionForm, extensionUrl: e.target.value })}
                placeholder="http://hl7.org/fhir/StructureDefinition/..."
                data-testid="input-extension-url"
              />
            </div>
            <div>
              <Label>Source Field</Label>
              <Input
                value={newExtensionForm.sourceField}
                onChange={(e) => setNewExtensionForm({ ...newExtensionForm, sourceField: e.target.value })}
                placeholder="e.g., race"
                data-testid="input-ext-source-field"
              />
            </div>
            <div>
              <Label>Value Type</Label>
              <Select
                value={newExtensionForm.valueType}
                onValueChange={(v) => setNewExtensionForm({ ...newExtensionForm, valueType: v })}
              >
                <SelectTrigger data-testid="select-ext-value-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="integer">Integer</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="CodeableConcept">CodeableConcept</SelectItem>
                  <SelectItem value="complex">Complex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExtension(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExtension} data-testid="btn-confirm-add-extension">
              Add Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddValidation} onOpenChange={setShowAddValidation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Validation Rule</DialogTitle>
            <DialogDescription>
              Define a validation rule for mapped fields
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Field</Label>
              <Input
                value={newValidationForm.field}
                onChange={(e) => setNewValidationForm({ ...newValidationForm, field: e.target.value })}
                placeholder="e.g., name[0].family"
                data-testid="input-validation-field"
              />
            </div>
            <div>
              <Label>Rule Type</Label>
              <Select
                value={newValidationForm.rule}
                onValueChange={(v) => setNewValidationForm({ ...newValidationForm, rule: v })}
              >
                <SelectTrigger data-testid="select-validation-rule">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALIDATION_RULES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span>{r.label}</span>
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(newValidationForm.rule === "pattern" || 
              newValidationForm.rule === "min_length" || 
              newValidationForm.rule === "max_length" ||
              newValidationForm.rule === "code_system") && (
              <div>
                <Label>
                  {newValidationForm.rule === "pattern" && "Regex Pattern"}
                  {newValidationForm.rule === "min_length" && "Minimum Length"}
                  {newValidationForm.rule === "max_length" && "Maximum Length"}
                  {newValidationForm.rule === "code_system" && "Allowed Values (comma-separated)"}
                </Label>
                <Input
                  onChange={(e) => {
                    const params: Record<string, any> = {};
                    if (newValidationForm.rule === "pattern") params.pattern = e.target.value;
                    if (newValidationForm.rule === "min_length") params.min = parseInt(e.target.value);
                    if (newValidationForm.rule === "max_length") params.max = parseInt(e.target.value);
                    if (newValidationForm.rule === "code_system") params.values = e.target.value.split(",").map(v => v.trim());
                    setNewValidationForm({ ...newValidationForm, params });
                  }}
                  placeholder={
                    newValidationForm.rule === "pattern" ? "^[A-Z].*$" :
                    newValidationForm.rule === "min_length" ? "1" :
                    newValidationForm.rule === "max_length" ? "100" :
                    "male, female, other"
                  }
                  data-testid="input-validation-params"
                />
              </div>
            )}
            <div>
              <Label>Error Message</Label>
              <Input
                value={newValidationForm.errorMessage}
                onChange={(e) => setNewValidationForm({ ...newValidationForm, errorMessage: e.target.value })}
                placeholder="Validation error message"
                data-testid="input-error-message"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddValidation(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddValidation} data-testid="btn-confirm-add-validation">
              Add Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
