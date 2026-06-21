import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  Activity, 
  Syringe, 
  Database, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Info,
  ExternalLink,
  Sparkles,
  MapPin,
  Calendar,
  BarChart3
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CDCOutbreakAlert {
  id: string;
  disease: string;
  location: string;
  caseCount: number;
  dateReported: string;
  status: "active" | "monitoring" | "resolved";
  severity: "low" | "moderate" | "high" | "critical";
  affectedPopulation: string;
  preventionMeasures: string[];
  cdcUrl?: string;
}

interface CDCFluData {
  id: string;
  region: string;
  week: string;
  season: string;
  activityLevel: "minimal" | "low" | "moderate" | "high" | "very_high";
  iliRate: number;
  positivityRate: number;
  predominantStrain: string;
  hospitalizations: number;
  trend: "increasing" | "stable" | "decreasing" | "peaking";
}

interface CDCVaccinationData {
  id: string;
  vaccineType: string;
  ageGroup: string;
  location: string;
  coverageRate: number;
  targetRate: number;
  trend: "increasing" | "stable" | "decreasing";
  reportingPeriod: string;
  lastUpdated: string;
}

interface CDCDataset {
  id: string;
  name: string;
  description: string;
  category: string;
  datasetId: string;
  lastUpdated: string;
}

interface CDCDashboard {
  lastRefreshed: string;
  availableDatasets: CDCDataset[];
  recentAlerts: CDCOutbreakAlert[];
  fluSummary: CDCFluData[];
  vaccinationHighlights: CDCVaccinationData[];
  aiSummary?: string;
  noCdsDisclaimer: string;
}

function getSeverityVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive";
    case "moderate":
      return "default";
    default:
      return "secondary";
  }
}

function getActivityVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "very_high":
    case "high":
      return "destructive";
    case "moderate":
      return "default";
    default:
      return "secondary";
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "increasing":
      return <TrendingUp className="h-4 w-4 text-red-500" />;
    case "decreasing":
      return <TrendingDown className="h-4 w-4 text-green-500" />;
    case "peaking":
      return <TrendingUp className="h-4 w-4 text-orange-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function CDCFeeds() {
  const [selectedDataset, setSelectedDataset] = useState<string>("");
  const [fluRegionFilter, setFluRegionFilter] = useState<string>("all");

  const { data: dashboard, isLoading: dashboardLoading, refetch } = useQuery<CDCDashboard>({
    queryKey: ["/api/cdc-feeds/dashboard"],
  });

  const { data: liveData, isLoading: liveDataLoading } = useQuery({
    queryKey: ["/api/cdc-feeds/live", selectedDataset],
    enabled: !!selectedDataset,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await refetch();
    },
  });

  if (dashboardLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const filteredFluData = dashboard?.fluSummary?.filter(
    f => fluRegionFilter === "all" || f.region === fluRegionFilter
  ) || [];

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">CDC Public Health Feeds</h1>
            <p className="text-muted-foreground">
              Real-time public health data from the Centers for Disease Control and Prevention
            </p>
          </div>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Disclaimer</AlertTitle>
          <AlertDescription className="text-sm">
            {dashboard?.noCdsDisclaimer || "CDC data feeds are for informational purposes only. This data does NOT constitute medical advice."}
          </AlertDescription>
        </Alert>

        {dashboard?.aiSummary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground" data-testid="text-ai-summary">{dashboard.aiSummary}</p>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-alert-count">
                {dashboard?.recentAlerts?.filter(a => a.status === "active").length || 0}
              </div>
              <p className="text-sm text-muted-foreground">outbreak notifications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Flu Regions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-flu-regions">
                {dashboard?.fluSummary?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">regions tracked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Syringe className="h-5 w-5" />
                Vaccines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid="text-vaccine-count">
                {dashboard?.vaccinationHighlights?.length || 0}
              </div>
              <p className="text-sm text-muted-foreground">coverage reports</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertTriangle className="h-4 w-4 mr-2 hidden sm:inline" />
              Alerts
            </TabsTrigger>
            <TabsTrigger value="flu" data-testid="tab-flu">
              <Activity className="h-4 w-4 mr-2 hidden sm:inline" />
              Flu
            </TabsTrigger>
            <TabsTrigger value="vaccination" data-testid="tab-vaccination">
              <Syringe className="h-4 w-4 mr-2 hidden sm:inline" />
              Vaccination
            </TabsTrigger>
            <TabsTrigger value="datasets" data-testid="tab-datasets">
              <Database className="h-4 w-4 mr-2 hidden sm:inline" />
              Datasets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Outbreak Alerts</h3>
            {dashboard?.recentAlerts?.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No active outbreak alerts at this time.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {dashboard?.recentAlerts?.map((alert) => (
                  <Card key={alert.id} data-testid={`card-alert-${alert.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{alert.disease}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {alert.location}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={getSeverityVariant(alert.severity)}>
                            {alert.severity}
                          </Badge>
                          <Badge variant={alert.status === "active" ? "destructive" : "secondary"}>
                            {alert.status}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cases: </span>
                          <span className="font-medium">{alert.caseCount.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Reported: </span>
                          <span className="font-medium">
                            {new Date(alert.dateReported).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Affected: {alert.affectedPopulation}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Prevention Measures:</p>
                        <ul className="list-disc list-inside text-sm text-muted-foreground">
                          {alert.preventionMeasures.slice(0, 3).map((measure, idx) => (
                            <li key={idx}>{measure}</li>
                          ))}
                        </ul>
                      </div>
                      {alert.cdcUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={alert.cdcUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            CDC Details
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="flu" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Flu Surveillance</h3>
              <Select value={fluRegionFilter} onValueChange={setFluRegionFilter}>
                <SelectTrigger className="w-48" data-testid="select-flu-region">
                  <SelectValue placeholder="Filter by region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {dashboard?.fluSummary?.map((flu) => (
                    <SelectItem key={flu.region} value={flu.region}>
                      {flu.region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredFluData.map((flu) => (
                <Card key={flu.id} data-testid={`card-flu-${flu.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{flu.region}</CardTitle>
                      <Badge variant={getActivityVariant(flu.activityLevel)}>
                        {flu.activityLevel.replace("_", " ")}
                      </Badge>
                    </div>
                    <CardDescription>
                      {flu.week} - {flu.season}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">ILI Rate</p>
                        <p className="font-medium">{flu.iliRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Positivity</p>
                        <p className="font-medium">{flu.positivityRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Strain</p>
                        <p className="font-medium">{flu.predominantStrain}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Hospitalizations</p>
                        <p className="font-medium">{flu.hospitalizations.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      {getTrendIcon(flu.trend)}
                      <span className="text-sm capitalize">{flu.trend}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="vaccination" className="space-y-4 mt-4">
            <h3 className="text-lg font-semibold">Vaccination Coverage</h3>
            <div className="grid gap-4">
              {dashboard?.vaccinationHighlights?.map((vax) => (
                <Card key={vax.id} data-testid={`card-vax-${vax.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{vax.vaccineType}</CardTitle>
                        <CardDescription>
                          {vax.ageGroup} - {vax.location}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(vax.trend)}
                        <Badge variant="outline">{vax.reportingPeriod}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Coverage Rate</span>
                        <span className="font-medium">{vax.coverageRate}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(vax.coverageRate, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Target: {vax.targetRate}%</span>
                        <span>
                          {vax.coverageRate >= vax.targetRate 
                            ? "Target met" 
                            : `${(vax.targetRate - vax.coverageRate).toFixed(1)}% to target`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="datasets" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">Available CDC Datasets</h3>
              <Select value={selectedDataset} onValueChange={setSelectedDataset}>
                <SelectTrigger className="w-64" data-testid="select-dataset">
                  <SelectValue placeholder="Select dataset to preview" />
                </SelectTrigger>
                <SelectContent>
                  {dashboard?.availableDatasets?.map((ds) => (
                    <SelectItem key={ds.id} value={ds.id}>
                      {ds.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {dashboard?.availableDatasets?.map((dataset) => (
                <Card key={dataset.id} data-testid={`card-dataset-${dataset.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{dataset.name}</CardTitle>
                      <Badge variant="outline">{dataset.category}</Badge>
                    </div>
                    <CardDescription>{dataset.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Dataset ID: {dataset.datasetId}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDataset(dataset.id)}
                        data-testid={`button-preview-${dataset.id}`}
                      >
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedDataset && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Dataset Preview</CardTitle>
                  <CardDescription>
                    Showing sample records from {dashboard?.availableDatasets?.find(d => d.id === selectedDataset)?.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {liveDataLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {(liveData as any)?.data?.length > 0 
                        ? `${(liveData as any).data.length} records loaded`
                        : "No data available or dataset access pending"}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-xs text-muted-foreground text-center pt-4">
          Data source: CDC Data Portal (data.cdc.gov) | Last refreshed: {dashboard?.lastRefreshed ? new Date(dashboard.lastRefreshed).toLocaleString() : "N/A"}
        </div>
      </div>
    </ScrollArea>
  );
}
