import { Loader2 } from "lucide-react";

export function LoadingState({
  message,
  "data-testid": testId,
}: {
  message?: string;
  "data-testid"?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12" data-testid={testId || "loading-state"}>
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      {message && <p className="text-sm text-muted-foreground mt-3">{message}</p>}
    </div>
  );
}
