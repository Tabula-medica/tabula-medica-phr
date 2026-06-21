import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  MessageCircle,
  Pill,
  Heart,
  Calendar,
  HelpCircle,
  BookOpen,
  FlaskConical,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronRight,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  TestTube,
  Activity,
  FileText,
  Clock,
  Filter,
  ThermometerSun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AIThinkingDisplay, parseThinkingFromResponse } from "@/components/ai-thinking-display";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  timestamp: Date;
  metadata?: {
    suggestedFollowUps?: string[];
    relatedAppFeatures?: string[];
    medicalTermsExplained?: { term: string; explanation: string }[];
    includesDisclaimer?: boolean;
  };
  contextSnapshot?: ContextSelection;
}

interface QuickPrompt {
  id: string;
  icon: string;
  text: string;
  category: string;
}

interface ContextSelection {
  categories: string[];
  timeRange: string;
  specificItems: string[];
}

const DEFAULT_CONTEXT: ContextSelection = {
  categories: ["conditions", "medications", "labs", "vitals"],
  timeRange: "6months",
  specificItems: [],
};

const CONTEXT_CATEGORIES = [
  { id: "conditions", label: "Conditions", icon: Activity, description: "Active diagnoses and history" },
  { id: "medications", label: "Medications", icon: Pill, description: "Current prescriptions" },
  { id: "labs", label: "Lab Results", icon: TestTube, description: "Blood work and tests" },
  { id: "vitals", label: "Vitals", icon: ThermometerSun, description: "BP, heart rate, etc." },
  { id: "notes", label: "Clinical Notes", icon: FileText, description: "Provider notes and summaries" },
  { id: "allergies", label: "Allergies", icon: AlertTriangle, description: "Drug and food allergies" },
  { id: "appointments", label: "Appointments", icon: Calendar, description: "Past and upcoming visits" },
];

const TIME_RANGE_OPTIONS = [
  { value: "1month", label: "Last 1 Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "1year", label: "Last 1 Year" },
  { value: "all", label: "All Time" },
];

const NO_CDS_BANNER = "This assistant provides general health information only. Always consult your healthcare provider for medical advice.";

const ICON_MAP: Record<string, React.ReactNode> = {
  pill: <Pill className="w-4 h-4" />,
  heart: <Heart className="w-4 h-4" />,
  flask: <FlaskConical className="w-4 h-4" />,
  calendar: <Calendar className="w-4 h-4" />,
  compass: <HelpCircle className="w-4 h-4" />,
  book: <BookOpen className="w-4 h-4" />,
};

const DEFAULT_QUICK_PROMPTS: QuickPrompt[] = [
  { id: "medications", icon: "pill", text: "Explain my medications", category: "health" },
  { id: "conditions", icon: "heart", text: "What conditions do I have?", category: "health" },
  { id: "labs", icon: "flask", text: "Help me understand my lab results", category: "health" },
  { id: "appointments", icon: "calendar", text: "When is my next appointment?", category: "schedule" },
  { id: "navigate", icon: "compass", text: "How do I use this app?", category: "help" },
  { id: "term", icon: "book", text: "Explain a medical term", category: "education" },
];

interface AIPatientAssistantChatProps {
  patientId: string;
  compact?: boolean;
  className?: string;
  onClose?: () => void;
}

export function AIPatientAssistantChat({ 
  patientId, 
  compact = false,
  className,
  onClose,
}: AIPatientAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showContextPanel, setShowContextPanel] = useState(false);
  const [contextSelection, setContextSelection] = useState<ContextSelection>({ ...DEFAULT_CONTEXT });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const addWelcomeMessage = useCallback(() => {
    if (messages.length === 0) {
      const welcomeMessage: Message = {
        id: "welcome",
        role: "assistant",
        content: `Hello! I'm your health assistant. I can help you understand your health records, explain medical terms in simple language, and guide you through the app's features.\n\nUse the context control button to choose which parts of your health data I should focus on.\n\nHow can I help you today?`,
        timestamp: new Date(),
        metadata: {
          suggestedFollowUps: [
            "Tell me about my medications",
            "Explain my recent lab results",
            "How do I navigate the app?",
          ],
        },
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length]);

  useEffect(() => {
    addWelcomeMessage();
  }, [addWelcomeMessage]);

  const toggleCategory = (categoryId: string) => {
    setContextSelection(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(c => c !== categoryId)
        : [...prev.categories, categoryId],
    }));
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isStreaming) return;

    const currentContext = { ...contextSelection };

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
      contextSnapshot: currentContext,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/patient-assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
          userMessage: messageText.trim(),
          contextControl: {
            categories: currentContext.categories,
            timeRange: currentContext.timeRange,
            specificItems: currentContext.specificItems,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";
      let metadata: Message["metadata"] = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === "content") {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === "metadata") {
                metadata = {
                  suggestedFollowUps: data.suggestedFollowUps,
                  relatedAppFeatures: data.relatedAppFeatures,
                  medicalTermsExplained: data.medicalTermsExplained,
                  includesDisclaimer: data.includesDisclaimer,
                };
              } else if (data.type === "done") {
                const parsed = parseThinkingFromResponse(fullContent);
                const assistantMessage: Message = {
                  id: `assistant-${Date.now()}`,
                  role: "assistant",
                  content: parsed.response || fullContent,
                  thinking: parsed.thinking || undefined,
                  timestamp: new Date(),
                  metadata,
                };
                setMessages(prev => [...prev, assistantMessage]);
                setStreamingContent("");
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch {
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again or contact support if the problem persists.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleQuickPrompt = (prompt: QuickPrompt) => {
    sendMessage(prompt.text);
  };

  const handleFollowUp = (followUp: string) => {
    sendMessage(followUp);
  };

  const clearChat = () => {
    setMessages([]);
    addWelcomeMessage();
  };

  const activeContextCount = contextSelection.categories.length;
  const timeLabel = TIME_RANGE_OPTIONS.find(t => t.value === contextSelection.timeRange)?.label || "6 Months";

  const renderContextChips = () => {
    if (contextSelection.categories.length === CONTEXT_CATEGORIES.length && contextSelection.timeRange === "6months") {
      return null;
    }

    return (
      <div className="flex flex-wrap gap-1 mb-2" data-testid="context-chips-bar">
        {contextSelection.categories.map(catId => {
          const cat = CONTEXT_CATEGORIES.find(c => c.id === catId);
          if (!cat) return null;
          const CatIcon = cat.icon;
          return (
            <Badge
              key={catId}
              variant="secondary"
              className="text-[10px] py-0.5 px-1.5 gap-1 cursor-pointer hover:bg-destructive/10"
              onClick={() => toggleCategory(catId)}
              data-testid={`chip-context-${catId}`}
            >
              <CatIcon className="h-3 w-3" />
              {cat.label}
              <X className="h-2.5 w-2.5 ml-0.5" />
            </Badge>
          );
        })}
        {contextSelection.timeRange !== "6months" && (
          <Badge variant="outline" className="text-[10px] py-0.5 px-1.5 gap-1" data-testid="chip-time-range">
            <Clock className="h-3 w-3" />
            {timeLabel}
          </Badge>
        )}
      </div>
    );
  };

  const renderContextPanel = () => {
    if (!showContextPanel) return null;
    return (
      <div className="border rounded-lg p-3 mb-3 bg-muted/30 space-y-3" data-testid="context-panel">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Context Control</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => setContextSelection({ ...DEFAULT_CONTEXT })}
            data-testid="button-reset-context"
          >
            Reset
          </Button>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">Select which data the AI should consider:</p>
          <div className="grid grid-cols-2 gap-1.5">
            {CONTEXT_CATEGORIES.map(cat => {
              const CatIcon = cat.icon;
              const isSelected = contextSelection.categories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md text-left text-xs transition-colors border",
                    isSelected
                      ? "bg-primary/10 border-primary/30 text-foreground"
                      : "bg-background border-transparent text-muted-foreground hover:bg-muted"
                  )}
                  data-testid={`context-toggle-${cat.id}`}
                >
                  <div className={cn(
                    "flex items-center justify-center w-5 h-5 rounded",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <CatIcon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{cat.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Time range:</p>
          <Select
            value={contextSelection.timeRange}
            onValueChange={(val) => setContextSelection(prev => ({ ...prev, timeRange: val }))}
          >
            <SelectTrigger className="h-8 text-xs" data-testid="select-time-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <SlidersHorizontal className="h-3 w-3" />
          <span>{activeContextCount} of {CONTEXT_CATEGORIES.length} categories selected</span>
        </div>
      </div>
    );
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";
    
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3 mb-4",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
        data-testid={`message-${message.role}-${message.id}`}
      >
        <Avatar className={cn("w-8 h-8", isUser ? "bg-primary" : "bg-accent")}>
          <AvatarFallback>
            {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>
        
        <div className={cn("flex-1 max-w-[80%]", isUser && "flex flex-col items-end")}>
          {isUser && message.contextSnapshot && message.contextSnapshot.categories.length < CONTEXT_CATEGORIES.length && (
            <div className="flex flex-wrap gap-1 mb-1 justify-end" data-testid="message-context-tags">
              {message.contextSnapshot.categories.map(catId => {
                const cat = CONTEXT_CATEGORIES.find(c => c.id === catId);
                if (!cat) return null;
                return (
                  <span key={catId} className="text-[9px] text-muted-foreground bg-muted rounded px-1 py-0.5">
                    {cat.label}
                  </span>
                );
              })}
            </div>
          )}
          <div
            className={cn(
              "rounded-lg p-3 text-sm",
              isUser 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted"
            )}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>

          {!isUser && message.thinking && (
            <AIThinkingDisplay thinking={message.thinking} label="Why the AI said this" className="mt-2" />
          )}
          
          {!isUser && message.metadata?.medicalTermsExplained && message.metadata.medicalTermsExplained.length > 0 && (
            <div className="mt-1.5 p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-1">Medical Terms Explained:</p>
              {message.metadata.medicalTermsExplained.map((t, idx) => (
                <p key={idx} className="text-[10px] text-blue-600 dark:text-blue-400">
                  <strong>{t.term}:</strong> {t.explanation}
                </p>
              ))}
            </div>
          )}

          {!isUser && message.metadata?.suggestedFollowUps && message.metadata.suggestedFollowUps.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.metadata.suggestedFollowUps.map((followUp, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => handleFollowUp(followUp)}
                  data-testid={`button-followup-${idx}`}
                >
                  <ChevronRight className="w-3 h-3 mr-1" />
                  {followUp}
                </Button>
              ))}
            </div>
          )}
          
          {!isUser && message.metadata?.relatedAppFeatures && message.metadata.relatedAppFeatures.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.metadata.relatedAppFeatures.map((feature, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {feature}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (compact && !isExpanded) {
    return (
      <Button
        onClick={() => setIsExpanded(true)}
        className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg"
        data-testid="button-open-assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  const chatContent = (
    <>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md mb-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <span>{NO_CDS_BANNER}</span>
      </div>

      {renderContextChips()}
      {renderContextPanel()}

      {messages.length <= 1 && !isStreaming && (
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Quick actions:</p>
          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_QUICK_PROMPTS.map(prompt => (
              <Button
                key={prompt.id}
                variant="outline"
                className="justify-start text-xs h-auto py-2 px-3"
                onClick={() => handleQuickPrompt(prompt)}
                data-testid={`button-quick-${prompt.id}`}
              >
                {ICON_MAP[prompt.icon]}
                <span className="ml-2 truncate">{prompt.text}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea 
        className="flex-1 pr-4" 
        ref={scrollRef}
        data-testid="chat-messages-container"
      >
        {messages.map(renderMessage)}
        
        {isStreaming && streamingContent && (
          <div className="flex gap-3 mb-4">
            <Avatar className="w-8 h-8 bg-accent">
              <AvatarFallback>
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 max-w-[80%]">
              <div className="rounded-lg p-3 text-sm bg-muted">
                <div className="whitespace-pre-wrap">{streamingContent}</div>
                <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse ml-1" />
              </div>
            </div>
          </div>
        )}
        
        {isStreaming && !streamingContent && (
          <div className="flex gap-3 mb-4">
            <Avatar className="w-8 h-8 bg-accent">
              <AvatarFallback>
                <Bot className="w-4 h-4" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 max-w-[80%]">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 pt-3 border-t mt-3">
        <Button
          type="button"
          variant={showContextPanel ? "secondary" : "ghost"}
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => setShowContextPanel(!showContextPanel)}
          data-testid="button-toggle-context"
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeContextCount < CONTEXT_CATEGORIES.length && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center">
              {activeContextCount}
            </span>
          )}
        </Button>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything about your health records..."
          disabled={isStreaming}
          className="flex-1"
          data-testid="input-chat-message"
        />
        <Button 
          type="submit" 
          disabled={!input.trim() || isStreaming}
          data-testid="button-send-message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </>
  );

  if (compact) {
    return (
      <Card 
        className={cn(
          "fixed bottom-4 right-4 w-96 max-h-[600px] shadow-xl flex flex-col z-50",
          className
        )}
        data-testid="card-patient-assistant-compact"
      >
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Health Assistant</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={clearChat}
              data-testid="button-clear-chat"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsExpanded(false)}
              data-testid="button-minimize-assistant"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            {onClose && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={onClose}
                data-testid="button-close-assistant"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden pb-3">
          {chatContent}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col h-full", className)} data-testid="card-patient-assistant">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                AI Health Assistant
              </CardTitle>
              <CardDescription>
                Ask questions about your health records in simple language
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm"
              onClick={clearChat}
              data-testid="button-new-chat"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              New Chat
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {chatContent}
      </CardContent>
    </Card>
  );
}
