import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { PageHeader, LoadingState, StatCardGrid, type StatCardItem } from "@/components/shared";
import {
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  Star,
  Layers,
  BarChart3,
  Search,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface USCDIv3Element {
  name: string;
  fhirPath: string;
  required: boolean;
  newInV3: boolean;
  description: string;
}

interface USCDIv3DataClass {
  dataClass: string;
  label: string;
  fhirResourceType: string;
  fhirProfile: string;
  elements: USCDIv3Element[];
  terminology: string[];
  description: string;
  newInV3: boolean;
  complianceStatus: "compliant" | "partial" | "not_implemented" | "not_applicable";
  implementationNotes: string;
}

interface USCDIv3GapItem {
  dataClass: string;
  label: string;
  missingElements: string[];
  partialElements: string[];
  recommendations: string[];
  effort: "low" | "medium" | "high";
  priority: "critical" | "high" | "medium" | "low";
}

interface ComplianceSummary {
  success: boolean;
  version: string;
  mandatoryDate: string;
  regulatoryBasis: string;
  totalDataClasses: number;
  totalElements: number;
  compliantClasses: number;
  partialClasses: number;
  notImplementedClasses: number;
  overallScore: number;
  dataClasses: USCDIv3DataClass[];
  newInV3Summary: {
    newDataClasses: string[];
    newElements: { dataClass: string; element: string }[];
  };
  lastAssessed: string;
}

function statusIcon(status: string) {
  switch (status) {
    case "compliant":
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "partial":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case "not_implemented":
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return <Info className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "compliant":
      return "Compliant";
    case "partial":
      return "Partial";
    case "not_implemented":
      return "Not Implemented";
    default:
      return "N/A";
  }
}

function StatusBadgeLocal({ status }: { status: string }) {
  const variant =
    status === "compliant"
      ? "default"
      : status === "partial"
        ? "secondary"
        : "destructive";
  return (
    <Badge variant={variant} data-testid={`badge-status-${status}`}>
      {statusIcon(status)}
      <span className="ml-1">{statusLabel(status)}</span>
    </Badge>
  );
}

function DataClassCard({
  dc,
  expanded,
  onToggle,
}: {
  dc: USCDIv3DataClass;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card data-testid={`card-data-class-${dc.dataClass}`}>
      <CardHeader
        className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2 cursor-pointer"
        onClick={onToggle}
        data-testid={`button-toggle-${dc.dataClass}`}
      >
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <CardTitle className="text-sm font-medium">{dc.label}</CardTitle>
          {dc.newInV3 && (
            <Badge variant="outline" data-testid={`badge-new-v3-${dc.dataClass}`}>
              <Star className="h-3 w-3 mr-1" />
              New in v3
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">
            {dc.elements.length} elements
          </span>
          <StatusBadgeLocal status={dc.complianceStatus} />
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">{dc.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                FHIR Resource
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded-md">
                {dc.fhirResourceType}
              </code>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                US Core Profile
              </p>
              <code className="text-xs bg-muted px-2 py-1 rounded-md break-all">
                {dc.fhirProfile.split("/").pop()}
              </code>
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Data Elements
            </p>
            <div className="space-y-1">
              {dc.elements.map((el) => (
                <div
                  key={el.name}
                  className="flex items-center justify-between gap-2 text-xs py-1 border-b border-border/50 last:border-0"
                  data-testid={`element-${dc.dataClass}-${el.name.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium">{el.name}</span>
                    {el.required && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        Required
                      </Badge>
                    )}
                    {el.newInV3 && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        <Star className="h-2 w-2 mr-0.5" />
                        v3
                      </Badge>
                    )}
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-info-${el.name.replace(/\s+/g, "-").toLowerCase()}`}>
                        <Info className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <p className="text-xs">{el.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        FHIR Path: {el.fhirPath}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Terminology
            </p>
            <div className="flex flex-wrap gap-1">
              {dc.terminology.map((t) => (
                <Badge key={t} variant="secondary" className="text-[10px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Implementation Notes
            </p>
            <p className="text-xs">{dc.implementationNotes}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function GapAnalysisCard({ gap }: { gap: USCDIv3GapItem }) {
  const effortColor =
    gap.effort === "low"
      ? "text-green-600 dark:text-green-400"
      : gap.effort === "medium"
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  const priorityColor =
    gap.priority === "critical"
      ? "text-red-600 dark:text-red-400"
      : gap.priority === "high"
        ? "text-orange-600 dark:text-orange-400"
        : gap.priority === "medium"
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-muted-foreground";

  return (
    <Card data-testid={`card-gap-${gap.dataClass}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm font-medium">{gap.label}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <span className={effortColor}>Effort: {gap.effort}</span>
            </Badge>
            <Badge variant="outline">
              <span className={priorityColor}>Priority: {gap.priority}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {gap.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Recommendations
            </p>
            <ul className="space-y-1">
              {gap.recommendations.map((rec, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function USCDIv3CompliancePage() {
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: compliance, isLoading } = useQuery<ComplianceSummary>({
    queryKey: ["/api/infrastructure/uscdi-v3/compliance"],
  });

  const { data: gapData } = useQuery<{ success: boolean; gaps: USCDIv3GapItem[]; totalGaps: number }>({
    queryKey: ["/api/infrastructure/uscdi-v3/gap-analysis"],
  });

  const toggleExpand = (dataClass: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(dataClass)) {
        next.delete(dataClass);
      } else {
        next.add(dataClass);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (compliance?.dataClasses) {
      setExpandedClasses(new Set(compliance.dataClasses.map((dc) => dc.dataClass)));
    }
  };

  const collapseAll = () => {
    setExpandedClasses(new Set());
  };

  if (isLoading) {
    return <LoadingState message="Loading USCDI v3 compliance data..." />;
  }

  if (!compliance) {
    return (
      <div className="p-6" data-testid="text-error-state">
        <PageHeader
          title="USCDI v3 Compliance"
          subtitle="Failed to load compliance data"
          icon={<Shield className="h-6 w-6 text-foreground" />}
        />
      </div>
    );
  }

  const filteredClasses = compliance.dataClasses.filter((dc) => {
    const matchesSearch =
      !searchTerm ||
      dc.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.dataClass.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dc.elements.some((e) =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesFilter =
      filterStatus === "all" || dc.complianceStatus === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const stats: StatCardItem[] = [
    {
      label: "Overall Score",
      value: `${compliance.overallScore}%`,
      icon: Shield,
      description: `${compliance.compliantClasses} of ${compliance.totalDataClasses} classes compliant`,
    },
    {
      label: "Data Classes",
      value: compliance.totalDataClasses,
      icon: Layers,
      description: `${compliance.totalElements} total data elements`,
    },
    {
      label: "Compliant",
      value: compliance.compliantClasses,
      icon: CheckCircle,
      description: "Fully implemented classes",
    },
    {
      label: "Gaps",
      value: compliance.partialClasses + compliance.notImplementedClasses,
      icon: AlertTriangle,
      description: `${compliance.partialClasses} partial, ${compliance.notImplementedClasses} missing`,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto" data-testid="page-uscdi-v3-compliance">
      <PageHeader
        title="USCDI v3 Compliance"
        subtitle={`Mandatory as of ${compliance.mandatoryDate} per ${compliance.regulatoryBasis}`}
        icon={<Shield className="h-6 w-6 text-foreground" />}
      />

      <Card data-testid="card-regulatory-notice">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">
                USCDI Version 3 - ONC HTI-1 Final Rule Compliance
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                As of January 1, 2026, USCDI v3 is the mandatory standard for all
                certified EHR systems. It introduces 2 new data classes (Health
                Insurance Information, Health Status Assessments) and 24 new data
                elements focused on health equity, social determinants of health,
                and comprehensive patient information.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <StatCardGrid stats={stats} columns={4} />

      <div className="flex items-center gap-2">
        <Progress
          value={compliance.overallScore}
          className="flex-1"
          data-testid="progress-compliance-score"
        />
        <span className="text-sm font-medium whitespace-nowrap">
          {compliance.overallScore}% Compliant
        </span>
      </div>

      <Tabs defaultValue="data-classes" data-testid="tabs-uscdi-v3">
        <TabsList>
          <TabsTrigger value="data-classes" data-testid="tab-data-classes">
            <Layers className="h-4 w-4 mr-1" />
            Data Classes ({compliance.totalDataClasses})
          </TabsTrigger>
          <TabsTrigger value="new-in-v3" data-testid="tab-new-in-v3">
            <Star className="h-4 w-4 mr-1" />
            New in v3
          </TabsTrigger>
          <TabsTrigger value="gap-analysis" data-testid="tab-gap-analysis">
            <BarChart3 className="h-4 w-4 mr-1" />
            Gap Analysis ({gapData?.totalGaps ?? 0})
          </TabsTrigger>
          <TabsTrigger value="regulatory" data-testid="tab-regulatory">
            <FileText className="h-4 w-4 mr-1" />
            Regulatory Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="data-classes" className="space-y-4 mt-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search data classes or elements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-data-classes"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={filterStatus === "all" ? "default" : "outline"}
                onClick={() => setFilterStatus("all")}
                data-testid="button-filter-all"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filterStatus === "compliant" ? "default" : "outline"}
                onClick={() => setFilterStatus("compliant")}
                data-testid="button-filter-compliant"
              >
                Compliant
              </Button>
              <Button
                size="sm"
                variant={filterStatus === "partial" ? "default" : "outline"}
                onClick={() => setFilterStatus("partial")}
                data-testid="button-filter-partial"
              >
                Partial
              </Button>
              <Button
                size="sm"
                variant={filterStatus === "not_implemented" ? "default" : "outline"}
                onClick={() => setFilterStatus("not_implemented")}
                data-testid="button-filter-not-implemented"
              >
                Missing
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={expandAll}
                data-testid="button-expand-all"
              >
                Expand All
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={collapseAll}
                data-testid="button-collapse-all"
              >
                Collapse All
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredClasses.map((dc) => (
              <DataClassCard
                key={dc.dataClass}
                dc={dc}
                expanded={expandedClasses.has(dc.dataClass)}
                onToggle={() => toggleExpand(dc.dataClass)}
              />
            ))}
            {filteredClasses.length === 0 && (
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No data classes match your search criteria.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="new-in-v3" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Data Classes in USCDI v3</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {compliance.newInV3Summary.newDataClasses.map((cls) => (
                <div
                  key={cls}
                  className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                  data-testid={`text-new-class-${cls.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cls}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                New Data Elements in USCDI v3 ({compliance.newInV3Summary.newElements.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {compliance.newInV3Summary.newElements.map((el, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-sm py-1.5 border-b border-border/50 last:border-0"
                    data-testid={`text-new-element-${i}`}
                  >
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{el.element}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {el.dataClass}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why USCDI v3 Matters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Shield className="h-4 w-4 text-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Mandatory Compliance</p>
                    <p className="text-xs text-muted-foreground">
                      ONC HTI-1 Final Rule established January 1, 2026 as the hard
                      deadline. Systems using v1 or v2 are no longer compliant.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Health Equity & SDOH</p>
                    <p className="text-xs text-muted-foreground">
                      Emphasis on data elements that identify healthcare
                      disparities: disability status, tribal affiliation, and
                      comprehensive health status assessments.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Insurance Interoperability</p>
                    <p className="text-xs text-muted-foreground">
                      New Health Insurance Information class enables streamlined
                      billing and insurance verification across systems.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">
                      Comprehensive Health Status
                    </p>
                    <p className="text-xs text-muted-foreground">
                      New Health Status class captures disability, functional,
                      cognitive, and pregnancy status for a complete picture of
                      patient well-being.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gap-analysis" className="space-y-4 mt-4">
          {gapData?.gaps && gapData.gaps.length > 0 ? (
            <>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">
                    {gapData.totalGaps} data class{gapData.totalGaps !== 1 ? "es" : ""}{" "}
                    require attention to achieve full USCDI v3 compliance.
                  </p>
                </CardContent>
              </Card>
              {gapData.gaps.map((gap) => (
                <GapAnalysisCard key={gap.dataClass} gap={gap} />
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 justify-center py-8">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <p className="text-sm font-medium" data-testid="text-no-gaps">
                    No critical gaps found. All data classes are compliant or
                    partially implemented.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="regulatory" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Regulatory Framework</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Standard Version
                  </p>
                  <p className="text-sm">USCDI Version 3.0</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Mandatory Date
                  </p>
                  <p className="text-sm">January 1, 2026</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Regulatory Basis
                  </p>
                  <p className="text-sm">ONC HTI-1 Final Rule</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Issuing Authority
                  </p>
                  <p className="text-sm">
                    Office of the National Coordinator for Health IT (ONC)
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Supersedes
                  </p>
                  <p className="text-sm">USCDI v1, USCDI v2</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Last Assessment
                  </p>
                  <p className="text-sm">
                    {new Date(compliance.lastAssessed).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                FHIR Profiles & Terminology Standards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">HL7 FHIR R4</p>
                    <p className="text-xs text-muted-foreground">
                      Base interoperability standard for all USCDI data exchange
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">US Core Implementation Guide 6.1</p>
                    <p className="text-xs text-muted-foreground">
                      US Core profiles aligned with USCDI v3 requirements
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Required Terminology Systems
                </p>
                <div className="flex flex-wrap gap-1">
                  {[
                    "LOINC",
                    "SNOMED CT",
                    "RxNorm",
                    "ICD-10-CM",
                    "CPT",
                    "CVX",
                    "UCUM",
                    "NDC",
                    "NDF-RT",
                    "HCPCS",
                    "NUCC",
                    "OMB Race/Ethnicity",
                  ].map((term) => (
                    <Badge key={term} variant="secondary" className="text-[10px]">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Compliance Attestation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 rounded-md p-4 space-y-2">
                <p className="text-sm">
                  Tabula Medica supports {compliance.compliantClasses} of{" "}
                  {compliance.totalDataClasses} USCDI v3 data classes at full
                  compliance, with {compliance.partialClasses} additional classes at
                  partial implementation. The system achieves an overall compliance
                  score of {compliance.overallScore}%.
                </p>
                <p className="text-xs text-muted-foreground">
                  This assessment is based on system capability analysis and does not
                  constitute ONC certification. Formal USCDI v3 certification
                  requires testing through an ONC-Authorized Testing Lab (ONC-ATL).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
