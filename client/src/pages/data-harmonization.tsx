import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, Link2, CheckCircle, AlertTriangle, RefreshCw, 
  Database, GitMerge, Sparkles, Search, Shield, AlertCircle,
  FileText, User, Layers, XCircle, Eye
} from "lucide-react";

export default function DataHarmonization() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("overview");
  const [matchFilter, setMatchFilter] = useState<string>("all");

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ["/api/data-harmonization/stats"],
    refetchInterval: 30000
  });

  const { data: unifiedRecords, isLoading: unifiedLoading } = useQuery<any>({
    queryKey: ["/api/data-harmonization/unified-records"]
  });

  const { data: matchCandidates, isLoading: matchesLoading } = useQuery<any>({
    queryKey: ["/api/data-harmonization/match-candidates", { status: matchFilter !== 'all' ? matchFilter : undefined }]
  });

  const { data: rules } = useQuery<any>({
    queryKey: ["/api/data-harmonization/rules"]
  });

  const confirmMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await apiRequest("PATCH", `/api/data-harmonization/matches/${matchId}/confirm`, { reviewedBy: "admin" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-harmonization/match-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-harmonization/stats"] });
      toast({ title: "Match Confirmed", description: "Patient records have been linked" });
    }
  });

  const rejectMatchMutation = useMutation({
    mutationFn: async (matchId: string) => {
      const res = await apiRequest("PATCH", `/api/data-harmonization/matches/${matchId}/reject`, { reviewedBy: "admin" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-harmonization/match-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-harmonization/stats"] });
      toast({ title: "Match Rejected" });
    }
  });

  if (statsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitMerge className="w-6 h-6 text-primary" />
            AI Data Harmonization Engine
          </h1>
          <p className="text-muted-foreground">
            Unified patient views across disparate FHIR sources with intelligent matching and conflict resolution
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/data-harmonization"] })} data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Unified Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unifiedRecords || 0}</div>
            <p className="text-xs text-muted-foreground">
              From {stats?.totalPatients || 0} source records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Pending Matches</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingMatches || 0}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{stats?.resolvedConflicts || 0}</div>
            <p className="text-xs text-muted-foreground">
              Resolved | {stats?.unresolvedConflicts || 0} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.avgDataQuality || 0) * 100).toFixed(0)}%</div>
            <Progress value={(stats?.avgDataQuality || 0) * 100} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card className="text-sm text-muted-foreground p-3 bg-muted/50 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        This harmonized data is for informational purposes only. Not for clinical decision-making.
      </Card>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList data-testid="tabs-harmonization">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="unified" data-testid="tab-unified">Unified Records</TabsTrigger>
          <TabsTrigger value="matches" data-testid="tab-matches">Match Review</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Harmonization Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Harmonization Summary</CardTitle>
                <CardDescription>AI-powered patient record unification</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" />
                      <span className="text-sm">Sources Connected</span>
                    </div>
                    <span className="font-medium">{stats?.sourcesCovered || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="text-sm">AI Enrichments</span>
                    </div>
                    <span className="font-medium">{stats?.enrichmentsGenerated || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">Auto-Linked Records</span>
                    </div>
                    <span className="font-medium">{matchCandidates?.summary?.autoLinked || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Match Statistics</CardTitle>
                <CardDescription>Patient record matching status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <CheckCircle className="w-6 h-6 mx-auto text-green-500" />
                    <div className="text-lg font-bold mt-2">{matchCandidates?.summary?.confirmed || 0}</div>
                    <div className="text-xs text-muted-foreground">Confirmed</div>
                  </div>
                  <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                    <AlertTriangle className="w-6 h-6 mx-auto text-yellow-500" />
                    <div className="text-lg font-bold mt-2">{matchCandidates?.summary?.pending || 0}</div>
                    <div className="text-xs text-muted-foreground">Pending Review</div>
                  </div>
                  <div className="text-center p-4 bg-blue-500/10 rounded-lg">
                    <Link2 className="w-6 h-6 mx-auto text-blue-500" />
                    <div className="text-lg font-bold mt-2">{matchCandidates?.summary?.autoLinked || 0}</div>
                    <div className="text-xs text-muted-foreground">Auto-Linked</div>
                  </div>
                  <div className="text-center p-4 bg-red-500/10 rounded-lg">
                    <XCircle className="w-6 h-6 mx-auto text-red-500" />
                    <div className="text-lg font-bold mt-2">{matchCandidates?.summary?.rejected || 0}</div>
                    <div className="text-xs text-muted-foreground">Rejected</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unified" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unified Patient Records</CardTitle>
              <CardDescription>Consolidated patient views across all data sources</CardDescription>
            </CardHeader>
            <CardContent>
              {unifiedLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : unifiedRecords?.records?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-2" />
                  No unified records yet
                </div>
              ) : (
                <div className="space-y-4">
                  {unifiedRecords?.records?.map((record: any) => (
                    <div key={record.id} className="p-4 border rounded-lg space-y-3 hover-elevate">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {record.canonicalData.name.given.join(' ')} {record.canonicalData.name.family}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              DOB: {record.canonicalData.birthDate.value} | {record.canonicalData.gender.value}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{record.linkedRecords.length} Sources</Badge>
                          <Badge variant="secondary">
                            Quality: {(record.dataQuality.overall * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-muted-foreground">Completeness</div>
                          <div className="font-medium">{(record.dataQuality.completeness * 100).toFixed(0)}%</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-muted-foreground">Consistency</div>
                          <div className="font-medium">{(record.dataQuality.consistency * 100).toFixed(0)}%</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-muted-foreground">Accuracy</div>
                          <div className="font-medium">{(record.dataQuality.accuracy * 100).toFixed(0)}%</div>
                        </div>
                        <div className="p-2 bg-muted/50 rounded">
                          <div className="text-muted-foreground">Conflicts</div>
                          <div className="font-medium">{record.conflicts.filter((c: any) => c.status === 'unresolved').length} open</div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {record.sources.map((source: any) => (
                          <Badge key={source.id} variant="outline" className="text-xs">
                            {source.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded flex items-center gap-2">
            <AlertCircle className="w-3 h-3" />
            Patient matching is for data governance purposes. Verify with authoritative sources before making care decisions.
          </div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">Match Candidates</CardTitle>
                <CardDescription>Review and confirm potential patient matches</CardDescription>
              </div>
              <Select value={matchFilter} onValueChange={setMatchFilter}>
                <SelectTrigger className="w-40" data-testid="select-match-filter">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Matches</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {matchesLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
                </div>
              ) : matchCandidates?.candidates?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Link2 className="w-12 h-12 mx-auto mb-2" />
                  No match candidates
                </div>
              ) : (
                <div className="space-y-4">
                  {matchCandidates?.candidates?.map((match: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={match.matchType === 'deterministic' ? 'default' : 'secondary'}>
                            {match.matchType}
                          </Badge>
                          <span className="font-medium">
                            Match Score: {(match.matchScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Badge variant={match.status === 'pending_review' ? 'secondary' : match.status === 'confirmed' ? 'default' : 'outline'}>
                          {match.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">{match.recordA.sourceName}</div>
                          <div className="font-medium text-sm">
                            {match.recordA.data.name?.[0]?.given?.join(' ')} {match.recordA.data.name?.[0]?.family}
                          </div>
                          <div className="text-xs">DOB: {match.recordA.data.birthDate}</div>
                        </div>
                        <div className="p-3 bg-muted/50 rounded-lg">
                          <div className="text-xs text-muted-foreground mb-1">{match.recordB.sourceName}</div>
                          <div className="font-medium text-sm">
                            {match.recordB.data.name?.[0]?.given?.join(' ')} {match.recordB.data.name?.[0]?.family}
                          </div>
                          <div className="text-xs">DOB: {match.recordB.data.birthDate}</div>
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {match.matchDetails.map((detail: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {detail.field}: {(detail.similarity * 100).toFixed(0)}%
                          </Badge>
                        ))}
                      </div>

                      {match.status === 'pending_review' && (
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rejectMatchMutation.mutate(`${match.recordA.id}-${match.recordB.id}`)}
                            disabled={rejectMatchMutation.isPending}
                            data-testid={`button-reject-${idx}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => confirmMatchMutation.mutate(`${match.recordA.id}-${match.recordB.id}`)}
                            disabled={confirmMatchMutation.isPending}
                            data-testid={`button-confirm-${idx}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Confirm Match
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Harmonization Rules</CardTitle>
              <CardDescription>Configure data reconciliation and conflict resolution rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rules?.rules?.map((rule: any) => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg hover-elevate">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <div>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Field: {rule.field} | Action: {rule.action}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Priority: {rule.priority}</Badge>
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
