import { useState } from "react";
import { useExpandableState } from "@/components/shared/index";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export function ExpandableCard({
  id,
  expanded,
  onToggle,
  header,
  children,
  "data-testid": testId,
}: {
  id: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  header: React.ReactNode;
  children: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Card
      className="cursor-pointer hover-elevate"
      data-testid={testId || `card-${id}`}
    >
      <CardContent
        className="p-4"
        onClick={() => onToggle(id)}
        data-testid={`button-expand-${id}`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">{header}</div>
        </div>
      </CardContent>
      {expanded && (
        <div data-testid={`detail-${id}`}>
          <Separator />
          <CardContent className="p-4 bg-muted/20">{children}</CardContent>
        </div>
      )}
    </Card>
  );
}

export function useExpandableState() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = (id: string) => setExpandedId((prev) => (prev === id ? null : id));
  return { expandedId, toggle, isExpanded: (id: string) => expandedId === id };
}

export function DetailRow({
  label,
  value,
  "data-testid": testId,
}: {
  label: string;
  value: React.ReactNode;
  "data-testid"?: string;
}) {
  if (!value) return null;
  return (
    <div data-testid={testId}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

export function DetailGrid({
  children,
  columns = 2,
  "data-testid": testId,
}: {
  children: React.ReactNode;
  columns?: 2 | 3 | 4;
  "data-testid"?: string;
}) {
  const gridCols = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };
  return (
    <div className={`grid gap-3 ${gridCols[columns]}`} data-testid={testId}>
      {children}
    </div>
  );
}
