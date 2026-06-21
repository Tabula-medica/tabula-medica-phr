import { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface DataPoint {
  date: string;
  value: number;
}

interface TrendSparklineProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  showTrendIndicator?: boolean;
  unit?: string;
  normalRange?: { min: number; max: number };
  label?: string;
}

type TrendDirection = "up" | "down" | "stable";

export function TrendSparkline({
  data,
  width = 80,
  height = 24,
  showTrendIndicator = true,
  unit = "",
  normalRange,
  label,
}: TrendSparklineProps) {
  const { path, trend, trendPercentage, latestValue, isAbnormal, minVal, maxVal } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: "", trend: "stable" as TrendDirection, trendPercentage: 0, latestValue: data?.[0]?.value || 0, isAbnormal: false, minVal: 0, maxVal: 0 };
    }

    const values = data.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const padding = 2;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((d.value - min) / range) * chartHeight;
      return { x, y };
    });

    const pathData = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length;
    
    const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;
    let direction: TrendDirection = "stable";
    if (percentChange > 5) direction = "up";
    else if (percentChange < -5) direction = "down";

    const latest = data[data.length - 1].value;
    const abnormal = normalRange ? (latest < normalRange.min || latest > normalRange.max) : false;

    return {
      path: pathData,
      trend: direction,
      trendPercentage: Math.abs(percentChange),
      latestValue: latest,
      isAbnormal: abnormal,
      minVal: min,
      maxVal: max,
    };
  }, [data, width, height, normalRange]);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" />
        <span>No trend data</span>
      </div>
    );
  }

  const strokeColor = isAbnormal
    ? "hsl(var(--destructive))"
    : trend === "up"
    ? "hsl(142 76% 36%)"
    : trend === "down"
    ? "hsl(0 84% 60%)"
    : "hsl(var(--muted-foreground))";

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = isAbnormal
    ? "text-destructive"
    : trend === "up"
    ? "text-green-600 dark:text-green-400"
    : trend === "down"
    ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 cursor-help" data-testid="trend-sparkline">
          <svg width={width} height={height} className="overflow-visible">
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={width - 2}
              cy={2 + (height - 4) - ((latestValue - minVal) / (maxVal - minVal || 1)) * (height - 4)}
              r={2.5}
              fill={strokeColor}
            />
          </svg>
          {showTrendIndicator && (
            <div className={`flex items-center gap-0.5 ${trendColor}`}>
              {isAbnormal && <AlertTriangle className="h-3 w-3" />}
              <TrendIcon className="h-3 w-3" />
              {trendPercentage > 0 && (
                <span className="text-[10px] font-medium">{trendPercentage.toFixed(0)}%</span>
              )}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1.5 text-xs">
          {label && <div className="font-semibold">{label}</div>}
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Latest:</span>
            <span className="font-medium">{latestValue.toFixed(1)} {unit}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Trend:</span>
            <span className={`font-medium ${trendColor}`}>
              {trend === "up" ? "Increasing" : trend === "down" ? "Decreasing" : "Stable"}
              {trendPercentage > 0 && ` (${trendPercentage.toFixed(1)}%)`}
            </span>
          </div>
          {normalRange && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Normal range:</span>
              <span className="font-medium">{normalRange.min} - {normalRange.max} {unit}</span>
            </div>
          )}
          {isAbnormal && (
            <div className="text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Outside normal range
            </div>
          )}
          <div className="text-muted-foreground pt-1 border-t">
            Data from {data.length} readings over{" "}
            {Math.ceil((new Date(data[data.length - 1].date).getTime() - new Date(data[0].date).getTime()) / (1000 * 60 * 60 * 24))} days
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface LabResultWithSparklineProps {
  name: string;
  value: number;
  unit: string;
  historicalData: DataPoint[];
  normalRange?: { min: number; max: number };
  date: string;
}

export function LabResultWithSparkline({ name, value, unit, historicalData, normalRange, date }: LabResultWithSparklineProps) {
  const isAbnormal = normalRange && (value < normalRange.min || value > normalRange.max);

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0" data-testid={`lab-result-${name.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          {isAbnormal && (
            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <TrendSparkline
          data={historicalData}
          normalRange={normalRange}
          unit={unit}
          label={name}
        />
        <div className="text-right min-w-[60px]">
          <span className={`font-semibold ${isAbnormal ? "text-destructive" : ""}`}>
            {value.toFixed(1)}
          </span>
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </div>
      </div>
    </div>
  );
}
