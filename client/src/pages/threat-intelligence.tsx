import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Eye,
  FileText,
  Target,
  Zap,
  Clock,
  ExternalLink,
  ChevronRight,
  Activity,
  Lock,
  AlertCircle,
  CheckCircle2,
  Crosshair,
  Radio
} from "lucide-react";

interface ThreatIndicator {
  id: string;
  type: string;
  value: string;
  confidence: number;
  lastSeen: string;
  source: string;
}

interface SecurityThreat {
  id: string;
  name: string;
  category: string;
  severity: string;
  description: string;
  indicators: ThreatIndicator[];
  affectedSystems: string[];
  ttps: string[];
  mitigations: string[];
  firstSeen: string;
  lastUpdated: string;
  active: boolean;
  healthcareSpecific: boolean;
  regulatoryImpact: string[];
  riskScore: number;
}

interface RegulatoryUpdate {
  id: string;
  framework: string;
  title: string;
  summary: string;
  effectiveDate: string;
  announcedDate: string;
  impactLevel: string;
  affectedControls: string[];
  requiredActions: string[];
  complianceDeadline?: string;
  source: string;
}

interface AttackVector {
  id: string;
  name: string;
  category: string;
  description: string;
  targetedAssets: string[];
  exploitedVulnerabilities: string[];
  detectionSignatures: string[];
  prevalenceScore: number;
  sophisticationLevel: string;
  mitreTechniques: string[];
}

interface ThreatSummary {
  totalActiveThreats: number;
  criticalThreats: number;
  newThreatsLast24h: number;
  regulatoryUpdatesLast30d: number;
  topAttackVectors: Array<{ name: string; prevalence: number }>;
  riskTrend: string;
  affectedFrameworks: string[];
  recommendedFocus: string[];
  lastAnalyzed: string;
}

interface ThreatConfig {
  enabled: boolean;
  refreshIntervalMinutes: number;
  sources: Array<{ name: string; type: string; enabled: boolean; lastSync: string | null }>;
  filters: {
    minSeverity: string;
    healthcareOnly: boolean;
    frameworks: string[];
  };
  autoAdjustRisk: boolean;
  autoAdjustPriority: boolean;
}

export default function ThreatIntelligence() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedThreat, setSelectedThreat] = useState<SecurityThreat | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<ThreatSummary>({
    queryKey: ["/api/threat-intelligence/summary"]
  });

  const { data: threats } = useQuery<SecurityThreat[]>({
    queryKey: ["/api/threat-intelligence/threats"]
  });

  const { data: regulatoryUpdates } = useQuery<RegulatoryUpdate[]>({
    queryKey: ["/api/threat-intelligence/regulatory-updates"]
  });

  const { data: attackVectors } = useQuery<AttackVector[]>({
    queryKey: ["/api/threat-intelligence/attack-vectors"]
  });

  const { data: config } = useQuery<ThreatConfig>({
    queryKey: ["/api/threat-intelligence/configuration"]
  });

  const refreshFeedMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", "/api/threat-intelligence/refresh");
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threat-intelligence"] });
      toast({ title: "Threat feed refreshed" });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<ThreatConfig>) => {
      const result = await apiRequest("PATCH", "/api/threat-intelligence/configuration", updates);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threat-intelligence/configuration"] });
      toast({ title: "Configuration updated" });
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-600/10 text-red-600 border-red-600/20";
      case "high": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "medium": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "low": return "bg-green-500/10 text-green-500 border-green-500/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ransomware": return <Lock className="h-4 w-4" />;
      case "phishing": return <AlertCircle className="h-4 w-4" />;
      case "insider_threat": return <Eye className="h-4 w-4" />;
      case "api_exploit": return <Zap className="h-4 w-4" />;
      case "credential_compromise": return <Lock className="h-4 w-4" />;
      case "supply_chain": return <Activity className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            Threat Intelligence
          </h1>
          <p className="text-muted-foreground">
            AI-powered healthcare security threat monitoring and analysis
          </p>
        </div>
        <Button
          onClick={() => refreshFeedMutation.mutate()}
          disabled={refreshFeedMutation.isPending}
          data-testid="button-refresh-feed"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshFeedMutation.isPending ? "animate-spin" : ""}`} />
          Refresh Feed
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-navigation">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="threats" data-testid="tab-threats">Active Threats</TabsTrigger>
          <TabsTrigger value="regulatory" data-testid="tab-regulatory">Regulatory Updates</TabsTrigger>
          <TabsTrigger value="vectors" data-testid="tab-vectors">Attack Vectors</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {summary && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card data-testid="card-active-threats">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Active Threats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary.totalActiveThreats}</div>
                    <p className="text-sm text-muted-foreground">
                      {summary.criticalThreats} critical
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-new-threats">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Radio className="h-4 w-4" />
                      New (24h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary.newThreatsLast24h}</div>
                    <p className="text-sm text-muted-foreground">
                      Threats detected
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-regulatory">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Regulatory (30d)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{summary.regulatoryUpdatesLast30d}</div>
                    <p className="text-sm text-muted-foreground">
                      Updates to review
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="card-risk-trend">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Risk Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-2xl font-bold">
                      {summary.riskTrend === "increasing" ? (
                        <>
                          <TrendingUp className="h-6 w-6 text-red-500" />
                          <span className="text-red-500">Increasing</span>
                        </>
                      ) : summary.riskTrend === "decreasing" ? (
                        <>
                          <TrendingDown className="h-6 w-6 text-green-500" />
                          <span className="text-green-500">Decreasing</span>
                        </>
                      ) : (
                        <>
                          <Activity className="h-6 w-6 text-muted-foreground" />
                          <span>Stable</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card data-testid="card-focus-areas">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      Recommended Focus Areas
                    </CardTitle>
                    <CardDescription>AI-powered security priorities</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {summary.recommendedFocus.map((focus, index) => (
                        <div 
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            {index + 1}
                          </div>
                          <p className="text-sm">{focus}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-attack-vectors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crosshair className="h-5 w-5" />
                      Top Attack Vectors
                    </CardTitle>
                    <CardDescription>Prevalence in healthcare sector</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {summary.topAttackVectors.map((vector, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{vector.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {vector.prevalence}%
                            </span>
                          </div>
                          <Progress value={vector.prevalence} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="card-frameworks">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Affected Regulatory Frameworks
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {summary.affectedFrameworks.map((framework) => (
                      <Badge key={framework} variant="outline" className="text-sm">
                        {framework}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          {selectedThreat ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mb-2"
                      onClick={() => setSelectedThreat(null)}
                    >
                      Back to list
                    </Button>
                    <CardTitle className="flex items-center gap-2">
                      {getCategoryIcon(selectedThreat.category)}
                      {selectedThreat.name}
                    </CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge className={getSeverityColor(selectedThreat.severity)}>
                        {selectedThreat.severity}
                      </Badge>
                      <Badge variant="outline">{selectedThreat.category.replace(/_/g, " ")}</Badge>
                      {selectedThreat.healthcareSpecific && (
                        <Badge className="bg-blue-500/10 text-blue-500">Healthcare-Specific</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{selectedThreat.riskScore}</p>
                    <p className="text-sm text-muted-foreground">Risk Score</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{selectedThreat.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-2">Affected Systems</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedThreat.affectedSystems.map((sys, i) => (
                        <Badge key={i} variant="outline">{sys}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Regulatory Impact</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedThreat.regulatoryImpact.map((reg, i) => (
                        <Badge key={i} className="bg-purple-500/10 text-purple-500">{reg}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">MITRE ATT&CK TTPs</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedThreat.ttps.map((ttp, i) => (
                      <Badge key={i} variant="secondary">{ttp}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Recommended Mitigations</h4>
                  <ul className="space-y-2">
                    {selectedThreat.mitigations.map((mit, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                        {mit}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Threat Indicators</h4>
                  <div className="space-y-2">
                    {selectedThreat.indicators.map((ind) => (
                      <div key={ind.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{ind.type}</Badge>
                          <code className="bg-muted px-2 py-0.5 rounded">{ind.value}</code>
                        </div>
                        <span className="text-muted-foreground">
                          {ind.confidence}% confidence
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {threats?.map((threat) => (
                <Card 
                  key={threat.id} 
                  className="hover-elevate cursor-pointer"
                  data-testid={`threat-card-${threat.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {getCategoryIcon(threat.category)}
                          {threat.name}
                        </CardTitle>
                        <div className="flex gap-2 mt-2">
                          <Badge className={getSeverityColor(threat.severity)}>
                            {threat.severity}
                          </Badge>
                          <Badge variant="outline">
                            {threat.category.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{threat.riskScore}</p>
                        <p className="text-xs text-muted-foreground">Risk</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {threat.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Updated {new Date(threat.lastUpdated).toLocaleDateString()}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setSelectedThreat(threat)}
                        data-testid={`button-view-threat-${threat.id}`}
                      >
                        View Details
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="regulatory" className="space-y-4">
          <div className="space-y-4">
            {regulatoryUpdates?.map((update) => (
              <Card key={update.id} data-testid={`regulatory-card-${update.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-blue-500/10 text-blue-500">
                          {update.framework}
                        </Badge>
                        <Badge className={getSeverityColor(update.impactLevel)}>
                          {update.impactLevel} impact
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{update.summary}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Affected Controls</h4>
                      <div className="flex flex-wrap gap-1">
                        {update.affectedControls.map((ctrl, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{ctrl}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2">Timeline</h4>
                      <div className="space-y-1 text-sm">
                        <p className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Announced: {new Date(update.announcedDate).toLocaleDateString()}
                        </p>
                        <p className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Effective: {new Date(update.effectiveDate).toLocaleDateString()}
                        </p>
                        {update.complianceDeadline && (
                          <p className="flex items-center gap-2 text-orange-500">
                            <AlertTriangle className="h-4 w-4" />
                            Deadline: {new Date(update.complianceDeadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Required Actions</h4>
                    <ul className="space-y-1">
                      {update.requiredActions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vectors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {attackVectors?.map((vector) => (
              <Card key={vector.id} data-testid={`vector-card-${vector.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getCategoryIcon(vector.category)}
                        {vector.name}
                      </CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">
                          {vector.sophisticationLevel} sophistication
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold">{vector.prevalenceScore}%</p>
                      <p className="text-xs text-muted-foreground">Prevalence</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{vector.description}</p>
                  
                  <div>
                    <h4 className="text-sm font-medium mb-2">Targeted Assets</h4>
                    <div className="flex flex-wrap gap-1">
                      {vector.targetedAssets.map((asset, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{asset}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">MITRE Techniques</h4>
                    <div className="flex flex-wrap gap-1">
                      {vector.mitreTechniques.map((tech, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium mb-2">Detection Signatures</h4>
                    <ul className="space-y-1">
                      {vector.detectionSignatures.map((sig, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <Eye className="h-3 w-3" />
                          {sig}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {config && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Feed Configuration</CardTitle>
                  <CardDescription>Configure threat intelligence feed settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="feed-enabled">Enable Threat Feed</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically fetch and analyze threat intelligence
                      </p>
                    </div>
                    <Switch
                      id="feed-enabled"
                      checked={config.enabled}
                      onCheckedChange={(enabled) => updateConfigMutation.mutate({ enabled })}
                      data-testid="switch-feed-enabled"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-risk">Auto-Adjust Risk Scores</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically adjust audit log risk scores based on threats
                      </p>
                    </div>
                    <Switch
                      id="auto-risk"
                      checked={config.autoAdjustRisk}
                      onCheckedChange={(autoAdjustRisk) => updateConfigMutation.mutate({ autoAdjustRisk })}
                      data-testid="switch-auto-risk"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-priority">Auto-Adjust Remediation Priority</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically adjust remediation priorities based on threat context
                      </p>
                    </div>
                    <Switch
                      id="auto-priority"
                      checked={config.autoAdjustPriority}
                      onCheckedChange={(autoAdjustPriority) => updateConfigMutation.mutate({ autoAdjustPriority })}
                      data-testid="switch-auto-priority"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="healthcare-only">Healthcare-Specific Only</Label>
                      <p className="text-sm text-muted-foreground">
                        Filter for healthcare-specific threats only
                      </p>
                    </div>
                    <Switch
                      id="healthcare-only"
                      checked={config.filters.healthcareOnly}
                      onCheckedChange={(healthcareOnly) => 
                        updateConfigMutation.mutate({ 
                          filters: { ...config.filters, healthcareOnly } 
                        })
                      }
                      data-testid="switch-healthcare-only"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Intelligence Sources</CardTitle>
                  <CardDescription>Configure threat intelligence data sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {config.sources.map((source, index) => (
                      <div 
                        key={source.name}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${source.enabled ? "bg-green-500" : "bg-muted"}`} />
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {source.lastSync 
                                ? `Last synced: ${new Date(source.lastSync).toLocaleString()}`
                                : "Never synced"
                              }
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={source.enabled}
                          onCheckedChange={(enabled) => {
                            const sources = [...config.sources];
                            sources[index] = { ...sources[index], enabled };
                            updateConfigMutation.mutate({ sources });
                          }}
                          data-testid={`switch-source-${source.type}`}
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
