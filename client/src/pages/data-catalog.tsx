import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Database,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Sparkles,
  Link2,
  GitBranch,
  RefreshCw,
  FileCheck,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  BarChart3,
  Layers,
  Tag,
  Users,
  Building2,
  FileWarning,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface DataAsset {
  id: string;
  name: string;
  displayName: string;
  description: string;
  domain: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  status: string;
  sensitiveDataTypes: string[];
  businessCriticality: string;
  dataOwner?: string;
  dataSteward?: string;
  technicalOwner?: string;
  tags: string[];
  qualityScore: string;
  qualityMetrics: {
    completeness: number;
    accuracy: number;
    consistency: number;
    timeliness: number;
    uniqueness: number;
    validity: number;
    overallScore: number;
    lastAssessed: string;
    issues: any[];
  };
  lineage: {
    upstream: any[];
    downstream: any[];
    transformations: any[];
  };
  governanceInfo: {
    applicablePolicies: any[];
    complianceStatus: string;
    complianceScore: number;
    regulatoryFrameworks: string[];
    retentionPeriod?: string;
    accessRestrictions: string[];
    consentRequired: boolean;
    auditTrailEnabled: boolean;
    lastComplianceCheck?: string;
  };
  riskInfo: {
    overallRiskLevel: string;
    riskFactors: any[];
    mitigations: string[];
    lastAssessment?: string;
    predictedRiskTrend?: string;
  };
  aiEnrichment?: {
    generatedDescription?: string;
    suggestedTags: string[];
    relatedAssets: string[];
    usagePatterns: string[];
    qualityRecommendations: string[];
    governanceRecommendations: string[];
    enrichedAt: string;
    model: string;
  };
  metadata: any;
  discoveredAt: string;
  documentedAt?: string;
  certifiedAt?: string;
  lastUpdated: string;
  lastAccessed?: string;
  accessCount: number;
}

interface CatalogDashboard {
  totalAssets: number;
  byStatus: Record<string, number>;
  byDomain: Record<string, number>;
  byRiskLevel: Record<string, number>;
  byQuality: Record<string, number>;
  recentlyDiscovered: number;
  pendingDocumentation: number;
  complianceScore: number;
  criticalIssues: number;
  aiInsights: string[];
}

interface AssetSearchResult {
  assets: DataAsset[];
  totalCount: number;
  facets: {
    domains: { value: string; count: number }[];
    status: { value: string; count: number }[];
    sensitiveTypes: { value: string; count: number }[];
    riskLevels: { value: string; count: number }[];
    owners: { value: string; count: number }[];
  };
}

const statusColors: Record<string, string> = {
  discovered: "secondary",
  documented: "default",
  certified: "default",
  deprecated: "destructive",
  archived: "outline",
};

const statusIcons: Record<string, any> = {
  discovered: Clock,
  documented: FileText,
  certified: CheckCircle2,
  deprecated: AlertTriangle,
  archived: FileCheck,
};

const riskColors: Record<string, string> = {
  critical: "destructive",
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

const qualityColors: Record<string, string> = {
  excellent: "default",
  good: "default",
  fair: "secondary",
  poor: "destructive",
  unknown: "outline",
};

const domainLabels: Record<string, string> = {
  patient_demographics: "Patient Demographics",
  clinical_records: "Clinical Records",
  financial_billing: "Financial & Billing",
  operational: "Operational",
  research: "Research",
  regulatory: "Regulatory",
  administrative: "Administrative",
  external_integrations: "External Integrations",
};

const CHART_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function DataCatalog() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [selectedAsset, setSelectedAsset] = useState<DataAsset | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    description: "",
    dataOwner: "",
    dataSteward: "",
    tags: "",
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ success: boolean; data: CatalogDashboard }>({
    queryKey: ["/api/data-catalog/dashboard"],
  });

  const { data: assetsData, isLoading: assetsLoading, refetch: refetchAssets } = useQuery<{ success: boolean; data: AssetSearchResult }>({
    queryKey: ["/api/data-catalog/assets", domainFilter, statusFilter, riskFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (domainFilter !== "all") params.set("domain", domainFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (riskFilter !== "all") params.set("riskLevel", riskFilter);
      if (searchQuery) params.set("search", searchQuery);
      const response = await fetch(`/api/data-catalog/assets?${params}`);
      if (!response.ok) throw new Error("Failed to fetch assets");
      return response.json();
    },
  });

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/data-catalog/discover");
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Discovery Complete", description: `Discovered ${data.data?.discovered || 0} new assets` });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
    },
    onError: () => {
      toast({ title: "Discovery Failed", description: "Failed to discover new assets", variant: "destructive" });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/enrich`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Enrichment Complete", description: "Asset enriched with AI insights" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Enrichment Failed", description: "Failed to enrich asset with AI", variant: "destructive" });
    },
  });

  const linkPoliciesMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/link-policies`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Policies Linked", description: `Linked ${data.data?.length || 0} governance policies` });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Policy Linking Failed", description: "Failed to link governance policies", variant: "destructive" });
    },
  });

  const assessRiskMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/assess-risk`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Risk Assessed", description: "Risk assessment completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Assessment Failed", description: "Failed to assess risk", variant: "destructive" });
    },
  });

  const assessQualityMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/assess-quality`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Quality Assessed", description: "Quality assessment completed" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Assessment Failed", description: "Failed to assess quality", variant: "destructive" });
    },
  });

  const documentMutation = useMutation({
    mutationFn: async ({ assetId, data }: { assetId: string; data: any }) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/document`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Asset Documented", description: "Documentation saved successfully" });
      setDocumentDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Documentation Failed", description: "Failed to save documentation", variant: "destructive" });
    },
  });

  const certifyMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const response = await apiRequest("POST", `/api/data-catalog/assets/${assetId}/certify`);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Asset Certified", description: "Asset has been certified for production use" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-catalog"] });
      if (selectedAsset) {
        fetchAssetDetails(selectedAsset.id);
      }
    },
    onError: () => {
      toast({ title: "Certification Failed", description: "Asset does not meet certification requirements", variant: "destructive" });
    },
  });

  const fetchAssetDetails = async (assetId: string) => {
    try {
      const response = await fetch(`/api/data-catalog/assets/${assetId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedAsset(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch asset details:", error);
    }
  };

  const handleDocumentSubmit = () => {
    if (!selectedAsset) return;
    documentMutation.mutate({
      assetId: selectedAsset.id,
      data: {
        description: documentForm.description || undefined,
        dataOwner: documentForm.dataOwner || undefined,
        dataSteward: documentForm.dataSteward || undefined,
        tags: documentForm.tags ? documentForm.tags.split(",").map((t) => t.trim()) : undefined,
      },
    });
  };

  const dashboard = dashboardData?.data;
  const assets = assetsData?.data?.assets || [];
  const facets = assetsData?.data?.facets;

  const domainChartData = dashboard
    ? Object.entries(dashboard.byDomain)
        .filter(([, count]) => count > 0)
        .map(([domain, count]) => ({
          name: domainLabels[domain] || domain,
          value: count,
        }))
    : [];

  const qualityChartData = dashboard
    ? Object.entries(dashboard.byQuality)
        .filter(([, count]) => count > 0)
        .map(([quality, count]) => ({
          name: quality.charAt(0).toUpperCase() + quality.slice(1),
          value: count,
        }))
    : [];

  const riskChartData = dashboard
    ? Object.entries(dashboard.byRiskLevel)
        .filter(([, count]) => count > 0)
        .map(([risk, count]) => ({
          name: risk.charAt(0).toUpperCase() + risk.slice(1),
          value: count,
        }))
    : [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">AI Data Catalog</h1>
            <p className="text-muted-foreground">
              Comprehensive data asset discovery, documentation, and governance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetchAssets()}
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => discoverMutation.mutate()}
              disabled={discoverMutation.isPending}
              data-testid="button-discover-assets"
            >
              <Search className="h-4 w-4 mr-2" />
              {discoverMutation.isPending ? "Discovering..." : "Discover Assets"}
            </Button>
          </div>
        </div>
        <Badge variant="outline" className="w-fit">
          <Shield className="h-3 w-3 mr-1" />
          NO-CDS Compliant - Governance & Classification Only
        </Badge>
      </div>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="assets" data-testid="tab-assets">
            <Database className="h-4 w-4 mr-2" />
            Assets
          </TabsTrigger>
          <TabsTrigger value="lineage" data-testid="tab-lineage">
            <GitBranch className="h-4 w-4 mr-2" />
            Lineage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {dashboardLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-assets">{dashboard.totalAssets}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.recentlyDiscovered} discovered in last 30 days
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-compliance-score">{dashboard.complianceScore}%</div>
                    <Progress value={dashboard.complianceScore} className="mt-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Documentation</CardTitle>
                    <FileWarning className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-pending-docs">{dashboard.pendingDocumentation}</div>
                    <p className="text-xs text-muted-foreground">Assets need documentation</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-critical-issues">{dashboard.criticalIssues}</div>
                    <p className="text-xs text-muted-foreground">Quality issues to address</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Assets by Domain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={domainChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={60}
                            label
                          >
                            {domainChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Quality Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={qualityChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Risk Levels</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={riskChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="value" fill="#82ca9d" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {dashboard.aiInsights.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      AI Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {dashboard.aiInsights.map((insight, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5" />
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="assets" className="mt-4">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="search">Search</Label>
                    <Input
                      id="search"
                      placeholder="Search assets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                  <div className="w-40">
                    <Label>Domain</Label>
                    <Select value={domainFilter} onValueChange={setDomainFilter}>
                      <SelectTrigger data-testid="select-domain">
                        <SelectValue placeholder="All domains" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Domains</SelectItem>
                        {Object.entries(domainLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="discovered">Discovered</SelectItem>
                        <SelectItem value="documented">Documented</SelectItem>
                        <SelectItem value="certified">Certified</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Label>Risk Level</Label>
                    <Select value={riskFilter} onValueChange={setRiskFilter}>
                      <SelectTrigger data-testid="select-risk">
                        <SelectValue placeholder="All risk levels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Levels</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">Data Assets ({assets.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {assetsLoading ? (
                      <div className="flex items-center justify-center h-32">
                        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : assets.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No assets found</p>
                        <Button variant="ghost" onClick={() => discoverMutation.mutate()}>
                          Discover new assets
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assets.map((asset) => {
                          const StatusIcon = statusIcons[asset.status] || Database;
                          return (
                            <div
                              key={asset.id}
                              className={`p-3 rounded-md border cursor-pointer transition-colors ${
                                selectedAsset?.id === asset.id ? "bg-accent" : "hover-elevate"
                              }`}
                              onClick={() => {
                                setSelectedAsset(asset);
                                fetchAssetDetails(asset.id);
                              }}
                              data-testid={`card-asset-${asset.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium truncate">{asset.displayName}</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-1">
                                    {asset.description}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1 mt-2">
                                    <Badge variant={statusColors[asset.status] as any} className="text-xs">
                                      {asset.status}
                                    </Badge>
                                    <Badge variant={riskColors[asset.riskInfo.overallRiskLevel] as any} className="text-xs">
                                      {asset.riskInfo.overallRiskLevel} risk
                                    </Badge>
                                    {asset.sensitiveDataTypes.slice(0, 2).map((type) => (
                                      <Badge key={type} variant="outline" className="text-xs">
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-sm">
                    {selectedAsset ? selectedAsset.displayName : "Asset Details"}
                  </CardTitle>
                  <CardDescription>
                    {selectedAsset ? `Source: ${selectedAsset.sourceName}` : "Select an asset to view details"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedAsset ? (
                    <Tabs value={detailTab} onValueChange={setDetailTab}>
                      <TabsList className="w-full justify-start flex-wrap">
                        <TabsTrigger value="overview">Overview</TabsTrigger>
                        <TabsTrigger value="quality">Quality</TabsTrigger>
                        <TabsTrigger value="governance">Governance</TabsTrigger>
                        <TabsTrigger value="risk">Risk</TabsTrigger>
                        <TabsTrigger value="ai">AI</TabsTrigger>
                      </TabsList>

                      <ScrollArea className="h-[400px] mt-4">
                        <TabsContent value="overview">
                          <div className="space-y-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Description</Label>
                              <p className="text-sm">{selectedAsset.description}</p>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Domain</Label>
                                <p className="text-sm">{domainLabels[selectedAsset.domain] || selectedAsset.domain}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Criticality</Label>
                                <p className="text-sm capitalize">{selectedAsset.businessCriticality}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Data Owner</Label>
                                <p className="text-sm">{selectedAsset.dataOwner || "Not assigned"}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Data Steward</Label>
                                <p className="text-sm">{selectedAsset.dataSteward || "Not assigned"}</p>
                              </div>
                            </div>
                            <Separator />
                            <div>
                              <Label className="text-xs text-muted-foreground">Sensitive Data Types</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedAsset.sensitiveDataTypes.map((type) => (
                                  <Badge key={type} variant="secondary">{type}</Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Tags</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedAsset.tags.map((tag) => (
                                  <Badge key={tag} variant="outline">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                            <Separator />
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                setDocumentForm({
                                  description: selectedAsset.description,
                                  dataOwner: selectedAsset.dataOwner || "",
                                  dataSteward: selectedAsset.dataSteward || "",
                                  tags: selectedAsset.tags.join(", "),
                                });
                                setDocumentDialogOpen(true);
                              }} data-testid="button-document">
                                <FileText className="h-4 w-4 mr-1" />
                                Document
                              </Button>
                              {selectedAsset.status === "documented" && (
                                <Button size="sm" onClick={() => certifyMutation.mutate(selectedAsset.id)} disabled={certifyMutation.isPending} data-testid="button-certify">
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Certify
                                </Button>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="quality">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-xs text-muted-foreground">Quality Score</Label>
                                <div className="flex items-center gap-2">
                                  <Badge variant={qualityColors[selectedAsset.qualityScore] as any}>
                                    {selectedAsset.qualityScore}
                                  </Badge>
                                  <span className="text-lg font-bold">
                                    {selectedAsset.qualityMetrics.overallScore}%
                                  </span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => assessQualityMutation.mutate(selectedAsset.id)} disabled={assessQualityMutation.isPending} data-testid="button-assess-quality">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Assess
                              </Button>
                            </div>
                            <div className="grid gap-2">
                              {["completeness", "accuracy", "consistency", "timeliness", "uniqueness", "validity"].map((metric) => (
                                <div key={metric} className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-24 capitalize">{metric}</span>
                                  <Progress value={selectedAsset.qualityMetrics[metric as keyof typeof selectedAsset.qualityMetrics] as number} className="flex-1" />
                                  <span className="text-xs w-10">{selectedAsset.qualityMetrics[metric as keyof typeof selectedAsset.qualityMetrics]}%</span>
                                </div>
                              ))}
                            </div>
                            {selectedAsset.qualityMetrics.issues.length > 0 && (
                              <>
                                <Separator />
                                <div>
                                  <Label className="text-xs text-muted-foreground">Issues ({selectedAsset.qualityMetrics.issues.length})</Label>
                                  <div className="space-y-2 mt-2">
                                    {selectedAsset.qualityMetrics.issues.map((issue: any) => (
                                      <div key={issue.id} className="p-2 rounded border bg-muted/50">
                                        <div className="flex items-center gap-2">
                                          <Badge variant={riskColors[issue.severity] as any} className="text-xs">
                                            {issue.severity}
                                          </Badge>
                                          <span className="text-sm">{issue.type}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{issue.description}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </TabsContent>

                        <TabsContent value="governance">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-xs text-muted-foreground">Compliance Status</Label>
                                <div className="flex items-center gap-2">
                                  <Badge variant={selectedAsset.governanceInfo.complianceStatus === "compliant" ? "default" : "destructive"}>
                                    {selectedAsset.governanceInfo.complianceStatus}
                                  </Badge>
                                  <span className="text-lg font-bold">
                                    {selectedAsset.governanceInfo.complianceScore}%
                                  </span>
                                </div>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => linkPoliciesMutation.mutate(selectedAsset.id)} disabled={linkPoliciesMutation.isPending} data-testid="button-link-policies">
                                <Link2 className="h-4 w-4 mr-1" />
                                Link Policies
                              </Button>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Regulatory Frameworks</Label>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedAsset.governanceInfo.regulatoryFrameworks.map((reg) => (
                                  <Badge key={reg} variant="secondary">{reg}</Badge>
                                ))}
                              </div>
                            </div>
                            <Separator />
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Applicable Policies ({selectedAsset.governanceInfo.applicablePolicies.length})
                              </Label>
                              {selectedAsset.governanceInfo.applicablePolicies.length > 0 ? (
                                <div className="space-y-2 mt-2">
                                  {selectedAsset.governanceInfo.applicablePolicies.map((policy: any) => (
                                    <div key={policy.policyId} className="p-2 rounded border">
                                      <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{policy.policyName}</span>
                                        <Badge variant="outline" className="text-xs">{policy.policyType}</Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground mt-2">No policies linked. Click "Link Policies" to auto-discover.</p>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs text-muted-foreground">Audit Trail</Label>
                                <p className="text-sm">{selectedAsset.governanceInfo.auditTrailEnabled ? "Enabled" : "Disabled"}</p>
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Consent Required</Label>
                                <p className="text-sm">{selectedAsset.governanceInfo.consentRequired ? "Yes" : "No"}</p>
                              </div>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="risk">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-xs text-muted-foreground">Risk Level</Label>
                                <Badge variant={riskColors[selectedAsset.riskInfo.overallRiskLevel] as any} className="text-lg px-3 py-1">
                                  {selectedAsset.riskInfo.overallRiskLevel.toUpperCase()}
                                </Badge>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => assessRiskMutation.mutate(selectedAsset.id)} disabled={assessRiskMutation.isPending} data-testid="button-assess-risk">
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Re-assess
                              </Button>
                            </div>
                            {selectedAsset.riskInfo.predictedRiskTrend && (
                              <div className="flex items-center gap-2">
                                {selectedAsset.riskInfo.predictedRiskTrend === "increasing" ? (
                                  <ArrowUpRight className="h-4 w-4 text-red-500" />
                                ) : selectedAsset.riskInfo.predictedRiskTrend === "decreasing" ? (
                                  <ArrowDownRight className="h-4 w-4 text-green-500" />
                                ) : (
                                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="text-sm">Trend: {selectedAsset.riskInfo.predictedRiskTrend}</span>
                              </div>
                            )}
                            <Separator />
                            <div>
                              <Label className="text-xs text-muted-foreground">Risk Factors ({selectedAsset.riskInfo.riskFactors.length})</Label>
                              <div className="space-y-2 mt-2">
                                {selectedAsset.riskInfo.riskFactors.map((factor: any, idx: number) => (
                                  <div key={idx} className="p-2 rounded border">
                                    <div className="flex items-center gap-2">
                                      <Badge variant={riskColors[factor.severity] as any} className="text-xs">
                                        {factor.severity}
                                      </Badge>
                                      <span className="text-sm">{factor.factor}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{factor.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Mitigations</Label>
                              <ul className="list-disc list-inside text-sm mt-1">
                                {selectedAsset.riskInfo.mitigations.map((mit, idx) => (
                                  <li key={idx}>{mit}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="ai">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs text-muted-foreground">AI Enrichment</Label>
                              <Button size="sm" onClick={() => enrichMutation.mutate(selectedAsset.id)} disabled={enrichMutation.isPending} data-testid="button-enrich-ai">
                                <Sparkles className="h-4 w-4 mr-1" />
                                {enrichMutation.isPending ? "Enriching..." : "Enrich with AI"}
                              </Button>
                            </div>
                            {selectedAsset.aiEnrichment ? (
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-xs text-muted-foreground">AI-Generated Description</Label>
                                  <p className="text-sm mt-1">{selectedAsset.aiEnrichment.generatedDescription}</p>
                                </div>
                                {selectedAsset.aiEnrichment.suggestedTags.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Suggested Tags</Label>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {selectedAsset.aiEnrichment.suggestedTags.map((tag) => (
                                        <Badge key={tag} variant="outline">{tag}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {selectedAsset.aiEnrichment.qualityRecommendations.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Quality Recommendations</Label>
                                    <ul className="list-disc list-inside text-sm mt-1">
                                      {selectedAsset.aiEnrichment.qualityRecommendations.map((rec, idx) => (
                                        <li key={idx}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {selectedAsset.aiEnrichment.governanceRecommendations.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Governance Recommendations</Label>
                                    <ul className="list-disc list-inside text-sm mt-1">
                                      {selectedAsset.aiEnrichment.governanceRecommendations.map((rec, idx) => (
                                        <li key={idx}>{rec}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Enriched at {new Date(selectedAsset.aiEnrichment.enrichedAt).toLocaleString()} using {selectedAsset.aiEnrichment.model}
                                </p>
                              </div>
                            ) : (
                              <div className="text-center py-8 text-muted-foreground">
                                <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No AI enrichment yet</p>
                                <p className="text-xs">Click "Enrich with AI" to generate insights</p>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      </ScrollArea>
                    </Tabs>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      <div className="text-center">
                        <Database className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Select an asset to view details</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lineage" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Data Lineage</CardTitle>
              <CardDescription>
                {selectedAsset
                  ? `Lineage for ${selectedAsset.displayName}`
                  : "Select an asset to view its data lineage"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedAsset ? (
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowDownRight className="h-3 w-3" />
                      Upstream Sources ({selectedAsset.lineage.upstream.length})
                    </Label>
                    <div className="space-y-2 mt-2">
                      {selectedAsset.lineage.upstream.length > 0 ? (
                        selectedAsset.lineage.upstream.map((node: any) => (
                          <div key={node.assetId} className="p-2 rounded border">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{node.assetName}</span>
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">{node.relationship}</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No upstream sources</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                      <Database className="h-8 w-8 mx-auto text-primary mb-2" />
                      <p className="text-sm font-medium text-center">{selectedAsset.displayName}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3" />
                      Downstream Consumers ({selectedAsset.lineage.downstream.length})
                    </Label>
                    <div className="space-y-2 mt-2">
                      {selectedAsset.lineage.downstream.length > 0 ? (
                        selectedAsset.lineage.downstream.map((node: any) => (
                          <div key={node.assetId} className="p-2 rounded border">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{node.assetName}</span>
                            </div>
                            <Badge variant="outline" className="text-xs mt-1">{node.relationship}</Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No downstream consumers</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Select an asset from the Assets tab to view lineage</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Asset</DialogTitle>
            <DialogDescription>
              Update documentation for {selectedAsset?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doc-description">Description</Label>
              <Textarea
                id="doc-description"
                value={documentForm.description}
                onChange={(e) => setDocumentForm({ ...documentForm, description: e.target.value })}
                placeholder="Enter asset description..."
                data-testid="input-doc-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doc-owner">Data Owner</Label>
                <Input
                  id="doc-owner"
                  value={documentForm.dataOwner}
                  onChange={(e) => setDocumentForm({ ...documentForm, dataOwner: e.target.value })}
                  placeholder="e.g., Chief Data Officer"
                  data-testid="input-doc-owner"
                />
              </div>
              <div>
                <Label htmlFor="doc-steward">Data Steward</Label>
                <Input
                  id="doc-steward"
                  value={documentForm.dataSteward}
                  onChange={(e) => setDocumentForm({ ...documentForm, dataSteward: e.target.value })}
                  placeholder="e.g., Data Governance Team"
                  data-testid="input-doc-steward"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="doc-tags">Tags (comma-separated)</Label>
              <Input
                id="doc-tags"
                value={documentForm.tags}
                onChange={(e) => setDocumentForm({ ...documentForm, tags: e.target.value })}
                placeholder="e.g., patient, demographics, PHI"
                data-testid="input-doc-tags"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocumentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDocumentSubmit} disabled={documentMutation.isPending} data-testid="button-save-documentation">
              {documentMutation.isPending ? "Saving..." : "Save Documentation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
