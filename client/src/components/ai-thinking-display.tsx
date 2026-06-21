import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Brain, ChevronDown, ChevronUp, Lightbulb, Eye } from "lucide-react";

interface AIThinkingDisplayProps {
  thinking: string;
  className?: string;
  defaultExpanded?: boolean;
  label?: string;
}

export function AIThinkingDisplay({ thinking, className, defaultExpanded = false, label }: AIThinkingDisplayProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!thinking) return null;

  const steps = thinking.split(/\n(?=\d+\.|Step \d|[-•])/g).filter((s) => s.trim());

  return (
    <div className={cn("rounded-xl border border-primary/20 bg-primary/[0.03] dark:bg-primary/[0.06] overflow-hidden", className)} data-testid="ai-thinking-container">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-primary/[0.05] transition-colors"
        data-testid="button-toggle-thinking"
      >
        <Brain className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-primary flex-1">
          {label || "AI Reasoning"}
        </span>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 text-primary border-0">
          Transparent
        </Badge>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-primary/60" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-primary/60" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2" data-testid="thinking-content">
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>This shows how the AI arrived at its answer. Full transparency — no black box.</span>
          </div>
          <div className="space-y-1.5">
            {steps.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-foreground/80">
                <Lightbulb className="h-3.5 w-3.5 mt-1 text-amber-500/70 shrink-0" />
                <span className="leading-relaxed">{step.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function parseThinkingFromResponse(content: string): { thinking: string; response: string } {
  const match = content.match(/<think>([\s\S]*?)<\/think>/);
  if (match) {
    return {
      thinking: match[1].trim(),
      response: content.replace(/<think>[\s\S]*?<\/think>/, "").trim(),
    };
  }
  return { thinking: "", response: content };
}
