import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  FileText,
  HelpCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  messages: ChatMessage[];
  topic?: string;
  createdAt: string;
  updatedAt: string;
}

interface PolicyContext {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
  enforcement: string;
  regulatoryMappings: string[];
}

interface ChatResponse {
  message: ChatMessage;
  suggestedQuestions?: string[];
  relatedPolicies?: { id: string; name: string }[];
}

export default function PolicyChatbot() {
  const [selectedTab, setSelectedTab] = useState("chat");
  const [input, setInput] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [relatedPolicies, setRelatedPolicies] = useState<{ id: string; name: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: sessionsData, refetch: refetchSessions } = useQuery<{ success: boolean; data: ChatSession[] }>({
    queryKey: ["/api/policy-chatbot/sessions"],
  });

  const { data: policiesData } = useQuery<{ success: boolean; data: PolicyContext[] }>({
    queryKey: ["/api/policy-chatbot/policies"],
  });

  const { data: scenariosData } = useQuery<{ success: boolean; data: { scenario: string; guidance: string }[] }>({
    queryKey: ["/api/policy-chatbot/scenarios"],
  });

  const sessions = sessionsData?.data || [];
  const policies = policiesData?.data || [];
  const scenarios = scenariosData?.data || [];

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/policy-chatbot/sessions", {});
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.data.id);
      setMessages(data.data.messages || []);
      setSuggestedQuestions([]);
      setRelatedPolicies([]);
      refetchSessions();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create session", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/policy-chatbot/chat", {
        message,
        sessionId: currentSessionId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.data.sessionId && data.data.sessionId !== currentSessionId) {
        setCurrentSessionId(data.data.sessionId);
      }
      const response: ChatResponse = data.data.response;
      if (data.data.session?.messages) {
        setMessages(data.data.session.messages);
      } else {
        setMessages((prev) => [...prev, response.message]);
      }
      setSuggestedQuestions(response.suggestedQuestions || []);
      setRelatedPolicies(response.relatedPolicies || []);
      refetchSessions();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/policy-chatbot/sessions/${sessionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      if (currentSessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      refetchSessions();
      toast({ title: "Session deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete session", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentSessionId && !createSessionMutation.isPending && sessions.length === 0) {
      createSessionMutation.mutate();
    }
  }, [sessions]);

  const handleSend = () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput("");
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  const loadSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/policy-chatbot/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setCurrentSessionId(data.data.id);
        setMessages(data.data.messages || []);
        setSuggestedQuestions([]);
        setRelatedPolicies([]);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load session", variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto p-6 h-[calc(100vh-8rem)]">
      <div className="flex flex-col h-full space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-chatbot">
              <Bot className="h-8 w-8" />
              Policy Governance Assistant
            </h1>
            <p className="text-muted-foreground mt-1">
              Ask questions about data governance policies and compliance requirements
            </p>
          </div>
          <Button onClick={() => createSessionMutation.mutate()} disabled={createSessionMutation.isPending} data-testid="button-new-chat">
            <Plus className="h-4 w-4 mr-2" />
            New Conversation
          </Button>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <TabsList className="w-full max-w-md" data-testid="tabs-list">
            <TabsTrigger value="chat" className="flex-1" data-testid="trigger-chat">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex-1" data-testid="trigger-policies">
              <FileText className="h-4 w-4 mr-2" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="flex-1" data-testid="trigger-scenarios">
              <HelpCircle className="h-4 w-4 mr-2" />
              Scenarios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="flex-1 flex gap-4 mt-4 min-h-0">
            <Card className="w-64 hidden lg:flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Conversations</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-2 min-h-0">
                <ScrollArea className="h-full">
                  <div className="space-y-1">
                    {sessions.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-2">No conversations yet</p>
                    ) : (
                      sessions.slice(0, 10).map((session) => (
                        <div
                          key={session.id}
                          className={`p-2 rounded cursor-pointer hover-elevate flex items-center justify-between group ${
                            currentSessionId === session.id ? "bg-muted" : ""
                          }`}
                          {...clickable(() => loadSession(session.id))}
                          data-testid={`session-${session.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{session.topic || "New Chat"}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSessionMutation.mutate(session.id);
                            }}
                            data-testid={`button-delete-session-${session.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col min-h-0">
              <CardContent className="flex-1 flex flex-col p-4 min-h-0">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4 pb-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">Start a conversation</p>
                        <p className="text-sm text-muted-foreground max-w-md mt-2">
                          Ask me about HIPAA requirements, data retention policies, encryption standards, 
                          GDPR compliance, or any other data governance questions.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          data-testid={`message-${msg.id}`}
                        >
                          {msg.role === "assistant" && (
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <Bot className="h-4 w-4 text-primary-foreground" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-lg p-3 ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                          {msg.role === "user" && (
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {sendMessageMutation.isPending && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <div className="bg-muted rounded-lg p-3">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {suggestedQuestions.length > 0 && (
                  <div className="flex gap-2 flex-wrap py-2 border-t">
                    {suggestedQuestions.map((q, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestedQuestion(q)}
                        className="text-xs"
                        data-testid={`suggested-${idx}`}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                )}

                {relatedPolicies.length > 0 && (
                  <div className="flex gap-2 items-center py-2 border-t">
                    <span className="text-xs text-muted-foreground">Related:</span>
                    {relatedPolicies.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about data governance policies..."
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || sendMessageMutation.isPending}
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="flex-1 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Available Policies</CardTitle>
                <CardDescription>Reference information about active data governance policies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {policies.map((policy) => (
                    <Card key={policy.id} data-testid={`policy-card-${policy.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <CardTitle className="text-base">{policy.name}</CardTitle>
                          <Badge variant={policy.status === "active" ? "default" : "secondary"}>
                            {policy.status}
                          </Badge>
                        </div>
                        <CardDescription className="flex gap-2 flex-wrap">
                          <Badge variant="outline">{policy.type}</Badge>
                          <Badge variant="outline">{policy.enforcement}</Badge>
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">{policy.description}</p>
                        <div className="flex gap-1 flex-wrap">
                          {policy.regulatoryMappings.map((reg) => (
                            <Badge key={reg} variant="secondary" className="text-xs">
                              {reg}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scenarios" className="flex-1 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Common Compliance Scenarios</CardTitle>
                <CardDescription>Guidance for handling typical data governance situations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {scenarios.map((s, idx) => (
                    <Card key={idx} data-testid={`scenario-${idx}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4" />
                          {s.scenario}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{s.guidance}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
