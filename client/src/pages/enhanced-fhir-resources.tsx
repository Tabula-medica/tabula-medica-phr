import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Database, Server, Shield, CheckCircle, XCircle, AlertTriangle, Info,
  Settings, RefreshCw, Play, Square, Sparkles, FileCheck, Clock, Loader2,
  Heart, Syringe, Scissors, Activity, FileText, Users
} from "lucide-react";

interface FHIRProfile {
  id: string;
  name: string;
  resourceType: string;
  version: string;
  url: string;
  description: string;
  requiredFields: string[];
  recommendedFields: string[];
  validationRules: any[];
  codeSystemBindings: any[];
  isActive: boolean;
}

interface ResourceSyncConfig {
  resourceType: string;
  enabled: boolean;
  direction: "inbound" | "outbound" | "bidirectional";
  profileId?: string;
  conflictResolution: string;
  autoValidate: boolean;
  lastSyncCount?: number;
  lastSyncAt?: string;
}

interface SyncConfiguration {
  id: string;
  serverId: string;
  serverName: string;
  resourceConfigs: ResourceSyncConfig[];
  syncSchedule: string;
  lastSyncAt?: string;
  isEnabled: boolean;
}

interface SyncJob {
  id: string;
  configId: string;
  resourceType: string;
  direction: string;
  status: string;
  progress: number;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  errors: string[];
  startedAt?: string;
  completedAt?: string;
}

interface ValidationResult {
  isValid: boolean;
  resourceType: string;
  resourceId: string;
  profilesChecked: string[];
  errors: any[];
  warnings: any[];
  info: any[];
  completenessScore: number;
  qualityScore: number;
  validatedAt: string;
}

interface DashboardStats {
  totalProfiles: number;
  activeProfiles: number;
  syncConfigurations: number;
  enabledResourceTypes: string[];
  recentSyncJobs: SyncJob[];
  resourceCounts: Record<string, number>;
  lastUpdated: string;
}

const resourceTypeIcons: Record<string, any> = {
  Patient: Users,
  AllergyIntolerance: Heart,
  Immunization: Syringe,
  Procedure: Scissors,
  Condition: Activity,
  MedicationRequest: FileText,
  Observation: Activity,
};

export default function EnhancedFHIRResources() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedConfig, setSelectedConfig] = useState<SyncConfiguration | null>(null);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const { toast } = useToast();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/enhanced-fhir/dashboard"],
  });

  const { data: profiles } = useQuery<FHIRProfile[]>({
    queryKey: ["/api/enhanced-fhir/profiles"],
  });

  const { data: syncConfigs } = useQuery<SyncConfiguration[]>({
    queryKey: ["/api/enhanced-fhir/sync-configurations"],
  });

  const { data: syncJobs, refetch: refetchJobs } = useQuery<SyncJob[]>({
    queryKey: ["/api/enhanced-fhir/sync-jobs"],
    refetchInterval: 2000,
  });

  const { data: resourceTypes } = useQuery<string[]>({
    queryKey: ["/api/enhanced-fhir/resource-types"],
  });

  const { data: allergies } = useQuery({
    queryKey: ["/api/enhanced-fhir/resources/AllergyIntolerance"],
  });

  const { data: immunizations } = useQuery({
    queryKey: ["/api/enhanced-fhir/resources/Immunization"],
  });

  const { data: procedures } = useQuery({
    queryKey: ["/api/enhanced-fhir/resources/Procedure"],
  });

  const updateResourceConfigMutation = useMutation({
    mutationFn: async ({ configId, resourceType, updates }: { configId: string; resourceType: string; updates: any }) => {
      const response = await apiRequest("PATCH", `/api/enhanced-fhir/sync-configurations/${configId}/resources/${resourceType}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-fhir/sync-configurations"] });
      toast({ title: "Configuration Updated", description: "Resource sync settings have been saved." });
    },
  });

  const startSyncJobMutation = useMutation({
    mutationFn: async (data: { configId: string; resourceType: string; direction: string }) => {
      const response = await apiRequest("POST", "/api/enhanced-fhir/sync-jobs", data);
      return response.json();
    },
    onSuccess: () => {
      refetchJobs();
      toast({ title: "Sync Job Started", description: "Synchronization is now running." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start sync job", variant: "destructive" });
    },
  });

  const validateResourceMutation = useMutation({
    mutationFn: async ({ resourceType, resourceId }: { resourceType: string; resourceId: string }) => {
      const response = await apiRequest("POST", `/api/enhanced-fhir/validate/${resourceType}/${resourceId}`, {});
      return response.json() as Promise<ValidationResult>;
    },
    onSuccess: (data) => {
      setValidationResult(data);
    },
  });

  const getAISuggestionsMutation = useMutation({
    mutationFn: async (resource: any) => {
      const response = await apiRequest("POST", "/api/enhanced-fhir/ai-suggestions", { resource });
      return response.json() as Promise<{ suggestions: string[]; disclaimer: string }>;
    },
    onSuccess: (data) => {
      setAiSuggestions(data.suggestions);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "running":
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Running</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      case "cancelled":
        return <Badge variant="secondary"><Square className="h-3 w-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">FHIR Profiles</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalProfiles || 0}</div>
            <p className="text-xs text-muted-foreground">{dashboard?.activeProfiles || 0} active profiles</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Sync Configurations</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.syncConfigurations || 0}</div>
            <p className="text-xs text-muted-foreground">Connected servers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Enabled Resources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.enabledResourceTypes?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Resource types syncing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Recent Jobs</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncJobs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Sync jobs processed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Resource Summary
            </CardTitle>
            <CardDescription>Available FHIR resources by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { type: "AllergyIntolerance", count: dashboard?.resourceCounts?.AllergyIntolerance || 0, icon: Heart, color: "text-red-500" },
                { type: "Immunization", count: dashboard?.resourceCounts?.Immunization || 0, icon: Syringe, color: "text-blue-500" },
                { type: "Procedure", count: dashboard?.resourceCounts?.Procedure || 0, icon: Scissors, color: "text-purple-500" },
              ].map((item) => (
                <div key={item.type} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                    <span className="font-medium">{item.type}</span>
                  </div>
                  <Badge variant="secondary">{item.count} records</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Recent Sync Jobs
            </CardTitle>
            <CardDescription>Latest synchronization activity</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {syncJobs?.slice(0, 5).map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{job.resourceType}</p>
                      <p className="text-xs text-muted-foreground">{job.direction} sync</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {job.status === "running" && (
                        <div className="w-20">
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground text-center py-8">No sync jobs yet</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enabled Resource Types
          </CardTitle>
          <CardDescription>Resource types currently configured for synchronization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {dashboard?.enabledResourceTypes?.map((type: string) => {
              const Icon = resourceTypeIcons[type] || Database;
              return (
                <Badge key={type} variant="outline" className="py-2 px-3">
                  <Icon className="h-4 w-4 mr-2" />
                  {type}
                </Badge>
              );
            }) || <p className="text-sm text-muted-foreground">No resource types enabled</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSyncConfiguration = () => (
    <div className="space-y-6">
      {syncConfigs?.map((config) => (
        <Card key={config.id} data-testid={`card-config-${config.id}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {config.serverName}
                </CardTitle>
                <CardDescription>
                  Schedule: {config.syncSchedule} | Last sync: {config.lastSyncAt ? new Date(config.lastSyncAt).toLocaleString() : "Never"}
                </CardDescription>
              </div>
              <Badge variant={config.isEnabled ? "default" : "secondary"}>
                {config.isEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Resource Sync Settings</h4>
              <div className="grid gap-4">
                {config.resourceConfigs.map((resourceConfig) => {
                  const Icon = resourceTypeIcons[resourceConfig.resourceType] || Database;
                  return (
                    <div key={resourceConfig.resourceType} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={resourceConfig.enabled}
                          onCheckedChange={(checked) => {
                            updateResourceConfigMutation.mutate({
                              configId: config.id,
                              resourceType: resourceConfig.resourceType,
                              updates: { enabled: checked },
                            });
                          }}
                          data-testid={`switch-${resourceConfig.resourceType.toLowerCase()}`}
                        />
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{resourceConfig.resourceType}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <Select
                          value={resourceConfig.direction}
                          onValueChange={(value) => {
                            updateResourceConfigMutation.mutate({
                              configId: config.id,
                              resourceType: resourceConfig.resourceType,
                              updates: { direction: value },
                            });
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inbound">Inbound</SelectItem>
                            <SelectItem value="outbound">Outbound</SelectItem>
                            <SelectItem value="bidirectional">Bidirectional</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          value={resourceConfig.conflictResolution}
                          onValueChange={(value) => {
                            updateResourceConfigMutation.mutate({
                              configId: config.id,
                              resourceType: resourceConfig.resourceType,
                              updates: { conflictResolution: value },
                            });
                          }}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local_wins">Local Wins</SelectItem>
                            <SelectItem value="remote_wins">Remote Wins</SelectItem>
                            <SelectItem value="newest_wins">Newest Wins</SelectItem>
                            <SelectItem value="manual">Manual Review</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!resourceConfig.enabled || startSyncJobMutation.isPending}
                          onClick={() => {
                            startSyncJobMutation.mutate({
                              configId: config.id,
                              resourceType: resourceConfig.resourceType,
                              direction: resourceConfig.direction === "bidirectional" ? "inbound" : resourceConfig.direction,
                            });
                          }}
                          data-testid={`button-sync-${resourceConfig.resourceType.toLowerCase()}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Sync
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderProfiles = () => (
    <div className="space-y-4">
      <div className="grid gap-4">
        {profiles?.map((profile) => (
          <Card key={profile.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  <CardDescription>{profile.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{profile.version}</Badge>
                  <Badge variant={profile.isActive ? "default" : "secondary"}>
                    {profile.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="required">
                  <AccordionTrigger className="text-sm">Required Fields ({profile.requiredFields.length})</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2">
                      {profile.requiredFields.map((field) => (
                        <Badge key={field} variant="destructive" className="text-xs">{field}</Badge>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="recommended">
                  <AccordionTrigger className="text-sm">Recommended Fields ({profile.recommendedFields.length})</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-2">
                      {profile.recommendedFields.map((field) => (
                        <Badge key={field} variant="secondary" className="text-xs">{field}</Badge>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="rules">
                  <AccordionTrigger className="text-sm">Validation Rules ({profile.validationRules.length})</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {profile.validationRules.map((rule) => (
                        <div key={rule.id} className="flex items-center gap-2 text-sm">
                          {rule.severity === "error" && <XCircle className="h-4 w-4 text-red-500" />}
                          {rule.severity === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                          {rule.severity === "info" && <Info className="h-4 w-4 text-blue-500" />}
                          <span>{rule.field}: {rule.errorMessage}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
            <CardFooter>
              <p className="text-xs text-muted-foreground break-all">{profile.url}</p>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderResources = () => (
    <div className="space-y-6">
      <Tabs defaultValue="allergies">
        <TabsList>
          <TabsTrigger value="allergies" className="flex items-center gap-2">
            <Heart className="h-4 w-4" />
            Allergies
          </TabsTrigger>
          <TabsTrigger value="immunizations" className="flex items-center gap-2">
            <Syringe className="h-4 w-4" />
            Immunizations
          </TabsTrigger>
          <TabsTrigger value="procedures" className="flex items-center gap-2">
            <Scissors className="h-4 w-4" />
            Procedures
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allergies" className="mt-4">
          <div className="grid gap-4">
            {(allergies as any[])?.map((allergy: any) => (
              <Card key={allergy.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Heart className="h-5 w-5 text-red-500" />
                      {allergy.code?.text || allergy.code?.coding?.[0]?.display}
                    </CardTitle>
                    <Badge variant={allergy.criticality === "high" ? "destructive" : "secondary"}>
                      {allergy.criticality} criticality
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Category:</span> {allergy.category?.[0]}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span> {allergy.clinicalStatus?.coding?.[0]?.code}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Recorded:</span> {allergy.recordedDate}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Patient:</span> {allergy.patient?.display || allergy.patient?.reference}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedResource(allergy);
                      validateResourceMutation.mutate({ resourceType: "AllergyIntolerance", resourceId: allergy.id });
                    }}
                    data-testid={`button-validate-${allergy.id}`}
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedResource(allergy);
                      getAISuggestionsMutation.mutate(allergy);
                    }}
                    data-testid={`button-ai-suggest-${allergy.id}`}
                  >
                    <Sparkles className="h-4 w-4 mr-1" />
                    AI Suggestions
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="immunizations" className="mt-4">
          <div className="grid gap-4">
            {(immunizations as any[])?.map((imm: any) => (
              <Card key={imm.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Syringe className="h-5 w-5 text-blue-500" />
                      {imm.vaccineCode?.text || imm.vaccineCode?.coding?.[0]?.display}
                    </CardTitle>
                    <Badge variant={imm.status === "completed" ? "default" : "secondary"}>
                      {imm.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date:</span> {imm.occurrenceDateTime}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Manufacturer:</span> {imm.manufacturer?.display || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Lot Number:</span> {imm.lotNumber || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Primary Source:</span> {imm.primarySource ? "Yes" : "No"}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedResource(imm);
                      validateResourceMutation.mutate({ resourceType: "Immunization", resourceId: imm.id });
                    }}
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    Validate
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="procedures" className="mt-4">
          <div className="grid gap-4">
            {(procedures as any[])?.map((proc: any) => (
              <Card key={proc.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Scissors className="h-5 w-5 text-purple-500" />
                      {proc.code?.text || proc.code?.coding?.[0]?.display}
                    </CardTitle>
                    <Badge variant={proc.status === "completed" ? "default" : "secondary"}>
                      {proc.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Date:</span> {proc.performedDateTime}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Performer:</span> {proc.performer?.[0]?.actor?.display || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Location:</span> {proc.location?.display || "N/A"}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Outcome:</span> {proc.outcome?.text || "N/A"}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedResource(proc);
                      validateResourceMutation.mutate({ resourceType: "Procedure", resourceId: proc.id });
                    }}
                  >
                    <FileCheck className="h-4 w-4 mr-1" />
                    Validate
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!validationResult} onOpenChange={() => setValidationResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Validation Results
            </DialogTitle>
            <DialogDescription>
              {validationResult?.resourceType} / {validationResult?.resourceId}
            </DialogDescription>
          </DialogHeader>

          {validationResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{Math.round(validationResult.completenessScore)}%</div>
                      <p className="text-sm text-muted-foreground">Completeness</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{Math.round(validationResult.qualityScore)}%</div>
                      <p className="text-sm text-muted-foreground">Quality Score</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {validationResult.isValid ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                    <CheckCircle className="h-4 w-4 mr-1" /> Valid Resource
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <XCircle className="h-4 w-4 mr-1" /> Invalid Resource
                  </Badge>
                )}
              </div>

              {validationResult.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Errors ({validationResult.errors.length})
                  </h4>
                  <div className="space-y-2">
                    {validationResult.errors.map((err, i) => (
                      <div key={i} className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-sm">
                        <p className="font-medium">{err.field}</p>
                        <p className="text-muted-foreground">{err.message}</p>
                        {err.suggestion && <p className="text-xs mt-1 italic">Suggestion: {err.suggestion}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Warnings ({validationResult.warnings.length})
                  </h4>
                  <div className="space-y-2">
                    {validationResult.warnings.map((warn, i) => (
                      <div key={i} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-sm">
                        <p className="font-medium">{warn.field}</p>
                        <p className="text-muted-foreground">{warn.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.info.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    Recommendations ({validationResult.info.length})
                  </h4>
                  <div className="space-y-2">
                    {validationResult.info.map((inf, i) => (
                      <div key={i} className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                        <p className="font-medium">{inf.field}</p>
                        <p className="text-muted-foreground">{inf.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground italic border-t pt-2">
                NO-CDS: This validation is for data quality purposes only and does not constitute clinical decision support.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setValidationResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!aiSuggestions} onOpenChange={() => setAiSuggestions(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Quality Suggestions
            </DialogTitle>
            <DialogDescription>
              Recommendations to improve data quality
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {aiSuggestions?.map((suggestion, i) => (
              <div key={i} className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm">
                <p>{suggestion}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground italic border-t pt-2">
            NO-CDS: These AI-generated suggestions are for informational purposes only and do not constitute clinical decision support or medical advice.
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAiSuggestions(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-enhanced-fhir-resources">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Enhanced FHIR Resources</h1>
          <p className="text-muted-foreground">Manage FHIR resources with advanced validation and configurable sync</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="configuration" data-testid="tab-configuration">Sync Config</TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">Profiles</TabsTrigger>
          <TabsTrigger value="resources" data-testid="tab-resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">{renderDashboard()}</TabsContent>
        <TabsContent value="configuration" className="mt-6">{renderSyncConfiguration()}</TabsContent>
        <TabsContent value="profiles" className="mt-6">{renderProfiles()}</TabsContent>
        <TabsContent value="resources" className="mt-6">{renderResources()}</TabsContent>
      </Tabs>
    </div>
  );
}
