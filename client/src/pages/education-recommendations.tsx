import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  BookOpen,
  Sparkles,
  User,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Eye,
  X,
  FileText,
  HelpCircle,
  Video,
  BarChart3,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

interface EducationRecommendation {
  id: string;
  patientId: string;
  contentId: string;
  contentType: "article" | "faq" | "video";
  title: string;
  summary: string;
  category: string;
  relevanceScore: number;
  matchReason: string;
  matchedFactors: string[];
  priority: "low" | "medium" | "high";
  estimatedReadTime?: number;
  generatedAt: string;
  status: "pending" | "viewed" | "dismissed" | "helpful" | "not_helpful";
}

interface RecommendationSet {
  patientId: string;
  patientName: string;
  recommendations: EducationRecommendation[];
  generatedAt: string;
  contextSummary: string;
  aiGenerated: boolean;
}

interface RecommendationStats {
  totalPatients: number;
  totalRecommendations: number;
  viewedCount: number;
  helpfulCount: number;
  dismissedCount: number;
  byCategory: Record<string, number>;
  avgRelevanceScore: number;
}

export default function EducationRecommendationsPage() {
  const { toast } = useToast();
  const [selectedRecommendation, setSelectedRecommendation] = useState<EducationRecommendation | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [newPatient, setNewPatient] = useState({
    id: "",
    name: "",
    conditions: "",
    medications: "",
    allergies: "",
    riskLevel: "low" as "low" | "medium" | "high" | "critical",
  });

  const { data: allRecommendations = [], isLoading } = useQuery<RecommendationSet[]>({
    queryKey: ["/api/education-recommendations/all"],
  });

  const { data: stats } = useQuery<RecommendationStats>({
    queryKey: ["/api/education-recommendations/stats"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/education-recommendations/generate-for-patient/${newPatient.id}`, {
        patientName: newPatient.name,
        conditions: newPatient.conditions.split(",").map(c => c.trim()).filter(Boolean),
        medications: newPatient.medications.split(",").map(m => m.trim()).filter(Boolean),
        allergies: newPatient.allergies.split(",").map(a => a.trim()).filter(Boolean),
        riskLevel: newPatient.riskLevel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education-recommendations/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-recommendations/stats"] });
      setShowGenerateDialog(false);
      setNewPatient({ id: "", name: "", conditions: "", medications: "", allergies: "", riskLevel: "low" });
      toast({ title: "Recommendations generated", description: "AI has created personalized education recommendations" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate recommendations", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ patientId, recommendationId, status }: { patientId: string; recommendationId: string; status: string }) => {
      return apiRequest("POST", `/api/education-recommendations/patient/${patientId}/recommendation/${recommendationId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education-recommendations/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-recommendations/stats"] });
    },
  });

  const contentTypeIcon = (type: string) => {
    switch (type) {
      case "article": return <FileText className="h-4 w-4" />;
      case "faq": return <HelpCircle className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-red-500/10 text-red-500";
      case "medium": return "bg-amber-500/10 text-amber-500";
      default: return "bg-blue-500/10 text-blue-500";
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "helpful": return "bg-green-500/10 text-green-500";
      case "viewed": return "bg-blue-500/10 text-blue-500";
      case "dismissed": case "not_helpful": return "bg-gray-500/10 text-gray-500";
      default: return "bg-purple-500/10 text-purple-500";
    }
  };

  const totalRecs = allRecommendations.flatMap(r => r.recommendations);
  const pendingRecs = totalRecs.filter(r => r.status === "pending");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Sparkles className="h-8 w-8 text-primary" />
            Education Recommendations
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered personalized education materials based on patient health profiles
          </p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)} data-testid="button-generate-recommendations">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Recommendations
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalPatients}</p>
                  <p className="text-sm text-muted-foreground">Patients</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalRecommendations}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.viewedCount}</p>
                  <p className="text-sm text-muted-foreground">Viewed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.helpfulCount}</p>
                  <p className="text-sm text-muted-foreground">Helpful</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <X className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.dismissedCount}</p>
                  <p className="text-sm text-muted-foreground">Dismissed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.avgRelevanceScore}%</p>
                  <p className="text-sm text-muted-foreground">Avg Relevance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="patients" className="space-y-4">
        <TabsList>
          <TabsTrigger value="patients" data-testid="tab-patients">
            <Users className="h-4 w-4 mr-2" />
            By Patient ({allRecommendations.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <BookOpen className="h-4 w-4 mr-2" />
            Pending Review ({pendingRecs.length})
          </TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="space-y-4">
          {isLoading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Loading recommendations...</CardContent></Card>
          ) : allRecommendations.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No recommendations yet. Generate recommendations for a patient to get started.</CardContent></Card>
          ) : (
            <div className="space-y-6">
              {allRecommendations.map((set) => (
                <Card key={set.patientId} data-testid={`card-patient-${set.patientId}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          {set.patientName}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {set.contextSummary}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {set.aiGenerated && (
                          <Badge variant="outline" className="text-purple-500">
                            <Sparkles className="h-3 w-3 mr-1" />
                            AI Generated
                          </Badge>
                        )}
                        <Badge variant="outline">
                          {set.recommendations.length} recommendations
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3">
                      {set.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="flex items-start justify-between gap-4 p-3 rounded-md border hover-elevate cursor-pointer"
                          {...clickable(() => setSelectedRecommendation(rec))}
                          data-testid={`recommendation-${rec.id}`}
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 rounded-md bg-muted">
                              {contentTypeIcon(rec.contentType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{rec.title}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">{rec.summary}</p>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-xs">{rec.category.replace(/_/g, " ")}</Badge>
                                <Badge className={priorityColor(rec.priority)}>{rec.priority}</Badge>
                                <Badge className={statusColor(rec.status)}>{rec.status}</Badge>
                                {rec.estimatedReadTime && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {rec.estimatedReadTime} min
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{rec.relevanceScore}%</span>
                            </div>
                            <Progress value={rec.relevanceScore} className="w-16 h-1" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground">
                    Generated {new Date(set.generatedAt).toLocaleString()}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingRecs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">No pending recommendations to review</CardContent></Card>
          ) : (
            <div className="grid gap-4">
              {pendingRecs.map((rec) => {
                const patientSet = allRecommendations.find(s => s.patientId === rec.patientId);
                return (
                  <Card key={rec.id} className="hover-elevate" data-testid={`pending-${rec.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {contentTypeIcon(rec.contentType)}
                            {rec.title}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <User className="h-4 w-4" />
                            For: {patientSet?.patientName || rec.patientId}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priorityColor(rec.priority)}>{rec.priority}</Badge>
                          <Badge variant="outline">{rec.relevanceScore}% match</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{rec.summary}</p>
                      <p className="text-sm"><span className="font-medium">Why recommended:</span> {rec.matchReason}</p>
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ patientId: rec.patientId, recommendationId: rec.id, status: "dismissed" })}
                        data-testid={`button-dismiss-${rec.id}`}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Dismiss
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateStatusMutation.mutate({ patientId: rec.patientId, recommendationId: rec.id, status: "viewed" })}
                        data-testid={`button-mark-viewed-${rec.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Mark Viewed
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          updateStatusMutation.mutate({ patientId: rec.patientId, recommendationId: rec.id, status: "helpful" });
                          toast({ title: "Marked as helpful", description: "This will improve future recommendations" });
                        }}
                        data-testid={`button-helpful-${rec.id}`}
                      >
                        <ThumbsUp className="h-4 w-4 mr-2" />
                        Helpful
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {stats && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(stats.byCategory).length === 0 ? (
                    <p className="text-muted-foreground">No data available</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(stats.byCategory).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className="capitalize">{category.replace(/_/g, " ")}</span>
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={(count / stats.totalRecommendations) * 100} 
                              className="w-24 h-2" 
                            />
                            <span className="text-sm font-medium w-8">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Engagement Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>View Rate</span>
                      <span className="font-medium">
                        {stats.totalRecommendations > 0 
                          ? Math.round((stats.viewedCount / stats.totalRecommendations) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={stats.totalRecommendations > 0 ? (stats.viewedCount / stats.totalRecommendations) * 100 : 0} 
                    />
                    
                    <div className="flex items-center justify-between">
                      <span>Helpfulness Rate</span>
                      <span className="font-medium">
                        {stats.viewedCount > 0 
                          ? Math.round((stats.helpfulCount / stats.viewedCount) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={stats.viewedCount > 0 ? (stats.helpfulCount / stats.viewedCount) * 100 : 0}
                      className="bg-green-100"
                    />
                    
                    <div className="flex items-center justify-between">
                      <span>Dismissal Rate</span>
                      <span className="font-medium">
                        {stats.totalRecommendations > 0 
                          ? Math.round((stats.dismissedCount / stats.totalRecommendations) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={stats.totalRecommendations > 0 ? (stats.dismissedCount / stats.totalRecommendations) * 100 : 0}
                      className="bg-gray-100"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRecommendation} onOpenChange={() => setSelectedRecommendation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedRecommendation && contentTypeIcon(selectedRecommendation.contentType)}
              {selectedRecommendation?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedRecommendation?.contentType} - {selectedRecommendation?.category.replace(/_/g, " ")}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={priorityColor(selectedRecommendation?.priority || "low")}>
                  {selectedRecommendation?.priority} priority
                </Badge>
                <Badge className={statusColor(selectedRecommendation?.status || "pending")}>
                  {selectedRecommendation?.status}
                </Badge>
                <Badge variant="outline">
                  {selectedRecommendation?.relevanceScore}% relevance
                </Badge>
                {selectedRecommendation?.estimatedReadTime && (
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedRecommendation.estimatedReadTime} min read
                  </Badge>
                )}
              </div>
              <Separator />
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm text-muted-foreground">{selectedRecommendation?.summary}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Why This Was Recommended</h4>
                <p className="text-sm">{selectedRecommendation?.matchReason}</p>
              </div>
              {selectedRecommendation?.matchedFactors && selectedRecommendation.matchedFactors.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Matched Factors</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedRecommendation.matchedFactors.map((factor, idx) => (
                      <Badge key={idx} variant="outline">{factor}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedRecommendation(null)}>Close</Button>
            {selectedRecommendation?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedRecommendation) {
                      updateStatusMutation.mutate({
                        patientId: selectedRecommendation.patientId,
                        recommendationId: selectedRecommendation.id,
                        status: "not_helpful",
                      });
                      setSelectedRecommendation(null);
                    }
                  }}
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Not Helpful
                </Button>
                <Button
                  onClick={() => {
                    if (selectedRecommendation) {
                      updateStatusMutation.mutate({
                        patientId: selectedRecommendation.patientId,
                        recommendationId: selectedRecommendation.id,
                        status: "helpful",
                      });
                      setSelectedRecommendation(null);
                      toast({ title: "Marked as helpful" });
                    }
                  }}
                >
                  <ThumbsUp className="h-4 w-4 mr-2" />
                  Helpful
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Education Recommendations</DialogTitle>
            <DialogDescription>
              AI will analyze the patient's health profile to suggest relevant education materials
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="education-recommendation-patient-id">Patient ID</Label>
                <Input id="education-recommendation-patient-id"
                  placeholder="e.g., patient-123"
                  value={newPatient.id}
                  onChange={(e) => setNewPatient({ ...newPatient, id: e.target.value })}
                  data-testid="input-patient-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education-recommendation-patient-name">Patient Name</Label>
                <Input id="education-recommendation-patient-name"
                  placeholder="e.g., John Smith"
                  value={newPatient.name}
                  onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  data-testid="input-patient-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="education-recommendation-conditions-comma-separated">Conditions (comma-separated)</Label>
              <Textarea id="education-recommendation-conditions-comma-separated"
                placeholder="e.g., Type 2 Diabetes, Hypertension, Obesity"
                value={newPatient.conditions}
                onChange={(e) => setNewPatient({ ...newPatient, conditions: e.target.value })}
                data-testid="input-conditions"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="education-recommendation-active-medications-comma-separated">Active Medications (comma-separated)</Label>
              <Input id="education-recommendation-active-medications-comma-separated"
                placeholder="e.g., Metformin, Lisinopril"
                value={newPatient.medications}
                onChange={(e) => setNewPatient({ ...newPatient, medications: e.target.value })}
                data-testid="input-medications"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="education-recommendation-allergies-comma-separated">Allergies (comma-separated)</Label>
                <Input id="education-recommendation-allergies-comma-separated"
                  placeholder="e.g., Penicillin"
                  value={newPatient.allergies}
                  onChange={(e) => setNewPatient({ ...newPatient, allergies: e.target.value })}
                  data-testid="input-allergies"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="education-recommendation-risk-level">Risk Level</Label>
                <Select value={newPatient.riskLevel} onValueChange={(v: any) => setNewPatient({ ...newPatient, riskLevel: v })}>
                  <SelectTrigger id="education-recommendation-risk-level" data-testid="select-risk-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending || !newPatient.id || !newPatient.name}
              data-testid="button-submit-generate"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {generateMutation.isPending ? "Generating..." : "Generate Recommendations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
