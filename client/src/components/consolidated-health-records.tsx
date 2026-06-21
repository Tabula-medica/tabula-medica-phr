import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Heart,
  Pill,
  Activity,
  Syringe,
  FileText,
  AlertTriangle,
  Building2,
  Search,
  Filter,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Database,
  Layers,
  Info,
  CheckCircle,
  AlertCircle,
  Stethoscope,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ConsolidatedHealthRecordsProps {
  userId: string;
  refreshKey?: number;
}

interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

interface ConsolidatedData {
  conditions: FHIRResource[];
  medications: FHIRResource[];
  observations: FHIRResource[];
  allergies: FHIRResource[];
  immunizations: FHIRResource[];
  procedures: FHIRResource[];
  encounters: FHIRResource[];
  documents: FHIRResource[];
}

interface SourceInfo {
  connectionId: string;
  platform: string;
  displayName: string;
}

const resourceTypeConfig: Record<string, { icon: typeof Activity; label: string; color: string }> = {
  conditions: { icon: Heart, label: "Conditions", color: "text-red-600" },
  medications: { icon: Pill, label: "Medications", color: "text-blue-600" },
  observations: { icon: Activity, label: "Vital Signs & Labs", color: "text-green-600" },
  allergies: { icon: AlertTriangle, label: "Allergies", color: "text-yellow-600" },
  immunizations: { icon: Syringe, label: "Immunizations", color: "text-purple-600" },
  procedures: { icon: Stethoscope, label: "Procedures", color: "text-indigo-600" },
  encounters: { icon: Building2, label: "Encounters", color: "text-teal-600" },
  documents: { icon: FileText, label: "Documents", color: "text-gray-600" },
};

export function ConsolidatedHealthRecordsCard({ userId, refreshKey }: ConsolidatedHealthRecordsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState<string>("all");

  const { data: connectionsData, isLoading: loadingConnections } = useQuery<{ success: boolean; connections: any[] }>({
    queryKey: ["/api/ehr/connections", userId, refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/ehr/connections?userId=${encodeURIComponent(userId)}`);
      return res.json();
    },
  });

  const { data: consolidatedData, isLoading: loadingData } = useQuery<{ success: boolean; data: ConsolidatedData; sources: SourceInfo[] }>({
    queryKey: ["/api/ehr/consolidated", userId, refreshKey],
    queryFn: async () => {
      const res = await fetch(`/api/ehr/consolidated?userId=${encodeURIComponent(userId)}`);
      return res.json();
    },
    enabled: !!connectionsData?.connections?.length,
  });

  const connections = connectionsData?.connections || [];
  const data = consolidatedData?.data;
  const sources = consolidatedData?.sources || [];

  const filteredData = useMemo(() => {
    if (!data) return null;

    const filterBySource = (items: FHIRResource[]) => {
      if (selectedSource === "all") return items;
      return items.filter(item => item._sourceConnectionId === selectedSource);
    };

    const filterBySearch = (items: FHIRResource[]) => {
      if (!searchQuery) return items;
      const query = searchQuery.toLowerCase();
      return items.filter(item => {
        const searchableText = JSON.stringify(item).toLowerCase();
        return searchableText.includes(query);
      });
    };

    return {
      conditions: filterBySearch(filterBySource(data.conditions || [])),
      medications: filterBySearch(filterBySource(data.medications || [])),
      observations: filterBySearch(filterBySource(data.observations || [])),
      allergies: filterBySearch(filterBySource(data.allergies || [])),
      immunizations: filterBySearch(filterBySource(data.immunizations || [])),
      procedures: filterBySearch(filterBySource(data.procedures || [])),
      encounters: filterBySearch(filterBySource(data.encounters || [])),
      documents: filterBySearch(filterBySource(data.documents || [])),
    };
  }, [data, selectedSource, searchQuery]);

  const getTotalRecords = () => {
    if (!filteredData) return 0;
    return Object.values(filteredData).reduce((sum, arr) => sum + arr.length, 0);
  };

  const getConditionDisplay = (condition: FHIRResource) => {
    const code = condition.code;
    const display = code?.text || code?.coding?.[0]?.display || "Unknown Condition";
    const status = condition.clinicalStatus?.coding?.[0]?.code || "unknown";
    const onset = condition.onsetDateTime;
    return { display, status, onset };
  };

  const getMedicationDisplay = (medication: FHIRResource) => {
    const med = medication.medicationCodeableConcept;
    const display = med?.text || med?.coding?.[0]?.display || "Unknown Medication";
    const status = medication.status || "unknown";
    const dosage = medication.dosageInstruction?.[0]?.text;
    return { display, status, dosage };
  };

  const getObservationDisplay = (observation: FHIRResource) => {
    const code = observation.code;
    const display = code?.coding?.[0]?.display || code?.text || "Unknown Observation";
    const value = observation.valueQuantity;
    const valueStr = value ? `${value.value} ${value.unit}` : observation.valueString || "N/A";
    const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code;
    const effectiveDate = observation.effectiveDateTime;
    return { display, valueStr, interpretation, effectiveDate };
  };

  const getAllergyDisplay = (allergy: FHIRResource) => {
    const code = allergy.code;
    const display = code?.text || code?.coding?.[0]?.display || "Unknown Allergen";
    const severity = allergy.reaction?.[0]?.severity || "unknown";
    const criticality = allergy.criticality;
    return { display, severity, criticality };
  };

  const getImmunizationDisplay = (immunization: FHIRResource) => {
    const vaccine = immunization.vaccineCode;
    const display = vaccine?.coding?.[0]?.display || vaccine?.text || "Unknown Vaccine";
    const date = immunization.occurrenceDateTime;
    const status = immunization.status;
    return { display, date, status };
  };

  const getInterpretationBadge = (interpretation?: string) => {
    switch (interpretation) {
      case "H":
      case "HH":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"><TrendingUp className="h-3 w-3 mr-1" />High</Badge>;
      case "L":
      case "LL":
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><TrendingDown className="h-3 w-3 mr-1" />Low</Badge>;
      case "N":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="h-3 w-3 mr-1" />Normal</Badge>;
      default:
        return null;
    }
  };

  if (loadingConnections || loadingData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Consolidated Health Records</CardTitle>
          <CardDescription>Loading your health data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!connections.length) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Consolidated Health Records</CardTitle>
              <CardDescription>View all your health data in one place</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">No Health Records Connected</h3>
            <p className="text-sm text-muted-foreground">
              Connect your health records from hospitals and clinics to see your consolidated medical history.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Consolidated Health Records</CardTitle>
              <CardDescription>
                {getTotalRecords()} records from {connections.length} source{connections.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Updated {connections[0]?.lastSyncAt ? formatDistanceToNow(new Date(connections[0].lastSyncAt), { addSuffix: true }) : "recently"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search health records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-records"
            />
          </div>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-source-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.connectionId} value={source.connectionId}>
                  {source.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" data-testid="tab-overview">
              Overview
            </TabsTrigger>
            <TabsTrigger value="conditions" data-testid="tab-conditions">
              <Heart className="h-4 w-4 mr-1" />
              Conditions
              {filteredData?.conditions.length ? <Badge variant="secondary" className="ml-1">{filteredData.conditions.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="medications" data-testid="tab-medications">
              <Pill className="h-4 w-4 mr-1" />
              Medications
              {filteredData?.medications.length ? <Badge variant="secondary" className="ml-1">{filteredData.medications.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="labs" data-testid="tab-labs">
              <Activity className="h-4 w-4 mr-1" />
              Labs
              {filteredData?.observations.length ? <Badge variant="secondary" className="ml-1">{filteredData.observations.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="allergies" data-testid="tab-allergies">
              <AlertTriangle className="h-4 w-4 mr-1" />
              Allergies
              {filteredData?.allergies.length ? <Badge variant="secondary" className="ml-1">{filteredData.allergies.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="immunizations" data-testid="tab-immunizations">
              <Syringe className="h-4 w-4 mr-1" />
              Immunizations
              {filteredData?.immunizations.length ? <Badge variant="secondary" className="ml-1">{filteredData.immunizations.length}</Badge> : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(resourceTypeConfig).slice(0, 4).map(([key, config]) => {
                const count = filteredData?.[key as keyof ConsolidatedData]?.length || 0;
                const IconComponent = config.icon;
                return (
                  <Card key={key} className="hover-elevate cursor-pointer" onClick={() => setActiveTab(key === "observations" ? "labs" : key)}>
                    <CardContent className="p-4 text-center">
                      <IconComponent className={`h-8 w-8 mx-auto mb-2 ${config.color}`} />
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-xs text-muted-foreground">{config.label}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="mt-6">
              <h4 className="font-medium mb-3">Recent Activity</h4>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {filteredData?.observations.slice(0, 5).map((obs) => {
                    const { display, valueStr, interpretation, effectiveDate } = getObservationDisplay(obs);
                    return (
                      <div key={obs.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <Activity className="h-4 w-4 text-green-600" />
                          <div>
                            <div className="font-medium text-sm">{display}</div>
                            <div className="text-xs text-muted-foreground">
                              {effectiveDate ? format(new Date(effectiveDate), "MMM d, yyyy") : "Unknown date"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{valueStr}</span>
                          {getInterpretationBadge(interpretation)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>NO-CDS Disclaimer:</strong> This consolidated view is for informational purposes only and does not constitute clinical decision support. Always consult your healthcare provider for medical decisions.
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredData?.conditions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No conditions found
                  </div>
                ) : (
                  filteredData?.conditions.map((condition) => {
                    const { display, status, onset } = getConditionDisplay(condition);
                    return (
                      <div key={condition.id} className="p-4 rounded-lg border hover-elevate" data-testid={`condition-${condition.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Heart className="h-5 w-5 text-red-600 shrink-0" />
                            <div>
                              <div className="font-medium">{display}</div>
                              {onset && (
                                <div className="text-sm text-muted-foreground">
                                  Since {format(new Date(onset), "MMM d, yyyy")}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant={status === "active" ? "default" : "secondary"}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="medications" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredData?.medications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No medications found
                  </div>
                ) : (
                  filteredData?.medications.map((medication) => {
                    const { display, status, dosage } = getMedicationDisplay(medication);
                    return (
                      <div key={medication.id} className="p-4 rounded-lg border hover-elevate" data-testid={`medication-${medication.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Pill className="h-5 w-5 text-blue-600 shrink-0" />
                            <div>
                              <div className="font-medium">{display}</div>
                              {dosage && (
                                <div className="text-sm text-muted-foreground">{dosage}</div>
                              )}
                            </div>
                          </div>
                          <Badge variant={status === "active" ? "default" : "secondary"}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="labs" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredData?.observations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No lab results found
                  </div>
                ) : (
                  filteredData?.observations.map((observation) => {
                    const { display, valueStr, interpretation, effectiveDate } = getObservationDisplay(observation);
                    return (
                      <div key={observation.id} className="p-4 rounded-lg border hover-elevate" data-testid={`observation-${observation.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Activity className="h-5 w-5 text-green-600 shrink-0" />
                            <div>
                              <div className="font-medium">{display}</div>
                              {effectiveDate && (
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(effectiveDate), "MMM d, yyyy 'at' h:mm a")}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{valueStr}</span>
                            {getInterpretationBadge(interpretation)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="allergies" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredData?.allergies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No allergies found
                  </div>
                ) : (
                  filteredData?.allergies.map((allergy) => {
                    const { display, severity, criticality } = getAllergyDisplay(allergy);
                    return (
                      <div key={allergy.id} className="p-4 rounded-lg border hover-elevate" data-testid={`allergy-${allergy.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0" />
                            <div>
                              <div className="font-medium">{display}</div>
                              <div className="text-sm text-muted-foreground">
                                Severity: {severity}
                              </div>
                            </div>
                          </div>
                          {criticality === "high" && (
                            <Badge variant="destructive">High Risk</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="immunizations" className="mt-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {filteredData?.immunizations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No immunizations found
                  </div>
                ) : (
                  filteredData?.immunizations.map((immunization) => {
                    const { display, date, status } = getImmunizationDisplay(immunization);
                    return (
                      <div key={immunization.id} className="p-4 rounded-lg border hover-elevate" data-testid={`immunization-${immunization.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <Syringe className="h-5 w-5 text-purple-600 shrink-0" />
                            <div>
                              <div className="font-medium">{display}</div>
                              {date && (
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(date), "MMM d, yyyy")}
                                </div>
                              )}
                            </div>
                          </div>
                          <Badge variant={status === "completed" ? "default" : "secondary"}>
                            {status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ConsolidatedHealthRecordsCard;
