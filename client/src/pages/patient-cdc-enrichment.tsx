import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  Syringe,
  Bug,
  Wind,
  MapPin,
  Calendar,
  ExternalLink,
  Sparkles,
  Users,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  Clock,
  XCircle,
  Heart,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

interface HealthAdvisory {
  id: string;
  type: string;
  title: string;
  summary: string;
  severity: string;
  relevanceScore: number;
  relevanceReason: string;
  recommendations: string[];
  effectiveDate: string;
  sourceUrl?: string;
}

interface VaccinationRecommendation {
  id: string;
  vaccineName: string;
  vaccineType: string;
  recommendedFor: string;
  dueStatus: string;
  lastDose?: string;
  nextDueDate?: string;
  cdcScheduleLink: string;
  localCoverageRate?: number;
  notes: string[];
}

interface DiseasePrevalence {
  id: string;
  disease: string;
  location: string;
  prevalenceRate: number;
  trend: string;
  riskLevel: string;
  patientRiskFactors: string[];
  preventionMeasures: string[];
}

interface EnvironmentalAlert {
  id: string;
  type: string;
  location: string;
  level: string;
  description: string;
  healthImpact: string;
  affectedConditions: string[];
  recommendations: string[];
  validUntil: string;
}

interface PatientEnrichment {
  patientId: string;
  patientName: string;
  enrichmentDate: string;
  location: { state: string; county?: string };
  healthAdvisories: HealthAdvisory[];
  vaccinationRecommendations: VaccinationRecommendation[];
  diseasePrevalence: DiseasePrevalence[];
  environmentalAlerts: EnvironmentalAlert[];
  aiPersonalizedInsights?: string[];
  riskSummary: {
    overallRiskLevel: string;
    topRisks: string[];
    protectiveFactors: string[];
  };
  noCdsDisclaimer: string;
}

interface PatientList {
  patients: Array<{
    patientId: string;
    patientName: string;
    overallRiskLevel: string;
    topRisks: string[];
    advisoryCount: number;
    vaccinesDue: number;
  }>;
  summary: {
    totalPatients: number;
    highRiskCount: number;
    moderateRiskCount: number;
    lowRiskCount: number;
    totalAdvisories: number;
  };
  noCdsDisclaimer: string;
}

function getRiskVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "high":
    case "critical": return "destructive";
    case "moderate": return "default";
    default: return "secondary";
  }
}

function getVaccineStatusIcon(status: string) {
  switch (status) {
    case "up_to_date": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "due_soon": return <Clock className="h-4 w-4 text-yellow-500" />;
    case "overdue": return <XCircle className="h-4 w-4 text-red-500" />;
    default: return <Minus className="h-4 w-4" />;
  }
}

function getTrendIcon(trend: string) {
  switch (trend) {
    case "increasing": return <TrendingUp className="h-4 w-4 text-red-500" />;
    case "decreasing": return <TrendingDown className="h-4 w-4 text-green-500" />;
    default: return <Minus className="h-4 w-4" />;
  }
}

function getEnvAlertIcon(type: string) {
  switch (type) {
    case "air_quality": return <Wind className="h-4 w-4" />;
    case "pollen": return <Wind className="h-4 w-4" />;
    case "heat": return <Activity className="h-4 w-4" />;
    default: return <AlertTriangle className="h-4 w-4" />;
  }
}

export default function PatientCDCEnrichment() {
  const [selectedPatientId, setSelectedPatientId] = useState<string>("patient-1");

  const { data: patientList, isLoading: listLoading } = useQuery<PatientList>({
    queryKey: ["/api/patient-cdc-enrichment/patients"],
  });

  const { data: enrichment, isLoading: enrichmentLoading, refetch } = useQuery<PatientEnrichment>({
    queryKey: ["/api/patient-cdc-enrichment/patient", selectedPatientId],
    enabled: !!selectedPatientId,
  });

  if (listLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Heart className="h-8 w-8" />
              CDC Health Data Enrichment
            </h1>
            <p className="text-muted-foreground">
              Enrich patient profiles with public health information
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="w-48" data-testid="select-patient">
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patientList?.patients.map(p => (
                  <SelectItem key={p.patientId} value={p.patientId}>{p.patientName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Public Health Information Only</AlertTitle>
          <AlertDescription>
            {patientList?.noCdsDisclaimer || "CDC data is for informational purposes only. Not medical advice."}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Patients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-patients">
                {patientList?.summary.totalPatients || 0}
              </div>
              <p className="text-xs text-muted-foreground">with CDC enrichment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                High Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500" data-testid="text-high-risk">
                {patientList?.summary.highRiskCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">patients need attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Advisories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-advisories">
                {patientList?.summary.totalAdvisories || 0}
              </div>
              <p className="text-xs text-muted-foreground">active health advisories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Moderate Risk
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500" data-testid="text-moderate-risk">
                {patientList?.summary.moderateRiskCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">patients to monitor</p>
            </CardContent>
          </Card>
        </div>

        {enrichmentLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        ) : enrichment && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {enrichment.patientName}
                      <Badge variant={getRiskVariant(enrichment.riskSummary.overallRiskLevel)}>
                        {enrichment.riskSummary.overallRiskLevel.toUpperCase()} RISK
                      </Badge>
                    </CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {enrichment.location.county ? `${enrichment.location.county}, ` : ""}{enrichment.location.state}
                    </CardDescription>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Enriched: {format(new Date(enrichment.enrichmentDate), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              </CardHeader>
              {enrichment.aiPersonalizedInsights && enrichment.aiPersonalizedInsights.length > 0 && (
                <CardContent className="pt-0">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4" />
                      AI Personalized Insights
                    </h4>
                    <ul className="space-y-2">
                      {enrichment.aiPersonalizedInsights.map((insight, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              )}
            </Card>

            <Tabs defaultValue="advisories" className="w-full">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
                <TabsTrigger value="advisories" data-testid="tab-advisories">
                  <AlertTriangle className="h-4 w-4 mr-2 hidden sm:inline" />
                  Advisories
                </TabsTrigger>
                <TabsTrigger value="vaccinations" data-testid="tab-vaccinations">
                  <Syringe className="h-4 w-4 mr-2 hidden sm:inline" />
                  Vaccinations
                </TabsTrigger>
                <TabsTrigger value="diseases" data-testid="tab-diseases">
                  <Bug className="h-4 w-4 mr-2 hidden sm:inline" />
                  Disease Data
                </TabsTrigger>
                <TabsTrigger value="environmental" data-testid="tab-environmental">
                  <Wind className="h-4 w-4 mr-2 hidden sm:inline" />
                  Environmental
                </TabsTrigger>
              </TabsList>

              <TabsContent value="advisories" className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold">Health Advisories</h3>
                {enrichment.healthAdvisories.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      No active health advisories for this patient
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {enrichment.healthAdvisories.map(advisory => (
                      <Card key={advisory.id} data-testid={`card-advisory-${advisory.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {advisory.title}
                              </CardTitle>
                              <CardDescription>{advisory.relevanceReason}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={getRiskVariant(advisory.severity)}>{advisory.severity}</Badge>
                              <Badge variant="outline">{advisory.type}</Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4">{advisory.summary}</p>
                          <div className="space-y-2">
                            <h5 className="text-sm font-medium">Recommendations:</h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {advisory.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary">•</span>{rec}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {advisory.sourceUrl && (
                            <a 
                              href={advisory.sourceUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
                            >
                              <ExternalLink className="h-3 w-3" /> CDC Source
                            </a>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vaccinations" className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold">Vaccination Recommendations</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {enrichment.vaccinationRecommendations.map(vax => (
                    <Card key={vax.id} data-testid={`card-vaccine-${vax.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {getVaccineStatusIcon(vax.dueStatus)}
                              {vax.vaccineName}
                            </CardTitle>
                            <CardDescription>{vax.vaccineType}</CardDescription>
                          </div>
                          <Badge variant={
                            vax.dueStatus === "up_to_date" ? "secondary" :
                            vax.dueStatus === "overdue" ? "destructive" : "default"
                          }>
                            {vax.dueStatus.replace("_", " ")}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        <p className="text-muted-foreground">{vax.recommendedFor}</p>
                        {vax.lastDose && (
                          <p><span className="font-medium">Last dose:</span> {format(new Date(vax.lastDose), "MMM d, yyyy")}</p>
                        )}
                        {vax.localCoverageRate && (
                          <div>
                            <span className="font-medium">Local coverage: </span>
                            <span>{vax.localCoverageRate}%</span>
                            <Progress value={vax.localCoverageRate} className="mt-1 h-2" />
                          </div>
                        )}
                        {vax.notes.length > 0 && (
                          <ul className="text-muted-foreground">
                            {vax.notes.map((note, i) => (
                              <li key={i}>• {note}</li>
                            ))}
                          </ul>
                        )}
                        <a 
                          href={vax.cdcScheduleLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> CDC Schedule
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="diseases" className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold">Disease Prevalence in Your Area</h3>
                <div className="grid gap-4">
                  {enrichment.diseasePrevalence.map(disease => (
                    <Card key={disease.id} data-testid={`card-disease-${disease.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Bug className="h-4 w-4" />
                            {disease.disease}
                          </CardTitle>
                          <div className="flex gap-2 items-center">
                            {getTrendIcon(disease.trend)}
                            <span className="text-sm capitalize">{disease.trend}</span>
                            <Badge variant={getRiskVariant(disease.riskLevel)}>{disease.riskLevel} risk</Badge>
                          </div>
                        </div>
                        <CardDescription>
                          <MapPin className="h-3 w-3 inline mr-1" />{disease.location}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm space-y-3">
                        <div>
                          <span className="font-medium">Prevalence Rate: </span>
                          <span>{disease.prevalenceRate}%</span>
                        </div>
                        {disease.patientRiskFactors.length > 0 && (
                          <div>
                            <h5 className="font-medium mb-1">Your Risk Factors:</h5>
                            <div className="flex gap-1 flex-wrap">
                              {disease.patientRiskFactors.map((factor, i) => (
                                <Badge key={i} variant="outline">{factor}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <h5 className="font-medium mb-1">Prevention Measures:</h5>
                          <ul className="text-muted-foreground">
                            {disease.preventionMeasures.map((measure, i) => (
                              <li key={i}>• {measure}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="environmental" className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold">Environmental Health Alerts</h3>
                {enrichment.environmentalAlerts.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      No environmental alerts for your area
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4">
                    {enrichment.environmentalAlerts.map(alert => (
                      <Card key={alert.id} data-testid={`card-env-${alert.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base flex items-center gap-2">
                                {getEnvAlertIcon(alert.type)}
                                {alert.type.replace("_", " ").toUpperCase()}
                              </CardTitle>
                              <CardDescription>
                                <MapPin className="h-3 w-3 inline mr-1" />{alert.location}
                              </CardDescription>
                            </div>
                            <Badge variant={getRiskVariant(alert.level === "hazardous" ? "critical" : alert.level === "unhealthy" ? "high" : "moderate")}>
                              {alert.level}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                          <p>{alert.description}</p>
                          <p><span className="font-medium">Health Impact:</span> {alert.healthImpact}</p>
                          {alert.affectedConditions.length > 0 && (
                            <div>
                              <span className="font-medium">Affected Conditions: </span>
                              <div className="flex gap-1 flex-wrap mt-1">
                                {alert.affectedConditions.map((cond, i) => (
                                  <Badge key={i} variant="outline">{cond}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <h5 className="font-medium mb-1">Recommendations:</h5>
                            <ul className="text-muted-foreground">
                              {alert.recommendations.map((rec, i) => (
                                <li key={i}>• {rec}</li>
                              ))}
                            </ul>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Valid until: {format(new Date(alert.validUntil), "MMM d, yyyy")}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
