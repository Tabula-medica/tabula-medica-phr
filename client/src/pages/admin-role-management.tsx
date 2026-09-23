import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import { 
  Shield, Users, UserPlus, Settings, Brain, CheckCircle2, 
  AlertTriangle, ArrowUp, ArrowDown, Minus, Eye, ChevronRight,
  Search, Lock, Unlock, FileText, Activity, BarChart3
} from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
  resource?: string;
  actions: string[];
}

interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string;
  permissions: string[];
  isSystemRole: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
}

interface UserAssignment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  roleId: string;
  roleName: string;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  reason?: string;
  isActive: boolean;
}

interface RoleSuggestion {
  id: string;
  userId: string;
  userName: string;
  currentRole?: string;
  suggestedRole: string;
  confidence: number;
  reasoning: string;
  factors: { factor: string; weight: string; description: string }[];
  dataSensitivityLevel: string;
  activityPatterns: string[];
  recommendation: string;
  createdAt: string;
}

interface RoleStats {
  totalRoles: number;
  totalUsers: number;
  activeAssignments: number;
  systemRoles: number;
  customRoles: number;
}

export default function AdminRoleManagement() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ userId: "", userName: "", userEmail: "", roleId: "", reason: "" });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery<RoleStats>({
    queryKey: ["/api/role-management/stats"],
  });

  const { data: rolesData } = useQuery<{ roles: Role[] }>({
    queryKey: ["/api/role-management/roles"],
  });

  const { data: assignmentsData } = useQuery<{ assignments: UserAssignment[] }>({
    queryKey: ["/api/role-management/assignments"],
  });

  const { data: permissionsData } = useQuery<{ permissions: Permission[] }>({
    queryKey: ["/api/role-management/permissions"],
  });

  const { data: suggestionsData, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<{ suggestions: RoleSuggestion[] }>({
    queryKey: ["/api/role-management/ai-suggestions"],
    enabled: activeTab === "ai-suggestions",
  });

  const assignRoleMutation = useMutation({
    mutationFn: async (data: typeof newAssignment) => {
      return apiRequest("POST", "/api/role-management/assignments", { ...data, assignedBy: "admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-management/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/role-management/stats"] });
      toast({ title: "Role Assigned", description: "User role has been assigned successfully." });
      setAssignDialogOpen(false);
      setNewAssignment({ userId: "", userName: "", userEmail: "", roleId: "", reason: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to assign role.", variant: "destructive" });
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      return apiRequest("DELETE", `/api/role-management/assignments/${assignmentId}`, { revokedBy: "admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-management/assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/role-management/stats"] });
      toast({ title: "Role Revoked", description: "User role has been revoked successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke role.", variant: "destructive" });
    },
  });

  const roles = rolesData?.roles || [];
  const assignments = assignmentsData?.assignments || [];
  const permissions = permissionsData?.permissions || [];
  const suggestions = suggestionsData?.suggestions || [];
  const stats = statsData || { totalRoles: 0, totalUsers: 0, activeAssignments: 0, systemRoles: 0, customRoles: 0 };

  const filteredAssignments = assignments.filter(
    (a) =>
      a.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.roleName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedPermissions = permissions.reduce((acc, perm) => {
    if (!acc[perm.category]) acc[perm.category] = [];
    acc[perm.category].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "fhir_data": return <FileText className="h-4 w-4" />;
      case "admin": return <Settings className="h-4 w-4" />;
      case "export": return <Activity className="h-4 w-4" />;
      case "audit": return <Eye className="h-4 w-4" />;
      case "ai_features": return <Brain className="h-4 w-4" />;
      case "patient_portal": return <Users className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getRecommendationBadge = (recommendation: string, id: string) => {
    switch (recommendation) {
      case "upgrade":
        return <Badge variant="default" data-testid={`badge-recommendation-${id}`}><ArrowUp className="h-3 w-3 mr-1" />Upgrade</Badge>;
      case "downgrade":
        return <Badge variant="secondary" data-testid={`badge-recommendation-${id}`}><ArrowDown className="h-3 w-3 mr-1" />Downgrade</Badge>;
      case "maintain":
        return <Badge variant="outline" data-testid={`badge-recommendation-${id}`}><CheckCircle2 className="h-3 w-3 mr-1" />Maintain</Badge>;
      case "review":
        return <Badge variant="destructive" data-testid={`badge-recommendation-${id}`}><AlertTriangle className="h-3 w-3 mr-1" />Review</Badge>;
      default:
        return <Badge variant="secondary" data-testid={`badge-recommendation-${id}`}><Minus className="h-3 w-3 mr-1" />Unknown</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">User Role Management</h1>
          <p className="text-muted-foreground">Manage user roles, permissions, and access controls</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-roles">{stats.totalRoles}</p>
                <p className="text-xs text-muted-foreground">Total Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{stats.totalUsers}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-active-assignments">{stats.activeAssignments}</p>
                <p className="text-xs text-muted-foreground">Active Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-system-roles">{stats.systemRoles}</p>
                <p className="text-xs text-muted-foreground">System Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="text-custom-roles">{stats.customRoles}</p>
                <p className="text-xs text-muted-foreground">Custom Roles</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="h-4 w-4 mr-2" />Overview
          </TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-roles">
            <Shield className="h-4 w-4 mr-2" />Roles
          </TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users">
            <Users className="h-4 w-4 mr-2" />User Assignments
          </TabsTrigger>
          <TabsTrigger value="permissions" data-testid="tab-permissions">
            <Lock className="h-4 w-4 mr-2" />Permissions
          </TabsTrigger>
          <TabsTrigger value="ai-suggestions" data-testid="tab-ai-suggestions">
            <Brain className="h-4 w-4 mr-2" />AI Suggestions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Role Distribution
                </CardTitle>
                <CardDescription>Users per role</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {roles.slice(0, 6).map((role) => (
                    <div key={role.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={role.isSystemRole ? "secondary" : "outline"}>
                          {role.isSystemRole ? <Lock className="h-3 w-3 mr-1" /> : <Unlock className="h-3 w-3 mr-1" />}
                          {role.displayName}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full" 
                            style={{ width: `${Math.min(100, ((role.userCount || 0) / 50) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">{role.userCount || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Assignments
                </CardTitle>
                <CardDescription>Latest role changes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignments.slice(0, 5).map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium text-sm">{assignment.userName}</p>
                        <p className="text-xs text-muted-foreground">{assignment.userEmail}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline">{assignment.roleName}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(assignment.assignedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Available Roles</CardTitle>
                  <CardDescription>Click a role to view details</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <div
                          key={role.id}
                          className={`p-3 rounded-lg cursor-pointer hover-elevate ${selectedRole?.id === role.id ? "bg-primary/10 border border-primary" : "bg-muted/50"}`}
                          {...clickable(() => setSelectedRole(role))}
                          data-testid={`role-item-${role.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {role.isSystemRole ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Unlock className="h-4 w-4 text-muted-foreground" />}
                              <span className="font-medium">{role.displayName}</span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">{role.userCount || 0} users</Badge>
                            <Badge variant="outline" className="text-xs">{role.permissions.length} permissions</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              {selectedRole ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedRole.isSystemRole ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                          {selectedRole.displayName}
                        </CardTitle>
                        <CardDescription>{selectedRole.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={selectedRole.isActive ? "default" : "secondary"}>
                          {selectedRole.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {selectedRole.isSystemRole && <Badge variant="outline">System Role</Badge>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Role Permissions ({selectedRole.permissions.length})</h4>
                        <ScrollArea className="h-[300px]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {selectedRole.permissions.map((permId) => {
                              const perm = permissions.find((p) => p.id === permId);
                              return (
                                <div key={permId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <div>
                                    <p className="text-sm font-medium">{perm?.name || permId}</p>
                                    {perm && <p className="text-xs text-muted-foreground">{perm.description}</p>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Assigned Users</h4>
                        <div className="space-y-2">
                          {assignments.filter((a) => a.roleId === selectedRole.id && a.isActive).slice(0, 5).map((assignment) => (
                            <div key={assignment.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                              <div>
                                <p className="text-sm font-medium">{assignment.userName}</p>
                                <p className="text-xs text-muted-foreground">{assignment.userEmail}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Assigned {new Date(assignment.assignedAt).toLocaleDateString()}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-[500px] text-muted-foreground">
                    <Shield className="h-12 w-12 mb-4 opacity-50" />
                    <p>Select a role to view its details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>User Role Assignments</CardTitle>
                  <CardDescription>Manage user access and permissions</CardDescription>
                </div>
                <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-assign-role">
                      <UserPlus className="h-4 w-4 mr-2" />Assign Role
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Role to User</DialogTitle>
                      <DialogDescription>Assign a role to grant specific permissions</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="admin-role-management-user-id">User ID</Label>
                        <Input id="admin-role-management-user-id"
                          placeholder="user-xxx"
                          value={newAssignment.userId}
                          onChange={(e) => setNewAssignment({ ...newAssignment, userId: e.target.value })}
                          data-testid="input-user-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-role-management-user-name">User Name</Label>
                        <Input id="admin-role-management-user-name"
                          placeholder="John Doe"
                          value={newAssignment.userName}
                          onChange={(e) => setNewAssignment({ ...newAssignment, userName: e.target.value })}
                          data-testid="input-user-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-role-management-email">Email</Label>
                        <Input id="admin-role-management-email"
                          type="email"
                          placeholder="user@example.com"
                          value={newAssignment.userEmail}
                          onChange={(e) => setNewAssignment({ ...newAssignment, userEmail: e.target.value })}
                          data-testid="input-user-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-role-management-role">Role</Label>
                        <Select value={newAssignment.roleId} onValueChange={(v) => setNewAssignment({ ...newAssignment, roleId: v })}>
                          <SelectTrigger id="admin-role-management-role" data-testid="select-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="admin-role-management-reason-optional">Reason (Optional)</Label>
                        <Input id="admin-role-management-reason-optional"
                          placeholder="Reason for assignment"
                          value={newAssignment.reason}
                          onChange={(e) => setNewAssignment({ ...newAssignment, reason: e.target.value })}
                          data-testid="input-reason"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
                      <Button
                        onClick={() => assignRoleMutation.mutate(newAssignment)}
                        disabled={!newAssignment.userId || !newAssignment.userName || !newAssignment.userEmail || !newAssignment.roleId || assignRoleMutation.isPending}
                        data-testid="button-confirm-assign"
                      >
                        {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-users"
                  />
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredAssignments.map((assignment) => (
                    <div key={assignment.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{assignment.userName}</p>
                          <p className="text-sm text-muted-foreground">{assignment.userEmail}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <Badge variant={assignment.isActive ? "default" : "secondary"}>{assignment.roleName}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Assigned by {assignment.assignedBy} on {new Date(assignment.assignedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => revokeRoleMutation.mutate(assignment.id)}
                          disabled={revokeRoleMutation.isPending}
                          data-testid={`button-revoke-${assignment.id}`}
                        >
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permission Catalog</CardTitle>
              <CardDescription>All available permissions organized by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {getCategoryIcon(category)}
                        {category.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                          {perms.map((perm) => (
                            <div key={perm.id} className="p-2 rounded-lg bg-muted/50">
                              <div className="flex items-center gap-2">
                                <Checkbox checked disabled />
                                <span className="text-sm font-medium">{perm.name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground ml-6 mt-1">{perm.description}</p>
                              <div className="flex gap-1 ml-6 mt-1">
                                {perm.actions.map((action) => (
                                  <Badge key={action} variant="outline" className="text-xs">{action}</Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-suggestions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Role Suggestions
                  </CardTitle>
                  <CardDescription>
                    AI-powered recommendations based on user activity and data sensitivity
                  </CardDescription>
                </div>
                <Button onClick={() => refetchSuggestions()} disabled={suggestionsLoading} data-testid="button-refresh-suggestions">
                  {suggestionsLoading ? "Analyzing..." : "Refresh Analysis"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <Brain className="h-12 w-12 mx-auto mb-4 animate-pulse text-primary" />
                    <p className="text-muted-foreground">Analyzing user activities...</p>
                  </div>
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => (
                    <Card key={suggestion.id} className="border-l-4" style={{ borderLeftColor: suggestion.recommendation === "upgrade" ? "#3b82f6" : suggestion.recommendation === "review" ? "#f59e0b" : "#22c55e" }}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{suggestion.userName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {suggestion.currentRole || "No role"} {" -> "} 
                                  <span className="font-medium text-foreground">{suggestion.suggestedRole}</span>
                                </p>
                              </div>
                            </div>
                            <p className="text-sm mb-3">{suggestion.reasoning}</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                              {getRecommendationBadge(suggestion.recommendation, suggestion.id)}
                              <Badge variant="outline">
                                Confidence: {suggestion.confidence}%
                              </Badge>
                              <Badge variant={suggestion.dataSensitivityLevel === "high" ? "destructive" : suggestion.dataSensitivityLevel === "medium" ? "default" : "secondary"}>
                                {suggestion.dataSensitivityLevel} sensitivity
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Analysis Factors:</p>
                              {suggestion.factors.map((factor, i) => (
                                <div key={i} className="flex items-start gap-2 text-sm">
                                  <Badge variant={factor.weight === "high" ? "default" : factor.weight === "medium" ? "secondary" : "outline"} className="text-xs">
                                    {factor.weight}
                                  </Badge>
                                  <div>
                                    <span className="font-medium">{factor.factor}:</span>{" "}
                                    <span className="text-muted-foreground">{factor.description}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {suggestion.activityPatterns.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1">Activity Patterns:</p>
                                <div className="flex flex-wrap gap-1">
                                  {suggestion.activityPatterns.map((pattern, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">{pattern}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <Button
                              onClick={() => {
                                const role = roles.find((r) => r.id === suggestion.suggestedRole || r.name === suggestion.suggestedRole);
                                if (role) {
                                  setNewAssignment({
                                    userId: suggestion.userId,
                                    userName: suggestion.userName,
                                    userEmail: "",
                                    roleId: role.id,
                                    reason: `AI recommendation: ${suggestion.reasoning}`,
                                  });
                                  setAssignDialogOpen(true);
                                }
                              }}
                              data-testid={`button-apply-suggestion-${suggestion.id}`}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Brain className="h-12 w-12 mb-4 opacity-50" />
                  <p>No suggestions available</p>
                  <p className="text-sm">Click "Refresh Analysis" to generate AI recommendations</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
