import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "@/components/shared/format-helpers";
import {
  Building2,
  Upload,
  Edit3,
  Calendar,
  Clock,
  FileCode,
  ExternalLink,
  Shield,
  CheckCircle,
  AlertCircle,
  Info,
} from "lucide-react";

export type RecordSource = "fhir" | "patient_upload" | "manual" | "ehr_import" | "lab_direct" | "pharmacy";

export interface ProvenanceInfo {
  source: RecordSource;
  sourceOrganization?: string;
  sourceSystem?: string;
  dateCreated: string;
  dateImported: string;
  recordType: string;
  coding?: {
    system: string;
    code: string;
    display?: string;
  }[];
  fhirResourceType?: string;
  fhirResourceId?: string;
  rawData?: Record<string, unknown>;
  verificationStatus?: "verified" | "unverified" | "pending";
  lastUpdated?: string;
}

interface ProvenanceRecordCardProps {
  title: string;
  subtitle?: string;
  provenance: ProvenanceInfo;
  children?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const sourceConfig: Record<RecordSource, { label: string; icon: typeof Building2; color: string }> = {
  fhir: { label: "FHIR", icon: Building2, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  patient_upload: { label: "Patient Upload", icon: Upload, color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  manual: { label: "Manual Entry", icon: Edit3, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  ehr_import: { label: "EHR Import", icon: Building2, color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  lab_direct: { label: "Lab Direct", icon: FileCode, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  pharmacy: { label: "Pharmacy", icon: Building2, color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" },
};

const codingSystemLabels: Record<string, string> = {
  "http://loinc.org": "LOINC",
  "http://snomed.info/sct": "SNOMED CT",
  "http://hl7.org/fhir/sid/icd-10": "ICD-10",
  "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
  "http://www.ama-assn.org/go/cpt": "CPT",
  "http://hl7.org/fhir/sid/ndc": "NDC",
};

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RawDataViewer({ data, title }: { data: Record<string, unknown>; title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatJson = (obj: Record<string, unknown>) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="button-view-original">
          <ExternalLink className="h-3 w-3" />
          View original
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Original Record: {title}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap break-words">
            {formatJson(data)}
          </pre>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function CodingBadges({ coding }: { coding: ProvenanceInfo["coding"] }) {
  if (!coding || coding.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {coding.slice(0, 3).map((code, idx) => {
        const systemLabel = codingSystemLabels[code.system] || code.system.split("/").pop();
        return (
          <Badge
            key={idx}
            variant="outline"
            className="text-xs font-mono"
            title={`${code.system}: ${code.code}${code.display ? ` - ${code.display}` : ""}`}
          >
            {systemLabel}: {code.code}
          </Badge>
        );
      })}
      {coding.length > 3 && (
        <Badge variant="outline" className="text-xs">
          +{coding.length - 3} more
        </Badge>
      )}
    </div>
  );
}

function VerificationBadge({ status }: { status?: "verified" | "unverified" | "pending" }) {
  if (!status) return null;

  const config = {
    verified: { icon: CheckCircle, label: "Verified", className: "text-green-600" },
    unverified: { icon: AlertCircle, label: "Unverified", className: "text-amber-600" },
    pending: { icon: Info, label: "Pending", className: "text-blue-600" },
  };

  const { icon: Icon, label, className } = config[status];

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`} title={`Verification: ${label}`}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </div>
  );
}

export function ProvenanceRecordCard({
  title,
  subtitle,
  provenance,
  children,
  className = "",
  compact = false,
}: ProvenanceRecordCardProps) {
  const sourceInfo = sourceConfig[provenance.source] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;

  if (compact) {
    return (
      <Card className={`${className}`} data-testid="card-provenance-record">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold truncate">{title}</h3>
                <VerificationBadge status={provenance.verificationStatus} />
              </div>
              {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge className={`text-xs ${sourceInfo.color}`}>
                  <SourceIcon className="h-3 w-3 mr-1" />
                  {sourceInfo.label}
                  {provenance.sourceOrganization && `: ${provenance.sourceOrganization}`}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(provenance.dateCreated)}
                </span>
              </div>
            </div>
            {provenance.rawData && (
              <RawDataViewer data={provenance.rawData} title={title} />
            )}
          </div>
          {children}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} data-testid="card-provenance-record">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{title}</CardTitle>
              <VerificationBadge status={provenance.verificationStatus} />
            </div>
            {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <Badge className={`shrink-0 ${sourceInfo.color}`}>
            <SourceIcon className="h-3 w-3 mr-1" />
            {sourceInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>Source</span>
            </div>
            <p className="text-sm font-medium">
              {provenance.sourceOrganization || sourceInfo.label}
              {provenance.sourceSystem && (
                <span className="text-muted-foreground font-normal"> via {provenance.sourceSystem}</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Record Type</span>
            </div>
            <p className="text-sm font-medium">
              {provenance.recordType}
              {provenance.fhirResourceType && (
                <span className="text-muted-foreground font-normal"> (FHIR {provenance.fhirResourceType})</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Date Created</span>
            </div>
            <p className="text-sm font-medium">{formatDateTime(provenance.dateCreated)}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Date Imported</span>
            </div>
            <p className="text-sm font-medium">{formatDateTime(provenance.dateImported)}</p>
          </div>
        </div>

        {provenance.coding && provenance.coding.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileCode className="h-3 w-3" />
              <span>Medical Coding</span>
            </div>
            <CodingBadges coding={provenance.coding} />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {provenance.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last updated: {formatDateTime(provenance.lastUpdated)}
            </span>
          )}
          {provenance.rawData && (
            <RawDataViewer data={provenance.rawData} title={title} />
          )}
        </div>

        {children}
      </CardContent>
    </Card>
  );
}

export function ProvenanceStrip({ provenance }: { provenance: ProvenanceInfo }) {
  const sourceInfo = sourceConfig[provenance.source] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 bg-muted/30 rounded-md text-xs"
      data-testid="strip-provenance"
    >
      <Badge className={`${sourceInfo.color}`}>
        <SourceIcon className="h-3 w-3 mr-1" />
        {sourceInfo.label}
      </Badge>
      {provenance.sourceOrganization && (
        <span className="text-muted-foreground">{provenance.sourceOrganization}</span>
      )}
      <span className="text-muted-foreground">|</span>
      <span className="flex items-center gap-1">
        <Calendar className="h-3 w-3" />
        Created: {formatDate(provenance.dateCreated)}
      </span>
      <span className="text-muted-foreground">|</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Imported: {formatDate(provenance.dateImported)}
      </span>
      {provenance.coding && provenance.coding.length > 0 && (
        <>
          <span className="text-muted-foreground">|</span>
          <CodingBadges coding={provenance.coding} />
        </>
      )}
      <VerificationBadge status={provenance.verificationStatus} />
      {provenance.rawData && (
        <RawDataViewer data={provenance.rawData} title={provenance.recordType} />
      )}
    </div>
  );
}

export default ProvenanceRecordCard;
