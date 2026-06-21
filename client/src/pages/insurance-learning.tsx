import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import {
  DollarSign,
  Wallet,
  Network,
  ClipboardCheck,
  Share2,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  GraduationCap,
  Globe,
  Sparkles,
  ArrowRight,
  Search,
  Info,
  Loader2,
  MessageSquare,
} from "lucide-react";

interface LessonSummary {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  stepCount: number;
  quizCount: number;
}

interface LessonStep {
  id: string;
  title: string;
  content: string;
  analogy: string;
  keyTakeaway: string;
  example?: { scenario: string; breakdown: string };
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface LessonModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  steps: LessonStep[];
  quiz: QuizQuestion[];
}

interface GlossaryTerm {
  term: string;
  definition: string;
}

const iconMap: Record<string, typeof DollarSign> = {
  DollarSign,
  Wallet,
  Network,
  ClipboardCheck,
  Share2,
};

function ModuleCard({ module, onStart, completed }: { module: LessonSummary; onStart: () => void; completed: boolean }) {
  const Icon = iconMap[module.icon] || BookOpen;
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-module-${module.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid={`text-module-title-${module.id}`}>{module.title}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">{module.stepCount} steps</Badge>
                <Badge variant="outline" className="text-xs">{module.quizCount} quiz questions</Badge>
              </div>
            </div>
          </div>
          {completed && (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
        <Button onClick={onStart} className="w-full" data-testid={`button-start-${module.id}`}>
          {completed ? "Review Again" : "Start Learning"}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

function StepViewer({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  language,
}: {
  step: LessonStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  language: string;
}) {
  const [showExample, setShowExample] = useState(false);
  const [animateIn, setAnimateIn] = useState(true);

  const handleNext = () => {
    setAnimateIn(false);
    setTimeout(() => {
      onNext();
      setAnimateIn(true);
      setShowExample(false);
    }, 200);
  };

  const handlePrev = () => {
    setAnimateIn(false);
    setTimeout(() => {
      onPrev();
      setAnimateIn(true);
      setShowExample(false);
    }, 200);
  };

  const { data: translatedContent, isLoading: translating } = useQuery({
    queryKey: ["/api/insurance-learning/translate", step.id, language],
    queryFn: async () => {
      if (language === "en") return null;
      const contentToTranslate = `TITLE: ${step.title}\n\nCONTENT: ${step.content}\n\nANALOGY: ${step.analogy}\n\nKEY TAKEAWAY: ${step.keyTakeaway}`;
      const res = await apiRequest("POST", "/api/insurance-learning/translate", {
        text: contentToTranslate,
        targetLanguage: language,
        context: "insurance education step",
      });
      return res.json();
    },
    enabled: language !== "en",
    staleTime: 1000 * 60 * 30,
  });

  const displayContent = translatedContent?.translatedText || null;
  const sections = displayContent
    ? {
        title: displayContent.split("CONTENT:")[0]?.replace("TITLE:", "").trim() || step.title,
        content: displayContent.split("CONTENT:")[1]?.split("ANALOGY:")[0]?.trim() || step.content,
        analogy: displayContent.split("ANALOGY:")[1]?.split("KEY TAKEAWAY:")[0]?.trim() || step.analogy,
        keyTakeaway: displayContent.split("KEY TAKEAWAY:")[1]?.trim() || step.keyTakeaway,
      }
    : { title: step.title, content: step.content, analogy: step.analogy, keyTakeaway: step.keyTakeaway };

  return (
    <div className={`space-y-6 transition-all duration-300 ${animateIn ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Step {stepIndex + 1} of {totalSteps}</Badge>
          {translating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <Progress value={((stepIndex + 1) / totalSteps) * 100} className="w-32" />
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4" data-testid={`text-step-title-${stepIndex}`}>{sections.title}</h3>
        <p className="text-base leading-relaxed mb-6">{sections.content}</p>
      </div>

      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-200 mb-1">Think of it this way...</p>
              <p className="text-sm text-blue-800 dark:text-blue-300">{sections.analogy}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-200 mb-1">Key Takeaway</p>
              <p className="text-sm text-green-800 dark:text-green-300">{sections.keyTakeaway}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {step.example && (
        <div>
          <Button variant="outline" onClick={() => setShowExample(!showExample)} className="mb-3" data-testid={`button-example-${stepIndex}`}>
            <BookOpen className="h-4 w-4 mr-2" />
            {showExample ? "Hide Example" : "See Real-World Example"}
          </Button>
          {showExample && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <CardContent className="pt-4 space-y-3">
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">Scenario</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{step.example.scenario}</p>
                </div>
                <Separator />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-200">Breakdown</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{step.example.breakdown}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={handlePrev} disabled={stepIndex === 0} data-testid="button-prev-step">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <Button onClick={handleNext} data-testid="button-next-step">
          {stepIndex === totalSteps - 1 ? "Take Quiz" : "Next Step"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function QuizView({
  questions,
  onComplete,
}: {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}) {
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<boolean[]>(new Array(questions.length).fill(false));

  const question = questions[currentQ];

  const handleAnswer = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    if (index === question.correctIndex) {
      setScore(s => s + 1);
    }
    const newAnswered = [...answered];
    newAnswered[currentQ] = true;
    setAnswered(newAnswered);
  };

  const handleNext = () => {
    if (currentQ === questions.length - 1) {
      const finalScore = selectedAnswer === question.correctIndex ? score : score;
      onComplete(finalScore);
    } else {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Badge variant="outline">
          <GraduationCap className="h-3 w-3 mr-1" />
          Question {currentQ + 1} of {questions.length}
        </Badge>
        <Badge variant="secondary">Score: {score}/{questions.length}</Badge>
      </div>

      <h3 className="text-xl font-semibold" data-testid={`text-quiz-question-${currentQ}`}>{question.question}</h3>

      <div className="space-y-3">
        {question.options.map((option, idx) => {
          let variant: "outline" | "default" | "destructive" = "outline";
          let extraClass = "justify-start text-left h-auto py-3 px-4";
          if (showResult) {
            if (idx === question.correctIndex) {
              extraClass += " border-green-500 bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200";
            } else if (idx === selectedAnswer && idx !== question.correctIndex) {
              extraClass += " border-red-500 bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200";
            }
          } else if (idx === selectedAnswer) {
            extraClass += " border-primary bg-primary/5";
          }

          return (
            <Button
              key={idx}
              variant={variant}
              className={`w-full ${extraClass}`}
              onClick={() => handleAnswer(idx)}
              disabled={showResult}
              data-testid={`button-answer-${currentQ}-${idx}`}
            >
              <span className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium flex-shrink-0">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
                {showResult && idx === question.correctIndex && <CheckCircle className="h-4 w-4 text-green-600 ml-auto flex-shrink-0" />}
                {showResult && idx === selectedAnswer && idx !== question.correctIndex && <XCircle className="h-4 w-4 text-red-600 ml-auto flex-shrink-0" />}
              </span>
            </Button>
          );
        })}
      </div>

      {showResult && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 animate-in fade-in duration-300">
          <CardContent className="pt-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>Explanation:</strong> {question.explanation}
            </p>
          </CardContent>
        </Card>
      )}

      {showResult && (
        <div className="flex justify-end">
          <Button onClick={handleNext} data-testid="button-next-question">
            {currentQ === questions.length - 1 ? "See Results" : "Next Question"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

function AIExplainPanel({ topic, language }: { topic: string; language: string }) {
  const [question, setQuestion] = useState("");

  const explainMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/insurance-learning/ai-explain", {
        topic,
        question: q || undefined,
        language,
      });
      return res.json();
    },
  });

  return (
    <Card data-testid="card-ai-explain">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Ask AI About This Topic
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask about ${topic}...`}
            onKeyDown={(e) => e.key === "Enter" && explainMutation.mutate(question)}
            data-testid="input-ai-question"
          />
          <Button
            onClick={() => explainMutation.mutate(question)}
            disabled={explainMutation.isPending}
            data-testid="button-ask-ai"
          >
            {explainMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          </Button>
        </div>
        {explainMutation.data && (
          <div className="space-y-2 animate-in fade-in duration-300">
            <p className="text-sm leading-relaxed">{explainMutation.data.explanation}</p>
            <p className="text-xs text-muted-foreground italic">{explainMutation.data.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InsuranceLearning() {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<"steps" | "quiz" | "results">("steps");
  const [quizScore, setQuizScore] = useState(0);
  const [completedModules, setCompletedModules] = useState<Set<string>>(new Set());
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [glossarySearch, setGlossarySearch] = useState("");

  const { data: modulesData, isLoading } = useQuery<{ modules: LessonSummary[]; languages: { code: string; name: string }[] }>({
    queryKey: ["/api/insurance-learning/modules"],
  });

  const { data: activeModuleData } = useQuery<LessonModule>({
    queryKey: ["/api/insurance-learning/modules", activeModule],
    enabled: !!activeModule,
  });

  const { data: glossaryData } = useQuery<{ glossary: GlossaryTerm[] }>({
    queryKey: ["/api/insurance-learning/glossary"],
  });

  const modules = modulesData?.modules || [];
  const languages = modulesData?.languages || [];
  const glossary = glossaryData?.glossary || [];
  const filteredGlossary = glossarySearch
    ? glossary.filter(g => g.term.toLowerCase().includes(glossarySearch.toLowerCase()) || g.definition.toLowerCase().includes(glossarySearch.toLowerCase()))
    : glossary;

  const startModule = (moduleId: string) => {
    setActiveModule(moduleId);
    setCurrentStep(0);
    setPhase("steps");
    setQuizScore(0);
  };

  const handleQuizComplete = (score: number) => {
    setQuizScore(score);
    setPhase("results");
    if (activeModule) {
      setCompletedModules(prev => new Set(prev).add(activeModule));
    }
  };

  const backToModules = () => {
    setActiveModule(null);
    setPhase("steps");
    setCurrentStep(0);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-6xl flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Insurance Learning Navigator
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Interactive, step-by-step guides to help you understand your health insurance and navigate the system with confidence.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-[160px]" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>{lang.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription data-testid="text-disclaimer">
          This is educational content only and does not constitute insurance, legal, or financial advice.
          Please consult your insurance company or a benefits counselor for specific coverage questions.
        </AlertDescription>
      </Alert>

      {!activeModule ? (
        <Tabs defaultValue="modules" className="space-y-6">
          <TabsList data-testid="tabs-learning">
            <TabsTrigger value="modules" data-testid="tab-modules">
              <BookOpen className="h-4 w-4 mr-2" />
              Learning Modules
            </TabsTrigger>
            <TabsTrigger value="glossary" data-testid="tab-glossary">
              <Search className="h-4 w-4 mr-2" />
              Insurance Glossary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  onStart={() => startModule(mod.id)}
                  completed={completedModules.has(mod.id)}
                />
              ))}
            </div>
            {completedModules.size > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                <CardContent className="pt-6 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-200">Progress</p>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        {completedModules.size} of {modules.length} modules completed
                      </p>
                    </div>
                  </div>
                  <Progress value={(completedModules.size / modules.length) * 100} className="w-40" />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="glossary" className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                placeholder="Search insurance terms..."
                className="pl-10"
                data-testid="input-glossary-search"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {filteredGlossary.map((item) => (
                <Card key={item.term} data-testid={`card-glossary-${item.term.toLowerCase().replace(/\s+/g, "-")}`}>
                  <CardContent className="pt-4">
                    <p className="font-semibold text-primary mb-1">{item.term}</p>
                    <p className="text-sm text-muted-foreground">{item.definition}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      ) : activeModuleData ? (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={backToModules} data-testid="button-back-modules">
              <ChevronLeft className="h-4 w-4 mr-1" />
              All Modules
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-sm text-muted-foreground">{activeModuleData.title}</span>
          </div>

          <Card>
            <CardContent className="pt-6">
              {phase === "steps" && (
                <StepViewer
                  step={activeModuleData.steps[currentStep]}
                  stepIndex={currentStep}
                  totalSteps={activeModuleData.steps.length}
                  language={selectedLanguage}
                  onNext={() => {
                    if (currentStep < activeModuleData.steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else {
                      setPhase("quiz");
                    }
                  }}
                  onPrev={() => {
                    if (currentStep > 0) setCurrentStep(currentStep - 1);
                  }}
                />
              )}

              {phase === "quiz" && (
                <QuizView questions={activeModuleData.quiz} onComplete={handleQuizComplete} />
              )}

              {phase === "results" && (
                <div className="text-center space-y-6 py-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <GraduationCap className="h-16 w-16 text-primary animate-in zoom-in duration-500" />
                      {quizScore === activeModuleData.quiz.length && (
                        <CheckCircle className="h-6 w-6 text-green-500 absolute -top-1 -right-1 animate-in zoom-in duration-700" />
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold mb-2" data-testid="text-results-title">Module Complete!</h3>
                    <p className="text-muted-foreground">
                      You scored <strong className="text-primary">{quizScore}</strong> out of{" "}
                      <strong>{activeModuleData.quiz.length}</strong> on the quiz.
                    </p>
                  </div>
                  {quizScore === activeModuleData.quiz.length ? (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-base px-4 py-1">
                      Perfect Score!
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Review the module again to improve your understanding.
                    </p>
                  )}
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={() => { setPhase("steps"); setCurrentStep(0); }} data-testid="button-review">
                      Review Module
                    </Button>
                    <Button onClick={backToModules} data-testid="button-continue">
                      Continue Learning
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {phase === "steps" && (
            <AIExplainPanel topic={activeModuleData.title} language={selectedLanguage} />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
