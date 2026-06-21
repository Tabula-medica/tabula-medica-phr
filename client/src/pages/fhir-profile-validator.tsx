import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  Info,
  Layers,
  Play,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FHIRProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  type: string;
  resourceType: string;
  description: string;
  constraints: Array<{ id: string; path: string; severity: string; human: string }>;
  required: string[];
  mustSupport: string[];
}

interface ValidationIssue {
  id: string;
  severity: string;
  path: string;
  message: string;
  constraint?: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  suggestion?: {
    type: string;
    description: string;
    suggestedValue?: unknown;
    profileAdjustment?: string;
  };
}

interface ValidationResult {
  id: string;
  resourceType: string;
  resourceId: string;
  profileId: string;
  profileName: string;
  valid: boolean;
  issues: ValidationIssue[];
  complianceScore: number;
  validatedAt: string;
  processingTimeMs: number;
}

interface ValidationJob {
  id: string;
  profileId: string;
  status: string;
  totalResources: number;
  processedResources: number;
  validCount: number;
  invalidCount: number;
  startedAt?: string;
  completedAt?: string;
}

const severityColors: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  error: "destructive",
  warning: "default",
  information: "secondary",
};

const severityIcons: Record<string, typeof AlertCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  information: Info,
};

export default function FhirProfileValidator() {
  const [selectedTab, setSelectedTab] = useState("validate");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-validator">
            <FileCheck className="h-8 w-8" />
            FHIR Profile Validator
          </h1>
          <p className="text-muted-foreground mt-1">
            Validate resources against standard and custom FHIR profiles
          </p>
        </div>
        <StatsOverview />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md" data-testid="tabs-list-validator">
          <TabsTrigger value="validate" data-testid="tab-validate">
            <ClipboardCheck className="h-4 w-4 mr-2" />
            Validate
          </TabsTrigger>
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Settings className="h-4 w-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Layers className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="validate" className="space-y-4 mt-4">
          <ValidateTab />
        </TabsContent>

        <TabsContent value="profiles" className="space-y-4 mt-4">
          <ProfilesTab />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4 mt-4">
          <JobsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsOverview() {
  const { data: statsData } = useQuery<{ success: boolean; data: { totalProfiles: number; standardProfiles: number; customProfiles: number; totalValidations: number } }>({
    queryKey: ["/api/profile-validator/stats"],
  });

  const stats = statsData?.data || { totalProfiles: 0, standardProfiles: 0, customProfiles: 0, totalValidations: 0 };

  return (
    <div className="flex gap-4 flex-wrap">
      <div className="text-center">
        <p className="text-2xl font-bold" data-testid="text-stat-profiles">{stats.totalProfiles}</p>
        <p className="text-xs text-muted-foreground">Profiles</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-sky-600 dark:text-sky-300" data-testid="text-stat-standard">{stats.standardProfiles}</p>
        <p className="text-xs text-muted-foreground">Standard</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-300" data-testid="text-stat-custom">{stats.customProfiles}</p>
        <p className="text-xs text-muted-foreground">Custom</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300" data-testid="text-stat-validations">{stats.totalValidations}</p>
        <p className="text-xs text-muted-foreground">Validations</p>
      </div>
    </div>
  );
}

function ValidateTab() {
  const [selectedProfile, setSelectedProfile] = useState("");
  const [inputJson, setInputJson] = useState("");
  const [result, setResult] = useState<ValidationResult | null>(null);
  const { toast } = useToast();

  const { data: profilesData } = useQuery<{ success: boolean; data: FHIRProfile[] }>({
    queryKey: ["/api/profile-validator/profiles"],
  });

  const profiles = profilesData?.data || [];

  const validateMutation = useMutation({
    mutationFn: async () => {
      const resource = JSON.parse(inputJson);
      const res = await apiRequest("POST", "/api/profile-validator/validate", {
        resource,
        profileId: selectedProfile,
      });
      return res.json();
    },
    onSuccess: (data: { success: boolean; data: ValidationResult }) => {
      setResult(data.data);
      toast({
        title: data.data.valid ? "Validation Passed" : "Validation Failed",
        description: `${data.data.issues.length} issues found, compliance score: ${data.data.complianceScore}%`,
        variant: data.data.valid ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to validate resource", variant: "destructive" });
    },
  });

  const samplePatient = JSON.stringify({
    resourceType: "Patient",
    id: "example-patient",
    identifier: [{ system: "http://hospital.org/mrn", value: "12345" }],
    name: [{ family: "Smith", given: ["John"] }],
    gender: "male",
    birthDate: "1985-03-15",
  }, null, 2);

  const sampleObservation = JSON.stringify({
    resourceType: "Observation",
    id: "example-obs",
    status: "final",
    code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body Weight" }] },
    subject: { reference: "Patient/example-patient" },
    valueQuantity: { value: 70, unit: "kg" },
  }, null, 2);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resource Validation</CardTitle>
            <CardDescription>Validate a FHIR resource against a profile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>FHIR Profile</Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger data-testid="select-profile">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2">
                        <Badge variant={p.type === "standard" ? "default" : "secondary"} className="text-xs">
                          {p.type}
                        </Badge>
                        {p.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>FHIR Resource JSON</Label>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setInputJson(samplePatient)}
                    data-testid="button-load-patient"
                  >
                    Patient
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setInputJson(sampleObservation)}
                    data-testid="button-load-observation"
                  >
                    Observation
                  </Button>
                </div>
              </div>
              <Textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                placeholder='{"resourceType": "Patient", ...}'
                className="font-mono text-sm h-[280px]"
                data-testid="textarea-input-json"
              />
            </div>

            <Button
              onClick={() => validateMutation.mutate()}
              disabled={!selectedProfile || !inputJson || validateMutation.isPending}
              className="w-full"
              data-testid="button-validate"
            >
              {validateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Validate Resource
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Validation Result
              {result && (
                <Badge variant={result.valid ? "default" : "destructive"}>
                  {result.valid ? "VALID" : "INVALID"}
                </Badge>
              )}
            </CardTitle>
            {result && (
              <CardDescription>
                Compliance score: {result.complianceScore}% | {result.processingTimeMs}ms
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    {result.valid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <XCircle className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                    )}
                    <span className="font-medium">{result.valid ? "Valid" : "Invalid"}</span>
                  </div>
                  <div>
                    <Progress value={result.complianceScore} className="w-24 h-2" />
                    <span className="text-xs text-muted-foreground">{result.complianceScore}%</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {["error", "warning", "information"].map((sev) => {
                    const count = result.issues.filter(i => i.severity === sev).length;
                    if (count === 0) return null;
                    const Icon = severityIcons[sev];
                    return (
                      <Badge key={sev} variant={severityColors[sev]}>
                        <Icon className="h-3 w-3 mr-1" />
                        {count} {sev}
                      </Badge>
                    );
                  })}
                </div>

                <ScrollArea className="h-[280px]">
                  <Accordion type="multiple" className="w-full">
                    {result.issues.map((issue, idx) => {
                      const Icon = severityIcons[issue.severity] || Info;
                      return (
                        <AccordionItem key={issue.id} value={issue.id} data-testid={`issue-${idx}`}>
                          <AccordionTrigger className="text-sm py-2">
                            <div className="flex items-center gap-2 text-left">
                              <Icon className={`h-4 w-4 ${
                                issue.severity === "error" ? "text-rose-600 dark:text-rose-300" :
                                issue.severity === "warning" ? "text-amber-600 dark:text-amber-300" :
                                "text-sky-600 dark:text-sky-300"
                              }`} />
                              <span className="font-mono text-xs">{issue.path}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 text-sm pl-6">
                              <p>{issue.message}</p>
                              {issue.constraint && (
                                <p className="text-xs text-muted-foreground">Constraint: {issue.constraint}</p>
                              )}
                              {issue.suggestion && (
                                <div className="bg-muted p-2 rounded mt-2">
                                  <div className="flex items-center gap-1 text-xs font-medium mb-1">
                                    <Sparkles className="h-3 w-3" />
                                    Suggestion
                                  </div>
                                  <p className="text-xs">{issue.suggestion.description}</p>
                                  {issue.suggestion.suggestedValue !== undefined && (
                                    <pre className="text-xs mt-1 bg-background p-1 rounded overflow-x-auto">
                                      {typeof issue.suggestion.suggestedValue === "object" 
                                        ? JSON.stringify(issue.suggestion.suggestedValue, null, 2)
                                        : String(issue.suggestion.suggestedValue)}
                                    </pre>
                                  )}
                                  {issue.suggestion.profileAdjustment && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {issue.suggestion.profileAdjustment}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <FileCheck className="h-12 w-12 mb-4 opacity-50" />
                <p>Validation results will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProfilesTab() {
  const { data: profilesData, refetch, isLoading } = useQuery<{ success: boolean; data: FHIRProfile[] }>({
    queryKey: ["/api/profile-validator/profiles"],
  });

  const profiles = profilesData?.data || [];
  const standardProfiles = profiles.filter(p => p.type === "standard");
  const customProfiles = profiles.filter(p => p.type === "custom");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>FHIR Profiles</CardTitle>
            <CardDescription>Standard and custom validation profiles</CardDescription>
          </div>
          <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-profiles">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              <span className="text-muted-foreground">Loading profiles...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Standard Profiles ({standardProfiles.length})
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {standardProfiles.map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </div>

              {customProfiles.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Custom Profiles ({customProfiles.length})
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {customProfiles.map((profile) => (
                      <ProfileCard key={profile.id} profile={profile} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileCard({ profile }: { profile: FHIRProfile }) {
  return (
    <Card className="hover-elevate" data-testid={`card-profile-${profile.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{profile.name}</CardTitle>
            <CardDescription className="text-xs line-clamp-2">{profile.description}</CardDescription>
          </div>
          <Badge variant={profile.type === "standard" ? "default" : "secondary"}>
            {profile.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Resource</p>
            <Badge variant="outline">{profile.resourceType}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Version</p>
            <p className="font-medium">{profile.version}</p>
          </div>
        </div>

        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Required</p>
            <p className="font-medium">{profile.required.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Must Support</p>
            <p className="font-medium">{profile.mustSupport.length}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Constraints</p>
            <p className="font-medium">{profile.constraints.length}</p>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {profile.required.slice(0, 3).map((field) => (
            <Badge key={field} variant="outline" className="text-xs">
              {field}
            </Badge>
          ))}
          {profile.required.length > 3 && (
            <Badge variant="outline" className="text-xs">+{profile.required.length - 3}</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JobsTab() {
  const { data: jobsData, refetch, isLoading } = useQuery<{ success: boolean; data: ValidationJob[] }>({
    queryKey: ["/api/profile-validator/jobs"],
  });

  const jobs = jobsData?.data || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Batch Validation Jobs</CardTitle>
          <CardDescription>Monitor batch validation operations</CardDescription>
        </div>
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-jobs">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-muted-foreground">Loading jobs...</span>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Layers className="h-12 w-12 mb-4 opacity-50" />
            <p>No batch validation jobs found</p>
            <p className="text-sm">Use the API to start a batch validation job</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Valid</TableHead>
                <TableHead>Invalid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const progress = job.totalResources > 0 
                  ? (job.processedResources / job.totalResources) * 100 
                  : 0;

                return (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                    <TableCell>{job.profileId}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === "completed" ? "default" : "secondary"}>
                        {job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="w-24">
                        <Progress value={progress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {job.processedResources}/{job.totalResources}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-emerald-600">{job.validCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive">{job.invalidCount}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
