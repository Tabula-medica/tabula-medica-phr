import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  ArrowRight,
  CalendarDays
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface PromQuestion {
  id: string;
  text: string;
  type: "scale" | "multiple_choice" | "yes_no" | "text" | "numeric";
  required: boolean;
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  options?: Array<{ value: number | string; label: string; score: number }>;
}

interface PromQuestionnaire {
  id: string;
  name: string;
  description: string;
  category: string;
  questions: PromQuestion[];
  estimatedMinutes?: number;
}

interface PromAssignment {
  id: string;
  questionnaireId: string;
  frequency: string;
  nextDueDate: string;
  isActive: boolean;
  questionnaire?: PromQuestionnaire;
}

interface PromResponse {
  id: string;
  questionnaireId: string;
  questionnaireName: string;
  percentageScore: number;
  severity: string;
  interpretation: string;
  completedAt: string;
}

interface PromTrend {
  patientId: string;
  questionnaireId: string;
  questionnaireName: string;
  category: string;
  dataPoints: Array<{ date: string; score: number; severity: string }>;
  averageScore: number;
  trend: "improving" | "stable" | "worsening";
  trendPercentage: number;
}

export default function AssessmentsPage() {
  const { toast } = useToast();
  const [activeAssessment, setActiveAssessment] = useState<PromAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [assessmentStartTime, setAssessmentStartTime] = useState<Date | null>(null);

  const { data: dueAssessments = [], isLoading: loadingDue } = useQuery<PromAssignment[]>({
    queryKey: ["/api/prom/due"],
  });

  const { data: allAssignments = [], isLoading: loadingAssignments } = useQuery<PromAssignment[]>({
    queryKey: ["/api/prom/assignments"],
  });

  const { data: responses = [] } = useQuery<PromResponse[]>({
    queryKey: ["/api/prom/responses"],
  });

  const { data: trends = [] } = useQuery<PromTrend[]>({
    queryKey: ["/api/prom/trends"],
  });

  const submitResponseMutation = useMutation({
    mutationFn: async (data: { assignmentId: string; answers: any[]; startTime: string }) => {
      const response = await apiRequest("POST", "/api/prom/responses", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Assessment Submitted",
        description: "Thank you for completing your assessment. Your provider will review the results.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/prom/due"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prom/responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prom/trends"] });
      setActiveAssessment(null);
      setAnswers({});
      setCurrentQuestionIndex(0);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit assessment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const startAssessment = (assignment: PromAssignment) => {
    setActiveAssessment(assignment);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setAssessmentStartTime(new Date());
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const submitAssessment = () => {
    if (!activeAssessment) return;
    
    const questionnaire = activeAssessment.questionnaire;
    if (!questionnaire) return;

    const formattedAnswers = Object.entries(answers).map(([questionId, value]) => ({
      questionId,
      value,
    }));

    submitResponseMutation.mutate({
      assignmentId: activeAssessment.id,
      answers: formattedAnswers,
      startTime: assessmentStartTime?.toISOString() || new Date().toISOString(),
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "normal": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "mild": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "moderate": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400";
      case "severe": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving": return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "worsening": return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderQuestion = (question: PromQuestion) => {
    const currentValue = answers[question.id];

    switch (question.type) {
      case "scale":
        return (
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.minLabel || question.minValue}</span>
              <span>{question.maxLabel || question.maxValue}</span>
            </div>
            <Slider
              min={question.minValue || 0}
              max={question.maxValue || 10}
              step={1}
              value={[currentValue ?? (question.minValue || 0)]}
              onValueChange={(value) => handleAnswerChange(question.id, value[0])}
              className="w-full"
              data-testid={`slider-${question.id}`}
            />
            <div className="text-center text-2xl font-bold">
              {currentValue ?? "—"}
            </div>
          </div>
        );

      case "multiple_choice":
        return (
          <RadioGroup
            value={currentValue?.toString()}
            onValueChange={(value) => handleAnswerChange(question.id, parseInt(value))}
            data-testid={`radio-${question.id}`}
          >
            {question.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg hover-elevate border">
                <RadioGroupItem value={option.value.toString()} id={`${question.id}-${option.value}`} />
                <Label htmlFor={`${question.id}-${option.value}`} className="flex-1 cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "yes_no":
        return (
          <RadioGroup
            value={currentValue}
            onValueChange={(value) => handleAnswerChange(question.id, value)}
            data-testid={`yesno-${question.id}`}
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg hover-elevate border">
              <RadioGroupItem value="yes" id={`${question.id}-yes`} />
              <Label htmlFor={`${question.id}-yes`} className="flex-1 cursor-pointer">Yes</Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg hover-elevate border">
              <RadioGroupItem value="no" id={`${question.id}-no`} />
              <Label htmlFor={`${question.id}-no`} className="flex-1 cursor-pointer">No</Label>
            </div>
          </RadioGroup>
        );

      case "text":
        return (
          <Textarea
            value={currentValue || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your response..."
            rows={4}
            data-testid={`textarea-${question.id}`}
          />
        );

      default:
        return null;
    }
  };

  if (activeAssessment?.questionnaire) {
    const questionnaire = activeAssessment.questionnaire;
    const questions = questionnaire.questions;
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;
    const canProceed = answers[currentQuestion?.id] !== undefined;

    return (
      <div className="container max-w-2xl py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle data-testid="text-assessment-title">{questionnaire.name}</CardTitle>
                <CardDescription>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveAssessment(null)}
                data-testid="button-cancel-assessment"
              >
                Cancel
              </Button>
            </div>
            <Progress value={progress} className="mt-4" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="min-h-[200px]">
              <h3 className="text-lg font-medium mb-4" data-testid="text-question">
                {currentQuestion?.text}
              </h3>
              {currentQuestion && renderQuestion(currentQuestion)}
            </div>

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                data-testid="button-previous"
              >
                Previous
              </Button>
              {isLastQuestion ? (
                <Button
                  onClick={submitAssessment}
                  disabled={!canProceed || submitResponseMutation.isPending}
                  data-testid="button-submit"
                >
                  {submitResponseMutation.isPending ? "Submitting..." : "Submit Assessment"}
                </Button>
              ) : (
                <Button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  disabled={!canProceed}
                  data-testid="button-next"
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container py-6 space-y-6">
        <PageHeader
          title="Health Assessments"
          subtitle="Complete your health questionnaires to help your care team track your progress"
        />

        {dueAssessments.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Assessments Due
              </CardTitle>
              <CardDescription>
                You have {dueAssessments.length} assessment{dueAssessments.length > 1 ? "s" : ""} ready to complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dueAssessments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                  data-testid={`card-due-assessment-${assignment.id}`}
                >
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{assignment.questionnaire?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {assignment.questionnaire?.questions.length} questions
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => startAssessment(assignment)}
                    data-testid={`button-start-${assignment.id}`}
                  >
                    Start
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="history">
          <TabsList>
            <TabsTrigger value="history" data-testid="tab-history">History</TabsTrigger>
            <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
            <TabsTrigger value="scheduled" data-testid="tab-scheduled">Scheduled</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            {responses.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed assessments yet</p>
                </CardContent>
              </Card>
            ) : (
              responses.map((response) => (
                <Card key={response.id} data-testid={`card-response-${response.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium">{response.questionnaireName}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(response.completedAt), "MMM d, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getSeverityColor(response.severity)}>
                          {response.severity}
                        </Badge>
                        <span className="font-medium">{response.percentageScore.toFixed(0)}%</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{response.interpretation}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            {trends.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Complete more assessments to see trends</p>
                </CardContent>
              </Card>
            ) : (
              trends.map((trend) => (
                <Card key={trend.questionnaireId} data-testid={`card-trend-${trend.questionnaireId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{trend.questionnaireName}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(trend.trend)}
                        <span className={`text-sm font-medium ${
                          trend.trend === "improving" ? "text-green-500" :
                          trend.trend === "worsening" ? "text-red-500" : "text-muted-foreground"
                        }`}>
                          {trend.trend === "stable" ? "Stable" :
                           `${Math.abs(trend.trendPercentage).toFixed(0)}% ${trend.trend}`}
                        </span>
                      </div>
                    </div>
                    <CardDescription>
                      Average score: {trend.averageScore.toFixed(1)}%
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trend.dataPoints}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) => format(new Date(date), "MMM d")}
                            className="text-xs"
                          />
                          <YAxis domain={[0, 100]} className="text-xs" />
                          <Tooltip
                            labelFormatter={(date) => format(new Date(date), "MMM d, yyyy")}
                            formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ fill: "hsl(var(--primary))" }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="scheduled" className="space-y-4">
            {allAssignments.filter(a => a.isActive).length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scheduled assessments</p>
                </CardContent>
              </Card>
            ) : (
              allAssignments.filter(a => a.isActive).map((assignment) => (
                <Card key={assignment.id} data-testid={`card-scheduled-${assignment.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ClipboardList className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{assignment.questionnaire?.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {assignment.frequency} • Next due: {format(new Date(assignment.nextDueDate), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline">{assignment.questionnaire?.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}
