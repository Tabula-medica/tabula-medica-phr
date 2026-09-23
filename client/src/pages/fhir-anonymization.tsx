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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Hash,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AnonymizationProfile {
  id: string;
  name: string;
  description: string;
  useCase: string;
  rules: AnonymizationRule[];
  preserveReferentialIntegrity: boolean;
  dateShiftDays?: number;
  createdAt: string;
}

interface AnonymizationRule {
  id: string;
  name: string;
  description: string;
  category: string;
  fhirPaths: string[];
  method: string;
  parameters?: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

interface AnonymizationResult {
  originalResource: Record<string, unknown>;
  anonymizedResource: Record<string, unknown>;
  appliedRules: string[];
  redactedFields: string[];
  transformedFields: Array<{ path: string; method: string }>;
  dataUtilityScore: number;
}

interface BatchJob {
  id: string;
  profileId: string;
  status: string;
  totalResources: number;
  processedResources: number;
  startedAt?: string;
  completedAt?: string;
  errors: Array<{ resourceId: string; error: string }>;
}

const useCaseColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  research: "default",
  testing: "secondary",
  training: "outline",
  analytics: "outline",
  custom: "secondary",
};

const methodIcons: Record<string, typeof EyeOff> = {
  redact: EyeOff,
  hash: Hash,
  generalize: Layers,
  date_shift: Clock,
  pseudonymize: Shield,
  mask: Eye,
};

export default function FhirAnonymization() {
  const [selectedTab, setSelectedTab] = useState("profiles");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-anonymization">
            <ShieldCheck className="h-8 w-8" />
            FHIR Data Anonymization
          </h1>
          <p className="text-muted-foreground mt-1">
            De-identify PHI for research, testing, and analytics use cases
          </p>
        </div>
        <StatsOverview />
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md" data-testid="tabs-list-anonymization">
          <TabsTrigger value="profiles" data-testid="tab-profiles">
            <Settings className="h-4 w-4 mr-2" />
            Profiles
          </TabsTrigger>
          <TabsTrigger value="anonymize" data-testid="tab-anonymize">
            <EyeOff className="h-4 w-4 mr-2" />
            Anonymize
          </TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">
            <Layers className="h-4 w-4 mr-2" />
            Jobs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4 mt-4">
          <ProfilesTab />
        </TabsContent>

        <TabsContent value="anonymize" className="space-y-4 mt-4">
          <AnonymizeTab />
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4 mt-4">
          <JobsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatsOverview() {
  const { data: statsData } = useQuery<{ success: boolean; data: { totalProfiles: number; totalJobs: number; completedJobs: number; pseudonymCount: number } }>({
    queryKey: ["/api/anonymization/stats"],
  });

  const stats = statsData?.data || { totalProfiles: 0, totalJobs: 0, completedJobs: 0, pseudonymCount: 0 };

  return (
    <div className="flex gap-4 flex-wrap">
      <div className="text-center">
        <p className="text-2xl font-bold" data-testid="text-stat-profiles">{stats.totalProfiles}</p>
        <p className="text-xs text-muted-foreground">Profiles</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold" data-testid="text-stat-jobs">{stats.totalJobs}</p>
        <p className="text-xs text-muted-foreground">Jobs</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-300" data-testid="text-stat-completed">{stats.completedJobs}</p>
        <p className="text-xs text-muted-foreground">Completed</p>
      </div>
    </div>
  );
}

function ProfilesTab() {
  const { toast } = useToast();

  const { data: profilesData, refetch, isLoading } = useQuery<{ success: boolean; data: AnonymizationProfile[] }>({
    queryKey: ["/api/anonymization/profiles"],
  });

  const { data: categoriesData } = useQuery<{ success: boolean; data: Array<{ category: string; description: string; hipaaIdentifier: boolean }> }>({
    queryKey: ["/api/anonymization/phi-categories"],
  });

  const profiles = profilesData?.data || [];
  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>De-identification Profiles</CardTitle>
            <CardDescription>Configure rules for anonymizing FHIR resources</CardDescription>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HIPAA Safe Harbor PHI Categories</CardTitle>
          <CardDescription>18 identifiers that must be removed or de-identified</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {categories.map((cat) => (
              <div key={cat.category} className="flex items-center gap-2 p-2 border rounded" data-testid={`category-${cat.category}`}>
                <Badge variant={cat.hipaaIdentifier ? "destructive" : "secondary"} className="text-xs">
                  {cat.hipaaIdentifier ? "HIPAA" : "Other"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat.category.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground truncate">{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileCard({ profile }: { profile: AnonymizationProfile }) {
  const [showDetails, setShowDetails] = useState(false);

  const enabledRules = profile.rules.filter(r => r.enabled);
  const methods = [...new Set(profile.rules.map(r => r.method))];

  return (
    <Card className="hover-elevate" data-testid={`card-profile-${profile.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">{profile.name}</CardTitle>
            <CardDescription className="line-clamp-2">{profile.description}</CardDescription>
          </div>
          <Badge variant={useCaseColors[profile.useCase] || "outline"}>
            {profile.useCase}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Rules</p>
            <p className="font-medium">{enabledRules.length}/{profile.rules.length}</p>
          </div>
          {profile.dateShiftDays && (
            <div>
              <p className="text-muted-foreground">Date Shift</p>
              <p className="font-medium">{profile.dateShiftDays}d</p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground">Ref. Integrity</p>
            <p className="font-medium">{profile.preserveReferentialIntegrity ? "Yes" : "No"}</p>
          </div>
        </div>

        <div className="flex gap-1 flex-wrap">
          {methods.slice(0, 4).map((method) => {
            const Icon = methodIcons[method] || Settings;
            return (
              <Badge key={method} variant="outline" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {method}
              </Badge>
            );
          })}
          {methods.length > 4 && (
            <Badge variant="outline" className="text-xs">+{methods.length - 4}</Badge>
          )}
        </div>

        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-profile-${profile.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View Rules
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{profile.name}</DialogTitle>
              <DialogDescription>{profile.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profile.rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.name}</p>
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{rule.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rule.method}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={rule.enabled ? "default" : "secondary"}>
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AnonymizeTab() {
  const [selectedProfile, setSelectedProfile] = useState("");
  const [inputJson, setInputJson] = useState("");
  const [result, setResult] = useState<AnonymizationResult | null>(null);
  const { toast } = useToast();

  const { data: profilesData } = useQuery<{ success: boolean; data: AnonymizationProfile[] }>({
    queryKey: ["/api/anonymization/profiles"],
  });

  const profiles = profilesData?.data || [];

  const anonymizeMutation = useMutation({
    mutationFn: async () => {
      const resource = JSON.parse(inputJson);
      const res = await apiRequest("POST", "/api/anonymization/anonymize", {
        resource,
        profileId: selectedProfile,
      });
      return res.json();
    },
    onSuccess: (data: { success: boolean; data: AnonymizationResult }) => {
      setResult(data.data);
      toast({ title: "Resource anonymized", description: `${data.data.appliedRules.length} rules applied` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to anonymize resource", variant: "destructive" });
    },
  });

  const samplePatient = JSON.stringify({
    resourceType: "Patient",
    id: "patient-12345",
    name: [{ family: "Smith", given: ["John", "Robert"] }],
    birthDate: "1985-03-15",
    gender: "male",
    address: [{
      line: ["123 Main Street"],
      city: "Boston",
      state: "MA",
      postalCode: "02101"
    }],
    telecom: [
      { system: "phone", value: "(555) 123-4567" },
      { system: "email", value: "john.smith@email.com" }
    ],
    identifier: [
      { system: "SSN", value: "123-45-6789" },
      { system: "MRN", value: "MRN-98765" }
    ]
  }, null, 2);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Input Resource</CardTitle>
            <CardDescription>Paste a FHIR resource JSON to anonymize</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fhir-anonymization-de-identification-profile">De-identification Profile</Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger id="fhir-anonymization-de-identification-profile" data-testid="select-profile">
                  <SelectValue placeholder="Select a profile" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldCaption>FHIR Resource JSON</FieldCaption>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setInputJson(samplePatient)}
                  data-testid="button-load-sample"
                >
                  Load Sample
                </Button>
              </div>
              <Textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                placeholder='{"resourceType": "Patient", ...}'
                className="font-mono text-sm h-[300px]"
                data-testid="textarea-input-json"
              />
            </div>

            <Button
              onClick={() => anonymizeMutation.mutate()}
              disabled={!selectedProfile || !inputJson || anonymizeMutation.isPending}
              className="w-full"
              data-testid="button-anonymize"
            >
              {anonymizeMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Anonymizing...
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Anonymize Resource
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Anonymized Result</CardTitle>
            {result && (
              <CardDescription>
                Data utility score: {Math.round(result.dataUtilityScore * 100)}%
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-4">
                <div className="flex gap-4 flex-wrap">
                  <div>
                    <p className="text-sm text-muted-foreground">Rules Applied</p>
                    <p className="text-lg font-bold" data-testid="text-rules-applied">{result.appliedRules.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fields Redacted</p>
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-300" data-testid="text-fields-redacted">{result.redactedFields.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fields Transformed</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-300" data-testid="text-fields-transformed">{result.transformedFields.length}</p>
                  </div>
                </div>

                {result.transformedFields.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Transformations:</p>
                    <div className="flex gap-1 flex-wrap">
                      {result.transformedFields.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {t.path}: {t.method}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <ScrollArea className="h-[250px] border rounded p-2">
                  <pre className="font-mono text-xs" data-testid="text-anonymized-output">
                    {JSON.stringify(result.anonymizedResource, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <ShieldCheck className="h-12 w-12 mb-4 opacity-50" />
                <p>Anonymized output will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function JobsTab() {
  const { data: jobsData, refetch, isLoading } = useQuery<{ success: boolean; data: BatchJob[] }>({
    queryKey: ["/api/anonymization/jobs"],
  });

  const jobs = jobsData?.data || [];

  const statusIcons: Record<string, typeof Clock> = {
    pending: Clock,
    in_progress: RefreshCw,
    completed: CheckCircle2,
    failed: XCircle,
  };

  const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "secondary",
    in_progress: "default",
    completed: "default",
    failed: "destructive",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle>Batch Anonymization Jobs</CardTitle>
          <CardDescription>Monitor batch de-identification operations</CardDescription>
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
            <p>No batch jobs found</p>
            <p className="text-sm">Use the API to start a batch anonymization job</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job ID</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Errors</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const StatusIcon = statusIcons[job.status] || Clock;
                const progress = job.totalResources > 0 
                  ? (job.processedResources / job.totalResources) * 100 
                  : 0;

                return (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-mono text-xs">{job.id.substring(0, 8)}...</TableCell>
                    <TableCell>{job.profileId}</TableCell>
                    <TableCell>
                      <Badge variant={statusColors[job.status]}>
                        <StatusIcon className="h-3 w-3 mr-1" />
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
                    <TableCell className="text-sm">
                      {job.startedAt ? new Date(job.startedAt).toLocaleString() : "-"}
                    </TableCell>
                    <TableCell>
                      {job.errors.length > 0 && (
                        <Badge variant="destructive">{job.errors.length}</Badge>
                      )}
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
