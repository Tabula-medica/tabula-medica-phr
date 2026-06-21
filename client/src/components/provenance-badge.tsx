import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Database,
  Upload,
  Edit3,
  RefreshCw,
  Link,
  Building2,
  CheckCircle,
  AlertCircle,
  Clock,
  FileCode,
} from "lucide-react";
import { format, parseISO } from "date-fns";

export type DataSource = 
  | "fhir" 
  | "patient_upload" 
  | "manual" 
  | "ehr_sync" 
  | "api_import" 
  | "clinical_entry"
  | "unknown";

export type VerificationStatus = "verified" | "unverified" | "pending";

export interface ProvenanceInfo {
  source: DataSource;
  sourceName?: string;
  dateCreated: string;
  dateImported?: string;
  verificationStatus?: VerificationStatus;
  coding?: {
    system: string;
    code: string;
    display?: string;
  }[];
  facilityName?: string;
}

const sourceConfig: Record<DataSource, { icon: typeof Database; label: string; color: string }> = {
  fhir: { icon: Database, label: "FHIR", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  patient_upload: { icon: Upload, label: "Patient Upload", color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30" },
  manual: { icon: Edit3, label: "Manual Entry", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" },
  ehr_sync: { icon: RefreshCw, label: "EHR Sync", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30" },
  api_import: { icon: Link, label: "API Import", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  clinical_entry: { icon: Building2, label: "Clinical Entry", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" },
  unknown: { icon: AlertCircle, label: "Unknown", color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/30" },
};

const verificationConfig: Record<VerificationStatus, { icon: typeof CheckCircle; label: string; color: string }> = {
  verified: { icon: CheckCircle, label: "Verified", color: "text-green-600 dark:text-green-400" },
  unverified: { icon: AlertCircle, label: "Unverified", color: "text-amber-600 dark:text-amber-400" },
  pending: { icon: Clock, label: "Pending", color: "text-blue-600 dark:text-blue-400" },
};

const codingSystemLabels: Record<string, string> = {
  "http://loinc.org": "LOINC",
  "http://snomed.info/sct": "SNOMED",
  "http://hl7.org/fhir/sid/icd-10": "ICD-10",
  "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
  "http://hl7.org/fhir/sid/cvx": "CVX",
  "http://hl7.org/fhir/sid/ndc": "NDC",
};

function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), "MMM d, yyyy");
  } catch {
    return dateString;
  }
}

function getCodingSystemLabel(system: string): string {
  return codingSystemLabels[system] || system.split("/").pop() || "Code";
}

interface ProvenanceBadgeProps {
  provenance: ProvenanceInfo;
  variant?: "compact" | "full" | "minimal";
  showCoding?: boolean;
  showVerification?: boolean;
  className?: string;
}

export function ProvenanceBadge({ 
  provenance, 
  variant = "compact",
  showCoding = true,
  showVerification = true,
  className = ""
}: ProvenanceBadgeProps) {
  const config = sourceConfig[provenance.source] || sourceConfig.unknown;
  const SourceIcon = config.icon;
  const verificationStatus = provenance.verificationStatus || "unverified";
  const verificationInfo = verificationConfig[verificationStatus];
  const VerificationIcon = verificationInfo.icon;

  if (variant === "minimal") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={`h-5 px-1.5 text-[10px] font-normal gap-1 cursor-help ${config.color} ${className}`}
            data-testid="provenance-badge-minimal"
          >
            <SourceIcon className="h-3 w-3" />
            <span>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-xs space-y-1">
            <p><strong>Source:</strong> {provenance.sourceName || config.label}</p>
            <p><strong>Created:</strong> {formatDate(provenance.dateCreated)}</p>
            {provenance.dateImported && (
              <p><strong>Imported:</strong> {formatDate(provenance.dateImported)}</p>
            )}
            {provenance.facilityName && (
              <p><strong>Facility:</strong> {provenance.facilityName}</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="provenance-badge-compact">
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={`h-5 px-1.5 text-[10px] font-normal gap-1 cursor-help ${config.color}`}
            >
              <SourceIcon className="h-3 w-3" />
              <span>{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p><strong>Source:</strong> {provenance.sourceName || config.label}</p>
              <p><strong>Created:</strong> {formatDate(provenance.dateCreated)}</p>
              {provenance.dateImported && (
                <p><strong>Imported:</strong> {formatDate(provenance.dateImported)}</p>
              )}
              {provenance.facilityName && (
                <p><strong>Facility:</strong> {provenance.facilityName}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {showVerification && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`cursor-help ${verificationInfo.color}`}>
                <VerificationIcon className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <span className="text-xs">{verificationInfo.label}</span>
            </TooltipContent>
          </Tooltip>
        )}

        {showCoding && provenance.coding && provenance.coding.length > 0 && (
          <>
            {provenance.coding.slice(0, 2).map((code, index) => (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className="h-5 px-1.5 text-[10px] font-mono bg-muted/50 cursor-help"
                  >
                    <FileCode className="h-2.5 w-2.5 mr-0.5" />
                    {getCodingSystemLabel(code.system)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs">
                    <p className="font-medium">{getCodingSystemLabel(code.system)}</p>
                    <p className="font-mono">{code.code}</p>
                    {code.display && <p className="text-muted-foreground">{code.display}</p>}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
            {provenance.coding.length > 2 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-muted/50">
                +{provenance.coding.length - 2}
              </Badge>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-2 text-xs ${className}`} data-testid="provenance-badge-full">
      <div className="flex flex-wrap items-center gap-2">
        <Badge 
          variant="outline" 
          className={`px-2 py-0.5 gap-1.5 ${config.color}`}
        >
          <SourceIcon className="h-3 w-3" />
          <span>{provenance.sourceName || config.label}</span>
        </Badge>

        {showVerification && (
          <Badge 
            variant="outline" 
            className={`px-2 py-0.5 gap-1.5 ${verificationInfo.color.replace("text-", "bg-").replace("600", "500/10")} ${verificationInfo.color}`}
          >
            <VerificationIcon className="h-3 w-3" />
            <span>{verificationInfo.label}</span>
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        <span>Created: {formatDate(provenance.dateCreated)}</span>
        {provenance.dateImported && (
          <span>Imported: {formatDate(provenance.dateImported)}</span>
        )}
        {provenance.facilityName && (
          <span>From: {provenance.facilityName}</span>
        )}
      </div>

      {showCoding && provenance.coding && provenance.coding.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {provenance.coding.map((code, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="px-2 py-0.5 text-[10px] font-mono bg-muted/50 cursor-help"
                >
                  <FileCode className="h-2.5 w-2.5 mr-1" />
                  {getCodingSystemLabel(code.system)}: {code.code}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">
                {code.display && <p className="text-xs">{code.display}</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}

export function generateMockProvenance(options?: {
  source?: DataSource;
  verified?: boolean;
  hasCoding?: boolean;
}): ProvenanceInfo {
  const sources: DataSource[] = ["fhir", "ehr_sync", "patient_upload", "clinical_entry", "api_import"];
  const facilityNames = ["City General Hospital", "Metro Health Clinic", "Regional Medical Center", "Family Practice Associates"];
  
  const source = options?.source || sources[Math.floor(Math.random() * sources.length)];
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 365);
  const createdDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const importedDate = new Date(createdDate.getTime() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);

  const provenance: ProvenanceInfo = {
    source,
    sourceName: source === "ehr_sync" ? "EHR Sync" : source === "fhir" ? "Fasten Health" : undefined,
    dateCreated: createdDate.toISOString(),
    dateImported: importedDate.toISOString(),
    verificationStatus: options?.verified ? "verified" : Math.random() > 0.3 ? "verified" : "unverified",
    facilityName: facilityNames[Math.floor(Math.random() * facilityNames.length)],
  };

  if (options?.hasCoding !== false && Math.random() > 0.2) {
    const codingSystems = [
      { system: "http://loinc.org", code: "2093-3", display: "Total Cholesterol" },
      { system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" },
      { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Metformin 500mg" },
      { system: "http://hl7.org/fhir/sid/icd-10", code: "E11.9", display: "Type 2 diabetes mellitus" },
    ];
    provenance.coding = [codingSystems[Math.floor(Math.random() * codingSystems.length)]];
  }

  return provenance;
}
