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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FHIRFieldMappingEditor } from "./fhir-field-mapping-editor";
import { FHIRProfileEditor } from "./fhir-profile-editor";
import { 
  ArrowRight,
  Plus,
  Trash2,
  Edit,
  Copy,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Settings,
  Layers,
  Code,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap
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
  validationRules: any[];
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomProfile {
  id: string;
  name: string;
  description: string;
  fhirVersion: "R4" | "R5";
  baseResourceType: string;
  profileUrl: string;
  constraints: any[];
  extensions: any[];
  mustSupportFields: string[];
  isActive: boolean;
}

interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  fhirVersion: "R4" | "R5";
  sourceEntityType: string;
  targetResourceType: string;
}

function VersionBadge({ version }: { version: "R4" | "R5" }) {
  return (
    <Badge variant={version === "R5" ? "default" : "secondary"}>
      FHIR {version}
    </Badge>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge variant="default" className="gap-1">
      <CheckCircle className="w-3 h-3" />
      Active
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="w-3 h-3" />
      Inactive
    </Badge>
  );
}

export function FHIRMappingDesigner() {
  const { toast } = useToast();
  const [selectedMapping, setSelectedMapping] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<"R4" | "R5" | "all">("all");
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<CustomProfile | null>(null);

  // Form state for new mapping
  const [newMappingForm, setNewMappingForm] = useState({
    name: "",
    description: "",
    fhirVersion: "R4" as "R4" | "R5",
    sourceEntityType: "",
    targetResourceType: "",
    targetProfile: ""
  });

  // Form state for new profile
  const [newProfileForm, setNewProfileForm] = useState({
    name: "",
    description: "",
    fhirVersion: "R4" as "R4" | "R5",
    baseResourceType: "",
    profileUrl: ""
  });

  // Fetch mappings
  const { data: mappings, isLoading: mappingsLoading } = useQuery<CustomMapping[]>({
    queryKey: ["/api/fhir-mapping/mappings", selectedVersion !== "all" ? selectedVersion : undefined]
  });

  // Fetch profiles
  const { data: profiles, isLoading: profilesLoading } = useQuery<CustomProfile[]>({
    queryKey: ["/api/fhir-mapping/profiles"]
  });

  // Fetch templates
  const { data: templates } = useQuery<MappingTemplate[]>({
    queryKey: ["/api/fhir-mapping/templates"]
  });

  // Fetch statistics
  const { data: stats } = useQuery<{
    totalMappings: number;
    activeMappings: number;
    totalProfiles: number;
    mappingsByVersion: Record<string, number>;
  }>({
    queryKey: ["/api/fhir-mapping/statistics"]
  });

  // Fetch metadata
  const { data: metadata } = useQuery<{
    dataTypes: string[];
    transformationTypes: string[];
    localEntityTypes: string[];
  }>({
    queryKey: ["/api/fhir-mapping/metadata"]
  });

  // Execute mapping mutation
  const executeMappingMutation = useMutation({
    mutationFn: async ({ mappingId, sourceEntity }: { mappingId: string; sourceEntity: any }) => {
      const response = await apiRequest("POST", "/api/fhir-mapping/execute", { mappingId, sourceEntity });
      return response.json();
    },
    onSuccess: (data: any) => {
      setTestResult(data);
      if (data.success) {
        toast({
          title: "Mapping executed successfully",
          description: `Generated ${data.targetResource?.resourceType} resource`
        });
      } else {
        toast({
          title: "Mapping has errors",
          description: `${data.errors?.length || 0} error(s) found`,
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Execution failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Toggle mapping active state
  const toggleMappingMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("PUT", `/api/fhir-mapping/mappings/${id}`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/statistics"] });
      toast({ title: "Mapping updated" });
    }
  });

  // Create mapping mutation
  const createMappingMutation = useMutation({
    mutationFn: async (data: typeof newMappingForm) => {
      const response = await apiRequest("POST", "/api/fhir-mapping/mappings", {
        name: data.name,
        description: data.description,
        version: "1.0.0",
        fhirVersion: data.fhirVersion,
        sourceEntityType: data.sourceEntityType,
        targetResourceType: data.targetResourceType,
        targetProfile: data.targetProfile || undefined,
        fieldMappings: [],
        extensionMappings: [],
        nestedMappings: [],
        validationRules: [],
        isActive: true,
        isDefault: false,
        createdBy: "user"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/statistics"] });
      setShowAddMapping(false);
      setNewMappingForm({ name: "", description: "", fhirVersion: "R4", sourceEntityType: "", targetResourceType: "", targetProfile: "" });
      toast({ title: "Mapping created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create mapping", description: error.message, variant: "destructive" });
    }
  });

  // Create profile mutation
  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof newProfileForm) => {
      const response = await apiRequest("POST", "/api/fhir-mapping/profiles", {
        name: data.name,
        description: data.description,
        fhirVersion: data.fhirVersion,
        baseResourceType: data.baseResourceType,
        profileUrl: data.profileUrl,
        constraints: [],
        extensions: [],
        mustSupportFields: [],
        isActive: true
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/statistics"] });
      setShowAddProfile(false);
      setNewProfileForm({ name: "", description: "", fhirVersion: "R4", baseResourceType: "", profileUrl: "" });
      toast({ title: "Profile created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create profile", description: error.message, variant: "destructive" });
    }
  });

  // Update mapping mutation
  const updateMappingMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/fhir-mapping/mappings/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/mappings"] });
      setEditingMappingId(null);
      toast({ title: "Mapping updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update mapping", description: error.message, variant: "destructive" });
    }
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/fhir-mapping/profiles/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-mapping/profiles"] });
      setEditingProfile(null);
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    }
  });

  const handleCreateMapping = () => {
    if (!newMappingForm.name || !newMappingForm.sourceEntityType || !newMappingForm.targetResourceType) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createMappingMutation.mutate(newMappingForm);
  };

  const handleCreateProfile = () => {
    if (!newProfileForm.name || !newProfileForm.baseResourceType || !newProfileForm.profileUrl) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }
    createProfileMutation.mutate(newProfileForm);
  };

  const handleTestMapping = () => {
    if (!selectedMapping || !testInput) return;

    try {
      const sourceEntity = JSON.parse(testInput);
      executeMappingMutation.mutate({ mappingId: selectedMapping, sourceEntity });
    } catch (e) {
      toast({
        title: "Invalid JSON",
        description: "Please enter valid JSON for the source entity",
        variant: "destructive"
      });
    }
  };

  const filteredMappings = mappings?.filter(m => 
    selectedVersion === "all" || m.fhirVersion === selectedVersion
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">FHIR Mapping Designer</h2>
          <p className="text-muted-foreground">
            Create and manage custom mappings between local entities and FHIR resources
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedVersion} onValueChange={(v) => setSelectedVersion(v as any)}>
            <SelectTrigger className="w-32" data-testid="select-fhir-version">
              <SelectValue placeholder="Version" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Versions</SelectItem>
              <SelectItem value="R4">FHIR R4</SelectItem>
              <SelectItem value="R5">FHIR R5</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowAddMapping(true)} data-testid="btn-add-mapping">
            <Plus className="w-4 h-4 mr-2" />
            New Mapping
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Mappings</p>
                <p className="text-2xl font-bold">{stats?.totalMappings || 0}</p>
              </div>
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Mappings</p>
                <p className="text-2xl font-bold text-green-600">{stats?.activeMappings || 0}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Custom Profiles</p>
                <p className="text-2xl font-bold">{stats?.totalProfiles || 0}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">R4 / R5</p>
                <p className="text-2xl font-bold">
                  {stats?.mappingsByVersion?.R4 || 0} / {stats?.mappingsByVersion?.R5 || 0}
                </p>
              </div>
              <Code className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mappings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <Layers className="w-4 h-4 mr-2" />
            Mappings
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileText className="w-4 h-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Copy className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="test" data-testid="tab-test">
            <Play className="w-4 h-4 mr-2" />
            Test Mapping
          </TabsTrigger>
        </TabsList>

        {/* Mappings Tab */}
        <TabsContent value="mappings" className="space-y-4">
          {mappingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMappings.map(mapping => (
                <Card key={mapping.id} className="hover-elevate">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{mapping.name}</h3>
                          <VersionBadge version={mapping.fhirVersion} />
                          <StatusBadge isActive={mapping.isActive} />
                          {mapping.isDefault && (
                            <Badge variant="outline">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {mapping.description}
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 p-2 bg-muted rounded">
                            <Database className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{mapping.sourceEntityType}</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded">
                            <Code className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{mapping.targetResourceType}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span>{mapping.fieldMappings.length} field mappings</span>
                          <span>{mapping.extensionMappings.length} extensions</span>
                          <span>{mapping.validationRules.length} validation rules</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={mapping.isActive}
                          onCheckedChange={(checked) => 
                            toggleMappingMutation.mutate({ id: mapping.id, isActive: checked })
                          }
                          disabled={mapping.isDefault}
                          data-testid={`switch-mapping-${mapping.id}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedMapping(mapping.id);
                            setTestInput(JSON.stringify({
                              id: "example-1",
                              firstName: "John",
                              lastName: "Doe"
                            }, null, 2));
                          }}
                          data-testid={`btn-test-${mapping.id}`}
                        >
                          <Play className="w-3 h-3 mr-1" />
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMappingId(mapping.id)}
                          data-testid={`btn-edit-${mapping.id}`}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {filteredMappings.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No mappings found</h3>
                    <p className="text-muted-foreground mb-4">
                      Create a custom mapping or use a template to get started
                    </p>
                    <Button onClick={() => setShowAddMapping(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Mapping
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-semibold">Custom FHIR Profiles</h3>
              <p className="text-sm text-muted-foreground">
                Define custom profiles with constraints and extensions
              </p>
            </div>
            <Button onClick={() => setShowAddProfile(true)} data-testid="btn-add-profile">
              <Plus className="w-4 h-4 mr-2" />
              New Profile
            </Button>
          </div>

          {profilesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <Skeleton className="h-32 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profiles?.map(profile => (
                <Card key={profile.id} className="hover-elevate">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      <div className="flex gap-2">
                        <VersionBadge version={profile.fhirVersion} />
                        <StatusBadge isActive={profile.isActive} />
                      </div>
                    </div>
                    <CardDescription>{profile.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Base: {profile.baseResourceType}</span>
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {profile.profileUrl}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {profile.constraints.length} constraints
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {profile.extensions.length} extensions
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {profile.mustSupportFields.length} must-support
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => setEditingProfile(profile)}
                        data-testid={`btn-edit-profile-${profile.id}`}
                      >
                        <Edit className="w-3 h-3 mr-2" />
                        Edit Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="mb-4">
            <h3 className="font-semibold">Mapping Templates</h3>
            <p className="text-sm text-muted-foreground">
              Start with a pre-built template and customize as needed
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates?.map(template => (
              <Card key={template.id} className="hover-elevate cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <VersionBadge version={template.fhirVersion} />
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{template.sourceEntityType}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="text-sm font-medium">{template.targetResourceType}</span>
                  </div>
                  <Button className="w-full mt-4" variant="outline" data-testid={`btn-use-template-${template.id}`}>
                    <Copy className="w-4 h-4 mr-2" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Test Mapping Tab */}
        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="w-5 h-5" />
                Test Mapping Execution
              </CardTitle>
              <CardDescription>
                Test your mappings by providing sample source data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="fhir-mapping-designer-select-mapping">Select Mapping</Label>
                    <Select
                      value={selectedMapping || undefined}
                      onValueChange={setSelectedMapping}
                    >
                      <SelectTrigger id="fhir-mapping-designer-select-mapping" data-testid="select-test-mapping">
                        <SelectValue placeholder="Choose a mapping to test" />
                      </SelectTrigger>
                      <SelectContent>
                        {mappings?.filter(m => m.isActive).map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} ({m.fhirVersion})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="fhir-mapping-designer-source-entity-json">Source Entity (JSON)</Label>
                    <Textarea id="fhir-mapping-designer-source-entity-json"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder='{"id": "123", "firstName": "John", "lastName": "Doe"}'
                      className="font-mono text-sm h-64"
                      data-testid="textarea-test-input"
                    />
                  </div>

                  <Button
                    onClick={handleTestMapping}
                    disabled={!selectedMapping || !testInput || executeMappingMutation.isPending}
                    className="w-full"
                    data-testid="btn-execute-mapping"
                  >
                    {executeMappingMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-2" />
                    )}
                    Execute Mapping
                  </Button>
                </div>

                <div className="space-y-4">
                  <FieldCaption>Result</FieldCaption>
                  {testResult ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="w-3 h-3" />
                            Failed
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {testResult.executionTimeMs}ms
                        </span>
                      </div>

                      {testResult.errors.length > 0 && (
                        <div className="p-3 bg-destructive/10 rounded border border-destructive/20">
                          <h4 className="font-medium text-destructive mb-2">Errors</h4>
                          <ul className="space-y-1">
                            {testResult.errors.map((err: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <XCircle className="w-3 h-3 mt-1 text-destructive flex-shrink-0" />
                                <span>{err.field}: {err.message}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {testResult.warnings.length > 0 && (
                        <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
                          <h4 className="font-medium text-yellow-600 mb-2">Warnings</h4>
                          <ul className="space-y-1">
                            {testResult.warnings.map((warn: any, i: number) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <AlertTriangle className="w-3 h-3 mt-1 text-yellow-600 flex-shrink-0" />
                                <span>{warn.field}: {warn.message}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {testResult.targetResource && (
                        <div>
                          <FieldCaption>Generated FHIR Resource</FieldCaption>
                          <pre className="mt-2 p-4 bg-muted rounded text-sm overflow-auto max-h-64 font-mono">
                            {JSON.stringify(testResult.targetResource, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center border rounded bg-muted/50">
                      <div className="text-center text-muted-foreground">
                        <Play className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Execute a mapping to see results</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Mapping Dialog */}
      <Dialog open={showAddMapping} onOpenChange={setShowAddMapping}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Mapping</DialogTitle>
            <DialogDescription>
              Define a custom mapping between a local entity and a FHIR resource
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fhir-mapping-designer-mapping-name">Mapping Name *</Label>
                <Input id="fhir-mapping-designer-mapping-name" 
                  placeholder="My Custom Mapping" 
                  data-testid="input-mapping-name"
                  value={newMappingForm.name}
                  onChange={(e) => setNewMappingForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="fhir-mapping-designer-fhir-version">FHIR Version</Label>
                <Select 
                  value={newMappingForm.fhirVersion}
                  onValueChange={(v) => setNewMappingForm(prev => ({ ...prev, fhirVersion: v as "R4" | "R5" }))}
                >
                  <SelectTrigger id="fhir-mapping-designer-fhir-version" data-testid="select-mapping-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R4">FHIR R4</SelectItem>
                    <SelectItem value="R5">FHIR R5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="fhir-mapping-designer-description">Description</Label>
              <Textarea id="fhir-mapping-designer-description" 
                placeholder="Describe what this mapping does..." 
                data-testid="textarea-mapping-desc"
                value={newMappingForm.description}
                onChange={(e) => setNewMappingForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fhir-mapping-designer-source-entity-type">Source Entity Type *</Label>
                <Select
                  value={newMappingForm.sourceEntityType}
                  onValueChange={(v) => setNewMappingForm(prev => ({ ...prev, sourceEntityType: v }))}
                >
                  <SelectTrigger id="fhir-mapping-designer-source-entity-type" data-testid="select-source-entity">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata?.localEntityTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fhir-mapping-designer-target-resource-type">Target Resource Type *</Label>
                <Select
                  value={newMappingForm.targetResourceType}
                  onValueChange={(v) => setNewMappingForm(prev => ({ ...prev, targetResourceType: v }))}
                >
                  <SelectTrigger id="fhir-mapping-designer-target-resource-type" data-testid="select-target-resource">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Patient">Patient</SelectItem>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="Condition">Condition</SelectItem>
                    <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                    <SelectItem value="CarePlan">CarePlan</SelectItem>
                    <SelectItem value="Goal">Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="fhir-mapping-designer-target-profile-optional">Target Profile (optional)</Label>
              <Input id="fhir-mapping-designer-target-profile-optional" 
                placeholder="http://hl7.org/fhir/..." 
                data-testid="input-target-profile"
                value={newMappingForm.targetProfile}
                onChange={(e) => setNewMappingForm(prev => ({ ...prev, targetProfile: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddMapping(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateMapping}
              disabled={createMappingMutation.isPending}
              data-testid="btn-create-mapping"
            >
              {createMappingMutation.isPending ? "Creating..." : "Create Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Profile Dialog */}
      <Dialog open={showAddProfile} onOpenChange={setShowAddProfile}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Custom Profile</DialogTitle>
            <DialogDescription>
              Define a custom FHIR profile with constraints and extensions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fhir-mapping-designer-profile-name">Profile Name *</Label>
                <Input id="fhir-mapping-designer-profile-name" 
                  placeholder="My Custom Profile" 
                  data-testid="input-profile-name"
                  value={newProfileForm.name}
                  onChange={(e) => setNewProfileForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="fhir-mapping-designer-fhir-version-2">FHIR Version</Label>
                <Select 
                  value={newProfileForm.fhirVersion}
                  onValueChange={(v) => setNewProfileForm(prev => ({ ...prev, fhirVersion: v as "R4" | "R5" }))}
                >
                  <SelectTrigger id="fhir-mapping-designer-fhir-version-2" data-testid="select-profile-version">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R4">FHIR R4</SelectItem>
                    <SelectItem value="R5">FHIR R5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="fhir-mapping-designer-description-2">Description</Label>
              <Textarea id="fhir-mapping-designer-description-2" 
                placeholder="Describe this profile..." 
                data-testid="textarea-profile-desc"
                value={newProfileForm.description}
                onChange={(e) => setNewProfileForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fhir-mapping-designer-base-resource-type">Base Resource Type *</Label>
                <Select
                  value={newProfileForm.baseResourceType}
                  onValueChange={(v) => setNewProfileForm(prev => ({ ...prev, baseResourceType: v }))}
                >
                  <SelectTrigger id="fhir-mapping-designer-base-resource-type" data-testid="select-base-resource">
                    <SelectValue placeholder="Select base" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Patient">Patient</SelectItem>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="Condition">Condition</SelectItem>
                    <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fhir-mapping-designer-profile-url">Profile URL *</Label>
                <Input id="fhir-mapping-designer-profile-url" 
                  placeholder="http://example.org/fhir/..." 
                  data-testid="input-profile-url"
                  value={newProfileForm.profileUrl}
                  onChange={(e) => setNewProfileForm(prev => ({ ...prev, profileUrl: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProfile(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateProfile}
              disabled={createProfileMutation.isPending}
              data-testid="btn-create-profile"
            >
              {createProfileMutation.isPending ? "Creating..." : "Create Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Field Mapping Editor Dialog */}
      {editingMappingId && (() => {
        const mapping = mappings?.find(m => m.id === editingMappingId);
        if (!mapping) return null;
        return (
          <Dialog open={true} onOpenChange={() => setEditingMappingId(null)}>
            <DialogContent className="max-w-6xl h-[90vh] p-0">
              <FHIRFieldMappingEditor
                mappingId={mapping.id}
                mappingName={mapping.name}
                fhirVersion={mapping.fhirVersion}
                sourceEntityType={mapping.sourceEntityType}
                targetResourceType={mapping.targetResourceType}
                fieldMappings={mapping.fieldMappings}
                extensionMappings={mapping.extensionMappings}
                validationRules={mapping.validationRules}
                onSave={(data) => {
                  updateMappingMutation.mutate({
                    id: mapping.id,
                    data: {
                      fieldMappings: data.fieldMappings,
                      extensionMappings: data.extensionMappings,
                      validationRules: data.validationRules
                    }
                  });
                }}
                onClose={() => setEditingMappingId(null)}
              />
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Profile Editor Dialog */}
      {editingProfile && (
        <Dialog open={true} onOpenChange={() => setEditingProfile(null)}>
          <DialogContent className="max-w-5xl h-[85vh] p-0">
            <FHIRProfileEditor
              profile={editingProfile}
              onSave={(data) => {
                updateProfileMutation.mutate({
                  id: editingProfile.id,
                  data
                });
              }}
              onClose={() => setEditingProfile(null)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
