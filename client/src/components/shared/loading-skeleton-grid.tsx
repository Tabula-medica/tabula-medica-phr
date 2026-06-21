import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeletonGrid({
  count = 4,
  columns = 4,
  variant = "stat",
  "data-testid": testId,
}: {
  count?: number;
  columns?: 2 | 3 | 4 | 5;
  variant?: "stat" | "card" | "list";
  "data-testid"?: string;
}) {
  const gridCols: Record<number, string> = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  };

  if (variant === "list") {
    return (
      <div className="space-y-3" data-testid={testId || "loading-skeleton"}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className={`grid gap-3 ${gridCols[columns]}`} data-testid={testId || "loading-skeleton"}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-2/3" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${gridCols[columns]}`} data-testid={testId || "loading-skeleton"}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
