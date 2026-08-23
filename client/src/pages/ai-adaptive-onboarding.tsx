import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Heart,
  ClipboardList,
  FileText,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Brain,
  Shield,
  Sparkles,
  Activity,
  Info,
} from "lucide-react";

type WizardStep = "welcome" | "questionnaire" | "summary" | "education" | "complete";

interface Question {
  id: string;
  category: string;
  question: string;
  type: "text" | "single_choice" | "multiple_choice" | "scale" | "boolean";
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  isRequired: boolean;
  order: number;
}

interface QuestionSet {
  questions: Question[];
  context: string;
  round: number;
  isComplete: boolean;
  disclaimer: string;
}

interface HealthSummary {
  overview: string;
  identifiedConditions: { name: string; notes: string }[];
  riskFactors: { factor: string; level: "low" | "moderate" | "elevated" }[];
  lifestyleObservations: string[];
  dataCompleteness: number;
  disclaimer: string;
  generatedAt: string;
}

interface EducationModule {
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  relevance: string;
  learnMoreTopics: string[];
}

interface EducationContent {
  modules: EducationModule[];
  disclaimer: string;
  generatedAt: string;
}

interface SessionData {
  id: string;
  currentStep: WizardStep;
  round: number;
  questionnaireComplete: boolean;
}

const STEP_CONFIG: { key: WizardStep; label: string; icon: typeof Heart }[] = [
  { key: "welcome", label: "Welcome", icon: Heart },
  { key: "questionnaire", label: "Health Profile", icon: ClipboardList },
  { key: "summary", label: "Summary", icon: FileText },
  { key: "education", label: "Learn", icon: BookOpen },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = STEP_CONFIG.findIndex((s) => s.key === currentStep);
  const progress = ((currentIndex + 1) / STEP_CONFIG.length) * 100;

  return (
    <div className="space-y-3" data-testid="step-indicator">
      <Progress value={progress} className="h-2" data-testid="progress-bar" />
      <div className="flex justify-between gap-1">
        {STEP_CONFIG.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentIndex;
          const isDone = i < currentIndex;
          return (
            <div
              key={step.key}
              className={`flex flex-col items-center gap-1 text-xs transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : isDone
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
              }`}
              data-testid={`step-${step.key}`}
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10"
                    : isDone
                      ? "border-primary/50 bg-primary/5"
                      : "border-muted"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span className="hidden sm:block">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionRenderer({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | string[] | number | boolean | undefined;
  onChange: (val: string | string[] | number | boolean) => void;
}) {
  if (question.type === "text") {
    return (
      <div className="space-y-2">
        <Label htmlFor={question.id}>{question.question}</Label>
        <Textarea
          id={question.id}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="resize-none"
          data-testid={`input-question-${question.id}`}
        />
      </div>
    );
  }

  if (question.type === "single_choice" && question.options) {
    return (
      <div className="space-y-2">
        <FieldCaption>{question.question}</FieldCaption>
        <RadioGroup
          value={(value as string) || ""}
          onValueChange={(v) => onChange(v)}
          data-testid={`radio-question-${question.id}`}
        >
          {question.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <RadioGroupItem value={opt} id={`${question.id}-${opt}`} data-testid={`radio-option-${question.id}-${opt}`} />
              <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
    );
  }

  if (question.type === "multiple_choice" && question.options) {
    const selected = (value as string[]) || [];
    return (
      <div className="space-y-2">
        <Label>{question.question}</Label>
        <div className="space-y-2">
          {question.options.map((opt) => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`${question.id}-${opt}`}
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selected, opt]);
                  } else {
                    onChange(selected.filter((s) => s !== opt));
                  }
                }}
                data-testid={`checkbox-option-${question.id}-${opt}`}
              />
              <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "scale") {
    const min = question.scaleMin || 1;
    const max = question.scaleMax || 10;
    const current = typeof value === "number" ? value : Math.floor((min + max) / 2);
    return (
      <div className="space-y-3">
        <Label>{question.question}</Label>
        <div className="px-2">
          <Slider
            min={min}
            max={max}
            step={1}
            value={[current]}
            onValueChange={(v) => onChange(v[0])}
            data-testid={`slider-question-${question.id}`}
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{question.scaleLabels?.min || min}</span>
            <span className="font-medium text-foreground">{current}</span>
            <span>{question.scaleLabels?.max || max}</span>
          </div>
        </div>
      </div>
    );
  }

  if (question.type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <Checkbox
          id={question.id}
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
          data-testid={`boolean-question-${question.id}`}
        />
        <Label htmlFor={question.id} className="font-normal cursor-pointer">
          {question.question}
        </Label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={question.id}>{question.question}</Label>
      <Input
        id={question.id}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`input-question-${question.id}`}
      />
    </div>
  );
}

export default function AIAdaptiveOnboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<WizardStep>("welcome");
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number | boolean>>({});
  const [round, setRound] = useState(0);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [educationContent, setEducationContent] = useState<EducationContent | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-adaptive-onboarding/sessions", {
        userId: "current-user",
      });
      return res.json();
    },
    onSuccess: (data) => {
      setSession(data.session);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const startQuestionnaireMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/ai-adaptive-onboarding/sessions/${sessionId}/start-questionnaire`
      );
      return res.json();
    },
    onSuccess: (data) => {
      setCurrentQuestions(data.questionSet.questions);
      setRound(data.questionSet.round);
      setStep("questionnaire");
      setAnswers({});
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const submitAnswersMutation = useMutation({
    mutationFn: async ({ sessionId, responses }: { sessionId: string; responses: { questionId: string; answer: string | string[] | number | boolean }[] }) => {
      const res = await apiRequest(
        "POST",
        `/api/ai-adaptive-onboarding/sessions/${sessionId}/submit-answers`,
        { responses }
      );
      return res.json();
    },
    onSuccess: (data) => {
      if (data.questionnaireComplete) {
        setStep("summary");
        generateSummaryMutation.mutate(session!.id);
      } else if (data.questionSet) {
        setCurrentQuestions(data.questionSet.questions);
        setRound(data.questionSet.round);
        setAnswers({});
      }
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/ai-adaptive-onboarding/sessions/${sessionId}/generate-summary`
      );
      return res.json();
    },
    onSuccess: (data) => {
      setHealthSummary(data.summary);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const generateEducationMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/ai-adaptive-onboarding/sessions/${sessionId}/generate-education`
      );
      return res.json();
    },
    onSuccess: (data) => {
      setEducationContent(data.education);
      setStep("education");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/ai-adaptive-onboarding/sessions/${sessionId}/complete`
      );
      return res.json();
    },
    onSuccess: () => {
      setStep("complete");
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const handleStartOnboarding = useCallback(async () => {
    const result = await createSessionMutation.mutateAsync();
    startQuestionnaireMutation.mutate(result.session.id);
  }, []);

  const handleSubmitAnswers = useCallback(() => {
    if (!session) return;
    const responses = currentQuestions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] ?? (q.type === "boolean" ? false : q.type === "multiple_choice" ? [] : ""),
    }));
    submitAnswersMutation.mutate({ sessionId: session.id, responses });
  }, [session, currentQuestions, answers]);

  const handleGoToEducation = useCallback(() => {
    if (!session) return;
    generateEducationMutation.mutate(session.id);
  }, [session]);

  const handleComplete = useCallback(() => {
    if (!session) return;
    completeMutation.mutate(session.id);
  }, [session]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const isLoading =
    createSessionMutation.isPending ||
    startQuestionnaireMutation.isPending ||
    submitAnswersMutation.isPending ||
    generateSummaryMutation.isPending ||
    generateEducationMutation.isPending ||
    completeMutation.isPending;

  const requiredAnswered = currentQuestions
    .filter((q) => q.isRequired)
    .every((q) => {
      const val = answers[q.id];
      if (val === undefined || val === null) return false;
      if (typeof val === "string" && val.trim() === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "condition": return Activity;
      case "lifestyle": return Heart;
      case "prevention": return Shield;
      case "medication": return FileText;
      default: return BookOpen;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "elevated": return "text-orange-600 dark:text-orange-400";
      case "moderate": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-green-600 dark:text-green-400";
    }
  };

  return (
    <div className="min-h-full p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <StepIndicator currentStep={step} />

      {error && (
        <Alert variant="destructive" data-testid="alert-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {step === "welcome" && (
        <Card data-testid="card-welcome">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Heart className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-welcome-title">
              Welcome to Tabula Medica
            </CardTitle>
            <CardDescription className="text-base max-w-md mx-auto" data-testid="text-welcome-description">
              Let's build your personalized health profile. Our adaptive questionnaire
              will ask relevant follow-up questions based on your responses to create
              a comprehensive overview of your health.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col items-center gap-2 p-4 rounded-md bg-muted/50 text-center">
                <Brain className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Adaptive Questions</span>
                <span className="text-xs text-muted-foreground">
                  Questions that adapt based on your answers
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-md bg-muted/50 text-center">
                <FileText className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Health Summary</span>
                <span className="text-xs text-muted-foreground">
                  AI-generated overview of your health profile
                </span>
              </div>
              <div className="flex flex-col items-center gap-2 p-4 rounded-md bg-muted/50 text-center">
                <BookOpen className="w-6 h-6 text-primary" />
                <span className="text-sm font-medium">Personalized Learning</span>
                <span className="text-xs text-muted-foreground">
                  Educational content tailored to you
                </span>
              </div>
            </div>
            <Alert data-testid="alert-disclaimer">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Your data is handled with the highest security standards. All information
                is encrypted and compliant with healthcare privacy regulations.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              onClick={handleStartOnboarding}
              disabled={isLoading}
              data-testid="button-start-onboarding"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Preparing...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === "questionnaire" && (
        <Card data-testid="card-questionnaire">
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <CardTitle data-testid="text-questionnaire-title">
                  Health Profile Questionnaire
                </CardTitle>
              </div>
              <Badge variant="secondary" data-testid="badge-round">
                Round {round} of 3
              </Badge>
            </div>
            <CardDescription data-testid="text-questionnaire-context">
              {round === 1
                ? "Let's start with some general questions about your health."
                : "Based on your answers, here are some follow-up questions to build a more complete picture."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3 py-12" data-testid="loading-questions">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {submitAnswersMutation.isPending
                    ? "Analyzing your responses and generating follow-up questions..."
                    : "Generating personalized questions..."}
                </p>
              </div>
            ) : (
              currentQuestions.map((q, i) => (
                <div
                  key={q.id}
                  className="space-y-1"
                  data-testid={`question-block-${i}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {q.category}
                    </Badge>
                    {q.isRequired && (
                      <span className="text-xs text-destructive">Required</span>
                    )}
                  </div>
                  <QuestionRenderer
                    question={q}
                    value={answers[q.id]}
                    onChange={(val) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: val }))
                    }
                  />
                </div>
              ))
            )}
          </CardContent>
          {!isLoading && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                onClick={handleSubmitAnswers}
                disabled={!requiredAnswered || isLoading}
                data-testid="button-submit-answers"
              >
                {round >= 3 ? (
                  <>
                    Complete Questionnaire
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {step === "summary" && (
        <Card data-testid="card-summary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle data-testid="text-summary-title">Your Health Profile Summary</CardTitle>
            </div>
            <CardDescription>
              An AI-generated overview based on your questionnaire responses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {generateSummaryMutation.isPending || !healthSummary ? (
              <div className="flex flex-col items-center gap-3 py-12" data-testid="loading-summary">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating your personalized health summary...
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-2" data-testid="summary-overview">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Overview
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {healthSummary.overview}
                  </p>
                </div>

                {healthSummary.identifiedConditions.length > 0 && (
                  <div className="space-y-2" data-testid="summary-conditions">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Reported Conditions
                    </h3>
                    <div className="grid gap-2">
                      {healthSummary.identifiedConditions.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 p-3 rounded-md bg-muted/50">
                          <Badge variant="outline" className="mt-0.5 shrink-0">{c.name}</Badge>
                          <span className="text-sm text-muted-foreground">{c.notes}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {healthSummary.riskFactors.length > 0 && (
                  <div className="space-y-2" data-testid="summary-risks">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-primary" />
                      Observed Risk Factors
                    </h3>
                    <div className="grid gap-2">
                      {healthSummary.riskFactors.map((r, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50">
                          <span className="text-sm">{r.factor}</span>
                          <Badge variant="outline" className={getRiskColor(r.level)}>
                            {r.level}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {healthSummary.lifestyleObservations.length > 0 && (
                  <div className="space-y-2" data-testid="summary-lifestyle">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <Heart className="w-4 h-4 text-primary" />
                      Lifestyle Observations
                    </h3>
                    <ul className="space-y-1">
                      {healthSummary.lifestyleObservations.map((o, i) => (
                        <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1" data-testid="summary-completeness">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Data Completeness</span>
                    <span>{Math.round(healthSummary.dataCompleteness * 100)}%</span>
                  </div>
                  <Progress value={healthSummary.dataCompleteness * 100} className="h-1.5" />
                </div>

                <Alert data-testid="alert-summary-disclaimer">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {healthSummary.disclaimer}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
          {healthSummary && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                onClick={handleGoToEducation}
                disabled={isLoading}
                data-testid="button-go-to-education"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Preparing Content...
                  </>
                ) : (
                  <>
                    View Personalized Content
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {step === "education" && (
        <Card data-testid="card-education">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <CardTitle data-testid="text-education-title">Your Personalized Health Library</CardTitle>
            </div>
            <CardDescription>
              Educational content selected for you based on your health profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generateEducationMutation.isPending || !educationContent ? (
              <div className="flex flex-col items-center gap-3 py-12" data-testid="loading-education">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Curating personalized educational content...
                </p>
              </div>
            ) : (
              <>
                {educationContent.modules.map((mod) => {
                  const Icon = getCategoryIcon(mod.category);
                  const isExpanded = expandedModules.has(mod.id);
                  return (
                    <Card
                      key={mod.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => toggleModule(mod.id)}
                      data-testid={`card-education-module-${mod.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3">
                            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 shrink-0">
                              <Icon className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{mod.title}</CardTitle>
                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {mod.category}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <ArrowRight
                            className={`w-4 h-4 text-muted-foreground transition-transform shrink-0 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </div>
                      </CardHeader>
                      {isExpanded && (
                        <CardContent className="pt-0 space-y-3">
                          <p className="text-sm text-muted-foreground">{mod.summary}</p>
                          <div>
                            <h4 className="text-xs font-medium mb-1">Key Points</h4>
                            <ul className="space-y-1">
                              {mod.keyPoints.map((pt, i) => (
                                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Relevance:</span> {mod.relevance}
                            </p>
                          </div>
                          {mod.learnMoreTopics.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {mod.learnMoreTopics.map((topic, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
                <Alert data-testid="alert-education-disclaimer">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {educationContent.disclaimer}
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
          {educationContent && (
            <CardFooter className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("summary")}
                data-testid="button-back-to-summary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Summary
              </Button>
              <Button
                onClick={handleComplete}
                disabled={isLoading}
                data-testid="button-complete-onboarding"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Completing...
                  </>
                ) : (
                  <>
                    Complete Onboarding
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {step === "complete" && (
        <Card data-testid="card-complete">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl" data-testid="text-complete-title">
              Welcome Aboard!
            </CardTitle>
            <CardDescription className="text-base max-w-md mx-auto" data-testid="text-complete-description">
              Your health profile has been created and personalized educational content
              is ready for you. You can access your health summary and learning materials
              anytime from your dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-start gap-3 p-4 rounded-md bg-muted/50">
                <FileText className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Health Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Your personalized health overview is available in your records.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-md bg-muted/50">
                <BookOpen className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Education Content</p>
                  <p className="text-xs text-muted-foreground">
                    {educationContent?.modules.length || 0} personalized modules are ready for you.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button
              onClick={() => navigate("/")}
              data-testid="button-go-to-dashboard"
            >
              Go to Dashboard
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
