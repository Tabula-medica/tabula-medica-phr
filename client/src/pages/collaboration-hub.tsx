import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  MessageSquare, 
  CheckSquare, 
  Users, 
  Plus, 
  Share2, 
  MessageCircle,
  Clock,
  AlertCircle,
  CheckCircle,
  Target,
  Trash2,
  Edit,
  Loader2,
  FileUp,
  ClipboardList,
  Send
} from "lucide-react";
import type { 
  SharedNote, 
  CarePlanTask, 
  CollabMessageThread, 
  ThreadMessage,
  CarePlanProgressUpdate 
} from "@shared/schema";

export default function CollaborationHub() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("shared-notes");
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newNote, setNewNote] = useState({ title: "", content: "", tags: "" });
  const [newTask, setNewTask] = useState({ 
    title: "", 
    description: "", 
    priority: "medium" as const,
    dueDate: "",
    carePlanId: "care-plan-default"
  });
  const [newThreadData, setNewThreadData] = useState({ subject: "", threadType: "group" as const });

  // Queries - using default fetcher with proper query keys
  const { data: sharedNotes = [], isLoading: notesLoading } = useQuery<SharedNote[]>({
    queryKey: ["/api/shared-notes"],
  });

  const { data: carePlanTasks = [], isLoading: tasksLoading } = useQuery<CarePlanTask[]>({
    queryKey: ["/api/care-plans/care-plan-default/tasks"],
  });

  const { data: messageThreads = [], isLoading: threadsLoading } = useQuery<CollabMessageThread[]>({
    queryKey: ["/api/collab-message-threads"],
  });

  const { data: threadMessages = [], isLoading: messagesLoading } = useQuery<ThreadMessage[]>({
    queryKey: [`/api/collab-message-threads/${selectedThread}/messages`],
    enabled: !!selectedThread,
  });

  const { data: progressUpdates = [] } = useQuery<CarePlanProgressUpdate[]>({
    queryKey: ["/api/care-plans/care-plan-default/progress"],
  });

  // Mutations
  const createNoteMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return apiRequest("POST", "/api/shared-notes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-notes"] });
      setNewNoteOpen(false);
      setNewNote({ title: "", content: "", tags: "" });
      toast({ title: "Note created", description: "Your shared note has been created successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create note.", variant: "destructive" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest("DELETE", `/api/shared-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shared-notes"] });
      toast({ title: "Note deleted", description: "The shared note has been removed." });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority: string; dueDate?: string; carePlanId: string }) => {
      return apiRequest("POST", `/api/care-plans/${data.carePlanId}/tasks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans/care-plan-default/tasks"] });
      setNewTaskOpen(false);
      setNewTask({ title: "", description: "", priority: "medium", dueDate: "", carePlanId: "care-plan-default" });
      toast({ title: "Task created", description: "Your care plan task has been added." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task.", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/care-plans/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans/care-plan-default/tasks"] });
      toast({ title: "Task updated", description: "Task status has been changed." });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return apiRequest("DELETE", `/api/care-plans/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/care-plans/care-plan-default/tasks"] });
      toast({ title: "Task deleted", description: "The task has been removed." });
    },
  });

  const createThreadMutation = useMutation({
    mutationFn: async (data: { subject: string; threadType: string }) => {
      return apiRequest("POST", "/api/collab-message-threads", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collab-message-threads"] });
      setNewThreadOpen(false);
      setNewThreadData({ subject: "", threadType: "group" });
      toast({ title: "Thread created", description: "Your conversation thread has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create thread.", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      return apiRequest("POST", `/api/collab-message-threads/${threadId}/messages`, { body });
    },
    onSuccess: () => {
      if (selectedThread) {
        queryClient.invalidateQueries({ queryKey: [`/api/collab-message-threads/${selectedThread}/messages`] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/collab-message-threads"] });
      setNewMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
    },
  });

  const handleCreateNote = () => {
    createNoteMutation.mutate({ 
      title: newNote.title, 
      content: newNote.content
    });
  };

  const handleCreateTask = () => {
    createTaskMutation.mutate({
      title: newTask.title,
      description: newTask.description || undefined,
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      carePlanId: newTask.carePlanId,
    });
  };

  const handleSendMessage = () => {
    if (!selectedThread || !newMessage.trim()) return;
    sendMessageMutation.mutate({ threadId: selectedThread, body: newMessage });
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "done": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress": return <Clock className="h-4 w-4 text-blue-500" />;
      case "blocked": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <Target className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
      medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    };
    return <Badge className={variants[priority] || ""}>{priority}</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Collaboration Hub</h1>
          <p className="text-muted-foreground text-sm">Work together with your care team on notes, tasks, and messages</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" /> Care Team
          </Badge>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="shared-notes" data-testid="tab-shared-notes" className="gap-1">
              <FileText className="h-4 w-4" /> Shared Notes
            </TabsTrigger>
            <TabsTrigger value="care-tasks" data-testid="tab-care-tasks" className="gap-1">
              <CheckSquare className="h-4 w-4" /> Care Tasks
            </TabsTrigger>
            <TabsTrigger value="group-chat" data-testid="tab-group-chat" className="gap-1">
              <MessageSquare className="h-4 w-4" /> Group Chat
            </TabsTrigger>
          </TabsList>

          {/* Shared Notes Tab */}
          <TabsContent value="shared-notes" className="flex-1 overflow-hidden mt-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg">Shared Notes</CardTitle>
                  <CardDescription>Collaborative notes visible to you and your care team</CardDescription>
                </div>
                <Dialog open={newNoteOpen} onOpenChange={setNewNoteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-create-note">
                      <Plus className="h-4 w-4 mr-1" /> New Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Shared Note</DialogTitle>
                      <DialogDescription>Create a new note visible to your care team</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="note-title">Title</Label>
                        <Input 
                          id="note-title"
                          data-testid="input-note-title"
                          placeholder="Note title"
                          value={newNote.title}
                          onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="note-content">Content</Label>
                        <Textarea 
                          id="note-content"
                          data-testid="input-note-content"
                          placeholder="Write your note here..."
                          rows={5}
                          value={newNote.content}
                          onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewNoteOpen(false)} data-testid="button-cancel-note">Cancel</Button>
                      <Button 
                        onClick={handleCreateNote}
                        disabled={!newNote.title || !newNote.content || createNoteMutation.isPending}
                        data-testid="button-submit-note"
                      >
                        {createNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Create Note
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {notesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : sharedNotes.length === 0 ? (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No shared notes yet</p>
                      <p className="text-sm text-muted-foreground">Create a note to share with your care team</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sharedNotes.map((note) => (
                        <Card key={note.id} className="hover-elevate" data-testid={`card-note-${note.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <CardTitle className="text-base">{note.title}</CardTitle>
                                <CardDescription className="text-xs">
                                  By {note.createdByName} • {new Date(note.createdAt).toLocaleDateString()}
                                </CardDescription>
                              </div>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                                data-testid={`button-delete-note-${note.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Care Tasks Tab */}
          <TabsContent value="care-tasks" className="flex-1 overflow-hidden mt-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-lg">Care Plan Tasks</CardTitle>
                  <CardDescription>Manage tasks and track progress on your care plan</CardDescription>
                </div>
                <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-create-task">
                      <Plus className="h-4 w-4 mr-1" /> New Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Care Task</DialogTitle>
                      <DialogDescription>Add a new task to your care plan</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="task-title">Title</Label>
                        <Input 
                          id="task-title"
                          data-testid="input-task-title"
                          placeholder="Task title"
                          value={newTask.title}
                          onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="task-description">Description</Label>
                        <Textarea 
                          id="task-description"
                          data-testid="input-task-description"
                          placeholder="Task details..."
                          rows={3}
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="collaboration-hub-priority">Priority</Label>
                          <Select 
                            value={newTask.priority} 
                            onValueChange={(v) => setNewTask({ ...newTask, priority: v as any })}
                          >
                            <SelectTrigger id="collaboration-hub-priority" data-testid="select-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="task-due">Due Date</Label>
                          <Input 
                            id="task-due"
                            type="date"
                            data-testid="input-task-due"
                            value={newTask.dueDate}
                            onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setNewTaskOpen(false)} data-testid="button-cancel-task">Cancel</Button>
                      <Button 
                        onClick={handleCreateTask}
                        disabled={!newTask.title || createTaskMutation.isPending}
                        data-testid="button-submit-task"
                      >
                        {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Create Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  {tasksLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : carePlanTasks.length === 0 ? (
                    <div className="text-center py-12">
                      <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">No care tasks yet</p>
                      <p className="text-sm text-muted-foreground">Add tasks to track your care plan activities</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {carePlanTasks.map((task) => (
                        <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-3">
                                <Checkbox 
                                  checked={task.status === "done"}
                                  onCheckedChange={(checked) => 
                                    updateTaskMutation.mutate({ 
                                      taskId: task.id, 
                                      status: checked ? "done" : "todo" 
                                    })
                                  }
                                  data-testid={`checkbox-task-${task.id}`}
                                />
                                <div>
                                  <CardTitle className={`text-base ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                  </CardTitle>
                                  {task.description && (
                                    <CardDescription className="text-xs mt-1">{task.description}</CardDescription>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getPriorityBadge(task.priority)}
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8"
                                  onClick={() => deleteTaskMutation.mutate(task.id)}
                                  data-testid={`button-delete-task-${task.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardFooter className="pt-2 text-xs text-muted-foreground gap-4">
                            <span className="flex items-center gap-1">
                              {getTaskStatusIcon(task.status)} {task.status.replace("_", " ")}
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Due: {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            <span>By {task.createdByName}</span>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Group Chat Tab */}
          <TabsContent value="group-chat" className="flex-1 overflow-hidden mt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
              {/* Thread List */}
              <Card className="md:col-span-1 flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-lg">Conversations</CardTitle>
                  <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-create-thread">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Start Conversation</DialogTitle>
                        <DialogDescription>Create a new group conversation</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="thread-subject">Subject</Label>
                          <Input 
                            id="thread-subject"
                            data-testid="input-thread-subject"
                            placeholder="Conversation topic"
                            value={newThreadData.subject}
                            onChange={(e) => setNewThreadData({ ...newThreadData, subject: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="collaboration-hub-type">Type</Label>
                          <Select 
                            value={newThreadData.threadType} 
                            onValueChange={(v) => setNewThreadData({ ...newThreadData, threadType: v as any })}
                          >
                            <SelectTrigger id="collaboration-hub-type" data-testid="select-thread-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="direct">Direct Message</SelectItem>
                              <SelectItem value="group">Group Chat</SelectItem>
                              <SelectItem value="care_team">Care Team</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setNewThreadOpen(false)} data-testid="button-cancel-thread">Cancel</Button>
                        <Button 
                          onClick={() => createThreadMutation.mutate(newThreadData)}
                          disabled={!newThreadData.subject || createThreadMutation.isPending}
                          data-testid="button-submit-thread"
                        >
                          {createThreadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Create
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full">
                    {threadsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : messageThreads.length === 0 ? (
                      <div className="text-center py-8 px-4">
                        <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm text-muted-foreground">No conversations</p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {messageThreads.map((thread) => (
                          <button
                            key={thread.id}
                            onClick={() => setSelectedThread(thread.id)}
                            className={`w-full text-left p-3 hover-elevate transition-colors ${
                              selectedThread === thread.id ? "bg-accent" : ""
                            }`}
                            data-testid={`button-thread-${thread.id}`}
                          >
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{thread.subject}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {thread.lastMessagePreview || "No messages yet"}
                                </p>
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {thread.threadType.replace("_", " ")}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Message View */}
              <Card className="md:col-span-2 flex flex-col">
                {selectedThread ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <CardTitle className="text-lg">
                        {messageThreads.find(t => t.id === selectedThread)?.subject || "Messages"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                      <ScrollArea className="h-full p-4">
                        {messagesLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          </div>
                        ) : threadMessages.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {threadMessages.map((message) => (
                              <div key={message.id} className="flex gap-3" data-testid={`message-${message.id}`}>
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-medium">{message.senderName.charAt(0)}</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm">{message.senderName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(message.sentAt).toLocaleTimeString()}
                                    </span>
                                  </div>
                                  <p className="text-sm mt-1">{message.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                    <CardFooter className="border-t pt-3">
                      <div className="flex w-full gap-2">
                        <Input 
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                          data-testid="input-message"
                        />
                        <Button 
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          data-testid="button-send-message"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardFooter>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">Select a conversation</p>
                      <p className="text-sm text-muted-foreground">or start a new one</p>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
