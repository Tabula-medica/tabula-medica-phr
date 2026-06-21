import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  BookOpen, 
  Lightbulb, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Sparkles, 
  Clock, 
  Heart, 
  Activity,
  Pill,
  Shield,
  Utensils,
  Dumbbell,
  Brain,
  RefreshCw,
  ChevronRight,
  Star,
  CheckCircle2,
  Loader2
} from "lucide-react";

interface ContentPiece {
  id: string;
  title: string;
  type: "article" | "tip" | "guide" | "infographic" | "video_script";
  format: "text" | "video" | "infographic";
  category: string;
  content: string;
  summary: string;
  keyPoints: string[];
  readingTimeMinutes: number;
  relevanceScore: number;
  relatedConditions: string[];
  relatedGoals: string[];
  actionItems?: string[];
  imagePrompt?: string;
  videoScript?: string;
  createdAt: string;
}

interface ContentRecommendation {
  content: ContentPiece;
  reason: string;
  priority: "high" | "medium" | "low";
}

interface PatientContext {
  conditions?: string[];
  medications?: string[];
  healthGoals?: string[];
  recentSymptoms?: string[];
  adherenceData?: {
    medicationAdherence?: number;
    appointmentAttendance?: number;
    exerciseMinutes?: number;
  };
  preferences?: {
    preferredFormat?: "text" | "video" | "infographic";
    readingLevel?: "simple" | "standard" | "advanced";
  };
}

const categoryIcons: Record<string, typeof Heart> = {
  education: BookOpen,
  lifestyle: Heart,
  medication: Pill,
  prevention: Shield,
  management: Activity,
  nutrition: Utensils,
  exercise: Dumbbell,
  mental_health: Brain,
};

const typeIcons: Record<string, typeof FileText> = {
  article: FileText,
  tip: Lightbulb,
  guide: BookOpen,
  infographic: ImageIcon,
  video_script: Video,
};

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  low: "bg-green-500/10 text-green-600 dark:text-green-400",
};

export default function HealthContentPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("recommendations");
  const [selectedContent, setSelectedContent] = useState<ContentPiece | null>(null);
  const [generateCategory, setGenerateCategory] = useState("education");
  const [generateType, setGenerateType] = useState("article");
  const [customTopic, setCustomTopic] = useState("");
  
  const [patientContext, setPatientContext] = useState<PatientContext>({
    conditions: ["Type 2 Diabetes", "Hypertension"],
    healthGoals: ["Lower blood sugar", "Increase exercise"],
    medications: ["Metformin", "Lisinopril"],
    adherenceData: {
      medicationAdherence: 85,
      exerciseMinutes: 90,
    },
  });

  const { data: categories } = useQuery<Array<{ id: string; name: string; description: string }>>({
    queryKey: ["/api/health-content/categories"],
  });

  const { data: contentTypes } = useQuery<Array<{ id: string; name: string; description: string; format: string }>>({
    queryKey: ["/api/health-content/types"],
  });

  const { 
    data: recommendations, 
    isLoading: isLoadingRecommendations,
    refetch: refetchRecommendations
  } = useQuery<ContentRecommendation[]>({
    queryKey: ["/api/health-content/recommendations", JSON.stringify(patientContext)],
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/health-content/recommendations", {
        userId: "patient-default",
        patientContext,
        limit: 6,
      });
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { category: string; type: string; topic?: string }) => {
      const response = await apiRequest("POST", "/api/health-content/generate", {
        userId: "patient-default",
        patientContext,
        category: params.category,
        contentType: params.type,
        topic: params.topic || undefined,
      });
      return response.json();
    },
    onSuccess: (data: ContentPiece) => {
      setSelectedContent(data);
      toast({
        title: "Content Generated",
        description: `"${data.title}" has been created for you.`,
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerateContent = () => {
    generateMutation.mutate({
      category: generateCategory,
      type: generateType,
      topic: customTopic || undefined,
    });
  };

  const formatContentAsLines = (content: string): string[] => {
    return content.split("\n").filter(line => line.trim());
  };

  const CategoryIcon = ({ category }: { category: string }) => {
    const Icon = categoryIcons[category] || BookOpen;
    return <Icon className="h-4 w-4" />;
  };

  const TypeIcon = ({ type }: { type: string }) => {
    const Icon = typeIcons[type] || FileText;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Personalized Health Content</h1>
          <p className="text-muted-foreground">AI-generated educational content tailored to your health journey</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Star className="h-4 w-4 mr-2" />
            For You
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Sparkles className="h-4 w-4 mr-2" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="library" data-testid="tab-library">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Recommended For You</CardTitle>
                <CardDescription>Content selected based on your conditions, goals, and recent activity</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetchRecommendations()}
                disabled={isLoadingRecommendations}
                data-testid="button-refresh-recommendations"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingRecommendations ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingRecommendations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Generating personalized recommendations...</span>
                </div>
              ) : recommendations && recommendations.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-4">
                  {recommendations.map((rec, index) => (
                    <Card 
                      key={rec.content.id || index}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedContent(rec.content)}
                      data-testid={`card-recommendation-${index}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={rec.content.type} />
                            <Badge variant="outline" className="text-xs">
                              {rec.content.type}
                            </Badge>
                          </div>
                          <Badge className={priorityColors[rec.priority]}>
                            {rec.priority} priority
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-tight">{rec.content.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <p className="text-sm text-muted-foreground line-clamp-2">{rec.content.summary}</p>
                        <p className="text-xs text-primary mt-2">{rec.reason}</p>
                      </CardContent>
                      <CardFooter className="pt-0">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {rec.content.readingTimeMinutes} min
                          </span>
                          <span className="flex items-center gap-1">
                            <CategoryIcon category={rec.content.category} />
                            {rec.content.category}
                          </span>
                        </div>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations available yet.</p>
                  <p className="text-sm">Update your health profile to get personalized content.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Health Profile</CardTitle>
              <CardDescription>This information shapes your content recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Conditions</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {patientContext.conditions?.map((condition, i) => (
                    <Badge key={i} variant="secondary">{condition}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Health Goals</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {patientContext.healthGoals?.map((goal, i) => (
                    <Badge key={i} variant="outline">{goal}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Medications</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {patientContext.medications?.map((med, i) => (
                    <Badge key={i} variant="outline"><Pill className="h-3 w-3 mr-1" />{med}</Badge>
                  ))}
                </div>
              </div>
              {patientContext.adherenceData && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Medication Adherence</p>
                    <p className="text-xl font-bold">{patientContext.adherenceData.medicationAdherence}%</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Weekly Exercise</p>
                    <p className="text-xl font-bold">{patientContext.adherenceData.exerciseMinutes} min</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate Custom Content</CardTitle>
              <CardDescription>Create personalized health education content on any topic</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={generateCategory} onValueChange={setGenerateCategory}>
                    <SelectTrigger id="category" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <div className="flex items-center gap-2">
                            <CategoryIcon category={cat.id} />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Content Type</Label>
                  <Select value={generateType} onValueChange={setGenerateType}>
                    <SelectTrigger id="type" data-testid="select-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {contentTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <div className="flex items-center gap-2">
                            <TypeIcon type={type.id} />
                            {type.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic (Optional)</Label>
                <Input
                  id="topic"
                  placeholder="e.g., Understanding blood pressure readings"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  data-testid="input-topic"
                />
                <p className="text-xs text-muted-foreground">Leave blank for AI-suggested topic based on your profile</p>
              </div>
              <Button 
                onClick={handleGenerateContent}
                disabled={generateMutation.isPending}
                className="w-full"
                data-testid="button-generate"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Browse by Category</CardTitle>
              <CardDescription>Explore health education content organized by topic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories?.map((cat) => (
                  <Card 
                    key={cat.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setGenerateCategory(cat.id);
                      setActiveTab("generate");
                    }}
                    data-testid={`card-category-${cat.id}`}
                  >
                    <CardContent className="p-4 text-center">
                      <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-3">
                        <CategoryIcon category={cat.id} />
                      </div>
                      <h3 className="font-medium">{cat.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content Formats</CardTitle>
              <CardDescription>Choose the format that works best for you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {contentTypes?.map((type) => (
                  <Card 
                    key={type.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setGenerateType(type.id);
                      setActiveTab("generate");
                    }}
                    data-testid={`card-type-${type.id}`}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-muted">
                        <TypeIcon type={type.id} />
                      </div>
                      <div>
                        <h3 className="font-medium">{type.name}</h3>
                        <p className="text-xs text-muted-foreground">{type.description}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedContent && (
        <Card className="mt-6" data-testid="card-content-view">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <TypeIcon type={selectedContent.type} />
                <Badge variant="outline">{selectedContent.type}</Badge>
                <Badge variant="secondary">
                  <CategoryIcon category={selectedContent.category} />
                  <span className="ml-1">{selectedContent.category}</span>
                </Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContent(null)}>
                Close
              </Button>
            </div>
            <CardTitle className="text-xl">{selectedContent.title}</CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedContent.readingTimeMinutes} min read
              </span>
              <span>Relevance: {Math.round(selectedContent.relevanceScore * 100)}%</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium text-sm mb-1">Summary</p>
              <p className="text-muted-foreground">{selectedContent.summary}</p>
            </div>

            {selectedContent.type === "infographic" ? (
              <div className="space-y-3">
                <h3 className="font-medium">Key Information</h3>
                <div className="grid gap-2">
                  {formatContentAsLines(selectedContent.content).map((point, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : selectedContent.type === "video_script" ? (
              <div className="space-y-4">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Video preview coming soon</p>
                  </div>
                </div>
                <div>
                  <h3 className="font-medium mb-2">Video Script</h3>
                  <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                    {selectedContent.videoScript || selectedContent.content}
                  </div>
                </div>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap">{selectedContent.content}</div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-medium mb-3">Key Takeaways</h3>
              <div className="space-y-2">
                {selectedContent.keyPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <span className="text-sm">{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedContent.actionItems && selectedContent.actionItems.length > 0 && (
              <div className="p-4 border rounded-lg bg-primary/5">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <ChevronRight className="h-4 w-4" />
                  Discuss With Your Healthcare Provider
                </h3>
                <ul className="space-y-2">
                  {selectedContent.actionItems.map((item, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-primary font-medium">{i + 1}.</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(selectedContent.relatedConditions.length > 0 || selectedContent.relatedGoals.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {selectedContent.relatedConditions.map((condition, i) => (
                  <Badge key={i} variant="outline">{condition}</Badge>
                ))}
                {selectedContent.relatedGoals.map((goal, i) => (
                  <Badge key={i} variant="secondary">{goal}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
