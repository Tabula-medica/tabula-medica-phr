import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Info,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useFhirEventStream } from "@/hooks/use-fhir-event-stream";
import { 
  FhirEvent, 
  FhirEventSeverity, 
  FHIR_EVENT_LABELS, 
  FHIR_SOURCE_LABELS 
} from "../../../shared/fhir-event-types";
import { formatDistanceToNow } from "date-fns";

interface LiveEventStreamProps {
  maxHeight?: string;
  showControls?: boolean;
  compact?: boolean;
}

const severityIcons: Record<FhirEventSeverity, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  success: CheckCircle2,
};

const severityColors: Record<FhirEventSeverity, string> = {
  info: "text-blue-500",
  warning: "text-yellow-500",
  error: "text-red-500",
  success: "text-green-500",
};

const severityBadgeVariants: Record<FhirEventSeverity, "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
  success: "default",
};

function EventItem({ event, compact }: { event: FhirEvent; compact?: boolean }) {
  const SeverityIcon = severityIcons[event.severity];
  const colorClass = severityColors[event.severity];
  const timeAgo = formatDistanceToNow(new Date(event.timestamp), { addSuffix: true });

  if (compact) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 hover-elevate rounded-md" data-testid={`event-item-${event.id}`}>
        <SeverityIcon className={`h-4 w-4 flex-shrink-0 ${colorClass}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{event.title}</p>
        </div>
        <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo}</span>
      </div>
    );
  }

  return (
    <div className="p-3 border rounded-lg hover-elevate" data-testid={`event-item-${event.id}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${colorClass}`}>
          <SeverityIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{event.title}</span>
            <Badge variant={severityBadgeVariants[event.severity]} className="text-xs">
              {event.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{event.description}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {FHIR_SOURCE_LABELS[event.source] || event.source}
            </span>
            <span className="flex items-center gap-1">
              <Circle className="h-3 w-3" />
              {event.resourceType}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {timeAgo}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LiveEventStream({ 
  maxHeight = "400px", 
  showControls = true,
  compact = false 
}: LiveEventStreamProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const {
    isConnected,
    isConnecting,
    events,
    error,
    connect,
    disconnect,
    clearEvents,
  } = useFhirEventStream({
    autoConnect: true,
    maxEvents: 100,
    onEvent: (event) => {
      if (!isPaused) {
        console.log("[LiveEventStream] New event:", event.type);
      }
    },
  });

  const displayEvents = isPaused ? [] : events;
  const sortedEvents = [...displayEvents].reverse();

  const handleSimulate = async () => {
    try {
      await fetch("/api/fhir-streaming/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 5, interval: 1500 }),
      });
    } catch (error) {
      console.error("Failed to start simulation:", error);
    }
  };

  return (
    <Card className="flex flex-col" data-testid="card-live-event-stream">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Radio className={`h-5 w-5 ${isConnected ? "text-green-500 animate-pulse" : "text-muted-foreground"}`} />
            <CardTitle className="text-lg">Live Event Stream</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge variant="default" className="gap-1" data-testid="badge-connection-status">
                <Wifi className="h-3 w-3" />
                Connected
              </Badge>
            ) : isConnecting ? (
              <Badge variant="secondary" className="gap-1" data-testid="badge-connection-status">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Connecting...
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1" data-testid="badge-connection-status">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
            {events.length > 0 && (
              <Badge variant="secondary" data-testid="badge-event-count">
                {events.length} events
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Real-time updates from FHIR servers and data processing
        </CardDescription>
      </CardHeader>
      
      {showControls && (
        <>
          <Separator />
          <div className="p-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-scroll"
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                  data-testid="switch-auto-scroll"
                />
                <Label htmlFor="auto-scroll" className="text-sm">Auto-scroll</Label>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPaused(!isPaused)}
                data-testid="button-pause-stream"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </>
                )}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSimulate}
                disabled={!isConnected}
                data-testid="button-simulate-events"
              >
                <Activity className="h-4 w-4 mr-1" />
                Simulate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearEvents}
                disabled={events.length === 0}
                data-testid="button-clear-events"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
              {!isConnected && !isConnecting && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={connect}
                  data-testid="button-reconnect"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reconnect
                </Button>
              )}
            </div>
          </div>
        </>
      )}
      
      <Separator />
      
      <CardContent className="flex-1 p-0">
        {error && (
          <div className="p-4 bg-destructive/10 border-b border-destructive/20">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}
        
        <ScrollArea style={{ height: maxHeight }}>
          <div className={`p-3 space-y-2 ${compact ? "space-y-0" : ""}`}>
            {sortedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                {isPaused ? (
                  <>
                    <Pause className="h-8 w-8 mb-2" />
                    <p className="text-sm">Stream paused</p>
                    <p className="text-xs">Click Resume to continue receiving events</p>
                  </>
                ) : (
                  <>
                    <Radio className="h-8 w-8 mb-2" />
                    <p className="text-sm">Waiting for events...</p>
                    <p className="text-xs">Real-time updates will appear here</p>
                  </>
                )}
              </div>
            ) : (
              sortedEvents.map((event) => (
                <EventItem key={event.id} event={event} compact={compact} />
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
