import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Heart,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Loader2,
} from "lucide-react";

interface AlertItem {
  severity: "critical" | "warning" | "info";
  message: string;
  action: string;
}

interface TrendChartWidget {
  type: "trend_chart";
  metric: string;
  title: string;
  priority: number;
  data: { month: string; value: number }[];
}

interface GaugeWidget {
  type: "gauge";
  metric: string;
  title: string;
  priority: number;
  value: number;
  target: number;
  max: number;
  unit: string;
}

interface BarChartWidget {
  type: "bar_chart";
  metric: string;
  title: string;
  priority: number;
  data: { day: string; morning?: number; evening?: number; minutes?: number; target?: number }[];
}

interface StatCardWidget {
  type: "stat_card";
  title: string;
  value: number | string;
  unit: string;
  trend: "improving" | "stable" | "worsening";
}

interface RiskFactorsWidget {
  type: "risk_factors";
  title: string;
  factors: { name: string; risk: number; trend: string }[];
}

interface PieChartWidget {
  type: "pie_chart";
  title: string;
  data: { name: string; value: number; color: string }[];
}

interface AreaChartWidget {
  type: "area_chart";
  title: string;
  data: { hour: string; systolic: number; diastolic: number }[];
}

type Widget =
  | TrendChartWidget
  | GaugeWidget
  | BarChartWidget
  | StatCardWidget
  | RiskFactorsWidget
  | PieChartWidget
  | AreaChartWidget;

interface DashboardData {
  title: string;
  primaryMetric: string;
  condition: string;
  riskLevel: string;
  lastUpdated: string;
  availableConditions: string[];
  availableRiskLevels: string[];
  widgets: Widget[];
  alerts: AlertItem[];
}

interface DashboardResponse {
  success: boolean;
  data: DashboardData;
}

function getAlertStyles(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300";
    case "warning":
      return "bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300";
    case "info":
      return "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300";
    default:
      return "bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-900/30 dark:border-gray-700 dark:text-gray-300";
  }
}

function getAlertIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />;
    case "info":
      return <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />;
    default:
      return <Activity className="h-5 w-5 shrink-0" />;
  }
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "worsening":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
}

function getRiskColor(risk: number) {
  if (risk >= 0.7) return "bg-red-500";
  if (risk >= 0.4) return "bg-yellow-500";
  return "bg-green-500";
}

function getRiskProgressColor(risk: number) {
  if (risk >= 0.7) return "text-red-500";
  if (risk >= 0.4) return "text-yellow-500";
  return "text-green-500";
}

function GaugeChart({ value, target, max, unit }: { value: number; target: number; max: number; unit: string }) {
  const radius = 70;
  const strokeWidth = 14;
  const cx = 90;
  const cy = 90;
  const startAngle = -225;
  const endAngle = 45;
  const totalAngle = endAngle - startAngle;

  const polarToCartesian = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  };

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const valueAngle = startAngle + (Math.min(value, max) / max) * totalAngle;
  const targetAngle = startAngle + (Math.min(target, max) / max) * totalAngle;

  const valueColor = value >= target ? "#22c55e" : value >= target * 0.7 ? "#eab308" : "#ef4444";

  return (
    <svg viewBox="0 0 180 130" className="w-full max-w-[220px] mx-auto">
      <path
        d={describeArc(startAngle, endAngle)}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/30"
        strokeLinecap="round"
      />
      <path
        d={describeArc(startAngle, valueAngle)}
        fill="none"
        stroke={valueColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {(() => {
        const tp = polarToCartesian(targetAngle);
        return (
          <circle cx={tp.x} cy={tp.y} r={4} fill="#6b7280" />
        );
      })()}
      <text x={cx} y={cy - 5} textAnchor="middle" className="fill-foreground text-2xl font-bold" fontSize="24">
        {value}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-muted-foreground" fontSize="12">
        {unit}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" className="fill-muted-foreground" fontSize="10">
        Target: {target}
      </text>
    </svg>
  );
}

function WidgetRenderer({ widget }: { widget: Widget }) {
  switch (widget.type) {
    case "trend_chart":
      return (
        <Card data-testid={`widget-trend-chart-${widget.metric}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={widget.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );

    case "gauge":
      return (
        <Card data-testid={`widget-gauge-${widget.metric}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center">
            <GaugeChart value={widget.value} target={widget.target} max={widget.max} unit={widget.unit} />
          </CardContent>
        </Card>
      );

    case "bar_chart":
      return (
        <Card data-testid={`widget-bar-chart-${widget.metric}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={widget.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                {widget.data[0]?.morning !== undefined && (
                  <Bar dataKey="morning" fill="#3b82f6" name="Morning" radius={[4, 4, 0, 0]} />
                )}
                {widget.data[0]?.evening !== undefined && (
                  <Bar dataKey="evening" fill="#8b5cf6" name="Evening" radius={[4, 4, 0, 0]} />
                )}
                {widget.data[0]?.minutes !== undefined && (
                  <Bar dataKey="minutes" fill="#22c55e" name="Minutes" radius={[4, 4, 0, 0]} />
                )}
                {widget.data[0]?.target !== undefined && (
                  <Bar dataKey="target" fill="#9ca3af" name="Target" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );

    case "stat_card":
      return (
        <Card data-testid={`widget-stat-${widget.title.toLowerCase().replace(/\s+/g, "-")}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{widget.title}</p>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold" data-testid={`stat-value-${widget.title.toLowerCase().replace(/\s+/g, "-")}`}>
                    {widget.value}
                  </span>
                  <span className="text-sm text-muted-foreground">{widget.unit}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <TrendIcon trend={widget.trend} />
                <span className={`text-sm capitalize ${
                  widget.trend === "improving" ? "text-green-500" :
                  widget.trend === "worsening" ? "text-red-500" :
                  "text-gray-500"
                }`}>
                  {widget.trend}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      );

    case "risk_factors":
      return (
        <Card data-testid="widget-risk-factors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {widget.factors.map((factor) => (
              <div key={factor.name} data-testid={`risk-factor-${factor.name.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{factor.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={`text-sm ${getRiskProgressColor(factor.risk)}`}>
                      {Math.round(factor.risk * 100)}%
                    </span>
                    <TrendIcon trend={factor.trend} />
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${getRiskColor(factor.risk)}`}
                    style={{ width: `${Math.round(factor.risk * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      );

    case "pie_chart":
      return (
        <Card data-testid="widget-pie-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={widget.data}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {widget.data.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );

    case "area_chart":
      return (
        <Card data-testid="widget-area-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-4 w-4 text-red-500" />
              {widget.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={widget.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="hour" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="systolic" stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} name="Systolic" />
                <Area type="monotone" dataKey="diastolic" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} name="Diastolic" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      );

    default:
      return null;
  }
}

function getWidgetPriority(widget: Widget): number {
  if ("priority" in widget) return widget.priority;
  return 99;
}

function getWidgetColSpan(widget: Widget): string {
  switch (widget.type) {
    case "trend_chart":
    case "bar_chart":
    case "area_chart":
      return "lg:col-span-2";
    case "stat_card":
      return "lg:col-span-1";
    default:
      return "lg:col-span-1";
  }
}

export default function AdaptiveHealthDashboardPage() {
  const { toast } = useToast();
  const [condition, setCondition] = useState("diabetes");
  const [riskLevel, setRiskLevel] = useState("moderate");

  const { data, isLoading, isError, refetch } = useQuery<DashboardResponse>({
    queryKey: [`/api/adaptive-dashboard?condition=${condition}&riskLevel=${riskLevel}`],
  });

  const dashboard = data?.data;
  const widgets = dashboard?.widgets
    ? [...dashboard.widgets].sort((a, b) => getWidgetPriority(a) - getWidgetPriority(b))
    : [];
  const alerts = dashboard?.alerts || [];
  const availableConditions = dashboard?.availableConditions || [];
  const availableRiskLevels = dashboard?.availableRiskLevels || [];

  return (
    <div className="p-6 space-y-6" data-testid="page-adaptive-health-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="dashboard-title">
            <Heart className="h-6 w-6 text-primary" />
            {isLoading ? "Loading Dashboard..." : dashboard?.title || "Adaptive Health Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="dashboard-subtitle">
            {dashboard?.lastUpdated
              ? `Last updated: ${new Date(dashboard.lastUpdated).toLocaleString()}`
              : "Interactive patient health dashboard"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={condition}
            onValueChange={(val) => {
              setCondition(val);
              toast({ title: "Condition Changed", description: `Switched to ${val} dashboard` });
            }}
          >
            <SelectTrigger className="w-44" data-testid="select-condition">
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {availableConditions.length > 0 ? (
                availableConditions.map((c) => (
                  <SelectItem key={c} value={c} data-testid={`select-condition-${c}`}>
                    {c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="diabetes">Diabetes</SelectItem>
                  <SelectItem value="hypertension">Hypertension</SelectItem>
                  <SelectItem value="cardiac">Cardiac</SelectItem>
                  <SelectItem value="respiratory">Respiratory</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <Select
            value={riskLevel}
            onValueChange={(val) => {
              setRiskLevel(val);
              toast({ title: "Risk Level Changed", description: `Switched to ${val} risk view` });
            }}
          >
            <SelectTrigger className="w-36" data-testid="select-risk-level">
              <SelectValue placeholder="Risk level" />
            </SelectTrigger>
            <SelectContent>
              {availableRiskLevels.length > 0 ? (
                availableRiskLevels.map((r) => (
                  <SelectItem key={r} value={r} data-testid={`select-risk-${r}`}>
                    {r.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              refetch();
              toast({ title: "Refreshing", description: "Fetching latest dashboard data..." });
            }}
            data-testid="button-refresh"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4" data-testid="loading-skeleton">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <Card className="border-red-300 dark:border-red-700" data-testid="error-state">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-lg font-medium">Failed to load dashboard</p>
            <p className="text-muted-foreground mt-1">Unable to fetch data for the selected condition and risk level.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()} data-testid="button-retry">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && dashboard && (
        <>
          {alerts.length > 0 && (
            <div className="space-y-2" data-testid="alerts-container">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-md border ${getAlertStyles(alert.severity)}`}
                  data-testid={`alert-${alert.severity}-${index}`}
                >
                  {getAlertIcon(alert.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{alert.message}</p>
                    {alert.action && (
                      <p className="text-xs mt-0.5 opacity-80">{alert.action}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      alert.severity === "critical"
                        ? "border-red-400 text-red-700 dark:border-red-600 dark:text-red-300"
                        : alert.severity === "warning"
                        ? "border-yellow-400 text-yellow-700 dark:border-yellow-600 dark:text-yellow-300"
                        : "border-blue-400 text-blue-700 dark:border-blue-600 dark:text-blue-300"
                    }
                    data-testid={`alert-badge-${index}`}
                  >
                    {alert.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Badge data-testid="badge-condition">
              <Shield className="h-3 w-3 mr-1" />
              {dashboard.condition?.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
            </Badge>
            <Badge
              variant={
                dashboard.riskLevel === "critical" || dashboard.riskLevel === "high"
                  ? "destructive"
                  : "secondary"
              }
              data-testid="badge-risk-level"
            >
              {dashboard.riskLevel?.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())} Risk
            </Badge>
            {dashboard.primaryMetric && (
              <Badge variant="outline" data-testid="badge-primary-metric">
                Primary: {dashboard.primaryMetric}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="widgets-grid">
            {widgets.map((widget, index) => (
              <div key={index} className={getWidgetColSpan(widget)}>
                <WidgetRenderer widget={widget} />
              </div>
            ))}
          </div>

          {widgets.length === 0 && (
            <Card data-testid="empty-widgets">
              <CardContent className="p-6 text-center">
                <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-lg font-medium">No Widgets Available</p>
                <p className="text-muted-foreground mt-1">
                  No data widgets are available for the selected condition and risk level.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-adaptive-health-dashboard-disclaimer" />
    </div>
  );
}