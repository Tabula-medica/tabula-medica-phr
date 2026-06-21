import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Video,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  Search,
  Star,
  Clock,
  Heart,
  Activity,
  Pill,
  Brain,
  Utensils,
  Moon,
  Dumbbell,
  Sparkles,
  RefreshCw,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Info,
  Play,
  ExternalLink,
  Bookmark,
  Share2,
  ThumbsUp,
} from "lucide-react";

interface ContentItem {
  id: string;
  title: string;
  type: "article" | "video" | "infographic" | "guide" | "tip";
  format: "text" | "video" | "image";
  category: string;
  summary: string;
  content: string;
  keyPoints: string[];
  readingTimeMinutes: number;
  relevanceScore: number;
  relatedConditions: string[];
  relatedMedications: string[];
  tags: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  createdAt: string;
  updatedAt: string;
  actionItems?: string[];
}

interface ContentRecommendation {
  content: ContentItem;
  reason: string;
  priority: "high" | "medium" | "low";
  matchScore: number;
}

interface PatientProfile {
  conditions: string[];
  medications: string[];
  healthGoals: string[];
  interests: string[];
  preferredFormat: "text" | "video" | "any";
  readingLevel: "simple" | "standard" | "advanced";
  challenges: string[];
}

const categoryIcons: Record<string, typeof Heart> = {
  "Heart Health": Heart,
  "Nutrition": Utensils,
  "Exercise": Dumbbell,
  "Medication Management": Pill,
  "Mental Health": Brain,
  "Sleep": Moon,
  "Diabetes Care": Activity,
  "General Wellness": Star,
  "Generated Content": Sparkles,
};

const typeIcons: Record<string, typeof FileText> = {
  article: FileText,
  video: Video,
  infographic: ImageIcon,
  guide: BookOpen,
  tip: Lightbulb,
};

const priorityColors = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200",
  low: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200",
};

const difficultyLabels = {
  beginner: "Easy Read",
  intermediate: "Standard",
  advanced: "In-Depth",
};

const defaultProfile: PatientProfile = {
  conditions: ["Type 2 Diabetes", "Hypertension"],
  medications: ["Metformin", "Lisinopril"],
  healthGoals: ["Lower blood sugar", "Improve heart health", "Increase exercise"],
  interests: ["nutrition", "exercise", "wellness"],
  preferredFormat: "any",
  readingLevel: "standard",
  challenges: ["medication adherence", "stress management"],
};

function ContentCard({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const TypeIcon = typeIcons[item.type] || FileText;
  const CategoryIcon = categoryIcons[item.category] || Star;

  return (
    <Card 
      className="cursor-pointer hover-elevate h-full flex flex-col"
      onClick={onClick}
      data-testid={`content-card-${item.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">
            <TypeIcon className="h-3 w-3 mr-1" />
            {item.type}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {item.readingTimeMinutes} min
          </Badge>
        </div>
        <CardTitle className="text-base mt-2 line-clamp-2">{item.title}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-xs">
          <CategoryIcon className="h-3 w-3" />
          {item.category}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
      </CardContent>
      <CardFooter className="pt-0 flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          {difficultyLabels[item.difficulty]}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-primary">
          <span>Read more<span className="sr-only"> about {item.title}</span></span>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </div>
      </CardFooter>
    </Card>
  );
}

function RecommendationCard({ recommendation, onClick }: { recommendation: ContentRecommendation; onClick: () => void }) {
  const { content, reason, priority, matchScore } = recommendation;
  const TypeIcon = typeIcons[content.type] || FileText;
  const CategoryIcon = categoryIcons[content.category] || Star;

  return (
    <Card 
      className={`cursor-pointer hover-elevate border-l-4 ${priorityColors[priority]}`}
      onClick={onClick}
      data-testid={`recommendation-card-${content.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TypeIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{content.type}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={priorityColors[priority]} variant="outline">
              {matchScore}% match
            </Badge>
          </div>
        </div>
        <CardTitle className="text-base">{content.title}</CardTitle>
        <CardDescription className="flex items-center gap-1">
          <CategoryIcon className="h-3 w-3" />
          {content.category}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{content.summary}</p>
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-primary">{reason}</span>
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {content.readingTimeMinutes} min read
        </div>
        <Button variant="ghost" size="sm">
          Read now
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function PersonalizedHealthContent() {
  const { toast } = useToast();
  const [profile] = useState<PatientProfile>(defaultProfile);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [generateTopic, setGenerateTopic] = useState("");
  const [explainTopic, setExplainTopic] = useState("");
  const [showExplainDialog, setShowExplainDialog] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["/api/health-content/categories"],
  });

  const { data: libraryData, isLoading: libraryLoading } = useQuery({
    queryKey: ["/api/health-content/library", categoryFilter, typeFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (searchQuery) params.append("search", searchQuery);
      const res = await fetch(`/api/health-content/library?${params}`);
      if (!res.ok) throw new Error("Failed to fetch library");
      return res.json();
    },
  });

  const { data: recommendationsData, isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery({
    queryKey: ["/api/health-content/recommendations", JSON.stringify(profile)],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/health-content/recommendations", { profile });
      return res.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", "/api/health-content/generate-content", {
        topic,
        type: "article",
        profile,
        difficulty: profile.readingLevel === "simple" ? "beginner" : profile.readingLevel,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.content) {
        setSelectedContent(data.content);
        toast({
          title: "Content Generated",
          description: "Your personalized content is ready to read.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const explainMutation = useMutation({
    mutationFn: async (topic: string) => {
      const res = await apiRequest("POST", "/api/health-content/explain", {
        topic,
        readingLevel: profile.readingLevel,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.explanation) {
        setSelectedContent({
          id: "explanation-" + Date.now(),
          title: `Understanding: ${data.topic}`,
          type: "article",
          format: "text",
          category: "Generated Content",
          summary: "AI-generated explanation for your question",
          content: data.explanation,
          keyPoints: [],
          readingTimeMinutes: 3,
          relevanceScore: 100,
          relatedConditions: [],
          relatedMedications: [],
          tags: [],
          difficulty: "beginner",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setShowExplainDialog(false);
      }
    },
    onError: () => {
      toast({
        title: "Unable to Explain",
        description: "Could not generate explanation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const recommendations = recommendationsData?.recommendations || [];
  const contentLibrary = libraryData?.content || [];
  const categoryList = (categories as any)?.categories || [];

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6" data-testid="health-content-page">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Health Education Center</h1>
          <p className="text-muted-foreground">Personalized articles, videos, and guides for your health journey</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowExplainDialog(true)} data-testid="button-explain">
            <Lightbulb className="h-4 w-4 mr-2" />
            Ask a Question
          </Button>
          <Button variant="outline" onClick={() => refetchRecommendations()} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Alert className="bg-blue-500/5 border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm">
          Content is curated based on your health profile and is for educational purposes only. It is NOT medical advice.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="recommendations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Sparkles className="h-4 w-4 mr-2" />
            For You
          </TabsTrigger>
          <TabsTrigger value="library" data-testid="tab-library">
            <BookOpen className="h-4 w-4 mr-2" />
            Browse All
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <Brain className="h-4 w-4 mr-2" />
            AI Content
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Recommended For You
                  </CardTitle>
                  <CardDescription>
                    Based on your conditions, medications, and health goals
                  </CardDescription>
                </div>
                <Badge variant="outline">
                  {recommendations.length} matches
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Finding content for you...</span>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Recommendations Yet</h3>
                  <p className="text-muted-foreground">Browse our library to discover health content.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {recommendations.slice(0, 6).map((rec: ContentRecommendation) => (
                    <RecommendationCard
                      key={rec.content.id}
                      recommendation={rec}
                      onClick={() => setSelectedContent(rec.content)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Conditions", count: profile.conditions.length, icon: Activity },
              { label: "Medications", count: profile.medications.length, icon: Pill },
              { label: "Health Goals", count: profile.healthGoals.length, icon: CheckCircle2 },
              { label: "Interests", count: profile.interests.length, icon: Star },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-4 text-center">
                  <stat.icon className="h-6 w-6 mx-auto text-primary mb-2" />
                  <p className="text-2xl font-bold">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Content Library</CardTitle>
              <CardDescription>Browse all available health education materials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]" data-testid="select-category">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryList.map((cat: any) => (
                      <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]" data-testid="select-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="article">Articles</SelectItem>
                    <SelectItem value="video">Videos</SelectItem>
                    <SelectItem value="guide">Guides</SelectItem>
                    <SelectItem value="infographic">Infographics</SelectItem>
                    <SelectItem value="tip">Tips</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {libraryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : contentLibrary.length === 0 ? (
                <div className="text-center py-8">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Content Found</h3>
                  <p className="text-muted-foreground">Try adjusting your search or filters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {contentLibrary.map((item: ContentItem) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedContent(item)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generate" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle>AI-Generated Content</CardTitle>
              </div>
              <CardDescription>
                Get personalized educational content on any health topic
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Enter a health topic (e.g., 'managing blood pressure naturally')"
                  value={generateTopic}
                  onChange={(e) => setGenerateTopic(e.target.value)}
                  className="flex-1"
                  data-testid="input-generate-topic"
                />
                <Button 
                  onClick={() => generateTopic && generateMutation.mutate(generateTopic)}
                  disabled={!generateTopic || generateMutation.isPending}
                  data-testid="button-generate"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["Blood Sugar Tips", "Heart Health", "Better Sleep", "Stress Relief"].map((topic) => (
                  <Button
                    key={topic}
                    variant="outline"
                    size="sm"
                    onClick={() => setGenerateTopic(topic)}
                  >
                    {topic}
                  </Button>
                ))}
              </div>

              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  AI-generated content is personalized based on your health profile and preferences. 
                  It is for educational purposes only and is NOT medical advice.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  Heart Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Understanding blood pressure readings")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Understanding blood pressure
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Heart-healthy diet tips")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Heart-healthy diet
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Exercise for heart health")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Exercise for heart health
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pill className="h-4 w-4 text-blue-500" />
                  Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Tips for medication adherence")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Remembering your meds
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Understanding medication side effects")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Managing side effects
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Safe medication storage")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Safe storage tips
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  Wellness
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Stress management techniques")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Stress management
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Improving sleep quality")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Better sleep habits
                  </li>
                  <li 
                    className="cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => generateMutation.mutate("Mindfulness for beginners")}
                  >
                    <ChevronRight className="h-3 w-3" />
                    Mindfulness basics
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedContent && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline">
                    {selectedContent.type}
                  </Badge>
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    {selectedContent.readingTimeMinutes} min
                  </Badge>
                  <Badge variant="outline">
                    {difficultyLabels[selectedContent.difficulty]}
                  </Badge>
                </div>
                <DialogTitle className="text-xl">{selectedContent.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  {categoryIcons[selectedContent.category] && (
                    <span className="flex items-center gap-1">
                      {(() => {
                        const Icon = categoryIcons[selectedContent.category];
                        return <Icon className="h-4 w-4" />;
                      })()}
                      {selectedContent.category}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {selectedContent.format === "video" && selectedContent.videoUrl && (
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Play className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="text-muted-foreground font-medium">{selectedContent.summary}</p>
                  <Separator className="my-4" />
                  <div className="whitespace-pre-wrap">{selectedContent.content}</div>
                </div>

                {selectedContent.keyPoints && selectedContent.keyPoints.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Key Takeaways</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedContent.keyPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {selectedContent.actionItems && selectedContent.actionItems.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Try This</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {selectedContent.actionItems.map((action, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5" />
                            {action}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    This content is for educational purposes only. It is NOT medical advice. 
                    Always consult your healthcare provider about your specific health needs.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      <ThumbsUp className="h-4 w-4 mr-1" />
                      Helpful
                    </Button>
                    <Button variant="outline" size="sm">
                      <Bookmark className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4 mr-1" />
                    Share
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showExplainDialog} onOpenChange={setShowExplainDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Ask a Health Question
            </DialogTitle>
            <DialogDescription>
              Get a simple explanation of any health topic or medical term
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="e.g., What is blood pressure?"
              value={explainTopic}
              onChange={(e) => setExplainTopic(e.target.value)}
              data-testid="input-explain"
            />
            <div className="flex flex-wrap gap-2">
              {["What is A1C?", "How do beta blockers work?", "What causes high cholesterol?"].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => setExplainTopic(q)}
                >
                  {q}
                </Button>
              ))}
            </div>
            <Button 
              className="w-full" 
              onClick={() => explainTopic && explainMutation.mutate(explainTopic)}
              disabled={!explainTopic || explainMutation.isPending}
              data-testid="button-explain-submit"
            >
              {explainMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Explain This
            </Button>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Explanations are for learning purposes only and are NOT medical advice.
              </AlertDescription>
            </Alert>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
