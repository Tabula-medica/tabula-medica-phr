import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FlaskConical,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Filter,
  ArrowUpDown,
  Info,
  BookOpen,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { clickable } from "@/lib/a11y";

interface ConsolidatedLabResult {
  id: string;
  orderId: string;
  testName: string;
  loincCode: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: string;
  status: string;
  collectedAt: string;
  reportedAt: string;
  performingLab: string;
  providerName: string;
  source: string;
  isAbnormal: boolean;
  isCritical: boolean;
  category: string;
}

interface LabAlert {
  id: string;
  labResultId: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: string;
  alertLevel: string;
  title: string;
  description: string;
  recommendations: string[];
  educationTopics: string[];
  reportedAt: string;
}

interface ConsolidatedLabsResponse {
  results: ConsolidatedLabResult[];
  totalCount: number;
  abnormalCount: number;
  criticalCount: number;
  categories: string[];
  abnormalResults: ConsolidatedLabResult[];
  disclaimer: string;
}

interface LabAlertsResponse {
  alerts: LabAlert[];
  totalAlerts: number;
  urgentCount: number;
  reviewCount: number;
  disclaimer: string;
}

interface UpcomingOrder {
  id: string;
  tests: string[];
  status: string;
  orderingPhysician: string;
  providerName: string;
  submittedAt: string;
  estimatedCompletionAt: string;
}

interface UpcomingOrdersResponse {
  orders: UpcomingOrder[];
  totalCount: number;
}

export function ConsolidatedLabResultsCard({ patientId = "patient-001" }: { patientId?: string }) {
  const [sortBy, setSortBy] = useState("reportedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterInterpretation, setFilterInterpretation] = useState("all");
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  const { data: labsData, isLoading: labsLoading } = useQuery<ConsolidatedLabsResponse>({
    queryKey: ["/api/patient-portal", patientId, "lab-results/consolidated", sortBy, sortOrder, filterInterpretation, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams({
        sortBy,
        sortOrder,
        interpretation: filterInterpretation,
        category: filterCategory,
      });
      const res = await fetch(`/api/patient-portal/${patientId}/lab-results/consolidated?${params}`);
      if (!res.ok) throw new Error("Failed to fetch lab results");
      return res.json();
    },
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<LabAlertsResponse>({
    queryKey: [`/api/patient-portal/${patientId}/lab-alerts`],
  });

  const { data: upcomingData } = useQuery<UpcomingOrdersResponse>({
    queryKey: [`/api/patient-portal/${patientId}/lab-orders/upcoming`],
  });

  if (labsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const results = labsData?.results || [];
  const alerts = alertsData?.alerts || [];
  const upcomingOrders = upcomingData?.orders || [];

  function getInterpretationColor(interpretation: string) {
    switch (interpretation) {
      case "normal": return "text-green-600 dark:text-green-400";
      case "abnormal": return "text-orange-600 dark:text-orange-400";
      case "critical": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  }

  function getInterpretationBadge(interpretation: string) {
    switch (interpretation) {
      case "normal": return <Badge variant="outline" className="text-green-600 border-green-300 dark:text-green-400 dark:border-green-700" data-testid={`badge-interpretation-normal`}>Normal</Badge>;
      case "abnormal": return <Badge variant="outline" className="text-orange-600 border-orange-300 dark:text-orange-400 dark:border-orange-700" data-testid={`badge-interpretation-abnormal`}>Abnormal</Badge>;
      case "critical": return <Badge variant="destructive" data-testid={`badge-interpretation-critical`}>Critical</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  }

  const toggleSort = () => {
    setSortOrder(prev => prev === "desc" ? "asc" : "desc");
  };

  return (
    <div className="space-y-4">
      {alerts.length > 0 && (
        <Card className="border-orange-300 dark:border-orange-700" data-testid="card-lab-alerts">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Lab Alerts
              <Badge variant="secondary" className="ml-1">{alerts.length}</Badge>
            </CardTitle>
            <CardDescription>Results that need your attention - discuss with your provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border ${
                    alert.alertLevel === "urgent"
                      ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                      : "border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30"
                  }`}
                  data-testid={`alert-${alert.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold" data-testid={`text-alert-title-${alert.id}`}>{alert.title}</span>
                        <Badge variant={alert.alertLevel === "urgent" ? "destructive" : "secondary"} className="text-xs">
                          {alert.alertLevel === "urgent" ? "Urgent" : "Review Needed"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1" data-testid={`text-alert-desc-${alert.id}`}>{alert.description}</p>
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">Recommended Actions:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {alert.recommendations.map((rec, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <span className="text-orange-500 mt-0.5">-</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {alert.educationTopics.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 flex-wrap">
                          <BookOpen className="h-3 w-3 text-muted-foreground" />
                          {alert.educationTopics.map((topic, i) => (
                            <Badge key={i} variant="outline" className="text-xs">{topic}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-lg font-bold ${getInterpretationColor(alert.interpretation)}`}>
                        {alert.value} {alert.unit}
                      </span>
                      <p className="text-xs text-muted-foreground">Ref: {alert.referenceRange}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {alertsData?.disclaimer}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingOrders.length > 0 && (
        <Card data-testid="card-upcoming-orders">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-blue-500" />
              Pending Lab Orders
              <Badge variant="secondary" className="ml-1">{upcomingOrders.length}</Badge>
            </CardTitle>
            <CardDescription>Tests that have been ordered and are awaiting results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingOrders.map((order) => (
                <div key={order.id} className="p-3 rounded-lg border" data-testid={`upcoming-order-${order.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" data-testid={`text-order-tests-${order.id}`}>
                        {order.tests.join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ordered by {order.orderingPhysician} | {order.providerName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant={order.status === "in-progress" ? "default" : "secondary"} className="text-xs">
                        {order.status === "in-progress" ? "In Progress" : order.status === "submitted" ? "Submitted" : "Pending"}
                      </Badge>
                      {order.estimatedCompletionAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Est. {format(new Date(order.estimatedCompletionAt), "MMM d")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-consolidated-lab-results">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FlaskConical className="h-5 w-5 text-indigo-500" />
              Lab Results
              {labsData && labsData.abnormalCount > 0 && (
                <Badge variant="secondary" className="ml-1 text-orange-600 dark:text-orange-400" data-testid="badge-abnormal-count">
                  {labsData.abnormalCount} abnormal
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{labsData?.totalCount || 0} results</span>
            </div>
          </div>
          <CardDescription>All your lab test results in one place</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Filter:</span>
            </div>
            <Select value={filterInterpretation} onValueChange={setFilterInterpretation}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-filter-interpretation">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="abnormal">Abnormal</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-filter-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(labsData?.categories || []).map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-sort-by">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reportedAt">Date</SelectItem>
                <SelectItem value="testName">Test Name</SelectItem>
                <SelectItem value="category">Category</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={toggleSort} data-testid="button-toggle-sort">
              <ArrowUpDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {results.length > 0 ? (
                results.map((result) => (
                  <div
                    key={result.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      result.isAbnormal
                        ? "border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20"
                        : result.isCritical
                        ? "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
                        : ""
                    }`}
                    {...clickable(() => setExpandedResult(expandedResult === result.id ? null : result.id))}
                    data-testid={`lab-result-row-${result.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" data-testid={`text-test-name-${result.id}`}>{result.testName}</span>
                          {getInterpretationBadge(result.interpretation)}
                          <Badge variant="outline" className="text-xs">{result.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-base font-bold ${getInterpretationColor(result.interpretation)}`} data-testid={`text-value-${result.id}`}>
                            {result.value} {result.unit}
                          </span>
                          {result.isAbnormal && (
                            <span className="flex items-center text-xs text-muted-foreground">
                              <ArrowUpRight className="h-3 w-3 text-orange-500 mr-0.5" />
                              Ref: {result.referenceRange}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">{format(new Date(result.reportedAt), "MMM d, yyyy")}</span>
                        {expandedResult === result.id ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedResult === result.id && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Reference Range:</span>
                            <span className="ml-1 font-medium">{result.referenceRange}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">LOINC Code:</span>
                            <span className="ml-1 font-medium">{result.loincCode}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Collected:</span>
                            <span className="ml-1 font-medium">{format(new Date(result.collectedAt), "MMM d, yyyy")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reported:</span>
                            <span className="ml-1 font-medium">{format(new Date(result.reportedAt), "MMM d, yyyy")}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Lab:</span>
                            <span className="ml-1 font-medium">{result.performingLab}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Provider:</span>
                            <span className="ml-1 font-medium">{result.providerName}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-center">
                  <FlaskConical className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No lab results match your filters</p>
                  {(filterInterpretation !== "all" || filterCategory !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => { setFilterInterpretation("all"); setFilterCategory("all"); }}
                      data-testid="button-clear-filters"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="mt-3 p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Info className="h-3 w-3" />
              {labsData?.disclaimer}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
