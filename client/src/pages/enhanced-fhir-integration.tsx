import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Database,
  Activity,
  Pill,
  RefreshCw,
  Settings,
  Clock,
  Zap,
  Watch,
  BarChart3,
  ArrowRightLeft,
  AlertTriangle,
  FileCode,
  Layers,
  PlusCircle,
  XCircle
} from "lucide-react";

interface IntegrationStats {
  totalProfiles: number;
  totalDataSources: number;
  totalPresets: number;
  activeDataSources: number;
  totalRecordsProcessed: number;
  totalTransformSuccess: number;
  totalTransformFailed: number;
  disclaimer: string;
}

interface CustomFhirProfile {
  id: string;
  name: string;
  description: string;
  baseResourceType: string;
  profileUrl: string;
  version: string;
  status: "draft" | "active" | "retired" | "deprecated";
  extensions: { url: string; name: string; description: string; valueType: string; required: boolean }[];
  createdAt: string;
  updatedAt: string;
}

interface ExternalDataSource {
  id: string;
  name: string;
  description: string;
  type: string;
  provider: string;
  dataFormat: string;
  isActive: boolean;
  syncStatus: string;
  lastSyncAt?: string;
  statistics: {
    totalRecords: number;
    successfulTransforms: number;
    failedTransforms: number;
  };
}

interface MappingPreset {
  id: string;
  name: string;
  description: string;
  type: string;
  sourceType: string;
  targetResourceTypes: string[];
  mappingRules: { id: string; sourcePath: string; targetPath: string }[];
  isBuiltIn: boolean;
}

interface LOINCMapping {
  dataType: string;
  code: string;
  display: string;
  unit: string;
}

export default function EnhancedFhirIntegrationPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<IntegrationStats>({
    queryKey: ["/api/enhanced-fhir/stats"],
  });

  const { data: profilesData, isLoading: profilesLoading } = useQuery<{ profiles: CustomFhirProfile[]; count: number }>({
    queryKey: ["/api/enhanced-fhir/profiles"],
  });

  const { data: dataSourcesData, isLoading: dataSourcesLoading } = useQuery<{ dataSources: ExternalDataSource[]; count: number }>({
    queryKey: ["/api/enhanced-fhir/data-sources"],
  });

  const { data: presetsData, isLoading: presetsLoading } = useQuery<{ presets: MappingPreset[]; count: number }>({
    queryKey: ["/api/enhanced-fhir/presets"],
  });

  const { data: loincMappings, isLoading: loincLoading } = useQuery<{ mappings: LOINCMapping[]; count: number }>({
    queryKey: ["/api/enhanced-fhir/loinc/wearable"],
  });

  const runPipelineMutation = useMutation({
    mutationFn: async ({ sourceId, records }: { sourceId: string; records: any[] }) => {
      return apiRequest("POST", `/api/enhanced-fhir/pipelines/${sourceId}/run`, { records });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-fhir/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-fhir/data-sources"] });
      toast({ title: "Pipeline Complete", description: "Data transformation completed successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Pipeline Failed", description: error.message || "Failed to run transformation pipeline.", variant: "destructive" });
    },
  });

  const getDataSourceIcon = (type: string) => {
    switch (type) {
      case "wearable": return <Watch className="h-4 w-4" />;
      case "pharmacy": return <Pill className="h-4 w-4" />;
      case "lab": return <Activity className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case "idle": return <Badge variant="secondary" data-testid="badge-sync-idle"><Clock className="h-3 w-3 mr-1" />Idle</Badge>;
      case "syncing": return <Badge variant="default" data-testid="badge-sync-syncing"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Syncing</Badge>;
      case "error": return <Badge variant="destructive" data-testid="badge-sync-error"><XCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default: return <Badge variant="outline" data-testid="badge-sync-disabled">Disabled</Badge>;
    }
  };

  const handleRunSamplePipeline = (dataSource: ExternalDataSource) => {
    const sampleRecords = dataSource.type === "wearable"
      ? [
          { patientId: "patient-001", dataType: "steps", value: 8542, timestamp: new Date().toISOString() },
          { patientId: "patient-001", dataType: "heart_rate", value: 72, timestamp: new Date().toISOString() },
          { patientId: "patient-001", dataType: "blood_oxygen", value: 98, timestamp: new Date().toISOString() },
        ]
      : dataSource.type === "pharmacy"
      ? [
          {
            patientId: "patient-001",
            rxNumber: "RX-" + Date.now(),
            ndc: "00071-0155-23",
            drugName: "Metformin 500mg",
            dosage: "Take 1 tablet twice daily with meals",
            quantity: 60,
            refillsRemaining: 3,
            fillDate: new Date().toISOString().split("T")[0],
            pharmacyName: dataSource.name,
            daysSupply: 30,
          },
        ]
      : [{ patientId: "patient-001", data: "sample" }];

    runPipelineMutation.mutate({ sourceId: dataSource.id, records: sampleRecords });
  };

  if (statsLoading || profilesLoading || dataSourcesLoading || presetsLoading || loincLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" data-testid="loading-state">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="enhanced-fhir-integration-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Enhanced FHIR Data Integration</h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Custom profiles, external data sources, and transformation pipelines
          </p>
        </div>
        <Button variant="outline" data-testid="button-refresh" onClick={() => queryClient.invalidateQueries()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Alert className="mb-6" data-testid="alert-no-cds">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Informational Purposes Only</AlertTitle>
        <AlertDescription>
          {stats?.disclaimer || "This data integration is for informational and interoperability purposes only. It does not constitute medical advice or clinical decision support."}
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card data-testid="card-stat-profiles">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Custom Profiles</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-profiles">{stats?.totalProfiles || 0}</div>
            <p className="text-xs text-muted-foreground">FHIR resource profiles</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-sources">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Data Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-sources">{stats?.activeDataSources || 0}</div>
            <p className="text-xs text-muted-foreground">of {stats?.totalDataSources || 0} active</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-transforms">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Transformations</CardTitle>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-transform-success">
              {stats?.totalTransformSuccess?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalTransformFailed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-records">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Records Processed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-records">
              {stats?.totalRecordsProcessed?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">from all sources</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" data-testid="tabs-integration">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Layers className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="data-sources" data-testid="tab-data-sources">
            <Database className="h-4 w-4 mr-2" />
            Data Sources
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <FileCode className="h-4 w-4 mr-2" />
            FHIR Profiles
          </TabsTrigger>
          <TabsTrigger value="mappings" data-testid="tab-mappings">
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Mappings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Watch className="h-5 w-5" />
                  Wearable LOINC Mappings
                </CardTitle>
                <CardDescription>
                  Supported wearable data types with standardized LOINC codes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {loincMappings?.mappings?.map((mapping) => (
                      <div key={mapping.dataType} className="flex items-center justify-between p-2 rounded-md bg-muted/50" data-testid={`row-loinc-${mapping.dataType}`}>
                        <div>
                          <span className="font-medium capitalize">{mapping.dataType.replace(/_/g, " ")}</span>
                          <p className="text-xs text-muted-foreground">{mapping.display}</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" data-testid={`badge-loinc-${mapping.code}`}>{mapping.code}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">{mapping.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Mapping Presets
                </CardTitle>
                <CardDescription>
                  Pre-configured transformation templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {presetsData?.presets?.map((preset) => (
                      <div key={preset.id} className="p-3 rounded-md border" data-testid={`card-preset-${preset.id}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{preset.name}</span>
                          {preset.isBuiltIn && <Badge variant="secondary" data-testid="badge-builtin">Built-in</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{preset.description}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" data-testid={`badge-source-${preset.sourceType}`}>{preset.sourceType}</Badge>
                          {preset.targetResourceTypes.map((rt) => (
                            <Badge key={rt} data-testid={`badge-target-${rt}`}>{rt}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="data-sources" className="space-y-4" data-testid="content-data-sources">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Connected Data Sources</h3>
            <Button variant="outline" data-testid="button-add-source">
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Source
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dataSourcesData?.dataSources?.map((source) => (
              <Card key={source.id} className="hover-elevate cursor-pointer" data-testid={`card-source-${source.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getDataSourceIcon(source.type)}
                      <CardTitle className="text-base">{source.name}</CardTitle>
                    </div>
                    {getSyncStatusBadge(source.syncStatus)}
                  </div>
                  <CardDescription>{source.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">Provider</p>
                      <p className="font-medium" data-testid={`text-provider-${source.id}`}>{source.provider}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Format</p>
                      <p className="font-medium uppercase" data-testid={`text-format-${source.id}`}>{source.dataFormat}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium capitalize" data-testid={`text-type-${source.id}`}>{source.type}</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-muted-foreground">Total Records</p>
                      <p className="font-medium text-lg" data-testid={`text-records-${source.id}`}>
                        {source.statistics.totalRecords.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Success</p>
                      <p className="font-medium text-lg text-green-600 dark:text-green-400" data-testid={`text-success-${source.id}`}>
                        {source.statistics.successfulTransforms.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-medium text-lg text-red-600 dark:text-red-400" data-testid={`text-failed-${source.id}`}>
                        {source.statistics.failedTransforms}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRunSamplePipeline(source)}
                      disabled={runPipelineMutation.isPending}
                      data-testid={`button-run-pipeline-${source.id}`}
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Run Sample Transform
                    </Button>
                    <Button variant="ghost" size="sm" data-testid={`button-settings-${source.id}`}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4" data-testid="content-profiles">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Custom FHIR Profiles</h3>
            <Button variant="outline" data-testid="button-add-profile">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Profile
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {profilesData?.profiles?.map((profile) => (
              <Card key={profile.id} data-testid={`card-profile-${profile.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{profile.name}</CardTitle>
                      <CardDescription>{profile.profileUrl}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={profile.status === "active" ? "default" : "secondary"} data-testid={`badge-status-${profile.id}`}>
                        {profile.status}
                      </Badge>
                      <Badge variant="outline" data-testid={`badge-version-${profile.id}`}>v{profile.version}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{profile.description}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2">Base Resource Type</p>
                      <Badge variant="outline" data-testid={`badge-base-${profile.id}`}>{profile.baseResourceType}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Extensions ({profile.extensions?.length || 0})</p>
                      <div className="flex gap-1 flex-wrap">
                        {profile.extensions?.slice(0, 3).map((ext) => (
                          <Badge key={ext.url} variant="secondary" className="text-xs" data-testid={`badge-ext-${ext.name}`}>
                            {ext.name}
                          </Badge>
                        ))}
                        {(profile.extensions?.length || 0) > 3 && (
                          <Badge variant="secondary" className="text-xs">+{(profile.extensions?.length || 0) - 3} more</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-6" data-testid="content-mappings">
          {/* Wearable LOINC Mappings Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Wearable LOINC Code Mappings</h3>
            <Card data-testid="card-loinc-mappings">
              <CardHeader>
                <CardTitle className="text-base">Standard LOINC Codes for Wearable Data</CardTitle>
                <CardDescription>
                  {loincMappings?.count || 0} data types mapped to standardized LOINC codes for FHIR Observation resources
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {loincMappings?.mappings?.map((mapping) => (
                    <div key={mapping.dataType} className="flex items-start gap-3 p-3 rounded-md bg-muted/50" data-testid={`loinc-mapping-${mapping.dataType}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm capitalize">{mapping.dataType.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground truncate" title={mapping.display}>{mapping.display}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="font-mono text-xs" data-testid={`loinc-code-${mapping.code}`}>
                            {mapping.code}
                          </Badge>
                          <Badge variant="secondary" className="text-xs" data-testid={`loinc-unit-${mapping.dataType}`}>
                            {mapping.unit}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Mapping Presets Section */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Transformation Mapping Presets</h3>
            <Button variant="outline" data-testid="button-add-preset">
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Preset
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {presetsData?.presets?.map((preset) => (
              <Card key={preset.id} data-testid={`card-mapping-${preset.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{preset.name}</CardTitle>
                      {preset.isBuiltIn && <Badge variant="secondary" data-testid="badge-builtin-preset">Built-in</Badge>}
                    </div>
                    <Badge data-testid={`badge-type-${preset.id}`}>{preset.type}</Badge>
                  </div>
                  <CardDescription>{preset.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm font-medium mb-1">Source Type</p>
                      <Badge variant="outline" data-testid={`badge-source-type-${preset.id}`}>{preset.sourceType}</Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Target Resources</p>
                      <div className="flex gap-1 flex-wrap">
                        {preset.targetResourceTypes.map((rt) => (
                          <Badge key={rt} data-testid={`badge-target-resource-${rt}`}>{rt}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Mapping Rules</p>
                      <Badge variant="outline" data-testid={`badge-rules-count-${preset.id}`}>
                        {preset.mappingRules?.length || 0} rules
                      </Badge>
                    </div>
                  </div>
                  {preset.mappingRules && preset.mappingRules.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Sample Mappings</p>
                      <div className="space-y-1 bg-muted/50 p-3 rounded-md">
                        {preset.mappingRules.slice(0, 4).map((rule) => (
                          <div key={rule.id} className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-muted-foreground">{rule.sourcePath}</span>
                            <ArrowRightLeft className="h-3 w-3" />
                            <span>{rule.targetPath}</span>
                          </div>
                        ))}
                        {preset.mappingRules.length > 4 && (
                          <p className="text-xs text-muted-foreground">+{preset.mappingRules.length - 4} more rules</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
