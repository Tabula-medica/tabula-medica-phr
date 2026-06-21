import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Bell, 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  Check, 
  X, 
  RefreshCw,
  Activity,
  Heart,
  Brain,
  Pill,
  Calendar,
  Shield
} from "lucide-react";

type AlertPriority = "high" | "medium" | "low";
type AlertCategory = 
  | "symptom_trend" 
  | "vital_sign" 
  | "medication" 
  | "emotional_pattern" 
  | "lifestyle" 
  | "preventive";

interface HealthAlert {
  id: string;
  patientId: string;
  category: AlertCategory;
  priority: AlertPriority;
  title: string;
  description: string;
  dataPoints: string[];
  recommendation: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  dismissed: boolean;
}

const CATEGORY_ICONS: Record<AlertCategory, typeof Activity> = {
  symptom_trend: Activity,
  vital_sign: Heart,
  medication: Pill,
  emotional_pattern: Brain,
  lifestyle: Calendar,
  preventive: Shield,
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  symptom_trend: "Symptom Trend",
  vital_sign: "Vital Signs",
  medication: "Medication",
  emotional_pattern: "Emotional Pattern",
  lifestyle: "Lifestyle",
  preventive: "Preventive Care",
};

const PRIORITY_COLORS: Record<AlertPriority, string> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

function getPriorityIcon(priority: AlertPriority) {
  switch (priority) {
    case "high":
      return <AlertTriangle className="h-4 w-4" />;
    case "medium":
      return <AlertCircle className="h-4 w-4" />;
    case "low":
      return <Info className="h-4 w-4" />;
  }
}

export function ProactiveAlertsCard() {
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: alerts, isLoading } = useQuery<HealthAlert[]>({
    queryKey: ["/api/proactive-alerts"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/proactive-alerts/generate");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-alerts"] });
      setIsGenerating(false);
    },
    onError: () => {
      setIsGenerating(false);
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("POST", `/api/proactive-alerts/${alertId}/acknowledge`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-alerts"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await apiRequest("DELETE", `/api/proactive-alerts/${alertId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/proactive-alerts"] });
    },
  });

  const handleGenerate = () => {
    setIsGenerating(true);
    generateMutation.mutate();
  };

  const activeAlerts = alerts?.filter(a => !a.dismissed) || [];
  const highPriorityCount = activeAlerts.filter(a => a.priority === "high").length;
  const mediumPriorityCount = activeAlerts.filter(a => a.priority === "medium").length;

  return (
    <Card data-testid="card-proactive-alerts">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Proactive Health Alerts</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {highPriorityCount > 0 && (
              <Badge variant="destructive" data-testid="badge-high-priority-count">
                {highPriorityCount} High
              </Badge>
            )}
            {mediumPriorityCount > 0 && (
              <Badge variant="secondary" data-testid="badge-medium-priority-count">
                {mediumPriorityCount} Medium
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          AI-analyzed health trends and observations from your data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Informational only. Not medical advice.</AlertTitle>
          <AlertDescription>
            These observations are generated from your health data. Always consult your healthcare provider for medical decisions.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || generateMutation.isPending}
            size="sm"
            data-testid="button-generate-alerts"
          >
            {isGenerating || generateMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Analyze Health Data
              </>
            )}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeAlerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active health alerts</p>
            <p className="text-sm mt-1">Click "Analyze Health Data" to check for trends</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Accordion type="multiple" className="space-y-2">
              {activeAlerts.map((alert) => {
                const CategoryIcon = CATEGORY_ICONS[alert.category];
                return (
                  <AccordionItem
                    key={alert.id}
                    value={alert.id}
                    className="border rounded-lg px-4"
                    data-testid={`accordion-alert-${alert.id}`}
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(alert.priority)}
                          <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {CATEGORY_LABELS[alert.category]} • {new Date(alert.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant={PRIORITY_COLORS[alert.priority] as any}
                          className="ml-2"
                        >
                          {alert.priority}
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                      <div>
                        <h4 className="text-sm font-medium mb-1">Observation</h4>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                      </div>

                      {alert.dataPoints.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Data Points</h4>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            {alert.dataPoints.map((point, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-primary">•</span>
                                {point}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium mb-1">Note</h4>
                        <p className="text-sm text-muted-foreground">{alert.recommendation}</p>
                      </div>

                      {alert.acknowledgedAt && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          Acknowledged on {new Date(alert.acknowledgedAt).toLocaleString()}
                          {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2 border-t">
                        {!alert.acknowledgedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            disabled={acknowledgeMutation.isPending}
                            data-testid={`button-acknowledge-${alert.id}`}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => dismissMutation.mutate(alert.id)}
                          disabled={dismissMutation.isPending}
                          data-testid={`button-dismiss-${alert.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Dismiss
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Informational only. Not medical advice. Sample data shown for illustration.
        </p>
      </CardContent>
    </Card>
  );
}
