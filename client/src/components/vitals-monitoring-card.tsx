import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Activity, Heart, Droplet, Thermometer, Wind, Scale, Plus, AlertTriangle, CheckCircle, Clock, Loader2, TrendingUp, TrendingDown, Minus, Bell } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface VitalSign {
  id: string;
  profileId: string;
  vitalType: string;
  value: string;
  unit: string;
  recordedAt: string;
  source: string;
  deviceId?: string;
  notes?: string;
}

interface MonitoringAlert {
  id: string;
  profileId: string;
  vitalSignId?: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  threshold?: string;
  actualValue?: string;
  status: string;
  createdAt: string;
}

interface VitalThreshold {
  low?: number;
  high?: number;
  critical_low?: number;
  critical_high?: number;
  unit: string;
}

const vitalTypeConfig: Record<string, { label: string; icon: typeof Heart; unit: string; placeholder: string }> = {
  blood_pressure_systolic: { label: "Blood Pressure (Systolic)", icon: Heart, unit: "mmHg", placeholder: "120" },
  blood_pressure_diastolic: { label: "Blood Pressure (Diastolic)", icon: Heart, unit: "mmHg", placeholder: "80" },
  heart_rate: { label: "Heart Rate", icon: Activity, unit: "bpm", placeholder: "72" },
  blood_glucose: { label: "Blood Glucose", icon: Droplet, unit: "mg/dL", placeholder: "100" },
  weight: { label: "Weight", icon: Scale, unit: "lbs", placeholder: "150" },
  temperature: { label: "Temperature", icon: Thermometer, unit: "°F", placeholder: "98.6" },
  oxygen_saturation: { label: "Oxygen Saturation", icon: Wind, unit: "%", placeholder: "98" },
  respiratory_rate: { label: "Respiratory Rate", icon: Wind, unit: "breaths/min", placeholder: "16" },
};

const createVitalSchema = z.object({
  vitalType: z.string().min(1, "Select a vital type"),
  value: z.string().min(1, "Value is required"),
  notes: z.string().optional(),
});

const bloodPressureSchema = z.object({
  systolic: z.string().min(1, "Systolic is required"),
  diastolic: z.string().min(1, "Diastolic is required"),
  notes: z.string().optional(),
});

interface VitalsMonitoringCardProps {
  userId: string;
}

export function VitalsMonitoringCard({ userId }: VitalsMonitoringCardProps) {
  const { toast } = useToast();
  const [selectedVitalType, setSelectedVitalType] = useState<string>("all");
  const [showRecordDialog, setShowRecordDialog] = useState(false);
  const [recordMode, setRecordMode] = useState<"single" | "blood_pressure">("single");
  const [days, setDays] = useState(30);

  const { data: vitalsData, isLoading } = useQuery<{ success: boolean; vitals: VitalSign[]; thresholds: Record<string, VitalThreshold>; noCdsDisclaimer: string }>({
    queryKey: ["/api/health-tracking/vitals", { profileId: userId, days, vitalType: selectedVitalType !== "all" ? selectedVitalType : undefined }],
  });

  const { data: alertsData } = useQuery<{ success: boolean; alerts: MonitoringAlert[] }>({
    queryKey: ["/api/health-tracking/alerts", { profileId: userId, status: "pending" }],
  });

  const singleVitalForm = useForm<z.infer<typeof createVitalSchema>>({
    resolver: zodResolver(createVitalSchema),
    defaultValues: { vitalType: "", value: "", notes: "" },
  });

  const bpForm = useForm<z.infer<typeof bloodPressureSchema>>({
    resolver: zodResolver(bloodPressureSchema),
    defaultValues: { systolic: "", diastolic: "", notes: "" },
  });

  const recordVitalMutation = useMutation({
    mutationFn: async (data: { vitalType: string; value: string; unit: string; notes?: string }) => {
      return apiRequest("POST", "/api/health-tracking/vitals", { ...data, profileId: userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/vitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/alerts"] });
      toast({ title: "Vital recorded", description: "Your vital sign has been recorded successfully." });
      setShowRecordDialog(false);
      singleVitalForm.reset();
      bpForm.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record vital sign", variant: "destructive" });
    },
  });

  const acknowledgeAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("PATCH", `/api/health-tracking/alerts/${alertId}/acknowledge`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/alerts"] });
      toast({ title: "Alert acknowledged" });
    },
  });

  const handleRecordSingleVital = (data: z.infer<typeof createVitalSchema>) => {
    const config = vitalTypeConfig[data.vitalType];
    recordVitalMutation.mutate({
      vitalType: data.vitalType,
      value: data.value,
      unit: config?.unit || "",
      notes: data.notes,
    });
  };

  const handleRecordBloodPressure = async (data: z.infer<typeof bloodPressureSchema>) => {
    try {
      await apiRequest("POST", "/api/health-tracking/vitals/batch", {
        readings: [
          { vitalType: "blood_pressure_systolic", value: data.systolic, unit: "mmHg", notes: data.notes },
          { vitalType: "blood_pressure_diastolic", value: data.diastolic, unit: "mmHg", notes: data.notes },
        ],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/vitals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-tracking/alerts"] });
      toast({ title: "Blood pressure recorded", description: `${data.systolic}/${data.diastolic} mmHg` });
      setShowRecordDialog(false);
      bpForm.reset();
    } catch {
      toast({ title: "Error", description: "Failed to record blood pressure", variant: "destructive" });
    }
  };

  const getVitalStatus = (vitalType: string, value: number): { status: string; color: string } => {
    const thresholds = vitalsData?.thresholds?.[vitalType];
    if (!thresholds) return { status: "normal", color: "text-green-600" };

    if (thresholds.critical_high && value >= thresholds.critical_high) return { status: "critical", color: "text-red-600" };
    if (thresholds.critical_low && value <= thresholds.critical_low) return { status: "critical", color: "text-red-600" };
    if (thresholds.high && value >= thresholds.high) return { status: "elevated", color: "text-orange-600" };
    if (thresholds.low && value <= thresholds.low) return { status: "low", color: "text-yellow-600" };
    return { status: "normal", color: "text-green-600" };
  };

  const vitals = vitalsData?.vitals || [];
  const alerts = alertsData?.alerts || [];
  const thresholds = vitalsData?.thresholds || {};

  const groupedVitals = vitals.reduce((acc, v) => {
    if (!acc[v.vitalType]) acc[v.vitalType] = [];
    acc[v.vitalType].push(v);
    return acc;
  }, {} as Record<string, VitalSign[]>);

  const latestByType = Object.entries(groupedVitals).reduce((acc, [type, readings]) => {
    acc[type] = readings[0];
    return acc;
  }, {} as Record<string, VitalSign>);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Vitals Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Vitals Monitoring
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length} Alert{alerts.length > 1 ? "s" : ""}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>Track and monitor your vital signs</CardDescription>
        </div>
        <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-record-vital">
              <Plus className="h-4 w-4 mr-1" />
              Record Vital
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Vital Sign</DialogTitle>
              <DialogDescription>Enter your current vital sign reading</DialogDescription>
            </DialogHeader>
            <Tabs value={recordMode} onValueChange={(v) => setRecordMode(v as "single" | "blood_pressure")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single">Single Vital</TabsTrigger>
                <TabsTrigger value="blood_pressure">Blood Pressure</TabsTrigger>
              </TabsList>

              <TabsContent value="single">
                <Form {...singleVitalForm}>
                  <form onSubmit={singleVitalForm.handleSubmit(handleRecordSingleVital)} className="space-y-4">
                    <FormField
                      control={singleVitalForm.control}
                      name="vitalType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vital Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-vital-type">
                                <SelectValue placeholder="Select vital type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(vitalTypeConfig).map(([value, config]) => (
                                <SelectItem key={value} value={value}>
                                  {config.label} ({config.unit})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={singleVitalForm.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder={vitalTypeConfig[singleVitalForm.watch("vitalType")]?.placeholder || "Enter value"}
                              {...field}
                              data-testid="input-vital-value"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={recordVitalMutation.isPending} data-testid="button-save-vital">
                        {recordVitalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Record
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="blood_pressure">
                <Form {...bpForm}>
                  <form onSubmit={bpForm.handleSubmit(handleRecordBloodPressure)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={bpForm.control}
                        name="systolic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Systolic (mmHg)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="120" {...field} data-testid="input-systolic" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={bpForm.control}
                        name="diastolic"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diastolic (mmHg)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="80" {...field} data-testid="input-diastolic" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={recordVitalMutation.isPending} data-testid="button-save-bp">
                        {recordVitalMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Record Blood Pressure
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {alerts.slice(0, 3).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                  alert.severity === "critical" ? "bg-red-50 dark:bg-red-950 border-red-200" :
                  alert.severity === "high" ? "bg-orange-50 dark:bg-orange-950 border-orange-200" :
                  "bg-yellow-50 dark:bg-yellow-950 border-yellow-200"
                }`}
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-4 w-4 ${
                    alert.severity === "critical" ? "text-red-600" :
                    alert.severity === "high" ? "text-orange-600" : "text-yellow-600"
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                  data-testid={`button-ack-alert-${alert.id}`}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {Object.entries(latestByType).slice(0, 4).map(([type, vital]) => {
            const config = vitalTypeConfig[type];
            const Icon = config?.icon || Activity;
            const value = parseFloat(vital.value);
            const { status, color } = getVitalStatus(type, value);

            return (
              <div key={type} className="p-3 border rounded-lg" data-testid={`vital-summary-${type}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{config?.label || type}</span>
                </div>
                <p className={`text-xl font-semibold ${color}`}>
                  {vital.value} <span className="text-xs font-normal">{vital.unit}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(vital.recordedAt), { addSuffix: true })}
                </p>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Select value={selectedVitalType} onValueChange={setSelectedVitalType}>
            <SelectTrigger className="w-48" data-testid="select-filter-vital">
              <SelectValue placeholder="All vitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vitals</SelectItem>
              {Object.entries(vitalTypeConfig).map(([value, config]) => (
                <SelectItem key={value} value={value}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
            <SelectTrigger className="w-32" data-testid="select-filter-days">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedVitalType !== "all" && groupedVitals[selectedVitalType]?.length > 0 && (
          <div className="h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={[...groupedVitals[selectedVitalType]].reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="recordedAt" tickFormatter={(d) => format(new Date(d), "M/d")} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(d) => format(new Date(d), "MMM d, yyyy h:mm a")} />
                {thresholds[selectedVitalType]?.high && (
                  <ReferenceLine y={thresholds[selectedVitalType].high} stroke="orange" strokeDasharray="3 3" label="High" />
                )}
                {thresholds[selectedVitalType]?.low && (
                  <ReferenceLine y={thresholds[selectedVitalType].low} stroke="orange" strokeDasharray="3 3" label="Low" />
                )}
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {vitals.slice(0, 10).map((vital) => {
            const config = vitalTypeConfig[vital.vitalType];
            const Icon = config?.icon || Activity;
            const value = parseFloat(vital.value);
            const { status, color } = getVitalStatus(vital.vitalType, value);

            return (
              <div key={vital.id} className="flex items-center justify-between p-2 border rounded-lg" data-testid={`vital-entry-${vital.id}`}>
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{config?.label || vital.vitalType}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(vital.recordedAt), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-semibold ${color}`}>
                    {vital.value} {vital.unit}
                  </p>
                  <Badge variant={status === "normal" ? "secondary" : status === "critical" ? "destructive" : "outline"} className="text-xs">
                    {status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {vitalsData?.noCdsDisclaimer && (
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            {vitalsData.noCdsDisclaimer}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
