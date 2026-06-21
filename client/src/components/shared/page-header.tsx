import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  icon,
  showSecurityBadge = false,
  securityLabel = "PHI Secured",
  actions,
  "data-testid": testId,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  showSecurityBadge?: boolean;
  securityLabel?: string;
  actions?: React.ReactNode;
  "data-testid"?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap" data-testid={testId || "page-header"}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">{title}</h1>
            {showSecurityBadge && (
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0 gap-1"
                data-testid="badge-phi-secured"
              >
                <Shield className="h-3 w-3" />
                {securityLabel}
              </Badge>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-subtitle">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
