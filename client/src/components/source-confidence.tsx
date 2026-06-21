import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Layers,
  Pill,
  FlaskConical,
  Heart,
  AlertTriangle,
  Scissors,
  Check,
  AlertCircle,
  RefreshCw,
  Building2,
  Clock,
  Database,
  Shield,
  FileText,
  User,
  CreditCard,
} from "lucide-react";

interface SourceRecord {
  sourceId: string;
  sourceName: string;
  sourceType: "ehr" | "pharmacy" | "lab" | "hospital" | "patient_reported" | "claims";
  recordId: string;
  rawValue: string;
  normalizedValue?: string;
  lastUpdated: string;
  confidence: number;
}

interface MergedRecord {
  id: string;
  type: "medication" | "lab_result" | "condition" | "allergy" | "procedure";
  displayName: string;
  normalizedName: string;
  status: "active" | "inactive" | "resolved";
  sources: SourceRecord[];
  sourceCount: number;
  lastUpdated: string;
  hasConflict: boolean;
  conflictDetails?: string;
  mergedDetails: Record<string, any>;
  confidenceScore: number;
}

interface DedupSummary {
  totalRecords: number;
  uniqueRecords: number;
  duplicatesRemoved: number;
  conflictsDetected: number;
  recordsByType: Record<string, number>;
}

interface DeduplicatedRecordsResponse {
  patientId: string;
  generatedAt: string;
  medications: MergedRecord[];
  labResults: MergedRecord[];
  conditions: MergedRecord[];
  allergies: MergedRecord[];
  procedures: MergedRecord[];
  summary: DedupSummary;
}

const sourceTypeConfig: Record<SourceRecord["sourceType"], { label: string; icon: typeof Building2; color: string }> = {
  ehr: { label: "EHR", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  hospital: { label: "Hospital", icon: Building2, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  lab: { label: "Lab", icon: FlaskConical, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  pharmacy: { label: "Pharmacy", icon: Pill, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  claims: { label: "Claims", icon: CreditCard, color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
  patient_reported: { label: "Self-Reported", icon: User, color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
};

const recordTypeConfig: Record<MergedRecord["type"], { label: string; icon: typeof Pill; pluralLabel: string }> = {
  medication: { label: "Medication", icon: Pill, pluralLabel: "Medications" },
  lab_result: { label: "Lab Result", icon: FlaskConical, pluralLabel: "Lab Results" },
  condition: { label: "Condition", icon: Heart, pluralLabel: "Conditions" },
  allergy: { label: "Allergy", icon: AlertTriangle, pluralLabel: "Allergies" },
  procedure: { label: "Procedure", icon: Scissors, pluralLabel: "Procedures" },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ConfidenceBar({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  const colorClass = percentage >= 90 ? "text-green-600" : percentage >= 75 ? "text-yellow-600" : "text-orange-600";

  return (
    <div className="flex items-center gap-2">
      <Progress value={percentage} className="h-2 flex-1" />
      <span className={`text-xs font-medium w-10 ${colorClass}`}>{percentage}%</span>
    </div>
  );
}

function SourceBadge({ source }: { source: SourceRecord }) {
  const config = sourceTypeConfig[source.sourceType];
  const Icon = config.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`${config.color} text-xs cursor-help`}>
          <Icon className="h-3 w-3 mr-1" />
          {source.sourceName}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{source.sourceName}</p>
          <p className="text-xs text-muted-foreground">Type: {config.label}</p>
          <p className="text-xs text-muted-foreground">Original: {source.rawValue}</p>
          <p className="text-xs text-muted-foreground">Updated: {formatDate(source.lastUpdated)}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function MergedRecordCard({ record }: { record: MergedRecord }) {
  const typeConfig = recordTypeConfig[record.type];
  const Icon = typeConfig.icon;

  return (
    <AccordionItem
      value={record.id}
      className="border rounded-lg mb-3 overflow-visible"
      data-testid={`merged-record-${record.id}`}
    >
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover-elevate rounded-t-lg">
        <div className="flex items-start gap-3 w-full text-left">
          <div className="p-2 rounded-md bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-medium" data-testid={`record-name-${record.id}`}>
                {record.displayName}
              </span>
              {record.hasConflict && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Conflict
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                {record.sourceCount} source{record.sourceCount !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Last updated: {formatDate(record.lastUpdated)}</span>
            </div>
          </div>
          <div className="w-24 hidden sm:block">
            <ConfidenceBar score={record.confidenceScore} />
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          <div className="sm:hidden">
            <p className="text-xs font-medium mb-1">Confidence Score</p>
            <ConfidenceBar score={record.confidenceScore} />
          </div>

          {record.hasConflict && record.conflictDetails && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Conflict Detected</p>
                  <p className="text-sm text-muted-foreground">{record.conflictDetails}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h5 className="text-sm font-medium flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              Sources ({record.sourceCount})
            </h5>
            <div className="space-y-2">
              {record.sources.map((source) => {
                const config = sourceTypeConfig[source.sourceType];
                const SourceIcon = config.icon;

                return (
                  <div
                    key={source.sourceId}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
                    data-testid={`source-${source.sourceId}`}
                  >
                    <div className={`p-1.5 rounded ${config.color}`}>
                      <SourceIcon className="h-3 w-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{source.sourceName}</span>
                        <Badge variant="outline" className="text-xs">
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        "{source.rawValue}"
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated: {formatDate(source.lastUpdated)}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium">
                        {Math.round(source.confidence * 100)}%
                      </span>
                      <p className="text-xs text-muted-foreground">confidence</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function RecordsList({ records, type }: { records: MergedRecord[]; type: MergedRecord["type"] }) {
  const config = recordTypeConfig[type];

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <config.icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No {config.pluralLabel.toLowerCase()} found.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <Accordion type="multiple" className="space-y-0">
        {records.map((record) => (
          <MergedRecordCard key={record.id} record={record} />
        ))}
      </Accordion>
    </ScrollArea>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function SourceConfidenceView() {
  const [activeTab, setActiveTab] = useState("medications");

  const { data, isLoading, refetch, isFetching } = useQuery<DeduplicatedRecordsResponse>({
    queryKey: ["/api/deduplicated-records"],
  });

  return (
    <Card className="w-full" data-testid="source-confidence-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-blue-500/20">
            <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Unified Health Records
            </CardTitle>
            <CardDescription>
              No more duplicate meds - see all your records from every source
            </CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh deduplicated records"
          data-testid="button-refresh-dedup"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <SummarySkeleton />
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="dedup-summary">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-primary" data-testid="total-records">
                  {data.summary.totalRecords}
                </p>
                <p className="text-xs text-muted-foreground">Total Records</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-green-600" data-testid="unique-records">
                  {data.summary.uniqueRecords}
                </p>
                <p className="text-xs text-muted-foreground">Unique Items</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-blue-600" data-testid="duplicates-removed">
                  {data.summary.duplicatesRemoved}
                </p>
                <p className="text-xs text-muted-foreground">Duplicates Merged</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-amber-600" data-testid="conflicts-detected">
                  {data.summary.conflictsDetected}
                </p>
                <p className="text-xs text-muted-foreground">Conflicts Found</p>
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm">
                AI has merged {data.summary.duplicatesRemoved} duplicate records from multiple sources
              </span>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="medications" data-testid="tab-medications-dedup">
                  <Pill className="h-4 w-4 mr-1.5" />
                  Medications ({data.medications.length})
                </TabsTrigger>
                <TabsTrigger value="labResults" data-testid="tab-labs-dedup">
                  <FlaskConical className="h-4 w-4 mr-1.5" />
                  Labs ({data.labResults.length})
                </TabsTrigger>
                <TabsTrigger value="conditions" data-testid="tab-conditions-dedup">
                  <Heart className="h-4 w-4 mr-1.5" />
                  Conditions ({data.conditions.length})
                </TabsTrigger>
                <TabsTrigger value="allergies" data-testid="tab-allergies-dedup">
                  <AlertTriangle className="h-4 w-4 mr-1.5" />
                  Allergies ({data.allergies.length})
                </TabsTrigger>
                <TabsTrigger value="procedures" data-testid="tab-procedures-dedup">
                  <Scissors className="h-4 w-4 mr-1.5" />
                  Procedures ({data.procedures.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="medications">
                <RecordsList records={data.medications} type="medication" />
              </TabsContent>
              <TabsContent value="labResults">
                <RecordsList records={data.labResults} type="lab_result" />
              </TabsContent>
              <TabsContent value="conditions">
                <RecordsList records={data.conditions} type="condition" />
              </TabsContent>
              <TabsContent value="allergies">
                <RecordsList records={data.allergies} type="allergy" />
              </TabsContent>
              <TabsContent value="procedures">
                <RecordsList records={data.procedures} type="procedure" />
              </TabsContent>
            </Tabs>

            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-md">
              <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Records are automatically matched and merged using AI. Each source is weighted by reliability:
                EHR (95%) &gt; Hospital (90%) &gt; Lab (90%) &gt; Pharmacy (85%) &gt; Claims (75%) &gt; Self-Reported (60%).
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No health records available.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
