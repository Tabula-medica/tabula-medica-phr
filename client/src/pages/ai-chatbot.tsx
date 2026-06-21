import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Bot, 
  Send, 
  MessageSquare, 
  Plus, 
  Clock, 
  AlertCircle,
  Sparkles,
  User,
  RefreshCw,
  Phone,
  Loader2,
  ChevronRight,
  Heart,
  Pill,
  HelpCircle,
  Stethoscope,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIDisclaimer } from "@/components/ai-transparency";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  category?: string;
  suggestedFollowUps?: string[];
  requiresProviderEscalation?: boolean;
  confidence?: number;
}

interface Conversation {
  id: string;
  patientId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  status: "active" | "resolved" | "escalated";
  topic?: string;
}

const suggestedTopics = [
  { icon: Pill, label: "Medication questions", prompt: "Can you help me understand my medications better?" },
  { icon: Heart, label: "Health conditions", prompt: "I'd like to learn more about managing my health conditions" },
  { icon: Activity, label: "Wellness tips", prompt: "What are some tips for staying healthy?" },
  { icon: HelpCircle, label: "Using the app", prompt: "How do I use the features in Tabula Medica?" },
  { icon: Stethoscope, label: "Prepare for visits", prompt: "How should I prepare for my next doctor's appointment?" },
];

const getCategoryColor = (category?: string) => {
  switch (category) {
    case "medication": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100";
    case "health_condition": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100";
    case "wellness": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100";
    case "app_usage": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100";
    case "healthcare_navigation": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100";
    default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100";
  }
};

export default function AIChatbot() {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/ai-communication/chatbot/conversations"],
    refetchInterval: 30000,
  });

  const { data: currentConversation, isLoading: loadingConversation } = useQuery<Conversation>({
    queryKey: ["/api/ai-communication/chatbot/conversations", currentConversationId],
    enabled: !!currentConversationId,
  });

  useEffect(() => {
    if (currentConversation?.messages) {
      setLocalMessages(currentConversation.messages);
    }
  }, [currentConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/ai-communication/chatbot", {
        conversationId: currentConversationId,
        message,
      });
      return response.json();
    },
    onMutate: async (message: string) => {
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      };
      setLocalMessages(prev => [...prev, userMessage]);
    },
    onSuccess: (data) => {
      if (data.conversation) {
        setCurrentConversationId(data.conversation.id);
        setLocalMessages(data.conversation.messages);
        queryClient.invalidateQueries({ queryKey: ["/api/ai-communication/chatbot/conversations"] });
      }
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      setLocalMessages(prev => prev.filter(m => !m.id.startsWith("temp-")));
    },
  });

  const handleSendMessage = () => {
    if (!inputMessage.trim() || sendMessageMutation.isPending) return;
    sendMessageMutation.mutate(inputMessage.trim());
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    setCurrentConversationId(null);
    setLocalMessages([]);
  };

  const handleSuggestedTopic = (prompt: string) => {
    setInputMessage(prompt);
    sendMessageMutation.mutate(prompt);
    setInputMessage("");
  };

  const handleSuggestedFollowUp = (question: string) => {
    setInputMessage(question);
    sendMessageMutation.mutate(question);
    setInputMessage("");
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString();
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4 p-4">
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleNewConversation}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden px-2">
          <ScrollArea className="h-full">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start by asking a question!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setCurrentConversationId(conv.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg transition-colors hover-elevate",
                      currentConversationId === conv.id 
                        ? "bg-primary/10 border border-primary/20" 
                        : "hover:bg-muted"
                    )}
                    data-testid={`button-conversation-${conv.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <Bot className="h-4 w-4 mt-0.5 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {conv.messages[0]?.content.substring(0, 40) || "New conversation"}...
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(conv.updatedAt)}
                          </span>
                          {conv.status === "escalated" && (
                            <Badge variant="destructive" className="text-xs px-1 py-0">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Escalated
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2 border-b flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-primary/10">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg">Health Assistant</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ask me about health topics, medications, or using the app
                </p>
              </div>
            </div>
            {currentConversation?.status === "escalated" && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Contact your provider
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {localMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-12">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">How can I help you today?</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  I can answer questions about health topics, explain medical terms, 
                  help you understand your medications, or guide you through using the app.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {suggestedTopics.map((topic) => (
                    <Button
                      key={topic.label}
                      variant="outline"
                      className="justify-start gap-2 h-auto py-3 px-4 hover-elevate"
                      onClick={() => handleSuggestedTopic(topic.prompt)}
                      data-testid={`button-topic-${topic.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <topic.icon className="h-4 w-4 text-primary" />
                      <span className="text-sm">{topic.label}</span>
                    </Button>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-muted/50 rounded-lg max-w-lg">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <p>
                      <strong>Note:</strong> I provide general health information only. 
                      For medical advice specific to your situation, please contact your healthcare provider.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {localMessages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-4 py-2",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      {message.role === "assistant" && (
                        <div className="mt-2 mb-1">
                          <AIDisclaimer text="your health information" />
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <span className="text-xs opacity-70">
                          {formatTime(message.timestamp)}
                        </span>
                        {message.category && message.role === "assistant" && (
                          <Badge 
                            variant="secondary" 
                            className={cn("text-xs", getCategoryColor(message.category))}
                          >
                            {message.category.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                      {message.requiresProviderEscalation && (
                        <div className="mt-3 p-2 bg-destructive/10 rounded border border-destructive/20">
                          <div className="flex items-center gap-2 text-destructive text-sm">
                            <Phone className="h-4 w-4" />
                            <span>Consider reaching out to your healthcare provider</span>
                          </div>
                        </div>
                      )}
                      {message.suggestedFollowUps && message.suggestedFollowUps.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs opacity-70 mb-1">You might also ask:</p>
                          {message.suggestedFollowUps.map((followUp, i) => (
                            <button
                              key={i}
                              onClick={() => handleSuggestedFollowUp(followUp)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline w-full text-left"
                              data-testid={`button-followup-${i}`}
                            >
                              <ChevronRight className="h-3 w-3" />
                              {followUp}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.role === "user" && (
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="bg-primary">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))}
                {sendMessageMutation.isPending && (
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your question..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessageMutation.isPending}
                className="flex-1"
                data-testid="input-message"
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || sendMessageMutation.isPending}
                data-testid="button-send-message"
              >
                {sendMessageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
