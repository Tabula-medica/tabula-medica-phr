import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export interface AutocompleteSuggestion {
  label: string;
  code?: string;
  system?: string;
  category?: string;
  confidence: number;
}

export type AutocompleteDomain = "conditions" | "medications" | "allergies" | "procedures" | "icd_codes";

interface MedicalAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: AutocompleteSuggestion) => void;
  domain: AutocompleteDomain;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  patientContext?: { conditions?: string[]; medications?: string[]; allergies?: string[] };
  "data-testid"?: string;
}

export function MedicalAutocomplete({
  value,
  onChange,
  onSelect,
  domain,
  placeholder,
  disabled,
  className,
  patientContext,
  "data-testid": testId,
}: MedicalAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/medical/autocomplete", {
        query,
        domain,
        patientContext,
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowDropdown(true);
      setSelectedIndex(-1);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [domain, patientContext]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  const handleSelect = (suggestion: AutocompleteSuggestion) => {
    onChange(suggestion.label);
    onSelect?.(suggestion);
    setShowDropdown(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          autoComplete="off"
          data-testid={testId}
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
        )}
        {!isLoading && value.length >= 2 && (
          <Sparkles className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground opacity-50" />
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
          data-testid={testId ? `${testId}-suggestions` : "autocomplete-suggestions"}
        >
          <div className="px-2 py-1.5 border-b">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI-powered suggestions
            </span>
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.label}-${index}`}
                className={`w-full text-left px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                }`}
                onClick={() => handleSelect(suggestion)}
                data-testid={testId ? `${testId}-option-${index}` : `autocomplete-option-${index}`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="truncate font-medium">{suggestion.label}</span>
                  {(suggestion.code || suggestion.category) && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {suggestion.code && <span>{suggestion.code}</span>}
                      {suggestion.code && suggestion.category && <span> · </span>}
                      {suggestion.category && <span>{suggestion.category}</span>}
                    </span>
                  )}
                </div>
                {suggestion.confidence >= 0.9 && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    Best match
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export interface ValidationIssue {
  field: string;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion?: string;
}

interface ValidationAlertProps {
  issues: ValidationIssue[];
  fieldName?: string;
}

export function ValidationAlert({ issues, fieldName }: ValidationAlertProps) {
  const filtered = fieldName ? issues.filter(i => i.field === fieldName) : issues;
  if (filtered.length === 0) return null;

  return (
    <div className="space-y-1 mt-1">
      {filtered.map((issue, i) => (
        <div
          key={i}
          className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs ${
            issue.severity === "error"
              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              : issue.severity === "warning"
              ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400"
              : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
          }`}
          data-testid={`validation-issue-${issue.severity}-${i}`}
        >
          {issue.severity === "error" ? (
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          ) : issue.severity === "warning" ? (
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          ) : (
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p>{issue.message}</p>
            {issue.suggestion && (
              <p className="mt-0.5 opacity-80">{issue.suggestion}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function useAIValidation() {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const validate = useCallback(async (
    domain: string,
    fields: Record<string, any>,
    patientContext?: Record<string, any>
  ): Promise<ValidationIssue[]> => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasValues = Object.values(fields).some(v => v && String(v).length > 0);
    if (!hasValues) {
      setIssues([]);
      return [];
    }

    setIsValidating(true);
    try {
      const res = await apiRequest("POST", "/api/medical/validate", {
        domain,
        fields,
        patientContext,
      });
      const data = await res.json();
      const newIssues = data.issues || [];
      setIssues(newIssues);
      return newIssues;
    } catch {
      setIssues([]);
      return [];
    } finally {
      setIsValidating(false);
    }
  }, []);

  const validateDebounced = useCallback((
    domain: string,
    fields: Record<string, any>,
    patientContext?: Record<string, any>
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      validate(domain, fields, patientContext);
    }, 500);
  }, [validate]);

  const clearIssues = useCallback(() => setIssues([]), []);

  const getFieldIssues = useCallback((fieldName: string) => {
    return issues.filter(i => i.field === fieldName);
  }, [issues]);

  const hasErrors = issues.some(i => i.severity === "error");
  const hasWarnings = issues.some(i => i.severity === "warning");

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    issues,
    isValidating,
    validate,
    validateDebounced,
    clearIssues,
    getFieldIssues,
    hasErrors,
    hasWarnings,
  };
}
