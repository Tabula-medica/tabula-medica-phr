import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Map,
  Activity,
  AlertTriangle,
  Clock,
  TrendingUp,
  Target,
  ChevronRight,
  Loader2,
  Bot,
  Send,
  Filter,
  Eye,
  Zap,
  CheckCircle,
  XCircle,
  GitBranch,
  Calendar,
  Users,
  FileText,
  ArrowRight,
  Layers,
  BarChart3,
} from "lucide-react";

interface PathwayNode {
  id: string;
  type: string;
  label: string;
  description: string;
  phase: string;
  timestamp: string;
  duration?: number;
  status: string;
  riskLevel: string;
  isDecisionPoint: boolean;
  isCritical: boolean;
  metadata: Record<string, unknown>;
  position: { x: number; y: number; layer: number };
  connectedPatterns: string[];
  interventions: string[];
}

interface PathwayEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  label?: string;
  duration?: number;
  expectedDuration?: number;
  isDelayed: boolean;
  riskContribution: number;
  transitionNotes?: string;
}

interface DecisionPoint {
  id: string;
  nodeId: string;
  type: string;
  title: string;
  description: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    likelihood: number;
    operationalImpact: string;
  }>;
  selectedOption?: string;
  timestamp: string;
  outcome?: { selected: string; result: string; effectivenessScore: number };
}

interface PredictiveMarker {
  id: string;
  type: string;
  title: string;
  description: string;
  confidence: number;
  riskLevel: string;
  affectedPhases: string[];
  recommendedActions: string[];
  timeToAction?: number;
}

interface TemporalCorrelation {
  id: string;
  type: string;
  description: string;
  significance: string;
  pattern: string;
  operationalImpact: string;
  suggestedActions: string[];
}

interface JourneyPathway {
  id: string;
  patientId: string;
  name: string;
  description: string;
  currentPhase: string;
  status: string;
  nodes: PathwayNode[];
  edges: PathwayEdge[];
  temporalCorrelations: TemporalCorrelation[];
  predictiveMarkers: PredictiveMarker[];
  decisionPoints: DecisionPoint[];
  overallRisk: string;
  progressPercentage: number;
  metrics: {
    totalDuration: number;
    delayedSteps: number;
    completedSteps: number;
    pendingSteps: number;
    bottleneckCount: number;
  };
}

interface JourneySegment {
  id: string;
  name: string;
  phase: string;
  duration: number;
  riskLevel: string;
  patterns: string[];
  interventionCount: number;
  isBottleneck: boolean;
}

interface VisualizationData {
  pathway: JourneyPathway;
  segments: JourneySegment[];
  riskOverlay: {
    nodeRisks: Array<{ nodeId: string; riskLevel: string; factors: string[] }>;
    edgeRisks: Array<{ edgeId: string; riskLevel: string; reason: string }>;
    phaseRisks: Array<{ phase: string; riskLevel: string; score: number }>;
  };
  interventionOverlay: {
    activeInterventions: Array<{ id: string; title: string; priority: string; status: string }>;
    completedInterventions: Array<{ id: string; title: string }>;
    effectivenessMetrics: { totalInterventions: number; completionRate: number; averageEffectiveness: number };
  };
  aiInsights: {
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    temporalPatterns: string[];
    predictiveAlerts: string[];
  };
}

interface Dashboard {
  totalPathways: number;
  activePathways: number;
  highRiskPathways: number;
  avgProgress: number;
  totalDecisionPoints: number;
  pendingDecisions: number;
  temporalAlerts: number;
  predictiveMarkers: number;
  phaseDistribution: Array<{ phase: string; count: number }>;
  riskDistribution: Array<{ level: string; count: number }>;
}

const riskColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  delayed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300",
};

const nodeTypeIcons: Record<string, React.ReactNode> = {
  intake: <Users className="w-4 h-4" />,
  assessment: <FileText className="w-4 h-4" />,
  treatment: <Activity className="w-4 h-4" />,
  procedure: <Zap className="w-4 h-4" />,
  monitoring: <Eye className="w-4 h-4" />,
  follow_up: <Calendar className="w-4 h-4" />,
  discharge: <ArrowRight className="w-4 h-4" />,
  transition: <GitBranch className="w-4 h-4" />,
  decision_point: <Target className="w-4 h-4" />,
  milestone: <CheckCircle className="w-4 h-4" />,
};

const phases = ["intake", "assessment", "treatment", "monitoring", "follow_up", "discharge", "transition"];

export default function PatientJourneyExplorer() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("visualization");
  const [selectedPathwayId, setSelectedPathwayId] = useState<string>("pathway-001");
  const [selectedNode, setSelectedNode] = useState<PathwayNode | null>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [filters, setFilters] = useState<{
    phases: string[];
    riskLevels: string[];
    showCriticalOnly: boolean;
    includeDecisionPoints: boolean;
  }>({
    phases: [],
    riskLevels: [],
    showCriticalOnly: false,
    includeDecisionPoints: true,
  });
  const [showRiskOverlay, setShowRiskOverlay] = useState(true);
  const [showInterventionOverlay, setShowInterventionOverlay] = useState(true);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ success: boolean; data: Dashboard }>({
    queryKey: ["/api/journey-explorer/dashboard"],
  });

  const { data: pathwaysData } = useQuery<{ success: boolean; data: JourneyPathway[] }>({
    queryKey: ["/api/journey-explorer/pathways"],
  });

  const visualizationMutation = useMutation({
    mutationFn: async (pathwayId: string) => {
      const body = filters.phases.length > 0 || filters.riskLevels.length > 0 || filters.showCriticalOnly
        ? {
            phases: filters.phases.length > 0 ? filters.phases : undefined,
            riskLevels: filters.riskLevels.length > 0 ? filters.riskLevels : undefined,
            showCriticalOnly: filters.showCriticalOnly || undefined,
            includeDecisionPoints: filters.includeDecisionPoints,
            includeInterventions: showInterventionOverlay,
          }
        : {};
      const res = await apiRequest("POST", `/api/journey-explorer/pathways/${pathwayId}/visualization`, body);
      return res.json();
    },
  });

  const temporalMutation = useMutation({
    mutationFn: async (pathwayId: string) => {
      const res = await fetch(`/api/journey-explorer/pathways/${pathwayId}/temporal-analysis`);
      return res.json();
    },
  });

  const predictiveMutation = useMutation({
    mutationFn: async ({ pathwayId, query }: { pathwayId: string; query: string }) => {
      const res = await apiRequest("POST", `/api/journey-explorer/pathways/${pathwayId}/predictive-insights`, { query });
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate insights", variant: "destructive" });
    },
  });

  const dashboard = dashboardData?.data;
  const pathways = pathwaysData?.data || [];
  const vizData = visualizationMutation.data?.data as VisualizationData | undefined;
  const temporalData = temporalMutation.data?.data;

  const loadVisualization = () => {
    if (selectedPathwayId) {
      visualizationMutation.mutate(selectedPathwayId);
    }
  };

  const loadTemporalAnalysis = () => {
    if (selectedPathwayId) {
      temporalMutation.mutate(selectedPathwayId);
    }
  };

  useEffect(() => {
    if (selectedPathwayId) {
      visualizationMutation.mutate(selectedPathwayId);
    }
  }, [selectedPathwayId, filters.phases, filters.riskLevels, filters.showCriticalOnly, filters.includeDecisionPoints, showInterventionOverlay]);

  const handleAiAnalysis = () => {
    if (!aiQuery.trim() || !selectedPathwayId) return;
    predictiveMutation.mutate({ pathwayId: selectedPathwayId, query: aiQuery });
  };

  const filteredNodes = useMemo(() => {
    if (!vizData) return [];
    return vizData.pathway.nodes;
  }, [vizData]);

  const filteredEdges = useMemo(() => {
    if (!vizData) return [];
    return vizData.pathway.edges;
  }, [vizData]);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Map className="w-6 h-6" />
          Patient Journey Explorer
        </h1>
        <p className="text-muted-foreground">Interactive visualization of patient pathways with AI-powered insights</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="visualization" data-testid="tab-visualization">
            <Layers className="w-4 h-4 mr-2" />
            Pathway View
          </TabsTrigger>
          <TabsTrigger value="temporal" data-testid="tab-temporal">
            <Clock className="w-4 h-4 mr-2" />
            Temporal Analysis
          </TabsTrigger>
          <TabsTrigger value="predictive" data-testid="tab-predictive">
            <TrendingUp className="w-4 h-4 mr-2" />
            Predictive Insights
          </TabsTrigger>
          <TabsTrigger value="decisions" data-testid="tab-decisions">
            <GitBranch className="w-4 h-4 mr-2" />
            Decision Points
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visualization">
          <div className="grid md:grid-cols-4 gap-4 mb-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-total-pathways">{dashboard?.totalPathways || 0}</div>
                    <div className="text-xs text-muted-foreground">Total Pathways</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-high-risk">{dashboard?.highRiskPathways || 0}</div>
                    <div className="text-xs text-muted-foreground">High Risk</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-pending-decisions">{dashboard?.pendingDecisions || 0}</div>
                    <div className="text-xs text-muted-foreground">Pending Decisions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <div className="text-2xl font-bold" data-testid="text-avg-progress">{dashboard?.avgProgress || 0}%</div>
                    <div className="text-xs text-muted-foreground">Avg Progress</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mb-4">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Journey Pathway Visualization</CardTitle>
                  <CardDescription>Explore patient pathways with risk and intervention overlays</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={selectedPathwayId} onValueChange={setSelectedPathwayId}>
                    <SelectTrigger className="w-48" data-testid="select-pathway">
                      <SelectValue placeholder="Select pathway" />
                    </SelectTrigger>
                    <SelectContent>
                      {pathways.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                      {pathways.length === 0 && (
                        <SelectItem value="pathway-001">Post-Discharge Care Coordination</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button onClick={loadVisualization} disabled={visualizationMutation.isPending} data-testid="button-load">
                    {visualizationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    <span className="ml-2">Load</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Switch checked={showRiskOverlay} onCheckedChange={setShowRiskOverlay} id="risk-overlay" data-testid="switch-risk-overlay" />
                  <Label htmlFor="risk-overlay" className="text-sm">Risk Overlay</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={showInterventionOverlay} onCheckedChange={setShowInterventionOverlay} id="intervention-overlay" data-testid="switch-intervention-overlay" />
                  <Label htmlFor="intervention-overlay" className="text-sm">Interventions</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={filters.showCriticalOnly} onCheckedChange={(v) => setFilters(f => ({ ...f, showCriticalOnly: v }))} id="critical-only" data-testid="switch-critical-only" />
                  <Label htmlFor="critical-only" className="text-sm">Critical Only</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Phases:</span>
                  {phases.slice(0, 4).map((phase) => (
                    <div key={phase} className="flex items-center gap-1">
                      <Checkbox
                        id={`phase-${phase}`}
                        checked={filters.phases.includes(phase)}
                        onCheckedChange={(checked) => {
                          setFilters(f => ({
                            ...f,
                            phases: checked 
                              ? [...f.phases, phase] 
                              : f.phases.filter(p => p !== phase),
                          }));
                        }}
                        data-testid={`checkbox-phase-${phase}`}
                      />
                      <Label htmlFor={`phase-${phase}`} className="text-xs capitalize">{phase.replace("_", " ")}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {!vizData ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a pathway and click Load to visualize</p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <ScrollArea className="h-[500px] border rounded-lg p-4">
                      <h3 className="font-semibold mb-3">Pathway Nodes ({filteredNodes.length})</h3>
                      <div className="space-y-2">
                        {filteredNodes.map((node, idx) => (
                          <div
                            key={node.id}
                            className={`p-3 border rounded-lg hover-elevate cursor-pointer ${
                              selectedNode?.id === node.id ? "ring-2 ring-primary" : ""
                            } ${node.isCritical ? "border-l-4 border-l-orange-500" : ""}`}
                            onClick={() => setSelectedNode(node)}
                            data-testid={`node-${node.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                {nodeTypeIcons[node.type] || <Activity className="w-4 h-4" />}
                                <span className="font-medium">{node.label}</span>
                                {node.isDecisionPoint && <Target className="w-3 h-3 text-purple-500" />}
                              </div>
                              <div className="flex items-center gap-1">
                                <Badge className={statusColors[node.status]} variant="outline">{node.status}</Badge>
                                {showRiskOverlay && (
                                  <Badge className={riskColors[node.riskLevel]} variant="outline">{node.riskLevel}</Badge>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{node.description}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <span className="capitalize">{node.phase.replace("_", " ")}</span>
                              {node.duration && <span>| {node.duration} days</span>}
                              {node.interventions.length > 0 && showInterventionOverlay && (
                                <Badge variant="secondary" className="text-xs">{node.interventions.length} intervention(s)</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-4">
                    {selectedNode && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            {nodeTypeIcons[selectedNode.type]}
                            {selectedNode.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-muted-foreground">{selectedNode.description}</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-muted-foreground">Phase:</span> <span className="capitalize">{selectedNode.phase.replace("_", " ")}</span></div>
                            <div><span className="text-muted-foreground">Duration:</span> {selectedNode.duration || "N/A"} days</div>
                            <div><span className="text-muted-foreground">Risk:</span> <Badge className={riskColors[selectedNode.riskLevel]}>{selectedNode.riskLevel}</Badge></div>
                            <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColors[selectedNode.status]}>{selectedNode.status}</Badge></div>
                          </div>
                          {selectedNode.metadata.facility ? (
                            <div className="text-sm"><span className="text-muted-foreground">Facility:</span> {selectedNode.metadata.facility as string}</div>
                          ) : null}
                          {selectedNode.connectedPatterns.length > 0 && (
                            <div>
                              <span className="text-sm text-muted-foreground">Connected Patterns:</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {selectedNode.connectedPatterns.map((p) => (
                                  <Badge key={p} variant="outline" className="text-xs">{p}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">AI Insights</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-3">{vizData.aiInsights.summary}</p>
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Key Findings:</p>
                          <ul className="text-xs space-y-1">
                            {vizData.aiInsights.keyFindings.slice(0, 3).map((f, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <ChevronRight className="w-3 h-3 mt-0.5 text-blue-500 flex-shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>

                    {showInterventionOverlay && vizData.interventionOverlay.activeInterventions.length > 0 && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Active Interventions</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {vizData.interventionOverlay.activeInterventions.map((int) => (
                              <div key={int.id} className="p-2 border rounded text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{int.title}</span>
                                  <Badge className={riskColors[int.priority]}>{int.priority}</Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-muted-foreground">
                            Completion Rate: {vizData.interventionOverlay.effectivenessMetrics.completionRate}%
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {vizData && (
            <Card>
              <CardHeader>
                <CardTitle>Journey Segments</CardTitle>
                <CardDescription>Drill down into specific segments of the patient journey</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {vizData.segments.map((seg) => (
                    <Card key={seg.id} className={`hover-elevate cursor-pointer ${seg.isBottleneck ? "border-orange-500 border-2" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{seg.name}</span>
                          <Badge className={riskColors[seg.riskLevel]}>{seg.riskLevel}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2 capitalize">{seg.phase.replace("_", " ")} Phase</div>
                        <div className="flex items-center justify-between text-xs">
                          <span>{seg.duration} days</span>
                          {seg.isBottleneck && <Badge variant="destructive" className="text-xs">Bottleneck</Badge>}
                          {seg.interventionCount > 0 && <Badge variant="secondary" className="text-xs">{seg.interventionCount} intervention(s)</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="temporal">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Temporal Correlation Analysis</CardTitle>
                  <CardDescription>Analyze timing patterns and bottlenecks in the patient journey</CardDescription>
                </div>
                <Button onClick={loadTemporalAnalysis} disabled={temporalMutation.isPending} data-testid="button-analyze-temporal">
                  {temporalMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Clock className="w-4 h-4 mr-2" />}
                  Analyze
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!temporalData ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Click Analyze to view temporal correlations</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Temporal Correlations</h3>
                    <div className="space-y-3">
                      {temporalData.correlations?.map((tc: TemporalCorrelation) => (
                        <div key={tc.id} className="p-4 border rounded-lg" data-testid={`card-correlation-${tc.id}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize" data-testid={`text-correlation-type-${tc.id}`}>{tc.type.replace("_", " ")}</span>
                            <Badge className={tc.significance === "high" ? riskColors.high : tc.significance === "medium" ? riskColors.medium : riskColors.low} data-testid={`badge-significance-${tc.id}`}>
                              {tc.significance}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2" data-testid={`text-correlation-desc-${tc.id}`}>{tc.description}</p>
                          <p className="text-sm"><span className="font-medium">Pattern:</span> {tc.pattern}</p>
                          <p className="text-sm"><span className="font-medium">Impact:</span> {tc.operationalImpact}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Identified Patterns</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {temporalData.patterns?.map((p: { type: string; description: string; frequency: number; averageDuration: number; operationalInsight: string }, i: number) => (
                        <Card key={i} data-testid={`card-pattern-${i}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-blue-500" />
                              <span className="font-medium capitalize" data-testid={`text-pattern-type-${i}`}>{p.type.replace("_", " ")}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2" data-testid={`text-pattern-desc-${i}`}>{p.description}</p>
                            <div className="flex items-center justify-between text-xs">
                              <span data-testid={`text-frequency-${i}`}>Frequency: {p.frequency}/10</span>
                              <span data-testid={`text-duration-${i}`}>Avg Duration: {p.averageDuration} days</span>
                            </div>
                            <p className="text-xs mt-2 text-blue-600 dark:text-blue-400" data-testid={`text-insight-${i}`}>{p.operationalInsight}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {temporalData.bottleneckAnalysis?.identified?.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3">Bottleneck Analysis</h3>
                      <div className="space-y-2">
                        {temporalData.bottleneckAnalysis.identified.map((b: { location: string; phase: string; averageDelay: number; impact: string }, i: number) => (
                          <div key={i} className="p-3 border rounded-lg border-orange-300 bg-orange-50 dark:bg-orange-950" data-testid={`card-bottleneck-${i}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium" data-testid={`text-bottleneck-location-${i}`}>{b.location}</span>
                              <Badge variant="destructive" data-testid={`badge-delay-${i}`}>+{b.averageDelay} days delay</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground" data-testid={`text-bottleneck-impact-${i}`}>{b.impact}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {temporalData.bottleneckAnalysis.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-bottleneck-rec-${i}`}>
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                              <span data-testid={`text-bottleneck-rec-${i}`}>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictive">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Predictive Insights
              </CardTitle>
              <CardDescription>Ask questions about predictive markers and operational forecasts</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 mb-4">
                {predictiveMutation.data?.data ? (
                  <div className="space-y-4">
                    <div className="bg-muted p-4 rounded-lg" data-testid="card-query">
                      <p className="font-medium mb-2">Your Question:</p>
                      <p className="text-muted-foreground" data-testid="text-query">{predictiveMutation.data.data.query}</p>
                    </div>
                    <div className="p-4 border rounded-lg" data-testid="card-analysis">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">Analysis:</p>
                        <Badge variant="outline" data-testid="text-confidence">{predictiveMutation.data.data.confidence}% confidence</Badge>
                      </div>
                      <p className="whitespace-pre-wrap" data-testid="text-analysis">{predictiveMutation.data.data.analysis}</p>
                    </div>
                    {predictiveMutation.data.data.predictiveMarkers?.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Predictive Markers:</p>
                        <div className="space-y-2">
                          {predictiveMutation.data.data.predictiveMarkers.map((m: PredictiveMarker) => (
                            <div key={m.id} className="p-3 border rounded-lg" data-testid={`card-marker-${m.id}`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium" data-testid={`text-marker-title-${m.id}`}>{m.title}</span>
                                <Badge className={riskColors[m.riskLevel]} data-testid={`badge-confidence-${m.id}`}>{m.confidence}%</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground" data-testid={`text-marker-desc-${m.id}`}>{m.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {predictiveMutation.data.data.recommendations?.length > 0 && (
                      <div>
                        <p className="font-medium mb-2">Recommendations:</p>
                        <ul className="space-y-1">
                          {predictiveMutation.data.data.recommendations.map((r: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-sm" data-testid={`item-pred-rec-${i}`}>
                              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                              <span data-testid={`text-pred-rec-${i}`}>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="mb-4">Ask about predictive markers and operational forecasts</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        "What are the readmission risk factors?",
                        "When should we intervene?",
                        "What bottlenecks should we address?",
                      ].map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAiQuery(q);
                            if (selectedPathwayId) {
                              predictiveMutation.mutate({ pathwayId: selectedPathwayId, query: q });
                            }
                          }}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {predictiveMutation.isPending && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about predictive markers, risk factors, or operational forecasts..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiAnalysis()}
                  disabled={predictiveMutation.isPending}
                  data-testid="input-ai-query"
                />
                <Button onClick={handleAiAnalysis} disabled={!aiQuery.trim() || predictiveMutation.isPending} data-testid="button-analyze">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions">
          <Card>
            <CardHeader>
              <CardTitle>Critical Decision Points</CardTitle>
              <CardDescription>Review and manage key decision points in the patient journey</CardDescription>
            </CardHeader>
            <CardContent>
              {vizData ? (
                <div className="space-y-4">
                  {vizData.pathway.decisionPoints.map((dp) => (
                    <Card key={dp.id} className="border-l-4 border-l-purple-500" data-testid={`card-decision-${dp.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Target className="w-5 h-5 text-purple-500" />
                            <span className="font-semibold" data-testid={`text-decision-title-${dp.id}`}>{dp.title}</span>
                          </div>
                          <Badge variant="outline" className="capitalize" data-testid={`badge-decision-type-${dp.id}`}>{dp.type.replace("_", " ")}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{dp.description}</p>

                        <div className="space-y-2 mb-4">
                          <p className="text-sm font-medium">Options:</p>
                          {dp.options.map((opt) => (
                            <div
                              key={opt.id}
                              className={`p-3 border rounded-lg ${dp.selectedOption === opt.id ? "border-green-500 bg-green-50 dark:bg-green-950" : ""}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{opt.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{opt.likelihood}% likely</span>
                                  {dp.selectedOption === opt.id && <CheckCircle className="w-4 h-4 text-green-500" />}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{opt.description}</p>
                              <p className="text-xs mt-1"><span className="font-medium">Impact:</span> {opt.operationalImpact}</p>
                            </div>
                          ))}
                        </div>

                        {dp.outcome && (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm font-medium mb-1">Outcome:</p>
                            <p className="text-sm">{dp.outcome.result}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Effectiveness:</span>
                              <Progress value={dp.outcome.effectivenessScore} className="w-24 h-2" />
                              <span className="text-xs font-medium">{dp.outcome.effectivenessScore}%</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {vizData.pathway.decisionPoints.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No decision points in this pathway</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Load a pathway to view decision points</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
