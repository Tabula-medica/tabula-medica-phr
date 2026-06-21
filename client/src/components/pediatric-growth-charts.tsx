import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Baby, Ruler, Scale, CircleDot, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertGrowthMeasurementSchema } from "@shared/schema";
import type { GrowthMeasurement, GrowthPercentilePoint, GrowthChartType, GrowthMeasurementSex } from "@shared/schema";
import { z } from "zod";

const chartTypeConfig: Record<GrowthChartType, { label: string; unit: string; icon: typeof Scale; measurementKey: keyof GrowthMeasurement }> = {
  weight_for_age: { label: "Weight-for-Age", unit: "kg", icon: Scale, measurementKey: "weightKg" },
  height_for_age: { label: "Height-for-Age", unit: "cm", icon: Ruler, measurementKey: "heightCm" },
  bmi_for_age: { label: "BMI-for-Age", unit: "kg/m²", icon: TrendingUp, measurementKey: "bmi" },
  head_circumference_for_age: { label: "Head Circumference", unit: "cm", icon: CircleDot, measurementKey: "headCircumferenceCm" },
};

const addMeasurementSchema = z.object({
  ageMonths: z.string().min(1, "Age is required"),
  sex: z.enum(["male", "female"]),
  weightKg: z.string().optional(),
  heightCm: z.string().optional(),
  headCircumferenceCm: z.string().optional(),
  measuredAt: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type AddMeasurementFormValues = z.infer<typeof addMeasurementSchema>;

function AddMeasurementDialog({ patientId, onSuccess }: { patientId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<AddMeasurementFormValues>({
    resolver: zodResolver(addMeasurementSchema),
    defaultValues: {
      ageMonths: "",
      sex: "male",
      weightKg: "",
      heightCm: "",
      headCircumferenceCm: "",
      measuredAt: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/growth-vitals/growth-measurements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/growth-vitals/growth-measurements?patientId=${patientId}`] });
      toast({ title: "Measurement recorded", description: "Growth measurement has been saved." });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save measurement.", variant: "destructive" });
    },
  });

  const onSubmit = (values: AddMeasurementFormValues) => {
    createMutation.mutate({
      patientId,
      ageMonths: parseInt(values.ageMonths),
      sex: values.sex,
      weightKg: values.weightKg ? parseFloat(values.weightKg) : null,
      heightCm: values.heightCm ? parseFloat(values.heightCm) : null,
      headCircumferenceCm: values.headCircumferenceCm ? parseFloat(values.headCircumferenceCm) : null,
      measuredAt: values.measuredAt,
      notes: values.notes || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-growth-measurement">
          <Plus className="h-4 w-4 mr-2" />
          Add Measurement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Growth Measurement</DialogTitle>
          <DialogDescription>Record a new growth measurement from a pediatric checkup.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ageMonths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age (months)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="12" {...field} data-testid="input-age-months" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sex</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-growth-sex">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="weightKg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="10.5" {...field} data-testid="input-weight-kg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="heightCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="75.0" {...field} data-testid="input-height-cm" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="headCircumferenceCm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Head Circ. (cm)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="46.0" {...field} data-testid="input-head-circ" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="measuredAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-measurement-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Visit notes..." className="resize-none" {...field} data-testid="input-growth-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-measurement">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-growth-measurement">
                {createMutation.isPending ? "Saving..." : "Save Measurement"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function GrowthChart({ chartType, sex, measurements }: {
  chartType: GrowthChartType;
  sex: GrowthMeasurementSex;
  measurements: GrowthMeasurement[];
}) {
  const config = chartTypeConfig[chartType];

  const { data: percentileData, isLoading } = useQuery<{ percentiles: GrowthPercentilePoint[] }>({
    queryKey: [`/api/growth-vitals/growth-percentiles?chartType=${chartType}&sex=${sex}`],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const percentiles = percentileData?.percentiles || [];
  if (percentiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No percentile data available for this chart type.
      </div>
    );
  }

  const patientPoints = measurements
    .map((m) => ({
      ageMonths: m.ageMonths,
      value: m[config.measurementKey] as number | null,
    }))
    .filter((p) => p.value !== null);

  const allAges = new Set([...percentiles.map((p) => p.ageMonths), ...patientPoints.map((p) => p.ageMonths)]);
  const sortedAges = Array.from(allAges).sort((a, b) => a - b);

  const chartData = sortedAges.map((age) => {
    const pct = percentiles.find((p) => p.ageMonths === age);
    const patient = patientPoints.find((p) => p.ageMonths === age);

    return {
      ageMonths: age,
      ageLabel: age < 24 ? `${age}m` : `${Math.floor(age / 12)}y`,
      p3: pct?.p3,
      p10: pct?.p10,
      p25: pct?.p25,
      p50: pct?.p50,
      p75: pct?.p75,
      p90: pct?.p90,
      p97: pct?.p97,
      patient: patient?.value,
    };
  });

  return (
    <div className="h-80" data-testid={`chart-${chartType}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="ageLabel"
            tick={{ fontSize: 11 }}
            label={{ value: "Age", position: "insideBottom", offset: -10, fontSize: 12 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            label={{ value: config.unit, angle: -90, position: "insideLeft", offset: 0, fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              return (
                <div className="bg-popover border rounded-md p-2 shadow-md text-sm">
                  <p className="font-medium mb-1">{label}</p>
                  {payload.map((entry: any) => (
                    <p key={entry.dataKey} style={{ color: entry.color }}>
                      {entry.name}: {entry.value?.toFixed(1)} {config.unit}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="p3" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.04} name="3rd" connectNulls />
          <Area type="monotone" dataKey="p97" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.04} name="97th" connectNulls />
          <Line type="monotone" dataKey="p3" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="3rd %" connectNulls />
          <Line type="monotone" dataKey="p10" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" dot={false} name="10th %" connectNulls />
          <Line type="monotone" dataKey="p25" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 2" dot={false} name="25th %" connectNulls />
          <Line type="monotone" dataKey="p50" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="50th %" connectNulls />
          <Line type="monotone" dataKey="p75" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="2 2" dot={false} name="75th %" connectNulls />
          <Line type="monotone" dataKey="p90" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="3 3" dot={false} name="90th %" connectNulls />
          <Line type="monotone" dataKey="p97" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" dot={false} name="97th %" connectNulls />
          <Line
            type="monotone"
            dataKey="patient"
            stroke="hsl(210, 90%, 50%)"
            strokeWidth={3}
            dot={{ r: 5, fill: "hsl(210, 90%, 50%)" }}
            name="Patient"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function MeasurementsTable({ measurements }: { measurements: GrowthMeasurement[] }) {
  if (measurements.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground" data-testid="text-no-measurements">
        <Baby className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No growth measurements recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="table-growth-measurements">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 pr-4">Date</th>
            <th className="text-left py-2 pr-4">Age</th>
            <th className="text-right py-2 pr-4">Weight</th>
            <th className="text-right py-2 pr-4">Height</th>
            <th className="text-right py-2 pr-4">Head Circ.</th>
            <th className="text-right py-2 pr-4">BMI</th>
            <th className="text-left py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {measurements.map((m) => (
            <tr key={m.id} className="border-b last:border-0" data-testid={`row-measurement-${m.id}`}>
              <td className="py-2 pr-4">{new Date(m.measuredAt).toLocaleDateString()}</td>
              <td className="py-2 pr-4">
                <Badge variant="outline" className="text-xs">
                  {m.ageMonths < 24 ? `${m.ageMonths} mo` : `${Math.floor(m.ageMonths / 12)}y ${m.ageMonths % 12}m`}
                </Badge>
              </td>
              <td className="text-right py-2 pr-4">{m.weightKg ? `${m.weightKg} kg` : "—"}</td>
              <td className="text-right py-2 pr-4">{m.heightCm ? `${m.heightCm} cm` : "—"}</td>
              <td className="text-right py-2 pr-4">{m.headCircumferenceCm ? `${m.headCircumferenceCm} cm` : "—"}</td>
              <td className="text-right py-2 pr-4">{m.bmi ? m.bmi.toFixed(1) : "—"}</td>
              <td className="py-2 text-muted-foreground text-xs">{m.notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PediatricGrowthCharts({ patientId = "patient-001" }: { patientId?: string }) {
  const [chartType, setChartType] = useState<GrowthChartType>("weight_for_age");
  const [sex, setSex] = useState<GrowthMeasurementSex>("male");

  const { data: measurementsData, isLoading, refetch } = useQuery<{ measurements: GrowthMeasurement[] }>({
    queryKey: [`/api/growth-vitals/growth-measurements?patientId=${patientId}`],
  });

  const measurements = measurementsData?.measurements || [];
  const latestMeasurement = measurements.length > 0 ? measurements[measurements.length - 1] : null;

  return (
    <div className="space-y-6" data-testid="container-pediatric-growth">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="text-growth-title">
            <Baby className="h-5 w-5 text-pink-500" />
            Pediatric Growth Charts
          </h3>
          <p className="text-sm text-muted-foreground">Track growth patterns against CDC percentile curves</p>
        </div>
        <AddMeasurementDialog patientId={patientId} onSuccess={() => refetch()} />
      </div>

      {latestMeasurement && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Age</p>
              <p className="text-lg font-bold" data-testid="text-latest-age">
                {latestMeasurement.ageMonths < 24
                  ? `${latestMeasurement.ageMonths} mo`
                  : `${Math.floor(latestMeasurement.ageMonths / 12)}y ${latestMeasurement.ageMonths % 12}m`}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="text-lg font-bold" data-testid="text-latest-weight">{latestMeasurement.weightKg ? `${latestMeasurement.weightKg} kg` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Height</p>
              <p className="text-lg font-bold" data-testid="text-latest-height">{latestMeasurement.heightCm ? `${latestMeasurement.heightCm} cm` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Head Circ.</p>
              <p className="text-lg font-bold" data-testid="text-latest-head">{latestMeasurement.headCircumferenceCm ? `${latestMeasurement.headCircumferenceCm} cm` : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">BMI</p>
              <p className="text-lg font-bold" data-testid="text-latest-bmi">{latestMeasurement.bmi ? latestMeasurement.bmi.toFixed(1) : "—"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card data-testid="card-growth-chart">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-base">{chartTypeConfig[chartType].label} Growth Chart</CardTitle>
              <CardDescription>CDC growth percentile curves ({sex === "male" ? "Boys" : "Girls"})</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={chartType} onValueChange={(v) => setChartType(v as GrowthChartType)}>
                <SelectTrigger className="w-[180px]" data-testid="select-chart-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weight_for_age">Weight-for-Age</SelectItem>
                  <SelectItem value="height_for_age">Height-for-Age</SelectItem>
                  <SelectItem value="bmi_for_age">BMI-for-Age</SelectItem>
                  <SelectItem value="head_circumference_for_age">Head Circumference</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sex} onValueChange={(v) => setSex(v as GrowthMeasurementSex)}>
                <SelectTrigger className="w-[120px]" data-testid="select-chart-sex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Boys</SelectItem>
                  <SelectItem value="female">Girls</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <GrowthChart chartType={chartType} sex={sex} measurements={measurements} />
          )}
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 bg-primary" />
              <span>50th percentile (median)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-0.5 border-t border-dashed border-muted-foreground" />
              <span>3rd-97th percentile range</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ background: "hsl(210, 90%, 50%)" }} />
              <span>Patient measurements</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-measurements-history">
        <CardHeader>
          <CardTitle className="text-base">Measurement History</CardTitle>
          <CardDescription>{measurements.length} measurement(s) recorded</CardDescription>
        </CardHeader>
        <CardContent>
          <MeasurementsTable measurements={measurements} />
        </CardContent>
      </Card>
    </div>
  );
}
