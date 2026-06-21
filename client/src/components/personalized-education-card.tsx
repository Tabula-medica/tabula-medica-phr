import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Video,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  GraduationCap,
  Lightbulb,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ListChecks
} from "lucide-react";

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface InteractiveModule {
  id: string;
  title: string;
  type: "quiz" | "checklist" | "assessment";
  description: string;
  questions?: QuizQuestion[];
  checklistItems?: ChecklistItem[];
  completed: boolean;
}

interface EducationalArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  readingLevel: string;
  estimatedReadTime: number;
  keyPoints: string[];
  relatedConditions: string[];
  contentType: "article" | "video" | "interactive";
  videoUrl?: string;
  interactiveModules?: InteractiveModule[];
  relevanceScore: number;
  matchReasons: string[];
  createdAt: string;
}

interface PersonalizedEducationData {
  success: boolean;
  content: EducationalArticle[];
  noCdsDisclaimer: string;
  lastUpdated: string;
}

interface PersonalizedEducationCardProps {
  userId: string;
}

export function PersonalizedEducationCard({ userId }: PersonalizedEducationCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("articles");
  const [selectedArticle, setSelectedArticle] = useState<EducationalArticle | null>(null);
  const [activeModule, setActiveModule] = useState<InteractiveModule | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [checklistState, setChecklistState] = useState<Record<string, boolean>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const { data, isLoading, refetch } = useQuery<PersonalizedEducationData>({
    queryKey: ["/api/personalized-education/personalized"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/personalized-education/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personalized-education/personalized"] });
      toast({ title: "Content refreshed", description: "Your personalized education content has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to refresh content", variant: "destructive" });
    }
  });

  const progressMutation = useMutation({
    mutationFn: async ({ moduleId, completed, score }: { moduleId: string; completed: boolean; score?: number }) => {
      return apiRequest("POST", `/api/personalized-education/module/${moduleId}/progress`, { completed, score });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/personalized-education/personalized"] });
    }
  });

  const articles = data?.content?.filter(c => c.contentType === "article") || [];
  const videos = data?.content?.filter(c => c.contentType === "video") || [];
  const interactive = data?.content?.filter(c => c.contentType === "interactive") || [];

  const handleQuizSubmit = (module: InteractiveModule) => {
    if (!module.questions) return;
    
    let correct = 0;
    module.questions.forEach(q => {
      if (quizAnswers[q.id] === q.correctAnswer) correct++;
    });
    
    const score = Math.round((correct / module.questions.length) * 100);
    setQuizSubmitted(true);
    
    progressMutation.mutate({ moduleId: module.id, completed: true, score });
    
    toast({
      title: `Quiz Complete!`,
      description: `You scored ${score}% (${correct}/${module.questions.length} correct)`,
    });
  };

  const handleChecklistComplete = (module: InteractiveModule) => {
    progressMutation.mutate({ moduleId: module.id, completed: true });
    setActiveModule(null);
    toast({ title: "Checklist saved", description: "Your discussion topics have been saved." });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Personalized Learning
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Personalized Learning
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-education"
            >
              <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <CardDescription>Health education tailored to your goals and conditions</CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="articles" data-testid="tab-edu-articles">
                <FileText className="h-4 w-4 mr-1" />
                Articles ({articles.length})
              </TabsTrigger>
              <TabsTrigger value="videos" data-testid="tab-edu-videos">
                <Video className="h-4 w-4 mr-1" />
                Videos ({videos.length})
              </TabsTrigger>
              <TabsTrigger value="interactive" data-testid="tab-edu-interactive">
                <Brain className="h-4 w-4 mr-1" />
                Interactive ({interactive.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="articles">
              <ScrollArea className="h-80">
                {articles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No personalized articles available yet.</p>
                    <p className="text-sm">Track your health goals to get tailored content.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {articles.map(article => (
                      <div
                        key={article.id}
                        className="p-4 border rounded-lg hover-elevate cursor-pointer"
                        onClick={() => setSelectedArticle(article)}
                        data-testid={`article-${article.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm mb-1">{article.title}</h4>
                            <p className="text-xs text-muted-foreground line-clamp-2">{article.summary}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {article.estimatedReadTime} min
                          </Badge>
                          <Badge variant="outline" className="text-xs">{article.category}</Badge>
                          {article.relevanceScore >= 0.8 && (
                            <Badge className="text-xs bg-green-500/10 text-green-600">
                              <Target className="h-3 w-3 mr-1" />
                              Recommended
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="videos">
              <ScrollArea className="h-80">
                {videos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No video content available yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {videos.map(video => (
                      <div
                        key={video.id}
                        className="p-4 border rounded-lg hover-elevate cursor-pointer"
                        data-testid={`video-${video.id}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-3 rounded-lg bg-primary/10">
                            <Play className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{video.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {video.estimatedReadTime} min
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">{video.summary}</p>
                        <Badge variant="outline" className="mt-2 text-xs">{video.category}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="interactive">
              <ScrollArea className="h-80">
                {interactive.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No interactive modules available yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {interactive.map(item => (
                      <div key={item.id} className="p-4 border rounded-lg" data-testid={`interactive-${item.id}`}>
                        <h4 className="font-medium mb-2">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{item.summary}</p>
                        <div className="space-y-2">
                          {item.interactiveModules?.map(module => (
                            <Button
                              key={module.id}
                              variant="outline"
                              size="sm"
                              className="w-full justify-between"
                              onClick={() => {
                                setActiveModule(module);
                                setQuizAnswers({});
                                setChecklistState({});
                                setQuizSubmitted(false);
                              }}
                              data-testid={`module-${module.id}`}
                            >
                              <span className="flex items-center gap-2">
                                {module.type === "quiz" ? (
                                  <GraduationCap className="h-4 w-4" />
                                ) : (
                                  <ListChecks className="h-4 w-4" />
                                )}
                                {module.title}
                              </span>
                              {module.completed ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {data?.noCdsDisclaimer && (
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              {data.noCdsDisclaimer}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedArticle} onOpenChange={(open) => !open && setSelectedArticle(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedArticle.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedArticle.estimatedReadTime} min read
                  </Badge>
                  <Badge variant="outline">{selectedArticle.category}</Badge>
                  <Badge variant="outline">{selectedArticle.readingLevel}</Badge>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selectedArticle.matchReasons.length > 0 && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="font-medium">Why this is relevant:</span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedArticle.matchReasons[0]}</p>
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div dangerouslySetInnerHTML={{ __html: selectedArticle.content.replace(/\n/g, '<br/>').replace(/##\s+/g, '<h3 class="text-lg font-semibold mt-4 mb-2">').replace(/\n/g, '</h3>') }} />
                </div>

                {selectedArticle.keyPoints.length > 0 && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium flex items-center gap-2 mb-2">
                      <Lightbulb className="h-4 w-4" />
                      Key Points
                    </h4>
                    <ul className="space-y-1">
                      {selectedArticle.keyPoints.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-muted-foreground border-t pt-4">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  This content is for educational purposes only and does not constitute medical advice. 
                  Always consult your healthcare provider for personalized guidance.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activeModule} onOpenChange={(open) => !open && setActiveModule(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {activeModule && (
            <>
              <DialogHeader>
                <DialogTitle>{activeModule.title}</DialogTitle>
                <DialogDescription>{activeModule.description}</DialogDescription>
              </DialogHeader>

              {activeModule.type === "quiz" && activeModule.questions && (
                <div className="space-y-6">
                  {activeModule.questions.map((q, idx) => (
                    <div key={q.id} className="space-y-3">
                      <p className="font-medium">
                        {idx + 1}. {q.question}
                      </p>
                      <RadioGroup
                        value={quizAnswers[q.id]?.toString()}
                        onValueChange={(val) => setQuizAnswers(prev => ({ ...prev, [q.id]: parseInt(val) }))}
                        disabled={quizSubmitted}
                      >
                        {q.options.map((option, optIdx) => (
                          <div key={optIdx} className="flex items-center space-x-2">
                            <RadioGroupItem
                              value={optIdx.toString()}
                              id={`${q.id}-${optIdx}`}
                              data-testid={`quiz-option-${q.id}-${optIdx}`}
                            />
                            <Label
                              htmlFor={`${q.id}-${optIdx}`}
                              className={`flex-1 ${
                                quizSubmitted
                                  ? optIdx === q.correctAnswer
                                    ? "text-green-600"
                                    : quizAnswers[q.id] === optIdx
                                    ? "text-red-600"
                                    : ""
                                  : ""
                              }`}
                            >
                              {option}
                              {quizSubmitted && optIdx === q.correctAnswer && (
                                <CheckCircle2 className="h-4 w-4 inline ml-2 text-green-500" />
                              )}
                              {quizSubmitted && quizAnswers[q.id] === optIdx && optIdx !== q.correctAnswer && (
                                <XCircle className="h-4 w-4 inline ml-2 text-red-500" />
                              )}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {quizSubmitted && (
                        <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                          <Lightbulb className="h-3 w-3 inline mr-1" />
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}

                  {!quizSubmitted ? (
                    <Button
                      onClick={() => handleQuizSubmit(activeModule)}
                      disabled={Object.keys(quizAnswers).length < (activeModule.questions?.length || 0)}
                      className="w-full"
                      data-testid="button-submit-quiz"
                    >
                      Submit Quiz
                    </Button>
                  ) : (
                    <Button onClick={() => setActiveModule(null)} className="w-full">
                      Close
                    </Button>
                  )}
                </div>
              )}

              {activeModule.type === "checklist" && activeModule.checklistItems && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Check off topics you want to discuss with your healthcare provider:
                  </p>
                  <div className="space-y-3">
                    {activeModule.checklistItems.map(item => (
                      <div key={item.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={item.id}
                          checked={checklistState[item.id] || false}
                          onCheckedChange={(checked) => 
                            setChecklistState(prev => ({ ...prev, [item.id]: !!checked }))
                          }
                          data-testid={`checklist-${item.id}`}
                        />
                        <Label htmlFor={item.id} className="text-sm">{item.text}</Label>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => handleChecklistComplete(activeModule)}
                    className="w-full"
                    data-testid="button-save-checklist"
                  >
                    Save Checklist
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
