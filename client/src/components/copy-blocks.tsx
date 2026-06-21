import { Info, GitBranch, SearchX } from "lucide-react";

interface CopyBlockProps {
  className?: string;
}

interface NoRecordProps extends CopyBlockProps {
  recordType: string;
}

export function DisclaimerBlock({ className = "" }: CopyBlockProps) {
  return (
    <div 
      className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
      data-testid="text-disclaimer"
    >
      <Info className="h-3 w-3 flex-shrink-0" />
      <span>Informational only. Not medical advice.</span>
    </div>
  );
}

export function ProvenanceBlock({ className = "" }: CopyBlockProps) {
  return (
    <div 
      className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}
      data-testid="text-provenance"
    >
      <GitBranch className="h-3 w-3 flex-shrink-0" />
      <span>
        This record was created from multiple sources.{" "}
        <button 
          className="underline underline-offset-2"
          data-testid="link-view-provenance"
        >
          View provenance.
        </button>
      </span>
    </div>
  );
}

export function NoRecordBlock({ recordType, className = "" }: NoRecordProps) {
  return (
    <div 
      className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}
      data-testid="text-no-record"
    >
      <SearchX className="h-4 w-4 flex-shrink-0" />
      <span>We didn't find a record of {recordType}.</span>
    </div>
  );
}

export const COPY_BLOCKS = {
  DISCLAIMER: "Informational only. Not medical advice.",
  PROVENANCE: "This record was created from multiple sources. View provenance.",
  NO_RECORD: (recordType: string) => `We didn't find a record of ${recordType}.`,
} as const;
