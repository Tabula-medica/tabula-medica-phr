import { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Pill,
  Stethoscope,
  Activity,
  Syringe,
  HeartPulse,
  Scissors,
  AlertCircle,
  Calendar,
} from "lucide-react";

export type HealthDomain = "medications" | "procedures" | "vitals" | "conditions" | "immunizations";

export interface TimelineEvent {
  id: string;
  domain: HealthDomain;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  type: "point" | "range";
  landmark?: "surgery" | "chronic_diagnosis" | "vaccination" | "hospitalization";
  severity?: "normal" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}

interface LongitudinalTimelineProps {
  events: TimelineEvent[];
  startDate?: Date;
  endDate?: Date;
  onEventClick?: (event: TimelineEvent) => void;
}

const DOMAIN_CONFIG: Record<HealthDomain, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  medications: { label: "Medications", icon: Pill, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
  procedures: { label: "Procedures", icon: Stethoscope, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-900/30" },
  vitals: { label: "Vitals", icon: Activity, color: "text-green-600 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
  conditions: { label: "Conditions", icon: HeartPulse, color: "text-red-600 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
  immunizations: { label: "Immunizations", icon: Syringe, color: "text-amber-600 dark:text-amber-400", bgColor: "bg-amber-100 dark:bg-amber-900/30" },
};

const LANDMARK_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  surgery: { icon: Scissors, color: "text-red-500", label: "Surgery" },
  chronic_diagnosis: { icon: AlertCircle, color: "text-orange-500", label: "Chronic Diagnosis" },
  vaccination: { icon: Syringe, color: "text-green-500", label: "Vaccination" },
  hospitalization: { icon: HeartPulse, color: "text-purple-500", label: "Hospitalization" },
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function LongitudinalTimeline({ events, startDate, endDate, onEventClick }: LongitudinalTimelineProps) {
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    const eventDates = events.flatMap(e => [new Date(e.startDate), e.endDate ? new Date(e.endDate) : new Date(e.startDate)]);
    const minDate = startDate || (eventDates.length ? new Date(Math.min(...eventDates.map(d => d.getTime()))) : new Date());
    const maxDate = endDate || (eventDates.length ? new Date(Math.max(...eventDates.map(d => d.getTime()))) : new Date());
    
    const paddedStart = new Date(minDate);
    paddedStart.setMonth(paddedStart.getMonth() - 1);
    const paddedEnd = new Date(maxDate);
    paddedEnd.setMonth(paddedEnd.getMonth() + 1);
    
    const days = Math.ceil((paddedEnd.getTime() - paddedStart.getTime()) / (1000 * 60 * 60 * 24));
    return { timelineStart: paddedStart, timelineEnd: paddedEnd, totalDays: Math.max(days, 30) };
  }, [events, startDate, endDate]);

  const baseWidth = 1200;
  const timelineWidth = baseWidth * zoom;
  const dayWidth = timelineWidth / totalDays;

  const getPositionForDate = useCallback((date: Date) => {
    const daysSinceStart = (date.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceStart * dayWidth;
  }, [timelineStart, dayWidth]);

  const handleZoomIn = () => setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const handleZoomOut = () => setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM));
  const handleReset = () => { setZoom(1); setPanOffset(0); };

  const handlePanLeft = () => setPanOffset(p => Math.min(p + 100, 0));
  const handlePanRight = () => setPanOffset(p => Math.max(p - 100, -(timelineWidth - baseWidth)));

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStartX(e.clientX - panOffset);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newOffset = e.clientX - dragStartX;
    setPanOffset(Math.min(0, Math.max(newOffset, -(timelineWidth - baseWidth))));
  };

  const handleMouseUp = () => setIsDragging(false);

  const months = useMemo(() => {
    const result: { date: Date; label: string; position: number }[] = [];
    const current = new Date(timelineStart);
    current.setDate(1);
    
    while (current <= timelineEnd) {
      result.push({
        date: new Date(current),
        label: current.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        position: getPositionForDate(current),
      });
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }, [timelineStart, timelineEnd, getPositionForDate]);

  const eventsByDomain = useMemo(() => {
    const grouped: Record<HealthDomain, TimelineEvent[]> = {
      medications: [],
      procedures: [],
      vitals: [],
      conditions: [],
      immunizations: [],
    };
    events.forEach(event => {
      if (grouped[event.domain]) {
        grouped[event.domain].push(event);
      }
    });
    return grouped;
  }, [events]);

  const renderEvent = (event: TimelineEvent, rowIndex: number) => {
    const startPos = getPositionForDate(new Date(event.startDate));
    const endPos = event.endDate ? getPositionForDate(new Date(event.endDate)) : startPos + 8;
    const width = Math.max(endPos - startPos, 8);
    const config = DOMAIN_CONFIG[event.domain];
    const landmarkConfig = event.landmark ? LANDMARK_ICONS[event.landmark] : null;

    return (
      <Tooltip key={event.id}>
        <TooltipTrigger asChild>
          <div
            className={`absolute cursor-pointer transition-all hover:scale-105 hover:z-10 ${event.type === "point" ? "flex items-center justify-center" : ""}`}
            style={{
              left: startPos,
              top: rowIndex * 28 + 4,
              width: event.type === "point" ? 24 : width,
              height: 20,
            }}
            onClick={() => onEventClick?.(event)}
            data-testid={`timeline-event-${event.id}`}
          >
            {event.type === "point" ? (
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${landmarkConfig ? landmarkConfig.color : config.color} ${config.bgColor} border-2 border-current`}>
                {landmarkConfig ? (
                  <landmarkConfig.icon className="w-3 h-3" />
                ) : (
                  <config.icon className="w-3 h-3" />
                )}
              </div>
            ) : (
              <div className={`h-full rounded-md ${config.bgColor} border border-current ${config.color} px-1 flex items-center gap-1 overflow-hidden`}>
                <config.icon className="w-3 h-3 shrink-0" />
                <span className="text-[10px] font-medium truncate">{event.name}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2">
              {landmarkConfig && (
                <Badge variant="outline" className={`text-xs ${landmarkConfig.color}`}>
                  {landmarkConfig.label}
                </Badge>
              )}
              {event.name}
            </div>
            {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(event.startDate).toLocaleDateString()}
              {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString()}`}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  const domains = Object.keys(DOMAIN_CONFIG) as HealthDomain[];

  return (
    <Card className="overflow-hidden" data-testid="longitudinal-timeline">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Longitudinal Health Timeline
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handlePanLeft} data-testid="btn-pan-left">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} data-testid="btn-zoom-out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Badge variant="secondary" className="min-w-[60px] justify-center">
              {Math.round(zoom * 100)}%
            </Badge>
            <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} data-testid="btn-zoom-in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handlePanRight} data-testid="btn-pan-right">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset} data-testid="btn-reset-zoom">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex">
          <div className="w-32 shrink-0 border-r bg-muted/30">
            <div className="h-8 border-b px-2 flex items-center text-xs font-medium text-muted-foreground">
              Domain
            </div>
            {domains.map(domain => {
              const config = DOMAIN_CONFIG[domain];
              const eventCount = eventsByDomain[domain].length;
              const rowHeight = Math.max(eventCount, 1) * 28 + 8;
              return (
                <div
                  key={domain}
                  className="border-b flex items-center gap-2 px-2"
                  style={{ height: rowHeight }}
                  data-testid={`domain-row-${domain}`}
                >
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-xs font-medium">{config.label}</span>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-auto">
                    {eventCount}
                  </Badge>
                </div>
              );
            })}
          </div>
          
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="relative"
              style={{ width: timelineWidth, transform: `translateX(${panOffset}px)` }}
            >
              <div className="h-8 border-b relative bg-muted/20">
                {months.map((month, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center border-l border-muted-foreground/20"
                    style={{ left: month.position }}
                  >
                    <span className="text-[10px] text-muted-foreground px-1 font-medium">{month.label}</span>
                  </div>
                ))}
              </div>
              
              {domains.map(domain => {
                const domainEvents = eventsByDomain[domain];
                const rowHeight = Math.max(domainEvents.length, 1) * 28 + 8;
                return (
                  <div
                    key={domain}
                    className="border-b relative"
                    style={{ height: rowHeight }}
                  >
                    {months.map((month, i) => (
                      <div
                        key={i}
                        className="absolute top-0 h-full border-l border-muted-foreground/10"
                        style={{ left: month.position }}
                      />
                    ))}
                    {domainEvents.map((event, idx) => renderEvent(event, idx))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="p-3 border-t bg-muted/20">
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-medium text-muted-foreground">Landmarks:</span>
            {Object.entries(LANDMARK_ICONS).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <config.icon className={`h-3 w-3 ${config.color}`} />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
