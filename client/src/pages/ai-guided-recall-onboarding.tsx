import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bot, 
  CheckCircle2, 
  ChevronRight, 
  Hospital, 
  Stethoscope, 
  FlaskConical, 
  Pill,
  Shield,
  Building2,
  Loader2,
  Sparkles,
  Link2,
  ArrowRight,
  MapPin,
  FileText,
  Heart,
  Activity,
} from "lucide-react";

interface OnboardingQuestion {
  id: string;
  questionText: string;
  questionType: "yes_no" | "text" | "select" | "multi_select" | "location";
  options?: string[];
  helpText?: string;
  category: string;
  required: boolean;
}

interface OnboardingSession {
  sessionId: string;
  patientId: string;
  status: "in_progress" | "completed" | "abandoned";
  currentStep: number;
  totalSteps: number;
  responses: Array<{ questionId: string; response: any; timestamp: string }>;
  recommendedPortals: RecommendedPortal[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface RecommendedPortal {
  portalId: string;
  portalName: string;
  portalType: "hospital" | "clinic" | "lab" | "imaging" | "pharmacy" | "insurance";
  ehrSystem: string;
  matchConfidence: number;
  matchReason: string;
  connectionUrl: string;
  estimatedRecords: string;
  supported: boolean;
}

const categoryIcons: Record<string, typeof Hospital> = {
  hospitalization: Hospital,
  primary_care: Stethoscope,
  specialists: Heart,
  imaging: Activity,
  labs: FlaskConical,
  pharmacy: Pill,
  insurance: Shield,
};

const portalTypeIcons: Record<string, typeof Hospital> = {
  hospital: Hospital,
  clinic: Stethoscope,
  lab: FlaskConical,
  imaging: Activity,
  pharmacy: Pill,
  insurance: Shield,
};

export default function AIGuidedRecallOnboarding() {
  const { toast } = useToast();
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<OnboardingQuestion | null>(null);
  const [response, setResponse] = useState<string | string[] | boolean>("");
  const [aiFollowUp, setAiFollowUp] = useState<string>("");
  const [recommendations, setRecommendations] = useState<{ portals: RecommendedPortal[]; summary: string } | null>(null);

  const { data: questionsData } = useQuery<{ questions: OnboardingQuestion[] }>({
    queryKey: ["/api/guided-recall/questions"],
  });

  const startSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/guided-recall/sessions", {});
      return res.json();
    },
    onSuccess: (data) => {
      setSession(data.session);
      if (questionsData?.questions && questionsData.questions.length > 0) {
        setCurrentQuestion(questionsData.questions[0]);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start onboarding session", variant: "destructive" });
    },
  });

  const submitResponseMutation = useMutation({
    mutationFn: async ({ questionId, response }: { questionId: string; response: any }) => {
      const res = await apiRequest("POST", `/api/guided-recall/sessions/${session?.sessionId}/responses`, {
        questionId,
        response,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.aiFollowUp) {
        setAiFollowUp(data.aiFollowUp);
      }
      
      if (data.isComplete) {
        fetchRecommendations();
      } else if (data.nextQuestion) {
        setTimeout(() => {
          setCurrentQuestion(data.nextQuestion);
          setResponse("");
          setAiFollowUp("");
        }, data.aiFollowUp ? 2000 : 500);
      }

      if (session) {
        setSession({ ...session, currentStep: session.currentStep + 1 });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit response", variant: "destructive" });
    },
  });

  const fetchRecommendations = async () => {
    if (!session) return;
    try {
      const res = await fetch(`/api/guided-recall/sessions/${session.sessionId}/recommendations`);
      const data = await res.json();
      setRecommendations(data);
      setSession({ ...session, status: "completed" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch recommendations", variant: "destructive" });
    }
  };

  const handleSubmit = () => {
    if (!currentQuestion || response === "") return;
    submitResponseMutation.mutate({ questionId: currentQuestion.id, response });
  };

  const progress = session ? (session.currentStep / (questionsData?.questions?.length || 10)) * 100 : 0;

  if (!session) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Bot className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl">AI-Guided Health Record Discovery</CardTitle>
            <CardDescription className="text-base mt-2">
              Let me help you find and connect all your health records. I'll ask a few questions about your healthcare history to identify the patient portals where your records may be stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Hospital className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Hospitals</p>
                  <p className="text-xs text-muted-foreground">Find records from hospital stays</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Stethoscope className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Doctors</p>
                  <p className="text-xs text-muted-foreground">Connect to your providers</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <FlaskConical className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Labs</p>
                  <p className="text-xs text-muted-foreground">Import lab results</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Privacy Note:</strong> Your responses are used only to identify relevant patient portals. We never share your information with third parties without your explicit consent.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={() => startSessionMutation.mutate()} 
              className="w-full"
              disabled={startSessionMutation.isPending}
              data-testid="btn-start-onboarding"
            >
              {startSessionMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting...</>
              ) : (
                <>Start Guided Discovery <ChevronRight className="h-4 w-4 ml-2" /></>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (session.status === "completed" && recommendations) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 p-4 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Health Record Discovery Complete</CardTitle>
            <CardDescription className="text-base mt-2">
              {recommendations.summary}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center mb-4">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {recommendations.portals.length} potential record sources found
              </Badge>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {recommendations.portals.map((portal) => {
                  const Icon = portalTypeIcons[portal.portalType] || Building2;
                  return (
                    <Card key={portal.portalId} className="hover-elevate">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-medium">{portal.portalName}</h4>
                              <Badge 
                                variant={portal.matchConfidence > 0.8 ? "default" : "secondary"}
                                className="shrink-0"
                              >
                                {Math.round(portal.matchConfidence * 100)}% match
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{portal.matchReason}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {portal.estimatedRecords}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {portal.ehrSystem}
                              </span>
                            </div>
                          </div>
                          <Button size="sm" data-testid={`btn-connect-${portal.portalId}`}>
                            <Link2 className="h-4 w-4 mr-1" />
                            Connect
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="flex-1" onClick={() => window.location.href = "/connections"}>
                Manage Connections
              </Button>
              <Button className="flex-1" onClick={() => window.location.href = "/dashboard"}>
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Loading questions...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const CategoryIcon = categoryIcons[currentQuestion.category] || Hospital;

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4">
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CategoryIcon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium capitalize">{currentQuestion.category.replace("_", " ")}</span>
            </div>
            <span className="text-sm text-muted-foreground">
              Question {session.currentStep + 1} of {questionsData?.questions?.length || 10}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="space-y-6">
          {aiFollowUp && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm">{aiFollowUp}</p>
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{currentQuestion.questionText}</h2>
            {currentQuestion.helpText && (
              <p className="text-sm text-muted-foreground">{currentQuestion.helpText}</p>
            )}
          </div>

          <div className="space-y-4">
            {currentQuestion.questionType === "yes_no" && (
              <RadioGroup
                value={response === true ? "yes" : response === false ? "no" : ""}
                onValueChange={(v) => setResponse(v === "yes")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yes" id="yes" data-testid="radio-yes" />
                  <Label htmlFor="yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="no" data-testid="radio-no" />
                  <Label htmlFor="no">No</Label>
                </div>
              </RadioGroup>
            )}

            {currentQuestion.questionType === "text" && (
              <Input
                value={response as string}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Type your answer..."
                data-testid="input-text-response"
              />
            )}

            {currentQuestion.questionType === "select" && currentQuestion.options && (
              <RadioGroup
                value={response as string}
                onValueChange={(v) => setResponse(v)}
                className="space-y-2"
              >
                {currentQuestion.options.map((option, idx) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`option-${idx}`} data-testid={`radio-option-${idx}`} />
                    <Label htmlFor={`option-${idx}`}>{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.questionType === "multi_select" && currentQuestion.options && (
              <div className="space-y-2">
                {currentQuestion.options.map((option, idx) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`check-${idx}`}
                      checked={(response as string[] || []).includes(option)}
                      onCheckedChange={(checked) => {
                        const current = (response as string[]) || [];
                        if (checked) {
                          setResponse([...current, option]);
                        } else {
                          setResponse(current.filter(o => o !== option));
                        }
                      }}
                      data-testid={`checkbox-option-${idx}`}
                    />
                    <Label htmlFor={`check-${idx}`}>{option}</Label>
                  </div>
                ))}
              </div>
            )}

            {currentQuestion.questionType === "location" && (
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={response as string}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="Enter ZIP code"
                  maxLength={5}
                  className="max-w-[150px]"
                  data-testid="input-zipcode"
                />
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="ghost" disabled>
            Skip
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={
              submitResponseMutation.isPending || 
              response === "" || 
              (Array.isArray(response) && response.length === 0)
            }
            data-testid="btn-submit-response"
          >
            {submitResponseMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
            ) : (
              <>Continue <ChevronRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </CardFooter>
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-4">
        This is for informational purposes only, not medical advice. Your privacy is protected.
      </p>
    </div>
  );
}
