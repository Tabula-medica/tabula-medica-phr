import { Badge } from "@/components/ui/badge";

export function getInitials(firstName: string, lastName?: string): string {
  if (lastName !== undefined) {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  }
  return firstName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    connected: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    normal: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    healthy: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    mitigated: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    implemented: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    new: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    elevated: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    upcoming: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    degraded: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    open: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    acknowledged: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    escalated: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    disconnected: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    skipped: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    low: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    syncing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    available: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    in_review: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
  };
  return colors[status] || "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400";
}

export function QuickStatusBadge({
  status,
  label,
  className,
  "data-testid": testId,
}: {
  status: string;
  label?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  return (
    <Badge
      className={`${getStatusColor(status)} ${className || ""}`}
      data-testid={testId || `badge-quick-status-${status}`}
    >
      {displayLabel}
    </Badge>
  );
}
