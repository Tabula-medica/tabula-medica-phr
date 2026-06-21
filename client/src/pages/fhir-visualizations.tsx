import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { GuidedTour, useCompletedTours } from "@/components/guided-tour";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ObservationTrendChart, 
  VitalSignsGrid, 
  MedicationAdherenceChart, 
  EncounterHistoryChart,
  LabResultsChart 
} from "@/components/fhir-visualizations";
import { 
  ArrowLeft, 
  Activity, 
  Pill, 
  Calendar, 
  Droplet, 
  RefreshCw,
  BarChart3,
  TrendingUp,
  Heart,
  Stethoscope
} from "lucide-react";

interface FhirObservation {
  resourceType: "Observation";
  id: string;
  status: string;
  code: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  effectiveDateTime?: string;
  valueQuantity?: { value?: number; unit?: string };
  category?: Array<{ coding?: Array<{ code?: string; display?: string }> }>;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  id: string;
  status: string;
  intent: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  authoredOn?: string;
  dosageInstruction?: Array<{ text?: string }>;
}

interface FhirMedicationStatement {
  resourceType: "MedicationStatement";
  id: string;
  status: string;
  medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }>; text?: string };
  effectiveDateTime?: string;
  effectivePeriod?: { start?: string; end?: string };
}

interface FhirEncounter {
  resourceType: "Encounter";
  id: string;
  status: string;
  class: { system?: string; code?: string; display?: string };
  type?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  period?: { start?: string; end?: string };
  reasonCode?: Array<{ coding?: Array<{ code?: string; display?: string }>; text?: string }>;
  serviceProvider?: { reference?: string; display?: string };
}

export default function FhirVisualizationsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [selectedMetric, setSelectedMetric] = useState<string | undefined>();
  const [showTour, setShowTour] = useState(false);
  const { isComplete } = useCompletedTours();

  useEffect(() => {
    const hasSeenTour = isComplete("visualizations");
    const isFirstVisit = !localStorage.getItem("tabula_visualizations_visited");
    if (!hasSeenTour && isFirstVisit) {
      localStorage.setItem("tabula_visualizations_visited", "true");
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);

  const { data: observations, isLoading: observationsLoading, refetch: refetchObservations } = useQuery<FhirObservation[]>({
    queryKey: [`/api/fhir/patient/${patientId}/observations`],
  });

  const { data: medications, isLoading: medicationsLoading, refetch: refetchMedications } = useQuery<{
    medicationRequests: FhirMedicationRequest[];
    medicationStatements: FhirMedicationStatement[];
  }>({
    queryKey: [`/api/fhir/patient/${patientId}/medications`],
  });

  const { data: encounters, isLoading: encountersLoading, refetch: refetchEncounters } = useQuery<FhirEncounter[]>({
    queryKey: [`/api/fhir/patient/${patientId}/encounters`],
  });

  const { data: labs, isLoading: labsLoading, refetch: refetchLabs } = useQuery<{
    labObservations: FhirObservation[];
  }>({
    queryKey: [`/api/fhir/patient/${patientId}/labs`],
  });

  const isLoading = observationsLoading || medicationsLoading || encountersLoading || labsLoading;

  const handleRefreshAll = () => {
    refetchObservations();
    refetchMedications();
    refetchEncounters();
    refetchLabs();
  };

  const stats = {
    observations: observations?.length || 0,
    medications: (medications?.medicationRequests?.length || 0) + (medications?.medicationStatements?.length || 0),
    encounters: encounters?.length || 0,
    labResults: labs?.labObservations?.length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href={`/patients/${patientId}`}>
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold" data-testid="title-page">Health Data Visualizations</h1>
              <p className="text-muted-foreground">Interactive charts and trends from your health records</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefreshAll}
            disabled={isLoading}
            data-testid="button-refresh-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
          <Card data-testid="stat-observations">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Activity className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="value-observations">{stats.observations}</p>
                <p className="text-sm text-muted-foreground">Observations</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-medications">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Pill className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="value-medications">{stats.medications}</p>
                <p className="text-sm text-muted-foreground">Medications</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-encounters">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-secondary rounded-lg">
                <Calendar className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="value-encounters">{stats.encounters}</p>
                <p className="text-sm text-muted-foreground">Encounters</p>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="stat-labs">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Droplet className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="value-labs">{stats.labResults}</p>
                <p className="text-sm text-muted-foreground">Lab Results</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="vitals" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4" data-testid="tabs-visualizations">
            <TabsTrigger value="vitals" className="gap-2" data-testid="tab-vitals">
              <Heart className="h-4 w-4" />
              Vitals
            </TabsTrigger>
            <TabsTrigger value="medications" className="gap-2" data-testid="tab-medications">
              <Pill className="h-4 w-4" />
              Medications
            </TabsTrigger>
            <TabsTrigger value="encounters" className="gap-2" data-testid="tab-encounters">
              <Stethoscope className="h-4 w-4" />
              Encounters
            </TabsTrigger>
            <TabsTrigger value="labs" className="gap-2" data-testid="tab-labs">
              <Droplet className="h-4 w-4" />
              Labs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vitals" className="space-y-6">
            {observationsLoading ? (
              <div className="space-y-6">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-96 w-full" />
              </div>
            ) : (
              <>
                <VitalSignsGrid observations={observations || []} />
                <ObservationTrendChart 
                  observations={observations || []}
                  title="Vital Signs Trends"
                  description="Track changes in your vital signs over time"
                  selectedMetric={selectedMetric}
                  onMetricChange={setSelectedMetric}
                />
              </>
            )}
          </TabsContent>

          <TabsContent value="medications" className="space-y-6">
            {medicationsLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <MedicationAdherenceChart 
                medicationRequests={medications?.medicationRequests || []}
                medicationStatements={medications?.medicationStatements || []}
                title="Medication Overview"
                description="Estimated medication patterns based on prescription records"
              />
            )}
          </TabsContent>

          <TabsContent value="encounters" className="space-y-6">
            {encountersLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <EncounterHistoryChart 
                encounters={encounters || []}
                title="Healthcare Visits"
                description="View your encounter history and visit patterns"
              />
            )}
          </TabsContent>

          <TabsContent value="labs" className="space-y-6">
            {labsLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <LabResultsChart 
                observations={labs?.labObservations || []}
                title="Laboratory Results"
                description="Monitor trends in your lab test results"
              />
            )}
          </TabsContent>
        </Tabs>

        <Card data-testid="card-data-sources">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Data Sources
            </CardTitle>
            <CardDescription>
              Your health data is fetched from connected EHR systems via FHIR R4 APIs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" data-testid="badge-source-observations">
                <Activity className="h-3 w-3 mr-1" />
                {stats.observations} Observations
              </Badge>
              <Badge variant="outline" data-testid="badge-source-medications">
                <Pill className="h-3 w-3 mr-1" />
                {stats.medications} Medication Records
              </Badge>
              <Badge variant="outline" data-testid="badge-source-encounters">
                <Calendar className="h-3 w-3 mr-1" />
                {stats.encounters} Encounters
              </Badge>
              <Badge variant="outline" data-testid="badge-source-labs">
                <Droplet className="h-3 w-3 mr-1" />
                {stats.labResults} Lab Results
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {showTour && (
        <GuidedTour
          tourId="visualizations"
          steps={[
            {
              target: "[data-testid='stats-grid']",
              title: "Quick Statistics",
              content: "View a summary of your health data including observations, medications, encounters, and lab results.",
              placement: "bottom",
            },
            {
              target: "[data-testid='tabs-visualizations']",
              title: "Data Categories",
              content: "Switch between different types of health data to see detailed visualizations and trends.",
              placement: "bottom",
            },
            {
              target: "[data-testid='card-data-sources']",
              title: "Data Sources",
              content: "See which EHR systems your health data comes from and how many records are available.",
              placement: "top",
            },
          ]}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
