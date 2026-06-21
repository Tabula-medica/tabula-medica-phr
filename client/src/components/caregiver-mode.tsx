import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserCheck,
  Shield,
  Clock,
  Search,
  FileText,
  Share2,
  AlertTriangle,
  Calendar,
  Pill,
  Activity,
  Heart,
  ChevronRight,
  Eye,
  Link2,
  X,
  History,
  User,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string;
  primaryConditions: string[];
  lastAccessed: string | null;
}

interface CaregiverPermission {
  category: string;
  level: "full" | "read_only" | "emergency_only";
  canShare: boolean;
}

interface CaregiverDependent {
  dependent: Dependent;
  permissions: CaregiverPermission[];
  permissionExpiresAt: string | null;
  grantedBy: string;
  grantedAt: string;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  caregiverName: string;
  dependentName: string;
  action: string;
  resourceType: string;
  details: string;
  timestamp: string;
}

interface SharedSnapshot {
  id: string;
  dependentName: string;
  snapshotType: string;
  title: string;
  createdAt: string;
  expiresAt: string | null;
  accessCount: number;
  isRevoked: boolean;
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  provider: string | null;
  status: "normal" | "attention" | "critical";
}

interface CaregiverStats {
  totalDependents: number;
  activeDependents: number;
  sharedSnapshotsCount: number;
  recentActionsCount: number;
  permissionsExpiringSoon: number;
}

const permissionLevelColors: Record<string, string> = {
  full: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  read_only: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  emergency_only: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

const eventTypeIcons: Record<string, typeof Activity> = {
  lab: Activity,
  appointment: Calendar,
  medication: Pill,
  document: FileText,
  vitals: Heart,
  procedure: Activity,
};

const statusColors: Record<string, string> = {
  normal: "border-l-green-500",
  attention: "border-l-yellow-500",
  critical: "border-l-red-500",
};

function DependentProfile({ dependent, onSelect }: { dependent: CaregiverDependent; onSelect: () => void }) {
  const daysUntilExpiry = dependent.permissionExpiresAt
    ? Math.ceil((new Date(dependent.permissionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div
      className="p-4 rounded-lg border hover-elevate cursor-pointer"
      onClick={onSelect}
      data-testid={`card-dependent-${dependent.dependent.id}`}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold" data-testid={`text-dependent-name-${dependent.dependent.id}`}>
              {dependent.dependent.name}
            </p>
            <Badge variant="outline">{dependent.dependent.relationship}</Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {dependent.dependent.primaryConditions.slice(0, 2).map((c, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {c}
              </Badge>
            ))}
            {dependent.dependent.primaryConditions.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{dependent.dependent.primaryConditions.length - 2}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            {dependent.dependent.lastAccessed && (
              <span>Last viewed: {new Date(dependent.dependent.lastAccessed).toLocaleDateString()}</span>
            )}
            {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
              <span className="flex items-center gap-1 text-orange-600">
                <Clock className="h-3 w-3" />
                Expires in {daysUntilExpiry} days
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  );
}

function DependentDetail({
  dependent,
  onBack,
}: {
  dependent: CaregiverDependent;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("timeline");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: timeline, isLoading: timelineLoading } = useQuery<{ events: TimelineEvent[] }>({
    queryKey: ["/api/caregiver/dependents", dependent.dependent.id, "timeline"],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver/dependents/${dependent.dependent.id}/timeline`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
  });

  const { data: searchResults } = useQuery<Array<{ id: string; type: string; title: string; date: string }>>({
    queryKey: ["/api/caregiver/dependents", dependent.dependent.id, "search", searchQuery],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver/dependents/${dependent.dependent.id}/search/${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const { data: snapshots } = useQuery<SharedSnapshot[]>({
    queryKey: ["/api/caregiver/snapshots", dependent.dependent.id],
    queryFn: async () => {
      const res = await fetch(`/api/caregiver/snapshots/${dependent.dependent.id}`);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    enabled: activeTab === "share",
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async (data: { snapshotType: string; title: string }) => {
      const response = await apiRequest("POST", "/api/caregiver/snapshots", {
        dependentId: dependent.dependent.id,
        ...data,
      });
      if (!response.ok) throw new Error("Failed to create snapshot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/snapshots"] });
      toast({ title: "Snapshot Created", description: "Shareable link is ready" });
    },
  });

  const revokeSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      const response = await apiRequest("DELETE", `/api/caregiver/snapshots/${snapshotId}`, {});
      if (!response.ok) throw new Error("Failed to revoke");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/caregiver/snapshots"] });
      toast({ title: "Snapshot Revoked" });
    },
  });

  const daysUntilExpiry = dependent.permissionExpiresAt
    ? Math.ceil((new Date(dependent.permissionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-dependents">
        ← Back to dependents
      </Button>

      <div className="flex items-start gap-4">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-semibold" data-testid="text-dependent-detail-name">
            {dependent.dependent.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {dependent.dependent.relationship} • Born {new Date(dependent.dependent.dateOfBirth).toLocaleDateString()}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              Granted by {dependent.grantedBy}
            </Badge>
            {daysUntilExpiry !== null && (
              <Badge
                variant="outline"
                className={daysUntilExpiry <= 30 ? "border-orange-500 text-orange-600" : ""}
              >
                <Clock className="h-3 w-3 mr-1" />
                {daysUntilExpiry > 0 ? `${daysUntilExpiry} days left` : "Expired"}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {dependent.permissions.map((p) => (
          <div
            key={p.category}
            className="p-2 rounded-lg bg-muted/50 text-center"
            data-testid={`permission-${p.category}`}
          >
            <p className="text-xs text-muted-foreground capitalize">{p.category}</p>
            <Badge className={`mt-1 ${permissionLevelColors[p.level]}`}>
              {p.level.replace("_", " ")}
            </Badge>
            {p.canShare && (
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-green-600">
                <Share2 className="h-3 w-3" />
                <span>Can share</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-search">Search</TabsTrigger>
          <TabsTrigger value="share" data-testid="tab-share">Share</TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">Access</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-3">
          {timelineLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : timeline?.events && timeline.events.length > 0 ? (
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-4">
                {timeline.events.map((evt) => {
                  const Icon = eventTypeIcons[evt.type] || Activity;
                  return (
                    <div
                      key={evt.id}
                      className={`p-3 rounded-lg border-l-4 bg-muted/30 ${statusColors[evt.status]}`}
                      data-testid={`timeline-event-${evt.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{evt.title}</p>
                          <p className="text-xs text-muted-foreground">{evt.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <span>{new Date(evt.date).toLocaleDateString()}</span>
                            {evt.provider && (
                              <>
                                <span>•</span>
                                <span>{evt.provider}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No recent events</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search health records..."
              className="pl-9"
              data-testid="input-search-records"
            />
          </div>
          {searchQuery.length >= 2 && searchResults && searchResults.length > 0 ? (
            <ScrollArea className="h-[240px]">
              <div className="space-y-2 pr-4">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-3 rounded-lg border hover-elevate cursor-pointer"
                    data-testid={`search-result-${result.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge variant="outline" className="text-xs mb-1">
                          {result.type}
                        </Badge>
                        <p className="font-medium text-sm">{result.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(result.date).toLocaleDateString()}
                        </p>
                      </div>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : searchQuery.length >= 2 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results found</p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Type at least 2 characters to search</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="share" className="space-y-3">
          <div className="flex gap-2">
            <Select
              onValueChange={(type) =>
                createSnapshotMutation.mutate({
                  snapshotType: type,
                  title: `${type.charAt(0).toUpperCase() + type.slice(1)} Summary - ${new Date().toLocaleDateString()}`,
                })
              }
            >
              <SelectTrigger className="flex-1" data-testid="select-snapshot-type">
                <SelectValue placeholder="Create new snapshot..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinical" data-testid="option-clinical">Clinical Summary</SelectItem>
                <SelectItem value="medications" data-testid="option-medications">Medications List</SelectItem>
                <SelectItem value="appointments" data-testid="option-appointments">Appointments</SelectItem>
                <SelectItem value="full" data-testid="option-full">Full Record</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {snapshots && snapshots.length > 0 ? (
            <ScrollArea className="h-[220px]">
              <div className="space-y-2 pr-4">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-3 rounded-lg border"
                    data-testid={`snapshot-${snap.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Link2 className="h-4 w-4 text-primary" />
                          <p className="font-medium text-sm">{snap.title}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>Created {new Date(snap.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{snap.accessCount} views</span>
                          {snap.expiresAt && (
                            <>
                              <span>•</span>
                              <span>Expires {new Date(snap.expiresAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => revokeSnapshotMutation.mutate(snap.id)}
                        data-testid={`button-revoke-${snap.id}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Share2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No shared snapshots yet</p>
              <p className="text-xs mt-1">Create one to share with providers</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-3">
          <div className="space-y-2">
            {dependent.permissions.map((p) => (
              <div
                key={p.category}
                className="flex items-center justify-between p-3 rounded-lg border"
                data-testid={`access-permission-${p.category}`}
              >
                <div className="flex items-center gap-2">
                  {p.level === "full" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : p.level === "read_only" ? (
                    <Eye className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-orange-600" />
                  )}
                  <span className="capitalize font-medium">{p.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={permissionLevelColors[p.level]}>
                    {p.level.replace("_", " ")}
                  </Badge>
                  {p.canShare && (
                    <Badge variant="outline" className="text-xs">
                      <Share2 className="h-3 w-3 mr-1" />
                      Shareable
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissions granted by {dependent.grantedBy} on{" "}
              {new Date(dependent.grantedAt).toLocaleDateString()}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditTrailView() {
  const { data: auditEntries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/caregiver/audit"],
  });

  const actionColors: Record<string, string> = {
    view: "bg-blue-100 text-blue-700 dark:bg-blue-900/30",
    share: "bg-purple-100 text-purple-700 dark:bg-purple-900/30",
    update: "bg-green-100 text-green-700 dark:bg-green-900/30",
    search: "bg-gray-100 text-gray-700 dark:bg-gray-800",
    revoke: "bg-red-100 text-red-700 dark:bg-red-900/30",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="h-4 w-4" />
        <span>All caregiver actions are logged for security and compliance</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : auditEntries && auditEntries.length > 0 ? (
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 pr-4">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 rounded-lg border"
                data-testid={`audit-entry-${entry.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={actionColors[entry.action] || actionColors.view}>
                        {entry.action}
                      </Badge>
                      <Badge variant="outline">{entry.resourceType}</Badge>
                    </div>
                    <p className="text-sm">{entry.details}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {entry.dependentName} • {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No audit entries yet</p>
        </div>
      )}
    </div>
  );
}

export function CaregiverMode() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedDependent, setSelectedDependent] = useState<CaregiverDependent | null>(null);
  const [mainTab, setMainTab] = useState("dependents");

  const { data: dependents, isLoading } = useQuery<CaregiverDependent[]>({
    queryKey: ["/api/caregiver/dependents"],
    enabled: open,
  });

  const { data: stats } = useQuery<CaregiverStats>({
    queryKey: ["/api/caregiver/stats"],
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-caregiver-mode">
          <Users className="h-4 w-4" />
          Caregiver Mode
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Caregiver Mode
          </DialogTitle>
          <DialogDescription>
            Manage health records for your dependents with full audit trail
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {selectedDependent ? (
            <ScrollArea className="h-[500px] pr-4">
              <DependentDetail
                dependent={selectedDependent}
                onBack={() => setSelectedDependent(null)}
              />
            </ScrollArea>
          ) : (
            <div className="space-y-4">
              {stats && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-dependents">
                      {stats.activeDependents}
                    </p>
                    <p className="text-xs text-muted-foreground">Dependents</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-snapshots">
                      {stats.sharedSnapshotsCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Shared</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-xl font-bold" data-testid="text-stat-actions">
                      {stats.recentActionsCount}
                    </p>
                    <p className="text-xs text-muted-foreground">Actions (7d)</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <p
                      className={`text-xl font-bold ${stats.permissionsExpiringSoon > 0 ? "text-orange-600" : ""}`}
                      data-testid="text-stat-expiring"
                    >
                      {stats.permissionsExpiringSoon}
                    </p>
                    <p className="text-xs text-muted-foreground">Expiring</p>
                  </div>
                </div>
              )}

              <Tabs value={mainTab} onValueChange={setMainTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="dependents" data-testid="tab-dependents">
                    <User className="h-4 w-4 mr-2" />
                    Dependents
                  </TabsTrigger>
                  <TabsTrigger value="audit" data-testid="tab-audit">
                    <History className="h-4 w-4 mr-2" />
                    Audit Trail
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="dependents" className="space-y-3">
                  {isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-24" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : dependents && dependents.length > 0 ? (
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3 pr-4">
                        {dependents.map((dep) => (
                          <DependentProfile
                            key={dep.dependent.id}
                            dependent={dep}
                            onSelect={() => setSelectedDependent(dep)}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Users className="h-10 w-10 text-muted-foreground mb-3" />
                      <p className="font-medium">No dependents yet</p>
                      <p className="text-sm text-muted-foreground">
                        Ask your family members to grant you caregiver access
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="audit">
                  <AuditTrailView />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CaregiverModeCard() {
  const { data: stats } = useQuery<CaregiverStats>({
    queryKey: ["/api/caregiver/stats"],
  });

  return (
    <Card data-testid="card-caregiver-mode">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5 text-primary" />
          Caregiver Mode
          {stats && stats.permissionsExpiringSoon > 0 && (
            <Badge className="ml-auto" variant="outline">
              {stats.permissionsExpiringSoon} expiring soon
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Manage health records for your loved ones</CardDescription>
      </CardHeader>
      <CardContent>
        <CaregiverMode />
        {stats && stats.activeDependents > 0 && (
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>{stats.activeDependents} dependents</span>
            <span>•</span>
            <span>{stats.sharedSnapshotsCount} shared snapshots</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
