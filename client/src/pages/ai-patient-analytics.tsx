import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Heart,
  Brain,
  BarChart3,
  PieChart,
  FileText,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Stethoscope,
  Pill,
  Building,
  Info,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

function NoCdsDisclaimer({ disclaimer }: { disclaimer: any }) {
  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5 mb-6" data-testid="card-no-cds-disclaimer">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-700 dark:text-yellow-400">{disclaimer?.notice}</p>
            <p className="text-sm text-muted-foreground mt-1">{disclaimer?.description}</p>
            {disclaimer?.complianceStatement && (
              <p className="text-xs text-muted-foreground mt-2 italic">{disclaimer.complianceStatement}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReadmissionRiskSection() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/ai-patient-analytics/readmission-risk"],
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { disclaimer, summary, patients } = data || {};

  return (
    <div className="space-y-6">
      <NoCdsDisclaimer disclaimer={disclaimer} />

      <div className="grid md:grid-cols-4 gap-4">
        <Card data-testid="card-total-analyzed">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Analyzed</p>
                <p className="text-2xl font-bold">{summary?.totalAnalyzed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-high-risk">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk</p>
                <p className="text-2xl font-bold text-red-600">{summary?.highRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-moderate-risk">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moderate Risk</p>
                <p className="text-2xl font-bold text-yellow-600">{summary?.moderateRisk}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-score">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Risk Score</p>
                <p className="text-2xl font-bold">{summary?.averageRiskScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-patients-list">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            Predicted Readmission Risk by Patient
          </CardTitle>
          <CardDescription>AI-predicted 30-day readmission risk for operational planning</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {patients?.map((patient: any) => (
                <div key={patient.patientId} className="p-4 rounded-lg border" data-testid={`patient-risk-${patient.patientId}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{patient.patientName}</p>
                        <Badge variant={
                          patient.riskLevel === "high" ? "destructive" :
                          patient.riskLevel === "moderate" ? "secondary" : "default"
                        }>
                          {patient.riskLevel} risk
                        </Badge>
                        <Badge variant="outline">{patient.condition}</Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Risk Score</span>
                            <span className="font-medium">{(patient.riskScore * 100).toFixed(0)}%</span>
                          </div>
                          <Progress 
                            value={patient.riskScore * 100} 
                            className={`h-2 ${patient.riskLevel === "high" ? "[&>div]:bg-red-500" : patient.riskLevel === "moderate" ? "[&>div]:bg-yellow-500" : ""}`}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {patient.primaryFactors.map((factor: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">{factor}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        <span className="font-medium">Staffing Priority:</span> {patient.staffingPriority}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-muted-foreground">Last Admission</p>
                      <p className="font-medium">{patient.lastAdmission}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function ChronicConditionsSection() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/ai-patient-analytics/chronic-conditions"],
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { disclaimer, summary, conditions } = data || {};

  return (
    <div className="space-y-6">
      <NoCdsDisclaimer disclaimer={disclaimer} />

      <div className="grid md:grid-cols-4 gap-4">
        <Card data-testid="card-conditions-tracked">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Stethoscope className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conditions Tracked</p>
                <p className="text-2xl font-bold">{summary?.totalConditionsTracked}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-needing-attention">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Needing Attention</p>
                <p className="text-2xl font-bold text-orange-600">{summary?.totalPatientsNeedingAttention}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-adherence">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Adherence</p>
                <p className="text-2xl font-bold">{summary?.averageAdherenceRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-high-risk-patients">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Risk Patients</p>
                <p className="text-2xl font-bold text-red-600">{summary?.highRiskPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {conditions?.map((condition: any) => (
          <Card key={condition.conditionName} data-testid={`card-condition-${condition.conditionName}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500" />
                  {condition.conditionName}
                </CardTitle>
                <Badge variant="secondary">{condition.totalPatients.toLocaleString()} patients</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-600">{condition.riskBreakdown.high}</p>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-600">{condition.riskBreakdown.moderate}</p>
                  <p className="text-xs text-muted-foreground">Moderate</p>
                </div>
                <div className="p-3 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-600">{condition.riskBreakdown.low}</p>
                  <p className="text-xs text-muted-foreground">Low Risk</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Appointment Adherence</span>
                  <span className="font-medium">{condition.appointmentAdherenceRate}%</span>
                </div>
                <Progress value={condition.appointmentAdherenceRate} className="h-2" />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Operational Concerns</p>
                <div className="flex flex-wrap gap-1">
                  {condition.operationalConcerns?.map((concern: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-xs">{concern}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Resource Needs</p>
                <div className="flex flex-wrap gap-1">
                  {condition.resourceNeeds.map((need: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-xs">{need}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TreatmentEffectivenessSection() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/ai-patient-analytics/treatment-effectiveness"],
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { disclaimer, summary, treatments } = data || {};

  return (
    <div className="space-y-6">
      <NoCdsDisclaimer disclaimer={disclaimer} />

      <div className="grid md:grid-cols-4 gap-4">
        <Card data-testid="card-programs-tracked">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Building className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Programs Tracked</p>
                <p className="text-2xl font-bold">{summary?.programsTracked}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-total-enrolled">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Enrolled</p>
                <p className="text-2xl font-bold">{summary?.totalEnrolled?.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-avg-completion">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Completion Rate</p>
                <p className="text-2xl font-bold">{summary?.avgCompletionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-high-utilization">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">High Utilization</p>
                <p className="text-2xl font-bold">{summary?.highUtilizationPrograms}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-program-utilization">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-500" />
            Program Utilization Overview
          </CardTitle>
          <CardDescription>Completion rates across program cohorts (operational metrics only)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={treatments} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="programName" type="category" width={220} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="programCompletionRate" fill="#3b82f6" name="Completion Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {treatments?.map((program: any) => (
          <Card key={program.programName} data-testid={`card-program-${program.programName?.replace(/\s+/g, '-')}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base">{program.programName}</CardTitle>
                <Badge variant={program.resourceUtilization === "very high" ? "destructive" : program.resourceUtilization === "high" ? "secondary" : "outline"}>
                  {program.resourceUtilization} utilization
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Enrollment</p>
                  <p className="font-medium">{program.enrollmentCount?.toLocaleString()} patients</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Completion Rate</p>
                  <p className="font-medium">{program.programCompletionRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Program Duration</p>
                  <p className="font-medium">{program.programDuration}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dropout Rate</p>
                  <p className="font-medium">{program.dropoutRate}%</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">{program.capacityNotes}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="text-center p-2 rounded bg-blue-500/10">
                  <p className="text-lg font-bold">{program.demographicBreakdown?.age65Plus}%</p>
                  <p className="text-xs text-muted-foreground">Age 65+ Enrollment</p>
                </div>
                <div className="text-center p-2 rounded bg-green-500/10">
                  <p className="text-lg font-bold">{program.demographicBreakdown?.ageLess65}%</p>
                  <p className="text-xs text-muted-foreground">Age &lt;65 Enrollment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PopulationHealthSection() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/ai-patient-analytics/population-trends"],
  });

  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const { disclaimer, data: trends } = data || {};
  const { overallMetrics, trendsByMonth, topConditions, demographicBreakdown, qualityMetrics, predictions } = trends || {};

  const riskData = demographicBreakdown?.riskStratification ? [
    { name: "Low Risk", value: demographicBreakdown.riskStratification.low },
    { name: "Moderate Risk", value: demographicBreakdown.riskStratification.moderate },
    { name: "High Risk", value: demographicBreakdown.riskStratification.high },
  ] : [];

  return (
    <div className="space-y-6">
      <NoCdsDisclaimer disclaimer={disclaimer} />

      <div className="grid md:grid-cols-4 gap-4">
        <Card data-testid="card-total-patients">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{overallMetrics?.totalPatients?.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-chronic-prevalence">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Heart className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chronic Prevalence</p>
                <p className="text-2xl font-bold">{overallMetrics?.chronicConditionPrevalence}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-preventive-compliance">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Preventive Care</p>
                <p className="text-2xl font-bold">{overallMetrics?.preventiveCareCompliance}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-readmission-rate">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Building className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">30-Day Readmission</p>
                <p className="text-2xl font-bold">{overallMetrics?.readmissionRate30Day}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-utilization-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Utilization Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="admissions" stroke="#3b82f6" name="Admissions" />
                  <Line type="monotone" dataKey="erVisits" stroke="#f59e0b" name="ER Visits" />
                  <Line type="monotone" dataKey="preventiveVisits" stroke="#10b981" name="Preventive" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-risk-distribution">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-purple-500" />
              Risk Stratification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={riskData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-top-conditions">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-red-500" />
            Top Conditions by Prevalence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topConditions?.map((condition: any) => (
              <div key={condition.condition} className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{condition.condition}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{condition.prevalence}%</span>
                      {condition.trend === "increasing" ? (
                        <TrendingUp className="h-4 w-4 text-red-500" />
                      ) : condition.trend === "decreasing" ? (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      ) : (
                        <Activity className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                  </div>
                  <Progress value={condition.prevalence} className="h-2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card data-testid="card-quality-metrics">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Quality Metrics vs Targets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {qualityMetrics && Object.entries(qualityMetrics).map(([key, metric]: [string, any]) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <div className="flex items-center gap-2">
                      <span className={metric.current >= metric.target ? "text-green-600" : "text-orange-600"}>
                        {metric.current}%
                      </span>
                      <span className="text-muted-foreground">/ {metric.target}%</span>
                      <Badge variant={metric.trend === "improving" ? "default" : "secondary"} className="text-xs">
                        {metric.trend}
                      </Badge>
                    </div>
                  </div>
                  <div className="relative">
                    <Progress value={(metric.current / metric.target) * 100} className="h-2" />
                    <div 
                      className="absolute top-0 h-2 w-0.5 bg-foreground/50" 
                      style={{ left: `${Math.min((metric.target / 100) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-predictions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500" />
              AI Predictions & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{predictions?.projectedAdmissions?.next30Days}</p>
                <p className="text-sm text-muted-foreground">Projected Admissions (30 days)</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{predictions?.projectedAdmissions?.next90Days}</p>
                <p className="text-sm text-muted-foreground">Projected Admissions (90 days)</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Seasonal Factors</p>
              <div className="space-y-1">
                {predictions?.seasonalFactors?.map((factor: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Resource Recommendations</p>
              <div className="space-y-1">
                {predictions?.resourceRecommendations?.map((rec: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AIPatientAnalytics() {
  const [activeTab, setActiveTab] = useState("readmission");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleExportReport = () => {
    console.log("Exporting comprehensive report...");
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-ai-patient-analytics">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Patient Analytics</h1>
          <p className="text-muted-foreground">Operational predictions for resource planning and population health management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsRefreshing(true)} disabled={isRefreshing} data-testid="button-refresh">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleExportReport} data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="readmission" data-testid="tab-readmission">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Readmission Risk
          </TabsTrigger>
          <TabsTrigger value="chronic" data-testid="tab-chronic">
            <Heart className="h-4 w-4 mr-2" />
            Chronic Conditions
          </TabsTrigger>
          <TabsTrigger value="treatment" data-testid="tab-treatment">
            <Pill className="h-4 w-4 mr-2" />
            Treatment Effectiveness
          </TabsTrigger>
          <TabsTrigger value="population" data-testid="tab-population">
            <BarChart3 className="h-4 w-4 mr-2" />
            Population Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readmission">
          <ReadmissionRiskSection />
        </TabsContent>

        <TabsContent value="chronic">
          <ChronicConditionsSection />
        </TabsContent>

        <TabsContent value="treatment">
          <TreatmentEffectivenessSection />
        </TabsContent>

        <TabsContent value="population">
          <PopulationHealthSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
