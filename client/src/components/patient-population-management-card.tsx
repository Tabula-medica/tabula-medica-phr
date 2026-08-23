import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  AlertTriangle,
  Activity,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  Search,
  Loader2,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  UserCheck,
  ClipboardList,
  Heart,
  Pill,
  Calendar,
  Phone,
  Plus,
  RefreshCw,
  Target,
  AlertCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface PopulationOverview {
  totalPatients: number;
  byRiskLevel: { critical: number; high: number; medium: number; low: number };
  patientsNeedingFollowUp: number;
  totalPendingAlerts: number;
  totalCriticalAlerts: number;
  averageMedicationAdherence: number;
  unassignedPatients: number;
}

interface PatientSummary {
  patientId: string;
  displayName: string;
  riskLevel: "critical" | "high" | "medium" | "low";
  pendingAlerts: number;
  criticalAlerts: number;
  overdueGoals: number;
  lastVitalDate: string | null;
  medicationAdherence: number;
  followUpNeeded: boolean;
  followUpReasons: string[];
  assignedTeamMember: string | null;
  lastContactDate: string | null;
}

interface TeamTask {
  id: string;
  patientId: string;
  patientName: string;
  assignedTo: string;
  assignedBy: string;
  taskType: string;
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate: string;
  createdAt: string;
  completedAt: string | null;
  notes: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialty: string;
  activeTasks: number;
  completedToday: number;
}

interface DashboardStats {
  population: { total: number; critical: number; high: number; needingFollowUp: number };
  alerts: { critical: number; pending: number; resolvedToday: number };
  tasks: { total: number; pending: number; inProgress: number; completedToday: number; overdue: number };
  adherence: { average: number; lowAdherenceCount: number };
}

const riskColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 dark:bg-orange-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
};

const priorityColors: Record<string, string> = {
  critical: "bg-destructive text-destructive-foreground",
  high: "bg-orange-500 dark:bg-orange-600 text-white",
  medium: "bg-yellow-500 dark:bg-yellow-600 text-black dark:text-white",
  low: "bg-green-500 dark:bg-green-600 text-white",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  in_progress: "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  completed: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  cancelled: "bg-muted text-muted-foreground",
};

export function PatientPopulationManagementCard() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [riskFilter, setRiskFilter] = useState("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({
    patientId: "",
    patientName: "",
    assignedTo: "",
    taskType: "follow_up",
    priority: "medium",
    title: "",
    description: "",
    dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  });

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery<{ success: boolean; stats: DashboardStats; dataSource?: string }>({
    queryKey: ["/api/provider-population/dashboard/stats"],
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery<{ success: boolean; overview: PopulationOverview; dataSource?: string }>({
    queryKey: ["/api/provider-population/population/overview"],
  });

  const { data: patientsData, isLoading: patientsLoading, refetch: refetchPatients } = useQuery<{ success: boolean; patients: PatientSummary[]; dataSource?: string }>({
    queryKey: ["/api/provider-population/population/patients", riskFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (riskFilter !== "all") params.append("riskLevel", riskFilter);
      params.append("sortBy", "risk");
      const response = await fetch(`/api/provider-population/population/patients?${params}`);
      return response.json();
    },
  });

  const { data: proactiveData, isLoading: proactiveLoading } = useQuery<{ 
    success: boolean; 
    totalFollowUpsNeeded: number;
    dataSource?: string;
    categories: {
      criticalAlerts: any[];
      overdueGoals: any[];
      lowAdherence: any[];
      lostToFollowUp: any[];
    }
  }>({
    queryKey: ["/api/provider-population/proactive-followup"],
  });

  const { data: tasksData, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<{ success: boolean; tasks: TeamTask[]; stats: any }>({
    queryKey: ["/api/provider-population/team/tasks", taskStatusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (taskStatusFilter !== "all") params.append("status", taskStatusFilter);
      const response = await fetch(`/api/provider-population/team/tasks?${params}`);
      return response.json();
    },
  });

  const { data: membersData } = useQuery<{ success: boolean; members: TeamMember[] }>({
    queryKey: ["/api/provider-population/team/members"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: typeof newTask) => {
      return apiRequest("POST", "/api/provider-population/team/tasks", taskData);
    },
    onSuccess: () => {
      toast({ title: "Task Created", description: "New team task has been created successfully." });
      setShowCreateTask(false);
      setNewTask({
        patientId: "",
        patientName: "",
        assignedTo: "",
        taskType: "follow_up",
        priority: "medium",
        title: "",
        description: "",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-population/team/tasks"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, updates }: { taskId: string; updates: Partial<TeamTask> }) => {
      return apiRequest("PATCH", `/api/provider-population/team/tasks/${taskId}`, updates);
    },
    onSuccess: () => {
      toast({ title: "Task Updated", description: "Task status has been updated." });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-population/team/tasks"] });
    },
  });

  const stats = statsData?.stats;
  const overview = overviewData?.overview;
  const patients = patientsData?.patients || [];
  const proactive = proactiveData?.categories;
  const tasks = tasksData?.tasks || [];
  const taskStats = tasksData?.stats;
  const members = membersData?.members || [];

  const filteredPatients = patients.filter(p => 
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderOverviewTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Patients</p>
                <p className="text-2xl font-bold">{overview?.totalPatients || 0}</p>
              </div>
              <Users className="h-8 w-8 text-primary opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical/High Risk</p>
                <p className="text-2xl font-bold text-destructive">
                  {(overview?.byRiskLevel.critical || 0) + (overview?.byRiskLevel.high || 0)}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Alerts</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {overview?.totalPendingAlerts || 0}
                </p>
              </div>
              <Bell className="h-8 w-8 text-orange-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Need Follow-Up</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {overview?.patientsNeedingFollowUp || 0}
                </p>
              </div>
              <Phone className="h-8 w-8 text-yellow-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {["critical", "high", "medium", "low"].map(level => (
              <div key={level} className="flex items-center gap-2">
                <Badge className={riskColors[level]} variant="secondary">
                  {level.charAt(0).toUpperCase() + level.slice(1)}
                </Badge>
                <Progress 
                  value={((overview?.byRiskLevel[level as keyof typeof overview.byRiskLevel] || 0) / (overview?.totalPatients || 1)) * 100} 
                  className="flex-1 h-2"
                />
                <span className="text-sm text-muted-foreground w-8">
                  {overview?.byRiskLevel[level as keyof typeof overview.byRiskLevel] || 0}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Task Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/30 rounded">
                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{taskStats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/30 rounded">
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{taskStats?.inProgress || 0}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-2 bg-destructive/10 rounded">
                <p className="text-xl font-bold text-destructive">{taskStats?.overdue || 0}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
              <div className="text-center p-2 bg-green-50 dark:bg-green-900/30 rounded">
                <p className="text-xl font-bold text-green-600 dark:text-green-400">{taskStats?.completedToday || 0}</p>
                <p className="text-xs text-muted-foreground">Done Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Medication Adherence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-muted-foreground">Average Adherence</span>
                <span className="text-sm font-medium">{overview?.averageMedicationAdherence || 0}%</span>
              </div>
              <Progress value={overview?.averageMedicationAdherence || 0} className="h-2" />
            </div>
            <div className="text-center px-4 border-l">
              <p className="text-xl font-bold text-destructive">{stats?.adherence?.lowAdherenceCount || 0}</p>
              <p className="text-xs text-muted-foreground">Low Adherence</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPatientsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-patient-search"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-risk-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetchPatients()} data-testid="button-refresh-patients">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {patientsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-2">
            {filteredPatients.map(patient => (
              <Card 
                key={patient.patientId} 
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedPatient(patient)}
                data-testid={`card-patient-${patient.patientId}`}
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-2 h-10 rounded ${riskColors[patient.riskLevel].split(" ")[0]}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium truncate">{patient.displayName}</p>
                          <Badge className={riskColors[patient.riskLevel]} variant="secondary">
                            {patient.riskLevel}
                          </Badge>
                          {patient.followUpNeeded && (
                            <Badge variant="outline" className="text-orange-600 border-orange-300">
                              Follow-up needed
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                          {patient.criticalAlerts > 0 && (
                            <span className="flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {patient.criticalAlerts} critical
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Bell className="h-3 w-3" />
                            {patient.pendingAlerts} alerts
                          </span>
                          <span className="flex items-center gap-1">
                            <Pill className="h-3 w-3" />
                            {patient.medicationAdherence}% adherence
                          </span>
                          {patient.assignedTeamMember && (
                            <span className="flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              {patient.assignedTeamMember}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={!!selectedPatient} onOpenChange={() => setSelectedPatient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPatient?.displayName}
              <Badge className={riskColors[selectedPatient?.riskLevel || "low"]} variant="secondary">
                {selectedPatient?.riskLevel}
              </Badge>
            </DialogTitle>
            <DialogDescription>Patient Summary</DialogDescription>
          </DialogHeader>
          {selectedPatient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Critical Alerts</p>
                  <p className="font-medium text-destructive">{selectedPatient.criticalAlerts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pending Alerts</p>
                  <p className="font-medium">{selectedPatient.pendingAlerts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Medication Adherence</p>
                  <p className="font-medium">{selectedPatient.medicationAdherence}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Overdue Goals</p>
                  <p className="font-medium">{selectedPatient.overdueGoals}</p>
                </div>
              </div>

              {selectedPatient.followUpReasons.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Follow-up Reasons</p>
                  <div className="space-y-1">
                    {selectedPatient.followUpReasons.map((reason, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <AlertCircle className="h-3 w-3 text-orange-500" />
                        {reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Last vital: {selectedPatient.lastVitalDate ? format(new Date(selectedPatient.lastVitalDate), "MMM d, yyyy") : "N/A"}
                {selectedPatient.lastContactDate && (
                  <> | Last contact: {formatDistanceToNow(new Date(selectedPatient.lastContactDate))} ago</>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewTask({
                  ...newTask,
                  patientId: selectedPatient?.patientId || "",
                  patientName: selectedPatient?.displayName || "",
                });
                setSelectedPatient(null);
                setShowCreateTask(true);
              }}
              data-testid="button-create-task-for-patient"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
            <Button onClick={() => setSelectedPatient(null)} data-testid="button-close-patient-dialog">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderProactiveTab = () => (
    <div className="space-y-4">
      {proactiveLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {proactiveData?.totalFollowUpsNeeded || 0} patients identified for proactive follow-up
            </p>
          </div>

          {proactive?.criticalAlerts && proactive.criticalAlerts.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Alerts ({proactive.criticalAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {proactive.criticalAlerts.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded">
                        <div>
                          <p className="font-medium">{item.patientName}</p>
                          <p className="text-xs text-muted-foreground">{item.reason}</p>
                        </div>
                        <Badge className="bg-destructive text-destructive-foreground">
                          {item.alertCount} alerts
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {proactive?.lowAdherence && proactive.lowAdherence.length > 0 && (
            <Card className="border-orange-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <Pill className="h-4 w-4" />
                  Low Medication Adherence ({proactive.lowAdherence.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[120px]">
                  <div className="space-y-2">
                    {proactive.lowAdherence.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-orange-50 dark:bg-orange-900/20 rounded">
                        <div>
                          <p className="font-medium">{item.patientName}</p>
                          <p className="text-xs text-muted-foreground">{item.suggestedAction}</p>
                        </div>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          {item.adherenceRate}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {proactive?.overdueGoals && proactive.overdueGoals.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                  <Target className="h-4 w-4" />
                  Overdue Health Goals ({proactive.overdueGoals.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[100px]">
                  <div className="space-y-2">
                    {proactive.overdueGoals.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                        <p className="font-medium">{item.patientName}</p>
                        <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                          {item.overdueCount} overdue
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {proactive?.lostToFollowUp && proactive.lostToFollowUp.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Potential Lost to Follow-Up ({proactive.lostToFollowUp.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[100px]">
                  <div className="space-y-2">
                    {proactive.lostToFollowUp.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                        <div>
                          <p className="font-medium">{item.patientName}</p>
                          <p className="text-xs text-muted-foreground">
                            Last contact: {item.lastContact ? format(new Date(item.lastContact), "MMM d, yyyy") : "Never"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        This information is for educational purposes only. It is not intended to replace professional clinical judgment.
      </p>
    </div>
  );

  const renderTasksTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2">
          <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
            <SelectTrigger className="w-[130px]" data-testid="select-task-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchTasks()} data-testid="button-refresh-tasks">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreateTask(true)} data-testid="button-create-new-task">
          <Plus className="h-4 w-4 mr-2" />
          New Task
        </Button>
      </div>

      {tasksLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : (
        <ScrollArea className="h-[350px]">
          <div className="space-y-2">
            {tasks.map(task => (
              <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
                <CardContent className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge className={priorityColors[task.priority]} variant="secondary">
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={statusColors[task.status]}>
                          {task.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {task.taskType.replace("_", " ")}
                        </span>
                      </div>
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Patient: {task.patientName} | Assigned: {task.assignedTo}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                        {new Date(task.dueDate) < new Date() && task.status !== "completed" && (
                          <span className="text-destructive ml-2">Overdue</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {task.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTaskMutation.mutate({ taskId: task.id, updates: { status: "in_progress" } })}
                          title="Start Task"
                          data-testid={`button-start-task-${task.id}`}
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => updateTaskMutation.mutate({ taskId: task.id, updates: { status: "completed" } })}
                          title="Complete Task"
                          data-testid={`button-complete-task-${task.id}`}
                        >
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No tasks found for the selected filter
              </div>
            )}
          </div>
        </ScrollArea>
      )}

      <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Assign a task to a team member</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-patient-id">Patient ID</Label>
                <Input id="patient-population-manag-patient-id"
                  value={newTask.patientId}
                  onChange={(e) => setNewTask({ ...newTask, patientId: e.target.value })}
                  placeholder="patient-001"
                  data-testid="input-task-patient-id"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-patient-name">Patient Name</Label>
                <Input id="patient-population-manag-patient-name"
                  value={newTask.patientName}
                  onChange={(e) => setNewTask({ ...newTask, patientName: e.target.value })}
                  placeholder="John Smith"
                  data-testid="input-task-patient-name"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="patient-population-manag-title">Title</Label>
              <Input id="patient-population-manag-title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                data-testid="input-task-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-task-type">Task Type</Label>
                <Select value={newTask.taskType} onValueChange={(v) => setNewTask({ ...newTask, taskType: v })}>
                  <SelectTrigger id="patient-population-manag-task-type" data-testid="select-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="review_alert">Review Alert</SelectItem>
                    <SelectItem value="care_plan">Care Plan</SelectItem>
                    <SelectItem value="medication_review">Medication Review</SelectItem>
                    <SelectItem value="lab_review">Lab Review</SelectItem>
                    <SelectItem value="documentation">Documentation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-priority">Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger id="patient-population-manag-priority" data-testid="select-task-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-assign-to">Assign To</Label>
                <Select value={newTask.assignedTo} onValueChange={(v) => setNewTask({ ...newTask, assignedTo: v })}>
                  <SelectTrigger id="patient-population-manag-assign-to" data-testid="select-task-assignee">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="patient-population-manag-due-date">Due Date</Label>
                <Input id="patient-population-manag-due-date"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  data-testid="input-task-due-date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="patient-population-manag-description">Description</Label>
              <Textarea id="patient-population-manag-description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Task description..."
                className="h-20"
                data-testid="textarea-task-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTask(false)} data-testid="button-cancel-create-task">
              Cancel
            </Button>
            <Button 
              onClick={() => createTaskMutation.mutate(newTask as any)}
              disabled={!newTask.patientId || !newTask.patientName || !newTask.title || !newTask.assignedTo || createTaskMutation.isPending}
              data-testid="button-submit-create-task"
            >
              {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderTeamTab = () => (
    <div className="space-y-4">
      <div className="grid gap-3">
        {members.map(member => (
          <Card key={member.id} className="hover-elevate" data-testid={`card-team-member-${member.id}`}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <UserCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.role} - {member.specialty}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{member.activeTasks}</p>
                    <p className="text-xs text-muted-foreground">Active</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{member.completedToday}</p>
                    <p className="text-xs text-muted-foreground">Done Today</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  if (statsLoading || overviewLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-population-management">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Patient Population Management
            </CardTitle>
            <CardDescription>
              Manage patient populations, identify follow-up needs, and coordinate team tasks
            </CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => refetchStats()} data-testid="button-refresh-stats">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <div className="mx-6 mb-3 p-3 rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <span className="font-medium">NO-CDS Disclaimer:</span> This information is for educational purposes only. It is not intended to replace professional clinical judgment. All care decisions should be made by qualified healthcare providers in consultation with their patients.
            </p>
          </div>
          {statsData?.dataSource && (
            <Badge 
              variant={statsData.dataSource === "database" ? "default" : "secondary"}
              className="shrink-0 text-xs"
              data-testid="badge-data-source"
            >
              {statsData.dataSource === "database" ? "Live Data" : "Sample Data"}
            </Badge>
          )}
        </div>
      </div>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 w-full mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="patients" data-testid="tab-patients">Patients</TabsTrigger>
            <TabsTrigger value="proactive" data-testid="tab-proactive">Follow-Up</TabsTrigger>
            <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">Team</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">{renderOverviewTab()}</TabsContent>
          <TabsContent value="patients">{renderPatientsTab()}</TabsContent>
          <TabsContent value="proactive">{renderProactiveTab()}</TabsContent>
          <TabsContent value="tasks">{renderTasksTab()}</TabsContent>
          <TabsContent value="team">{renderTeamTab()}</TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
