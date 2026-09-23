import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate } from "@/components/shared/format-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Database, 
  ShoppingCart, 
  FileCheck, 
  Shield, 
  DollarSign, 
  TrendingUp,
  Eye,
  Lock,
  FileText,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Activity,
  Sparkles,
  RefreshCw
} from "lucide-react";

interface MonetizationDashboard {
  summary: {
    totalDatasets: number;
    listedDatasets: number;
    pendingRequests: number;
    activeAgreements: number;
    totalRevenue: number;
    revenueThisMonth: number;
    avgDatasetValue: number;
    anonymizationJobsRunning: number;
  };
  datasetsByCategory: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topDatasets: { id: string; name: string; requests: number; revenue: number }[];
  complianceStatus: {
    totalAgreements: number;
    compliantAgreements: number;
    violationsDetected: number;
    pendingAudits: number;
  };
  recentActivity: { timestamp: string; type: string; description: string }[];
}

interface ResearchDataset {
  id: string;
  name: string;
  description: string;
  resourceTypes: string[];
  recordCount: number;
  dateRange: { startDate: string; endDate: string };
  demographics: {
    ageRange: string;
    genderDistribution: Record<string, number>;
    geographicRegions: string[];
  };
  conditions: string[];
  dataQualityScore: number;
  researchValue: {
    estimatedValue: number;
    currency: string;
    marketDemand: string;
    aiAnalysis: string;
  };
  anonymizationStatus: string;
  anonymizationLevel: string;
  status: string;
}

interface MarketplaceListing {
  id: string;
  datasetId: string;
  title: string;
  description: string;
  category: string;
  pricing: {
    basePrice: number;
    currency: string;
    pricingTiers?: { name: string; price: number; features: string[] }[];
    negotiable: boolean;
  };
  accessModel: string;
  restrictions: {
    allowedPurposes: string[];
    prohibitedUses: string[];
    requiresIRBApproval: boolean;
    requiresDUA: boolean;
  };
  viewCount: number;
  requestCount: number;
  status: string;
  featured: boolean;
  sellerOrganization: string;
}

interface DataAccessRequest {
  id: string;
  listingId: string;
  requesterOrganization: string;
  requesterType: string;
  purpose: string;
  status: string;
  aiRiskAssessment?: {
    overallRisk: string;
    riskScore: number;
    aiAnalysis: string;
  };
  createdAt: string;
}

interface DataSharingAgreement {
  id: string;
  agreementType: string;
  status: string;
  sellerId: string;
  buyerId: string;
  effectiveDate?: string;
  expirationDate?: string;
  complianceCheckResult?: {
    compliant: boolean;
    checkType: string;
    violations: { description: string; severity: string }[];
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

function getStatusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
    case "approved":
    case "completed":
    case "verified":
      return "default";
    case "pending":
    case "pending_review":
    case "under_review":
    case "in_progress":
      return "secondary";
    case "rejected":
    case "revoked":
    case "breached":
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function getRiskBadgeVariant(risk: string): "default" | "secondary" | "destructive" | "outline" {
  switch (risk) {
    case "low":
      return "default";
    case "medium":
      return "secondary";
    case "high":
    case "critical":
      return "destructive";
    default:
      return "outline";
  }
}

export default function AIFHIRDataMonetization() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedDataset, setSelectedDataset] = useState<ResearchDataset | null>(null);

  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery<{ success: boolean; data: MonetizationDashboard }>({
    queryKey: ["/api/data-monetization/dashboard"]
  });

  const { data: datasetsData, isLoading: datasetsLoading } = useQuery<{ success: boolean; data: { items: ResearchDataset[] } }>({
    queryKey: ["/api/data-monetization/datasets"]
  });

  const { data: listingsData, isLoading: listingsLoading } = useQuery<{ success: boolean; data: { items: MarketplaceListing[] } }>({
    queryKey: ["/api/data-monetization/marketplace/listings"]
  });

  const { data: requestsData, isLoading: requestsLoading } = useQuery<{ success: boolean; data: { items: DataAccessRequest[] } }>({
    queryKey: ["/api/data-monetization/access-requests"]
  });

  const { data: agreementsData, isLoading: agreementsLoading } = useQuery<{ success: boolean; data: { items: DataSharingAgreement[] } }>({
    queryKey: ["/api/data-monetization/agreements"]
  });

  const valuateMutation = useMutation({
    mutationFn: async (datasetId: string) => {
      return apiRequest("POST", `/api/data-monetization/datasets/${datasetId}/valuate`);
    },
    onSuccess: () => {
      toast({ title: "Valuation Complete", description: "Dataset has been valued successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-monetization/datasets"] });
    },
    onError: () => {
      toast({ title: "Valuation Failed", description: "Failed to value dataset", variant: "destructive" });
    }
  });

  const checkComplianceMutation = useMutation({
    mutationFn: async ({ agreementId, checkType }: { agreementId: string; checkType: string }) => {
      return apiRequest("POST", `/api/data-monetization/agreements/${agreementId}/check-compliance`, { checkType });
    },
    onSuccess: () => {
      toast({ title: "Compliance Check Complete", description: "Agreement compliance has been verified" });
      queryClient.invalidateQueries({ queryKey: ["/api/data-monetization/agreements"] });
    },
    onError: () => {
      toast({ title: "Compliance Check Failed", description: "Failed to check compliance", variant: "destructive" });
    }
  });

  const dashboard = dashboardData?.data;
  const datasets = datasetsData?.data?.items || [];
  const listings = listingsData?.data?.items || [];
  const requests = requestsData?.data?.items || [];
  const agreements = agreementsData?.data?.items || [];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            AI FHIR Data Monetization
          </h1>
          <p className="text-muted-foreground">
            Secure data sharing marketplace with AI-powered anonymization and compliance
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refetchDashboard()}
            data-testid="button-refresh-dashboard"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Critical Compliance Notice</p>
              <p className="text-sm text-muted-foreground">
                This platform is for data governance and operational purposes only. All data sharing must 
                comply with HIPAA, GDPR, and applicable research regulations. Not intended for clinical decision-making.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="datasets" data-testid="tab-datasets">Datasets</TabsTrigger>
          <TabsTrigger value="marketplace" data-testid="tab-marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">Requests</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {dashboardLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card data-testid="card-total-datasets">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Datasets</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.summary.totalDatasets}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.summary.listedDatasets} listed in marketplace
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-total-revenue">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dashboard.summary.totalRevenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(dashboard.summary.revenueThisMonth)} this month
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-active-agreements">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.summary.activeAgreements}</div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.summary.pendingRequests} pending requests
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-compliance-status">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {dashboard.complianceStatus.totalAgreements > 0 
                        ? Math.round((dashboard.complianceStatus.compliantAgreements / dashboard.complianceStatus.totalAgreements) * 100)
                        : 100}%
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dashboard.complianceStatus.violationsDetected} violations detected
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card data-testid="card-top-datasets">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Top Performing Datasets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboard.topDatasets.map((dataset) => (
                        <div key={dataset.id} className="flex items-center justify-between" data-testid={`row-top-dataset-${dataset.id}`}>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{dataset.name}</p>
                            <p className="text-sm text-muted-foreground">{dataset.requests} access requests</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">{formatCurrency(dataset.revenue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-recent-activity">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dashboard.recentActivity.slice(0, 4).map((activity, idx) => (
                        <div key={idx} className="flex items-start gap-3" data-testid={`row-activity-${idx}`}>
                          <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(activity.timestamp)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No dashboard data available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="datasets" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Research Datasets</h2>
            <Badge variant="outline">{datasets.length} datasets</Badge>
          </div>

          {datasetsLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : datasets.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {datasets.map((dataset) => (
                <Card key={dataset.id} data-testid={`card-dataset-${dataset.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{dataset.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{dataset.description}</CardDescription>
                      </div>
                      <Badge variant={getStatusBadgeVariant(dataset.status)}>{dataset.status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">{dataset.recordCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Quality Score</p>
                        <p className="font-medium">{dataset.dataQualityScore}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Est. Value</p>
                        <p className="font-medium">{formatCurrency(dataset.researchValue.estimatedValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Demand</p>
                        <Badge variant={dataset.researchValue.marketDemand === "very_high" ? "default" : "secondary"}>
                          {dataset.researchValue.marketDemand}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Anonymization</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadgeVariant(dataset.anonymizationStatus)}>
                          {dataset.anonymizationStatus}
                        </Badge>
                        {dataset.anonymizationLevel !== "none" && (
                          <Badge variant="outline">{dataset.anonymizationLevel}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {dataset.conditions.slice(0, 3).map((condition, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {condition}
                        </Badge>
                      ))}
                      {dataset.conditions.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{dataset.conditions.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => valuateMutation.mutate(dataset.id)}
                        disabled={valuateMutation.isPending}
                        data-testid={`button-valuate-${dataset.id}`}
                      >
                        <Sparkles className="mr-2 h-4 w-4" />
                        Re-valuate
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" data-testid={`button-view-analysis-${dataset.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            AI Analysis
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>AI Valuation Analysis</DialogTitle>
                            <DialogDescription>{dataset.name}</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <FieldCaption>Estimated Value</FieldCaption>
                              <p className="text-2xl font-bold">{formatCurrency(dataset.researchValue.estimatedValue)}</p>
                            </div>
                            <div>
                              <FieldCaption>AI Analysis</FieldCaption>
                              <p className="text-sm text-muted-foreground mt-1">
                                {dataset.researchValue.aiAnalysis}
                              </p>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No datasets available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Marketplace Listings</h2>
            <Badge variant="outline">{listings.length} listings</Badge>
          </div>

          {listingsLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : listings.length > 0 ? (
            <div className="space-y-4">
              {listings.map((listing) => (
                <Card key={listing.id} data-testid={`card-listing-${listing.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {listing.featured && (
                            <Badge variant="default" className="text-xs">Featured</Badge>
                          )}
                          <Badge variant={getStatusBadgeVariant(listing.status)}>{listing.status}</Badge>
                        </div>
                        <CardTitle className="text-lg">{listing.title}</CardTitle>
                        <CardDescription>{listing.description}</CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{formatCurrency(listing.pricing.basePrice)}</p>
                        <p className="text-sm text-muted-foreground">{listing.pricing.currency}</p>
                        {listing.pricing.negotiable && (
                          <Badge variant="outline" className="mt-1">Negotiable</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Category</p>
                        <p className="font-medium capitalize">{listing.category.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Access Model</p>
                        <p className="font-medium capitalize">{listing.accessModel.replace(/_/g, " ")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Views</p>
                        <p className="font-medium">{listing.viewCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Requests</p>
                        <p className="font-medium">{listing.requestCount}</p>
                      </div>
                    </div>

                    {listing.pricing.pricingTiers && listing.pricing.pricingTiers.length > 0 && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Pricing Tiers</p>
                        <div className="flex flex-wrap gap-2">
                          {listing.pricing.pricingTiers.map((tier, idx) => (
                            <Badge key={idx} variant="outline">
                              {tier.name}: {formatCurrency(tier.price)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Allowed Purposes</p>
                        <div className="flex flex-wrap gap-1">
                          {listing.restrictions.allowedPurposes.slice(0, 3).map((purpose, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {purpose}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Requirements</p>
                        <div className="flex flex-wrap gap-1">
                          {listing.restrictions.requiresIRBApproval && (
                            <Badge variant="secondary" className="text-xs">IRB Required</Badge>
                          )}
                          {listing.restrictions.requiresDUA && (
                            <Badge variant="secondary" className="text-xs">DUA Required</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <p className="text-sm text-muted-foreground">
                        Listed by: <span className="font-medium text-foreground">{listing.sellerOrganization}</span>
                      </p>
                      <Button variant="outline" size="sm" data-testid={`button-view-listing-${listing.id}`}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No marketplace listings available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Data Access Requests</h2>
            <Badge variant="outline">{requests.length} requests</Badge>
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} data-testid={`card-request-${request.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getStatusBadgeVariant(request.status)}>{request.status}</Badge>
                          <Badge variant="outline" className="capitalize">{request.requesterType}</Badge>
                        </div>
                        <CardTitle className="text-base">{request.requesterOrganization}</CardTitle>
                        <CardDescription className="line-clamp-2">{request.purpose}</CardDescription>
                      </div>
                      {request.aiRiskAssessment && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Risk Score</p>
                          <div className="flex items-center gap-2 justify-end">
                            <Badge variant={getRiskBadgeVariant(request.aiRiskAssessment.overallRisk)}>
                              {request.aiRiskAssessment.overallRisk}
                            </Badge>
                            <span className="font-medium">{request.aiRiskAssessment.riskScore}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {request.aiRiskAssessment && (
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm font-medium mb-1">AI Risk Assessment</p>
                        <p className="text-sm text-muted-foreground">{request.aiRiskAssessment.aiAnalysis}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-muted-foreground">
                        Submitted: {formatDate(request.createdAt)}
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-view-request-${request.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Review
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No access requests available
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Data Sharing Agreements & Compliance</h2>
            <Badge variant="outline">{agreements.length} agreements</Badge>
          </div>

          {agreementsLoading ? (
            <div className="flex items-center justify-center h-48">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : agreements.length > 0 ? (
            <div className="space-y-4">
              {agreements.map((agreement) => (
                <Card key={agreement.id} data-testid={`card-agreement-${agreement.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getStatusBadgeVariant(agreement.status)}>{agreement.status}</Badge>
                          <Badge variant="outline" className="uppercase">{agreement.agreementType}</Badge>
                        </div>
                        <CardTitle className="text-base">Agreement {agreement.id}</CardTitle>
                        <CardDescription>
                          Between {agreement.sellerId} and {agreement.buyerId}
                        </CardDescription>
                      </div>
                      {agreement.complianceCheckResult && (
                        <div className="text-right">
                          {agreement.complianceCheckResult.compliant ? (
                            <Badge variant="default">
                              <CheckCircle className="mr-1 h-3 w-3" />
                              Compliant
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Non-Compliant
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {agreement.effectiveDate && (
                        <div>
                          <p className="text-muted-foreground">Effective Date</p>
                          <p className="font-medium">{formatDate(agreement.effectiveDate)}</p>
                        </div>
                      )}
                      {agreement.expirationDate && (
                        <div>
                          <p className="text-muted-foreground">Expiration Date</p>
                          <p className="font-medium">{formatDate(agreement.expirationDate)}</p>
                        </div>
                      )}
                    </div>

                    {agreement.complianceCheckResult && agreement.complianceCheckResult.violations.length > 0 && (
                      <div className="bg-destructive/10 rounded-lg p-3">
                        <p className="text-sm font-medium mb-2 text-destructive">Compliance Violations</p>
                        <ul className="text-sm space-y-1">
                          {agreement.complianceCheckResult.violations.map((v, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">{v.description}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkComplianceMutation.mutate({ 
                          agreementId: agreement.id, 
                          checkType: "hipaa" 
                        })}
                        disabled={checkComplianceMutation.isPending}
                        data-testid={`button-check-hipaa-${agreement.id}`}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Check HIPAA
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => checkComplianceMutation.mutate({ 
                          agreementId: agreement.id, 
                          checkType: "gdpr" 
                        })}
                        disabled={checkComplianceMutation.isPending}
                        data-testid={`button-check-gdpr-${agreement.id}`}
                      >
                        <Lock className="mr-2 h-4 w-4" />
                        Check GDPR
                      </Button>
                      <Button variant="outline" size="sm" data-testid={`button-view-agreement-${agreement.id}`}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Terms
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No agreements available
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
