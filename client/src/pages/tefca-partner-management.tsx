import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Network,
  Plus,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  Loader2,
  Power,
  PowerOff,
  TestTube,
  Globe,
  Shield,
  Clock,
  Server,
  Trash2,
  AlertTriangle,
  Users,
} from "lucide-react";

interface PartnerMetrics {
  qhinId: string;
  name: string;
  status: string;
  capabilities: string[];
  participantCount: number;
  certificationDate: string;
  lastHealthCheck: string;
  totalExchanges: number;
  successfulExchanges: number;
  successRate: number;
  avgLatencyMs: number;
  documentsExchanged: number;
  lastExchangeAt: string | null;
}

interface ConnectionTestResult {
  partnerId: string;
  reachable: boolean;
  latencyMs: number;
  fhirVersion: string | null;
  error: string | null;
  testedAt: string;
}

const USCDI_VERSIONS = ["R4", "R4B", "R5", "USCDI v1", "USCDI v2", "USCDI v3"] as const;
const CAPABILITIES = [
  { id: "treatment", label: "Treatment Exchange" },
  { id: "individual_access", label: "Individual Access" },
  { id: "payment", label: "Payment Exchange" },
  { id: "healthcare_operations", label: "Healthcare Operations" },
  { id: "public_health", label: "Public Health" },
  { id: "government_benefits", label: "Government Benefits" },
] as const;

const registerPartnerSchema = z.object({
  partnerId: z
    .string()
    .min(1, "Partner ID is required")
    .regex(/^[a-z0-9_]+$/, "Only lowercase letters, numbers, and underscores"),
  name: z.string().min(1, "Partner name is required"),
  endpointUrl: z.string().url("Must be a valid URL"),
  supportedUscdiVersions: z.array(z.string()).min(1, "Select at least one version"),
  capabilities: z.array(z.string()).min(1, "Select at least one capability"),
});

type RegisterPartnerForm = z.infer<typeof registerPartnerSchema>;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusIndicator({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    active: { icon: CheckCircle, color: "text-green-500", label: "Active" },
    pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
    inactive: { icon: PowerOff, color: "text-gray-400", label: "Inactive" },
    maintenance: { icon: AlertTriangle, color: "text-orange-500", label: "Maintenance" },
  };
  const { icon: Icon, color, label } = config[status] || config.inactive;
  return (
    <div className="flex items-center gap-1.5" data-testid={`status-indicator-${status}`}>
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-sm font-medium ${color}`}>{label}</span>
    </div>
  );
}

function RegisterPartnerDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<RegisterPartnerForm>({
    resolver: zodResolver(registerPartnerSchema),
    defaultValues: {
      partnerId: "",
      name: "",
      endpointUrl: "",
      supportedUscdiVersions: ["R4"],
      capabilities: ["treatment", "individual_access"],
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterPartnerForm) => {
      const res = await apiRequest("POST", "/api/tefca/partners", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Partner registered", description: `${form.getValues("name")} has been registered as a QHIN participant.` });
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
      setOpen(false);
      form.reset();
      onSuccess();
    },
    onError: (err: Error) => {
      toast({ title: "Registration failed", description: err.message, variant: "destructive" });
    },
  });

  function onSubmit(data: RegisterPartnerForm) {
    registerMutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-register-partner">
          <Plus className="h-4 w-4 mr-2" />
          Register Partner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" data-testid="dialog-register-partner">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Register QHIN Participant</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Add a new Qualified Health Information Network partner to the TEFCA exchange.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="partnerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., my_health_network"
                      {...field}
                      onChange={e => field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      data-testid="input-partner-id"
                    />
                  </FormControl>
                  <FormDescription>Lowercase letters, numbers, and underscores only</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., My Health Network" {...field} data-testid="input-partner-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endpointUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Endpoint URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.example.org" {...field} data-testid="input-endpoint-url" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supportedUscdiVersions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supported USCDI / FHIR Versions</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {USCDI_VERSIONS.map(v => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={field.value.includes(v) ? "default" : "outline"}
                        onClick={() => {
                          const next = field.value.includes(v)
                            ? field.value.filter((x: string) => x !== v)
                            : [...field.value, v];
                          field.onChange(next);
                        }}
                        data-testid={`button-version-${v.replace(/\s+/g, "-")}`}
                      >
                        {v}
                      </Button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="capabilities"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exchange Capabilities</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {CAPABILITIES.map(cap => (
                      <div key={cap.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cap-${cap.id}`}
                          checked={field.value.includes(cap.id)}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...field.value, cap.id]
                              : field.value.filter((x: string) => x !== cap.id);
                            field.onChange(next);
                          }}
                          data-testid={`checkbox-capability-${cap.id}`}
                        />
                        <label htmlFor={`cap-${cap.id}`} className="text-sm cursor-pointer">
                          {cap.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-register">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={registerMutation.isPending}
                data-testid="button-submit-register"
              >
                {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PartnerRow({ partner }: { partner: PartnerMetrics }) {
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/tefca/partners/${partner.qhinId}/test`);
      return res.json() as Promise<ConnectionTestResult>;
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: data.reachable ? "Connection successful" : "Connection failed",
        description: data.reachable
          ? `${partner.name} responded in ${data.latencyMs}ms`
          : `${partner.name}: ${data.error}`,
        variant: data.reachable ? "default" : "destructive",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async () => {
      const enabled = partner.status !== "active";
      const res = await apiRequest("PATCH", `/api/tefca/partners/${partner.qhinId}/toggle`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      const newStatus = partner.status === "active" ? "disabled" : "enabled";
      toast({ title: `Partner ${newStatus}`, description: `${partner.name} has been ${newStatus}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
    },
    onError: (err: Error) => {
      toast({ title: "Toggle failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/tefca/partners/${partner.qhinId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Partner removed", description: `${partner.name} has been removed.` });
      queryClient.invalidateQueries({ queryKey: ["/api/tefca/partners"] });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const isActive = partner.status === "active";

  return (
    <Card data-testid={`card-partner-${partner.qhinId}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Network className="h-5 w-5 text-primary shrink-0" />
              <h3 className="font-semibold truncate" data-testid={`text-partner-name-${partner.qhinId}`}>
                {partner.name}
              </h3>
              <StatusIndicator status={partner.status} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate" data-testid={`text-partner-id-${partner.qhinId}`}>{partner.qhinId}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span data-testid={`text-participants-${partner.qhinId}`}>{partner.participantCount.toLocaleString()} participants</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0" />
                <span data-testid={`text-certified-${partner.qhinId}`}>Certified {new Date(partner.certificationDate).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span data-testid={`text-last-check-${partner.qhinId}`}>Last check: {formatDate(partner.lastHealthCheck)}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3" data-testid={`badges-capabilities-${partner.qhinId}`}>
              {partner.capabilities.map(cap => (
                <Badge key={cap} variant="outline" className="text-xs" data-testid={`badge-capability-${partner.qhinId}-${cap}`}>
                  {cap.replace(/_/g, " ")}
                </Badge>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center p-2 rounded-md bg-muted/50" data-testid={`stats-${partner.qhinId}`}>
              <div>
                <p className="text-xs text-muted-foreground">Exchanges</p>
                <p className="font-semibold" data-testid={`text-exchanges-${partner.qhinId}`}>{partner.totalExchanges}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className={`font-semibold ${partner.successRate >= 95 ? "text-green-600 dark:text-green-400" : partner.successRate >= 80 ? "text-yellow-600" : "text-red-600"}`} data-testid={`text-success-${partner.qhinId}`}>
                  {partner.successRate.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Latency</p>
                <p className="font-semibold" data-testid={`text-latency-${partner.qhinId}`}>{partner.avgLatencyMs}ms</p>
              </div>
            </div>

            {testResult && (
              <div className={`mt-3 p-2 rounded-md text-sm flex items-center gap-2 ${testResult.reachable ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"}`} data-testid={`test-result-${partner.qhinId}`}>
                {testResult.reachable ? <Wifi className="h-4 w-4 shrink-0" /> : <WifiOff className="h-4 w-4 shrink-0" />}
                <span data-testid={`text-test-result-${partner.qhinId}`}>
                  {testResult.reachable
                    ? `Reachable (${testResult.latencyMs}ms, FHIR ${testResult.fhirVersion})`
                    : `Unreachable: ${testResult.error}`}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 shrink-0" data-testid={`actions-${partner.qhinId}`}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              data-testid={`button-test-${partner.qhinId}`}
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
              <span className="ml-1.5">Test</span>
            </Button>
            <Button
              size="sm"
              variant={isActive ? "outline" : "default"}
              onClick={() => toggleMutation.mutate()}
              disabled={toggleMutation.isPending}
              data-testid={`button-toggle-${partner.qhinId}`}
            >
              {toggleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isActive ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              <span className="ml-1.5">{isActive ? "Disable" : "Enable"}</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Remove ${partner.name}? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-${partner.qhinId}`}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1.5">Remove</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TefcaPartnerManagementPage() {
  const { data: partners, isLoading } = useQuery<PartnerMetrics[]>({
    queryKey: ["/api/tefca/partners"],
  });

  const activeCount = partners?.filter(p => p.status === "active").length || 0;
  const pendingCount = partners?.filter(p => p.status === "pending").length || 0;
  const inactiveCount = partners?.filter(p => p.status === "inactive").length || 0;
  const totalPartners = partners?.length || 0;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Server className="h-6 w-6 text-primary" />
            TEFCA Partner Management
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            Register, test, and manage QHIN participant connections for health data exchange
          </p>
        </div>
        <RegisterPartnerDialog onSuccess={() => {}} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="card-stat-total">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Partners</span>
            </div>
            <p className="text-2xl font-bold mt-1" data-testid="text-total-partners">{totalPartners}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-active">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400" data-testid="text-active-count">{activeCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-pending">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Pending</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-yellow-600 dark:text-yellow-400" data-testid="text-pending-count">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-inactive">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-muted-foreground">Inactive</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-muted-foreground" data-testid="text-inactive-count">{inactiveCount}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {isLoading ? (
        <div className="flex items-center justify-center py-16" data-testid="loading-partners">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : partners && partners.length > 0 ? (
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="space-y-4" data-testid="partner-list">
            {partners.map(partner => (
              <PartnerRow key={partner.qhinId} partner={partner} />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="empty-state">
          <Network className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No partners registered</p>
          <p className="text-sm">Click "Register Partner" to add your first QHIN participant.</p>
        </div>
      )}
    </div>
  );
}
