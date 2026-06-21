import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Send,
  AlertCircle,
  User,
  Stethoscope,
  Sparkles,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  Reply,
  ArrowUp,
  ListChecks,
  Zap,
  TrendingUp,
  FileText,
  Inbox,
} from "lucide-react";
import type { MessageThread, SecureMessage } from "@shared/schema";
import { cn } from "@/lib/utils";

interface MessageSummary {
  id: string;
  messageId: string;
  threadId: string;
  summary: string;
  keyPoints: string[];
  detectedIntent: string;
  suggestedPriority: "normal" | "high" | "urgent";
  suggestedCategory: string;
  patientConcerns: string[];
  actionItems: string[];
  requiresUrgentResponse: boolean;
  sentimentScore: number;
  confidence: number;
  generatedAt: string;
}

interface PrioritizedMessage {
  messageId: string;
  priority: "normal" | "high" | "urgent";
  summary: string;
  estimatedResponseTime: string;
}

const priorityConfig = {
  urgent: { color: "destructive", icon: AlertCircle, label: "Urgent", order: 0 },
  high: { color: "default", icon: AlertTriangle, label: "High Priority", order: 1 },
  normal: { color: "secondary", icon: Clock, label: "Normal", order: 2 },
};

const intentIcons: Record<string, typeof MessageSquare> = {
  question: MessageSquare,
  request: ListChecks,
  concern: AlertCircle,
  update: FileText,
  emergency: AlertTriangle,
};

export default function ProviderInbox() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [activeTab, setActiveTab] = useState<"prioritized" | "all" | "summaries">("prioritized");
  const { toast } = useToast();

  const { data: threads = [], isLoading: loadingThreads } = useQuery<MessageThread[]>({
    queryKey: ["/api/messages/threads"],
  });

  const { data: selectedThread, isLoading: loadingThread } = useQuery<{ thread: MessageThread; messages: SecureMessage[] }>({
    queryKey: ["/api/messages/threads", selectedThreadId],
    enabled: !!selectedThreadId,
  });

  const [summaries, setSummaries] = useState<Map<string, MessageSummary>>(new Map());
  const [prioritizedList, setPrioritizedList] = useState<PrioritizedMessage[]>([]);
  const [isPrioritizing, setIsPrioritizing] = useState(false);

  const summarizeMessageMutation = useMutation({
    mutationFn: async (params: { messageId: string; threadId: string; patientId: string; content: string; subject: string }) => {
      const response = await apiRequest("POST", "/api/ai-communication/summarize-message", params);
      return response.json();
    },
    onSuccess: (summary) => {
      setSummaries(prev => new Map(prev).set(summary.messageId, summary));
    },
    onError: () => {
      toast({
        title: "AI Error",
        description: "Failed to summarize message",
        variant: "destructive",
      });
    },
  });

  const prioritizeInboxMutation = useMutation({
    mutationFn: async (messages: any[]) => {
      setIsPrioritizing(true);
      const response = await apiRequest("POST", "/api/ai-communication/prioritize-inbox", { messages });
      return response.json();
    },
    onSuccess: (data) => {
      setPrioritizedList(data);
      setIsPrioritizing(false);
    },
    onError: () => {
      setIsPrioritizing(false);
      toast({
        title: "AI Error",
        description: "Failed to prioritize inbox",
        variant: "destructive",
      });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/messages/threads/${selectedThreadId}/messages`, { content });
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      toast({
        title: "Reply sent",
        description: "Your response has been sent to the patient.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send reply",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (threads.length > 0 && !isPrioritizing && prioritizedList.length === 0) {
      const messagesToPrioritize = threads
        .filter(t => !t.isClosed && t.unreadCount > 0)
        .slice(0, 20)
        .map(t => ({
          id: t.id,
          threadId: t.id,
          patientId: t.participants.find(p => p.role === "patient")?.id || "",
          content: t.lastMessagePreview || "",
          subject: t.subject,
          timestamp: t.lastMessageAt,
        }));
      
      if (messagesToPrioritize.length > 0) {
        prioritizeInboxMutation.mutate(messagesToPrioritize);
      }
    }
  }, [threads]);

  const prioritizedThreads = useMemo(() => {
    const priorityMap = new Map(prioritizedList.map(p => [p.messageId, p]));
    return threads
      .filter(t => !t.isClosed)
      .map(t => ({
        thread: t,
        priority: priorityMap.get(t.id) || { priority: "normal", summary: "", estimatedResponseTime: "Within 24 hours" },
      }))
      .sort((a, b) => {
        const orderA = priorityConfig[a.priority.priority as keyof typeof priorityConfig]?.order ?? 2;
        const orderB = priorityConfig[b.priority.priority as keyof typeof priorityConfig]?.order ?? 2;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(b.thread.lastMessageAt).getTime() - new Date(a.thread.lastMessageAt).getTime();
      });
  }, [threads, prioritizedList]);

  const handleSummarizeMessage = (message: SecureMessage, thread: MessageThread) => {
    if (summaries.has(message.id)) return;
    
    const patientId = thread.participants.find(p => p.role === "patient")?.id || "";
    summarizeMessageMutation.mutate({
      messageId: message.id,
      threadId: thread.id,
      patientId,
      content: message.content,
      subject: thread.subject,
    });
  };

  const handleRefreshPriorities = () => {
    const messagesToPrioritize = threads
      .filter(t => !t.isClosed)
      .slice(0, 20)
      .map(t => ({
        id: t.id,
        threadId: t.id,
        patientId: t.participants.find(p => p.role === "patient")?.id || "",
        content: t.lastMessagePreview || "",
        subject: t.subject,
        timestamp: t.lastMessageAt,
      }));
    
    if (messagesToPrioritize.length > 0) {
      prioritizeInboxMutation.mutate(messagesToPrioritize);
    }
  };

  const getPatientInfo = (thread: MessageThread) => {
    const patient = thread.participants.find(p => p.role === "patient");
    return patient || { id: "", name: "Patient", role: "patient" as const };
  };

  const formatResponseTime = (time: string) => {
    if (time.includes("1 hour")) return "1h";
    if (time.includes("4 hour")) return "4h";
    if (time.includes("24 hour")) return "24h";
    return time.replace("Within ", "");
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-4">
      <Card className="w-[400px] flex-shrink-0 flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Patient Messages
            </CardTitle>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRefreshPriorities}
              disabled={isPrioritizing}
              data-testid="button-refresh-priorities"
            >
              {isPrioritizing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
          <CardDescription className="flex items-center gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            AI-prioritized for efficient triage
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-4 mt-2" style={{ width: "calc(100% - 2rem)" }}>
              <TabsTrigger value="prioritized" data-testid="tab-prioritized">
                <Zap className="h-3 w-3 mr-1" />
                Prioritized
              </TabsTrigger>
              <TabsTrigger value="all" data-testid="tab-all">
                <Inbox className="h-3 w-3 mr-1" />
                All
              </TabsTrigger>
            </TabsList>
            
            <ScrollArea className="flex-1 mt-2">
              <TabsContent value="prioritized" className="m-0 p-2">
                {loadingThreads ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : prioritizedThreads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All caught up!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prioritizedThreads.map(({ thread, priority }) => {
                      const config = priorityConfig[priority.priority as keyof typeof priorityConfig];
                      const patient = getPatientInfo(thread);
                      
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg transition-colors hover-elevate",
                            selectedThreadId === thread.id 
                              ? "bg-primary/10 border border-primary/20" 
                              : "hover:bg-muted",
                            priority.priority === "urgent" && "border-l-2 border-l-destructive"
                          )}
                          data-testid={`thread-${thread.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="relative">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10">
                                  {patient.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              {thread.unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                  <span className="text-[10px] text-primary-foreground font-medium">
                                    {thread.unreadCount}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-medium text-sm truncate">{patient.name}</span>
                                <Badge 
                                  variant={config.color as any}
                                  className="text-[10px] h-4 px-1 flex items-center gap-0.5"
                                >
                                  <config.icon className="h-2.5 w-2.5" />
                                  {formatResponseTime(priority.estimatedResponseTime)}
                                </Badge>
                              </div>
                              <p className="text-xs font-medium truncate">{thread.subject}</p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {priority.summary || thread.lastMessagePreview}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="all" className="m-0 p-2">
                {loadingThreads ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : threads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {threads.map((thread) => {
                      const patient = getPatientInfo(thread);
                      return (
                        <button
                          key={thread.id}
                          onClick={() => setSelectedThreadId(thread.id)}
                          className={cn(
                            "w-full text-left p-3 rounded-lg transition-colors hover-elevate",
                            selectedThreadId === thread.id 
                              ? "bg-primary/10 border border-primary/20" 
                              : ""
                          )}
                          data-testid={`thread-all-${thread.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-muted">
                                {patient.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{thread.subject}</p>
                              <p className="text-xs text-muted-foreground truncate">{thread.lastMessagePreview}</p>
                            </div>
                            {thread.unreadCount > 0 && (
                              <Badge variant="default" className="h-5 text-xs">
                                {thread.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        {!selectedThreadId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Provider Inbox</h3>
            <p className="text-muted-foreground max-w-md mb-6">
              Messages are automatically prioritized based on urgency, sentiment, and content.
              Select a message to view AI summaries and suggested actions.
            </p>
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <Zap className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Smart Priority</p>
                <p className="text-xs text-muted-foreground">Auto-triage messages</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">AI Summaries</p>
                <p className="text-xs text-muted-foreground">Key points extracted</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 text-center">
                <ListChecks className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-sm font-medium">Action Items</p>
                <p className="text-xs text-muted-foreground">Suggested responses</p>
              </div>
            </div>
          </div>
        ) : loadingThread ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : selectedThread ? (
          <>
            <CardHeader className="pb-2 border-b flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{selectedThread.thread.subject}</CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <User className="h-3 w-3" />
                    {getPatientInfo(selectedThread.thread).name}
                    <span className="text-muted-foreground">|</span>
                    <Clock className="h-3 w-3" />
                    Last message {formatDistanceToNow(new Date(selectedThread.thread.lastMessageAt), { addSuffix: true })}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="capitalize">
                  {selectedThread.thread.threadType.replace("_", " ")}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {selectedThread.messages.map((message) => {
                    const isPatient = message.senderRole === "patient";
                    const summary = summaries.get(message.id);
                    
                    return (
                      <div key={message.id} className="space-y-2">
                        <div className={cn("flex gap-3", !isPatient && "flex-row-reverse")}>
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarFallback className={isPatient ? "bg-primary/10" : "bg-primary text-primary-foreground"}>
                              {isPatient ? <User className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn("max-w-[75%]", !isPatient && "text-right")}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-medium">{message.senderName}</span>
                              <span className="text-[10px] text-muted-foreground capitalize">
                                {message.senderRole.replace("_", " ")}
                              </span>
                            </div>
                            <div 
                              className={cn(
                                "rounded-lg px-4 py-2",
                                isPatient ? "bg-muted" : "bg-primary text-primary-foreground"
                              )}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(message.createdAt), "MMM d, h:mm a")}
                              </span>
                              {isPatient && !summary && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 text-[10px] px-2"
                                  onClick={() => handleSummarizeMessage(message, selectedThread.thread)}
                                  disabled={summarizeMessageMutation.isPending}
                                  data-testid={`button-summarize-${message.id}`}
                                >
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Analyze
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {isPatient && summary && (
                          <div className="ml-11 p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <span className="text-sm font-medium">AI Analysis</span>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {summary.detectedIntent}
                              </Badge>
                              {summary.requiresUrgentResponse && (
                                <Badge variant="destructive" className="text-[10px]">
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            
                            <p className="text-sm text-muted-foreground mb-3">{summary.summary}</p>
                            
                            {summary.keyPoints.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium mb-1">Key Points:</p>
                                <ul className="text-xs text-muted-foreground space-y-0.5">
                                  {summary.keyPoints.map((point, i) => (
                                    <li key={i} className="flex items-start gap-1">
                                      <ChevronRight className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            {summary.patientConcerns.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs font-medium mb-1">Patient Concerns:</p>
                                <div className="flex flex-wrap gap-1">
                                  {summary.patientConcerns.map((concern, i) => (
                                    <Badge key={i} variant="secondary" className="text-[10px]">
                                      {concern}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {summary.actionItems.length > 0 && (
                              <div>
                                <p className="text-xs font-medium mb-1">Suggested Actions:</p>
                                <ul className="text-xs space-y-1">
                                  {summary.actionItems.map((action, i) => (
                                    <li key={i} className="flex items-center gap-2 p-1.5 rounded bg-background">
                                      <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 mt-3 pt-2 border-t">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Sentiment:</span>
                                <Progress value={summary.sentimentScore * 100} className="w-16 h-1.5" />
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-muted-foreground">Confidence:</span>
                                <span className="text-[10px] font-medium">{Math.round(summary.confidence * 100)}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Type your response..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[80px] flex-1 resize-none"
                    data-testid="input-reply"
                  />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <Button
                    onClick={() => sendReplyMutation.mutate(replyText)}
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                    data-testid="button-send-reply"
                  >
                    {sendReplyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Response
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">Message not found</p>
          </div>
        )}
      </Card>
    </div>
  );
}
