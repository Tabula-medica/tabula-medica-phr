import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { useRegion } from "@/components/region-provider";
import { useLanguage } from "@/components/language-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Heart,
  Apple,
  Brain,
  Stethoscope,
  TestTube,
  Globe,
  Users,
  Shield,
  Send,
  Sparkles,
  BookOpen,
  ArrowLeft,
  Loader2,
  Search,
  AlertCircle,
  Lightbulb,
  ChevronRight,
} from "lucide-react";

interface AdvisorTopic {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompts: string[];
}

interface AdvisorResponse {
  answer: string;
  topic: string;
  sources: string;
  disclaimer: string;
  fallback?: boolean;
}

const ICON_MAP: Record<string, React.ElementType> = {
  heart: Heart,
  apple: Apple,
  brain: Brain,
  stethoscope: Stethoscope,
  "test-tube": TestTube,
  globe: Globe,
  users: Users,
  shield: Shield,
};

const COLOR_MAP: Record<string, string> = {
  wellness: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  nutrition: "bg-green-500/15 text-green-600 dark:text-green-400",
  "mental-health": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "chronic-conditions": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "lab-results": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  "travel-health": "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  "family-health": "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  "first-aid": "bg-red-500/15 text-red-600 dark:text-red-400",
};

function TopicCard({
  topic,
  onSelect,
}: {
  topic: AdvisorTopic;
  onSelect: (topic: AdvisorTopic) => void;
}) {
  const IconComponent = ICON_MAP[topic.icon] || Lightbulb;
  const colorClass = COLOR_MAP[topic.id] || "bg-primary/15 text-primary";

  return (
    <Card
      className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
      onClick={() => onSelect(topic)}
      data-testid={`card-topic-${topic.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-xl ${colorClass} shrink-0 transition-transform group-hover:scale-110`}>
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm">{topic.title}</h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{topic.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnswerDisplay({ response, isLoading }: { response: AdvisorResponse | null; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">Analyzing with evidence-based sources...</span>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!response) return null;

  return (
    <Card className="border-primary/20" data-testid="card-advisor-response">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm">AI Evidence-Based Response</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {response.fallback && (
              <Badge variant="outline" className="text-[10px]">
                Offline Response
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              <BookOpen className="h-3 w-3 mr-1" />
              Evidence-Based
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="text-advisor-answer">
          {response.answer.split("\n").map((line, i) => {
            if (line.startsWith("**") && line.endsWith("**")) {
              return <h4 key={i} className="font-semibold text-sm mt-3 mb-1">{line.replace(/\*\*/g, "")}</h4>;
            }
            if (line.startsWith("• ") || line.startsWith("- ")) {
              return <p key={i} className="text-sm text-muted-foreground ml-4 my-0.5">{line}</p>;
            }
            if (line.startsWith("---")) {
              return <Separator key={i} className="my-3" />;
            }
            if (line.startsWith("*") && line.endsWith("*")) {
              return <p key={i} className="text-xs text-muted-foreground italic mt-2">{line.replace(/\*/g, "")}</p>;
            }
            if (line.trim() === "") return <br key={i} />;
            return <p key={i} className="text-sm leading-relaxed my-1">{line}</p>;
          })}
        </div>
        <Separator className="my-4" />
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Educational Content Only</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {response.disclaimer} Sources: {response.sources}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AIEvidenceAdvisor() {
  useSEO({
    title: "AI Health Advisor - Evidence-Based Guidance",
    description: "Get evidence-based health information powered by AI and international medical guidelines",
  });

  const { isUS } = useRegion();
  const { currentLanguage } = useLanguage();
  const [selectedTopic, setSelectedTopic] = useState<AdvisorTopic | null>(null);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AdvisorResponse | null>(null);
  const [termToExplain, setTermToExplain] = useState("");

  const { data: topics, isLoading: topicsLoading } = useQuery<AdvisorTopic[]>({
    queryKey: ["/api/ai-evidence-advisor/topics"],
  });

  const askMutation = useMutation({
    mutationFn: async ({ question, topicId }: { question: string; topicId?: string }) => {
      const res = await apiRequest("POST", "/api/ai-evidence-advisor/ask", {
        question,
        topicId,
        language: currentLanguage,
      });
      return res.json();
    },
    onSuccess: (data: AdvisorResponse) => {
      setResponse(data);
    },
  });

  const explainMutation = useMutation({
    mutationFn: async (term: string) => {
      const res = await apiRequest("POST", "/api/ai-evidence-advisor/explain-term", {
        term,
        language: currentLanguage,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setResponse({
        answer: `**${data.term}**\n\n${data.explanation}`,
        topic: "terminology",
        sources: "Medical terminology databases and clinical references",
        disclaimer: data.disclaimer,
        fallback: data.fallback,
      });
    },
  });

  const handleAsk = (q: string, topicId?: string) => {
    setResponse(null);
    askMutation.mutate({ question: q, topicId });
  };

  const handleExplainTerm = () => {
    if (!termToExplain.trim()) return;
    setResponse(null);
    explainMutation.mutate(termToExplain.trim());
    setTermToExplain("");
  };

  const handleTopicSelect = (topic: AdvisorTopic) => {
    setSelectedTopic(topic);
    setResponse(null);
    setQuestion("");
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setResponse(null);
    setQuestion("");
  };

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {selectedTopic && (
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
                <Sparkles className="h-6 w-6 text-primary" />
                AI Health Advisor
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              Evidence-based health information powered by international medical guidelines
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs" data-testid="badge-evidence-based">
              <BookOpen className="h-3 w-3 mr-1" />
              WHO & Evidence-Based
            </Badge>
            {!isUS && (
              <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs border-emerald-500/20" data-testid="badge-global-edition">
                <Globe className="h-3 w-3 mr-1" />
                Global Edition
              </Badge>
            )}
          </div>
        </div>

        {!isUS && (
          <Card className="border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-teal-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/15 shrink-0">
                  <Globe className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-emerald-700 dark:text-emerald-300">Enhanced for International Users</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    This AI advisor provides WHO-aligned, globally relevant health guidance in your preferred language.
                    Ask about wellness, nutrition, mental health, understanding lab results, travel health, and more.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Look Up a Medical Term</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., HbA1c, cholesterol, hypertension, BMI..."
                value={termToExplain}
                onChange={(e) => setTermToExplain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleExplainTerm()}
                data-testid="input-explain-term"
              />
              <Button
                onClick={handleExplainTerm}
                disabled={!termToExplain.trim() || explainMutation.isPending}
                data-testid="button-explain-term"
              >
                {explainMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {!selectedTopic ? (
          <>
            <div>
              <h2 className="text-lg font-semibold mb-3" data-testid="text-topics-heading">Health Topics</h2>
              {topicsLoading ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {Array(8).fill(0).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Skeleton className="h-10 w-10 rounded-xl" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-full" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {topics?.map((topic) => (
                    <TopicCard key={topic.id} topic={topic} onSelect={handleTopicSelect} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = ICON_MAP[selectedTopic.icon] || Lightbulb;
                    const colorClass = COLOR_MAP[selectedTopic.id] || "bg-primary/15 text-primary";
                    return (
                      <div className={`p-2.5 rounded-xl ${colorClass}`}>
                        <IconComponent className="h-5 w-5" />
                      </div>
                    );
                  })()}
                  <div>
                    <CardTitle className="text-base" data-testid="text-selected-topic">{selectedTopic.title}</CardTitle>
                    <CardDescription className="text-xs">{selectedTopic.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested Questions</p>
                  <div className="space-y-2">
                    {selectedTopic.prompts.map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        className="w-full justify-start text-left h-auto py-2.5 px-3 text-sm font-normal hover:bg-primary/5 hover:border-primary/30"
                        onClick={() => handleAsk(prompt, selectedTopic.id)}
                        disabled={askMutation.isPending}
                        data-testid={`button-prompt-${prompt.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <ChevronRight className="h-3.5 w-3.5 mr-2 shrink-0 text-primary" />
                        <span className="line-clamp-2">{prompt}</span>
                      </Button>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask your own question about this topic..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && question.trim() && handleAsk(question, selectedTopic.id)}
                      data-testid="input-custom-question"
                    />
                    <Button
                      onClick={() => handleAsk(question, selectedTopic.id)}
                      disabled={!question.trim() || askMutation.isPending}
                      data-testid="button-ask"
                    >
                      {askMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <AnswerDisplay response={response} isLoading={askMutation.isPending || explainMutation.isPending} />
          </div>
        )}

        {!selectedTopic && response && (
          <AnswerDisplay response={response} isLoading={explainMutation.isPending} />
        )}
      </div>
    </div>
  );
}
