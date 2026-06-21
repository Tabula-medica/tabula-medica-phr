import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle } from "lucide-react";

export interface PatientNameData {
  nameFirst: string;
  nameMiddle: string;
  nameLast: string;
}

interface PatientNameFormProps {
  value: PatientNameData;
  onChange: (data: PatientNameData) => void;
  disabled?: boolean;
}

export function PatientNameForm({ value, onChange, disabled }: PatientNameFormProps) {
  const [nmnAssigned, setNmnAssigned] = useState(false);

  const handleMiddleBlur = useCallback(() => {
    if (!value.nameMiddle.trim()) {
      onChange({ ...value, nameMiddle: "NMN" });
      setNmnAssigned(true);
    } else if (value.nameMiddle.trim().toUpperCase() === "NMN") {
      setNmnAssigned(true);
    } else {
      setNmnAssigned(false);
    }
  }, [value, onChange]);

  const displayPreview = value.nameFirst && value.nameLast
    ? `${value.nameFirst.trim().toUpperCase()} ${(value.nameMiddle.trim() || "NMN").toUpperCase()} ${value.nameLast.trim().toUpperCase()}`
    : null;

  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="text-sm font-semibold text-muted-foreground mb-3">
        Legal Name (as on your government-issued ID)
      </legend>

      <div className="space-y-2">
        <Label htmlFor="nameFirst">
          First name <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id="nameFirst"
          data-testid="input-name-first"
          type="text"
          required
          aria-required="true"
          autoComplete="given-name"
          placeholder="Enter first name"
          value={value.nameFirst}
          onChange={(e) => onChange({ ...value, nameFirst: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nameMiddle">
          Middle name{" "}
          <span className="text-muted-foreground text-xs">(leave blank if none)</span>
        </Label>
        <Input
          id="nameMiddle"
          data-testid="input-name-middle"
          type="text"
          autoComplete="additional-name"
          placeholder="Enter middle name or leave blank"
          value={value.nameMiddle}
          aria-describedby="middle-hint"
          onChange={(e) => {
            onChange({ ...value, nameMiddle: e.target.value });
            setNmnAssigned(false);
          }}
          onBlur={handleMiddleBlur}
        />
        <div id="middle-hint" className="text-xs text-muted-foreground" role="note">
          {nmnAssigned ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              NMN (No Middle Name) has been assigned to your record.
            </span>
          ) : (
            "If you have no middle name, leave this blank — we will assign NMN."
          )}
        </div>
        {nmnAssigned && (
          <div role="status" aria-live="polite" className="sr-only">
            NMN assigned. Your record will show: {value.nameFirst} NMN {value.nameLast}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="nameLast">
          Last name <span className="text-destructive" aria-hidden="true">*</span>
        </Label>
        <Input
          id="nameLast"
          data-testid="input-name-last"
          type="text"
          required
          aria-required="true"
          autoComplete="family-name"
          placeholder="Enter last name"
          value={value.nameLast}
          onChange={(e) => onChange({ ...value, nameLast: e.target.value })}
        />
      </div>

      {displayPreview && (
        <div className="rounded-lg bg-muted/50 border p-3 mt-3" data-testid="display-name-preview">
          <div className="text-xs text-muted-foreground mb-1">Record will display as:</div>
          <div className="font-mono text-sm font-semibold">{displayPreview}</div>
          {nmnAssigned && (
            <Badge variant="secondary" className="mt-2 text-xs">
              <AlertCircle className="h-3 w-3 mr-1" />
              NMN — No Middle Name
            </Badge>
          )}
        </div>
      )}
    </fieldset>
  );
}
