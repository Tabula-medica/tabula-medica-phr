import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Pill,
  FlaskConical,
  Clock,
  AlertTriangle,
  Heart,
  Activity,
  Shield,
} from "lucide-react";

interface HealthRecordsSummaryData {
  summary: {
    activeConditions: number;
    activeMedications: number;
    totalLabResults: number;
    abnormalLabResults: number;
    pendingOrders: number;
  };
  conditions: Array<{
    id: string;
    name: string;
    status: string;
    code: string;
    onsetDate: string;
    category: string;
    severity?: string;
  }>;
  medications: Array<{
    id: string;
    name: string;
    status: string;
    dosage: string;
    frequency: string;
    prescribedBy: string;
    startDate: string;
    category?: string;
  }>;
  recentAbnormalLabs: Array<{
    id: string;
    testName: string;
    value: string;
    unit: string;
    referenceRange: string;
    interpretation: string;
    reportedAt: string;
  }>;
  upcomingOrders: Array<{
    id: string;
    tests: string[];
    status: string;
    providerName: string;
    estimatedCompletionAt: string;
  }>;
  disclaimer: string;
}

export function HealthRecordsSummaryCard({ patientId = "patient-001" }: { patientId?: string }) {
  const { data, isLoading } = useQuery<HealthRecordsSummaryData>({
    queryKey: [`/api/patient-portal/${patientId}/health-records-summary`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!data) return null;

  const { summary, conditions, medications, recentAbnormalLabs, upcomingOrders } = data;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="health-summary-stats">
        <Card data-testid="stat-conditions">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Heart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.activeConditions}</p>
              <p className="text-xs text-muted-foreground">Conditions</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-medications">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Pill className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.activeMedications}</p>
              <p className="text-xs text-muted-foreground">Medications</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-lab-results">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalLabResults}</p>
              <p className="text-xs text-muted-foreground">Lab Results</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-abnormal-labs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.abnormalLabResults}</p>
              <p className="text-xs text-muted-foreground">Abnormal</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-pending-orders">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.pendingOrders}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card data-testid="card-active-conditions">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Heart className="h-5 w-5 text-blue-500" />
              Active Conditions
            </CardTitle>
            <CardDescription>Your current diagnoses and health conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              <div className="space-y-2">
                {conditions.length > 0 ? conditions.map((cond) => (
                  <div key={cond.id} className="p-3 rounded-lg border" data-testid={`condition-${cond.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" data-testid={`text-condition-name-${cond.id}`}>{cond.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cond.code} | Since {cond.onsetDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {cond.severity && (
                          <Badge variant="outline" className="text-xs">{cond.severity}</Badge>
                        )}
                        <Badge variant="secondary" className="text-xs">{cond.category}</Badge>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Heart className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No active conditions on record</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card data-testid="card-active-medications">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5 text-purple-500" />
              Active Medications
            </CardTitle>
            <CardDescription>Your current prescription medications</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px]">
              <div className="space-y-2">
                {medications.length > 0 ? medications.map((med) => (
                  <div key={med.id} className="p-3 rounded-lg border" data-testid={`medication-${med.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" data-testid={`text-med-name-${med.id}`}>{med.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {med.dosage} | {med.frequency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prescribed by {med.prescribedBy}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{med.category || "General"}</Badge>
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <Pill className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No active medications on record</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {recentAbnormalLabs.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800" data-testid="card-abnormal-labs-summary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Recent Abnormal Lab Results
              <Badge variant="secondary" className="ml-1">{recentAbnormalLabs.length}</Badge>
            </CardTitle>
            <CardDescription>Lab results that may need follow-up with your provider</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentAbnormalLabs.map((lab) => (
                <div key={lab.id} className="p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20" data-testid={`abnormal-lab-${lab.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{lab.testName}</p>
                      <p className="text-xs text-muted-foreground">Ref: {lab.referenceRange}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                        {lab.value} {lab.unit}
                      </span>
                      <Badge variant={lab.interpretation === "critical" ? "destructive" : "outline"} className="ml-2 text-xs">
                        {lab.interpretation}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {upcomingOrders.length > 0 && (
        <Card data-testid="card-upcoming-orders-summary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-teal-500" />
              Pending Lab Orders
            </CardTitle>
            <CardDescription>Tests ordered by your providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingOrders.map((order) => (
                <div key={order.id} className="p-3 rounded-lg border" data-testid={`pending-order-${order.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{order.tests.join(", ")}</p>
                      <p className="text-xs text-muted-foreground">{order.providerName}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {order.status === "in-progress" ? "In Progress" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="p-2 rounded bg-muted/50">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {data.disclaimer}
        </p>
      </div>
    </div>
  );
}
