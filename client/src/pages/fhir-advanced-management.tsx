import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Users,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface BulkOperation {
  id: string;
  name: string;
  description?: string;
  operation: "create" | "update" | "delete";
  status: "pending" | "in_progress" | "completed" | "failed" | "partial";
  targetSystems: string[];
  totalItems: number;
  processedItems: number;
  successCount: number;
  failedCount: number;
  createdAt: string;
}

interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  roles: string[];
  resourceTypes: string[];
  permissions: string[];
  priority: number;
  enabled: boolean;
}

interface SearchResult {
  resourceType: string;
  resourceId: string;
  data: Record<string, unknown>;
  source: string;
  lastUpdated: string;
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  executionTimeMs: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  in_progress: "default",
  completed: "default",
  failed: "destructive",
  partial: "outline",
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  in_progress: RefreshCw,
  completed: CheckCircle2,
  failed: XCircle,
  partial: AlertTriangle,
};

export default function FhirAdvancedManagement() {
  const [selectedTab, setSelectedTab] = useState("bulk");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-advanced-management">
            <Database className="h-8 w-8" />
            Advanced FHIR Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Bulk operations, access control policies, and advanced search
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md" data-testid="tabs-list-management">
          <TabsTrigger value="bulk" data-testid="tab-bulk-ops">
            <Layers className="h-4 w-4 mr-2" />
            Bulk Ops
          </TabsTrigger>
          <TabsTrigger value="access" data-testid="tab-access-control">
            <Shield className="h-4 w-4 mr-2" />
            Access Control
          </TabsTrigger>
          <TabsTrigger value="search" data-testid="tab-advanced-search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bulk" className="space-y-4 mt-4">
          <BulkOperationsTab />
        </TabsContent>

        <TabsContent value="access" className="space-y-4 mt-4">
          <AccessControlTab />
        </TabsContent>

        <TabsContent value="search" className="space-y-4 mt-4">
          <AdvancedSearchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BulkOperationsTab() {
  const [showNewOp, setShowNewOp] = useState(false);
  const { toast } = useToast();

  const { data: operations, refetch } = useQuery<{ success: boolean; data: BulkOperation[] }>({
    queryKey: ["/api/fhir-management/bulk/operations"],
  });

  const { data: systemsData } = useQuery<{ success: boolean; data: Array<{ id: string; name: string; status: string }> }>({
    queryKey: ["/api/fhir-management/bulk/systems"],
  });

  const { data: statsData } = useQuery<{ success: boolean; data: { total: number; pending: number; inProgress: number; completed: number; failed: number } }>({
    queryKey: ["/api/fhir-management/bulk/stats"],
  });

  const executeMutation = useMutation({
    mutationFn: async (operationId: string) => {
      return apiRequest("POST", `/api/fhir-management/bulk/${operationId}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-management/bulk/operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-management/bulk/stats"] });
      toast({ title: "Operation started", description: "Bulk operation is now executing" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start operation", variant: "destructive" });
    },
  });

  const stats = statsData?.data || { total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0 };
  const systems = systemsData?.data || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-bulk-total">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-300" data-testid="text-bulk-pending">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-300" data-testid="text-bulk-progress">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300" data-testid="text-bulk-completed">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-300" data-testid="text-bulk-failed">{stats.failed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Bulk Operations</CardTitle>
            <CardDescription>Create, update, or delete resources across EHR systems</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-bulk">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Dialog open={showNewOp} onOpenChange={setShowNewOp}>
              <DialogTrigger asChild>
                <Button data-testid="button-new-bulk-op">
                  <Plus className="h-4 w-4 mr-2" />
                  New Operation
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Bulk Operation</DialogTitle>
                  <DialogDescription>
                    Configure a bulk operation to run across multiple EHR systems
                  </DialogDescription>
                </DialogHeader>
                <NewBulkOperationForm systems={systems} onClose={() => setShowNewOp(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Systems</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operations?.data?.map((op) => {
                  const StatusIcon = statusIcons[op.status];
                  const progressPct = op.totalItems > 0 ? (op.processedItems / op.totalItems) * 100 : 0;
                  return (
                    <TableRow key={op.id} data-testid={`row-bulk-op-${op.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{op.name}</p>
                          {op.description && (
                            <p className="text-xs text-muted-foreground">{op.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{op.operation}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[op.status]}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {op.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <Progress value={progressPct} className="h-2" />
                          <p className="text-xs text-muted-foreground mt-1">
                            {op.processedItems}/{op.totalItems}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {op.targetSystems.slice(0, 2).map((sys) => (
                            <Badge key={sys} variant="secondary" className="text-xs">{sys}</Badge>
                          ))}
                          {op.targetSystems.length > 2 && (
                            <Badge variant="secondary" className="text-xs">+{op.targetSystems.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {op.status === "pending" && (
                          <Button 
                            size="sm" 
                            onClick={() => executeMutation.mutate(op.id)}
                            disabled={executeMutation.isPending}
                            data-testid={`button-execute-op-${op.id}`}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Execute
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!operations?.data || operations.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No bulk operations found. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function NewBulkOperationForm({ 
  systems, 
  onClose 
}: { 
  systems: Array<{ id: string; name: string; status: string }>; 
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [operation, setOperation] = useState<"create" | "update" | "delete">("update");
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [resourceType, setResourceType] = useState("Patient");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/fhir-management/bulk/create", {
        name,
        description,
        operation,
        targetSystems: selectedSystems,
        resources: [{ resourceType, payload: {} }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-management/bulk/operations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fhir-management/bulk/stats"] });
      toast({ title: "Operation created", description: "Bulk operation has been created" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create operation", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Operation Name</Label>
        <Input 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="Enter operation name"
          data-testid="input-bulk-op-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Description (optional)</Label>
        <Input 
          value={description} 
          onChange={(e) => setDescription(e.target.value)} 
          placeholder="Enter description"
          data-testid="input-bulk-op-desc"
        />
      </div>
      <div className="space-y-2">
        <Label>Operation Type</Label>
        <Select value={operation} onValueChange={(v) => setOperation(v as "create" | "update" | "delete")}>
          <SelectTrigger data-testid="select-bulk-op-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Resource Type</Label>
        <Select value={resourceType} onValueChange={setResourceType}>
          <SelectTrigger data-testid="select-bulk-resource-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Patient">Patient</SelectItem>
            <SelectItem value="Observation">Observation</SelectItem>
            <SelectItem value="Condition">Condition</SelectItem>
            <SelectItem value="MedicationRequest">MedicationRequest</SelectItem>
            <SelectItem value="Encounter">Encounter</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Target Systems</Label>
        <div className="grid grid-cols-2 gap-2">
          {systems.map((sys) => (
            <div key={sys.id} className="flex items-center space-x-2">
              <Checkbox
                id={`sys-${sys.id}`}
                checked={selectedSystems.includes(sys.id)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setSelectedSystems([...selectedSystems, sys.id]);
                  } else {
                    setSelectedSystems(selectedSystems.filter((s) => s !== sys.id));
                  }
                }}
                disabled={sys.status === "disconnected"}
                data-testid={`checkbox-sys-${sys.id}`}
              />
              <Label htmlFor={`sys-${sys.id}`} className="flex items-center gap-2">
                {sys.name}
                {sys.status === "disconnected" && (
                  <Badge variant="outline" className="text-xs">Offline</Badge>
                )}
              </Label>
            </div>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} data-testid="button-cancel-bulk-op">Cancel</Button>
        <Button 
          onClick={() => createMutation.mutate()}
          disabled={!name || selectedSystems.length === 0 || createMutation.isPending}
          data-testid="button-create-bulk-op"
        >
          {createMutation.isPending ? "Creating..." : "Create Operation"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AccessControlTab() {
  const { data: policiesData, refetch } = useQuery<{ success: boolean; data: AccessPolicy[] }>({
    queryKey: ["/api/fhir-management/access/policies"],
  });

  const { data: statsData } = useQuery<{ success: boolean; data: { totalPolicies: number; enabledPolicies: number; totalAuditEntries: number; allowedCount: number; deniedCount: number } }>({
    queryKey: ["/api/fhir-management/access/stats"],
  });

  const { data: rolesData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/fhir-management/access/roles"],
  });

  const stats = statsData?.data || { totalPolicies: 0, enabledPolicies: 0, totalAuditEntries: 0, allowedCount: 0, deniedCount: 0 };
  const policies = policiesData?.data || [];
  const roles = rolesData?.data || [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-access-total">{stats.totalPolicies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Policies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300" data-testid="text-access-active">{stats.enabledPolicies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Allowed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300" data-testid="text-access-allowed">{stats.allowedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-300" data-testid="text-access-denied">{stats.deniedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Access Policies</CardTitle>
              <CardDescription>Role-based and attribute-based access control</CardDescription>
            </div>
            <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-policies">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {policies.map((policy) => (
                  <div key={policy.id} className="p-4 border rounded-lg hover-elevate" data-testid={`card-policy-${policy.id}`}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{policy.name}</h4>
                          <Badge variant={policy.enabled ? "default" : "secondary"}>
                            {policy.enabled ? "Active" : "Disabled"}
                          </Badge>
                          <Badge variant="outline">Priority: {policy.priority}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{policy.description}</p>
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 flex-wrap">
                      <div>
                        <p className="text-xs text-muted-foreground">Roles</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {policy.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Resources</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {policy.resourceTypes.slice(0, 3).map((rt) => (
                            <Badge key={rt} variant="outline" className="text-xs">{rt}</Badge>
                          ))}
                          {policy.resourceTypes.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{policy.resourceTypes.length - 3}</Badge>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Permissions</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {policy.permissions.map((perm) => (
                            <Badge key={perm} variant="outline" className="text-xs">{perm}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Available user roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {roles.map((role) => (
                <div key={role} className="flex items-center gap-2 p-2 border rounded hover-elevate" data-testid={`item-role-${role}`}>
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{role}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdvancedSearchTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortField, setSortField] = useState("lastUpdated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const { data: resourceTypes } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/fhir-management/search/resource-types"],
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/fhir-management/search", {
        resourceTypes: selectedTypes,
        filters: [],
        sort: [{ field: sortField, order: sortOrder }],
        page,
        pageSize: 20,
        includeTotal: true,
        fullTextQuery: searchQuery || undefined,
      });
    },
    onError: () => {
      toast({ title: "Search failed", description: "Unable to execute search", variant: "destructive" });
    },
  });

  const results = searchMutation.data as { success: boolean; data: SearchResponse } | undefined;
  const searchResults = results?.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Advanced FHIR Search</CardTitle>
          <CardDescription>Search across all resources with complex filtering</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label>Full-text Search</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search resources..."
                  data-testid="input-fhir-search"
                  onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate()}
                />
                <Button 
                  onClick={() => searchMutation.mutate()}
                  disabled={searchMutation.isPending}
                  data-testid="button-execute-search"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {searchMutation.isPending ? "..." : "Search"}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div>
              <Label>Resource Types</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {resourceTypes?.data?.map((type) => (
                  <Badge
                    key={type}
                    variant={selectedTypes.includes(type) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedTypes.includes(type)) {
                        setSelectedTypes(selectedTypes.filter((t) => t !== type));
                      } else {
                        setSelectedTypes([...selectedTypes, type]);
                      }
                    }}
                    data-testid={`badge-filter-${type}`}
                  >
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <Label>Sort By</Label>
              <div className="flex gap-2 mt-1">
                <Select value={sortField} onValueChange={setSortField}>
                  <SelectTrigger className="w-40" data-testid="select-sort-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lastUpdated">Last Updated</SelectItem>
                    <SelectItem value="resourceType">Resource Type</SelectItem>
                    <SelectItem value="source">Source</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  data-testid="button-toggle-sort"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {searchMutation.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <span className="text-muted-foreground">Searching resources...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {searchResults && !searchMutation.isPending && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Search Results</CardTitle>
              <CardDescription>
                Found {searchResults.total} results in {searchResults.executionTimeMs}ms
              </CardDescription>
            </div>
            {searchResults.facets && (
              <div className="flex gap-2 flex-wrap">
                {searchResults.facets.resourceType?.slice(0, 3).map((f) => (
                  <Badge key={f.value} variant="outline" data-testid={`badge-facet-${f.value}`}>
                    {f.value}: {f.count}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.results.map((result, idx) => (
                    <TableRow key={`${result.resourceId}-${idx}`} data-testid={`row-search-result-${result.resourceId}`}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{result.resourceId}</p>
                          <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {JSON.stringify(result.data).substring(0, 60)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{result.resourceType}</Badge>
                      </TableCell>
                      <TableCell>{result.source}</TableCell>
                      <TableCell>{new Date(result.lastUpdated).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {result.score !== undefined && (
                          <Badge variant="outline">{result.score}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {searchResults.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => { setPage(page - 1); searchMutation.mutate(); }}
                  data-testid="button-prev-page"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {searchResults.page} of {searchResults.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === searchResults.totalPages}
                  onClick={() => { setPage(page + 1); searchMutation.mutate(); }}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
