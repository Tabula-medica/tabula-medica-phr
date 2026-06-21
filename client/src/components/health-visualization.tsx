import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Thermometer,
  Pill,
  TestTube,
  Sparkles,
  MessageCircleQuestion,
  ChevronRight,
  Activity,
} from "lucide-react";
import { format } from "date-fns";

interface SymptomDataPoint {
  date: string;
  symptomName: string;
  severity: number;
}

interface MedicationAdherencePoint {
  date: string;
  medicationName: string;
  taken: boolean;
  adherenceRate: number;
}

interface LabResultPoint {
  date: string;
  testName: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
}

interface TrendInsight {
  category: "symptom" | "medication" | "lab";
  title: string;
  observation: string;
  dataReference: string;
  source: string;
  questionForClinician: string;
}

interface HealthVisualizationData {
  symptomTrends: SymptomDataPoint[];
  medicationAdherence: MedicationAdherencePoint[];
  labTrends: LabResultPoint[];
  insights: TrendInsight[];
  disclaimer: string;
  generatedAt: string;
}

function SymptomChart({ data }: { data: SymptomDataPoint[] }) {
  const groupedBySymptom = data.reduce((acc, point) => {
    if (!acc[point.symptomName]) {
      acc[point.symptomName] = [];
    }
    acc[point.symptomName].push({
      date: format(new Date(point.date), "MMM d"),
      severity: point.severity,
    });
    return acc;
  }, {} as Record<string, { date: string; severity: number }[]>);

  const symptoms = Object.keys(groupedBySymptom);
  const colors = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))"];

  const chartData = groupedBySymptom[symptoms[0]]?.map((_, i) => {
    const point: Record<string, any> = { date: groupedBySymptom[symptoms[0]][i].date };
    symptoms.forEach(symptom => {
      point[symptom] = groupedBySymptom[symptom]?.[i]?.severity || 0;
    });
    return point;
  }) || [];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 10]} className="text-xs" tick={{ fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }} 
          />
          <Legend />
          {symptoms.map((symptom, i) => (
            <Line
              key={symptom}
              type="monotone"
              dataKey={symptom}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function MedicationAdherenceChart({ data }: { data: MedicationAdherencePoint[] }) {
  const groupedByMed = data.reduce((acc, point) => {
    if (!acc[point.medicationName]) {
      acc[point.medicationName] = [];
    }
    acc[point.medicationName].push({
      date: format(new Date(point.date), "MMM d"),
      adherenceRate: point.adherenceRate,
    });
    return acc;
  }, {} as Record<string, { date: string; adherenceRate: number }[]>);

  const medications = Object.keys(groupedByMed);
  const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))"];

  const chartData = groupedByMed[medications[0]]?.map((_, i) => {
    const point: Record<string, any> = { date: groupedByMed[medications[0]][i].date };
    medications.forEach(med => {
      point[med] = groupedByMed[med]?.[i]?.adherenceRate || 0;
    });
    return point;
  }) || [];

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))", 
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
            formatter={(value: number) => [`${value}%`, "Adherence"]}
          />
          <Legend />
          {medications.map((med, i) => (
            <Bar
              key={med}
              dataKey={med}
              fill={colors[i % colors.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function LabTrendChart({ data }: { data: LabResultPoint[] }) {
  const groupedByTest = data.reduce((acc, point) => {
    if (!acc[point.testName]) {
      acc[point.testName] = { points: [], unit: point.unit, refMin: point.referenceMin, refMax: point.referenceMax };
    }
    acc[point.testName].points.push({
      date: format(new Date(point.date), "MMM"),
      value: point.value,
    });
    return acc;
  }, {} as Record<string, { points: { date: string; value: number }[]; unit: string; refMin?: number; refMax?: number }>);

  const tests = Object.keys(groupedByTest);

  return (
    <div className="space-y-6">
      {tests.map((testName, idx) => {
        const testData = groupedByTest[testName];
        const colors = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))"];
        
        return (
          <div key={testName}>
            <p className="text-sm font-medium mb-2">{testName} ({testData.unit})</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={testData.points} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: number) => [`${value} ${testData.unit}`, testName]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={colors[idx % colors.length]}
                    fill={colors[idx % colors.length]}
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {testData.refMin !== undefined && testData.refMax !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Reference range: {testData.refMin} - {testData.refMax} {testData.unit}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InsightCard({ insight }: { insight: TrendInsight }) {
  const iconMap = {
    symptom: Thermometer,
    medication: Pill,
    lab: TestTube,
  };
  const Icon = iconMap[insight.category];

  return (
    <AccordionItem value={insight.title} className="border rounded-lg px-4 mb-2">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-insight-${insight.category}`}>
        <div className="flex items-center gap-3 text-left flex-1">
          <Icon className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1">
            <span className="font-medium">{insight.title}</span>
            <Badge variant="outline" className="ml-2 text-xs capitalize">
              {insight.category}
            </Badge>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Observation:
            </p>
            <p className="text-sm">{insight.observation}</p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1">Data Reference:</p>
            <p className="text-sm font-mono bg-muted/30 p-2 rounded">{insight.dataReference}</p>
            <p className="text-xs text-muted-foreground mt-1">({insight.source})</p>
          </div>
          
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
              <MessageCircleQuestion className="h-3 w-3" />
              Question for your clinician:
            </p>
            <p className="text-sm flex items-start gap-2">
              <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              {insight.questionForClinician}
            </p>
          </div>
          
          <p className="text-xs text-muted-foreground italic">
            Observation your clinician might find useful.
          </p>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function HealthVisualizationCard() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery<HealthVisualizationData>({
    queryKey: ["/api/health-visualization"],
    enabled: open,
  });

  return (
    <Card data-testid="card-health-visualization">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Health Trends
        </CardTitle>
        <CardDescription>Charts and AI-generated observations</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-visualization">
              <Activity className="h-4 w-4 mr-2" />
              View Trends
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Health Data Visualization
              </DialogTitle>
              <DialogDescription>
                Trends and observations your clinician might find useful
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 pr-4">
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-64" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              ) : data ? (
                <Tabs defaultValue="charts" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="charts" data-testid="tab-charts">Charts</TabsTrigger>
                    <TabsTrigger value="insights" data-testid="tab-insights">
                      AI Insights
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {data.insights.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="charts" className="space-y-6 mt-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Thermometer className="h-4 w-4 text-primary" />
                          Symptom Severity Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SymptomChart data={data.symptomTrends} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Pill className="h-4 w-4 text-primary" />
                          Medication Adherence Rate
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <MedicationAdherenceChart data={data.medicationAdherence} />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <TestTube className="h-4 w-4 text-primary" />
                          Lab Value Trends
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <LabTrendChart data={data.labTrends} />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="insights" className="mt-4">
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground">
                        These observations are generated from your health data trends.
                        Share them with your healthcare provider during your next visit.
                      </p>
                    </div>
                    
                    <Accordion type="single" collapsible className="space-y-2">
                      {data.insights.map((insight, i) => (
                        <InsightCard key={i} insight={insight} />
                      ))}
                    </Accordion>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No visualization data available</p>
                </div>
              )}

              <div className="p-2 rounded-lg bg-muted/50 border mt-4">
                <p className="text-xs text-muted-foreground text-center">
                  Informational only. Not medical advice.
                </p>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
