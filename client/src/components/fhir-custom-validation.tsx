import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileCheck,
  Upload,
  Link,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  FileText,
  Sparkles,
  RefreshCw,
  Trash2,
  Shield,
  Database,
  Lightbulb,
  Download,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
} from "lucide-react";

interface ElementDefinition {
  path: string;
  min: number;
  max: string;
  type?: string[];
  mustSupport?: boolean;
  binding?: {
    strength: string;
    valueSet?: string;
  };
}

interface Profile {
  id: string;
  name: string;
  url: string;
  version: string;
  description: string;
  type: string;
  baseDefinition?: string;
  status: "draft" | "active" | "retired";
  uploadedAt: string;
  uploadMethod: "file" | "url" | "manual";
  elementDefinitions: ElementDefinition[];
}

interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "information";
  type: string;
  path: string;
  message: string;
  details: string;
  element?: string;
  expectedValue?: string;
  actualValue?: string;
  suggestion?: string;
}

interface ValidationReport {
  id: string;
  resourceId: string;
  resourceType: string;
  profileId: string;
  profileName: string;
  validatedAt: string;
  isValid: boolean;
  overallScore: number;
  summary: string;
  issues: ValidationIssue[];
  statistics: {
    totalElements: number;
    validElements: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  };
  aiInsights: {
    criticalFindings: string[];
    recommendations: string[];
    complianceNotes: string[];
  };
}

interface Statistics {
  totalProfiles: number;
  customProfiles: number;
  builtInProfiles: number;
  totalValidations: number;
  validResources: number;
  invalidResources: number;
}

export function FHIRCustomValidation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("profiles");
  const [resourceJson, setResourceJson] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [expandedReport, setExpandedReport] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profiles = [], isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/fhir-custom-validation/profiles"],
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<ValidationReport[]>({
    queryKey: ["/api/fhir-custom-validation/reports"],
  });

  const { data: statistics } = useQuery<Statistics>({
    queryKey: ["/api/fhir-custom-validation/statistics"],
  });

  const uploadProfileMutation = useMutation({
    mutationFn: async (data: { content: string; fileName: string }) => {
      const response = await apiRequest("POST", "/api/fhir-custom-validation/profiles/upload", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/statistics"] });
      toast({ title: "Profile uploaded successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const importUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/fhir-custom-validation/profiles/import-url", { url });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/statistics"] });
      setProfileUrl("");
      toast({ title: "Profile imported successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-custom-validation/profiles/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/statistics"] });
      toast({ title: "Profile deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (data: { resource: Record<string, unknown>; profileId: string }) => {
      const response = await apiRequest("POST", "/api/fhir-custom-validation/validate", data);
      return response.json();
    },
    onSuccess: (report: ValidationReport) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-custom-validation/statistics"] });
      setExpandedReport(report.id);
      setActiveTab("reports");
      toast({
        title: report.isValid ? "Resource is valid" : "Validation issues found",
        description: `Score: ${report.overallScore}% - ${report.statistics.errorCount} errors, ${report.statistics.warningCount} warnings`,
        variant: report.isValid ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Validation failed", description: error.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      uploadProfileMutation.mutate({ content, fileName: file.name });
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleValidate = () => {
    if (!resourceJson.trim()) {
      toast({ title: "Please enter a FHIR resource", variant: "destructive" });
      return;
    }
    if (!selectedProfileId) {
      toast({ title: "Please select a profile", variant: "destructive" });
      return;
    }

    try {
      const resource = JSON.parse(resourceJson);
      validateMutation.mutate({ resource, profileId: selectedProfileId });
    } catch {
      toast({ title: "Invalid JSON", description: "Please enter valid JSON", variant: "destructive" });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const sampleResource = `{
  "resourceType": "Patient",
  "id": "example-patient",
  "identifier": [
    {
      "system": "http://hospital.org/patients",
      "value": "12345"
    }
  ],
  "name": [
    {
      "family": "Smith",
      "given": ["John"]
    }
  ],
  "gender": "male",
  "birthDate": "1990-01-15"
}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">FHIR Custom Validation</h1>
          <p className="text-muted-foreground mt-1">
            Validate FHIR resources against custom StructureDefinition profiles with AI insights
          </p>
        </div>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI-Powered
        </Badge>
      </div>

      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalProfiles}</p>
                  <p className="text-xs text-muted-foreground">Total Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.customProfiles}</p>
                  <p className="text-xs text-muted-foreground">Custom Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.validResources}</p>
                  <p className="text-xs text-muted-foreground">Valid Resources</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{statistics.invalidResources}</p>
                  <p className="text-xs text-muted-foreground">Invalid Resources</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Database className="h-4 w-4 mr-2" />
            Profiles ({profiles.length})
          </TabsTrigger>
          <TabsTrigger value="validate" data-testid="tab-validate">
            <FileCheck className="h-4 w-4 mr-2" />
            Validate
          </TabsTrigger>
          <TabsTrigger value="reports" data-testid="tab-reports">
            <FileText className="h-4 w-4 mr-2" />
            Reports ({reports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Add Custom Profile
              </CardTitle>
              <CardDescription>
                Upload a StructureDefinition file or import from a URL
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fhir-custom-validation-upload-file">Upload File</Label>
                  <div className="flex gap-2">
                    <input id="fhir-custom-validation-upload-file"
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadProfileMutation.isPending}
                      data-testid="btn-upload-file"
                    >
                      {uploadProfileMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Select StructureDefinition JSON
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fhir-custom-validation-import-from-url">Import from URL</Label>
                  <div className="flex gap-2">
                    <Input id="fhir-custom-validation-import-from-url"
                      placeholder="https://example.org/StructureDefinition/my-profile"
                      value={profileUrl}
                      onChange={(e) => setProfileUrl(e.target.value)}
                      data-testid="input-profile-url"
                    />
                    <Button
                      onClick={() => importUrlMutation.mutate(profileUrl)}
                      disabled={!profileUrl || importUrlMutation.isPending}
                      data-testid="btn-import-url"
                    >
                      {importUrlMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {profilesLoading ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">Loading profiles...</p>
                </CardContent>
              </Card>
            ) : profiles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Database className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground mt-2">No profiles available</p>
                </CardContent>
              </Card>
            ) : (
              profiles.map((profile) => (
                <Card key={profile.id} data-testid={`card-profile-${profile.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Shield className="h-4 w-4 text-primary" />
                          {profile.name}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{profile.type}</Badge>
                          <Badge variant="secondary">{profile.version}</Badge>
                          <Badge
                            variant={
                              profile.status === "active"
                                ? "default"
                                : profile.status === "draft"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {profile.status}
                          </Badge>
                          {profile.uploadMethod !== "manual" && (
                            <Badge variant="outline" className="text-xs">
                              {profile.uploadMethod === "file" ? "Uploaded" : "Imported"}
                            </Badge>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
                        >
                          {expandedProfile === profile.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                        {profile.uploadMethod !== "manual" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteProfileMutation.mutate(profile.id)}
                            disabled={deleteProfileMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {expandedProfile === profile.id && (
                    <CardContent className="pt-0 space-y-3">
                      <p className="text-sm text-muted-foreground">{profile.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ExternalLink className="h-3 w-3" />
                        <span className="font-mono truncate">{profile.url}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-5 w-5"
                          onClick={() => navigator.clipboard.writeText(profile.url)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {profile.baseDefinition && (
                        <p className="text-xs text-muted-foreground">
                          Base: <span className="font-mono">{profile.baseDefinition}</span>
                        </p>
                      )}
                      <Separator />
                      <div>
                        <p className="text-sm font-medium mb-2">
                          Element Definitions ({profile.elementDefinitions.length})
                        </p>
                        <ScrollArea className="h-40">
                          <div className="space-y-1">
                            {profile.elementDefinitions.map((elem, idx) => (
                              <div
                                key={idx}
                                className="text-xs font-mono bg-muted px-2 py-1 rounded flex items-center justify-between"
                              >
                                <span>{elem.path}</span>
                                <div className="flex items-center gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {elem.min}..{elem.max}
                                  </Badge>
                                  {elem.mustSupport && (
                                    <Badge className="text-xs bg-blue-500">MS</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="validate" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  FHIR Resource
                </CardTitle>
                <CardDescription>
                  Paste or enter the FHIR resource JSON to validate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your FHIR resource JSON here..."
                  value={resourceJson}
                  onChange={(e) => setResourceJson(e.target.value)}
                  className="min-h-[300px] font-mono text-sm"
                  data-testid="textarea-resource-json"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResourceJson(sampleResource)}
                  data-testid="btn-load-sample"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Load Sample Patient
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Validation Settings
                </CardTitle>
                <CardDescription>
                  Select the profile to validate against
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fhir-custom-validation-profile">Profile</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger id="fhir-custom-validation-profile" data-testid="select-profile">
                      <SelectValue placeholder="Select a profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name} ({profile.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProfileId && (
                  <div className="bg-muted rounded-lg p-3 space-y-2">
                    <p className="text-sm font-medium">
                      {profiles.find((p) => p.id === selectedProfileId)?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profiles.find((p) => p.id === selectedProfileId)?.description}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">
                        {profiles.find((p) => p.id === selectedProfileId)?.type}
                      </Badge>
                      <Badge variant="secondary">
                        {profiles.find((p) => p.id === selectedProfileId)?.version}
                      </Badge>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleValidate}
                  disabled={validateMutation.isPending || !resourceJson || !selectedProfileId}
                  data-testid="btn-validate"
                >
                  {validateMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <FileCheck className="h-4 w-4 mr-2" />
                      Validate Resource
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          {reportsLoading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">Loading reports...</p>
              </CardContent>
            </Card>
          ) : reports.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground mt-2">No validation reports yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab("validate")}
                >
                  Validate a Resource
                </Button>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => (
              <Card key={report.id} data-testid={`card-report-${report.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {report.isValid ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                        {report.resourceType}/{report.resourceId}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-1">
                        <span>Validated against {report.profileName}</span>
                        <Badge variant={report.isValid ? "default" : "destructive"}>
                          {report.overallScore}% Score
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {report.statistics.errorCount > 0 && (
                          <Badge variant="destructive">{report.statistics.errorCount} errors</Badge>
                        )}
                        {report.statistics.warningCount > 0 && (
                          <Badge className="bg-yellow-500">{report.statistics.warningCount} warnings</Badge>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                      >
                        {expandedReport === report.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expandedReport === report.id && (
                  <CardContent className="pt-0 space-y-4">
                    <p className="text-sm">{report.summary}</p>

                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            Critical Findings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          {report.aiInsights.criticalFindings.length > 0 ? (
                            <ul className="text-xs space-y-1">
                              {report.aiInsights.criticalFindings.map((finding, idx) => (
                                <li key={idx} className="flex items-start gap-1">
                                  <XCircle className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                                  <span>{finding}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No critical findings</p>
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-yellow-500" />
                            Recommendations
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="text-xs space-y-1">
                            {report.aiInsights.recommendations.map((rec, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 shrink-0" />
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Info className="h-4 w-4 text-blue-500" />
                            Compliance Notes
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ul className="text-xs space-y-1">
                            {report.aiInsights.complianceNotes.map((note, idx) => (
                              <li key={idx} className="flex items-start gap-1">
                                <Info className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">Validation Issues ({report.issues.length})</h4>
                      <ScrollArea className="h-60">
                        <div className="space-y-2">
                          {report.issues.map((issue) => (
                            <div
                              key={issue.id}
                              className="border rounded-lg p-3 space-y-2"
                              data-testid={`issue-${issue.id}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                  {getSeverityIcon(issue.severity)}
                                  <span className="font-mono text-sm">{issue.path}</span>
                                </div>
                                {getSeverityBadge(issue.severity)}
                              </div>
                              <p className="text-sm font-medium">{issue.message}</p>
                              <p className="text-xs text-muted-foreground">{issue.details}</p>
                              {issue.suggestion && (
                                <div className="bg-muted rounded px-2 py-1 text-xs flex items-start gap-1">
                                  <Lightbulb className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
                                  <span>{issue.suggestion}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
