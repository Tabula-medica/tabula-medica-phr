import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { 
  Syringe, 
  Activity, 
  ClipboardList, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertTriangle,
  CheckCircle2,
  Plus,
  FileText,
  Heart,
  Droplets,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, differenceInDays } from "date-fns";
import { StatusBadge } from "@/components/shared";
import type { Immunization, AdvancedHealthMetric, ConditionSpecificPROM } from "@shared/schema";

interface PROMTemplate {
  templateName: string;
  conditionType: string;
  questions: {
    id: string;
    text: string;
    category: string;
    options: { value: number; label: string }[];
  }[];
  scoring: {
    maxScore: number;
    ranges: { min: number; max: number; interpretation: string; riskLevel: string }[];
  };
}

const METRIC_TYPE_LABELS: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  hba1c: { label: "HbA1c", icon: Droplets, color: "text-red-500" },
  blood_pressure_systolic: { label: "Systolic BP", icon: Heart, color: "text-rose-500" },
  blood_pressure_diastolic: { label: "Diastolic BP", icon: Heart, color: "text-rose-400" },
  fasting_glucose: { label: "Fasting Glucose", icon: Droplets, color: "text-orange-500" },
  total_cholesterol: { label: "Total Cholesterol", icon: Activity, color: "text-yellow-500" },
  ldl_cholesterol: { label: "LDL Cholesterol", icon: Activity, color: "text-amber-500" },
  hdl_cholesterol: { label: "HDL Cholesterol", icon: Activity, color: "text-green-500" },
  triglycerides: { label: "Triglycerides", icon: Activity, color: "text-purple-500" },
  bmi: { label: "BMI", icon: Activity, color: "text-blue-500" },
  weight: { label: "Weight", icon: Activity, color: "text-slate-500" },
  egfr: { label: "eGFR", icon: Droplets, color: "text-teal-500" },
  urine_albumin_creatinine_ratio: { label: "UACR", icon: Droplets, color: "text-cyan-500" },
  inr: { label: "INR", icon: Droplets, color: "text-indigo-500" },
  tsh: { label: "TSH", icon: Activity, color: "text-violet-500" },
  vitamin_d: { label: "Vitamin D", icon: Activity, color: "text-amber-400" },
  ferritin: { label: "Ferritin", icon: Droplets, color: "text-red-400" },
  oxygen_saturation: { label: "SpO2", icon: Activity, color: "text-sky-500" },
};


const TREND_ICONS: Record<string, { icon: typeof TrendingUp; color: string }> = {
  improving: { icon: TrendingUp, color: "text-green-500" },
  stable: { icon: Minus, color: "text-slate-500" },
  worsening: { icon: TrendingDown, color: "text-red-500" },
};


export default function ExpandedPatientRecords() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("immunizations");
  const [expandedMetricType, setExpandedMetricType] = useState<string | null>(null);
  
  // Fetch available patients to get a real patient ID
  const { data: patients } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ["/api/patients"],
  });
  
  // Use the first patient for display, or use query parameter
  const patientId = patients?.[0]?.id || "";

  const { data: immunizations, isLoading: immunizationsLoading } = useQuery<Immunization[]>({
    queryKey: ["/api/immunizations", patientId],
    enabled: !!patientId,
  });

  const { data: healthMetrics, isLoading: metricsLoading } = useQuery<AdvancedHealthMetric[]>({
    queryKey: ["/api/health-metrics", patientId],
    enabled: !!patientId,
  });

  const { data: conditionPROMs, isLoading: promsLoading } = useQuery<ConditionSpecificPROM[]>({
    queryKey: ["/api/condition-proms", patientId],
    enabled: !!patientId,
  });

  const { data: promTemplates } = useQuery<{ diabetes: PROMTemplate; hypertension: PROMTemplate }>({
    queryKey: ["/api/condition-prom-templates"],
  });

  const groupedMetrics = healthMetrics?.reduce((acc, metric) => {
    if (!acc[metric.metricType]) {
      acc[metric.metricType] = [];
    }
    acc[metric.metricType].push(metric);
    return acc;
  }, {} as Record<string, AdvancedHealthMetric[]>) || {};

  const getLatestMetric = (type: string): AdvancedHealthMetric | undefined => {
    return groupedMetrics[type]?.[0];
  };

  const getImmunizationStatus = (imm: Immunization) => {
    if (imm.status === "not-done") return "missed";
    if (imm.reaction) return "reaction";
    if (imm.seriesComplete) return "complete";
    return "completed";
  };

  const getDueImmunizations = () => {
    const dueVaccines = [
      { name: "Influenza", recommended: "Annual", lastDose: immunizations?.find(i => i.vaccineName.toLowerCase().includes("influenza")) },
      { name: "Tdap", recommended: "Every 10 years", lastDose: immunizations?.find(i => i.vaccineName.toLowerCase().includes("tdap") || i.vaccineName.toLowerCase().includes("tetanus")) },
      { name: "Pneumococcal", recommended: "Age 65+", lastDose: immunizations?.find(i => i.vaccineName.toLowerCase().includes("pneumococcal") || i.vaccineName.toLowerCase().includes("prevnar")) },
    ];
    
    return dueVaccines.filter(v => {
      if (!v.lastDose) return true;
      const daysSinceLast = differenceInDays(new Date(), parseISO(v.lastDose.administeredDate));
      if (v.name === "Influenza" && daysSinceLast > 365) return true;
      if (v.name === "Tdap" && daysSinceLast > 3650) return true;
      return false;
    });
  };

  const formatMetricValue = (metric: AdvancedHealthMetric) => {
    return metric.value.toString();
  };

  const renderImmunizationsTab = () => (
    <div className="space-y-6">
      {getDueImmunizations().length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-5 w-5" />
              Immunizations Due
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {getDueImmunizations().map(v => (
                <Badge key={v.name} variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                  {v.name} - {v.recommended}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Immunization History
          </CardTitle>
          <CardDescription>
            Complete vaccination records with batch information and reactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {immunizationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : immunizations && immunizations.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vaccine</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Dose</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Lot #</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {immunizations.map(imm => (
                    <TableRow key={imm.id} data-testid={`row-immunization-${imm.id}`}>
                      <TableCell className="font-medium">{imm.vaccineName}</TableCell>
                      <TableCell>{format(parseISO(imm.administeredDate), "MMM d, yyyy")}</TableCell>
                      <TableCell>
                        {imm.doseNumber ? `#${imm.doseNumber}` : "-"}
                        {imm.seriesComplete && (
                          <Badge variant="outline" className="ml-2 text-green-600">Complete</Badge>
                        )}
                      </TableCell>
                      <TableCell>{imm.manufacturer || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{imm.lotNumber || "-"}</TableCell>
                      <TableCell>{imm.site || "-"}</TableCell>
                      <TableCell>
                        <Badge className={imm.status === "completed" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {imm.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {imm.reaction ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-amber-600 hover:text-amber-700">
                                <AlertTriangle className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Vaccine Reaction Details</DialogTitle>
                                <DialogDescription>
                                  Reaction to {imm.vaccineName} on {format(parseISO(imm.administeredDate), "MMM d, yyyy")}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-3 pt-4">
                                <div>
                                  <span className="font-medium">Reaction:</span>
                                  <p className="text-muted-foreground">{imm.reaction}</p>
                                </div>
                                {imm.reactionSeverity && (
                                  <div>
                                    <span className="font-medium">Severity:</span>
                                    <Badge className={imm.reactionSeverity === "severe" ? "ml-2 bg-red-100 text-red-800" : "ml-2"}>
                                      {imm.reactionSeverity}
                                    </Badge>
                                  </div>
                                )}
                                {imm.reactionDate && (
                                  <div>
                                    <span className="font-medium">Reaction Date:</span>
                                    <p className="text-muted-foreground">{format(parseISO(imm.reactionDate), "MMM d, yyyy")}</p>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Syringe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No immunization records found</p>
              <p className="text-sm mt-1">Immunization records will appear here once added</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderHealthMetricsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(METRIC_TYPE_LABELS).map(([type, config]) => {
          const latestMetric = getLatestMetric(type);
          const MetricIcon = config.icon;
          const TrendIcon = latestMetric?.trend ? TREND_ICONS[latestMetric.trend]?.icon : Minus;
          const trendColor = latestMetric?.trend ? TREND_ICONS[latestMetric.trend]?.color : "text-slate-500";
          
          return (
            <Card 
              key={type} 
              className="cursor-pointer hover-elevate transition-all"
              onClick={() => setExpandedMetricType(expandedMetricType === type ? null : type)}
              data-testid={`card-metric-${type}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                      <MetricIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{config.label}</p>
                      {latestMetric ? (
                        <p className="text-2xl font-bold">
                          {formatMetricValue(latestMetric)} 
                          <span className="text-sm font-normal text-muted-foreground ml-1">{latestMetric.unit}</span>
                        </p>
                      ) : (
                        <p className="text-lg text-muted-foreground">No data</p>
                      )}
                    </div>
                  </div>
                  {latestMetric && (
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={latestMetric.status || "normal"} />
                      <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                    </div>
                  )}
                </div>
                {latestMetric && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Last recorded: {format(parseISO(latestMetric.recordedAt), "MMM d, yyyy")}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {expandedMetricType && groupedMetrics[expandedMetricType] && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {METRIC_TYPE_LABELS[expandedMetricType]?.label} History
            </CardTitle>
            <CardDescription>
              Showing last {groupedMetrics[expandedMetricType].length} readings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Reference Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedMetrics[expandedMetricType].slice(0, 10).map(metric => (
                  <TableRow key={metric.id}>
                    <TableCell>{format(parseISO(metric.recordedAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell className="font-medium">
                      {formatMetricValue(metric)} {metric.unit}
                    </TableCell>
                    <TableCell>
                      {metric.referenceRangeLow && metric.referenceRangeHigh 
                        ? `${metric.referenceRangeLow} - ${metric.referenceRangeHigh} ${metric.unit}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={metric.status || "normal"} />
                    </TableCell>
                    <TableCell>{metric.source || "Manual"}</TableCell>
                    <TableCell className="max-w-xs truncate">{metric.notes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderConditionPROMsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {promTemplates && Object.entries(promTemplates).map(([condition, template]) => {
          const latestPROM = conditionPROMs?.find(p => p.conditionType === condition);
          
          return (
            <Card key={condition} data-testid={`card-prom-${condition}`}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 capitalize">
                  <ClipboardList className="h-5 w-5" />
                  {condition} Self-Care Assessment
                </CardTitle>
                <CardDescription>
                  {template.templateName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestPROM ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Latest Score</p>
                        <p className="text-3xl font-bold">
                          {latestPROM.totalScore}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{template.scoring.maxScore}
                          </span>
                        </p>
                      </div>
                      {latestPROM.riskLevel && (
                        <StatusBadge status={latestPROM.riskLevel} label={`${latestPROM.riskLevel} risk`} />
                      )}
                    </div>
                    
                    <Progress 
                      value={(latestPROM.totalScore / template.scoring.maxScore) * 100} 
                      className="h-2"
                    />
                    
                    {latestPROM.interpretation && (
                      <div className="bg-muted p-3 rounded-lg">
                        <p className="text-sm">{latestPROM.interpretation}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Completed: {format(parseISO(latestPROM.completedAt), "MMM d, yyyy")}</span>
                      {latestPROM.reviewedBy && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Reviewed
                        </span>
                      )}
                    </div>
                    
                    <Accordion type="single" collapsible>
                      <AccordionItem value="responses">
                        <AccordionTrigger className="text-sm">View Responses</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            {latestPROM.responses.map((response, idx) => {
                              const question = template.questions.find(q => q.id === response.questionId);
                              return (
                                <div key={response.questionId} className="flex justify-between items-start py-2 border-b last:border-0">
                                  <span className="text-sm">{question?.text || `Question ${idx + 1}`}</span>
                                  <Badge variant="outline">{response.answer}</Badge>
                                </div>
                              );
                            })}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No assessments completed yet</p>
                    <Button variant="outline" className="mt-3" data-testid={`button-start-prom-${condition}`}>
                      <Plus className="h-4 w-4 mr-2" />
                      Start Assessment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {conditionPROMs && conditionPROMs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Assessment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Provider Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditionPROMs.map(prom => (
                  <TableRow key={prom.id} data-testid={`row-prom-${prom.id}`}>
                    <TableCell>{format(parseISO(prom.completedAt), "MMM d, yyyy")}</TableCell>
                    <TableCell className="capitalize">{prom.conditionType}</TableCell>
                    <TableCell>{prom.templateName}</TableCell>
                    <TableCell className="font-medium">{prom.totalScore}</TableCell>
                    <TableCell>
                      {prom.riskLevel && (
                        <StatusBadge status={prom.riskLevel} />
                      )}
                    </TableCell>
                    <TableCell>
                      {prom.reviewedBy ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-4 w-4" />
                          {format(parseISO(prom.reviewedAt!), "MMM d")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight" data-testid="heading-page-title">
          Expanded Patient Records
        </h1>
        <p className="text-muted-foreground mt-1">
          Track immunizations, health metrics, and condition-specific assessments
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="immunizations" className="gap-2" data-testid="tab-immunizations">
            <Syringe className="h-4 w-4" />
            <span className="hidden sm:inline">Immunizations</span>
          </TabsTrigger>
          <TabsTrigger value="health-metrics" className="gap-2" data-testid="tab-health-metrics">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Health Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="condition-proms" className="gap-2" data-testid="tab-condition-proms">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Self-Care PROMs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="immunizations">
          {renderImmunizationsTab()}
        </TabsContent>

        <TabsContent value="health-metrics">
          {renderHealthMetricsTab()}
        </TabsContent>

        <TabsContent value="condition-proms">
          {renderConditionPROMsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
