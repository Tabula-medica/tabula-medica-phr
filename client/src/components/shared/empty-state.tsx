import { FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon = FileText,
  title = "No results found",
  description = "Try adjusting your search or filters.",
  "data-testid": testId,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  "data-testid"?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid={testId || "empty-state"}>
      <Icon className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground/70 mt-1">{description}</p>
    </div>
  );
}
