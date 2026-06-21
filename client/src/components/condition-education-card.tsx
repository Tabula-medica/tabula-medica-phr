import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GraduationCap,
  BookOpen,
  Heart,
  FlaskConical,
  Lightbulb,
  ChevronRight,
} from "lucide-react";

interface ConditionEducation {
  conditionName: string;
  conditionCategory: string;
  topics: Array<{
    title: string;
    description: string;
    type: "article" | "video" | "guide";
  }>;
}

interface LabAlertEducation {
  testName: string;
  educationTopics: string[];
}

const CONDITION_EDUCATION_MAP: Record<string, Array<{ title: string; description: string; type: "article" | "video" | "guide" }>> = {
  "type 2 diabetes": [
    { title: "Understanding Blood Sugar Levels", description: "Learn what your A1C and glucose numbers mean and how to manage them day-to-day.", type: "article" },
    { title: "Healthy Eating with Diabetes", description: "Simple meal planning tips to keep your blood sugar steady.", type: "guide" },
    { title: "Exercise and Diabetes", description: "How regular activity helps control blood sugar and improves your health.", type: "video" },
  ],
  "hypertension": [
    { title: "Understanding Blood Pressure", description: "What your blood pressure numbers mean and why they matter.", type: "article" },
    { title: "DASH Diet for Heart Health", description: "A proven eating plan to lower blood pressure naturally.", type: "guide" },
    { title: "Managing Stress for Heart Health", description: "Techniques to reduce stress and its impact on blood pressure.", type: "video" },
  ],
  "hyperlipidemia": [
    { title: "Cholesterol: The Basics", description: "Understanding good vs. bad cholesterol and your lipid panel results.", type: "article" },
    { title: "Heart-Healthy Foods", description: "Foods that can help lower your cholesterol levels naturally.", type: "guide" },
  ],
  "chronic kidney disease": [
    { title: "Kidney Health 101", description: "How your kidneys work and what your lab results mean.", type: "article" },
    { title: "Diet for Kidney Health", description: "Foods to choose and avoid to protect your kidneys.", type: "guide" },
  ],
  "asthma": [
    { title: "Asthma Action Plan", description: "How to recognize symptoms and when to use your medications.", type: "guide" },
    { title: "Avoiding Asthma Triggers", description: "Common triggers and how to minimize exposure.", type: "article" },
  ],
};

function getDefaultEducation(conditionName: string): Array<{ title: string; description: string; type: "article" | "video" | "guide" }> {
  return [
    { title: `Understanding ${conditionName}`, description: `Learn the basics about ${conditionName}, including symptoms, causes, and management options.`, type: "article" },
    { title: `Living Well with ${conditionName}`, description: `Practical tips for managing ${conditionName} in your daily life.`, type: "guide" },
  ];
}

export function ConditionEducationCard({ patientId = "patient-001" }: { patientId?: string }) {
  const { data: healthData, isLoading: healthLoading } = useQuery<any>({
    queryKey: [`/api/patient-portal/${patientId}/health-records-summary`],
  });

  const { data: alertsData, isLoading: alertsLoading } = useQuery<any>({
    queryKey: [`/api/patient-portal/${patientId}/lab-alerts`],
  });

  if (healthLoading || alertsLoading) {
    return <Skeleton className="h-64" />;
  }

  const conditions: Array<{ name: string; category: string }> = healthData?.conditions || [];
  const alerts = alertsData?.alerts || [];

  const conditionEducation: ConditionEducation[] = conditions.map((cond: any) => {
    const key = cond.name.toLowerCase();
    const matched = Object.entries(CONDITION_EDUCATION_MAP).find(([k]) => key.includes(k));
    return {
      conditionName: cond.name,
      conditionCategory: cond.category,
      topics: matched ? matched[1] : getDefaultEducation(cond.name),
    };
  });

  const labAlertEducation: LabAlertEducation[] = alerts
    .filter((a: any) => a.educationTopics?.length > 0)
    .map((a: any) => ({
      testName: a.testName,
      educationTopics: a.educationTopics,
    }));

  const hasContent = conditionEducation.length > 0 || labAlertEducation.length > 0;

  return (
    <Card data-testid="card-condition-education">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Personalized for Your Health
        </CardTitle>
        <CardDescription>Education materials matched to your conditions and lab results</CardDescription>
      </CardHeader>
      <CardContent>
        {hasContent ? (
          <ScrollArea className="h-[350px]">
            <div className="space-y-4">
              {conditionEducation.map((edu, idx) => (
                <div key={idx} data-testid={`condition-edu-${idx}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-semibold">{edu.conditionName}</span>
                    <Badge variant="outline" className="text-xs">{edu.conditionCategory}</Badge>
                  </div>
                  <div className="space-y-2 ml-6">
                    {edu.topics.map((topic, i) => (
                      <div key={i} className="p-2.5 rounded-lg border hover-elevate cursor-pointer" data-testid={`edu-topic-${idx}-${i}`}>
                        <div className="flex items-start gap-2">
                          <div className="shrink-0 mt-0.5">
                            {topic.type === "video" ? (
                              <Badge variant="secondary" className="text-xs">Video</Badge>
                            ) : topic.type === "guide" ? (
                              <Badge variant="secondary" className="text-xs">Guide</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Article</Badge>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{topic.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{topic.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {labAlertEducation.length > 0 && (
                <div data-testid="lab-alert-education">
                  <div className="flex items-center gap-2 mb-2">
                    <FlaskConical className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-semibold">Based on Your Lab Results</span>
                  </div>
                  <div className="space-y-2 ml-6">
                    {labAlertEducation.map((edu, i) => (
                      <div key={i} className="p-2.5 rounded-lg border" data-testid={`lab-edu-${i}`}>
                        <p className="text-xs text-muted-foreground mb-1.5">Related to: {edu.testName}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {edu.educationTopics.map((topic, j) => (
                            <Badge key={j} variant="outline" className="text-xs hover-elevate cursor-pointer">
                              <BookOpen className="h-3 w-3 mr-1" />
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Education materials will appear here based on your conditions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
