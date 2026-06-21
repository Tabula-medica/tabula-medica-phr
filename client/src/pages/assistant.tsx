import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Bot, 
  Send, 
  Plus, 
  Trash2, 
  Sparkles, 
  MessageSquare,
  Lightbulb,
  Heart,
  Pill,
  TestTube,
  AlertTriangle,
  ChevronRight,
  User
} from "lucide-react";
import { format } from "date-fns";
import type { AssistantConversation, AssistantMessage, SuggestedQuestion } from "@shared/schema";

interface ConversationWithMessages {
  conversation: AssistantConversation;
  messages: AssistantMessage[];
}

function getCategoryIcon(category: SuggestedQuestion["category"]) {
  switch (category) {
    case "medications":
      return <Pill className="h-4 w-4" />;
    case "conditions":
      return <Heart className="h-4 w-4" />;
    case "labs":
      return <TestTube className="h-4 w-4" />;
    case "education":
      return <Lightbulb className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getCategoryColor(category: SuggestedQuestion["category"]) {
  switch (category) {
    case "medications":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "conditions":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    case "labs":
      return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "education":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "bg-green-500/10 text-green-600 dark:text-green-400";
  }
}

export default function Assistant() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const [streamedMetadata, setStreamedMetadata] = useState<AssistantMessage['metadata'] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: loadingConversations } = useQuery<AssistantConversation[]>({
    queryKey: ["/api/assistant/conversations"],
  });

  const { data: currentConversation, isLoading: loadingMessages } = useQuery<ConversationWithMessages>({
    queryKey: ["/api/assistant/conversations", selectedConversationId],
    enabled: !!selectedConversationId,
  });

  const { data: suggestions } = useQuery<SuggestedQuestion[]>({
    queryKey: ["/api/assistant/suggestions"],
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/assistant/conversations", { title: "New Conversation" });
      return res.json();
    },
    onSuccess: (newConversation: AssistantConversation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setSelectedConversationId(newConversation.id);
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/assistant/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      if (selectedConversationId === conversations?.[0]?.id) {
        setSelectedConversationId(null);
      }
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: string; message: string }) => {
      const res = await apiRequest("POST", `/api/assistant/conversations/${conversationId}/messages`, { message });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations", selectedConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      setInputMessage("");
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentConversation?.messages, streamingContent]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversationId || isStreaming || sendMessageMutation.isPending) return;
    
    const message = inputMessage;
    setInputMessage("");
    setIsStreaming(true);
    setStreamingContent("");
    setPendingUserMessage(message);
    setStreamedMetadata(null);
    
    try {
      const response = await fetch(`/api/assistant/conversations/${selectedConversationId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No response body");
      }
      
      let accumulatedContent = "";
      let buffer = "";
      let streamCompleted = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";
        
        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          
          const jsonData = event.slice(6);
          try {
            const parsed = JSON.parse(jsonData);
            if (parsed.type === "content") {
              accumulatedContent += parsed.data;
              setStreamingContent(accumulatedContent);
            } else if (parsed.type === "done") {
              streamCompleted = true;
              if (parsed.metadata) {
                setStreamedMetadata(parsed.metadata);
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
      
      if (buffer.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(buffer.slice(6));
          if (parsed.type === "done") {
            streamCompleted = true;
            if (parsed.metadata) {
              setStreamedMetadata(parsed.metadata);
            }
          }
        } catch {
          // Skip
        }
      }
      
      if (streamCompleted) {
        await queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations", selectedConversationId] });
        await queryClient.invalidateQueries({ queryKey: ["/api/assistant/conversations"] });
      }
      setIsStreaming(false);
      setStreamingContent("");
      setPendingUserMessage(null);
      setStreamedMetadata(null);
    } catch (error) {
      console.error("Error streaming message:", error);
      setIsStreaming(false);
      setStreamingContent("");
      setPendingUserMessage(null);
      setStreamedMetadata(null);
      sendMessageMutation.mutate({ conversationId: selectedConversationId, message });
    }
  };

  const handleSuggestionClick = async (question: string) => {
    if (!selectedConversationId) {
      const newConversation = await createConversationMutation.mutateAsync();
      setSelectedConversationId(newConversation.id);
      setTimeout(() => {
        setInputMessage(question);
      }, 100);
    } else {
      setInputMessage(question);
    }
  };

  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 p-4">
      <Card className="w-72 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Chats
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={handleNewConversation}
              disabled={createConversationMutation.isPending}
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {loadingConversations ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : conversations && conversations.length > 0 ? (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer hover-elevate ${
                      selectedConversationId === conv.id ? "bg-primary/10" : ""
                    }`}
                    onClick={() => setSelectedConversationId(conv.id)}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(conv.updatedAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-conversation-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <Button 
                  variant="ghost" 
                  onClick={handleNewConversation}
                  className="mt-2"
                  data-testid="button-start-first-conversation"
                >
                  Start your first chat
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">AI Medical Assistant</CardTitle>
              <p className="text-sm text-muted-foreground">
                Ask me anything about your health records
              </p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {selectedConversationId ? (
            <>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {loadingMessages ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                          <Skeleton className="h-16 w-3/4" />
                        </div>
                      ))}
                    </div>
                  ) : currentConversation?.messages && currentConversation.messages.length > 0 ? (
                    currentConversation.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {msg.role === "assistant" && (
                              <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              {msg.metadata?.healthContext && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {msg.metadata.healthContext.medicationsReferenced?.map((med) => (
                                    <Badge key={med} variant="outline" className="text-xs">
                                      <Pill className="h-3 w-3 mr-1" />
                                      {med}
                                    </Badge>
                                  ))}
                                  {msg.metadata.healthContext.conditionsReferenced?.map((cond) => (
                                    <Badge key={cond} variant="outline" className="text-xs">
                                      <Heart className="h-3 w-3 mr-1" />
                                      {cond}
                                    </Badge>
                                  ))}
                                  {msg.metadata.healthContext.labResultsReferenced?.map((lab) => (
                                    <Badge key={lab} variant="outline" className="text-xs">
                                      <TestTube className="h-3 w-3 mr-1" />
                                      {lab}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {msg.metadata?.explainability && (
                                <div className="mt-2 text-xs opacity-70 flex items-center gap-2">
                                  <Sparkles className="h-3 w-3" />
                                  Confidence: {Math.round(msg.metadata.explainability.confidence * 100)}%
                                </div>
                              )}
                            </div>
                            {msg.role === "user" && (
                              <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                      <h3 className="font-medium mb-2">Start a conversation</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Ask me about your medications, lab results, conditions, or any health topic.
                      </p>
                      {suggestions && suggestions.length > 0 && (
                        <div className="space-y-2 max-w-md mx-auto">
                          {suggestions.slice(0, 3).map((suggestion) => (
                            <Button
                              key={suggestion.id}
                              variant="outline"
                              className="w-full justify-start text-left h-auto py-2 px-3"
                              onClick={() => handleSuggestionClick(suggestion.question)}
                              data-testid={`suggestion-${suggestion.id}`}
                            >
                              <div className={`p-1 rounded mr-2 ${getCategoryColor(suggestion.category)}`}>
                                {getCategoryIcon(suggestion.category)}
                              </div>
                              <span className="text-sm truncate">{suggestion.question}</span>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {pendingUserMessage && (
                    <div className="flex justify-end">
                      <div className="max-w-[80%] rounded-lg p-3 bg-primary text-primary-foreground">
                        <div className="flex items-start gap-2">
                          <p className="text-sm whitespace-pre-wrap">{pendingUserMessage}</p>
                          <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        </div>
                      </div>
                    </div>
                  )}
                  {streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                        <div className="flex items-start gap-2">
                          <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                            {streamedMetadata?.explainability && (
                              <div className="mt-2 text-xs opacity-70 flex items-center gap-2">
                                <Sparkles className="h-3 w-3" />
                                Confidence: {Math.round(streamedMetadata.explainability.confidence * 100)}%
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {(isStreaming || sendMessageMutation.isPending) && !streamingContent && !pendingUserMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your health records..."
                    className="min-h-[44px] max-h-32 resize-none"
                    disabled={isStreaming || sendMessageMutation.isPending}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isStreaming || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  For educational purposes only. Always consult your healthcare provider.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Welcome to Your AI Medical Assistant</h2>
                <p className="text-muted-foreground mb-6">
                  I can help you understand your health records, explain medical terms, 
                  and answer questions about your medications, lab results, and conditions.
                </p>
                
                {suggestions && suggestions.length > 0 && (
                  <div className="space-y-2 mb-6">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      Suggested questions based on your health data:
                    </h3>
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion.id}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-3 px-4"
                        onClick={() => handleSuggestionClick(suggestion.question)}
                        data-testid={`welcome-suggestion-${suggestion.id}`}
                      >
                        <div className={`p-1.5 rounded mr-3 ${getCategoryColor(suggestion.category)}`}>
                          {getCategoryIcon(suggestion.category)}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm">{suggestion.question}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{suggestion.context}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    ))}
                  </div>
                )}
                
                <Button onClick={handleNewConversation} data-testid="button-start-conversation">
                  <Plus className="h-4 w-4 mr-2" />
                  Start a New Conversation
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
