import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { apiRequest } from "@/lib/queryClient";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ComposedChart,
  Bar,
  BarChart,
} from "recharts";
import {
  TrendingUp,
  Target,
  Calendar,
  Activity,
  CheckCircle2,
  Loader2,
  Pill,
  BarChart3,
} from "lucide-react";

interface TreatmentDataPoint {
  week: number;
  date: string;
  value: number;
  adherence: number;
}

interface Treatment {
  id: string;
  name: string;
  condition: string;
  startDate: string;
  metric: string;
  unit: string;
  targetValue: number;
  data: TreatmentDataPoint[];
}

interface TreatmentListResponse {
  success: boolean;
  data: Treatment[];
}

interface PredictionPoint {
  week: number;
  value: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
}

interface PredictionResult {
  treatmentId: string;
  treatment: string;
  condition: string;
  metric: string;
  unit: string;
  currentData: TreatmentDataPoint[];
  prediction: {
    predictions: PredictionPoint[];
    summary: string;
    likelihood_of_target: number;
    recommended_adjustments: string[];
  };
}

interface PredictionResponse {
  success: boolean;
  data: PredictionResult;
}

export default function TreatmentEfficacyPage() {
  const { toast } = useToast();
  const [selectedTreatmentId, setSelectedTreatmentId] = useState<string>("");
  const [predictionData, setPredictionData] = useState<PredictionResult | null>(null);

  const treatmentsQuery = useQuery<TreatmentListResponse>({
    queryKey: ["/api/treatment-efficacy"],
  });

  const treatments = treatmentsQuery.data?.data || [];

  useEffect(() => {
    if (treatments.length > 0 && !selectedTreatmentId) {
      setSelectedTreatmentId(treatments[0].id);
    }
  }, [treatments, selectedTreatmentId]);

  const selectedTreatment = treatments.find((t) => t.id === selectedTreatmentId);

  const predictionMutation = useMutation({
    mutationFn: async ({ treatmentId, weeksAhead }: { treatmentId: string; weeksAhead: number }) => {
      const res = await apiRequest("POST", "/api/treatment-efficacy/predict", { treatmentId, weeksAhead });
      return (await res.json()) as PredictionResponse;
    },
    onSuccess: (data) => {
      setPredictionData(data.data);
      toast({
        title: "Prediction Generated",
        description: "AI prediction has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Prediction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGeneratePrediction = () => {
    if (!selectedTreatmentId) return;
    setPredictionData(null);
    predictionMutation.mutate({ treatmentId: selectedTreatmentId, weeksAhead: 8 });
  };

  const currentValue = selectedTreatment?.data?.length
    ? selectedTreatment.data[selectedTreatment.data.length - 1].value
    : 0;

  const avgAdherence = selectedTreatment?.data?.length
    ? Math.round(
        selectedTreatment.data.reduce((sum, d) => sum + d.adherence, 0) /
          selectedTreatment.data.length
      )
    : 0;

  const durationWeeks = selectedTreatment?.data?.length || 0;

  const chartData = selectedTreatment?.data?.map((d) => ({
    week: `W${d.week}`,
    weekNum: d.week,
    value: d.value,
    adherence: d.adherence,
  })) || [];

  const predictionChartData = predictionData?.prediction?.predictions?.map((p) => ({
    week: `W${p.week}`,
    weekNum: p.week,
    predictedValue: p.value,
    lower_bound: p.lower_bound,
    upper_bound: p.upper_bound,
  })) || [];

  const combinedChartData = (() => {
    const allData = [...chartData];

    if (predictionChartData.length > 0) {
      const lastActualWeek = chartData.length > 0 ? chartData[chartData.length - 1].weekNum : 0;

      if (chartData.length > 0) {
        const lastActual = chartData[chartData.length - 1];
        const bridgeEntry = allData.find((d) => d.weekNum === lastActual.weekNum);
        if (bridgeEntry) {
          (bridgeEntry as any).predictedValue = lastActual.value;
          (bridgeEntry as any).lower_bound = lastActual.value;
          (bridgeEntry as any).upper_bound = lastActual.value;
        }
      }

      predictionChartData.forEach((p) => {
        if (p.weekNum > lastActualWeek) {
          allData.push({
            ...p,
            value: undefined as any,
            adherence: undefined as any,
          });
        }
      });
    }

    return allData;
  })();

  return (
    <div className="p-6 space-y-6" data-testid="page-treatment-efficacy">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="page-title">
            <TrendingUp className="h-6 w-6 text-primary" />
            Treatment Efficacy Analysis
          </h1>
          <p className="text-muted-foreground mt-1">
            Track treatment outcomes and AI-powered predictions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedTreatmentId}
            onValueChange={(val) => {
              setSelectedTreatmentId(val);
              setPredictionData(null);
            }}
          >
            <SelectTrigger className="w-64" data-testid="select-treatment">
              <SelectValue placeholder="Select treatment" />
            </SelectTrigger>
            <SelectContent>
              {treatments.map((t) => (
                <SelectItem key={t.id} value={t.id} data-testid={`select-item-${t.id}`}>
                  {t.name} - {t.condition}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {treatmentsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : selectedTreatment ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card data-testid="stat-current-value">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Value</p>
                  <p className="text-2xl font-bold">{currentValue}</p>
                  <p className="text-xs text-muted-foreground">{selectedTreatment.unit}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-target-value">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Target Value</p>
                  <p className="text-2xl font-bold">{selectedTreatment.targetValue}</p>
                  <p className="text-xs text-muted-foreground">{selectedTreatment.unit}</p>
                </div>
                <Target className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-duration">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="text-2xl font-bold">{durationWeeks}</p>
                  <p className="text-xs text-muted-foreground">weeks</p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-adherence">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Adherence Rate</p>
                  <p className="text-2xl font-bold">{avgAdherence}%</p>
                  <Progress value={avgAdherence} className="h-2 mt-1 w-24" />
                </div>
                <Pill className="h-8 w-8 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {selectedTreatment?.metric || "Treatment"} Over Time
          </CardTitle>
          <CardDescription>
            Treatment values, adherence, and AI predictions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {treatmentsQuery.isLoading ? (
            <Skeleton className="h-[400px] w-full" />
          ) : combinedChartData.length > 0 ? (
            <div data-testid="chart-treatment-efficacy">
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={combinedChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" />
                  <YAxis yAxisId="right" orientation="right" domain={[0, 100]} className="text-xs" />
                  <Tooltip />
                  <Legend />
                  {selectedTreatment && (
                    <ReferenceLine
                      yAxisId="left"
                      y={selectedTreatment.targetValue}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeWidth={2}
                      label={{ value: "Target", position: "right", fill: "#ef4444", fontSize: 12 }}
                    />
                  )}
                  <Bar
                    yAxisId="right"
                    dataKey="adherence"
                    fill="#22c55e"
                    fillOpacity={0.3}
                    name="Adherence %"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 4 }}
                    name="Actual Value"
                    connectNulls={false}
                  />
                  {predictionData && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="upper_bound"
                      stroke="none"
                      fill="#a855f7"
                      fillOpacity={0.15}
                      name="Confidence Band"
                      connectNulls
                    />
                  )}
                  {predictionData && (
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="lower_bound"
                      stroke="none"
                      fill="#ffffff"
                      fillOpacity={1}
                      name="Lower Bound"
                      legendType="none"
                      connectNulls
                    />
                  )}
                  {predictionData && (
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="predictedValue"
                      stroke="#a855f7"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#a855f7", r: 3 }}
                      name="Predicted Value"
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              Select a treatment to view efficacy data
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Prediction
            </CardTitle>
            <CardDescription>
              Generate AI-powered predictions for treatment outcomes
            </CardDescription>
          </div>
          <Button
            onClick={handleGeneratePrediction}
            disabled={!selectedTreatmentId || predictionMutation.isPending}
            data-testid="button-generate-prediction"
          >
            {predictionMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Generate AI Prediction
          </Button>
        </CardHeader>
        <CardContent>
          {predictionMutation.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : predictionData ? (
            <div className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground" data-testid="text-prediction-summary">
                  {predictionData.prediction.summary}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Likelihood of Reaching Target</h4>
                  <Badge data-testid="badge-likelihood">
                    {predictionData.prediction.likelihood_of_target}%
                  </Badge>
                </div>
                <Progress
                  value={predictionData.prediction.likelihood_of_target}
                  className="h-3"
                  data-testid="progress-likelihood"
                />
              </div>

              {predictionData.prediction.recommended_adjustments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Recommended Adjustments</h4>
                  <ul className="space-y-2">
                    {predictionData.prediction.recommended_adjustments.map((adj, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        data-testid={`text-adjustment-${idx}`}
                      >
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-500 shrink-0" />
                        {adj}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              Click "Generate AI Prediction" to see treatment outcome predictions
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
