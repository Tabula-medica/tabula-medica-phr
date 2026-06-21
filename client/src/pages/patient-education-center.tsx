import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Search,
  Heart,
  Pill,
  Shield,
  Brain,
  Apple,
  Activity,
  Clock,
  Bookmark,
  BookmarkCheck,
  Share2,
  Mail,
  Sparkles,
  ChevronRight,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Copy,
  ExternalLink,
  Stethoscope
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/use-seo";

interface EducationArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  specialty: string;
  tags: string[];
  readingTime: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  lastUpdated: string;
  source: string;
  noCdsDisclaimer: string;
}

interface PersonalizedContent {
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string }>;
  keyTakeaways: string[];
  questionsForDoctor: string[];
  relatedTopics: string[];
  generatedAt: string;
  basedOnConditions: string[];
  noCdsDisclaimer: string;
}

interface PatientCondition {
  name: string;
  status: string;
  diagnosedDate: string;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  all: BookOpen,
  conditions: Heart,
  medications: Pill,
  prevention: Shield,
  mental_health: Brain,
  nutrition: Apple,
  general: Activity
};

const difficultyColors = {
  beginner: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  intermediate: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  advanced: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
};

export default function PatientEducationCenter() {
  useSEO({
    title: "Patient Education Center | Tabula Medica",
    description: "Browse personalized health articles and educational resources based on your conditions and health journey."
  });

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("browse");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSpecialty, setSelectedSpecialty] = useState("All Specialties");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArticle, setSelectedArticle] = useState<EducationArticle | null>(null);
  const [savedArticles, setSavedArticles] = useState<string[]>([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("savedEducationArticles");
    if (saved) {
      setSavedArticles(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("savedEducationArticles", JSON.stringify(savedArticles));
  }, [savedArticles]);

  const { data: categories } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/patient-education-center/categories"]
  });

  const { data: specialties } = useQuery<string[]>({
    queryKey: ["/api/patient-education-center/specialties"]
  });

  const { data: articlesData, isLoading: articlesLoading } = useQuery({
    queryKey: ["/api/patient-education-center/articles", selectedCategory, selectedSpecialty, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSpecialty !== "All Specialties") params.set("specialty", selectedSpecialty);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/patient-education-center/articles?${params}`);
      return res.json();
    }
  });

  const { data: patientData } = useQuery<{
    conditions: PatientCondition[];
    journeySummary: string;
  }>({
    queryKey: ["/api/patient-education-center/patient-conditions"]
  });

  const generatePersonalizedMutation = useMutation({
    mutationFn: async (data: { topic?: string }) => {
      const res = await apiRequest("POST", "/api/patient-education-center/generate-personalized", {
        patientConditions: patientData?.conditions?.map((c: PatientCondition) => c.name),
        journeySummary: patientData?.journeySummary,
        topic: data.topic
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Content Generated",
        description: "Personalized educational content has been created based on your health profile."
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate personalized content. Please try again.",
        variant: "destructive"
      });
    }
  });

  const shareEmailMutation = useMutation({
    mutationFn: async (data: { articleId: string; recipientEmail: string; personalMessage?: string }) => {
      const res = await apiRequest("POST", "/api/patient-education-center/share-email", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Article Shared",
        description: "The article has been shared via email successfully."
      });
      setShareDialogOpen(false);
      setShareEmail("");
      setShareMessage("");
    },
    onError: () => {
      toast({
        title: "Share Failed",
        description: "Unable to share the article. Please try again.",
        variant: "destructive"
      });
    }
  });

  const toggleSaveArticle = (articleId: string) => {
    if (savedArticles.includes(articleId)) {
      setSavedArticles(savedArticles.filter(id => id !== articleId));
      toast({ title: "Article Removed", description: "Article removed from your saved list." });
    } else {
      setSavedArticles([...savedArticles, articleId]);
      toast({ title: "Article Saved", description: "Article added to your saved list." });
    }
  };

  const handleShare = () => {
    if (!selectedArticle || !shareEmail) return;
    shareEmailMutation.mutate({
      articleId: selectedArticle.id,
      recipientEmail: shareEmail,
      personalMessage: shareMessage
    });
  };

  const articles: EducationArticle[] = articlesData?.articles || [];
  const savedArticlesList = articles.filter(a => savedArticles.includes(a.id));

  const CategoryIcon = categoryIcons[selectedCategory] || BookOpen;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-education-title">
              <BookOpen className="h-6 w-6 text-primary" />
              Patient Education Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Browse health articles and personalized educational content
            </p>
          </div>
        </div>

        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Informational Only:</strong> This content is for educational purposes and does not constitute medical advice, diagnosis, or treatment. Always consult your healthcare provider.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse" data-testid="tab-browse">
              <BookOpen className="h-4 w-4 mr-2" />
              Browse Articles
            </TabsTrigger>
            <TabsTrigger value="personalized" data-testid="tab-personalized">
              <Sparkles className="h-4 w-4 mr-2" />
              For You
            </TabsTrigger>
            <TabsTrigger value="saved" data-testid="tab-saved">
              <Bookmark className="h-4 w-4 mr-2" />
              Saved ({savedArticles.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-4 mt-4">
            {selectedArticle ? (
              <div className="space-y-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedArticle(null)}
                  data-testid="button-back-to-articles"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Articles
                </Button>

                <Card data-testid="card-article-detail">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <CardTitle className="text-xl">{selectedArticle.title}</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{selectedArticle.specialty}</Badge>
                          <Badge variant="outline" className={difficultyColors[selectedArticle.difficulty]}>
                            {selectedArticle.difficulty}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {selectedArticle.readingTime} min read
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => toggleSaveArticle(selectedArticle.id)}
                          data-testid="button-save-article"
                        >
                          {savedArticles.includes(selectedArticle.id) ? (
                            <BookmarkCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </Button>
                        <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" data-testid="button-share-article">
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Share Article via Email</DialogTitle>
                              <DialogDescription>
                                Send "{selectedArticle.title}" to someone via email.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="email">Recipient Email</Label>
                                <Input
                                  id="email"
                                  type="email"
                                  placeholder="email@example.com"
                                  value={shareEmail}
                                  onChange={(e) => setShareEmail(e.target.value)}
                                  data-testid="input-share-email"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="message">Personal Message (Optional)</Label>
                                <Textarea
                                  id="message"
                                  placeholder="I thought you might find this article helpful..."
                                  value={shareMessage}
                                  onChange={(e) => setShareMessage(e.target.value)}
                                  data-testid="input-share-message"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShareDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button 
                                onClick={handleShare}
                                disabled={!shareEmail || shareEmailMutation.isPending}
                                data-testid="button-send-share"
                              >
                                {shareEmailMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Mail className="h-4 w-4 mr-2" />
                                )}
                                Send
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{selectedArticle.summary}</p>
                    <Separator />
                    <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
                      {selectedArticle.content}
                    </div>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {selectedArticle.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Source: {selectedArticle.source}</p>
                      <p>Last updated: {selectedArticle.lastUpdated}</p>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        {selectedArticle.noCdsDisclaimer}
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search articles..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-search-articles"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories || []).map((cat: { id: string; name: string }) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger className="w-full sm:w-48" data-testid="select-specialty">
                      <SelectValue placeholder="Specialty" />
                    </SelectTrigger>
                    <SelectContent>
                      {(specialties || []).map((spec: string) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {articlesLoading ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i}>
                        <CardHeader>
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2 mt-2" />
                        </CardHeader>
                        <CardContent>
                          <Skeleton className="h-16 w-full" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {articles.map((article) => (
                      <Card 
                        key={article.id} 
                        className="cursor-pointer hover-elevate"
                        onClick={() => setSelectedArticle(article)}
                        data-testid={`card-article-${article.id}`}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSaveArticle(article.id);
                              }}
                            >
                              {savedArticles.includes(article.id) ? (
                                <BookmarkCheck className="h-4 w-4 text-primary" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <Badge variant="outline">{article.specialty}</Badge>
                            <Badge variant="outline" className={difficultyColors[article.difficulty]}>
                              {article.difficulty}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {article.readingTime} min
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>
                        </CardContent>
                        <CardFooter className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}

                {!articlesLoading && articles.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="font-semibold mb-2">No Articles Found</h3>
                      <p className="text-muted-foreground">Try adjusting your search or filter criteria.</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="personalized" className="space-y-4 mt-4">
            <Card data-testid="card-patient-conditions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5" />
                  Your Health Profile
                </CardTitle>
                <CardDescription>
                  Content is personalized based on your active conditions and health journey
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-2">Active Conditions</h4>
                  <div className="flex flex-wrap gap-2">
                    {(patientData?.conditions || []).map((condition: PatientCondition, index: number) => (
                      <Badge key={index} variant="outline" className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {condition.name}
                        <span className="text-xs text-muted-foreground">({condition.status})</span>
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-2">Journey Summary</h4>
                  <p className="text-sm text-muted-foreground">{patientData?.journeySummary}</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-generate-personalized">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI-Personalized Content
                </CardTitle>
                <CardDescription>
                  Generate educational content tailored to your specific conditions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={() => generatePersonalizedMutation.mutate({})}
                  disabled={generatePersonalizedMutation.isPending}
                  className="w-full"
                  data-testid="button-generate-content"
                >
                  {generatePersonalizedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating Content...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Personalized Content
                    </>
                  )}
                </Button>

                {generatePersonalizedMutation.data?.personalizedContent && (
                  <div className="space-y-4 pt-4" data-testid="personalized-content-result">
                    <div className="p-4 rounded-lg border bg-primary/5">
                      <h3 className="font-semibold text-lg mb-2">
                        {generatePersonalizedMutation.data.personalizedContent.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        {generatePersonalizedMutation.data.personalizedContent.summary}
                      </p>

                      <div className="space-y-4">
                        {generatePersonalizedMutation.data.personalizedContent.sections?.map((section: { heading: string; content: string }, index: number) => (
                          <div key={index}>
                            <h4 className="font-medium mb-1">{section.heading}</h4>
                            <p className="text-sm text-muted-foreground">{section.content}</p>
                          </div>
                        ))}
                      </div>

                      <Separator className="my-4" />

                      <div>
                        <h4 className="font-medium mb-2 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          Key Takeaways
                        </h4>
                        <ul className="space-y-1">
                          {generatePersonalizedMutation.data.personalizedContent.keyTakeaways?.map((takeaway: string, index: number) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">•</span>
                              {takeaway}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Separator className="my-4" />

                      <div>
                        <h4 className="font-medium mb-2">Questions for Your Doctor</h4>
                        <ul className="space-y-1">
                          {generatePersonalizedMutation.data.personalizedContent.questionsForDoctor?.map((question: string, index: number) => (
                            <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <span className="text-primary">?</span>
                              {question}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Alert className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          {generatePersonalizedMutation.data.personalizedContent.noCdsDisclaimer}
                        </AlertDescription>
                      </Alert>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="saved" className="space-y-4 mt-4">
            {savedArticlesList.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No Saved Articles</h3>
                  <p className="text-muted-foreground mb-4">
                    Save articles you want to read later by clicking the bookmark icon.
                  </p>
                  <Button variant="outline" onClick={() => setActiveTab("browse")}>
                    Browse Articles
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {savedArticlesList.map((article) => (
                  <Card 
                    key={article.id} 
                    className="cursor-pointer hover-elevate"
                    onClick={() => {
                      setSelectedArticle(article);
                      setActiveTab("browse");
                    }}
                    data-testid={`card-saved-article-${article.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg line-clamp-2">{article.title}</CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveArticle(article.id);
                          }}
                        >
                          <BookmarkCheck className="h-4 w-4 text-primary" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{article.specialty}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {article.readingTime} min
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
