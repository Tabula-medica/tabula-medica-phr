import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Bot,
  Send,
  User,
  Sparkles,
  MessageCircle,
  Lightbulb,
  HelpCircle,
  Heart,
  Loader2,
  X,
  Target,
  Sun,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  Brain,
  Leaf,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface HealthCoachResponse {
  message: string;
  suggestions?: string[];
  disclaimer: string;
}

interface PersonalizedGuidance {
  category: "motivation" | "education" | "goal_progress" | "wellness_tip" | "mindfulness";
  title: string;
  message: string;
  actionItems: string[];
  relatedGoals: string[];
  disclaimer: string;
}

interface DailyMotivation {
  greeting: string;
  message: string;
  tip: string;
  disclaimer: string;
}

const CATEGORY_ICONS: Record<PersonalizedGuidance["category"], typeof Target> = {
  motivation: Heart,
  education: Lightbulb,
  goal_progress: Target,
  wellness_tip: Leaf,
  mindfulness: Brain,
};

const CATEGORY_COLORS: Record<PersonalizedGuidance["category"], string> = {
  motivation: "text-pink-500",
  education: "text-yellow-500",
  goal_progress: "text-green-500",
  wellness_tip: "text-blue-500",
  mindfulness: "text-purple-500",
};

const QUICK_ACTIONS = [
  { label: "Explain a medical term", icon: HelpCircle, prompt: "Can you explain a medical term for me?" },
  { label: "Motivate me", icon: Heart, prompt: "Give me some motivation for healthy habits" },
  { label: "App help", icon: Lightbulb, prompt: "How do I use this app?" },
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isUser ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={`max-w-[80%] rounded-lg p-3 ${
        isUser 
          ? "bg-primary text-primary-foreground" 
          : "bg-muted"
      }`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isUser ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          {format(new Date(message.timestamp), "h:mm a")}
        </p>
      </div>
    </div>
  );
}

function SuggestionChips({ 
  suggestions, 
  onSelect, 
  disabled 
}: { 
  suggestions: string[]; 
  onSelect: (s: string) => void;
  disabled: boolean;
}) {
  if (!suggestions.length) return null;
  
  return (
    <div className="flex flex-wrap gap-2 p-2 border-t">
      {suggestions.map((suggestion, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
          data-testid={`button-suggestion-${i}`}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}

function PersonalizedGuidanceSection() {
  const { data: guidance, isLoading, refetch, isFetching } = useQuery<PersonalizedGuidance>({
    queryKey: ["/api/health-coach/personalized"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!guidance) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No personalized guidance available yet.</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => refetch()}
          data-testid="button-refresh-guidance"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Get Personalized Guidance
        </Button>
      </div>
    );
  }

  const CategoryIcon = CATEGORY_ICONS[guidance.category];
  const categoryColor = CATEGORY_COLORS[guidance.category];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-muted ${categoryColor}`}>
          <CategoryIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{guidance.title}</h4>
            <Badge variant="outline" className="text-xs capitalize">
              {guidance.category.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {guidance.message}
          </p>
        </div>
      </div>

      {guidance.actionItems.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-3">
          <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Wellness Actions
          </h5>
          <ul className="space-y-1">
            {guidance.actionItems.map((item, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guidance.relatedGoals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground">Related goals:</span>
          {guidance.relatedGoals.map((goal, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              {goal}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-personalized"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {guidance.disclaimer}
      </p>
    </div>
  );
}

function DailyMotivationSection() {
  const { data: motivation, isLoading, refetch, isFetching } = useQuery<DailyMotivation>({
    queryKey: ["/api/health-coach/daily-motivation"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!motivation) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Sun className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Daily motivation loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Sun className="h-6 w-6 text-yellow-500" />
          <h4 className="text-xl font-semibold">{motivation.greeting}</h4>
        </div>
        <p className="text-muted-foreground">{motivation.message}</p>
      </div>

      <Alert>
        <Leaf className="h-4 w-4" />
        <AlertTitle>Wellness Tip</AlertTitle>
        <AlertDescription>{motivation.tip}</AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-refresh-motivation"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          New Motivation
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {motivation.disclaimer}
      </p>
    </div>
  );
}

export function HealthCoachCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("motivation");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([
    "Explain a medical term",
    "Help me navigate the app",
    "Motivate me to be healthier",
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Hello! I'm your AI Health Coach. I'm here to help you understand health concepts, motivate healthy habits, and guide you through the app.\n\nWhat can I help you with today?\n\nInformational only. Not medical advice.",
        timestamp: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    }
  }, [open, messages.length]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await fetch("/api/health-coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });
      if (!res.ok) throw new Error("Failed to get response");
      return res.json() as Promise<HealthCoachResponse>;
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    chatMutation.mutate(input.trim());
  };

  const handleSuggestionSelect = (suggestion: string) => {
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: suggestion,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    chatMutation.mutate(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setSuggestions([
      "Explain a medical term",
      "Help me navigate the app",
      "Motivate me to be healthier",
    ]);
  };

  return (
    <Card data-testid="card-health-coach">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          AI Health Coach
        </CardTitle>
        <CardDescription>Personalized guidance, motivation, and health education</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="motivation" data-testid="tab-motivation">
              <Sun className="h-4 w-4 mr-1" />
              Daily
            </TabsTrigger>
            <TabsTrigger value="personalized" data-testid="tab-personalized">
              <Target className="h-4 w-4 mr-1" />
              Guidance
            </TabsTrigger>
            <TabsTrigger value="chat" data-testid="tab-chat">
              <MessageCircle className="h-4 w-4 mr-1" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="motivation" className="mt-4">
            <DailyMotivationSection />
          </TabsContent>

          <TabsContent value="personalized" className="mt-4">
            <PersonalizedGuidanceSection />
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" data-testid="button-open-health-coach">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Start Chat
                </Button>
              </DialogTrigger>
          <DialogContent className="max-w-lg h-[600px] flex flex-col p-0">
            <DialogHeader className="p-4 pb-2 border-b shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-base">AI Health Coach</DialogTitle>
                    <DialogDescription className="text-xs">
                      Health education and app guidance
                    </DialogDescription>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleClearChat}
                  data-testid="button-clear-chat"
                >
                  Clear
                </Button>
              </div>
            </DialogHeader>

            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {chatMutation.isPending && (
                    <div className="flex gap-2">
                      <div className="shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Bot className="h-4 w-4" />
                      </div>
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <SuggestionChips
                suggestions={suggestions}
                onSelect={handleSuggestionSelect}
                disabled={chatMutation.isPending}
              />

              <div className="p-3 border-t shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything about health or the app..."
                    disabled={chatMutation.isPending}
                    data-testid="input-health-coach-message"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || chatMutation.isPending}
                    size="icon"
                    data-testid="button-send-message"
                  >
                    {chatMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Informational only. Not medical advice.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="cursor-pointer hover-elevate"
                  onClick={() => {
                    setOpen(true);
                    setTimeout(() => {
                      handleSuggestionSelect(action.prompt);
                    }, 100);
                  }}
                  data-testid={`badge-quick-action-${i}`}
                >
                  <action.icon className="h-3 w-3 mr-1" />
                  {action.label}
                </Badge>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
