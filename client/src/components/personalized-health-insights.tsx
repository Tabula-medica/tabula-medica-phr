import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Lightbulb,
  TrendingUp,
  Pill,
  Stethoscope,
  Calendar,
  Heart,
  Quote,
  MessageCircleQuestion,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Activity,
  Syringe,
  Eye,
  Shield,
  HelpCircle,
} from "lucide-react";
import { Link } from "wouter";
import { ExplainInsightModal } from "@/components/explain-insight-modal";

interface HealthInsight {
  id: string;
  category: "lab_trend" | "medication" | "condition" | "appointment" | "lifestyle";
  title: string;
  summary: string;
  quote: string;
  source: string;
  sourceDate: string;
  sourceLink: string;
  discussionPrompts: string[];
  priority: "high" | "medium" | "low";
}

interface PersonalizedInsightsResponse {
  insights: HealthInsight[];
  dataSourcesSummary: {
    documentsAnalyzed: number;
    labsAnalyzed: number;
    conditionsReviewed: number;
    appointmentsReviewed: number;
  };
  generatedAt: string;
  disclaimer: string;
}

interface PreventiveItem {
  id: string;
  type: "screening" | "vaccination";
  name: string;
  description: string;
  basedOn: string;
  quote: string;
  source: string;
  sourceLink: string;
  discussionPrompts: string[];
  lastCompleted?: string;
  scheduleLink?: string;
}

interface PreventiveCareResponse {
  items: PreventiveItem[];
  patientProfile: {
    ageGroup: string;
    conditions: string[];
  };
  generatedAt: string;
  disclaimer: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  lab_trend: <TrendingUp className="h-4 w-4" />,
  medication: <Pill className="h-4 w-4" />,
  condition: <Stethoscope className="h-4 w-4" />,
  appointment: <Calendar className="h-4 w-4" />,
  lifestyle: <Heart className="h-4 w-4" />,
  screening: <Eye className="h-4 w-4" />,
  vaccination: <Syringe className="h-4 w-4" />,
};

const priorityColors: Record<string, string> = {
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  low: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300",
};

function InsightCard({ insight }: { insight: HealthInsight }) {
  return (
    <AccordionItem value={insight.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-insight-${insight.id}`}>
        <div className="flex items-center gap-3 text-left w-full">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {categoryIcons[insight.category]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{insight.title}</p>
            <p className="text-xs text-muted-foreground truncate">{insight.summary}</p>
          </div>
          <Badge className={priorityColors[insight.priority]} variant="secondary">
            {insight.priority}
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* Quote */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Quote className="h-3 w-3" />
              Quote:
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm italic">"{insight.quote}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                ({insight.source}, {insight.sourceDate})
              </p>
            </div>
          </div>

          {/* Discussion prompts */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageCircleQuestion className="h-3 w-3" />
              Things your clinician might suggest discussing:
            </p>
            <ul className="space-y-1">
              {insight.discussionPrompts.map((prompt, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {prompt}
                </li>
              ))}
            </ul>
          </div>

          {/* Source link and Explain button */}
          <div className="flex gap-2 flex-wrap">
            <Link href={insight.sourceLink}>
              <Button variant="outline" size="sm" data-testid={`link-source-${insight.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Source
              </Button>
            </Link>
            <ExplainInsightModal
              insight={insight.summary}
              dataSources={[{
                source: insight.source,
                facility: insight.source,
                dateRecorded: insight.sourceDate,
                dataType: insight.category === "lab_trend" ? "Lab Result" :
                          insight.category === "medication" ? "Medication Record" :
                          insight.category === "condition" ? "Clinical Note" :
                          insight.category === "appointment" ? "Appointment Note" : "Health Data",
                excerpt: insight.quote,
              }]}
              compact
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function PreventiveItemCard({ item }: { item: PreventiveItem }) {
  return (
    <AccordionItem value={item.id} className="border rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline" data-testid={`accordion-preventive-${item.id}`}>
        <div className="flex items-center gap-3 text-left w-full">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            {categoryIcons[item.type]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{item.name}</p>
            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
          </div>
          <Badge variant="outline">{item.type}</Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {/* Quote */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Quote className="h-3 w-3" />
              Quote:
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border-l-2 border-primary">
              <p className="text-sm italic">"{item.quote}"</p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on: {item.basedOn}
              </p>
            </div>
          </div>

          {/* Last completed */}
          {item.lastCompleted && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last completed:</span>
              <span>{item.lastCompleted}</span>
            </div>
          )}

          {/* Discussion prompts */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
              <MessageCircleQuestion className="h-3 w-3" />
              Things your clinician might suggest discussing:
            </p>
            <ul className="space-y-1">
              {item.discussionPrompts.map((prompt, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {prompt}
                </li>
              ))}
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Link href={item.sourceLink}>
              <Button variant="outline" size="sm" data-testid={`link-source-${item.id}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                View Records
              </Button>
            </Link>
            {item.scheduleLink && (
              <Link href={item.scheduleLink}>
                <Button size="sm" data-testid={`link-schedule-${item.id}`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule
                </Button>
              </Link>
            )}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function PersonalizedHealthInsightsCard() {
  const [open, setOpen] = useState(false);

  const { data: insights, isLoading: insightsLoading } = useQuery<PersonalizedInsightsResponse>({
    queryKey: ["/api/personalized-insights"],
    enabled: open,
  });

  const { data: preventive, isLoading: preventiveLoading } = useQuery<PreventiveCareResponse>({
    queryKey: ["/api/preventive-care-insights"],
    enabled: open,
  });

  const isLoading = insightsLoading || preventiveLoading;

  return (
    <Card className="border-primary/20" data-testid="card-personalized-insights">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-primary" />
          Personalized Health Insights
        </CardTitle>
        <CardDescription>
          AI-analyzed patterns and discussion topics from your records
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-view-insights">
              <Sparkles className="h-4 w-4 mr-2" />
              View Health Insights
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Personalized Health Insights
              </DialogTitle>
              <DialogDescription>
                Things your clinician might suggest discussing based on your records.
              </DialogDescription>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <Tabs defaultValue="insights" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="insights" data-testid="tab-insights">
                    <Activity className="h-4 w-4 mr-2" />
                    Health Patterns
                  </TabsTrigger>
                  <TabsTrigger value="preventive" data-testid="tab-preventive">
                    <Shield className="h-4 w-4 mr-2" />
                    Preventive Care
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 mt-4">
                  <TabsContent value="insights" className="m-0">
                    {insights && (
                      <div className="space-y-4 pr-4">
                        {/* Data sources summary */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-lg font-semibold">{insights.dataSourcesSummary.documentsAnalyzed}</p>
                            <p className="text-xs text-muted-foreground">Documents</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-lg font-semibold">{insights.dataSourcesSummary.labsAnalyzed}</p>
                            <p className="text-xs text-muted-foreground">Labs</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-lg font-semibold">{insights.dataSourcesSummary.conditionsReviewed}</p>
                            <p className="text-xs text-muted-foreground">Conditions</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50 text-center">
                            <p className="text-lg font-semibold">{insights.dataSourcesSummary.appointmentsReviewed}</p>
                            <p className="text-xs text-muted-foreground">Visits</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Insights */}
                        <Accordion type="multiple" className="space-y-2">
                          {insights.insights.map((insight) => (
                            <InsightCard key={insight.id} insight={insight} />
                          ))}
                        </Accordion>

                        {/* Disclaimer */}
                        <div className="p-2 rounded-lg bg-muted/50 border">
                          <p className="text-xs text-muted-foreground text-center">
                            Informational only. Not medical advice.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="preventive" className="m-0">
                    {preventive && (
                      <div className="space-y-4 pr-4">
                        {/* Patient profile */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-sm font-medium mb-1">Based on your profile:</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{preventive.patientProfile.ageGroup}</Badge>
                            {preventive.patientProfile.conditions.map((c, i) => (
                              <Badge key={i} variant="outline">{c}</Badge>
                            ))}
                          </div>
                        </div>

                        {/* Screenings */}
                        <div>
                          <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Eye className="h-4 w-4 text-primary" />
                            Screenings to Discuss
                          </h3>
                          <Accordion type="multiple" className="space-y-2">
                            {preventive.items
                              .filter((item) => item.type === "screening")
                              .map((item) => (
                                <PreventiveItemCard key={item.id} item={item} />
                              ))}
                          </Accordion>
                        </div>

                        <Separator />

                        {/* Vaccinations */}
                        <div>
                          <h3 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Syringe className="h-4 w-4 text-primary" />
                            Vaccinations to Discuss
                          </h3>
                          <Accordion type="multiple" className="space-y-2">
                            {preventive.items
                              .filter((item) => item.type === "vaccination")
                              .map((item) => (
                                <PreventiveItemCard key={item.id} item={item} />
                              ))}
                          </Accordion>
                        </div>

                        {/* Disclaimer */}
                        <div className="p-2 rounded-lg bg-muted/50 border">
                          <p className="text-xs text-muted-foreground text-center">
                            Informational only. Not medical advice.
                          </p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
