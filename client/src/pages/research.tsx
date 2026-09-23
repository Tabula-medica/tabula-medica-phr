import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/shared";
import { 
  FlaskConical, 
  Shield, 
  Download, 
  Trash2, 
  FileJson, 
  FileSpreadsheet,
  Settings,
  BarChart3,
  Clock,
  Database,
  Eye,
  Lock,
  AlertTriangle,
  CheckCircle,
  Info,
} from "lucide-react";
import type {
  ResearchPreferences,
  DeidentifiedDataset,
  DeidentificationMethod,
  ResearchPurpose,
  DataCategory,
} from "@shared/schema";
import {
  deidentificationMethodLabels,
  researchPurposeLabels,
  dataCategoryLabels,
  phiIdentifierLabels,
} from "@shared/schema";

const methodLabels = deidentificationMethodLabels;
const purposeLabels = researchPurposeLabels;
const categoryLabels = dataCategoryLabels;

export default function ResearchPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: preferences, isLoading: prefsLoading } = useQuery<ResearchPreferences>({
    queryKey: ["/api/research/preferences"],
  });

  const { data: datasets, isLoading: datasetsLoading } = useQuery<DeidentifiedDataset[]>({
    queryKey: ["/api/research/datasets"],
  });

  const { data: stats } = useQuery<{
    totalDatasets: number;
    totalRecordsShared: number;
    totalDownloads: number;
    purposeBreakdown: Record<string, number>;
  }>({
    queryKey: ["/api/research/stats"],
  });

  const updatePrefsMutation = useMutation({
    mutationFn: async (prefs: Partial<ResearchPreferences>) => {
      return apiRequest("PUT", "/api/research/preferences", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/preferences"] });
      toast({ title: "Preferences updated" });
    },
  });

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Research Data"
        subtitle="Manage de-identified health data for research and population analytics"
        icon={<FlaskConical className="h-6 w-6" />}
        data-testid="text-research-title"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="preferences" data-testid="tab-preferences">
            <Settings className="h-4 w-4 mr-2" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="datasets" data-testid="tab-datasets">
            <Database className="h-4 w-4 mr-2" />
            Datasets
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Shield className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab stats={stats} datasets={datasets} preferences={preferences} />
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <PreferencesTab 
            preferences={preferences} 
            isLoading={prefsLoading}
            onUpdate={(prefs) => updatePrefsMutation.mutate(prefs)}
            isPending={updatePrefsMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="datasets" className="space-y-6">
          <DatasetsTab datasets={datasets || []} isLoading={datasetsLoading} />
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <GenerateTab preferences={preferences} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ 
  stats, 
  datasets, 
  preferences 
}: { 
  stats?: { totalDatasets: number; totalRecordsShared: number; totalDownloads: number; purposeBreakdown: Record<string, number> };
  datasets?: DeidentifiedDataset[];
  preferences?: ResearchPreferences;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Research Status</CardTitle>
            {preferences?.allowResearch ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-research-status">
              {preferences?.allowResearch ? "Enabled" : "Disabled"}
            </div>
            <p className="text-xs text-muted-foreground">
              {preferences?.allowMonetization ? "With monetization" : "No monetization"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Datasets Created</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-datasets-count">
              {stats?.totalDatasets || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalRecordsShared || 0} total records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-downloads-count">
              {stats?.totalDownloads || 0}
            </div>
            <p className="text-xs text-muted-foreground">All time downloads</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">De-ID Method</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-preferred-method">
              {preferences?.preferredMethod === "safe_harbor" ? "Safe Harbor" :
               preferences?.preferredMethod === "expert_determination" ? "Expert" :
               preferences?.preferredMethod === "limited_dataset" ? "Limited" : "None"}
            </div>
            <p className="text-xs text-muted-foreground">Preferred method</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HIPAA Safe Harbor Method</CardTitle>
          <CardDescription>
            The Safe Harbor method removes all 18 types of identifiers specified by HIPAA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(phiIdentifierLabels).map(([key, { label }]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!preferences?.allowResearch && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <Info className="h-5 w-5" />
              Research Data Sharing Disabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Your health data is not currently shared for research purposes. Enable research 
              data sharing in the Preferences tab to contribute to medical research while 
              maintaining your privacy through de-identification.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PreferencesTab({ 
  preferences, 
  isLoading, 
  onUpdate,
  isPending,
}: { 
  preferences?: ResearchPreferences;
  isLoading: boolean;
  onUpdate: (prefs: Partial<ResearchPreferences>) => void;
  isPending: boolean;
}) {
  const [localPrefs, setLocalPrefs] = useState<Partial<ResearchPreferences>>({});

  const currentPrefs = { ...preferences, ...localPrefs };

  const handleToggle = (key: keyof ResearchPreferences, value: boolean) => {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    onUpdate({ ...currentPrefs, ...updated });
  };

  const handleMethodChange = (method: DeidentificationMethod) => {
    const updated = { ...localPrefs, preferredMethod: method };
    setLocalPrefs(updated);
    onUpdate({ ...currentPrefs, ...updated });
  };

  const handlePurposeToggle = (purpose: ResearchPurpose, enabled: boolean) => {
    const currentPurposes = currentPrefs.allowedPurposes || [];
    const newPurposes = enabled 
      ? [...currentPurposes, purpose]
      : currentPurposes.filter(p => p !== purpose);
    const updated = { ...localPrefs, allowedPurposes: newPurposes };
    setLocalPrefs(updated);
    onUpdate({ ...currentPrefs, ...updated });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading preferences...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Research Participation</CardTitle>
          <CardDescription>
            Control whether your de-identified health data can be used for research
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FieldCaption>Allow Research Data Sharing</FieldCaption>
              <p className="text-sm text-muted-foreground">
                Enable sharing of de-identified health data for medical research
              </p>
            </div>
            <Switch
              checked={currentPrefs.allowResearch || false}
              onCheckedChange={(v) => handleToggle("allowResearch", v)}
              disabled={isPending}
              data-testid="switch-allow-research"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FieldCaption>Allow Monetization</FieldCaption>
              <p className="text-sm text-muted-foreground">
                If enabled, your de-identified data may be used in paid research studies
              </p>
            </div>
            <Switch
              checked={currentPrefs.allowMonetization || false}
              onCheckedChange={(v) => handleToggle("allowMonetization", v)}
              disabled={isPending || !currentPrefs.allowResearch}
              data-testid="switch-allow-monetization"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <FieldCaption>Require Notification</FieldCaption>
              <p className="text-sm text-muted-foreground">
                Get notified when your data is used in a research study
              </p>
            </div>
            <Switch
              checked={currentPrefs.requireNotification ?? true}
              onCheckedChange={(v) => handleToggle("requireNotification", v)}
              disabled={isPending || !currentPrefs.allowResearch}
              data-testid="switch-require-notification"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferred De-identification Method</CardTitle>
          <CardDescription>
            Choose the default method for protecting your identity in research data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.entries(methodLabels) as [DeidentificationMethod, { label: string; description: string }][]).map(([method, { label, description }]) => (
              <Card 
                key={method}
                className={`cursor-pointer transition-colors ${currentPrefs.preferredMethod === method ? 'border-primary bg-primary/5' : 'hover-elevate'}`}
                onClick={() => handleMethodChange(method)}
                data-testid={`card-method-${method}`}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    {label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Research Purposes</CardTitle>
          <CardDescription>
            Select which types of research studies can use your de-identified data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {(Object.entries(purposeLabels) as [ResearchPurpose, string][]).map(([purpose, label]) => (
              <div key={purpose} className="flex items-center gap-3">
                <Checkbox
                  id={`purpose-${purpose}`}
                  checked={currentPrefs.allowedPurposes?.includes(purpose) || false}
                  onCheckedChange={(checked) => handlePurposeToggle(purpose, !!checked)}
                  disabled={isPending || !currentPrefs.allowResearch}
                  data-testid={`checkbox-purpose-${purpose}`}
                />
                <Label htmlFor={`purpose-${purpose}`} className="cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DatasetsTab({ 
  datasets, 
  isLoading 
}: { 
  datasets: DeidentifiedDataset[];
  isLoading: boolean;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/research/datasets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/stats"] });
      toast({ title: "Dataset deleted" });
    },
  });

  const handleDownload = async (id: string, format: "json" | "csv") => {
    window.open(`/api/research/datasets/${id}/download?format=${format}`, "_blank");
    toast({ title: `Downloading ${format.toUpperCase()} file...` });
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading datasets...</div>;
  }

  if (datasets.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Datasets Created</h3>
          <p className="text-muted-foreground mt-2">
            Generate your first de-identified dataset in the Generate tab
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {datasets.map((dataset) => (
        <Card key={dataset.id} data-testid={`card-dataset-${dataset.id}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-lg">
                  {purposeLabels[dataset.purpose as ResearchPurpose] || dataset.purpose}
                </CardTitle>
                <Badge variant={dataset.status === "completed" ? "default" : "secondary"}>
                  {dataset.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(dataset.id, "json")}
                  disabled={dataset.status !== "completed"}
                  data-testid={`button-download-json-${dataset.id}`}
                >
                  <FileJson className="h-4 w-4 mr-1" />
                  JSON
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(dataset.id, "csv")}
                  disabled={dataset.status !== "completed"}
                  data-testid={`button-download-csv-${dataset.id}`}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(dataset.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`button-delete-${dataset.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <CardDescription>
              Method: {methodLabels[dataset.method]?.label || dataset.method}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4 text-sm">
              <div>
                <span className="text-muted-foreground">Records</span>
                <p className="font-medium">{dataset.recordCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Downloads</span>
                <p className="font-medium">{dataset.downloadCount}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium">
                  {new Date(dataset.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires</span>
                <p className="font-medium">
                  {dataset.expiresAt ? new Date(dataset.expiresAt).toLocaleDateString() : "Never"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <span className="text-sm text-muted-foreground">Data Categories:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {dataset.dataCategories.map((cat) => (
                  <Badge key={cat} variant="outline" className="text-xs">
                    {categoryLabels[cat as DataCategory]?.label || cat}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GenerateTab({ preferences }: { preferences?: ResearchPreferences }) {
  const { toast } = useToast();
  const [method, setMethod] = useState<DeidentificationMethod>("safe_harbor");
  const [purpose, setPurpose] = useState<ResearchPurpose>("population_health");
  const [categories, setCategories] = useState<DataCategory[]>(["medications", "conditions"]);
  const [dateShiftDays, setDateShiftDays] = useState(30);

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/research/datasets", {
        method,
        purpose,
        categories,
        dateShiftDays,
        ageThreshold: 89,
        zipCodeTruncation: 3,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/research/datasets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/research/stats"] });
      toast({ title: "Dataset generated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate dataset", description: error.message, variant: "destructive" });
    },
  });

  const toggleCategory = (cat: DataCategory) => {
    setCategories(prev => 
      prev.includes(cat) 
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  if (!preferences?.allowResearch) {
    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle className="h-5 w-5" />
            Research Data Sharing Disabled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You must enable research data sharing in the Preferences tab before 
            generating de-identified datasets.
          </p>
          <Button variant="outline" onClick={() => {}}>
            Go to Preferences
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate De-identified Dataset</CardTitle>
          <CardDescription>
            Create a new de-identified export of your health data for research purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="research-de-identification-method">De-identification Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as DeidentificationMethod)}>
              <SelectTrigger id="research-de-identification-method" data-testid="select-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(methodLabels) as [DeidentificationMethod, { label: string; description: string }][]).map(([m, { label }]) => (
                  <SelectItem key={m} value={m}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {methodLabels[method]?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="research-research-purpose">Research Purpose</Label>
            <Select value={purpose} onValueChange={(v) => setPurpose(v as ResearchPurpose)}>
              <SelectTrigger id="research-research-purpose" data-testid="select-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(purposeLabels) as [ResearchPurpose, string][]).map(([p, label]) => (
                  <SelectItem key={p} value={p}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldCaption>Data Categories to Include</FieldCaption>
            <div className="grid gap-3 md:grid-cols-3">
              {(Object.entries(categoryLabels) as [DataCategory, { label: string; description: string }][]).map(([cat, { label }]) => (
                <div key={cat} className="flex items-center gap-2">
                  <Checkbox aria-label="Data Categories to Include"
                    id={`gen-cat-${cat}`}
                    checked={categories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                    data-testid={`checkbox-category-${cat}`}
                  />
                  <Label htmlFor={`gen-cat-${cat}`} className="cursor-pointer text-sm">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="research-date-shift-days">Date Shift (Days)</Label>
            <p className="text-sm text-muted-foreground mb-2">
              All dates will be shifted by this many days to prevent re-identification
            </p>
            <Select 
              value={dateShiftDays.toString()} 
              onValueChange={(v) => setDateShiftDays(parseInt(v))}
            >
              <SelectTrigger id="research-date-shift-days" className="w-[200px]" data-testid="select-date-shift">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No shift (year only)</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="180">180 days</SelectItem>
                <SelectItem value="365">365 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || categories.length === 0}
            data-testid="button-generate-dataset"
          >
            {generateMutation.isPending ? (
              <>Generating...</>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Generate De-identified Dataset
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            About De-identification
          </CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p>
            De-identification is the process of removing personal identifiers from health 
            data so it can be used for research without compromising patient privacy.
          </p>
          <h4>Safe Harbor Method</h4>
          <p>
            Removes all 18 types of identifiers specified by HIPAA, including names, 
            addresses, dates (except year), phone numbers, email addresses, Social Security 
            numbers, and more.
          </p>
          <h4>Expert Determination</h4>
          <p>
            Uses statistical methods to ensure the risk of re-identification is very small. 
            This may retain more data elements while still protecting privacy.
          </p>
          <h4>Limited Data Set</h4>
          <p>
            Removes direct identifiers but may retain dates and geographic data at the 
            state level. Requires a Data Use Agreement for access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
