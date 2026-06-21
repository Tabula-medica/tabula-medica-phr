import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  ReferenceLine,
  ReferenceArea,
} from "recharts";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  BarChart3,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";

interface BenchmarkSummary {
  metric: string;
  label: string;
  unit: string;
  latestValue: number;
  populationMean: number;
  percentile: number;
  trend: string;
  riskLevel: string;
}

interface TimeSeriesPoint {
  month: string;
  patientValue: number;
  populationMean: number;
  populationP25: number;
  populationP75: number;
  populationP10: number;
  populationP90: number;
  normalLow: number;
  normalHigh: number;
}

interface BenchmarkDetail {
  metric: string;
  label: string;
  unit: string;
  timeSeries: TimeSeriesPoint[];
  latestValue: number;
  populationMean: number;
  percentile: number;
  normalRange: [number, number];
  trend: string;
  riskLevel: string;
}

interface BenchmarkListResponse {
  success: boolean;
  data: BenchmarkSummary[];
  metrics: string[];
}

interface BenchmarkDetailResponse {
  success: boolean;
  data: BenchmarkDetail;
}

function getRiskColor(riskLevel: string) {
  switch (riskLevel) {
    case "low":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "moderate":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "high":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
  }
}

function getRiskBarColor(riskLevel: string) {
  switch (riskLevel) {
    case "low":
      return "#22c55e";
    case "moderate":
      return "#eab308";
    case "high":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case "increasing":
      return <ArrowUpRight className="h-4 w-4" />;
    case "decreasing":
      return <ArrowDownRight className="h-4 w-4" />;
    default:
      return <Minus className="h-4 w-4" />;
  }
}

export default function BenchmarkComparisonPage() {
  const { toast } = useToast();
  const [selectedMetric, setSelectedMetric] = useState("blood_pressure_systolic");
  const [activeTab, setActiveTab] = useState("trend");

  const listQuery = useQuery<BenchmarkListResponse>({
    queryKey: ["/api/benchmarks"],
  });

  const detailQuery = useQuery<BenchmarkDetailResponse>({
    queryKey: [`/api/benchmarks?metric=${selectedMetric}`],
  });

  const allMetrics = listQuery.data?.metrics || [];
  const summaryData = listQuery.data?.data || [];
  const detail = detailQuery.data?.data;

  const isListLoading = listQuery.isLoading;
  const isDetailLoading = detailQuery.isLoading;

  return (
    <div className="p-6 space-y-6" data-testid="page-benchmark-comparison">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <Activity className="h-6 w-6 text-primary" />
            Population Benchmark Comparison
          </h1>
          <p className="text-muted-foreground mt-1">
            Compare your health metrics against population averages and percentile ranges
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMetric} onValueChange={setSelectedMetric}>
            <SelectTrigger className="w-56" data-testid="select-metric">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {allMetrics.length > 0 ? (
                allMetrics.map((m) => (
                  <SelectItem key={m} value={m} data-testid={`select-item-${m}`}>
                    {m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="blood_pressure_systolic">Blood Pressure Systolic</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              listQuery.refetch();
              detailQuery.refetch();
              toast({ title: "Refreshing", description: "Fetching latest benchmark data..." });
            }}
            data-testid="button-refresh"
            aria-label="Refresh benchmarks"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {isDetailLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : detail ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stat-current-value">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-2xl font-bold">{detail.latestValue}</p>
                  <p className="text-xs text-muted-foreground">{detail.unit}</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-population-mean">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Population Mean</p>
                  <p className="text-2xl font-bold">{detail.populationMean}</p>
                  <p className="text-xs text-muted-foreground">{detail.unit}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-percentile">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Percentile Rank</p>
                  <p className="text-2xl font-bold">{detail.percentile}th</p>
                  <Badge className={`mt-1 ${getRiskColor(detail.riskLevel)}`}>
                    {detail.riskLevel} risk
                  </Badge>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-trend">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Trend</p>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon trend={detail.trend} />
                    <p className="text-2xl font-bold capitalize">{detail.trend}</p>
                  </div>
                </div>
                {detail.trend === "increasing" ? (
                  <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                ) : detail.trend === "decreasing" ? (
                  <TrendingDown className="h-8 w-8 text-muted-foreground/30" />
                ) : (
                  <Minus className="h-8 w-8 text-muted-foreground/30" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-chart">
          <TabsTrigger value="trend" data-testid="tab-trend">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trend Comparison
          </TabsTrigger>
          <TabsTrigger value="distribution" data-testid="tab-distribution">
            <BarChart3 className="h-4 w-4 mr-2" />
            Percentile Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {detail?.label || "Metric"} Over Time
              </CardTitle>
              <CardDescription>
                Patient values compared against population ranges and normal thresholds
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDetailLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : detail?.timeSeries && detail.timeSeries.length > 0 ? (
                <div data-testid="chart-trend">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={detail.timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" className="text-xs" />
                      <YAxis
                        className="text-xs"
                        label={{
                          value: detail.unit,
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle" },
                        }}
                      />
                      <Tooltip />
                      <Legend />
                      {detail.normalRange && (
                        <ReferenceArea
                          y1={detail.normalRange[0]}
                          y2={detail.normalRange[1]}
                          fill="#22c55e"
                          fillOpacity={0.08}
                          label={{ value: "Normal Range", position: "insideTopLeft", fontSize: 10 }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="populationP10"
                        stroke="none"
                        fill="#3b82f6"
                        fillOpacity={0.05}
                        name="P10"
                        stackId="p10p90"
                        legendType="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="populationP90"
                        stroke="none"
                        fill="#3b82f6"
                        fillOpacity={0.08}
                        name="P10-P90 Range"
                      />
                      <Area
                        type="monotone"
                        dataKey="populationP25"
                        stroke="none"
                        fill="#3b82f6"
                        fillOpacity={0.1}
                        name="P25"
                        legendType="none"
                      />
                      <Area
                        type="monotone"
                        dataKey="populationP75"
                        stroke="none"
                        fill="#3b82f6"
                        fillOpacity={0.15}
                        name="P25-P75 Range"
                      />
                      <Line
                        type="monotone"
                        dataKey="populationMean"
                        stroke="#9ca3af"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        name="Population Mean"
                      />
                      <Line
                        type="monotone"
                        dataKey="patientValue"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", r: 4 }}
                        name="Your Value"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No time series data available for this metric
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Percentile Rankings Across Metrics
              </CardTitle>
              <CardDescription>
                Your percentile rank for each health metric compared to the population
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isListLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : summaryData.length > 0 ? (
                <div data-testid="chart-distribution">
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={summaryData.map((item) => ({
                        name: item.label,
                        percentile: item.percentile,
                        fill: getRiskBarColor(item.riskLevel),
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" domain={[0, 100]} className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        className="text-xs"
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value}th percentile`, "Rank"]}
                      />
                      <ReferenceLine x={50} stroke="#9ca3af" strokeDasharray="3 3" label={{ value: "50th", position: "top", fontSize: 10 }} />
                      <Bar dataKey="percentile" radius={[0, 4, 4, 0]} name="Percentile">
                        {summaryData.map((entry, index) => (
                          <rect key={index} fill={getRiskBarColor(entry.riskLevel)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span className="text-sm text-muted-foreground">Low Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <span className="text-sm text-muted-foreground">Moderate Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm text-muted-foreground">High Risk</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                  No benchmark data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
