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
  Plus,
  Trash2,
  Edit,
  Settings,
  AlertTriangle,
  CheckCircle,
  Link2,
  Code,
  FileText,
  Brackets,
  Save,
  X,
  Lock,
  Unlock,
  List
} from "lucide-react";

interface ProfileConstraint {
  id: string;
  field: string;
  type: "cardinality" | "binding" | "pattern" | "fixed";
  value: any;
  severity: "error" | "warning";
}

interface ProfileExtension {
  url: string;
  name: string;
  description: string;
  valueType: string;
  isRequired: boolean;
}

interface CustomProfile {
  id: string;
  name: string;
  description: string;
  fhirVersion: "R4" | "R5";
  baseResourceType: string;
  profileUrl: string;
  constraints: ProfileConstraint[];
  extensions: ProfileExtension[];
  mustSupportFields: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfileEditorProps {
  profile: CustomProfile;
  onSave: (profile: Partial<CustomProfile>) => void;
  onClose: () => void;
}

const CONSTRAINT_TYPES = [
  { value: "cardinality", label: "Cardinality", description: "Min/max occurrences" },
  { value: "binding", label: "Value Set Binding", description: "Must be from value set" },
  { value: "pattern", label: "Pattern", description: "Must match pattern" },
  { value: "fixed", label: "Fixed Value", description: "Must be exact value" },
];

const SEVERITY_LEVELS = [
  { value: "error", label: "Error", className: "text-destructive" },
  { value: "warning", label: "Warning", className: "text-amber-500" },
];

const VALUE_TYPES = [
  "string", "boolean", "integer", "decimal", "date", "dateTime",
  "code", "Coding", "CodeableConcept", "Reference", "complex"
];

const FHIR_RESOURCE_FIELDS: Record<string, string[]> = {
  Patient: [
    "id", "identifier", "active", "name", "telecom", "gender", "birthDate",
    "deceased[x]", "address", "maritalStatus", "multipleBirth[x]", "photo",
    "contact", "communication", "generalPractitioner", "managingOrganization", "link"
  ],
  Observation: [
    "id", "identifier", "basedOn", "partOf", "status", "category", "code",
    "subject", "focus", "encounter", "effective[x]", "issued", "performer",
    "value[x]", "dataAbsentReason", "interpretation", "note", "bodySite",
    "method", "specimen", "device", "referenceRange", "hasMember", "derivedFrom", "component"
  ],
  Condition: [
    "id", "identifier", "clinicalStatus", "verificationStatus", "category",
    "severity", "code", "bodySite", "subject", "encounter", "onset[x]",
    "abatement[x]", "recordedDate", "recorder", "asserter", "stage", "evidence", "note"
  ],
  MedicationRequest: [
    "id", "identifier", "status", "statusReason", "intent", "category",
    "priority", "doNotPerform", "reported[x]", "medication[x]", "subject",
    "encounter", "supportingInformation", "authoredOn", "requester", "performer",
    "reasonCode", "reasonReference", "instantiatesCanonical", "instantiatesUri",
    "basedOn", "groupIdentifier", "courseOfTherapyType", "insurance",
    "note", "dosageInstruction", "dispenseRequest", "substitution"
  ],
  Procedure: [
    "id", "identifier", "instantiatesCanonical", "instantiatesUri", "basedOn",
    "partOf", "status", "statusReason", "category", "code", "subject",
    "encounter", "performed[x]", "recorder", "asserter", "performer",
    "location", "reasonCode", "reasonReference", "bodySite", "outcome",
    "report", "complication", "complicationDetail", "followUp", "note", "focalDevice", "usedReference", "usedCode"
  ],
  CarePlan: [
    "id", "identifier", "instantiatesCanonical", "instantiatesUri", "basedOn",
    "replaces", "partOf", "status", "intent", "category", "title",
    "description", "subject", "encounter", "period", "created", "author",
    "contributor", "careTeam", "addresses", "supportingInfo", "goal", "activity", "note"
  ]
};

function ConstraintEditor({
  constraint,
  onChange
}: {
  constraint: ProfileConstraint;
  onChange: (c: ProfileConstraint) => void;
}) {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Field Path</Label>
          <Input
            value={constraint.field}
            onChange={(e) => onChange({ ...constraint, field: e.target.value })}
            placeholder="e.g., identifier, name.family"
            data-testid="input-constraint-field"
          />
        </div>
        <div>
          <Label>Constraint Type</Label>
          <Select
            value={constraint.type}
            onValueChange={(v) => onChange({ ...constraint, type: v as any })}
          >
            <SelectTrigger data-testid="select-constraint-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONSTRAINT_TYPES.map(ct => (
                <SelectItem key={ct.value} value={ct.value}>
                  <div className="flex flex-col">
                    <span>{ct.label}</span>
                    <span className="text-xs text-muted-foreground">{ct.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {constraint.type === "cardinality" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Minimum</Label>
            <Input
              type="number"
              min={0}
              value={constraint.value?.min ?? 0}
              onChange={(e) => onChange({
                ...constraint,
                value: { ...constraint.value, min: parseInt(e.target.value) }
              })}
              data-testid="input-min-cardinality"
            />
          </div>
          <div>
            <Label>Maximum (empty = unlimited)</Label>
            <Input
              type="number"
              min={0}
              value={constraint.value?.max ?? ""}
              onChange={(e) => onChange({
                ...constraint,
                value: { ...constraint.value, max: e.target.value ? parseInt(e.target.value) : undefined }
              })}
              placeholder="*"
              data-testid="input-max-cardinality"
            />
          </div>
        </div>
      )}

      {constraint.type === "binding" && (
        <div>
          <Label>Value Set URL</Label>
          <Input
            value={constraint.value?.valueSet || ""}
            onChange={(e) => onChange({
              ...constraint,
              value: { valueSet: e.target.value }
            })}
            placeholder="http://hl7.org/fhir/ValueSet/..."
            data-testid="input-valueset-url"
          />
        </div>
      )}

      {constraint.type === "pattern" && (
        <div>
          <Label>Pattern (Regex)</Label>
          <Input
            value={constraint.value?.pattern || ""}
            onChange={(e) => onChange({
              ...constraint,
              value: { pattern: e.target.value }
            })}
            placeholder="^[A-Z].*$"
            data-testid="input-pattern"
          />
        </div>
      )}

      {constraint.type === "fixed" && (
        <div>
          <Label>Fixed Value (JSON)</Label>
          <Textarea
            value={typeof constraint.value === "object" ? JSON.stringify(constraint.value, null, 2) : constraint.value}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange({ ...constraint, value: parsed });
              } catch {
                onChange({ ...constraint, value: e.target.value });
              }
            }}
            placeholder='{"system": "http://example.org", "code": "active"}'
            className="font-mono text-sm"
            rows={3}
            data-testid="input-fixed-value"
          />
        </div>
      )}

      <div>
        <Label>Severity</Label>
        <Select
          value={constraint.severity}
          onValueChange={(v) => onChange({ ...constraint, severity: v as any })}
        >
          <SelectTrigger data-testid="select-severity">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEVERITY_LEVELS.map(sl => (
              <SelectItem key={sl.value} value={sl.value}>
                <span className={sl.className}>{sl.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function FHIRProfileEditor({ profile, onSave, onClose }: ProfileEditorProps) {
  const { toast } = useToast();
  const [editedProfile, setEditedProfile] = useState<CustomProfile>({ ...profile });
  const [showAddConstraint, setShowAddConstraint] = useState(false);
  const [showAddExtension, setShowAddExtension] = useState(false);
  const [showAddMustSupport, setShowAddMustSupport] = useState(false);
  const [newMustSupportField, setNewMustSupportField] = useState("");

  const [newConstraint, setNewConstraint] = useState<ProfileConstraint>({
    id: "",
    field: "",
    type: "cardinality",
    value: { min: 1 },
    severity: "error"
  });

  const [newExtension, setNewExtension] = useState<ProfileExtension>({
    url: "",
    name: "",
    description: "",
    valueType: "string",
    isRequired: false
  });

  const availableFields = FHIR_RESOURCE_FIELDS[editedProfile.baseResourceType] || [];

  const handleAddConstraint = () => {
    if (!newConstraint.field) {
      toast({ title: "Please specify a field", variant: "destructive" });
      return;
    }

    const constraint: ProfileConstraint = {
      ...newConstraint,
      id: `c-${Date.now()}`
    };

    setEditedProfile({
      ...editedProfile,
      constraints: [...editedProfile.constraints, constraint]
    });
    setShowAddConstraint(false);
    setNewConstraint({
      id: "",
      field: "",
      type: "cardinality",
      value: { min: 1 },
      severity: "error"
    });
    toast({ title: "Constraint added" });
  };

  const handleUpdateConstraint = (id: string, updated: ProfileConstraint) => {
    setEditedProfile({
      ...editedProfile,
      constraints: editedProfile.constraints.map(c => c.id === id ? updated : c)
    });
  };

  const handleDeleteConstraint = (id: string) => {
    setEditedProfile({
      ...editedProfile,
      constraints: editedProfile.constraints.filter(c => c.id !== id)
    });
    toast({ title: "Constraint removed" });
  };

  const handleAddExtension = () => {
    if (!newExtension.url || !newExtension.name) {
      toast({ title: "Please fill in URL and name", variant: "destructive" });
      return;
    }

    setEditedProfile({
      ...editedProfile,
      extensions: [...editedProfile.extensions, { ...newExtension }]
    });
    setShowAddExtension(false);
    setNewExtension({
      url: "",
      name: "",
      description: "",
      valueType: "string",
      isRequired: false
    });
    toast({ title: "Extension added" });
  };

  const handleDeleteExtension = (url: string) => {
    setEditedProfile({
      ...editedProfile,
      extensions: editedProfile.extensions.filter(e => e.url !== url)
    });
    toast({ title: "Extension removed" });
  };

  const handleAddMustSupport = () => {
    if (!newMustSupportField) return;
    
    if (editedProfile.mustSupportFields.includes(newMustSupportField)) {
      toast({ title: "Field already marked as must-support", variant: "destructive" });
      return;
    }

    setEditedProfile({
      ...editedProfile,
      mustSupportFields: [...editedProfile.mustSupportFields, newMustSupportField]
    });
    setNewMustSupportField("");
    setShowAddMustSupport(false);
    toast({ title: "Must-support field added" });
  };

  const handleRemoveMustSupport = (field: string) => {
    setEditedProfile({
      ...editedProfile,
      mustSupportFields: editedProfile.mustSupportFields.filter(f => f !== field)
    });
  };

  const handleSave = () => {
    onSave({
      constraints: editedProfile.constraints,
      extensions: editedProfile.extensions,
      mustSupportFields: editedProfile.mustSupportFields,
      isActive: editedProfile.isActive
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-bold">{editedProfile.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">FHIR {editedProfile.fhirVersion}</Badge>
            <Badge variant="outline">{editedProfile.baseResourceType}</Badge>
            {editedProfile.isActive ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Inactive</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 break-all">
            {editedProfile.profileUrl}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={editedProfile.isActive}
              onCheckedChange={(v) => setEditedProfile({ ...editedProfile, isActive: v })}
              data-testid="switch-profile-active"
            />
            <span className="text-sm">Active</span>
          </div>
          <Button variant="outline" onClick={onClose} data-testid="btn-close-profile">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="btn-save-profile">
            <Save className="w-4 h-4 mr-2" />
            Save Profile
          </Button>
        </div>
      </div>

      <Tabs defaultValue="constraints" className="flex-1 flex flex-col">
        <div className="border-b px-4">
          <TabsList>
            <TabsTrigger value="constraints" data-testid="tab-constraints">
              <Lock className="w-4 h-4 mr-2" />
              Constraints ({editedProfile.constraints.length})
            </TabsTrigger>
            <TabsTrigger value="extensions" data-testid="tab-profile-extensions">
              <Brackets className="w-4 h-4 mr-2" />
              Extensions ({editedProfile.extensions.length})
            </TabsTrigger>
            <TabsTrigger value="must-support" data-testid="tab-must-support">
              <CheckCircle className="w-4 h-4 mr-2" />
              Must-Support ({editedProfile.mustSupportFields.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1 p-4">
          <TabsContent value="constraints" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Profile Constraints</p>
                <p className="text-sm text-muted-foreground">
                  Define cardinality, bindings, patterns, and fixed values
                </p>
              </div>
              <Button onClick={() => setShowAddConstraint(true)} data-testid="btn-add-constraint">
                <Plus className="w-4 h-4 mr-2" />
                Add Constraint
              </Button>
            </div>

            <div className="space-y-4">
              {editedProfile.constraints.map(constraint => (
                <Card key={constraint.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{constraint.field}</span>
                        <Badge variant="secondary">{constraint.type}</Badge>
                        <Badge variant={constraint.severity === "error" ? "destructive" : "outline"}>
                          {constraint.severity}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteConstraint(constraint.id)}
                        data-testid={`btn-delete-constraint-${constraint.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <ConstraintEditor
                      constraint={constraint}
                      onChange={(c) => handleUpdateConstraint(constraint.id, c)}
                    />
                  </CardContent>
                </Card>
              ))}

              {editedProfile.constraints.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Lock className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No constraints defined</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add constraints to enforce data quality rules
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="extensions" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Profile Extensions</p>
                <p className="text-sm text-muted-foreground">
                  Define custom extensions for this profile
                </p>
              </div>
              <Button onClick={() => setShowAddExtension(true)} data-testid="btn-add-profile-extension">
                <Plus className="w-4 h-4 mr-2" />
                Add Extension
              </Button>
            </div>

            <div className="space-y-2">
              {editedProfile.extensions.map(ext => (
                <Card key={ext.url} className="hover-elevate">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Brackets className="w-4 h-4 text-primary" />
                          <span className="font-medium">{ext.name}</span>
                          {ext.isRequired && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{ext.description}</p>
                        <p className="text-xs text-muted-foreground mt-2 break-all">{ext.url}</p>
                        <Badge variant="outline" className="mt-2 text-xs">{ext.valueType}</Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteExtension(ext.url)}
                        data-testid={`btn-delete-ext-${ext.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {editedProfile.extensions.length === 0 && (
                <Card>
                  <CardContent className="py-8 text-center">
                    <Brackets className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No extensions defined</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="must-support" className="mt-0 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-medium">Must-Support Fields</p>
                <p className="text-sm text-muted-foreground">
                  Fields that implementations must support
                </p>
              </div>
              <Button onClick={() => setShowAddMustSupport(true)} data-testid="btn-add-must-support">
                <Plus className="w-4 h-4 mr-2" />
                Add Field
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {editedProfile.mustSupportFields.map(field => (
                <Badge key={field} variant="secondary" className="gap-1 px-3 py-1.5">
                  <CheckCircle className="w-3 h-3" />
                  {field}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4 ml-1 p-0"
                    onClick={() => handleRemoveMustSupport(field)}
                    data-testid={`btn-remove-ms-${field}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </Badge>
              ))}

              {editedProfile.mustSupportFields.length === 0 && (
                <Card className="w-full">
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No must-support fields defined</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {availableFields.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-2">Available Fields for {editedProfile.baseResourceType}</p>
                <div className="flex flex-wrap gap-1">
                  {availableFields.map(field => (
                    <Badge
                      key={field}
                      variant={editedProfile.mustSupportFields.includes(field) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        if (!editedProfile.mustSupportFields.includes(field)) {
                          setEditedProfile({
                            ...editedProfile,
                            mustSupportFields: [...editedProfile.mustSupportFields, field]
                          });
                          toast({ title: `Added ${field} to must-support` });
                        }
                      }}
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>

      <Dialog open={showAddConstraint} onOpenChange={setShowAddConstraint}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Constraint</DialogTitle>
            <DialogDescription>
              Define a new constraint for this profile
            </DialogDescription>
          </DialogHeader>
          <ConstraintEditor
            constraint={newConstraint}
            onChange={setNewConstraint}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddConstraint(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConstraint} data-testid="btn-confirm-add-constraint">
              Add Constraint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddExtension} onOpenChange={setShowAddExtension}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extension</DialogTitle>
            <DialogDescription>
              Define a custom extension for this profile
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Extension URL</Label>
              <Input
                value={newExtension.url}
                onChange={(e) => setNewExtension({ ...newExtension, url: e.target.value })}
                placeholder="http://example.org/fhir/StructureDefinition/..."
                data-testid="input-new-ext-url"
              />
            </div>
            <div>
              <Label>Name</Label>
              <Input
                value={newExtension.name}
                onChange={(e) => setNewExtension({ ...newExtension, name: e.target.value })}
                placeholder="Extension name"
                data-testid="input-new-ext-name"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newExtension.description}
                onChange={(e) => setNewExtension({ ...newExtension, description: e.target.value })}
                placeholder="Describe what this extension represents"
                rows={2}
                data-testid="input-new-ext-desc"
              />
            </div>
            <div>
              <Label>Value Type</Label>
              <Select
                value={newExtension.valueType}
                onValueChange={(v) => setNewExtension({ ...newExtension, valueType: v })}
              >
                <SelectTrigger data-testid="select-new-ext-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALUE_TYPES.map(vt => (
                    <SelectItem key={vt} value={vt}>{vt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newExtension.isRequired}
                onCheckedChange={(v) => setNewExtension({ ...newExtension, isRequired: v })}
                data-testid="switch-ext-required"
              />
              <Label>Required extension</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddExtension(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddExtension} data-testid="btn-confirm-add-ext">
              Add Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddMustSupport} onOpenChange={setShowAddMustSupport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Must-Support Field</DialogTitle>
            <DialogDescription>
              Specify a field that implementations must support
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Field Path</Label>
              <Input
                value={newMustSupportField}
                onChange={(e) => setNewMustSupportField(e.target.value)}
                placeholder="e.g., identifier, name.family"
                data-testid="input-must-support-field"
              />
            </div>
            {availableFields.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Quick select:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {availableFields.slice(0, 10).map(field => (
                    <Badge
                      key={field}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => setNewMustSupportField(field)}
                    >
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMustSupport(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMustSupport} data-testid="btn-confirm-add-ms">
              Add Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
