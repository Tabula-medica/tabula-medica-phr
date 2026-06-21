import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  Pill,
  Activity,
  Syringe,
  Stethoscope,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type { EhrConnection } from "@shared/schema";
import { ehrPlatformInfo } from "@shared/schema";

interface SyncStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: "pending" | "syncing" | "complete" | "error";
  count?: number;
}

interface SourceSyncStatus {
  connectionId: string;
  name: string;
  platform: string;
  color: string;
  steps: SyncStep[];
  overallProgress: number;
  status: "pending" | "syncing" | "complete" | "error";
}

const defaultSteps: Omit<SyncStep, "status" | "count">[] = [
  { id: "demographics", label: "Patient Info", icon: Heart },
  { id: "encounters", label: "Visits", icon: Stethoscope },
  { id: "conditions", label: "Conditions", icon: Activity },
  { id: "medications", label: "Medications", icon: Pill },
  { id: "labs", label: "Lab Results", icon: FileText },
  { id: "immunizations", label: "Immunizations", icon: Syringe },
];

export default function SyncProgress() {
  const [, setLocation] = useLocation();
  const [syncSources, setSyncSources] = useState<SourceSyncStatus[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(true);

  const { data: connections } = useQuery<EhrConnection[]>({
    queryKey: ["/api/ehr/connections"],
  });

  useEffect(() => {
    if (connections && connections.length > 0) {
      const sources: SourceSyncStatus[] = connections
        .filter((conn) => conn.status === "connected" || conn.status === "syncing")
        .map((conn) => {
          const platformData = ehrPlatformInfo[conn.platform as keyof typeof ehrPlatformInfo];
          return {
            connectionId: conn.id,
            name: conn.facilityName,
            platform: platformData?.name || conn.platform,
            color: platformData?.color || "#666",
            steps: defaultSteps.map((step) => ({ ...step, status: "pending" as const })),
            overallProgress: 0,
            status: "pending" as const,
          };
        });
      setSyncSources(sources);
    }
  }, [connections]);

  useEffect(() => {
    if (syncSources.length === 0) return;

    let currentSourceIndex = 0;
    let currentStepIndex = 0;

    const simulateSync = () => {
      setSyncSources((prev) => {
        const updated = [...prev];
        
        if (currentSourceIndex >= updated.length) {
          setIsSyncing(false);
          return updated;
        }

        const source = updated[currentSourceIndex];
        
        if (currentStepIndex === 0) {
          source.status = "syncing";
        }

        if (currentStepIndex < source.steps.length) {
          if (currentStepIndex > 0) {
            source.steps[currentStepIndex - 1].status = "complete";
            source.steps[currentStepIndex - 1].count = Math.floor(Math.random() * 20) + 1;
          }
          source.steps[currentStepIndex].status = "syncing";
          source.overallProgress = ((currentStepIndex + 1) / source.steps.length) * 100;
          currentStepIndex++;
        } else {
          source.steps[currentStepIndex - 1].status = "complete";
          source.steps[currentStepIndex - 1].count = Math.floor(Math.random() * 10) + 1;
          source.status = "complete";
          source.overallProgress = 100;
          currentSourceIndex++;
          currentStepIndex = 0;
        }

        const totalProgress = updated.reduce((acc, s) => acc + s.overallProgress, 0) / updated.length;
        setOverallProgress(totalProgress);

        return updated;
      });
    };

    const interval = setInterval(simulateSync, 800);

    return () => clearInterval(interval);
  }, [syncSources.length]);

  const allComplete = syncSources.every((s) => s.status === "complete");
  const hasErrors = syncSources.some((s) => s.status === "error");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-accent-foreground" />;
      case "syncing":
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-sync-progress">
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
            <Heart className="h-5 w-5 text-accent-foreground" />
          </div>
          <span className="text-xl font-semibold">Tabula Medica</span>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 rounded-full bg-accent/50 flex items-center justify-center mb-4">
            {isSyncing ? (
              <RefreshCw className="h-8 w-8 text-accent-foreground animate-spin" />
            ) : allComplete ? (
              <CheckCircle2 className="h-8 w-8 text-accent-foreground" />
            ) : (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
          </div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-sync-title">
            {isSyncing 
              ? "Syncing Your Health Records" 
              : allComplete 
                ? "Sync Complete!" 
                : "Sync Finished with Issues"
            }
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            {isSyncing
              ? "We're securely retrieving your health data from connected providers..."
              : allComplete
                ? "All your health records are now available."
                : "Some records couldn't be synced. You can try again later."
            }
          </p>
        </div>

        <Card className="mb-6" data-testid="card-overall-progress">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm text-muted-foreground">
                {Math.round(overallProgress)}%
              </span>
            </div>
            <Progress value={overallProgress} className="h-2" data-testid="progress-overall" />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {syncSources.map((source) => (
            <Card key={source.connectionId} data-testid={`card-source-${source.connectionId}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="h-3 w-3 rounded-full shrink-0" 
                      style={{ backgroundColor: source.color }}
                    />
                    <div>
                      <CardTitle className="text-base">{source.name}</CardTitle>
                      <CardDescription>{source.platform}</CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant={source.status === "complete" ? "secondary" : "outline"}
                    data-testid={`badge-status-${source.connectionId}`}
                  >
                    {getStatusIcon(source.status)}
                    <span className="ml-1 capitalize">{source.status}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={source.overallProgress} className="h-1.5 mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {source.steps.map((step) => (
                    <div 
                      key={step.id}
                      className={`flex items-center gap-2 p-2 rounded text-sm ${
                        step.status === "complete" ? "bg-accent/30" : 
                        step.status === "syncing" ? "bg-muted" : 
                        "bg-muted/30"
                      }`}
                      data-testid={`step-${source.connectionId}-${step.id}`}
                    >
                      {step.status === "syncing" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : step.status === "complete" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-accent-foreground" />
                      ) : (
                        <step.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className={step.status === "pending" ? "text-muted-foreground" : ""}>
                        {step.label}
                      </span>
                      {step.count !== undefined && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {step.count}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {syncSources.length === 0 && (
            <Card data-testid="card-no-sources">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No health data sources connected yet.
                </p>
                <Button onClick={() => setLocation("/data-sources")} data-testid="button-connect">
                  Connect Your Records
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isSyncing ? (
            <Button variant="outline" disabled data-testid="button-continue-disabled">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Please wait...
            </Button>
          ) : (
            <Button
              className="gap-2"
              size="lg"
              onClick={() => {
                const hasCompletedSetup = localStorage.getItem("tabula_setup_complete");
                setLocation(hasCompletedSetup ? "/timeline" : "/setup-wizard");
              }}
              data-testid="button-continue"
            >
              {localStorage.getItem("tabula_setup_complete") ? "View Your Health Timeline" : "Complete Your Profile"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Your data is encrypted and stored securely. Only you can access it.
        </p>
      </main>
    </div>
  );
}
