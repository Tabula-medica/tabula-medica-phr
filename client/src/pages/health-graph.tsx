import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Network,
  Activity,
  Brain,
  AlertTriangle,
  Link2,
  Stethoscope,
  Pill,
  Zap,
  TrendingUp,
  ChevronRight,
  CircleDot,
  Shield,
  Info,
  RefreshCw,
  Heart,
  Eye,
  Footprints,
  Droplets,
  Search,
  Filter,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface HealthNode {
  id: string;
  nodeType: string;
  label: string;
  code?: string;
  codeSystem?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  source: string;
  confidence: number;
  metadata: Record<string, any>;
}

interface HealthEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  strength: number;
  temporalOrder: string;
  evidence: string[];
  aiInferred: boolean;
  confidence: number;
  createdAt: string;
}

interface SymptomConditionLink {
  symptomNodeId: string;
  symptomLabel: string;
  conditionNodeId: string;
  conditionLabel: string;
  relationshipType: string;
  confidence: number;
  strength: number;
  evidence: string[];
  aiInferred: boolean;
  clinicalRationale: string;
  temporalCorrelation: string;
}

interface SymptomCluster {
  id: string;
  name: string;
  description: string;
  symptomIds: string[];
  primaryConditionId: string;
  conditionLabel: string;
  clusterConfidence: number;
  clinicalPattern: string;
}

interface GraphInsight {
  insightId: string;
  insightType: string;
  title: string;
  description: string;
  relatedNodeIds: string[];
  confidence: number;
  actionable: boolean;
  noCdsDisclaimer: string;
}

interface SymptomAnalysis {
  patientId: string;
  totalSymptoms: number;
  totalLinks: number;
  symptomNodes: HealthNode[];
  conditionNodes: HealthNode[];
  links: SymptomConditionLink[];
  clusters: SymptomCluster[];
  insights: GraphInsight[];
  noCdsDisclaimer: string;
  analyzedAt: string;
}

interface GraphData {
  patientId: string;
  nodes: HealthNode[];
  edges: HealthEdge[];
  episodes: any[];
  timelines: any[];
  lastUpdated: string;
  version: number;
}

const PATIENT_ID = "patient-001";

function getNodeIcon(nodeType: string) {
  switch (nodeType) {
    case "symptom": return <Activity className="w-4 h-4" />;
    case "condition": return <Stethoscope className="w-4 h-4" />;
    case "medication": return <Pill className="w-4 h-4" />;
    case "lab": return <Droplets className="w-4 h-4" />;
    case "imaging": return <Eye className="w-4 h-4" />;
    case "specialist": return <Heart className="w-4 h-4" />;
    default: return <CircleDot className="w-4 h-4" />;
  }
}

function getNodeColor(nodeType: string): string {
  switch (nodeType) {
    case "symptom": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "condition": return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
    case "medication": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    case "lab": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "imaging": return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30";
    case "specialist": return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getRelationshipLabel(type: string): string {
  const labels: Record<string, string> = {
    indicates: "Indicates",
    correlated_with: "Correlated With",
    causes: "Causes",
    treats: "Treats",
    monitors: "Monitors",
    managed_by: "Managed By",
    worsened_by: "Worsened By",
    improved_by: "Improved By",
    diagnosed_by: "Diagnosed By",
    ordered_by: "Ordered By",
    resulted_in: "Resulted In",
    follows: "Follows",
    part_of_episode: "Part Of Episode",
    contraindicated_by: "Contraindicated By",
    performed_during: "Performed During",
  };
  return labels[type] || type.replace(/_/g, " ");
}

function confidenceColor(conf: number): string {
  if (conf >= 0.85) return "text-emerald-600 dark:text-emerald-400";
  if (conf >= 0.7) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function NetworkVisualization({ nodes, links, onNodeClick, selectedId }: {
  nodes: HealthNode[];
  links: SymptomConditionLink[];
  onNodeClick: (id: string, type: string) => void;
  selectedId: string | null;
}) {
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const condNodes = nodes.filter(n => n.nodeType === "condition");
    const symptomNodesList = nodes.filter(n => n.nodeType === "symptom");
    const medNodes = nodes.filter(n => n.nodeType === "medication");
    const otherNodes = nodes.filter(n => !["condition", "symptom", "medication"].includes(n.nodeType));

    const centerX = 400;
    const centerY = 250;

    condNodes.forEach((n, i) => {
      const angle = (i / Math.max(condNodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = {
        x: centerX + Math.cos(angle) * 100,
        y: centerY + Math.sin(angle) * 80,
      };
    });

    symptomNodesList.forEach((n, i) => {
      const angle = (i / Math.max(symptomNodesList.length, 1)) * Math.PI * 2 - Math.PI / 2;
      positions[n.id] = {
        x: centerX + Math.cos(angle) * 220,
        y: centerY + Math.sin(angle) * 170,
      };
    });

    medNodes.forEach((n, i) => {
      const angle = (i / Math.max(medNodes.length, 1)) * Math.PI * 2;
      positions[n.id] = {
        x: centerX + Math.cos(angle) * 160,
        y: centerY + Math.sin(angle) * 130,
      };
    });

    otherNodes.forEach((n, i) => {
      positions[n.id] = {
        x: 50 + (i % 5) * 150,
        y: centerY + 200 + Math.floor(i / 5) * 50,
      };
    });

    return positions;
  }, [nodes]);

  const nodeColorFill = (type: string) => {
    switch (type) {
      case "symptom": return "#f59e0b";
      case "condition": return "#ef4444";
      case "medication": return "#3b82f6";
      case "lab": return "#10b981";
      case "imaging": return "#8b5cf6";
      default: return "#6b7280";
    }
  };

  return (
    <div className="border rounded-md bg-muted/30 overflow-hidden" data-testid="network-visualization">
      <svg viewBox="0 0 800 500" className="w-full h-auto" style={{ minHeight: 350 }}>
        {links.map((link, i) => {
          const from = nodePositions[link.symptomNodeId];
          const to = nodePositions[link.conditionNodeId];
          if (!from || !to) return null;
          const opacity = Math.max(0.2, link.confidence);
          const isHighlighted = selectedId === link.symptomNodeId || selectedId === link.conditionNodeId;
          return (
            <line
              key={i}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              strokeWidth={isHighlighted ? 2.5 : 1}
              strokeOpacity={isHighlighted ? 1 : opacity * 0.5}
              strokeDasharray={link.aiInferred ? "4 2" : undefined}
            />
          );
        })}

        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          const isSelected = selectedId === node.id;
          const radius = node.nodeType === "condition" ? 18 : node.nodeType === "symptom" ? 14 : 12;
          return (
            <g
              key={node.id}
              className="cursor-pointer"
              onClick={() => onNodeClick(node.id, node.nodeType)}
              data-testid={`graph-node-${node.id}`}
            >
              <circle
                cx={pos.x} cy={pos.y}
                r={radius + (isSelected ? 4 : 0)}
                fill={nodeColorFill(node.nodeType)}
                fillOpacity={isSelected ? 0.9 : 0.7}
                stroke={isSelected ? "hsl(var(--primary))" : "transparent"}
                strokeWidth={isSelected ? 3 : 0}
              />
              <text
                x={pos.x} y={pos.y + radius + 14}
                textAnchor="middle"
                className="text-[9px] fill-current"
                fill="hsl(var(--foreground))"
                opacity={0.8}
              >
                {node.label.length > 15 ? node.label.slice(0, 14) + "..." : node.label}
              </text>
            </g>
          );
        })}

        <g transform="translate(10, 460)">
          {[
            { type: "condition", label: "Conditions", color: "#ef4444" },
            { type: "symptom", label: "Symptoms", color: "#f59e0b" },
            { type: "medication", label: "Medications", color: "#3b82f6" },
          ].map((item, i) => (
            <g key={item.type} transform={`translate(${i * 130}, 0)`}>
              <circle cx={6} cy={6} r={6} fill={item.color} fillOpacity={0.7} />
              <text x={18} y={10} className="text-[10px]" fill="hsl(var(--muted-foreground))">{item.label}</text>
            </g>
          ))}
          <g transform="translate(390, 0)">
            <line x1={0} y1={6} x2={20} y2={6} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 2" />
            <text x={25} y={10} className="text-[10px]" fill="hsl(var(--muted-foreground))">AI-Inferred</text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export default function HealthGraphPage() {
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [activeNodeTypes, setActiveNodeTypes] = useState<Set<string>>(new Set(["symptom", "condition", "medication", "lab", "imaging"]));

  const toggleNodeType = useCallback((type: string) => {
    setActiveNodeTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) { next.delete(type); } else { next.add(type); }
      return next;
    });
  }, []);

  const { data: graphData, isLoading: graphLoading } = useQuery<{ success: boolean; graph: GraphData } | GraphData>({
    queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}`],
  });

  const { data: analysisData, isLoading: analysisLoading } = useQuery<{ success: boolean; analysis: SymptomAnalysis }>({
    queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}/symptom-analysis`],
  });

  const { data: statsData } = useQuery<{ statistics: any }>({
    queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}/statistics`],
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/infrastructure/health-graph/${PATIENT_ID}/build`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}/symptom-analysis`] });
      queryClient.invalidateQueries({ queryKey: [`/api/infrastructure/health-graph/${PATIENT_ID}/statistics`] });
    },
  });

  const graph: GraphData | undefined = graphData
    ? ("graph" in graphData ? graphData.graph : graphData as GraphData)
    : undefined;

  const analysis = analysisData?.analysis;
  const stats = statsData?.statistics;

  const isLoading = graphLoading || analysisLoading;

  const allNodes = graph?.nodes || [];
  const symptomNodes = allNodes.filter(n => n.nodeType === "symptom");
  const conditionNodes = allNodes.filter(n => n.nodeType === "condition");
  const medicationNodes = allNodes.filter(n => n.nodeType === "medication");

  const symptomEdges = graph?.edges.filter(e => {
    const symptomIds = new Set(symptomNodes.map(s => s.id));
    return symptomIds.has(e.sourceNodeId) || symptomIds.has(e.targetNodeId);
  }) || [];

  const filteredNodes = useMemo(() => {
    let nodes = allNodes.filter(n => activeNodeTypes.has(n.nodeType));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(n => n.label.toLowerCase().includes(q) || n.code?.toLowerCase().includes(q));
    }
    return nodes;
  }, [allNodes, activeNodeTypes, searchQuery]);

  const filteredLinks = useMemo(() => {
    if (!analysis?.links) return [];
    return analysis.links.filter(l => l.confidence >= confidenceThreshold / 100);
  }, [analysis?.links, confidenceThreshold]);

  const selectedSymptomNode = selectedSymptom ? symptomNodes.find(n => n.id === selectedSymptom) : null;
  const selectedConditionNode = selectedCondition ? conditionNodes.find(n => n.id === selectedCondition) : null;

  const selectedSymptomLinks = selectedSymptom
    ? (analysis?.links.filter(l => l.symptomNodeId === selectedSymptom) || [])
    : [];

  const selectedConditionLinks = selectedCondition
    ? (analysis?.links.filter(l => l.conditionNodeId === selectedCondition) || [])
    : [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="text-page-title">
              <Network className="w-6 h-6 text-primary" />
              Health Graph AI
            </h1>
            <p className="text-sm text-muted-foreground">
              Symptom-condition relationship analysis with AI-powered insights
            </p>
          </div>
        </div>
        <Button
          onClick={() => buildMutation.mutate()}
          disabled={buildMutation.isPending}
          data-testid="button-rebuild-graph"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${buildMutation.isPending ? "animate-spin" : ""}`} />
          {buildMutation.isPending ? "Rebuilding..." : "Rebuild Graph"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card data-testid="stat-symptoms">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/15">
                <Activity className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-symptom-count">{analysis?.totalSymptoms || symptomNodes.length}</p>
                <p className="text-xs text-muted-foreground">Reported Symptoms</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-conditions">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/15">
                <Stethoscope className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-condition-count">{conditionNodes.length}</p>
                <p className="text-xs text-muted-foreground">Diagnosed Conditions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-links">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/15">
                <Link2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-link-count">{analysis?.totalLinks || symptomEdges.length}</p>
                <p className="text-xs text-muted-foreground">Symptom Links</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-clusters">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-500/15">
                <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-cluster-count">{analysis?.clusters?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Symptom Clusters</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph" data-testid="tab-graph">
            <Network className="w-4 h-4 mr-1" /> Graph View
          </TabsTrigger>
          <TabsTrigger value="links" data-testid="tab-links">
            <Link2 className="w-4 h-4 mr-1" /> Symptom Links
          </TabsTrigger>
          <TabsTrigger value="clusters" data-testid="tab-clusters">
            <Brain className="w-4 h-4 mr-1" /> Clusters
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Zap className="w-4 h-4 mr-1" /> AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Network className="w-4 h-4" />
                    Interactive Network View
                  </CardTitle>
                  <CardDescription>Click nodes to explore relationships. Dashed lines are AI-inferred.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search nodes..."
                      className="pl-8 w-44"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search-nodes"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mr-1">Show:</span>
                {["symptom", "condition", "medication", "lab", "imaging"].map(type => (
                  <Badge
                    key={type}
                    variant={activeNodeTypes.has(type) ? "default" : "outline"}
                    className={`cursor-pointer text-xs capitalize ${activeNodeTypes.has(type) ? "" : "opacity-50"}`}
                    onClick={() => toggleNodeType(type)}
                    data-testid={`filter-node-type-${type}`}
                  >
                    {getNodeIcon(type)}
                    <span className="ml-1">{type}</span>
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Min Confidence:</span>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={(v) => setConfidenceThreshold(v[0])}
                  max={100}
                  step={5}
                  className="flex-1 max-w-xs"
                  data-testid="slider-confidence"
                />
                <span className="text-xs font-medium w-10 text-right">{confidenceThreshold}%</span>
              </div>
              <NetworkVisualization
                nodes={filteredNodes}
                links={filteredLinks}
                selectedId={selectedSymptom || selectedCondition}
                onNodeClick={(id, type) => {
                  if (type === "symptom") {
                    setSelectedSymptom(selectedSymptom === id ? null : id);
                    setSelectedCondition(null);
                  } else if (type === "condition") {
                    setSelectedCondition(selectedCondition === id ? null : id);
                    setSelectedSymptom(null);
                  }
                }}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Symptom-Condition Relationship Map</CardTitle>
                  <CardDescription>Detailed view of how your symptoms relate to diagnosed conditions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conditionNodes.map(condition => {
                      const condLinks = analysis?.links.filter(l => l.conditionNodeId === condition.id) || [];
                      const relatedMedEdges = graph?.edges.filter(
                        e => e.targetNodeId === condition.id && e.relationshipType === "treats"
                      ) || [];
                      const relatedMeds = relatedMedEdges.map(e => medicationNodes.find(m => m.id === e.sourceNodeId)).filter(Boolean) as HealthNode[];

                      return (
                        <Card
                          key={condition.id}
                          className={`cursor-pointer transition-all ${selectedCondition === condition.id ? "ring-2 ring-primary" : ""}`}
                          onClick={() => {
                            setSelectedCondition(selectedCondition === condition.id ? null : condition.id);
                            setSelectedSymptom(null);
                          }}
                          data-testid={`condition-card-${condition.id}`}
                        >
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-md ${getNodeColor("condition")}`}>
                                  <Stethoscope className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="font-medium text-sm" data-testid={`text-condition-label-${condition.id}`}>{condition.label}</p>
                                  <p className="text-xs text-muted-foreground">{condition.code} ({condition.codeSystem}) | Since {condition.startDate}</p>
                                </div>
                              </div>
                              <Badge variant="secondary">{condLinks.length} symptom{condLinks.length !== 1 ? "s" : ""}</Badge>
                            </div>

                            {condLinks.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {condLinks.map(link => (
                                  <Badge
                                    key={link.symptomNodeId}
                                    variant="outline"
                                    className={`cursor-pointer text-xs ${getNodeColor("symptom")}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSymptom(selectedSymptom === link.symptomNodeId ? null : link.symptomNodeId);
                                      setSelectedCondition(null);
                                    }}
                                    data-testid={`badge-symptom-${link.symptomNodeId}`}
                                  >
                                    <Activity className="w-3 h-3 mr-1" />
                                    {link.symptomLabel}
                                    <span className={`ml-1 ${confidenceColor(link.confidence)}`}>
                                      {(link.confidence * 100).toFixed(0)}%
                                    </span>
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {relatedMeds.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {relatedMeds.map(med => (
                                  <Badge key={med.id} variant="outline" className={`text-xs ${getNodeColor("medication")}`}>
                                    <Pill className="w-3 h-3 mr-1" />
                                    {med.label}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {condLinks.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {condLinks.map(link => (
                                  <div key={link.symptomNodeId} className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{link.symptomLabel}</span>
                                    <Badge variant="outline" className="text-[10px] py-0">
                                      {getRelationshipLabel(link.relationshipType)}
                                    </Badge>
                                    {link.aiInferred && (
                                      <Badge variant="outline" className="text-[10px] py-0 bg-purple-500/10">
                                        <Brain className="w-2.5 h-2.5 mr-0.5" /> AI
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Medication Side-Effect Links</CardTitle>
                  <CardDescription>Symptoms potentially related to your medications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {medicationNodes.map(med => {
                      const medSymptomEdges = symptomEdges.filter(e => e.targetNodeId === med.id);
                      if (medSymptomEdges.length === 0) return null;

                      return (
                        <div key={med.id} className="flex items-start gap-3 p-3 rounded-md border" data-testid={`med-link-${med.id}`}>
                          <div className={`p-1.5 rounded-md flex-shrink-0 ${getNodeColor("medication")}`}>
                            <Pill className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{med.label}</p>
                            <p className="text-xs text-muted-foreground mb-2">Started {med.startDate}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {medSymptomEdges.map(edge => {
                                const sym = symptomNodes.find(s => s.id === edge.sourceNodeId);
                                return sym ? (
                                  <Badge key={edge.id} variant="outline" className={`text-xs ${getNodeColor("symptom")}`}>
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    {sym.label}
                                    <span className={`ml-1 ${confidenceColor(edge.confidence)}`}>
                                      {(edge.confidence * 100).toFixed(0)}%
                                    </span>
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    }).filter(Boolean)}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {selectedSymptomNode && (
                <Card data-testid="detail-symptom">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="w-4 h-4 text-amber-500" />
                      {selectedSymptomNode.label}
                    </CardTitle>
                    <CardDescription>Patient-reported symptom details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline">{selectedSymptomNode.status}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">ICD-10</span>
                        <span>{selectedSymptomNode.code || "N/A"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Onset</span>
                        <span>{selectedSymptomNode.startDate}</span>
                      </div>
                      {selectedSymptomNode.metadata?.severity && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Severity</span>
                          <span className="capitalize">{selectedSymptomNode.metadata.severity}</span>
                        </div>
                      )}
                      {selectedSymptomNode.metadata?.frequency && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Frequency</span>
                          <span>{selectedSymptomNode.metadata.frequency}</span>
                        </div>
                      )}
                      {selectedSymptomNode.metadata?.location && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>{selectedSymptomNode.metadata.location}</span>
                        </div>
                      )}
                    </div>
                    {selectedSymptomNode.metadata?.onsetContext && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Onset Context</p>
                          <p className="text-sm">{selectedSymptomNode.metadata.onsetContext}</p>
                        </div>
                      </>
                    )}
                    {selectedSymptomLinks.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Linked Conditions</p>
                          {selectedSymptomLinks.map(link => (
                            <div key={link.conditionNodeId} className="flex items-start gap-2 mb-2 p-2 rounded-md bg-muted/50">
                              <Stethoscope className="w-3.5 h-3.5 mt-0.5 text-red-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{link.conditionLabel}</p>
                                <p className="text-xs text-muted-foreground">{link.clinicalRationale}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{link.temporalCorrelation}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={link.confidence * 100} className="h-1.5 flex-1" />
                                  <span className={`text-xs font-medium ${confidenceColor(link.confidence)}`}>
                                    {(link.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedConditionNode && (
                <Card data-testid="detail-condition">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-red-500" />
                      {selectedConditionNode.label}
                    </CardTitle>
                    <CardDescription>Condition details with linked symptoms</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Code</span>
                        <span>{selectedConditionNode.code} ({selectedConditionNode.codeSystem})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diagnosed</span>
                        <span>{selectedConditionNode.startDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <Badge variant="outline">{selectedConditionNode.status}</Badge>
                      </div>
                    </div>
                    {selectedConditionLinks.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Associated Symptoms ({selectedConditionLinks.length})</p>
                          {selectedConditionLinks.map(link => (
                            <div key={link.symptomNodeId} className="flex items-start gap-2 mb-2 p-2 rounded-md bg-muted/50">
                              <Activity className="w-3.5 h-3.5 mt-0.5 text-amber-500 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{link.symptomLabel}</p>
                                <Badge variant="outline" className="text-[10px] mt-0.5">{getRelationshipLabel(link.relationshipType)}</Badge>
                                <p className="text-xs text-muted-foreground mt-1">{link.temporalCorrelation}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={link.confidence * 100} className="h-1.5 flex-1" />
                                  <span className={`text-xs font-medium ${confidenceColor(link.confidence)}`}>
                                    {(link.confidence * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {!selectedSymptomNode && !selectedConditionNode && (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                    <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Select a condition or symptom to view relationship details</p>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">All Reported Symptoms</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-72">
                    <div className="space-y-2">
                      {symptomNodes.map(sym => {
                        const linkCount = analysis?.links.filter(l => l.symptomNodeId === sym.id).length || 0;
                        return (
                          <div
                            key={sym.id}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate ${selectedSymptom === sym.id ? "bg-accent" : ""}`}
                            {...clickable(() => {
                              setSelectedSymptom(selectedSymptom === sym.id ? null : sym.id);
                              setSelectedCondition(null);
                            })}
                            data-testid={`symptom-item-${sym.id}`}
                          >
                            <Activity className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{sym.label}</p>
                              <p className="text-xs text-muted-foreground">{sym.metadata?.severity || "N/A"} | {sym.startDate}</p>
                            </div>
                            <Badge variant="secondary" className="text-[10px]">{linkCount}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="links" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">All Symptom-Condition Links</CardTitle>
              <CardDescription>
                {analysis?.totalLinks || 0} identified relationships between symptoms and conditions/medications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis?.links.map((link, idx) => (
                  <div key={idx} className="p-3 rounded-md border space-y-2" data-testid={`link-item-${idx}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={getNodeColor("symptom")}>
                        <Activity className="w-3 h-3 mr-1" />
                        {link.symptomLabel}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className="bg-muted/50">
                        {getRelationshipLabel(link.relationshipType)}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      <Badge variant="outline" className={link.conditionNodeId.startsWith("med_") ? getNodeColor("medication") : getNodeColor("condition")}>
                        {link.conditionNodeId.startsWith("med_") ? <Pill className="w-3 h-3 mr-1" /> : <Stethoscope className="w-3 h-3 mr-1" />}
                        {link.conditionLabel}
                      </Badge>
                      {link.aiInferred && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400">
                          <Brain className="w-3 h-3 mr-1" /> AI-Inferred
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">Confidence</span>
                          <span className={`text-xs font-medium ${confidenceColor(link.confidence)}`}>
                            {(link.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={link.confidence * 100} className="h-1.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">Strength</span>
                          <span className={`text-xs font-medium ${confidenceColor(link.strength)}`}>
                            {(link.strength * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={link.strength * 100} className="h-1.5" />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <p>{link.clinicalRationale}</p>
                      <p className="mt-0.5">{link.temporalCorrelation}</p>
                    </div>
                    {link.evidence.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {link.evidence.map((ev, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{ev}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )) || (
                  <p className="text-sm text-muted-foreground text-center py-4">No links found yet. Rebuild the graph to analyze relationships.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clusters" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analysis?.clusters.map(cluster => (
              <Card key={cluster.id} data-testid={`cluster-card-${cluster.id}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    {cluster.name}
                  </CardTitle>
                  <CardDescription>{cluster.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={getNodeColor("condition")}>
                      <Stethoscope className="w-3 h-3 mr-1" />
                      {cluster.conditionLabel}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Confidence:</span>
                      <span className={`text-xs font-medium ${confidenceColor(cluster.clusterConfidence)}`}>
                        {(cluster.clusterConfidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Clustered Symptoms ({cluster.symptomIds.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {cluster.symptomIds.map(id => {
                        const sym = symptomNodes.find(s => s.id === id);
                        return sym ? (
                          <Badge key={id} variant="outline" className={`text-xs ${getNodeColor("symptom")}`}>
                            <Activity className="w-3 h-3 mr-1" />
                            {sym.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="p-2 rounded-md bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Clinical Pattern</p>
                    <p className="text-sm">{cluster.clinicalPattern}</p>
                  </div>
                </CardContent>
              </Card>
            )) || (
              <Card className="col-span-2">
                <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                  No symptom clusters identified yet.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="space-y-3">
            {analysis?.insights.map(insight => (
              <Card key={insight.insightId} data-testid={`insight-${insight.insightId}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-md flex-shrink-0 ${
                      insight.insightType === "correlation" ? "bg-blue-500/15" :
                      insight.insightType === "trend" ? "bg-emerald-500/15" :
                      insight.insightType === "interaction" ? "bg-amber-500/15" :
                      "bg-purple-500/15"
                    }`}>
                      {insight.insightType === "correlation" ? <Link2 className="w-4 h-4 text-blue-500" /> :
                       insight.insightType === "trend" ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
                       insight.insightType === "interaction" ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                       <Zap className="w-4 h-4 text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-medium text-sm">{insight.title}</p>
                        <Badge variant="outline" className="text-[10px]">{insight.insightType}</Badge>
                        {insight.actionable && <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate">Actionable</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">Confidence:</span>
                        <Progress value={insight.confidence * 100} className="h-1.5 w-24" />
                        <span className={`text-xs font-medium ${confidenceColor(insight.confidence)}`}>
                          {(insight.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) || (
              <Card>
                <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                  No insights available yet. Rebuild the graph to generate insights.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Alert>
        <Shield className="w-4 h-4" />
        <AlertDescription className="text-xs" data-testid="text-disclaimer">
          {analysis?.noCdsDisclaimer || "This is for informational purposes only and does not constitute medical advice. Always consult your healthcare provider."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
