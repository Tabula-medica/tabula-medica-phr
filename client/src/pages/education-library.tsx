import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Book,
  FileText,
  HelpCircle,
  Video,
  ListChecks,
  Image,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Filter,
  BarChart3,
  AlertCircle,
  Loader2,
  Trophy,
  ArrowRight,
  Heart,
  Pill,
  User,
} from "lucide-react";

type ContentType = "article" | "faq" | "video" | "infographic" | "checklist";
type EducationCategory = "conditions" | "medications" | "nutrition" | "exercise" | "mental_health" | "prevention" | "treatment" | "lifestyle" | "emergency" | "general_wellness";
type ApprovalStatus = "draft" | "pending_review" | "approved" | "rejected" | "archived";
type ReadingLevel = "basic" | "intermediate" | "advanced";

interface LibraryContent {
  id: string;
  type: ContentType;
  category: EducationCategory;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  readingLevel: ReadingLevel;
  estimatedReadTime: number;
  status: ApprovalStatus;
  aiGenerated: boolean;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  safetyDisclaimer: string;
}

interface LibraryFAQ {
  id: string;
  category: EducationCategory;
  question: string;
  answer: string;
  tags: string[];
  readingLevel: ReadingLevel;
  status: ApprovalStatus;
  aiGenerated: boolean;
  createdAt: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

interface CurationStats {
  totalContent: number;
  byType: Record<ContentType, number>;
  byCategory: Record<EducationCategory, number>;
  byStatus: Record<ApprovalStatus, number>;
  pendingReview: number;
  aiGenerated: number;
  manuallyCreated: number;
  mostViewed: Array<{ id: string; title: string; viewCount: number }>;
  mostHelpful: Array<{ id: string; title: string; helpfulCount: number }>;
}

const categoryLabels: Record<EducationCategory, string> = {
  conditions: "Health Conditions",
  medications: "Medications",
  nutrition: "Nutrition",
  exercise: "Exercise & Fitness",
  mental_health: "Mental Health",
  prevention: "Preventive Care",
  treatment: "Treatment Options",
  lifestyle: "Lifestyle",
  emergency: "Emergency Care",
  general_wellness: "General Wellness",
};

const statusColors: Record<ApprovalStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  archived: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400",
};

const typeIcons: Record<ContentType, typeof Book> = {
  article: FileText,
  faq: HelpCircle,
  video: Video,
  infographic: Image,
  checklist: ListChecks,
};

export default function EducationLibrary() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("for-you");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedContent, setSelectedContent] = useState<LibraryContent | null>(null);
  const [selectedFAQ, setSelectedFAQ] = useState<LibraryFAQ | null>(null);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [generateType, setGenerateType] = useState<"article" | "faq">("article");
  const [generateForm, setGenerateForm] = useState({
    topic: "",
    category: "general_wellness" as EducationCategory,
    readingLevel: "basic" as ReadingLevel,
    keywords: "",
    additionalContext: "",
  });

  const { data: contentData, isLoading: contentLoading } = useQuery<{ content: LibraryContent[] }>({
    queryKey: ["/api/education-library/content", searchQuery, categoryFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/education-library/content?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch content");
      return response.json();
    },
  });

  const { data: faqsData, isLoading: faqsLoading } = useQuery<{ faqs: LibraryFAQ[] }>({
    queryKey: ["/api/education-library/faqs", categoryFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/education-library/faqs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch FAQs");
      return response.json();
    },
  });

  const { data: statsData } = useQuery<CurationStats>({
    queryKey: ["/api/education-library/stats"],
  });

  const { data: personalizedData } = useQuery<any>({
    queryKey: ["/api/education-library/personalized"],
  });

  const generateArticleMutation = useMutation({
    mutationFn: async (request: any) => {
      return apiRequest("POST", "/api/education-library/generate/article", request);
    },
    onSuccess: () => {
      toast({ title: "Article Generated", description: "The article has been created and submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setGenerateDialogOpen(false);
      setGenerateForm({ topic: "", category: "general_wellness", readingLevel: "basic", keywords: "", additionalContext: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate article.", variant: "destructive" });
    },
  });

  const generateFAQsMutation = useMutation({
    mutationFn: async (request: any) => {
      return apiRequest("POST", "/api/education-library/generate/faqs", request);
    },
    onSuccess: () => {
      toast({ title: "FAQs Generated", description: "FAQs have been created and submitted for review." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/faqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setGenerateDialogOpen(false);
      setGenerateForm({ topic: "", category: "general_wellness", readingLevel: "basic", keywords: "", additionalContext: "" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate FAQs.", variant: "destructive" });
    },
  });

  const approveContentMutation = useMutation({
    mutationFn: async (contentId: string) => {
      return apiRequest("POST", `/api/education-library/content/${contentId}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: "Content Approved", description: "The content is now published." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setSelectedContent(null);
    },
  });

  const rejectContentMutation = useMutation({
    mutationFn: async ({ contentId, reason }: { contentId: string; reason: string }) => {
      return apiRequest("POST", `/api/education-library/content/${contentId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "Content Rejected", description: "The content has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setSelectedContent(null);
    },
  });

  const approveFAQMutation = useMutation({
    mutationFn: async (faqId: string) => {
      return apiRequest("POST", `/api/education-library/faqs/${faqId}/approve`, {});
    },
    onSuccess: () => {
      toast({ title: "FAQ Approved", description: "The FAQ is now published." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/faqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setSelectedFAQ(null);
    },
  });

  const rejectFAQMutation = useMutation({
    mutationFn: async ({ faqId, reason }: { faqId: string; reason: string }) => {
      return apiRequest("POST", `/api/education-library/faqs/${faqId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: "FAQ Rejected", description: "The FAQ has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/faqs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/education-library/stats"] });
      setSelectedFAQ(null);
    },
  });

  const handleGenerate = () => {
    const request = {
      type: generateType,
      category: generateForm.category,
      topic: generateForm.topic,
      readingLevel: generateForm.readingLevel,
      keywords: generateForm.keywords ? generateForm.keywords.split(",").map(k => k.trim()) : undefined,
      additionalContext: generateForm.additionalContext || undefined,
    };

    if (generateType === "article") {
      generateArticleMutation.mutate(request);
    } else {
      generateFAQsMutation.mutate({ ...request, count: 5 });
    }
  };

  const contents = contentData?.content || [];
  const faqs = faqsData?.faqs || [];
  const stats = statsData;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Book className="h-6 w-6 text-primary" />
              Patient Education Library
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-powered health education materials with care team curation
            </p>
          </div>
          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-generate-content">
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Content
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate Education Content</DialogTitle>
                <DialogDescription>
                  Use AI to create patient education materials. Content will be submitted for care team review.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="education-library-content-type">Content Type</Label>
                  <Select value={generateType} onValueChange={(v) => setGenerateType(v as "article" | "faq")}>
                    <SelectTrigger id="education-library-content-type" data-testid="select-content-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="faq">FAQs (5 questions)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="education-library-topic">Topic</Label>
                  <Input id="education-library-topic"
                    placeholder="e.g., Managing diabetes through diet"
                    value={generateForm.topic}
                    onChange={(e) => setGenerateForm({ ...generateForm, topic: e.target.value })}
                    data-testid="input-topic"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="education-library-category">Category</Label>
                    <Select
                      value={generateForm.category}
                      onValueChange={(v) => setGenerateForm({ ...generateForm, category: v as EducationCategory })}
                    >
                      <SelectTrigger id="education-library-category" data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education-library-reading-level">Reading Level</Label>
                    <Select
                      value={generateForm.readingLevel}
                      onValueChange={(v) => setGenerateForm({ ...generateForm, readingLevel: v as ReadingLevel })}
                    >
                      <SelectTrigger id="education-library-reading-level" data-testid="select-reading-level">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic (5th-6th grade)</SelectItem>
                        <SelectItem value="intermediate">Intermediate (8th-10th grade)</SelectItem>
                        <SelectItem value="advanced">Advanced (College level)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="education-library-keywords-comma-separated-optional">Keywords (comma-separated, optional)</Label>
                  <Input id="education-library-keywords-comma-separated-optional"
                    placeholder="e.g., blood sugar, insulin, diet"
                    value={generateForm.keywords}
                    onChange={(e) => setGenerateForm({ ...generateForm, keywords: e.target.value })}
                    data-testid="input-keywords"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="education-library-additional-context-optional">Additional Context (optional)</Label>
                  <Textarea id="education-library-additional-context-optional"
                    placeholder="Any specific focus areas or requirements..."
                    value={generateForm.additionalContext}
                    onChange={(e) => setGenerateForm({ ...generateForm, additionalContext: e.target.value })}
                    data-testid="input-context"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenerateDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!generateForm.topic || generateArticleMutation.isPending || generateFAQsMutation.isPending}
                  data-testid="button-submit-generate"
                >
                  {(generateArticleMutation.isPending || generateFAQsMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Book className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-total-content">{stats.totalContent}</p>
                    <p className="text-sm text-muted-foreground">Total Content</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-pending-review">{stats.pendingReview}</p>
                    <p className="text-sm text-muted-foreground">Pending Review</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-approved">{stats.byStatus.approved || 0}</p>
                    <p className="text-sm text-muted-foreground">Approved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                    <Sparkles className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-ai-generated">{stats.aiGenerated}</p>
                    <p className="text-sm text-muted-foreground">AI Generated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="for-you" data-testid="tab-for-you">
              <User className="h-4 w-4 mr-2" />
              For You
            </TabsTrigger>
            <TabsTrigger value="browse" data-testid="tab-browse">
              <Book className="h-4 w-4 mr-2" />
              Browse
            </TabsTrigger>
            <TabsTrigger value="faqs" data-testid="tab-faqs">
              <HelpCircle className="h-4 w-4 mr-2" />
              FAQs
            </TabsTrigger>
            <TabsTrigger value="review" data-testid="tab-review">
              <Clock className="h-4 w-4 mr-2" />
              Review Queue
            </TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="filter-category">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <TabsContent value="for-you" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold">Recommended for You</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Personalized articles based on your health conditions and medications
                </p>
                {personalizedData?.recommendations?.length > 0 ? (
                  <div className="space-y-4">
                    {personalizedData.recommendations.map((rec: any) => (
                      <Card key={rec.id} className="hover-elevate cursor-pointer" data-testid={`card-rec-${rec.id}`}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Badge variant="secondary" className="capitalize">{rec.category}</Badge>
                                <Badge variant="outline" className="text-xs">{rec.estimatedReadTime} min read</Badge>
                                <Badge variant="outline" className="text-xs capitalize">{rec.readingLevel}</Badge>
                              </div>
                              <h3 className="font-semibold mb-1" data-testid={`text-rec-title-${rec.id}`}>{rec.title}</h3>
                              <p className="text-sm text-muted-foreground mb-2">{rec.summary}</p>
                              <p className="text-sm leading-relaxed">{rec.content}</p>
                              <div className="mt-3 flex items-center gap-2 flex-wrap">
                                <Heart className="h-3 w-3 text-rose-500" />
                                <span className="text-xs text-muted-foreground">{rec.relevanceReason}</span>
                                <span className="text-xs text-muted-foreground">| Relevance: {rec.relevanceScore}%</span>
                              </div>
                              {rec.safetyDisclaimer && (
                                <div className="mt-3 p-2 rounded bg-muted/50 flex items-start gap-2">
                                  <AlertCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                                  <p className="text-xs text-muted-foreground">{rec.safetyDisclaimer}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium">No Personalized Content Yet</h3>
                      <p className="text-muted-foreground mt-1">We're analyzing your health profile to find relevant articles.</p>
                    </CardContent>
                  </Card>
                )}
                {personalizedData?.disclaimer && (
                  <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2 mt-4">
                    <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{personalizedData.disclaimer}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Card data-testid="card-your-profile">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      Your Health Profile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">CONDITIONS</p>
                      <div className="flex flex-wrap gap-1">
                        {personalizedData?.patientConditions?.map((c: string) => (
                          <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">MEDICATIONS</p>
                      <div className="flex flex-wrap gap-1">
                        {personalizedData?.patientMedications?.map((m: string) => (
                          <Badge key={m} variant="outline" className="text-xs">
                            <Pill className="h-3 w-3 mr-1" />
                            {m}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Separator />
                    <div className="text-center">
                      <p className="text-sm font-medium">{personalizedData?.totalRecommendations || 0}</p>
                      <p className="text-xs text-muted-foreground">Articles matched to you</p>
                    </div>
                  </CardContent>
                </Card>

                <Card data-testid="card-education-cross-links">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      Stay Engaged
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Link href="/health-journal">
                      <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-journal-from-education">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-violet-500" />
                          <div>
                            <p className="text-sm font-medium">Health Journal</p>
                            <p className="text-xs text-muted-foreground">Track symptoms & earn points</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                    <Link href="/gamification-dashboard">
                      <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-gamification-from-education">
                        <div className="flex items-center gap-3">
                          <Trophy className="h-5 w-5 text-amber-500" />
                          <div>
                            <p className="text-sm font-medium">Achievements</p>
                            <p className="text-xs text-muted-foreground">View your badges & rewards</p>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="browse" className="mt-4">
            {contentLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : contents.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Book className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Content Found</h3>
                  <p className="text-muted-foreground mt-1">Generate some content using the button above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {contents.map((content) => {
                  const TypeIcon = typeIcons[content.type];
                  return (
                    <Card
                      key={content.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => setSelectedContent(content)}
                      data-testid={`card-content-${content.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">
                              {categoryLabels[content.category]}
                            </Badge>
                          </div>
                          <Badge className={statusColors[content.status]}>
                            {content.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <CardTitle className="text-base mt-2 line-clamp-2">{content.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">{content.summary}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {content.viewCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {content.helpfulCount}
                          </span>
                          <span>{content.estimatedReadTime} min read</span>
                          {content.aiGenerated && (
                            <Sparkles className="h-3 w-3 text-violet-500" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="faqs" className="mt-4">
            {faqsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : faqs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No FAQs Found</h3>
                  <p className="text-muted-foreground mt-1">Generate FAQs using the button above.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <Card
                    key={faq.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => setSelectedFAQ(faq)}
                    data-testid={`card-faq-${faq.id}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-primary" />
                          {faq.question}
                        </CardTitle>
                        <Badge className={statusColors[faq.status]}>
                          {faq.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{faq.answer}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {categoryLabels[faq.category]}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {faq.viewCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {faq.helpfulCount}
                        </span>
                        {faq.aiGenerated && (
                          <Sparkles className="h-3 w-3 text-violet-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="review" className="mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Articles Pending Review
                </h3>
                {contents.filter(c => c.status === "pending_review").length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No articles pending review
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {contents.filter(c => c.status === "pending_review").map((content) => (
                      <Card key={content.id} data-testid={`review-content-${content.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{content.title}</CardTitle>
                              <CardDescription className="mt-1">{content.summary}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedContent(content)}
                                data-testid={`button-view-${content.id}`}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => approveContentMutation.mutate(content.id)}
                                disabled={approveContentMutation.isPending}
                                data-testid={`button-approve-${content.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectContentMutation.mutate({ contentId: content.id, reason: "Does not meet quality standards" })}
                                disabled={rejectContentMutation.isPending}
                                data-testid={`button-reject-${content.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  FAQs Pending Review
                </h3>
                {faqs.filter(f => f.status === "pending_review").length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No FAQs pending review
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {faqs.filter(f => f.status === "pending_review").map((faq) => (
                      <Card key={faq.id} data-testid={`review-faq-${faq.id}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-base">{faq.question}</CardTitle>
                              <CardDescription className="mt-1 line-clamp-2">{faq.answer}</CardDescription>
                            </div>
                            <div className="flex gap-2 ml-4">
                              <Button
                                size="sm"
                                onClick={() => approveFAQMutation.mutate(faq.id)}
                                disabled={approveFAQMutation.isPending}
                                data-testid={`button-approve-faq-${faq.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectFAQMutation.mutate({ faqId: faq.id, reason: "Does not meet quality standards" })}
                                disabled={rejectFAQMutation.isPending}
                                data-testid={`button-reject-faq-${faq.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            {stats && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Content by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.byCategory).filter(([_, count]) => count > 0).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-sm">{categoryLabels[category as EducationCategory]}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                      {Object.values(stats.byCategory).every(c => c === 0) && (
                        <p className="text-muted-foreground text-sm">No content yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Content by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(stats.byType).filter(([_, count]) => count > 0).map(([type, count]) => {
                        const TypeIcon = typeIcons[type as ContentType];
                        return (
                          <div key={type} className="flex items-center justify-between">
                            <span className="text-sm flex items-center gap-2">
                              <TypeIcon className="h-4 w-4 text-muted-foreground" />
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Most Viewed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.mostViewed.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No views yet</p>
                      ) : (
                        stats.mostViewed.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span className="text-sm truncate flex-1 mr-2">
                              {idx + 1}. {item.title}
                            </span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Eye className="h-3 w-3" />
                              {item.viewCount}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Most Helpful</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {stats.mostHelpful.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No feedback yet</p>
                      ) : (
                        stats.mostHelpful.map((item, idx) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span className="text-sm truncate flex-1 mr-2">
                              {idx + 1}. {item.title}
                            </span>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <ThumbsUp className="h-3 w-3" />
                              {item.helpfulCount}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            {selectedContent && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{categoryLabels[selectedContent.category]}</Badge>
                    <Badge className={statusColors[selectedContent.status]}>
                      {selectedContent.status.replace("_", " ")}
                    </Badge>
                    {selectedContent.aiGenerated && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI Generated
                      </Badge>
                    )}
                  </div>
                  <DialogTitle>{selectedContent.title}</DialogTitle>
                  <DialogDescription>{selectedContent.summary}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[50vh]">
                  <div className="prose dark:prose-invert prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: selectedContent.content.replace(/\n/g, "<br/>") }} />
                  </div>
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {selectedContent.safetyDisclaimer}
                    </p>
                  </div>
                </ScrollArea>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mr-auto">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {selectedContent.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {selectedContent.helpfulCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="h-4 w-4" />
                      {selectedContent.notHelpfulCount}
                    </span>
                  </div>
                  {selectedContent.status === "pending_review" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => rejectContentMutation.mutate({ contentId: selectedContent.id, reason: "Does not meet quality standards" })}
                        disabled={rejectContentMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => approveContentMutation.mutate(selectedContent.id)}
                        disabled={approveContentMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedFAQ} onOpenChange={() => setSelectedFAQ(null)}>
          <DialogContent className="max-w-lg">
            {selectedFAQ && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{categoryLabels[selectedFAQ.category]}</Badge>
                    <Badge className={statusColors[selectedFAQ.status]}>
                      {selectedFAQ.status.replace("_", " ")}
                    </Badge>
                    {selectedFAQ.aiGenerated && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        AI Generated
                      </Badge>
                    )}
                  </div>
                  <DialogTitle className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-primary" />
                    {selectedFAQ.question}
                  </DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <p className="text-muted-foreground">{selectedFAQ.answer}</p>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mr-auto">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {selectedFAQ.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {selectedFAQ.helpfulCount}
                    </span>
                  </div>
                  {selectedFAQ.status === "pending_review" && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => rejectFAQMutation.mutate({ faqId: selectedFAQ.id, reason: "Does not meet quality standards" })}
                        disabled={rejectFAQMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                      <Button
                        onClick={() => approveFAQMutation.mutate(selectedFAQ.id)}
                        disabled={approveFAQMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
