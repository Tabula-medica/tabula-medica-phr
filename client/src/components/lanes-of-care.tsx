import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Activity,
  Pill,
  Stethoscope,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ChevronRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VitalDataPoint {
  date: string;
  value: number;
  unit: string;
  source: string;
  status?: string;
}

interface VitalTrendData {
  loincCode: string;
  displayName: string;
  dataPoints: VitalDataPoint[];
  currentValue?: number;
  trend?: string;
  normalRange?: { low: number; high: number };
}

interface MedicationTimelineEntry {
  rxNormCode: string;
  displayName: string;
  startDate: string;
  endDate?: string;
  status: string;
  dosage?: string;
  frequency?: string;
  isActive: boolean;
  source: string;
}

interface EncounterEntry {
  id: string;
  type: string;
  date: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reason?: string;
  source: string;
}

interface LanesOfCareProps {
  vitals: VitalTrendData[];
  medications: MedicationTimelineEntry[];
  encounters: EncounterEntry[];
  timeRange: { start: string; end: string };
}

function TrendSparkline({ dataPoints, normalRange }: { dataPoints: VitalDataPoint[]; normalRange?: { low: number; high: number } }) {
  if (dataPoints.length < 2) return null;

  const sortedPoints = [...dataPoints].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const values = sortedPoints.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  
  const width = 120;
  const height = 32;
  const padding = 4;
  
  const points = sortedPoints.map((point, idx) => {
    const x = padding + (idx / (sortedPoints.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((point.value - minVal) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const lastPoint = sortedPoints[sortedPoints.length - 1];
  const isInRange = normalRange 
    ? lastPoint.value >= normalRange.low && lastPoint.value <= normalRange.high
    : true;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <svg width={width} height={height} className="cursor-pointer">
            {normalRange && (
              <rect
                x={padding}
                y={height - padding - ((normalRange.high - minVal) / range) * (height - 2 * padding)}
                width={width - 2 * padding}
                height={((normalRange.high - normalRange.low) / range) * (height - 2 * padding)}
                fill="hsl(var(--muted))"
                opacity={0.3}
              />
            )}
            <polyline
              points={points}
              fill="none"
              stroke={isInRange ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {sortedPoints.map((point, idx) => {
              const x = padding + (idx / (sortedPoints.length - 1)) * (width - 2 * padding);
              const y = height - padding - ((point.value - minVal) / range) * (height - 2 * padding);
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r={2}
                  fill={isInRange ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                />
              );
            })}
          </svg>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p className="font-medium">12-Month Trend</p>
            <p>Min: {minVal.toFixed(1)} | Max: {maxVal.toFixed(1)}</p>
            <p>Current: {lastPoint.value} {lastPoint.unit}</p>
            {normalRange && (
              <p className="text-muted-foreground">
                Normal: {normalRange.low}-{normalRange.high}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ProvenanceBadge({ source }: { source: string }) {
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Building2 className="h-3 w-3" />
      {source}
    </Badge>
  );
}

function TrendIndicator({ trend }: { trend?: string }) {
  if (!trend) return <Minus className="h-4 w-4 text-muted-foreground" />;
  
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

export function LanesOfCare({ vitals, medications, encounters }: LanesOfCareProps) {
  const sortedEncounters = [...encounters].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-primary" />
            Lab Results & Vitals Lane
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {vitals.map((vital) => (
                <div 
                  key={vital.loincCode} 
                  className="min-w-[200px] p-4 rounded-lg border bg-card hover-elevate"
                  data-testid={`vital-card-${vital.loincCode}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{vital.displayName}</span>
                    <TrendIndicator trend={vital.trend} />
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold">
                      {vital.currentValue || vital.dataPoints[vital.dataPoints.length - 1]?.value}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {vital.dataPoints[0]?.unit}
                    </span>
                  </div>

                  <TrendSparkline 
                    dataPoints={vital.dataPoints} 
                    normalRange={vital.normalRange}
                  />

                  <div className="mt-2">
                    <ProvenanceBadge source={vital.dataPoints[vital.dataPoints.length - 1]?.source || "Unknown"} />
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-primary" />
            Medications Lane
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {medications.map((med) => {
              const medId = med.rxNormCode;
              const rangeStart = new Date(timeRange.start).getTime();
              const rangeEnd = new Date(timeRange.end).getTime();
              const totalRange = rangeEnd - rangeStart;
              const startDate = med.startDate ? new Date(med.startDate).getTime() : rangeStart;
              const endDate = med.endDate ? new Date(med.endDate).getTime() : rangeEnd;
              const startPos = Math.max(0, ((startDate - rangeStart) / totalRange) * 100);
              const width = Math.min(100 - startPos, ((Math.min(endDate, rangeEnd) - Math.max(startDate, rangeStart)) / totalRange) * 100);
              
              return (
                <div 
                  key={medId}
                  className="flex flex-wrap items-center gap-4 p-3 rounded-lg border hover-elevate"
                  data-testid={`medication-lane-${medId}`}
                >
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">{med.displayName}</span>
                      <Badge variant={med.isActive ? "default" : med.status === "stopped" ? "destructive" : "secondary"}>
                        {med.status}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      {med.dosage && (
                        <span>{med.dosage} {med.frequency || ""}</span>
                      )}
                    </div>
                  </div>

                  <div className="relative w-48 h-8 bg-muted/30 rounded flex-shrink-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`absolute top-1 bottom-1 rounded ${
                              med.isActive 
                                ? "bg-primary" 
                                : med.status === "stopped" 
                                  ? "bg-destructive/60" 
                                  : "bg-muted-foreground/40"
                            }`}
                            style={{
                              left: `${startPos}%`,
                              width: `${Math.max(width, 3)}%`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{formatDate(med.startDate)} - {med.endDate ? formatDate(med.endDate) : "Present"}</p>
                          <p className="text-xs text-muted-foreground">Source: {med.source}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <ProvenanceBadge source={med.source} />
                  
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-primary" />
            Encounters Lane
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
            
            <div className="space-y-4">
              {sortedEncounters.slice(0, 10).map((encounter, idx) => (
                <div 
                  key={encounter.id}
                  className="relative pl-14"
                  data-testid={`encounter-${encounter.id}`}
                >
                  <div className="absolute left-4 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                  
                  <div className="p-3 rounded-lg border hover-elevate">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{encounter.type}</span>
                          <Badge variant="outline">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(encounter.date)}
                          </Badge>
                        </div>
                        {encounter.reason && (
                          <p className="text-sm text-muted-foreground mb-1">{encounter.reason}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {encounter.provider && <span>{encounter.provider}</span>}
                          {encounter.location && <span>{encounter.location}</span>}
                        </div>
                      </div>
                      <ProvenanceBadge source={encounter.source} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default LanesOfCare;
