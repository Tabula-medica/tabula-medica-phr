import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Users,
  Baby,
  Heart,
  Shield,
  Clock,
  Plus,
  Settings,
  Eye,
  Edit,
  Trash2,
  UserPlus,
  Calendar,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileText,
  Lock,
  Unlock,
  History,
  Bell,
  Mail,
  Phone,
  Home,
  Activity,
  Pill,
  ClipboardList,
} from "lucide-react";

// Local types for UI
interface Dependent {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  relationship: "child" | "elderly_parent" | "spouse" | "disabled_adult" | "other";
  isActive: boolean;
  profileImage?: string;
  pediatricInfo?: {
    schoolName?: string;
    gradeLevel?: string;
    immunizationsUpToDate: boolean;
    primaryCarePediatrician?: string;
  };
  elderlyInfo?: {
    livingArrangement: string;
    cognitiveStatus?: string;
    mobilityStatus?: string;
    fallRisk: boolean;
    advanceDirectives: boolean;
    healthcareProxy?: string;
  };
  healthSummary?: {
    activeMedications: number;
    activeConditions: number;
    upcomingAppointments: number;
    lastVisit?: string;
  };
  createdAt: string;
}

interface ProxyAccess {
  id: string;
  dependentId: string;
  dependentName: string;
  proxyName: string;
  proxyEmail: string;
  accessLevel: "full" | "limited" | "emergency_only" | "view_only";
  status: "active" | "pending" | "expired" | "revoked" | "suspended";
  permissions: string[];
  grantedAt: string;
  expiresAt?: string;
  lastAccessAt?: string;
  accessCount: number;
  approvalMethod: string;
}

interface AccessLog {
  id: string;
  proxyName: string;
  dependentName: string;
  action: string;
  resourceType: string;
  timestamp: string;
  success: boolean;
  ipAddress?: string;
}

// Mock data
const mockDependents: Dependent[] = [
  {
    id: "dep-1",
    firstName: "Emma",
    lastName: "Johnson",
    dateOfBirth: "2018-05-15",
    gender: "female",
    relationship: "child",
    isActive: true,
    pediatricInfo: {
      schoolName: "Lincoln Elementary",
      gradeLevel: "2nd Grade",
      immunizationsUpToDate: true,
      primaryCarePediatrician: "Dr. Sarah Chen",
    },
    healthSummary: {
      activeMedications: 1,
      activeConditions: 0,
      upcomingAppointments: 1,
      lastVisit: "2026-01-10",
    },
    createdAt: "2023-06-01",
  },
  {
    id: "dep-2",
    firstName: "Robert",
    lastName: "Johnson Sr.",
    dateOfBirth: "1948-03-22",
    gender: "male",
    relationship: "elderly_parent",
    isActive: true,
    elderlyInfo: {
      livingArrangement: "with_family",
      cognitiveStatus: "mild_impairment",
      mobilityStatus: "assistive_device",
      fallRisk: true,
      advanceDirectives: true,
      healthcareProxy: "Michael Johnson",
    },
    healthSummary: {
      activeMedications: 7,
      activeConditions: 4,
      upcomingAppointments: 2,
      lastVisit: "2026-01-05",
    },
    createdAt: "2024-02-15",
  },
  {
    id: "dep-3",
    firstName: "Lucas",
    lastName: "Johnson",
    dateOfBirth: "2020-11-08",
    gender: "male",
    relationship: "child",
    isActive: true,
    pediatricInfo: {
      immunizationsUpToDate: false,
      primaryCarePediatrician: "Dr. Sarah Chen",
    },
    healthSummary: {
      activeMedications: 0,
      activeConditions: 1,
      upcomingAppointments: 1,
      lastVisit: "2025-12-20",
    },
    createdAt: "2023-06-01",
  },
];

const mockProxyAccess: ProxyAccess[] = [
  {
    id: "proxy-1",
    dependentId: "dep-2",
    dependentName: "Robert Johnson Sr.",
    proxyName: "Sarah Johnson",
    proxyEmail: "sarah.j@email.com",
    accessLevel: "limited",
    status: "active",
    permissions: ["view_medications", "view_appointments", "manage_appointments", "message_providers"],
    grantedAt: "2024-02-15",
    expiresAt: "2026-02-15",
    lastAccessAt: "2026-01-17",
    accessCount: 45,
    approvalMethod: "healthcare_proxy",
  },
  {
    id: "proxy-2",
    dependentId: "dep-1",
    dependentName: "Emma Johnson",
    proxyName: "Grandma Helen",
    proxyEmail: "helen.j@email.com",
    accessLevel: "view_only",
    status: "active",
    permissions: ["view_medications", "view_appointments"],
    grantedAt: "2024-06-01",
    lastAccessAt: "2026-01-10",
    accessCount: 12,
    approvalMethod: "legal_guardian",
  },
  {
    id: "proxy-3",
    dependentId: "dep-2",
    dependentName: "Robert Johnson Sr.",
    proxyName: "Dr. James Wilson",
    proxyEmail: "jwilson@medcenter.com",
    accessLevel: "full",
    status: "pending",
    permissions: ["view_records", "view_medications", "consent_to_treatment", "emergency_decisions"],
    grantedAt: "2026-01-15",
    expiresAt: "2026-07-15",
    accessCount: 0,
    approvalMethod: "power_of_attorney",
  },
];

const mockAccessLogs: AccessLog[] = [
  {
    id: "log-1",
    proxyName: "Sarah Johnson",
    dependentName: "Robert Johnson Sr.",
    action: "Viewed medication list",
    resourceType: "Medications",
    timestamp: "2026-01-17T14:30:00Z",
    success: true,
    ipAddress: "192.168.1.100",
  },
  {
    id: "log-2",
    proxyName: "Sarah Johnson",
    dependentName: "Robert Johnson Sr.",
    action: "Scheduled appointment with Dr. Chen",
    resourceType: "Appointments",
    timestamp: "2026-01-17T14:25:00Z",
    success: true,
    ipAddress: "192.168.1.100",
  },
  {
    id: "log-3",
    proxyName: "Grandma Helen",
    dependentName: "Emma Johnson",
    action: "Viewed upcoming appointments",
    resourceType: "Appointments",
    timestamp: "2026-01-10T09:15:00Z",
    success: true,
    ipAddress: "10.0.0.55",
  },
  {
    id: "log-4",
    proxyName: "Sarah Johnson",
    dependentName: "Robert Johnson Sr.",
    action: "Attempted to access sensitive records",
    resourceType: "Documents",
    timestamp: "2026-01-16T11:00:00Z",
    success: false,
    ipAddress: "192.168.1.100",
  },
];

function getAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function getRelationshipIcon(relationship: string) {
  switch (relationship) {
    case "child": return <Baby className="h-4 w-4" />;
    case "elderly_parent": return <Heart className="h-4 w-4" />;
    case "spouse": return <Users className="h-4 w-4" />;
    default: return <Users className="h-4 w-4" />;
  }
}

function getAccessLevelBadge(level: string) {
  switch (level) {
    case "full": return <Badge variant="default" className="bg-purple-500">Full Access</Badge>;
    case "limited": return <Badge variant="secondary">Limited</Badge>;
    case "emergency_only": return <Badge variant="destructive">Emergency Only</Badge>;
    case "view_only": return <Badge variant="outline">View Only</Badge>;
    default: return <Badge variant="outline">{level}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "active": return <Badge className="bg-green-500">Active</Badge>;
    case "pending": return <Badge variant="secondary">Pending</Badge>;
    case "expired": return <Badge variant="destructive">Expired</Badge>;
    case "revoked": return <Badge variant="destructive">Revoked</Badge>;
    case "suspended": return <Badge className="bg-yellow-500">Suspended</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function DependentCard({ dependent, onEdit, onViewRecords }: { dependent: Dependent; onEdit: () => void; onViewRecords: () => void }) {
  const age = getAge(dependent.dateOfBirth);
  const isPediatric = dependent.relationship === "child";
  const isElderly = dependent.relationship === "elderly_parent";

  return (
    <Card className="hover-elevate" data-testid={`card-dependent-${dependent.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={dependent.profileImage} />
              <AvatarFallback className={isPediatric ? "bg-pink-100 text-pink-700" : isElderly ? "bg-blue-100 text-blue-700" : "bg-gray-100"}>
                {dependent.firstName[0]}{dependent.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {dependent.firstName} {dependent.lastName}
                {getRelationshipIcon(dependent.relationship)}
              </CardTitle>
              <CardDescription>
                {age} years old • {dependent.relationship.replace("_", " ")}
              </CardDescription>
            </div>
          </div>
          <Badge variant={dependent.isActive ? "default" : "secondary"}>
            {dependent.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPediatric && dependent.pediatricInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span>{dependent.pediatricInfo.schoolName || "School not specified"}</span>
              {dependent.pediatricInfo.gradeLevel && (
                <Badge variant="outline" className="text-xs">{dependent.pediatricInfo.gradeLevel}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>Pediatrician: {dependent.pediatricInfo.primaryCarePediatrician || "Not assigned"}</span>
            </div>
            <div className="flex items-center gap-2">
              {dependent.pediatricInfo.immunizationsUpToDate ? (
                <Badge className="bg-green-500 text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Immunizations Current
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Immunizations Due
                </Badge>
              )}
            </div>
          </div>
        )}

        {isElderly && dependent.elderlyInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span>Living: {dependent.elderlyInfo.livingArrangement.replace("_", " ")}</span>
            </div>
            {dependent.elderlyInfo.healthcareProxy && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>Healthcare Proxy: {dependent.elderlyInfo.healthcareProxy}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {dependent.elderlyInfo.fallRisk && (
                <Badge variant="destructive" className="text-xs">Fall Risk</Badge>
              )}
              {dependent.elderlyInfo.advanceDirectives && (
                <Badge className="bg-green-500 text-xs">Advance Directives</Badge>
              )}
              {dependent.elderlyInfo.cognitiveStatus && dependent.elderlyInfo.cognitiveStatus !== "intact" && (
                <Badge variant="secondary" className="text-xs">
                  {dependent.elderlyInfo.cognitiveStatus.replace("_", " ")}
                </Badge>
              )}
            </div>
          </div>
        )}

        {dependent.healthSummary && (
          <>
            <Separator />
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-blue-500">
                  <Pill className="h-4 w-4" />
                  <span className="font-bold">{dependent.healthSummary.activeMedications}</span>
                </div>
                <div className="text-xs text-muted-foreground">Medications</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-orange-500">
                  <Activity className="h-4 w-4" />
                  <span className="font-bold">{dependent.healthSummary.activeConditions}</span>
                </div>
                <div className="text-xs text-muted-foreground">Conditions</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-green-500">
                  <Calendar className="h-4 w-4" />
                  <span className="font-bold">{dependent.healthSummary.upcomingAppointments}</span>
                </div>
                <div className="text-xs text-muted-foreground">Upcoming</div>
              </div>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onViewRecords} data-testid={`button-view-records-${dependent.id}`}>
          <Eye className="h-4 w-4 mr-2" />
          View Records
        </Button>
        <Button variant="outline" size="icon" onClick={onEdit} data-testid={`button-edit-${dependent.id}`}>
          <Settings className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

function ProxyAccessCard({ proxy, onEdit, onRevoke }: { proxy: ProxyAccess; onEdit: () => void; onRevoke: () => void }) {
  const isExpiringSoon = proxy.expiresAt && new Date(proxy.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

  return (
    <Card className="hover-elevate" data-testid={`card-proxy-${proxy.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{proxy.proxyName.split(" ").map(n => n[0]).join("")}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{proxy.proxyName}</CardTitle>
              <CardDescription className="text-xs">{proxy.proxyEmail}</CardDescription>
            </div>
          </div>
          {getStatusBadge(proxy.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">For:</span>
          <span className="text-sm font-medium">{proxy.dependentName}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Access Level:</span>
          {getAccessLevelBadge(proxy.accessLevel)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Method:</span>
          <Badge variant="outline" className="text-xs">{proxy.approvalMethod.replace("_", " ")}</Badge>
        </div>
        {proxy.expiresAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Expires:</span>
            <div className="flex items-center gap-1">
              {isExpiringSoon && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
              <span className={`text-sm ${isExpiringSoon ? "text-yellow-600 font-medium" : ""}`}>
                {new Date(proxy.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
        <Separator />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last access: {proxy.lastAccessAt ? new Date(proxy.lastAccessAt).toLocaleDateString() : "Never"}</span>
          <span>{proxy.accessCount} total accesses</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {proxy.permissions.slice(0, 3).map((perm) => (
            <Badge key={perm} variant="outline" className="text-xs">
              {perm.replace("_", " ")}
            </Badge>
          ))}
          {proxy.permissions.length > 3 && (
            <Badge variant="outline" className="text-xs">+{proxy.permissions.length - 3} more</Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onEdit} data-testid={`button-edit-proxy-${proxy.id}`}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Access
        </Button>
        {proxy.status === "active" && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive" data-testid={`button-revoke-proxy-${proxy.id}`}>
                <XCircle className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will immediately revoke {proxy.proxyName}'s access to {proxy.dependentName}'s health records. 
                  They will no longer be able to view or manage any health information.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRevoke} className="bg-destructive text-destructive-foreground">
                  Revoke Access
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}

function AccessLogRow({ log }: { log: AccessLog }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover-elevate" data-testid={`log-${log.id}`}>
      <div className={`p-2 rounded-full ${log.success ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
        {log.success ? (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{log.action}</div>
        <div className="text-xs text-muted-foreground">
          {log.proxyName} accessed {log.dependentName}'s {log.resourceType}
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <div>{new Date(log.timestamp).toLocaleDateString()}</div>
        <div>{new Date(log.timestamp).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

export default function FamilyAccounts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dependents");
  const [showAddDependent, setShowAddDependent] = useState(false);
  const [showAddProxy, setShowAddProxy] = useState(false);

  const dependents = mockDependents;
  const proxyAccess = mockProxyAccess;
  const accessLogs = mockAccessLogs;

  const handleAddDependent = () => {
    toast({
      title: "Coming Soon",
      description: "Add dependent functionality will be available in the next update.",
    });
    setShowAddDependent(false);
  };

  const handleAddProxy = () => {
    toast({
      title: "Coming Soon",
      description: "Add proxy access functionality will be available in the next update.",
    });
    setShowAddProxy(false);
  };

  const handleRevokeProxy = (proxyId: string) => {
    toast({
      title: "Access Revoked",
      description: "Proxy access has been successfully revoked.",
    });
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-family-accounts">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Family Health Accounts
          </h1>
          <p className="text-muted-foreground">
            Manage health records for your children, elderly parents, and other dependents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={showAddDependent} onOpenChange={setShowAddDependent}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-dependent">
                <Plus className="h-4 w-4 mr-2" />
                Add Dependent
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Family Member</DialogTitle>
                <DialogDescription>
                  Add a child, elderly parent, or other dependent to manage their health records.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" placeholder="First name" data-testid="input-first-name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" placeholder="Last name" data-testid="input-last-name" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input id="dob" type="date" data-testid="input-dob" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship">Relationship</Label>
                    <Select>
                      <SelectTrigger data-testid="select-relationship">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="elderly_parent">Elderly Parent</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="disabled_adult">Disabled Adult</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="unknown">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDependent(false)}>Cancel</Button>
                <Button onClick={handleAddDependent} data-testid="button-save-dependent">Add Dependent</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dependents.length}</div>
              <div className="text-sm text-muted-foreground">Family Members</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{proxyAccess.filter(p => p.status === "active").length}</div>
              <div className="text-sm text-muted-foreground">Active Proxies</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Baby className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dependents.filter(d => d.relationship === "child").length}</div>
              <div className="text-sm text-muted-foreground">Children</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Heart className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dependents.filter(d => d.relationship === "elderly_parent").length}</div>
              <div className="text-sm text-muted-foreground">Elderly Parents</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dependents" data-testid="tab-dependents">
            <Users className="h-4 w-4 mr-2" />
            Dependents
          </TabsTrigger>
          <TabsTrigger value="proxy" data-testid="tab-proxy">
            <Shield className="h-4 w-4 mr-2" />
            Proxy Access
          </TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">
            <History className="h-4 w-4 mr-2" />
            Access Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dependents" className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dependents.map((dependent) => (
              <DependentCard
                key={dependent.id}
                dependent={dependent}
                onEdit={() => toast({ title: "Edit Dependent", description: "Edit functionality coming soon." })}
                onViewRecords={() => toast({ title: "View Records", description: "Navigating to health records..." })}
              />
            ))}
            <Card className="flex items-center justify-center min-h-[300px] border-dashed cursor-pointer hover-elevate" onClick={() => setShowAddDependent(true)}>
              <div className="text-center space-y-2">
                <div className="p-4 rounded-full bg-muted inline-flex">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="font-medium">Add Family Member</p>
                <p className="text-sm text-muted-foreground">Child, parent, or dependent</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="proxy" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Proxy Access Management</h3>
              <p className="text-sm text-muted-foreground">Control who can view and manage health records for your dependents</p>
            </div>
            <Dialog open={showAddProxy} onOpenChange={setShowAddProxy}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-add-proxy">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Grant Access
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Grant Proxy Access</DialogTitle>
                  <DialogDescription>
                    Allow another person to view or manage health records for a family member.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="family-accounts-for-which-family-member">For Which Family Member?</Label>
                    <Select>
                      <SelectTrigger id="family-accounts-for-which-family-member" data-testid="select-dependent-for-proxy">
                        <SelectValue placeholder="Select dependent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dependents.map((dep) => (
                          <SelectItem key={dep.id} value={dep.id}>
                            {dep.firstName} {dep.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="family-accounts-proxy-name">Proxy Name</Label>
                      <Input id="family-accounts-proxy-name" placeholder="Full name" data-testid="input-proxy-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="family-accounts-email">Email</Label>
                      <Input id="family-accounts-email" type="email" placeholder="email@example.com" data-testid="input-proxy-email" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="family-accounts-access-level">Access Level</Label>
                    <Select>
                      <SelectTrigger id="family-accounts-access-level" data-testid="select-access-level">
                        <SelectValue placeholder="Select level..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view_only">View Only - Can see records but not make changes</SelectItem>
                        <SelectItem value="limited">Limited - Can view and manage some items</SelectItem>
                        <SelectItem value="full">Full - Complete access to all records</SelectItem>
                        <SelectItem value="emergency_only">Emergency Only - Access only in emergencies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="family-accounts-authorization-method">Authorization Method</Label>
                    <Select>
                      <SelectTrigger id="family-accounts-authorization-method" data-testid="select-auth-method">
                        <SelectValue placeholder="Select method..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="legal_guardian">Legal Guardian</SelectItem>
                        <SelectItem value="healthcare_proxy">Healthcare Proxy</SelectItem>
                        <SelectItem value="power_of_attorney">Power of Attorney</SelectItem>
                        <SelectItem value="patient_consent">Patient Consent</SelectItem>
                        <SelectItem value="court_order">Court Order</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="family-accounts-access-expiration-optional">Access Expiration (Optional)</Label>
                    <Input id="family-accounts-access-expiration-optional" type="date" data-testid="input-expiry-date" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="notify" defaultChecked />
                    <Label htmlFor="notify" className="text-sm">Notify me when this proxy accesses records</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddProxy(false)}>Cancel</Button>
                  <Button onClick={handleAddProxy} data-testid="button-grant-access">Grant Access</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {proxyAccess.map((proxy) => (
              <ProxyAccessCard
                key={proxy.id}
                proxy={proxy}
                onEdit={() => toast({ title: "Edit Proxy", description: "Edit functionality coming soon." })}
                onRevoke={() => handleRevokeProxy(proxy.id)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Access Audit Log
              </CardTitle>
              <CardDescription>
                Complete history of all proxy access to family member records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {accessLogs.map((log) => (
                    <AccessLogRow key={log.id} log={log} />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
            <CardFooter className="flex justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {accessLogs.length} recent access events
              </p>
              <Button variant="outline" size="sm" data-testid="button-export-logs">
                <FileText className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
