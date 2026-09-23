import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  BookOpen,
  Pill,
  Stethoscope,
  Syringe,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  MessageCircle,
  Clock,
  ArrowLeft,
  Sparkles,
  Info,
  Send,
  History,
  Heart,
  Shield,
  Loader2,
  GraduationCap,
  Target,
  Activity,
  TrendingUp,
  CircleCheck,
  RefreshCw,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";

interface TopicSearchResult {
  id: string;
  type: "condition" | "medication" | "procedure";
  name: string;
  description: string;
  relevanceScore: number;
  fhirCode?: string;
  fhirSystem?: string;
}

interface SideEffect {
  name: string;
  severity: "common" | "less_common" | "rare" | "serious";
  description: string;
  whatToDo: string;
}

interface CareInstruction {
  category: string;
  instruction: string;
  importance: "essential" | "recommended" | "helpful";
  tips?: string[];
}

interface TopicExplanation {
  id: string;
  topic: {
    id: string;
    type: "condition" | "medication" | "procedure";
    name: string;
  };
  overview: string;
  whatItIs: string;
  causes?: string[];
  symptoms?: string[];
  howItWorks?: string;
  sideEffects?: SideEffect[];
  interactions?: string[];
  careInstructions: CareInstruction[];
  warningSignsToWatch: string[];
  questionsToAskProvider: string[];
  relatedTopics: string[];
  sources: string[];
  readingLevel: "simple" | "moderate" | "detailed";
  generatedAt: string;
  disclaimer: string;
}

interface QuestionAnswer {
  id: string;
  response: string;
  keyPoints: string[];
  recommendations: string[];
  relatedTopics: { id: string; type: string; name: string }[];
  sources: string[];
  confidence: "high" | "medium" | "low";
  answeredAt: string;
  disclaimer: string;
}

interface PatientQuestion {
  id: string;
  question: string;
  answer?: QuestionAnswer;
  askedAt: string;
}

interface CuratedArticle {
  id: string;
  category: "conditions" | "medications" | "lifestyle" | "recent_changes";
  title: string;
  summary: string;
  content: string;
  keyTakeaways: string[];
  actionItems: string[];
  relatedTo: string[];
  difficulty: "beginner" | "intermediate";
  estimatedMinutes: number;
  relevanceScore: number;
  isRead: boolean;
}

interface CuratedEducationPlan {
  patientId: string;
  welcomeMessage: string;
  focusAreas: string[];
  articles: CuratedArticle[];
  generatedAt: string;
  disclaimer: string;
}

export default function PatientEducationModule() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<TopicSearchResult | null>(null);
  const [selectedType, setSelectedType] = useState<"condition" | "medication" | "procedure" | "all">("all");
  const [readingLevel, setReadingLevel] = useState<"simple" | "moderate" | "detailed">("moderate");
  const [question, setQuestion] = useState("");
  const [activeTab, setActiveTab] = useState("for-you");
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const [curatedPlan, setCuratedPlan] = useState<CuratedEducationPlan | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const patientId = "profile-1";

  const { data: popularTopics, isLoading: popularLoading } = useQuery<{ topics: TopicSearchResult[] }>({
    queryKey: ["/api/patient-education-module/topics/popular"],
  });

  const { data: searchResults, isLoading: searchLoading, refetch: searchTopics } = useQuery<{ results: TopicSearchResult[] }>({
    queryKey: ["/api/patient-education-module/topics/search", searchQuery],
    enabled: false,
  });

  const { data: conditionTopics } = useQuery<{ topics: TopicSearchResult[] }>({
    queryKey: ["/api/patient-education-module/topics/condition"],
  });

  const { data: medicationTopics } = useQuery<{ topics: TopicSearchResult[] }>({
    queryKey: ["/api/patient-education-module/topics/medication"],
  });

  const { data: procedureTopics } = useQuery<{ topics: TopicSearchResult[] }>({
    queryKey: ["/api/patient-education-module/topics/procedure"],
  });

  const { data: questionHistory, refetch: refetchHistory } = useQuery<{ history: PatientQuestion[] }>({
    queryKey: ["/api/patient-education-module/history", patientId],
  });

  const explanationMutation = useMutation({
    mutationFn: async (topic: TopicSearchResult) => {
      const response = await apiRequest("POST", "/api/patient-education-module/explain", {
        type: topic.type,
        name: topic.name,
        code: topic.fhirCode,
        codeSystem: topic.fhirSystem,
        readingLevel,
      });
      return response.json();
    },
  });

  const askQuestionMutation = useMutation({
    mutationFn: async (q: string) => {
      const response = await apiRequest("POST", `/api/patient-education-module/ask/${patientId}`, {
        question: q,
        context: {
          conditions: ["Type 2 Diabetes", "Hypertension"],
          medications: ["Metformin", "Lisinopril"],
        },
      });
      return response.json();
    },
    onSuccess: () => {
      setQuestion("");
      refetchHistory();
    },
  });

  const curateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/patient-education-module/curate/${patientId}`);
      return response.json() as Promise<CuratedEducationPlan>;
    },
    onSuccess: (data) => {
      setCuratedPlan(data);
    },
  });

  const toggleArticleExpanded = (articleId: string) => {
    setExpandedArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  const toggleArticleRead = (articleId: string) => {
    setReadArticles(prev => {
      const next = new Set(prev);
      if (next.has(articleId)) {
        next.delete(articleId);
      } else {
        next.add(articleId);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "conditions": return <Stethoscope className="w-4 h-4" />;
      case "medications": return <Pill className="w-4 h-4" />;
      case "lifestyle": return <Heart className="w-4 h-4" />;
      case "recent_changes": return <TrendingUp className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "conditions": return "My Conditions";
      case "medications": return "My Medications";
      case "lifestyle": return "Lifestyle & Wellness";
      case "recent_changes": return "Recent Changes";
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "conditions": return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300";
      case "medications": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
      case "lifestyle": return "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300";
      case "recent_changes": return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const filteredArticles = curatedPlan?.articles.filter(
    a => selectedCategory === "all" || a.category === selectedCategory
  ) || [];

  const readCount = curatedPlan?.articles.filter(a => readArticles.has(a.id)).length || 0;
  const totalCount = curatedPlan?.articles.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchTopics();
    }
  };

  const handleSelectTopic = (topic: TopicSearchResult) => {
    setSelectedTopic(topic);
    explanationMutation.mutate(topic);
  };

  const handleAskQuestion = () => {
    if (question.trim().length >= 5) {
      askQuestionMutation.mutate(question);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "condition": return <Stethoscope className="w-4 h-4" />;
      case "medication": return <Pill className="w-4 h-4" />;
      case "procedure": return <Syringe className="w-4 h-4" />;
      default: return <BookOpen className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "condition": return "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400";
      case "medication": return "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400";
      case "procedure": return "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "common": return <Badge variant="secondary">Common</Badge>;
      case "less_common": return <Badge variant="outline">Less Common</Badge>;
      case "rare": return <Badge variant="outline">Rare</Badge>;
      case "serious": return <Badge variant="destructive">Serious</Badge>;
      default: return null;
    }
  };

  const getImportanceBadge = (importance: string) => {
    switch (importance) {
      case "essential": return <Badge variant="destructive">Essential</Badge>;
      case "recommended": return <Badge>Recommended</Badge>;
      case "helpful": return <Badge variant="secondary">Helpful</Badge>;
      default: return null;
    }
  };

  if (selectedTopic && explanationMutation.data) {
    const explanation: TopicExplanation = explanationMutation.data.explanation;
    
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button 
          variant="ghost" 
          onClick={() => { setSelectedTopic(null); explanationMutation.reset(); }}
          className="mb-4"
          data-testid="button-back-to-topics"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Topics
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-2 rounded-lg ${getTypeColor(explanation.topic.type)}`}>
                    {getTypeIcon(explanation.topic.type)}
                  </div>
                  <Badge variant="outline" className="capitalize">{explanation.topic.type}</Badge>
                </div>
                <CardTitle className="text-2xl">{explanation.topic.name}</CardTitle>
                <CardDescription className="mt-2">{explanation.overview}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant={readingLevel === "simple" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => { setReadingLevel("simple"); explanationMutation.mutate(selectedTopic); }}
                  data-testid="button-reading-simple"
                >
                  Simple
                </Button>
                <Button 
                  variant={readingLevel === "moderate" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => { setReadingLevel("moderate"); explanationMutation.mutate(selectedTopic); }}
                  data-testid="button-reading-moderate"
                >
                  Moderate
                </Button>
                <Button 
                  variant={readingLevel === "detailed" ? "default" : "outline"} 
                  size="sm"
                  onClick={() => { setReadingLevel("detailed"); explanationMutation.mutate(selectedTopic); }}
                  data-testid="button-reading-detailed"
                >
                  Detailed
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Info className="w-5 h-5 text-primary" />
                What is it?
              </h3>
              <p className="text-muted-foreground leading-relaxed">{explanation.whatItIs}</p>
            </section>

            {explanation.causes && explanation.causes.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Possible Causes</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {explanation.causes.map((cause, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      {cause}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {explanation.symptoms && explanation.symptoms.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Common Symptoms</h3>
                <div className="flex flex-wrap gap-2">
                  {explanation.symptoms.map((symptom, idx) => (
                    <Badge key={idx} variant="outline">{symptom}</Badge>
                  ))}
                </div>
              </section>
            )}

            {explanation.howItWorks && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  How it Works
                </h3>
                <p className="text-muted-foreground leading-relaxed">{explanation.howItWorks}</p>
              </section>
            )}

            {explanation.sideEffects && explanation.sideEffects.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Potential Side Effects
                </h3>
                <div className="space-y-3">
                  {explanation.sideEffects.map((effect, idx) => (
                    <Card key={idx} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-medium">{effect.name}</h4>
                          {getSeverityBadge(effect.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{effect.description}</p>
                        <div className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                          <Lightbulb className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                          <span>{effect.whatToDo}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {explanation.interactions && explanation.interactions.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-500" />
                  Interactions to be Aware of
                </h3>
                <ul className="space-y-2">
                  {explanation.interactions.map((interaction, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                      {interaction}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Separator />

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" />
                Care Instructions
              </h3>
              <div className="space-y-3">
                {explanation.careInstructions.map((care, idx) => (
                  <Card key={idx} className="hover-elevate">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline">{care.category}</Badge>
                        {getImportanceBadge(care.importance)}
                      </div>
                      <p className="font-medium mb-2">{care.instruction}</p>
                      {care.tips && care.tips.length > 0 && (
                        <ul className="space-y-1">
                          {care.tips.map((tip, tipIdx) => (
                            <li key={tipIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <Lightbulb className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Warning Signs to Watch
              </h3>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Contact your healthcare provider if you experience:</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {explanation.warningSignsToWatch.map((sign, idx) => (
                      <li key={idx}>{sign}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Questions to Ask Your Provider
              </h3>
              <div className="space-y-2">
                {explanation.questionsToAskProvider.map((q, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border hover-elevate">
                    <HelpCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                    <span className="text-sm">{q}</span>
                  </div>
                ))}
              </div>
            </section>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Disclaimer</AlertTitle>
              <AlertDescription className="text-sm">
                {explanation.disclaimer}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-primary" />
          Health Education Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Learn about conditions, medications, and procedures in easy-to-understand language
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="for-you" className="flex items-center gap-2" data-testid="tab-for-you">
            <Sparkles className="w-4 h-4" />
            For You
          </TabsTrigger>
          <TabsTrigger value="browse" className="flex items-center gap-2" data-testid="tab-browse">
            <BookOpen className="w-4 h-4" />
            Browse Topics
          </TabsTrigger>
          <TabsTrigger value="ask" className="flex items-center gap-2" data-testid="tab-ask">
            <MessageCircle className="w-4 h-4" />
            Ask a Question
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
            <History className="w-4 h-4" />
            My Questions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="for-you" className="space-y-6">
          {!curatedPlan && !curateMutation.isPending && (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2" data-testid="text-for-you-title">Your Personalized Learning Plan</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Get educational content tailored to your specific health conditions, medications, and recent health insights.
                </p>
                <Button
                  onClick={() => curateMutation.mutate()}
                  data-testid="button-generate-plan"
                >
                  <GraduationCap className="w-4 h-4 mr-2" />
                  Generate My Learning Plan
                </Button>
              </CardContent>
            </Card>
          )}

          {curateMutation.isPending && (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-1" data-testid="text-generating">Analyzing Your Health Profile</h3>
                <p className="text-muted-foreground text-sm">
                  Creating personalized educational content based on your conditions, medications, and recent health data...
                </p>
              </CardContent>
            </Card>
          )}

          {curateMutation.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Unable to Generate Plan</AlertTitle>
              <AlertDescription>
                We couldn't create your personalized plan right now. Please try again.
                <Button variant="outline" size="sm" className="ml-2" onClick={() => curateMutation.mutate()} data-testid="button-retry-plan">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {curatedPlan && !curateMutation.isPending && (
            <>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-primary shrink-0" />
                        <h3 className="font-semibold" data-testid="text-welcome-heading">Your Learning Plan</h3>
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid="text-welcome-message">{curatedPlan.welcomeMessage}</p>
                      {curatedPlan.focusAreas.length > 0 && (
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          <Target className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Focus areas:</span>
                          {curatedPlan.focusAreas.map((area, idx) => (
                            <Badge key={idx} variant="secondary" data-testid={`badge-focus-area-${idx}`}>{area}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary" data-testid="text-progress-percent">{progressPercent}%</span>
                        <p className="text-xs text-muted-foreground">{readCount} of {totalCount} read</p>
                      </div>
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                          data-testid="progress-bar"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setCuratedPlan(null); setReadArticles(new Set()); setExpandedArticles(new Set()); curateMutation.mutate(); }}
                        data-testid="button-refresh-plan"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={selectedCategory === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory("all")}
                  data-testid="button-category-all"
                >
                  All ({totalCount})
                </Button>
                {(["conditions", "medications", "lifestyle", "recent_changes"] as const).map(cat => {
                  const count = curatedPlan.articles.filter(a => a.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <Button
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedCategory(cat)}
                      data-testid={`button-category-${cat}`}
                    >
                      {getCategoryIcon(cat)}
                      <span className="ml-1">{getCategoryLabel(cat)} ({count})</span>
                    </Button>
                  );
                })}
              </div>

              <div className="space-y-4">
                {filteredArticles.map((article) => {
                  const isExpanded = expandedArticles.has(article.id);
                  const isRead = readArticles.has(article.id);
                  return (
                    <Card key={article.id} className={isRead ? "opacity-75" : ""} data-testid={`card-article-${article.id}`}>
                      <CardContent className="p-0">
                        <button
                          className="w-full text-left p-4 hover-elevate rounded-md"
                          onClick={() => toggleArticleExpanded(article.id)}
                          data-testid={`button-expand-${article.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryColor(article.category)}`}>
                                  {getCategoryIcon(article.category)}
                                  {getCategoryLabel(article.category)}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {article.difficulty === "beginner" ? "Beginner" : "Intermediate"}
                                </Badge>
                                {article.relevanceScore >= 0.85 && (
                                  <Badge variant="secondary" className="text-xs">Highly Relevant</Badge>
                                )}
                                {isRead && (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CircleCheck className="w-3 h-3" />
                                    Read
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-sm" data-testid={`text-article-title-${article.id}`}>{article.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2" data-testid={`text-article-summary-${article.id}`}>{article.summary}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-article-time-${article.id}`}>
                                <Clock className="w-3 h-3" />
                                {article.estimatedMinutes} min
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-4 border-t pt-4">
                            <div className="prose prose-sm max-w-none text-foreground" data-testid={`text-article-content-${article.id}`}>
                              {article.content.split("\n").map((paragraph, idx) =>
                                paragraph.trim() ? <p key={idx} className="text-sm text-muted-foreground leading-relaxed mb-2">{paragraph}</p> : null
                              )}
                            </div>

                            {article.keyTakeaways.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                  <Lightbulb className="w-4 h-4 text-amber-500" />
                                  Key Takeaways
                                </h5>
                                <ul className="space-y-1.5" data-testid={`list-takeaways-${article.id}`}>
                                  {article.keyTakeaways.map((point, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`text-takeaway-${article.id}-${idx}`}>
                                      <CheckCircle className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                                      {point}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {article.actionItems.length > 0 && (
                              <div>
                                <h5 className="text-sm font-semibold flex items-center gap-2 mb-2">
                                  <Target className="w-4 h-4 text-primary" />
                                  Action Items
                                </h5>
                                <ul className="space-y-1.5" data-testid={`list-actions-${article.id}`}>
                                  {article.actionItems.map((action, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`text-action-${article.id}-${idx}`}>
                                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {article.relatedTo.length > 0 && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">Related to:</span>
                                {article.relatedTo.map((rel, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">{rel}</Badge>
                                ))}
                              </div>
                            )}

                            <Separator />

                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Button
                                variant={isRead ? "secondary" : "default"}
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); toggleArticleRead(article.id); }}
                                data-testid={`button-mark-read-${article.id}`}
                              >
                                {isRead ? (
                                  <>
                                    <CircleCheck className="w-3 h-3 mr-1" />
                                    Completed
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Mark as Read
                                  </>
                                )}
                              </Button>
                              <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-relevance-${article.id}`}>
                                <Activity className="w-3 h-3" />
                                Relevance: {Math.round(article.relevanceScore * 100)}%
                              </span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Alert>
                <Shield className="w-4 h-4" />
                <AlertTitle>Educational Content Only</AlertTitle>
                <AlertDescription className="text-xs" data-testid="text-disclaimer">
                  {curatedPlan.disclaimer}
                </AlertDescription>
              </Alert>
            </>
          )}
        </TabsContent>

        <TabsContent value="browse" className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search for a condition, medication, or procedure..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-10"
                    data-testid="input-search-topics"
                  />
                </div>
                <Button onClick={handleSearch} disabled={!searchQuery.trim()} data-testid="button-search">
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          {searchQuery && searchResults?.results && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Search Results</CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.results.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.results.map((topic) => (
                      <div
                        key={topic.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                        {...clickable(() => handleSelectTopic(topic))}
                        data-testid={`search-result-${topic.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${getTypeColor(topic.type)}`}>
                            {getTypeIcon(topic.type)}
                          </div>
                          <div>
                            <p className="font-medium">{topic.name}</p>
                            <p className="text-sm text-muted-foreground">{topic.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">No results found</p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button 
              variant={selectedType === "all" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedType("all")}
              data-testid="filter-all"
            >
              All Topics
            </Button>
            <Button 
              variant={selectedType === "condition" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedType("condition")}
              data-testid="filter-conditions"
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              Conditions
            </Button>
            <Button 
              variant={selectedType === "medication" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedType("medication")}
              data-testid="filter-medications"
            >
              <Pill className="w-4 h-4 mr-2" />
              Medications
            </Button>
            <Button 
              variant={selectedType === "procedure" ? "default" : "outline"} 
              size="sm"
              onClick={() => setSelectedType("procedure")}
              data-testid="filter-procedures"
            >
              <Syringe className="w-4 h-4 mr-2" />
              Procedures
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(selectedType === "all" ? popularTopics?.topics : 
              selectedType === "condition" ? conditionTopics?.topics :
              selectedType === "medication" ? medicationTopics?.topics :
              procedureTopics?.topics
            )?.map((topic) => (
              <Card 
                key={topic.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => handleSelectTopic(topic)}
                data-testid={`topic-card-${topic.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(topic.type)}`}>
                      {getTypeIcon(topic.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{topic.name}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">{topic.description}</p>
                      <Badge variant="outline" className="mt-2 capitalize">{topic.type}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {popularLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ask" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Ask a Health Question
              </CardTitle>
              <CardDescription>
                Get AI-powered answers to your health questions based on your health profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Type your health question here... (e.g., 'What should I know about managing diabetes?' or 'How does my medication interact with food?')"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={4}
                data-testid="input-question"
              />
              <div className="flex justify-between items-center gap-4 flex-wrap">
                <p className="text-sm text-muted-foreground">
                  {question.length < 5 ? "Minimum 5 characters required" : `${question.length} characters`}
                </p>
                <Button 
                  onClick={handleAskQuestion}
                  disabled={question.length < 5 || askQuestionMutation.isPending}
                  data-testid="button-ask-question"
                >
                  {askQuestionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Thinking...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Ask Question
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {askQuestionMutation.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" />
                  Answer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="leading-relaxed">{askQuestionMutation.data.answer.response}</p>

                {askQuestionMutation.data.answer.keyPoints.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Key Points</h4>
                    <ul className="space-y-1">
                      {askQuestionMutation.data.answer.keyPoints.map((point: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {askQuestionMutation.data.answer.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {askQuestionMutation.data.answer.recommendations.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Lightbulb className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertTitle>Disclaimer</AlertTitle>
                  <AlertDescription className="text-sm">
                    {askQuestionMutation.data.answer.disclaimer}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                My Question History
              </CardTitle>
              <CardDescription>
                Review your previously asked questions and their answers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {questionHistory?.history && questionHistory.history.length > 0 ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {questionHistory.history.map((item) => (
                      <Card key={item.id} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">{item.question}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.askedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {item.answer && (
                            <div className="pl-7 pt-3 border-t">
                              <p className="text-sm text-muted-foreground">{item.answer.response.slice(0, 200)}...</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No questions asked yet</p>
                  <p className="text-sm">Start by asking a question in the "Ask a Question" tab</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {explanationMutation.isPending && (
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
          <Card className="w-80">
            <CardContent className="p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="font-medium">Loading educational content...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while we prepare your information</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
