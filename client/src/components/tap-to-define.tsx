import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Volume2,
  Tag,
  Target,
  Sparkles,
} from "lucide-react";

interface GlossaryTerm {
  term: string;
  aliases: string[];
  definition: string;
  normalRange?: string;
  context: string;
  synonyms: string[];
  category: "lab" | "condition" | "procedure" | "medication" | "anatomy" | "abbreviation";
  pronunciation?: string;
}

function useGlossaryTerms() {
  const { data } = useQuery<{ terms: string[] }>({
    queryKey: ["/api/glossary/terms"],
    staleTime: 1000 * 60 * 60,
  });
  return data?.terms || [];
}

const categoryConfig: Record<GlossaryTerm["category"], { color: string; label: string }> = {
  lab: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300", label: "Lab Test" },
  condition: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Condition" },
  procedure: { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", label: "Procedure" },
  medication: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", label: "Medication" },
  anatomy: { color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", label: "Anatomy" },
  abbreviation: { color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", label: "Abbreviation" },
};

interface TermPopoverProps {
  term: string;
  children: React.ReactNode;
}

function TermPopover({ term, children }: TermPopoverProps) {
  const [open, setOpen] = useState(false);
  const [termData, setTermData] = useState<GlossaryTerm | null>(null);

  const lookupMutation = useMutation({
    mutationFn: async (searchTerm: string) => {
      const response = await apiRequest("POST", "/api/glossary/lookup", { term: searchTerm });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.term) {
        setTermData(data);
      }
    },
  });

  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !termData && !lookupMutation.isPending) {
      lookupMutation.mutate(term);
    }
  }, [term, termData, lookupMutation]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <span
          className="cursor-pointer border-b border-dashed border-primary/50 text-primary hover:border-primary hover:bg-primary/5 transition-colors rounded-sm px-0.5"
          data-testid={`term-${term.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {lookupMutation.isPending ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : termData ? (
          <div className="space-y-0">
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-base">{termData.term}</h4>
                  {termData.pronunciation && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Volume2 className="h-3 w-3" />
                      {termData.pronunciation}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className={`text-xs ${categoryConfig[termData.category].color}`}>
                  {categoryConfig[termData.category].label}
                </Badge>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <BookOpen className="h-3 w-3" />
                  Definition
                </div>
                <p className="text-sm">{termData.definition}</p>
              </div>

              {termData.normalRange && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <Target className="h-3 w-3" />
                    Normal Range
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">{termData.normalRange}</p>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                  <Sparkles className="h-3 w-3" />
                  Context
                </div>
                <p className="text-sm text-muted-foreground">{termData.context}</p>
              </div>

              {termData.synonyms.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <Tag className="h-3 w-3" />
                    Also Known As
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {termData.synonyms.map((syn, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {syn}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">No definition found for "{term}"</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

interface MedicalTextProps {
  children: string;
  className?: string;
}

export function MedicalText({ children, className = "" }: MedicalTextProps) {
  const glossaryTerms = useGlossaryTerms();
  
  const segments = useMemo(() => {
    const text = children;
    const result: Array<{ type: "text" | "term"; content: string; key: string }> = [];
    
    if (glossaryTerms.length === 0) {
      return [{ type: "text" as const, content: text, key: "text-0" }];
    }
    
    const sortedPatterns = [...glossaryTerms].sort((a, b) => b.length - a.length);
    const pattern = new RegExp(
      `\\b(${sortedPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
      "gi"
    );
    
    let lastIndex = 0;
    let match;
    let keyCounter = 0;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
          key: `text-${keyCounter++}`,
        });
      }
      result.push({
        type: "term",
        content: match[0],
        key: `term-${keyCounter++}`,
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      result.push({
        type: "text",
        content: text.slice(lastIndex),
        key: `text-${keyCounter}`,
      });
    }

    return result;
  }, [children, glossaryTerms]);

  return (
    <span className={className}>
      {segments.map((segment) =>
        segment.type === "term" ? (
          <TermPopover key={segment.key} term={segment.content}>
            {segment.content}
          </TermPopover>
        ) : (
          <span key={segment.key}>{segment.content}</span>
        )
      )}
    </span>
  );
}

interface HighlightedTermProps {
  term: string;
  className?: string;
}

export function HighlightedTerm({ term, className = "" }: HighlightedTermProps) {
  return (
    <TermPopover term={term}>
      <span className={className}>{term}</span>
    </TermPopover>
  );
}
