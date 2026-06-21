import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react";

type StatusType = "success" | "warning" | "error" | "info" | "pending" | "neutral";
type TrendType = "improving" | "worsening" | "stable";
type SeverityType = "mild" | "moderate" | "severe";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { 
  icon: typeof CheckCircle; 
  colors: string;
  srLabel: string;
}> = {
  success: {
    icon: CheckCircle,
    colors: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    srLabel: "Success",
  },
  warning: {
    icon: AlertTriangle,
    colors: "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30",
    srLabel: "Warning",
  },
  error: {
    icon: XCircle,
    colors: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30",
    srLabel: "Error",
  },
  info: {
    icon: Info,
    colors: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
    srLabel: "Information",
  },
  pending: {
    icon: Clock,
    colors: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    srLabel: "Pending",
  },
  neutral: {
    icon: Minus,
    colors: "bg-muted text-muted-foreground border-border",
    srLabel: "Neutral",
  },
};

export function StatusBadge({ status, label, showIcon = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.colors, className)}
      aria-label={`${config.srLabel}: ${label}`}
    >
      {showIcon && <Icon className="h-3 w-3 mr-1" aria-hidden="true" />}
      <span>{label}</span>
    </Badge>
  );
}

interface TrendIndicatorProps {
  trend: TrendType;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const trendConfig: Record<TrendType, {
  icon: typeof TrendingUp;
  colors: string;
  textLabel: string;
}> = {
  improving: {
    icon: TrendingDown,
    colors: "text-green-600 dark:text-green-400",
    textLabel: "Improving",
  },
  worsening: {
    icon: TrendingUp,
    colors: "text-red-600 dark:text-red-400",
    textLabel: "Worsening",
  },
  stable: {
    icon: Minus,
    colors: "text-amber-600 dark:text-amber-400",
    textLabel: "Stable",
  },
};

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function TrendIndicator({ 
  trend, 
  label, 
  showLabel = true, 
  size = "md",
  className 
}: TrendIndicatorProps) {
  const config = trendConfig[trend];
  const Icon = config.icon;
  const displayLabel = label || config.textLabel;

  return (
    <span 
      className={cn("inline-flex items-center gap-1", config.colors, className)}
      aria-label={`Trend: ${displayLabel}`}
    >
      <Icon className={sizeClasses[size]} aria-hidden="true" />
      {showLabel && <span className="text-sm">{displayLabel}</span>}
      {!showLabel && <span className="sr-only">{displayLabel}</span>}
    </span>
  );
}

interface SeverityBadgeProps {
  severity: SeverityType;
  label?: string;
  className?: string;
}

const severityConfig: Record<SeverityType, {
  colors: string;
  textLabel: string;
}> = {
  mild: {
    colors: "border-green-500 text-green-600 dark:text-green-400 bg-green-500/10",
    textLabel: "Mild",
  },
  moderate: {
    colors: "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10",
    textLabel: "Moderate",
  },
  severe: {
    colors: "border-red-500 text-red-600 dark:text-red-400 bg-red-500/10",
    textLabel: "Severe",
  },
};

export function SeverityBadge({ severity, label, className }: SeverityBadgeProps) {
  const config = severityConfig[severity];
  const displayLabel = label || config.textLabel;

  return (
    <Badge 
      variant="outline" 
      className={cn(config.colors, className)}
      aria-label={`Severity: ${displayLabel}`}
    >
      <span>{displayLabel}</span>
    </Badge>
  );
}

interface OnlineStatusProps {
  isOnline: boolean;
  label?: string;
  showDot?: boolean;
  className?: string;
}

export function OnlineStatus({ isOnline, label, showDot = true, className }: OnlineStatusProps) {
  const displayLabel = label || (isOnline ? "Online" : "Offline");
  
  return (
    <span 
      className={cn(
        "inline-flex items-center gap-2 text-sm",
        isOnline ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
        className
      )}
      aria-label={`Status: ${displayLabel}`}
    >
      {showDot && (
        <span 
          className={cn(
            "h-2 w-2 rounded-full",
            isOnline ? "bg-green-500" : "bg-muted-foreground"
          )}
          aria-hidden="true"
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
}

interface ProgressStatusProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressStatus({ current, total, label, className }: ProgressStatusProps) {
  const percentage = Math.round((current / total) * 100);
  const displayLabel = label || `${current} of ${total}`;
  
  return (
    <span 
      className={cn("inline-flex items-center gap-2 text-sm", className)}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Progress: ${displayLabel} (${percentage}%)`}
    >
      <span className="text-muted-foreground">{displayLabel}</span>
      <span className="font-medium">({percentage}%)</span>
    </span>
  );
}
