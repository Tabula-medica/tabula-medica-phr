import { Badge } from "@/components/ui/badge";

export function SectionHeader({
  title,
  subtitle,
  icon,
  badge,
  actions,
  size = "md",
  "data-testid": testId,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: { label: string; variant?: "default" | "secondary" | "destructive" | "outline" };
  actions?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  "data-testid"?: string;
}) {
  const sizeClasses = {
    sm: "text-sm font-medium",
    md: "text-lg font-medium",
    lg: "text-xl font-semibold",
  };

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap" data-testid={testId || "section-header"}>
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={sizeClasses[size]} data-testid="text-section-title">{title}</h3>
            {badge && (
              <Badge variant={badge.variant || "secondary"}>{badge.label}</Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
