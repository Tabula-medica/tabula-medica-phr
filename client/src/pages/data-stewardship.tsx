import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  ClipboardList, 
  Bot, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Shield,
  FileText,
  AlertCircle,
  Send,
  Loader2,
  ChevronRight,
  Calendar,
  User,
} from "lucide-react";

interface DataSteward {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  domains: string[];
  sensitivityLevels: string[];
  maxWorkload: number;
  currentWorkload: number;
  expertise: string[];
  isActive: boolean;
}

interface StewardshipTask {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedTo: string;
  assignedToName: string;
  assetId?: string;
  assetName?: string;
  policyId?: string;
  policyName?: string;
  dueDate: string;
  createdAt: string;
  metadata: Record<string, unknown>;
}

interface DashboardData {
  totalTasks: number;
  pendingTasks: number;
  criticalTasks: number;
  completedThisWeek: number;
  overdueTasks: number;
  tasksByType: Record<string, number>;
  tasksByPriority: Record<string, number>;
  recentTasks: StewardshipTask[];
}

interface AssistantResponse {
  answer: string;
  sources: Array<{ type: string; id: string; name: string; relevance: number }>;
  suggestions: string[];
}

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  deferred: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  escalated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const taskTypeIcons: Record<string, React.ReactNode> = {
  asset_review: <FileText className="w-4 h-4" />,
  policy_violation: <AlertTriangle className="w-4 h-4" />,
  access_anomaly: <Shield className="w-4 h-4" />,
  quality_issue: <AlertCircle className="w-4 h-4" />,
  risk_assessment: <TrendingUp className="w-4 h-4" />,
};

export default function DataStewardshipPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [taskFilter, setTaskFilter] = useState<{ status?: string; priority?: string }>({});
  const [assistantQuery, setAssistantQuery] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<Array<{ role: "user" | "assistant"; content: string; sources?: AssistantResponse["sources"]; suggestions?: string[] }>>([]);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<{ success: boolean; data: DashboardData }>({
    queryKey: ["/api/data-stewardship/dashboard"],
  });

  const { data: stewardsData } = useQuery<{ success: boolean; data: DataSteward[] }>({
    queryKey: ["/api/data-stewardship/stewards"],
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ success: boolean; data: StewardshipTask[] }>({
    queryKey: ["/api/data-stewardship/tasks", taskFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (taskFilter.status) params.set("status", taskFilter.status);
      if (taskFilter.priority) params.set("priority", taskFilter.priority);
      const res = await fetch(`/api/data-stewardship/tasks?${params}`);
      return res.json();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; status?: string; findings?: string; resolution?: string }) => {
      return apiRequest("PATCH", `/api/data-stewardship/tasks/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-stewardship/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data-stewardship/dashboard"] });
      toast({ title: "Task updated", description: "The task has been updated successfully." });
    },
  });

  const askAssistantMutation = useMutation({
    mutationFn: async (query: string): Promise<{ success: boolean; data: AssistantResponse }> => {
      const response = await apiRequest("POST", "/api/data-stewardship/assistant/ask", { query });
      return response.json();
    },
    onSuccess: (response) => {
      setAssistantMessages(prev => [
        ...prev,
        { role: "assistant", content: response.data.answer, sources: response.data.sources, suggestions: response.data.suggestions },
      ]);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to get response from assistant.", variant: "destructive" });
    },
  });

  const handleAskAssistant = () => {
    if (!assistantQuery.trim()) return;
    setAssistantMessages(prev => [...prev, { role: "user", content: assistantQuery }]);
    askAssistantMutation.mutate(assistantQuery);
    setAssistantQuery("");
  };

  const dashboard = dashboardData?.data;
  const stewards = stewardsData?.data || [];
  const tasks = tasksData?.data || [];

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Data Stewardship</h1>
        <p className="text-muted-foreground">Manage data stewards, review tasks, and get AI assistance</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <TrendingUp className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <ClipboardList className="w-4 h-4 mr-2" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="stewards" data-testid="tab-stewards">
            <Users className="w-4 h-4 mr-2" />
            Stewards
          </TabsTrigger>
          <TabsTrigger value="assistant" data-testid="tab-assistant">
            <Bot className="w-4 h-4 mr-2" />
            AI Assistant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : dashboard ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-total-tasks">{dashboard.totalTasks}</div>
                        <div className="text-xs text-muted-foreground">Total Tasks</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-500" />
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-pending-tasks">{dashboard.pendingTasks}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-critical-tasks">{dashboard.criticalTasks}</div>
                        <div className="text-xs text-muted-foreground">Critical</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-completed-tasks">{dashboard.completedThisWeek}</div>
                        <div className="text-xs text-muted-foreground">This Week</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold" data-testid="text-overdue-tasks">{dashboard.overdueTasks}</div>
                        <div className="text-xs text-muted-foreground">Overdue</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Tasks by Priority</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard.tasksByPriority).map(([priority, count]) => (
                        <div key={priority} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge className={priorityColors[priority]}>{priority}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary" 
                                style={{ width: `${(count / dashboard.totalTasks) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tasks by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(dashboard.tasksByType).filter(([_, count]) => count > 0).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {taskTypeIcons[type] || <FileText className="w-4 h-4" />}
                            <span className="text-sm capitalize">{type.replace("_", " ")}</span>
                          </div>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Tasks</CardTitle>
                  <CardDescription>Latest stewardship activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard.recentTasks.map((task) => (
                      <div 
                        key={task.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => { setActiveTab("tasks"); }}
                        data-testid={`card-recent-task-${task.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {taskTypeIcons[task.type] || <FileText className="w-4 h-4" />}
                          <div>
                            <div className="font-medium">{task.title}</div>
                            <div className="text-sm text-muted-foreground">Assigned to {task.assignedToName}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                          <Badge className={statusColors[task.status]}>{task.status.replace("_", " ")}</Badge>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stewardship Tasks</CardTitle>
                  <CardDescription>Review and manage assigned tasks</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={taskFilter.status || "all"} onValueChange={(v) => setTaskFilter({ ...taskFilter, status: v === "all" ? undefined : v })}>
                    <SelectTrigger className="w-32" data-testid="select-task-status">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={taskFilter.priority || "all"} onValueChange={(v) => setTaskFilter({ ...taskFilter, priority: v === "all" ? undefined : v })}>
                    <SelectTrigger className="w-32" data-testid="select-task-priority">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No tasks found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <Dialog key={task.id}>
                      <DialogTrigger asChild>
                        <div 
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate cursor-pointer"
                          data-testid={`card-task-${task.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              {taskTypeIcons[task.type] || <FileText className="w-5 h-5 text-primary" />}
                            </div>
                            <div>
                              <div className="font-medium">{task.title}</div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {task.assignedToName}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            <Badge className={statusColors[task.status]}>{task.status.replace("_", " ")}</Badge>
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>{task.title}</DialogTitle>
                          <DialogDescription>Task Details</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 mt-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm text-muted-foreground">Type</label>
                              <p className="capitalize">{task.type.replace("_", " ")}</p>
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground">Priority</label>
                              <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground">Status</label>
                              <Badge className={statusColors[task.status]}>{task.status.replace("_", " ")}</Badge>
                            </div>
                            <div>
                              <label className="text-sm text-muted-foreground">Due Date</label>
                              <p>{new Date(task.dueDate).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div>
                            <label className="text-sm text-muted-foreground">Description</label>
                            <p className="mt-1">{task.description}</p>
                          </div>
                          {task.assetName && (
                            <div>
                              <label className="text-sm text-muted-foreground">Related Asset</label>
                              <p className="mt-1">{task.assetName}</p>
                            </div>
                          )}
                          {task.policyName && (
                            <div>
                              <label className="text-sm text-muted-foreground">Related Policy</label>
                              <p className="mt-1">{task.policyName}</p>
                            </div>
                          )}
                          <div className="flex gap-2 pt-4">
                            {task.status === "pending" && (
                              <Button
                                onClick={() => updateTaskMutation.mutate({ id: task.id, status: "in_progress" })}
                                disabled={updateTaskMutation.isPending}
                                data-testid={`button-start-${task.id}`}
                              >
                                Start Task
                              </Button>
                            )}
                            {task.status === "in_progress" && (
                              <Button
                                onClick={() => updateTaskMutation.mutate({ id: task.id, status: "completed" })}
                                disabled={updateTaskMutation.isPending}
                                data-testid={`button-complete-${task.id}`}
                              >
                                Mark Complete
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => {
                                setActiveTab("assistant");
                                setAssistantQuery(`Help me with task: ${task.title}`);
                              }}
                              data-testid={`button-ask-ai-${task.id}`}
                            >
                              <Bot className="w-4 h-4 mr-2" />
                              Ask AI Assistant
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stewards">
          <Card>
            <CardHeader>
              <CardTitle>Data Stewards</CardTitle>
              <CardDescription>Team members responsible for data governance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {stewards.map((steward) => (
                  <Card key={steward.id} className="hover-elevate" data-testid={`card-steward-${steward.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{steward.name}</div>
                            <Badge variant={steward.isActive ? "default" : "secondary"}>
                              {steward.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">{steward.role.replace("_", " ")}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {steward.domains.map((domain) => (
                              <Badge key={domain} variant="outline" className="text-xs">
                                {domain.replace("_", " ")}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Workload</span>
                              <span>{steward.currentWorkload}/{steward.maxWorkload}</span>
                            </div>
                            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${steward.currentWorkload / steward.maxWorkload > 0.8 ? "bg-red-500" : "bg-primary"}`}
                                style={{ width: `${(steward.currentWorkload / steward.maxWorkload) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assistant">
          <Card className="h-[600px] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI Stewardship Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about data assets, policies, risks, and governance best practices
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 mb-4">
                {assistantMessages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="mb-4">Ask me anything about data stewardship</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {["How do I assess data risk?", "What policies apply to PHI data?", "How to handle access anomalies?"].map((q) => (
                        <Button 
                          key={q} 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setAssistantMessages([{ role: "user", content: q }]);
                            askAssistantMutation.mutate(q);
                          }}
                          data-testid={`button-suggestion-${q.slice(0, 10)}`}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assistantMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] p-3 rounded-lg ${
                          msg.role === "user" 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted"
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-current/10">
                              <p className="text-xs opacity-70 mb-1">Sources:</p>
                              <div className="flex flex-wrap gap-1">
                                {msg.sources.map((s, j) => (
                                  <Badge key={j} variant="outline" className="text-xs">
                                    {s.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {msg.suggestions && msg.suggestions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {msg.suggestions.map((s, j) => (
                                <Button 
                                  key={j} 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-xs h-6"
                                  onClick={() => {
                                    setAssistantMessages(prev => [...prev, { role: "user", content: s }]);
                                    askAssistantMutation.mutate(s);
                                  }}
                                >
                                  {s}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {askAssistantMutation.isPending && (
                      <div className="flex justify-start">
                        <div className="bg-muted p-3 rounded-lg">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about data governance, policies, risks..."
                  value={assistantQuery}
                  onChange={(e) => setAssistantQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAskAssistant()}
                  disabled={askAssistantMutation.isPending}
                  data-testid="input-assistant-query"
                />
                <Button 
                  onClick={handleAskAssistant} 
                  disabled={!assistantQuery.trim() || askAssistantMutation.isPending}
                  data-testid="button-send-query"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
