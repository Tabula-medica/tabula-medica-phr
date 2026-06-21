import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Bell,
  Plus,
  Trash2,
  Edit,
  Settings,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  User,
  Mail,
  MessageSquare,
  ToggleLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  X,
  Check,
  ExternalLink,
  Zap
} from "lucide-react";

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: string;
  resourceType: string;
  enabled: boolean;
  severity: "critical" | "high" | "medium" | "low" | "info";
  conditions: Array<{
    field: string;
    operator: string;
    value: number | string | boolean;
    secondValue?: number;
    timeWindow?: string;
  }>;
  conditionLogic: "AND" | "OR";
  useCoreProfile?: string;
  loincCode?: string;
  channels: string[];
  cooldownMinutes: number;
  createdAt: string;
}

interface AlertNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  patientId: string;
  patientName?: string;
  resourceType: string;
  resourceId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  message: string;
  details: Record<string, any>;
  useCoreContext?: {
    profile: string;
    interpretation?: string;
    normalRange?: string;
  };
  channels: string[];
  channelStatus: Record<string, string>;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

interface AlertStatistics {
  totalRules: number;
  activeRules: number;
  totalAlerts: number;
  unacknowledged: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byChannel: Record<string, { sent: number; failed: number }>;
  recentAlerts: AlertNotification[];
  topTriggeredRules: { ruleId: string; ruleName: string; count: number }[];
}

const SEVERITY_CONFIG = {
  critical: { color: "destructive", icon: AlertCircle, label: "Critical" },
  high: { color: "destructive", icon: AlertTriangle, label: "High" },
  medium: { color: "secondary", icon: AlertTriangle, label: "Medium" },
  low: { color: "outline", icon: Bell, label: "Low" },
  info: { color: "outline", icon: Bell, label: "Info" }
} as const;

const RULE_TYPES = [
  { value: "vital_sign_threshold", label: "Vital Sign Threshold", icon: Activity },
  { value: "vital_sign_change", label: "Vital Sign Change", icon: Zap },
  { value: "condition_new", label: "New Condition", icon: Heart },
  { value: "condition_severity", label: "Condition Severity", icon: AlertTriangle },
  { value: "lab_critical", label: "Critical Lab Value", icon: Droplets },
  { value: "lab_trend", label: "Lab Trend", icon: Activity },
  { value: "medication_interaction", label: "Medication Interaction", icon: AlertCircle },
  { value: "medication_adherence", label: "Medication Adherence", icon: Clock },
  { value: "custom", label: "Custom Rule", icon: Settings }
];

const OPERATORS = [
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less or equal" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
  { value: "between", label: "Between" },
  { value: "change_by", label: "Change by" }
];

const CHANNELS = [
  { value: "in_app", label: "In-App", icon: Bell },
  { value: "email", label: "Email", icon: Mail },
  { value: "sms", label: "SMS", icon: MessageSquare }
];

function SeverityBadge({ severity }: { severity: keyof typeof SEVERITY_CONFIG }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <Badge variant={config.color as any} className="gap-1">
      <config.icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function RuleTypeIcon({ type }: { type: string }) {
  const ruleType = RULE_TYPES.find(r => r.value === type);
  const Icon = ruleType?.icon || Settings;
  return <Icon className="w-4 h-4" />;
}

function StatCard({ title, value, icon: Icon, trend, className }: {
  title: string;
  value: string | number;
  icon: any;
  trend?: { value: number; positive: boolean };
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {trend && (
              <p className={`text-xs ${trend.positive ? "text-green-600" : "text-destructive"}`}>
                {trend.positive ? "+" : ""}{trend.value}% from last week
              </p>
            )}
          </div>
          <div className="p-3 rounded-full bg-primary/10">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FHIRAlertingDashboard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AlertNotification | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterAcknowledged, setFilterAcknowledged] = useState<string>("all");

  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    type: "vital_sign_threshold",
    resourceType: "Observation",
    severity: "high" as "critical" | "high" | "medium" | "low" | "info",
    conditions: [{ field: "", operator: "gt", value: "" as any }],
    conditionLogic: "AND" as "AND" | "OR",
    loincCode: "",
    channels: ["in_app"],
    cooldownMinutes: 60
  });

  const { data: statistics, isLoading: statsLoading } = useQuery<AlertStatistics>({
    queryKey: ["/api/fhir-alerting/statistics"]
  });

  const { data: rules, isLoading: rulesLoading } = useQuery<AlertRule[]>({
    queryKey: ["/api/fhir-alerting/rules"]
  });

  const { data: notifications, isLoading: notificationsLoading } = useQuery<AlertNotification[]>({
    queryKey: ["/api/fhir-alerting/notifications"]
  });

  const { data: useCoreProfiles } = useQuery({
    queryKey: ["/api/fhir-alerting/us-core-profiles"]
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof newRule) => {
      const response = await apiRequest("POST", "/api/fhir-alerting/rules", {
        ...data,
        enabled: true,
        createdBy: "user"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/statistics"] });
      setShowCreateRule(false);
      setNewRule({
        name: "",
        description: "",
        type: "vital_sign_threshold",
        resourceType: "Observation",
        severity: "high",
        conditions: [{ field: "", operator: "gt", value: "" }],
        conditionLogic: "AND",
        loincCode: "",
        channels: ["in_app"],
        cooldownMinutes: 60
      });
      toast({ title: "Alert rule created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create rule", description: error.message, variant: "destructive" });
    }
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/fhir-alerting/rules/${id}/toggle`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/statistics"] });
      toast({ title: "Rule toggled" });
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/fhir-alerting/rules/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/statistics"] });
      toast({ title: "Rule deleted" });
    }
  });

  const acknowledgeNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/fhir-alerting/notifications/${id}/acknowledge`, {
        userId: "current-user"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/statistics"] });
      setSelectedNotification(null);
      toast({ title: "Alert acknowledged" });
    }
  });

  const acknowledgeAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/fhir-alerting/notifications/acknowledge-all", {
        userId: "current-user"
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting/statistics"] });
      toast({ title: `${data.acknowledged} alerts acknowledged` });
    }
  });

  const filteredNotifications = notifications?.filter(n => {
    if (filterSeverity !== "all" && n.severity !== filterSeverity) return false;
    if (filterAcknowledged === "acknowledged" && !n.acknowledged) return false;
    if (filterAcknowledged === "unacknowledged" && n.acknowledged) return false;
    return true;
  });

  const handleCreateRule = () => {
    if (!newRule.name || newRule.conditions.some(c => !c.field || c.value === "")) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createRuleMutation.mutate(newRule);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            FHIR Alerting System
          </h1>
          <p className="text-muted-foreground">
            Intelligent alerts for vital signs, conditions, and lab values with US Core integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/fhir-alerting"] });
            }}
            data-testid="btn-refresh-alerts"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateRule(true)} data-testid="btn-create-rule">
            <Plus className="w-4 h-4 mr-2" />
            Create Rule
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Active Rules"
            value={statistics.activeRules}
            icon={Settings}
          />
          <StatCard
            title="Total Alerts"
            value={statistics.totalAlerts}
            icon={Bell}
          />
          <StatCard
            title="Unacknowledged"
            value={statistics.unacknowledged}
            icon={AlertTriangle}
            className={statistics.unacknowledged > 0 ? "border-amber-500/50" : ""}
          />
          <StatCard
            title="Critical Alerts"
            value={statistics.bySeverity?.critical || 0}
            icon={AlertCircle}
            className={statistics.bySeverity?.critical > 0 ? "border-destructive/50" : ""}
          />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Activity className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
            {statistics?.unacknowledged ? (
              <Badge variant="destructive" className="ml-2">{statistics.unacknowledged}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="w-4 h-4 mr-2" />
            Alert Rules
          </TabsTrigger>
          <TabsTrigger value="us-core" data-testid="tab-us-core">
            <Heart className="w-4 h-4 mr-2" />
            US Core Profiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>Latest notifications requiring attention</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {statistics?.recentAlerts?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No recent alerts</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {statistics?.recentAlerts?.map(alert => (
                        <div
                          key={alert.id}
                          className="flex items-start gap-3 p-3 rounded-lg hover-elevate cursor-pointer"
                          onClick={() => setSelectedNotification(alert)}
                          data-testid={`alert-${alert.id}`}
                        >
                          <SeverityBadge severity={alert.severity} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{alert.title}</p>
                            <p className="text-sm text-muted-foreground truncate">
                              {alert.patientName || alert.patientId}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(alert.createdAt).toLocaleString()}
                            </p>
                          </div>
                          {!alert.acknowledged && (
                            <Badge variant="outline" className="text-xs">New</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Triggered Rules</CardTitle>
                <CardDescription>Most frequently triggered alert rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {statistics?.topTriggeredRules?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Zap className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>No triggered rules yet</p>
                    </div>
                  ) : (
                    statistics?.topTriggeredRules?.map((rule, i) => (
                      <div key={rule.ruleId} className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-muted-foreground w-8">
                          #{i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{rule.ruleName}</p>
                        </div>
                        <Badge variant="secondary">{rule.count} triggers</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Alerts by Severity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(statistics?.bySeverity || {}).map(([severity, count]) => (
                  <div key={severity} className="flex items-center gap-2">
                    <SeverityBadge severity={severity as any} />
                    <span className="text-lg font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-[150px]" data-testid="filter-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterAcknowledged} onValueChange={setFilterAcknowledged}>
                <SelectTrigger className="w-[180px]" data-testid="filter-acknowledged">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {statistics?.unacknowledged ? (
              <Button
                variant="outline"
                onClick={() => acknowledgeAllMutation.mutate()}
                disabled={acknowledgeAllMutation.isPending}
                data-testid="btn-acknowledge-all"
              >
                <Check className="w-4 h-4 mr-2" />
                Acknowledge All
              </Button>
            ) : null}
          </div>

          {notificationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : filteredNotifications?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No notifications</p>
                <p className="text-muted-foreground">
                  Alerts will appear here when rules are triggered
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications?.map(notification => (
                <Card
                  key={notification.id}
                  className={`hover-elevate cursor-pointer ${!notification.acknowledged ? "bg-amber-500/5" : ""}`}
                  onClick={() => setSelectedNotification(notification)}
                  data-testid={`notification-${notification.id}`}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-4">
                      <SeverityBadge severity={notification.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{notification.title}</h3>
                          {!notification.acknowledged && (
                            <Badge variant="outline" className="text-xs">New</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {notification.patientName || notification.patientId}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(notification.createdAt).toLocaleString()}
                          </span>
                          <div className="flex gap-1">
                            {notification.channels.map(ch => {
                              const channel = CHANNELS.find(c => c.value === ch);
                              return channel ? (
                                <Badge key={ch} variant="secondary" className="text-xs gap-1">
                                  <channel.icon className="w-3 h-3" />
                                  {notification.channelStatus[ch]}
                                </Badge>
                              ) : null;
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!notification.acknowledged && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              acknowledgeNotificationMutation.mutate(notification.id);
                            }}
                            data-testid={`btn-ack-${notification.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          {rulesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : rules?.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-lg font-medium">No alert rules configured</p>
                <p className="text-muted-foreground mb-4">
                  Create rules to monitor vital signs, conditions, and lab values
                </p>
                <Button onClick={() => setShowCreateRule(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rule
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules?.map(rule => (
                <Card key={rule.id} className="hover-elevate">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <RuleTypeIcon type={rule.type} />
                        <CardTitle className="text-lg">{rule.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => toggleRuleMutation.mutate(rule.id)}
                          data-testid={`switch-rule-${rule.id}`}
                        />
                      </div>
                    </div>
                    <CardDescription>{rule.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <SeverityBadge severity={rule.severity} />
                        <Badge variant="outline">{rule.resourceType}</Badge>
                        {rule.loincCode && (
                          <Badge variant="secondary">LOINC: {rule.loincCode}</Badge>
                        )}
                      </div>

                      <div className="text-sm">
                        <p className="text-muted-foreground">Conditions:</p>
                        <div className="mt-1 space-y-1">
                          {rule.conditions.map((c, i) => (
                            <p key={i} className="font-mono text-xs">
                              {c.field} {c.operator} {String(c.value)}
                              {i < rule.conditions.length - 1 && (
                                <span className="text-primary ml-2">{rule.conditionLogic}</span>
                              )}
                            </p>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {rule.channels.map(ch => {
                          const channel = CHANNELS.find(c => c.value === ch);
                          return channel ? (
                            <Badge key={ch} variant="outline" className="gap-1">
                              <channel.icon className="w-3 h-3" />
                              {channel.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">
                          Cooldown: {rule.cooldownMinutes}m
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          data-testid={`btn-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="us-core" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>US Core Vital Signs Profiles</CardTitle>
              <CardDescription>
                Standard thresholds based on US Core Implementation Guide
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: "Blood Pressure", loinc: "85354-9", icon: Heart, thresholds: "Critical: >180/120 or <70/40" },
                  { name: "Heart Rate", loinc: "8867-4", icon: Activity, thresholds: "Critical: >150 or <40 bpm" },
                  { name: "Respiratory Rate", loinc: "9279-1", icon: Wind, thresholds: "Critical: >30 or <8 /min" },
                  { name: "Body Temperature", loinc: "8310-5", icon: Thermometer, thresholds: "Critical: >40 or <35 C" },
                  { name: "Oxygen Saturation", loinc: "59408-5", icon: Droplets, thresholds: "Critical: <88%" },
                  { name: "BMI", loinc: "39156-5", icon: User, thresholds: "High: >30 kg/m2" }
                ].map(vital => (
                  <Card key={vital.loinc} className="hover-elevate">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <vital.icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{vital.name}</p>
                          <p className="text-xs text-muted-foreground">LOINC: {vital.loinc}</p>
                        </div>
                      </div>
                      <p className="text-sm mt-2 text-muted-foreground">{vital.thresholds}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>High-Risk Condition Codes</CardTitle>
              <CardDescription>
                SNOMED CT codes monitored for new diagnoses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { code: "22298006", display: "Myocardial infarction" },
                  { code: "230690007", display: "Cerebrovascular accident (Stroke)" },
                  { code: "84114007", display: "Heart failure" },
                  { code: "73211009", display: "Diabetes mellitus" },
                  { code: "38341003", display: "Hypertensive disorder" },
                  { code: "13645005", display: "COPD" },
                  { code: "709044004", display: "Chronic kidney disease" },
                  { code: "363406005", display: "Malignant neoplasm" }
                ].map(cond => (
                  <div key={cond.code} className="flex items-center gap-2 p-2 rounded border">
                    <Badge variant="outline" className="font-mono text-xs">
                      {cond.code}
                    </Badge>
                    <span className="text-sm">{cond.display}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Rule Dialog */}
      <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Define conditions that will trigger alerts for FHIR resources
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Critical Blood Pressure"
                  data-testid="input-rule-name"
                />
              </div>
              <div>
                <Label>Rule Type</Label>
                <Select
                  value={newRule.type}
                  onValueChange={(v) => setNewRule({ ...newRule, type: v })}
                >
                  <SelectTrigger data-testid="select-rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <t.icon className="w-4 h-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={newRule.description}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                placeholder="Describe when this rule should trigger..."
                data-testid="input-rule-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Resource Type</Label>
                <Select
                  value={newRule.resourceType}
                  onValueChange={(v) => setNewRule({ ...newRule, resourceType: v })}
                >
                  <SelectTrigger data-testid="select-resource-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Observation">Observation</SelectItem>
                    <SelectItem value="Condition">Condition</SelectItem>
                    <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
                    <SelectItem value="DiagnosticReport">DiagnosticReport</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Severity</Label>
                <Select
                  value={newRule.severity}
                  onValueChange={(v: any) => setNewRule({ ...newRule, severity: v })}
                >
                  <SelectTrigger data-testid="select-severity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>LOINC Code (for Observations)</Label>
              <Input
                value={newRule.loincCode}
                onChange={(e) => setNewRule({ ...newRule, loincCode: e.target.value })}
                placeholder="e.g., 8867-4 (Heart Rate)"
                data-testid="input-loinc-code"
              />
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Conditions</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={newRule.conditionLogic}
                    onValueChange={(v: "AND" | "OR") => setNewRule({ ...newRule, conditionLogic: v })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewRule({
                      ...newRule,
                      conditions: [...newRule.conditions, { field: "", operator: "gt", value: "" }]
                    })}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {newRule.conditions.map((condition, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={condition.field}
                      onChange={(e) => {
                        const conds = [...newRule.conditions];
                        conds[i].field = e.target.value;
                        setNewRule({ ...newRule, conditions: conds });
                      }}
                      placeholder="Field path (e.g., valueQuantity.value)"
                      className="flex-1"
                      data-testid={`input-condition-field-${i}`}
                    />
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => {
                        const conds = [...newRule.conditions];
                        conds[i].operator = v;
                        setNewRule({ ...newRule, conditions: conds });
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map(op => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={String(condition.value)}
                      onChange={(e) => {
                        const conds = [...newRule.conditions];
                        conds[i].value = isNaN(Number(e.target.value)) 
                          ? e.target.value 
                          : Number(e.target.value);
                        setNewRule({ ...newRule, conditions: conds });
                      }}
                      placeholder="Value"
                      className="w-24"
                      data-testid={`input-condition-value-${i}`}
                    />
                    {newRule.conditions.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const conds = newRule.conditions.filter((_, idx) => idx !== i);
                          setNewRule({ ...newRule, conditions: conds });
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Notification Channels</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CHANNELS.map(ch => (
                    <Badge
                      key={ch.value}
                      variant={newRule.channels.includes(ch.value) ? "default" : "outline"}
                      className="cursor-pointer gap-1"
                      onClick={() => {
                        const channels = newRule.channels.includes(ch.value)
                          ? newRule.channels.filter(c => c !== ch.value)
                          : [...newRule.channels, ch.value];
                        if (channels.length > 0) {
                          setNewRule({ ...newRule, channels });
                        }
                      }}
                      data-testid={`badge-channel-${ch.value}`}
                    >
                      <ch.icon className="w-3 h-3" />
                      {ch.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Cooldown (minutes)</Label>
                <Input
                  type="number"
                  value={newRule.cooldownMinutes}
                  onChange={(e) => setNewRule({ ...newRule, cooldownMinutes: parseInt(e.target.value) || 0 })}
                  min={0}
                  max={1440}
                  data-testid="input-cooldown"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum time between alerts for same patient
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateRule(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateRule}
              disabled={createRuleMutation.isPending}
              data-testid="btn-submit-rule"
            >
              {createRuleMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notification Detail Dialog */}
      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent className="max-w-lg">
          {selectedNotification && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={selectedNotification.severity} />
                  {!selectedNotification.acknowledged && (
                    <Badge variant="outline">Unacknowledged</Badge>
                  )}
                </div>
                <DialogTitle>{selectedNotification.title}</DialogTitle>
                <DialogDescription>{selectedNotification.message}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Patient</p>
                    <p className="font-medium">
                      {selectedNotification.patientName || selectedNotification.patientId}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Resource</p>
                    <p className="font-medium">
                      {selectedNotification.resourceType}/{selectedNotification.resourceId}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Triggered At</p>
                    <p className="font-medium">
                      {new Date(selectedNotification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rule</p>
                    <p className="font-medium">{selectedNotification.ruleName}</p>
                  </div>
                </div>

                {selectedNotification.useCoreContext && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">US Core Context</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Interpretation:</span>{" "}
                        {selectedNotification.useCoreContext.interpretation}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Normal Range:</span>{" "}
                        {selectedNotification.useCoreContext.normalRange}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {Object.keys(selectedNotification.details).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                        {JSON.stringify(selectedNotification.details, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {selectedNotification.acknowledged && (
                  <div className="text-sm text-muted-foreground">
                    Acknowledged by {selectedNotification.acknowledgedBy} at{" "}
                    {new Date(selectedNotification.acknowledgedAt!).toLocaleString()}
                  </div>
                )}
              </div>

              <DialogFooter>
                {!selectedNotification.acknowledged && (
                  <Button
                    onClick={() => acknowledgeNotificationMutation.mutate(selectedNotification.id)}
                    disabled={acknowledgeNotificationMutation.isPending}
                    data-testid="btn-ack-detail"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Acknowledge
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedNotification(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
