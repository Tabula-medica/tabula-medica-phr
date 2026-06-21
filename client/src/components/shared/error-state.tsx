import { AlertCircle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message,
  icon: Icon = AlertCircle,
  onRetry,
  retryLabel = "Try Again",
  "data-testid": testId,
}: {
  title?: string;
  message?: string;
  icon?: LucideIcon;
  onRetry?: () => void;
  retryLabel?: string;
  "data-testid"?: string;
}) {
  return (
    <Card className="border-destructive/50" data-testid={testId || "error-state"}>
      <CardContent className="p-6 text-center">
        <Icon className="h-12 w-12 mx-auto mb-4 text-destructive opacity-50" />
        <p className="font-medium text-destructive" data-testid="text-error-title">{title}</p>
        {message && (
          <p className="text-sm text-muted-foreground mt-2" data-testid="text-error-message">{message}</p>
        )}
        {onRetry && (
          <Button variant="outline" onClick={onRetry} className="mt-4" data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
