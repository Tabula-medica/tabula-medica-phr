import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  active: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Active" },
  completed: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Completed" },
  filled: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Filled" },
  pending: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Pending" },
  in_progress: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "In Progress" },
  expired: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400", label: "Expired" },
  discontinued: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Discontinued" },
  cancelled: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400", label: "Cancelled" },
  scheduled: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", label: "Scheduled" },
  no_show: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "No Show" },
  on_hold: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", label: "On Hold" },
  resolved: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Resolved" },
  draft: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400", label: "Draft" },
  overdue: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Overdue" },
  critical: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Critical" },
  high: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", label: "High" },
  medium: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Medium" },
  low: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Low" },
  normal: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Normal" },
  borderline: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Borderline" },
  abnormal: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Abnormal" },
  moderate: { className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", label: "Moderate" },
  historical: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400", label: "Historical" },
  "as-needed": { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "PRN" },
  urgent: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Urgent" },
  checked_in: { className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", label: "Checked In" },
  final: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Final" },
  preliminary: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Preliminary" },
  routine: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Routine" },
  stat: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "STAT" },
  confirmed: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Confirmed" },
  denied: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Denied" },
  approved: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Approved" },
  review: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Review" },
  inactive: { className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400", label: "Inactive" },
};

export function StatusBadge({
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
  const config = STATUS_CONFIG[status] || {
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "),
  };
  return (
    <Badge
      variant="outline"
      className={`${config.className} border-0 ${className || ""}`}
      data-testid={testId || `badge-status-${status}`}
    >
      {label || config.label}
    </Badge>
  );
}

const FLAG_CONFIG: Record<string, { className: string; label: string }> = {
  normal: { className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", label: "Normal" },
  abnormal: { className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: "Abnormal" },
  high: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "High" },
  low: { className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", label: "Low" },
  critical: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Critical" },
  critical_low: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Critical Low" },
  critical_high: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300", label: "Critical High" },
};

export function FlagBadge({
  flag,
  label,
  className,
  "data-testid": testId,
}: {
  flag: string;
  label?: string;
  className?: string;
  "data-testid"?: string;
}) {
  const config = FLAG_CONFIG[flag] || {
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400",
    label: flag.charAt(0).toUpperCase() + flag.slice(1),
  };
  return (
    <Badge
      variant="outline"
      className={`${config.className} border-0 ${className || ""}`}
      data-testid={testId || `badge-flag-${flag}`}
    >
      {label || config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, "data-testid": testId }: { priority: string; "data-testid"?: string }) {
  return <StatusBadge status={priority} data-testid={testId || `badge-priority-${priority}`} />;
}
