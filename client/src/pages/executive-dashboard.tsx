import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, 
  MessageSquare, 
  TrendingUp, 
  TrendingDown,
  Minus,
  CheckCircle,
  Clock,
  AlertCircle,
  BarChart3,
  Users,
  Activity,
  Shield,
  Bell,
  Heart,
  FileText,
  Brain,
  Stethoscope,
  LineChart
} from "lucide-react";

interface AlertStats {
  total: number;
  pending: number;
  acknowledged: number;
  resolved: number;
  escalated: number;
  bySeverity: Record<string, number>;
  averageResolutionTime: number;
  disclaimer: string;
}

interface AnalyticsSummary {
  totalAnalyzed: number;
  sentimentDistribution: Record<string, number>;
  concernsByType: Record<string, number>;
  urgentFlagsCount: number;
  criticalFlagsCount: number;
  averageRiskScore: number;
  topConcerns: { type: string; count: number }[];
  recentUrgentFlags: any[];
  disclaimer: string;
}

export default function ExecutiveDashboard() {
  const { data: alertStats, isLoading: alertStatsLoading, isError: alertStatsError } = useQuery<AlertStats>({
    queryKey: ["/api/communication-analytics/alerts/stats"]
  });

  const { data: analyticsOverview, isLoading: overviewLoading, isError: overviewError } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/communication-analytics/overview"]
  });

  const getSentimentTrend = (distribution: Record<string, number>) => {
    const positive = (distribution.positive || 0) + (distribution.very_positive || 0);
    const negative = (distribution.negative || 0) + (distribution.very_negative || 0);
    if (positive > negative * 1.5) return { trend: "positive", icon: TrendingUp, color: "text-green-500" };
    if (negative > positive * 1.5) return { trend: "negative", icon: TrendingDown, color: "text-red-500" };
    return { trend: "stable", icon: Minus, color: "text-muted-foreground" };
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold" data-testid="text-page-title">
          Executive Dashboard
        </h1>
        <p className="text-muted-foreground">
          Unified view of key metrics across all analytics modules
        </p>
      </div>

      <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <Shield className="h-4 w-4" />
        <AlertTitle>NO-CDS Compliance Notice</AlertTitle>
        <AlertDescription className="text-sm">
          All analytics are for operational and informational purposes only. This is NOT clinical decision support.
        </AlertDescription>
      </Alert>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-total-analyzed">
                  {overviewLoading ? <Skeleton className="h-7 w-12" /> : analyticsOverview?.totalAnalyzed || 0}
                </div>
                <p className="text-xs text-muted-foreground">Messages Analyzed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-pending-alerts">
                  {alertStatsLoading ? <Skeleton className="h-7 w-12" /> : alertStats?.pending || 0}
                </div>
                <p className="text-xs text-muted-foreground">Pending Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <Bell className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-urgent-flags">
                  {overviewLoading ? <Skeleton className="h-7 w-12" /> : analyticsOverview?.urgentFlagsCount || 0}
                </div>
                <p className="text-xs text-muted-foreground">Urgent Flags</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold" data-testid="text-resolved-alerts">
                  {alertStatsLoading ? <Skeleton className="h-7 w-12" /> : alertStats?.resolved || 0}
                </div>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Communication Analytics Summary */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication Analytics
            </CardTitle>
            <CardDescription>
              Patient communication sentiment and concerns overview
            </CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : overviewError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Failed to load analytics data.</AlertDescription>
              </Alert>
            ) : analyticsOverview ? (
              <div className="space-y-6">
                {/* Sentiment Distribution */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Sentiment Distribution</h4>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(analyticsOverview.sentimentDistribution).map(([label, count]) => (
                      <Badge
                        key={label}
                        variant="outline"
                        className={`capitalize ${
                          label.includes("positive") ? "border-green-500 text-green-600" :
                          label.includes("negative") ? "border-red-500 text-red-600" :
                          "border-muted-foreground"
                        }`}
                      >
                        {label.replace("_", " ")}: {count}
                      </Badge>
                    ))}
                    {Object.keys(analyticsOverview.sentimentDistribution).length === 0 && (
                      <p className="text-sm text-muted-foreground">No sentiment data yet</p>
                    )}
                  </div>
                </div>

                {/* Top Concerns */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Top Concerns</h4>
                  {analyticsOverview.topConcerns.length > 0 ? (
                    <div className="space-y-2">
                      {analyticsOverview.topConcerns.slice(0, 5).map((concern, idx) => (
                        <div key={concern.type} className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm w-4">{idx + 1}.</span>
                          <Badge variant="secondary" className="capitalize">{concern.type}</Badge>
                          <span className="text-sm text-muted-foreground">({concern.count})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No concerns detected yet</p>
                  )}
                </div>

                {/* Risk Score */}
                <div className="flex items-center gap-4 p-3 rounded bg-muted/50">
                  <Activity className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Average Risk Score</p>
                    <p className="text-2xl font-bold">
                      {analyticsOverview.averageRiskScore.toFixed(1)}
                      <span className="text-sm font-normal text-muted-foreground">/10</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Alert Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Alert Status
            </CardTitle>
            <CardDescription>
              Real-time alert monitoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            {alertStatsLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : alertStatsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>Failed to load alert data.</AlertDescription>
              </Alert>
            ) : alertStats ? (
              <div className="space-y-4">
                {/* Severity Breakdown */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-red-100 dark:bg-red-950/50 text-center">
                    <p className="text-lg font-bold text-red-600">{alertStats.bySeverity.critical || 0}</p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                  <div className="p-2 rounded bg-orange-100 dark:bg-orange-950/50 text-center">
                    <p className="text-lg font-bold text-orange-600">{alertStats.bySeverity.urgent || 0}</p>
                    <p className="text-xs text-muted-foreground">Urgent</p>
                  </div>
                  <div className="p-2 rounded bg-yellow-100 dark:bg-yellow-950/50 text-center">
                    <p className="text-lg font-bold text-yellow-600">{alertStats.bySeverity.warning || 0}</p>
                    <p className="text-xs text-muted-foreground">Warning</p>
                  </div>
                  <div className="p-2 rounded bg-blue-100 dark:bg-blue-950/50 text-center">
                    <p className="text-lg font-bold text-blue-600">{alertStats.bySeverity.info || 0}</p>
                    <p className="text-xs text-muted-foreground">Info</p>
                  </div>
                </div>

                {/* Resolution Time */}
                <div className="flex items-center gap-3 p-3 rounded bg-muted/50">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Avg Resolution Time</p>
                    <p className="text-xl font-bold">{alertStats.averageResolutionTime} min</p>
                  </div>
                </div>

                {/* Total Stats */}
                <div className="text-sm text-muted-foreground">
                  <p>Total Alerts: {alertStats.total}</p>
                  <p>Acknowledged: {alertStats.acknowledged}</p>
                  <p>Escalated: {alertStats.escalated}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Module Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/communication-analytics" data-testid="link-communication-analytics">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Communication Analytics</p>
                  <p className="text-xs text-muted-foreground">Sentiment & concerns</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/population-analytics" data-testid="link-population-analytics">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Population Analytics</p>
                  <p className="text-xs text-muted-foreground">Readmission & trends</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/care-journey" data-testid="link-care-journeys">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Heart className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Care Journeys</p>
                  <p className="text-xs text-muted-foreground">Personalized plans</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/medical-scribe" data-testid="link-medical-scribe">
          <Card className="hover-elevate cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Medical Scribe</p>
                  <p className="text-xs text-muted-foreground">AI documentation</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Features Active</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Sentiment Analysis</li>
                <li>• Response Templates</li>
                <li>• Concern Detection</li>
                <li>• Trend Analysis</li>
              </ul>
            </div>
            <div className="p-4 rounded bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Compliance Status</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> HIPAA Audit Logging
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> NO-CDS Disclaimers
                </li>
                <li className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" /> PHI Protection
                </li>
              </ul>
            </div>
            <div className="p-4 rounded bg-muted/50 space-y-2">
              <div className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Analytics Modules</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Communication Analytics</li>
                <li>• Population Health</li>
                <li>• Care Journeys</li>
                <li>• Medical Scribe</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
