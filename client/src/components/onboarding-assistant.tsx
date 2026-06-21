import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  MessageCircle, 
  Send, 
  X, 
  BookOpen, 
  Lightbulb, 
  GraduationCap, 
  ChevronRight,
  Clock,
  CheckCircle2,
  Sparkles,
  HelpCircle
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

interface FeatureGuide {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Array<{ order: number; title: string; description: string; route?: string }>;
  difficulty: string;
  estimatedTime: string;
  relatedFeatures: string[];
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  steps: Array<{ order: number; title: string; content: string }>;
  duration: string;
  tags: string[];
}

interface ContextTip {
  id: string;
  context: string;
  tip: string;
  priority: string;
  dismissible: boolean;
}

interface OnboardingProgress {
  completedFeatures: string[];
  completedTutorials: string[];
  viewedTips: string[];
  questionsAsked: number;
}

export function OnboardingAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your onboarding assistant. I can help you learn about Tabula Medica's features, answer questions, and guide you through key workflows. What would you like to know?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState("chat");
  const [selectedFeature, setSelectedFeature] = useState<FeatureGuide | null>(null);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [suggestedFromChat, setSuggestedFromChat] = useState<{
    features?: FeatureGuide[];
    tutorials?: Tutorial[];
  }>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location] = useLocation();

  const { data: featuresData } = useQuery<{ success: boolean; features: FeatureGuide[] }>({
    queryKey: ["/api/ai-onboarding/features"],
    enabled: isOpen,
  });

  const { data: tutorialsData } = useQuery<{ success: boolean; tutorials: Tutorial[] }>({
    queryKey: ["/api/ai-onboarding/tutorials"],
    enabled: isOpen,
  });

  const { data: tipsData } = useQuery<{ success: boolean; tips: ContextTip[] }>({
    queryKey: ["/api/ai-onboarding/tips", location],
    enabled: isOpen,
  });

  const { data: progressData } = useQuery<{ success: boolean; progress: OnboardingProgress | null }>({
    queryKey: ["/api/ai-onboarding/progress"],
    enabled: isOpen,
  });

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await apiRequest("POST", "/api/ai-onboarding/chat", {
        message: userMessage,
        context: {
          currentRoute: location,
          userRole: "admin",
        },
      });
      return res.json() as Promise<{ response: string; suggestedFeatures?: FeatureGuide[]; suggestedTutorials?: Tutorial[] }>;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-onboarding/progress"] });
      if (data.suggestedFeatures || data.suggestedTutorials) {
        setSuggestedFromChat({
          features: data.suggestedFeatures,
          tutorials: data.suggestedTutorials,
        });
      }
    },
    onError: () => {
      setIsTyping(false);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeFeatureMutation = useMutation({
    mutationFn: async (featureId: string) => {
      const res = await apiRequest("POST", `/api/ai-onboarding/features/${featureId}/complete`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-onboarding/progress"] });
      toast({ title: "Feature completed!", description: "Great job completing this feature guide." });
    },
  });

  const completeTutorialMutation = useMutation({
    mutationFn: async (tutorialId: string) => {
      const res = await apiRequest("POST", `/api/ai-onboarding/tutorials/${tutorialId}/complete`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-onboarding/progress"] });
      toast({ title: "Tutorial completed!", description: "You've finished this tutorial." });
    },
  });

  const dismissTipMutation = useMutation({
    mutationFn: async (tipId: string) => {
      const res = await apiRequest("POST", `/api/ai-onboarding/tips/${tipId}/dismiss`);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-onboarding/tips"] });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setIsTyping(true);
    chatMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner": return "bg-green-500/10 text-green-600 dark:text-green-400";
      case "intermediate": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "advanced": return "bg-red-500/10 text-red-600 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const progress = progressData?.progress;
  const completedCount = (progress?.completedFeatures?.length || 0) + (progress?.completedTutorials?.length || 0);
  const totalCount = (featuresData?.features?.length || 0) + (tutorialsData?.tutorials?.length || 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      <Button
        data-testid="button-onboarding-assistant"
        onClick={() => setIsOpen(true)}
        size="icon"
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full shadow-lg z-50"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Onboarding Assistant
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Progress: {completedCount} of {totalCount} completed</span>
              <Progress value={progressPercent} className="flex-1 h-2" data-testid="progress-onboarding" />
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 grid w-auto grid-cols-4">
              <TabsTrigger value="chat" data-testid="tab-chat">
                <MessageCircle className="h-4 w-4 mr-1" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="features" data-testid="tab-features">
                <BookOpen className="h-4 w-4 mr-1" />
                Features
              </TabsTrigger>
              <TabsTrigger value="tutorials" data-testid="tab-tutorials">
                <GraduationCap className="h-4 w-4 mr-1" />
                Tutorials
              </TabsTrigger>
              <TabsTrigger value="tips" data-testid="tab-tips">
                <Lightbulb className="h-4 w-4 mr-1" />
                Tips
              </TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 p-4 pt-2">
              <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                        data-testid={`message-${msg.role}-${i}`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg p-3">
                        <div className="flex gap-1">
                          <span className="animate-bounce">.</span>
                          <span className="animate-bounce" style={{ animationDelay: "0.1s" }}>.</span>
                          <span className="animate-bounce" style={{ animationDelay: "0.2s" }}>.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {(suggestedFromChat.features?.length || suggestedFromChat.tutorials?.length) && (
                <div className="border-t pt-3 mt-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Suggested for you:</p>
                  <div className="flex gap-2 flex-wrap">
                    {suggestedFromChat.features?.map((f) => (
                      <Badge
                        key={f.id}
                        variant="outline"
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          setSelectedFeature(f);
                          setActiveTab("features");
                          setSuggestedFromChat({});
                        }}
                        data-testid={`suggested-feature-${f.id}`}
                      >
                        <BookOpen className="h-3 w-3 mr-1" />
                        {f.name}
                      </Badge>
                    ))}
                    {suggestedFromChat.tutorials?.map((t) => (
                      <Badge
                        key={t.id}
                        variant="secondary"
                        className="cursor-pointer hover-elevate"
                        onClick={() => {
                          setSelectedTutorial(t);
                          setActiveTab("tutorials");
                          setSuggestedFromChat({});
                        }}
                        data-testid={`suggested-tutorial-${t.id}`}
                      >
                        <GraduationCap className="h-3 w-3 mr-1" />
                        {t.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about Tabula Medica..."
                  className="resize-none"
                  rows={2}
                  data-testid="input-chat-message"
                />
                <Button
                  onClick={handleSend}
                  disabled={!message.trim() || isTyping}
                  size="icon"
                  className="h-full"
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="features" className="flex-1 overflow-hidden m-0 p-4 pt-2">
              <ScrollArea className="h-full">
                {selectedFeature ? (
                  <div className="space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedFeature(null)}
                      data-testid="button-back-features"
                    >
                      Back to Features
                    </Button>

                    <div>
                      <h3 className="text-lg font-semibold">{selectedFeature.name}</h3>
                      <p className="text-sm text-muted-foreground">{selectedFeature.description}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge className={getDifficultyColor(selectedFeature.difficulty)}>
                          {selectedFeature.difficulty}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {selectedFeature.estimatedTime}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {selectedFeature.steps.map((step) => (
                        <div
                          key={step.order}
                          className="flex gap-3 p-3 rounded-lg border hover-elevate"
                          data-testid={`feature-step-${step.order}`}
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                            {step.order}
                          </div>
                          <div>
                            <h4 className="font-medium">{step.title}</h4>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => {
                        completeFeatureMutation.mutate(selectedFeature.id);
                        setSelectedFeature(null);
                      }}
                      className="w-full"
                      data-testid="button-complete-feature"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark as Complete
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {featuresData?.features?.map((feature) => {
                      const isCompleted = progress?.completedFeatures?.includes(feature.id);
                      return (
                        <Card
                          key={feature.id}
                          className={`cursor-pointer hover-elevate ${isCompleted ? "opacity-60" : ""}`}
                          onClick={() => setSelectedFeature(feature)}
                          data-testid={`card-feature-${feature.id}`}
                        >
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">{feature.name}</CardTitle>
                              {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            </div>
                            <CardDescription className="text-sm">{feature.description}</CardDescription>
                          </CardHeader>
                          <CardFooter className="p-4 pt-0 flex gap-2">
                            <Badge className={getDifficultyColor(feature.difficulty)}>
                              {feature.difficulty}
                            </Badge>
                            <Badge variant="outline">{feature.estimatedTime}</Badge>
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tutorials" className="flex-1 overflow-hidden m-0 p-4 pt-2">
              <ScrollArea className="h-full">
                {selectedTutorial ? (
                  <div className="space-y-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTutorial(null)}
                      data-testid="button-back-tutorials"
                    >
                      Back to Tutorials
                    </Button>

                    <div>
                      <h3 className="text-lg font-semibold">{selectedTutorial.title}</h3>
                      <p className="text-sm text-muted-foreground">{selectedTutorial.description}</p>
                      <Badge variant="outline" className="mt-2">
                        <Clock className="h-3 w-3 mr-1" />
                        {selectedTutorial.duration}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                      {selectedTutorial.steps.map((step) => (
                        <div key={step.order} className="space-y-2" data-testid={`tutorial-step-${step.order}`}>
                          <h4 className="font-medium flex items-center gap-2">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">
                              {step.order}
                            </span>
                            {step.title}
                          </h4>
                          <p className="text-sm text-muted-foreground pl-8">{step.content}</p>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={() => {
                        completeTutorialMutation.mutate(selectedTutorial.id);
                        setSelectedTutorial(null);
                      }}
                      className="w-full"
                      data-testid="button-complete-tutorial"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mark Tutorial Complete
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tutorialsData?.tutorials?.map((tutorial) => {
                      const isCompleted = progress?.completedTutorials?.includes(tutorial.id);
                      return (
                        <Card
                          key={tutorial.id}
                          className={`cursor-pointer hover-elevate ${isCompleted ? "opacity-60" : ""}`}
                          onClick={() => setSelectedTutorial(tutorial)}
                          data-testid={`card-tutorial-${tutorial.id}`}
                        >
                          <CardHeader className="p-4 pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle className="text-base">{tutorial.title}</CardTitle>
                              {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                            </div>
                            <CardDescription className="text-sm">{tutorial.description}</CardDescription>
                          </CardHeader>
                          <CardFooter className="p-4 pt-0 flex gap-2 flex-wrap">
                            <Badge variant="outline">
                              <Clock className="h-3 w-3 mr-1" />
                              {tutorial.duration}
                            </Badge>
                            {tutorial.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </CardFooter>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="tips" className="flex-1 overflow-hidden m-0 p-4 pt-2">
              <ScrollArea className="h-full">
                <div className="space-y-3">
                  {tipsData?.tips && tipsData.tips.length > 0 ? (
                    tipsData.tips.map((tip) => (
                      <Card
                        key={tip.id}
                        className="relative"
                        data-testid={`card-tip-${tip.id}`}
                      >
                        <CardHeader className="p-4 pb-2">
                          <div className="flex items-start gap-3">
                            <Lightbulb className={`h-5 w-5 flex-shrink-0 ${
                              tip.priority === "high" ? "text-yellow-500" : "text-muted-foreground"
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm">{tip.tip}</p>
                            </div>
                            {tip.dismissible && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => dismissTipMutation.mutate(tip.id)}
                                data-testid={`button-dismiss-tip-${tip.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Lightbulb className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No tips for this page right now.</p>
                      <p className="text-sm">Tips appear based on what you're working on.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
