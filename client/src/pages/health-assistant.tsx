import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  MessageCircle, 
  Send, 
  Lightbulb, 
  Calendar, 
  Pill, 
  Heart,
  Loader2,
  Sparkles,
  Clock,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Star,
  Bell,
  Smile,
  Frown,
  Meh,
  AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface SentimentAnalysis {
  sentiment: "positive" | "neutral" | "concerned" | "anxious" | "frustrated";
  confidence: number;
  emotionalCues: string[];
  suggestedTone: string;
}

interface ProactiveInsight {
  id: string;
  type: "health_tip" | "reminder" | "encouragement" | "milestone" | "alert";
  priority: "low" | "medium" | "high";
  title: string;
  message: string;
  actionable: boolean;
  suggestedAction?: string;
  relatedCondition?: string;
  relatedMedication?: string;
  expiresAt?: string;
}

interface AssistantResponse {
  message: string;
  suggestions?: string[];
  reminders?: {
    type: "appointment" | "medication" | "checkup";
    text: string;
    date?: string;
  }[];
  sentiment?: SentimentAnalysis;
}

interface HealthTip {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
}

const SAMPLE_PATIENT_ID = "patient_1";

export default function HealthAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [currentSentiment, setCurrentSentiment] = useState<SentimentAnalysis | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: remindersData } = useQuery<{ reminders: any[] }>({
    queryKey: ["/api/health-assistant/reminders"],
  });

  const { data: healthSummaryData, refetch: refetchSummary, isLoading: summaryLoading } = useQuery<{ summary: string }>({
    queryKey: ["/api/health-assistant/summary"],
  });

  const { data: insightsData, refetch: refetchInsights } = useQuery<{ insights: ProactiveInsight[] }>({
    queryKey: ["/api/health-assistant/reminders"],
    select: (data: any) => ({
      insights: (data?.reminders || []).map((r: any) => ({
        id: r.id,
        type: r.type === "appointment" ? "reminder" : r.type === "medication" ? "health_tip" : "encouragement",
        priority: r.priority,
        title: r.title,
        message: r.description,
        actionable: !!r.actionUrl,
        suggestedAction: r.actionUrl,
      }))
    })
  });

  const chatMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/health-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!response.ok) throw new Error("Chat failed");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.content) fullContent += parsed.content;
              } catch {}
            }
          }
        }
      }
      return { message: fullContent } as AssistantResponse;
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev, { role: "assistant", content: data.message }]);
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSendMessage = async (messageText?: string) => {
    const text = messageText || inputValue.trim();
    if (!text || isStreaming || chatMutation.isPending) return;

    const newMessage: Message = { role: "user", content: text };
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setInputValue("");

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/health-assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        throw new Error("Stream failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                setMessages(prev => [...prev, { role: "assistant", content: fullContent }]);
                setStreamingContent("");
              } else {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.done) {
                    setMessages(prev => [...prev, { role: "assistant", content: fullContent }]);
                    setStreamingContent("");
                  } else if (parsed.content) {
                    fullContent += parsed.content;
                    setStreamingContent(fullContent);
                  }
                  if (parsed.sentiment) {
                    setCurrentSentiment(parsed.sentiment);
                  }
                } catch {
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Streaming error:", error);
      chatMutation.mutate(text);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getReminderIcon = (type: string) => {
    switch (type) {
      case "appointment":
        return <Calendar className="h-4 w-4" />;
      case "medication":
        return <Pill className="h-4 w-4" />;
      default:
        return <Heart className="h-4 w-4" />;
    }
  };

  const getReminderColor = (type: string) => {
    switch (type) {
      case "appointment":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      case "medication":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20";
      default:
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
    }
  };

  const getInsightIcon = (type: ProactiveInsight["type"]) => {
    switch (type) {
      case "alert":
        return <AlertTriangle className="h-4 w-4" />;
      case "reminder":
        return <Bell className="h-4 w-4" />;
      case "health_tip":
        return <Lightbulb className="h-4 w-4" />;
      case "encouragement":
        return <Star className="h-4 w-4" />;
      case "milestone":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Heart className="h-4 w-4" />;
    }
  };

  const getInsightColor = (priority: ProactiveInsight["priority"], type: ProactiveInsight["type"]) => {
    if (type === "alert") {
      return "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20";
    }
    switch (priority) {
      case "high":
        return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
      case "medium":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
      default:
        return "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20";
    }
  };

  const getSentimentIcon = (sentiment: SentimentAnalysis["sentiment"]) => {
    switch (sentiment) {
      case "positive":
        return <Smile className="h-4 w-4 text-green-500" />;
      case "anxious":
      case "frustrated":
        return <Frown className="h-4 w-4 text-orange-500" />;
      case "concerned":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Meh className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentLabel = (sentiment: SentimentAnalysis["sentiment"]) => {
    switch (sentiment) {
      case "positive":
        return "Feeling positive";
      case "anxious":
        return "Feeling anxious";
      case "frustrated":
        return "Feeling frustrated";
      case "concerned":
        return "Feeling concerned";
      default:
        return "Neutral";
    }
  };

  const insights = insightsData?.insights || [];

  const suggestions = [
    "Tell me about my medications",
    "What appointments do I have coming up?",
    "How can I understand my health records?",
    "Summarize my recent health information",
  ];

  const reminders = remindersData?.reminders || [];

  return (
    <div className="flex flex-col h-full p-4 md:p-6 gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Assistant</h1>
          <p className="text-muted-foreground text-sm">Your personal AI guide for health questions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-3 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Chat with Your Assistant</CardTitle>
              </div>
              <CardDescription>
                Ask questions about your health, medications, conditions, or appointments
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 pb-4">
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  <div className="bg-muted/50 rounded-lg p-4" data-testid="text-welcome-message">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm">Hello! I'm your health assistant. I can help you understand your health records, summarize medical documents, and remind you about important health tasks. How can I help you today?</p>
                      </div>
                    </div>
                  </div>

                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg p-4 ${
                        msg.role === "user" 
                          ? "bg-primary text-primary-foreground ml-12" 
                          : "bg-muted/50 mr-12"
                      }`}
                      data-testid={`text-message-${idx}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Sparkles className="h-4 w-4 text-primary" />
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      )}
                      {msg.role === "user" && (
                        <p className="text-sm">{msg.content}</p>
                      )}
                    </div>
                  ))}

                  {streamingContent && (
                    <div className="bg-muted/50 rounded-lg p-4 mr-12" data-testid="text-streaming-message">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                      </div>
                    </div>
                  )}

                  {(isStreaming || chatMutation.isPending) && !streamingContent && (
                    <div className="bg-muted/50 rounded-lg p-4 mr-12">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Loader2 className="h-4 w-4 text-primary animate-spin" />
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <Separator className="my-4" />

              {messages.length === 0 && suggestions.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground mb-2">Try asking:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSuggestionClick(suggestion)}
                        data-testid={`button-suggestion-${idx}`}
                      >
                        <Lightbulb className="h-3 w-3 mr-1" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Ask about your health, medications, or appointments..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isStreaming || chatMutation.isPending}
                  className="flex-1"
                  data-testid="input-chat-message"
                />
                <Button 
                  onClick={() => handleSendMessage()}
                  disabled={!inputValue.trim() || isStreaming || chatMutation.isPending}
                  data-testid="button-send-message"
                >
                  {isStreaming || chatMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {currentSentiment && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {getSentimentIcon(currentSentiment.sentiment)}
                  <CardTitle className="text-sm">Conversation Tone</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{getSentimentLabel(currentSentiment.sentiment)}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(currentSentiment.confidence * 100)}% confidence
                  </Badge>
                </div>
                <Progress value={currentSentiment.confidence * 100} className="h-1" />
                <p className="text-xs text-muted-foreground italic">
                  Response tone: {currentSentiment.suggestedTone}
                </p>
              </CardContent>
            </Card>
          )}

          {insights.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">Proactive Insights</CardTitle>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => refetchInsights()}
                    data-testid="button-refresh-insights"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {insights.slice(0, 4).map((insight, idx) => (
                  <div 
                    key={insight.id} 
                    className={`p-3 rounded-lg border ${getInsightColor(insight.priority, insight.type)}`}
                    data-testid={`card-insight-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-medium">{insight.title}</p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {insight.priority}
                          </Badge>
                        </div>
                        <p className="text-xs opacity-80">{insight.message}</p>
                        {insight.actionable && insight.suggestedAction && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto p-0 text-xs underline"
                            onClick={() => handleSuggestionClick(insight.suggestedAction!)}
                          >
                            View details
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {reminders.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Reminders</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {reminders.map((reminder, idx) => (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border ${getReminderColor(reminder.type)}`}
                    data-testid={`card-reminder-${idx}`}
                  >
                    <div className="flex items-start gap-2">
                      {getReminderIcon(reminder.type)}
                      <div className="flex-1">
                        <p className="text-xs font-medium">{reminder.text}</p>
                        {reminder.date && (
                          <p className="text-xs opacity-70 mt-1">
                            {new Date(reminder.date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm">Health Summary</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6"
                  onClick={() => refetchSummary()}
                  disabled={summaryLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${summaryLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {summaryLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Generating summary...</span>
                </div>
              ) : healthSummaryData?.summary ? (
                <div 
                  className="p-3 rounded-lg bg-muted/50 space-y-1"
                  data-testid="card-health-summary"
                >
                  <p className="text-sm whitespace-pre-wrap">{healthSummaryData.summary}</p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground text-sm py-4">
                  <Heart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Your health summary will appear here</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => refetchSummary()}
                  >
                    Generate Summary
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => handleSuggestionClick("Explain my current medications")}
                data-testid="button-explain-medications"
              >
                <Pill className="h-4 w-4 mr-2" />
                Explain my medications
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => handleSuggestionClick("What conditions am I being treated for?")}
                data-testid="button-explain-conditions"
              >
                <Heart className="h-4 w-4 mr-2" />
                Explain my conditions
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start text-sm"
                onClick={() => handleSuggestionClick("When is my next appointment?")}
                data-testid="button-next-appointment"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Next appointment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
