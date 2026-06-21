import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TestTube,
  TrendingUp,
  TrendingDown,
  Search,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Info,
  Building2,
  FlaskConical,
  FileText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface FHIRObservation {
  resourceType: string;
  id: string;
  status: string;
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  valueQuantity?: { value: number; unit: string };
  interpretation?: { coding: { system: string; code: string; display: string }[] }[];
  referenceRange?: { low?: { value: number; unit: string }; high?: { value: number; unit: string }; text?: string }[];
  performer?: { reference: string; display: string }[];
}

interface LabResult {
  id: string;
  orderId: string;
  patientId: string;
  providerId: string;
  providerName: string;
  testName: string;
  loincCode: string;
  value: string;
  unit: string;
  referenceRange: string;
  interpretation: "normal" | "abnormal" | "critical" | "indeterminate";
  status: "preliminary" | "final" | "corrected";
  collectedAt: string;
  reportedAt: string;
  performingLab: string;
  fhirObservation: FHIRObservation;
  noCdsDisclaimer: string;
}

type InterpretationStatus = "normal" | "abnormal" | "critical" | "indeterminate";

function getStatusIcon(interpretation: InterpretationStatus) {
  switch (interpretation) {
    case "abnormal":
      return <TrendingUp className="h-4 w-4 text-amber-500" />;
    case "critical":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "indeterminate":
      return <TrendingDown className="h-4 w-4 text-blue-500" />;
    default:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
  }
}

function getInterpretationBadge(interpretation: InterpretationStatus) {
  switch (interpretation) {
    case "abnormal":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100">Abnormal</Badge>;
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "indeterminate":
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Indeterminate</Badge>;
    default:
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Normal</Badge>;
  }
}

function getResultStatusBadge(status: string) {
  switch (status) {
    case "final":
      return <Badge variant="default">Final</Badge>;
    case "preliminary":
      return <Badge variant="secondary">Preliminary</Badge>;
    case "corrected":
      return <Badge variant="outline">Corrected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function LabResultsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterpretation, setSelectedInterpretation] = useState<string>("all");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  const resultsQuery = useQuery<{ results: LabResult[]; totalCount: number; noCdsDisclaimer: string }>({
    queryKey: ["/api/lab-diagnostics/results/patient-001"],
  });

  const results = resultsQuery.data?.results || [];

  const filteredResults = results.filter((result) => {
    const matchesSearch =
      result.testName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      result.loincCode.includes(searchQuery) ||
      result.providerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesInterpretation =
      selectedInterpretation === "all" || result.interpretation === selectedInterpretation;
    const matchesProvider = selectedProvider === "all" || result.providerId === selectedProvider;
    return matchesSearch && matchesInterpretation && matchesProvider;
  });

  const abnormalCount = results.filter((r) => r.interpretation !== "normal").length;
  const providers = Array.from(new Set(results.map((r) => r.providerId)));
  const providerNames = Object.fromEntries(results.map((r) => [r.providerId, r.providerName]));

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="lab-results-page">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <FlaskConical className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold" data-testid="title-lab-results">Lab Results</h1>
            <Badge variant="outline">
              <Info className="h-3 w-3 mr-1" />
              NO-CDS
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            View lab results from Quest Diagnostics and LabCorp via FHIR R4
          </p>
        </div>
        <Link href="/provider-lab-orders">
          <Button variant="outline" data-testid="link-order-labs">
            <TestTube className="h-4 w-4 mr-2" />
            Order New Labs
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Results</CardTitle>
            <TestTube className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-results">
              {resultsQuery.isLoading ? <Skeleton className="h-8 w-12" /> : results.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Final Results</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-final-results">
              {resultsQuery.isLoading ? <Skeleton className="h-8 w-12" /> : results.filter((r) => r.status === "final").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Attention</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-abnormal-count">
              {resultsQuery.isLoading ? <Skeleton className="h-8 w-12" /> : abnormalCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-provider-count">
              {resultsQuery.isLoading ? <Skeleton className="h-8 w-12" /> : providers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Lab Results</CardTitle>
              <CardDescription>FHIR R4 Observations from connected lab providers</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by test, LOINC, or lab..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-[220px]"
                  data-testid="input-search-labs"
                />
              </div>
              <Select value={selectedInterpretation} onValueChange={setSelectedInterpretation}>
                <SelectTrigger className="w-full sm:w-[150px]" data-testid="select-interpretation">
                  <SelectValue placeholder="Interpretation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="abnormal">Abnormal</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="indeterminate">Indeterminate</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-provider">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map((pid) => (
                    <SelectItem key={pid} value={pid}>
                      {providerNames[pid]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resultsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3">
                {filteredResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TestTube className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No lab results found matching your criteria</p>
                  </div>
                ) : (
                  filteredResults.map((result) => (
                    <Card key={result.id} className="hover-elevate" data-testid={`card-lab-result-${result.id}`}>
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {getStatusIcon(result.interpretation)}
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium" data-testid={`text-test-name-${result.id}`}>{result.testName}</span>
                                {getInterpretationBadge(result.interpretation)}
                                {getResultStatusBadge(result.status)}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  LOINC: {result.loincCode}
                                </Badge>
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {result.providerName}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{result.performingLab}</p>
                            </div>
                          </div>
                          <div className="text-right space-y-1 flex-shrink-0">
                            <div className="flex items-baseline gap-1 justify-end">
                              <span className="text-xl font-bold" data-testid={`text-result-value-${result.id}`}>
                                {result.value}
                              </span>
                              {result.unit && <span className="text-sm text-muted-foreground">{result.unit}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">Ref: {result.referenceRange}</p>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              <p className="flex items-center gap-1 justify-end">
                                <Calendar className="h-3 w-3" />
                                Collected: {format(new Date(result.collectedAt), "MMM d, yyyy")}
                              </p>
                              <p>Reported: {format(new Date(result.reportedAt), "MMM d, yyyy")}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground" data-testid="text-no-cds-disclaimer">
              {resultsQuery.data?.noCdsDisclaimer ||
                "Lab results are presented for informational purposes only. This system does NOT provide clinical decision support. All lab results must be interpreted by a qualified healthcare provider."}
            </p>
          </div>
        </CardContent>
      </Card>

      <ClinicalDisclaimer variant="compact" className="mt-4" testId="text-lab-results-disclaimer" />
    </div>
  );
}
