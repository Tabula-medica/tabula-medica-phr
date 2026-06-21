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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { Globe, RefreshCw, TrendingUp, TrendingDown, Minus, X } from "lucide-react";

interface MetricInfo {
  label: string;
  unit: string;
  description: string;
}

interface StateData {
  stateCode: string;
  stateName: string;
  population: number;
  value: number;
  allMetrics: {
    diabetes_prevalence: number;
    obesity_rate: number;
    flu_incidence: number;
    vaccination_rate: number;
    heart_disease_mortality: number;
  };
  relativeToNational: number;
}

interface AvailableMetric {
  key: string;
  label: string;
  unit: string;
  description: string;
}

interface Correlation {
  metric1: string;
  metric2: string;
  correlation: number;
  description: string;
}

interface GeospatialResponse {
  success: boolean;
  data: {
    metric: string;
    metricInfo: MetricInfo;
    national: { mean: number; max: number; min: number };
    states: StateData[];
    topStates: StateData[];
    bottomStates: StateData[];
    availableMetrics: AvailableMetric[];
    correlations: Correlation[];
  };
}

const STATE_GRID: { row: number; col: number; code: string }[] = [
  { row: 0, col: 10, code: "ME" },
  { row: 1, col: 0, code: "WA" }, { row: 1, col: 1, code: "MT" }, { row: 1, col: 2, code: "ND" }, { row: 1, col: 3, code: "MN" }, { row: 1, col: 5, code: "MI" }, { row: 1, col: 7, code: "NY" }, { row: 1, col: 8, code: "VT" }, { row: 1, col: 9, code: "NH" }, { row: 1, col: 10, code: "MA" }, { row: 1, col: 11, code: "RI" },
  { row: 2, col: 0, code: "OR" }, { row: 2, col: 1, code: "ID" }, { row: 2, col: 2, code: "WY" }, { row: 2, col: 3, code: "SD" }, { row: 2, col: 4, code: "WI" }, { row: 2, col: 5, code: "IL" }, { row: 2, col: 6, code: "IN" }, { row: 2, col: 7, code: "OH" }, { row: 2, col: 8, code: "PA" }, { row: 2, col: 10, code: "CT" }, { row: 2, col: 11, code: "NJ" },
  { row: 3, col: 0, code: "CA" }, { row: 3, col: 1, code: "NV" }, { row: 3, col: 2, code: "UT" }, { row: 3, col: 3, code: "CO" }, { row: 3, col: 4, code: "NE" }, { row: 3, col: 5, code: "IA" }, { row: 3, col: 6, code: "MO" }, { row: 3, col: 7, code: "KY" }, { row: 3, col: 8, code: "WV" }, { row: 3, col: 9, code: "VA" }, { row: 3, col: 10, code: "MD" }, { row: 3, col: 11, code: "DE" }, { row: 3, col: 12, code: "DC" },
  { row: 4, col: 1, code: "AZ" }, { row: 4, col: 2, code: "NM" }, { row: 4, col: 4, code: "KS" }, { row: 4, col: 5, code: "AR" }, { row: 4, col: 7, code: "TN" }, { row: 4, col: 9, code: "NC" }, { row: 4, col: 10, code: "SC" },
  { row: 5, col: 3, code: "OK" }, { row: 5, col: 5, code: "LA" }, { row: 5, col: 6, code: "MS" }, { row: 5, col: 7, code: "AL" }, { row: 5, col: 8, code: "GA" },
  { row: 6, col: 3, code: "TX" }, { row: 6, col: 9, code: "FL" },
  { row: 7, col: 0, code: "HI" }, { row: 7, col: 1, code: "AK" },
];

function interpolateColor(value: number, min: number, max: number): string {
  if (max === min) return "rgb(234, 179, 8)";
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = Math.round(t < 0.5 ? Math.round(34 + (234 - 34) * (t * 2)) : 234 + (239 - 234) * ((t - 0.5) * 2));
  const g = Math.round(t < 0.5 ? 197 : 197 - (197 - 68) * ((t - 0.5) * 2));
  const b = Math.round(t < 0.5 ? 94 - 86 * (t * 2) : 8 + (68 - 8) * ((t - 0.5) * 2));
  return `rgb(${r}, ${g}, ${b})`;
}

function StateGridMap({
  states,
  min,
  max,
  selectedState,
  onSelectState,
}: {
  states: StateData[];
  min: number;
  max: number;
  selectedState: string | null;
  onSelectState: (code: string) => void;
}) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const stateMap = new Map(states.map((s) => [s.stateCode, s]));
  const maxCol = Math.max(...STATE_GRID.map((s) => s.col)) + 1;
  const maxRow = Math.max(...STATE_GRID.map((s) => s.row)) + 1;

  const hoveredData = hoveredState ? stateMap.get(hoveredState) : null;

  return (
    <div className="relative" data-testid="state-grid-map">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${maxCol}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${maxRow}, minmax(0, 1fr))`,
        }}
      >
        {STATE_GRID.map((cell) => {
          const stateData = stateMap.get(cell.code);
          const bgColor = stateData
            ? interpolateColor(stateData.value, min, max)
            : "#6b7280";
          const isSelected = selectedState === cell.code;

          return (
            <div
              key={cell.code}
              data-testid={`state-cell-${cell.code}`}
              className={`flex items-center justify-center cursor-pointer rounded-md text-xs font-bold transition-all ${
                isSelected ? "ring-2 ring-foreground scale-110 z-10" : ""
              }`}
              style={{
                gridRow: cell.row + 1,
                gridColumn: cell.col + 1,
                backgroundColor: bgColor,
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                aspectRatio: "1",
                minHeight: "32px",
              }}
              onClick={() => onSelectState(cell.code)}
              onMouseEnter={(e) => {
                setHoveredState(cell.code);
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
              }}
              onMouseLeave={() => setHoveredState(null)}
            >
              {cell.code}
            </div>
          );
        })}
      </div>

      {hoveredData && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground border rounded-md shadow-md px-3 py-2 text-sm pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
          }}
          data-testid="state-tooltip"
        >
          <p className="font-semibold">{hoveredData.stateName}</p>
          <p>
            Value: {hoveredData.value.toFixed(1)}
          </p>
          <p
            className={
              hoveredData.relativeToNational > 0
                ? "text-red-500"
                : hoveredData.relativeToNational < 0
                ? "text-green-500"
                : "text-muted-foreground"
            }
          >
            {hoveredData.relativeToNational > 0 ? "+" : ""}
            {hoveredData.relativeToNational.toFixed(1)}% vs national
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 justify-center" data-testid="color-legend">
        <span className="text-xs text-muted-foreground">Low</span>
        <div
          className="h-3 rounded-full flex-1 max-w-48"
          style={{
            background: `linear-gradient(to right, rgb(34, 197, 94), rgb(234, 179, 8), rgb(239, 68, 68))`,
          }}
        />
        <span className="text-xs text-muted-foreground">High</span>
      </div>
    </div>
  );
}

const METRIC_LABELS: Record<string, string> = {
  diabetes_prevalence: "Diabetes Prevalence",
  obesity_rate: "Obesity Rate",
  flu_incidence: "Flu Incidence",
  vaccination_rate: "Vaccination Rate",
  heart_disease_mortality: "Heart Disease Mortality",
};

export default function GeospatialPublicHealthPage() {
  const { toast } = useToast();
  const [metric, setMetric] = useState("diabetes_prevalence");
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);

  const query = useQuery<GeospatialResponse>({
    queryKey: [`/api/geospatial-insights?metric=${metric}`],
  });

  const data = query.data?.data;
  const isLoading = query.isLoading;

  const selectedState = selectedStateCode
    ? data?.states.find((s) => s.stateCode === selectedStateCode) || null
    : null;

  return (
    <div className="p-6 space-y-6" data-testid="page-geospatial-public-health">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            data-testid="page-title"
          >
            <Globe className="h-6 w-6 text-primary" />
            Public Health Geospatial Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore health metrics across the United States
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={metric} onValueChange={setMetric} data-testid="select-metric-wrapper">
            <SelectTrigger className="w-56" data-testid="select-metric">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {data?.availableMetrics && data.availableMetrics.length > 0 ? (
                data.availableMetrics.map((m) => (
                  <SelectItem
                    key={m.key}
                    value={m.key}
                    data-testid={`select-item-${m.key}`}
                  >
                    {m.label}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="diabetes_prevalence">Diabetes Prevalence</SelectItem>
                  <SelectItem value="obesity_rate">Obesity Rate</SelectItem>
                  <SelectItem value="flu_incidence">Flu Incidence</SelectItem>
                  <SelectItem value="vaccination_rate">Vaccination Rate</SelectItem>
                  <SelectItem value="heart_disease_mortality">Heart Disease Mortality</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              query.refetch();
              toast({
                title: "Refreshing",
                description: "Fetching latest geospatial data...",
              });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Skeleton className="h-[350px]" />
            <Skeleton className="h-28" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-[300px]" />
            <Skeleton className="h-[300px]" />
          </div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card data-testid="card-state-map">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {data.metricInfo.label} by State
                </CardTitle>
                <CardDescription>{data.metricInfo.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <StateGridMap
                  states={data.states}
                  min={data.national.min}
                  max={data.national.max}
                  selectedState={selectedStateCode}
                  onSelectState={(code) =>
                    setSelectedStateCode((prev) => (prev === code ? null : code))
                  }
                />
              </CardContent>
            </Card>

            <Card data-testid="card-national-stats">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">National Statistics</CardTitle>
                <CardDescription>
                  {data.metricInfo.label} ({data.metricInfo.unit})
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center" data-testid="stat-national-mean">
                    <p className="text-sm text-muted-foreground">Mean</p>
                    <p className="text-2xl font-bold">{data.national.mean.toFixed(1)}</p>
                  </div>
                  <div className="text-center" data-testid="stat-national-min">
                    <p className="text-sm text-muted-foreground">Min</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {data.national.min.toFixed(1)}
                    </p>
                  </div>
                  <div className="text-center" data-testid="stat-national-max">
                    <p className="text-sm text-muted-foreground">Max</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {data.national.max.toFixed(1)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {selectedState && (
              <Card data-testid="card-state-detail">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {selectedState.stateName}
                      <Badge variant="outline">{selectedState.stateCode}</Badge>
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedStateCode(null)}
                      data-testid="button-close-detail"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    Population: {selectedState.population.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div data-testid="chart-state-metrics">
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={Object.entries(selectedState.allMetrics).map(
                          ([key, val]) => ({
                            name: METRIC_LABELS[key] || key.replace(/_/g, " "),
                            value: val,
                          })
                        )}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          className="text-xs"
                          tick={{ fontSize: 11 }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      vs National:
                    </span>
                    <Badge
                      className={
                        selectedState.relativeToNational > 0
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : selectedState.relativeToNational < 0
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                      }
                      data-testid="badge-relative-national"
                    >
                      {selectedState.relativeToNational > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : selectedState.relativeToNational < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : (
                        <Minus className="h-3 w-3 mr-1" />
                      )}
                      {selectedState.relativeToNational > 0 ? "+" : ""}
                      {selectedState.relativeToNational.toFixed(1)}%
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-top-states">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Top 10 States</CardTitle>
                <CardDescription>
                  Highest {data.metricInfo.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div data-testid="chart-top-states">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.topStates.map((s) => ({
                        name: s.stateCode,
                        value: s.value,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={40}
                        className="text-xs"
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value.toFixed(1)} ${data.metricInfo.unit}`,
                          data.metricInfo.label,
                        ]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {data.topStates.map((s, i) => (
                          <Cell
                            key={s.stateCode}
                            fill={interpolateColor(
                              s.value,
                              data.national.min,
                              data.national.max
                            )}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-bottom-states">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bottom 10 States</CardTitle>
                <CardDescription>
                  Lowest {data.metricInfo.label}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div data-testid="chart-bottom-states">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.bottomStates.map((s) => ({
                        name: s.stateCode,
                        value: s.value,
                      }))}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={40}
                        className="text-xs"
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${value.toFixed(1)} ${data.metricInfo.unit}`,
                          data.metricInfo.label,
                        ]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {data.bottomStates.map((s, i) => (
                          <Cell
                            key={s.stateCode}
                            fill={interpolateColor(
                              s.value,
                              data.national.min,
                              data.national.max
                            )}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-correlations">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Metric Correlations</CardTitle>
                <CardDescription>
                  Relationships between health indicators
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.correlations.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 border rounded-md"
                      data-testid={`correlation-${i}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" data-testid={`badge-metric1-${i}`}>
                            {c.metric1.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground">vs</span>
                          <Badge variant="secondary" data-testid={`badge-metric2-${i}`}>
                            {c.metric2.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {c.description}
                        </p>
                      </div>
                      <Badge
                        className={
                          c.correlation > 0.5
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : c.correlation > 0
                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : c.correlation > -0.5
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        }
                        data-testid={`badge-correlation-${i}`}
                      >
                        r = {c.correlation.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                  {data.correlations.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">
                      No correlation data available
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          No geospatial data available
        </div>
      )}
    </div>
  );
}
