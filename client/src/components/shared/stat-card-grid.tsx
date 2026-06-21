import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

export interface StatCardItem {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  iconBg?: string;
  testId?: string;
  description?: string;
  onClick?: () => void;
  selected?: boolean;
  selectedRing?: string;
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  iconBg,
  testId,
  description,
  onClick,
  selected,
  selectedRing = "ring-primary",
  layout = "row",
  "data-testid": dataTestId,
}: StatCardItem & {
  layout?: "row" | "center";
  "data-testid"?: string;
}) {
  const id = dataTestId || testId;
  return (
    <Card
      className={`${onClick ? "cursor-pointer hover-elevate" : ""} ${selected ? `ring-2 ${selectedRing}` : ""}`}
      onClick={onClick}
      data-testid={id}
    >
      <CardContent className="p-4">
        {layout === "center" ? (
          <div className="text-center">
            <p className="text-2xl font-bold" data-testid={id ? `${id}-value` : undefined}>
              {value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {iconBg ? (
              <div className={`p-2 rounded-md ${iconBg}`}>
                <Icon className={`h-5 w-5 ${color || "text-muted-foreground"}`} />
              </div>
            ) : (
              <Icon className={`h-5 w-5 shrink-0 ${color || "text-muted-foreground"}`} />
            )}
            <div className="min-w-0">
              <p className="text-2xl font-bold" data-testid={id ? `${id}-value` : undefined}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              {description && (
                <p className="text-xs text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function StatCardGrid({
  stats,
  columns = 4,
  layout = "default",
  "data-testid": testId,
}: {
  stats: StatCardItem[];
  columns?: 2 | 3 | 4 | 5;
  layout?: "default" | "icon-left" | "center";
  "data-testid"?: string;
}) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  return (
    <div className={`grid gap-3 ${gridCols[columns]}`} data-testid={testId || "stat-card-grid"}>
      {stats.map((stat) => (
        <MetricCard
          key={stat.testId || stat.label}
          {...stat}
          layout={layout === "icon-left" ? "row" : layout === "center" ? "center" : "row"}
        />
      ))}
    </div>
  );
}
