import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Users, 
  Heart, 
  DollarSign, 
  BookOpen, 
  HandHeart, 
  MessageCircle, 
  FlaskConical, 
  Apple,
  Search,
  ExternalLink,
  Phone,
  Mail,
  Star,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Filter
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { SupportResource, SupportResourceCategory, AIResourceSuggestion } from "@shared/schema";

const categoryIcons: Record<SupportResourceCategory, typeof Users> = {
  advocacy_groups: Users,
  mental_health: Heart,
  financial_assistance: DollarSign,
  educational_materials: BookOpen,
  caregiver_support: HandHeart,
  community_forums: MessageCircle,
  clinical_trials: FlaskConical,
  nutritional_support: Apple,
};

const categoryColors: Record<SupportResourceCategory, string> = {
  advocacy_groups: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
  mental_health: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300",
  financial_assistance: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  educational_materials: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  caregiver_support: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  community_forums: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300",
  clinical_trials: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300",
  nutritional_support: "bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300",
};

interface ResourcesResponse {
  resources: SupportResource[];
  total: number;
  categories: readonly SupportResourceCategory[];
}

interface CategoriesResponse {
  categories: Array<{
    id: SupportResourceCategory;
    name: string;
    count: number;
    icon: string;
  }>;
}

interface AISuggestionsResponse {
  suggestions: AIResourceSuggestion[];
  aiGenerated: boolean;
  disclaimer: string;
}

export default function SupportResources() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<SupportResourceCategory | "all">("all");
  const [activeTab, setActiveTab] = useState("browse");

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery<ResourcesResponse>({
    queryKey: [
      `/api/support-resources?${selectedCategory !== "all" ? `category=${selectedCategory}&` : ""}${searchQuery ? `search=${encodeURIComponent(searchQuery)}` : ""}`
    ],
  });

  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ["/api/support-resources/categories"],
  });

  const aiSuggestionsMutation = useMutation({
    mutationFn: async (context: { cancerType?: string; symptoms?: string[]; lateEffects?: string[] }) => {
      const response = await apiRequest("POST", "/api/support-resources/ai-suggestions", context);
      return response.json() as Promise<AISuggestionsResponse>;
    },
  });

  const handleGetSuggestions = () => {
    aiSuggestionsMutation.mutate({
      cancerType: "breast",
      symptoms: ["fatigue", "nausea"],
      lateEffects: ["lymphedema", "neuropathy"],
    });
  };

  const formatCategoryName = (category: string) => {
    return category
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl" data-testid="page-support-resources">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Support Resources</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Find curated resources for patient advocacy, mental health support, financial assistance, and more.
        </p>
      </div>

      <Alert className="mb-6 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-200">Information Only</AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-300" data-testid="text-disclaimer">
          These resources are for informational purposes only. They are not medical advice or treatment recommendations. 
          Please discuss any health concerns with your healthcare provider.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="browse" data-testid="tab-browse">
            <Search className="h-4 w-4 mr-2" />
            Browse Resources
          </TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-resource-discovery">
            <Sparkles className="h-4 w-4 mr-2" />
            Resource Discovery
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
                data-testid="button-filter-all"
              >
                <Filter className="h-4 w-4 mr-1" />
                All
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {categoriesData?.categories.map((cat) => {
              const IconComponent = categoryIcons[cat.id];
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? "default" : "outline"}
                  size="sm"
                  className="flex flex-col h-auto py-3 px-2"
                  onClick={() => setSelectedCategory(cat.id)}
                  data-testid={`button-category-${cat.id}`}
                >
                  <IconComponent className="h-5 w-5 mb-1" />
                  <span className="text-xs text-center leading-tight">{cat.name}</span>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {cat.count}
                  </Badge>
                </Button>
              );
            })}
          </div>

          {resourcesLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-16 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="container-resources">
              {resourcesData?.resources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
              {resourcesData?.resources.length === 0 && (
                <div className="col-span-full text-center py-12" data-testid="text-no-results">
                  <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No resources found matching your criteria.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-suggestions-title">
                <Sparkles className="h-5 w-5 text-primary" />
                Resource Discovery
              </CardTitle>
              <CardDescription data-testid="text-suggestions-description">
                Browse support resources that may be available for your situation. Resources are matched by category and type.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                  <strong>NOT medical advice.</strong> This tool displays informational resources only. 
                  It does not evaluate your health or provide recommendations. Please consult your healthcare provider.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground" data-testid="text-suggestions-info">
                View support resources organized by category. Resources are filtered by general criteria 
                and displayed for your information.
              </p>
              <Button 
                onClick={handleGetSuggestions} 
                disabled={aiSuggestionsMutation.isPending}
                data-testid="button-get-suggestions"
              >
                {aiSuggestionsMutation.isPending ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    View Matched Resources
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {aiSuggestionsMutation.data && (
            <div className="space-y-4">
              <div className="flex items-center gap-2" data-testid="text-match-method">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium">
                  {aiSuggestionsMutation.data.aiGenerated ? "AI-Matched" : "Category-Matched"} Resources
                </span>
              </div>

              <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-700 dark:text-blue-300" data-testid="text-resources-disclaimer">
                  {aiSuggestionsMutation.data.disclaimer}
                </AlertDescription>
              </Alert>

              <div className="grid md:grid-cols-2 gap-4" data-testid="container-suggestions">
                {aiSuggestionsMutation.data.suggestions.map((suggestion) => (
                  <Card key={suggestion.id} data-testid={`card-suggestion-${suggestion.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-8 bg-primary rounded-full" />
                          <CardTitle className="text-lg" data-testid={`text-suggestion-name-${suggestion.id}`}>
                            {suggestion.resource.name}
                          </CardTitle>
                        </div>
                        <Badge variant="secondary" className="shrink-0" data-testid={`badge-match-${suggestion.id}`}>
                          {Math.round(suggestion.relevanceScore * 100)}% match
                        </Badge>
                      </div>
                      <CardDescription className={categoryColors[suggestion.resource.category]}>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-category-${suggestion.id}`}>
                          {formatCategoryName(suggestion.resource.category)}
                        </Badge>
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-muted-foreground" data-testid={`text-suggestion-reason-${suggestion.id}`}>
                        {suggestion.reason}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" asChild>
                          <a 
                            href={suggestion.resource.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            data-testid={`link-suggestion-visit-${suggestion.id}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Visit
                          </a>
                        </Button>
                        {suggestion.resource.phone && (
                          <Button size="sm" variant="outline" asChild>
                            <a 
                              href={`tel:${suggestion.resource.phone}`}
                              data-testid={`link-suggestion-phone-${suggestion.id}`}
                            >
                              <Phone className="h-4 w-4 mr-1" />
                              Call
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResourceCard({ resource }: { resource: SupportResource }) {
  const IconComponent = categoryIcons[resource.category];

  return (
    <Card className="hover-elevate transition-all" data-testid={`card-resource-${resource.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${categoryColors[resource.category]}`} data-testid={`icon-category-${resource.id}`}>
              <IconComponent className="h-4 w-4" />
            </div>
            <CardTitle className="text-lg leading-tight" data-testid={`text-resource-name-${resource.id}`}>
              {resource.name}
            </CardTitle>
          </div>
          {resource.isVerified && (
            <Badge variant="outline" className="shrink-0 text-green-600 border-green-600" data-testid={`badge-verified-${resource.id}`}>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>
        {resource.rating && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground" data-testid={`text-rating-${resource.id}`}>
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span>{resource.rating.toFixed(1)}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-resource-description-${resource.id}`}>
          {resource.description}
        </p>

        {resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1" data-testid={`container-tags-${resource.id}`}>
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs" data-testid={`badge-tag-${resource.id}-${tag}`}>
                {tag}
              </Badge>
            ))}
            {resource.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs" data-testid={`badge-tags-more-${resource.id}`}>
                +{resource.tags.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button size="sm" asChild>
            <a 
              href={resource.url} 
              target="_blank" 
              rel="noopener noreferrer"
              data-testid={`link-resource-visit-${resource.id}`}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Visit
            </a>
          </Button>
          {resource.phone && (
            <Button size="sm" variant="outline" asChild>
              <a href={`tel:${resource.phone}`} data-testid={`link-resource-phone-${resource.id}`}>
                <Phone className="h-4 w-4 mr-1" />
                {resource.phone}
              </a>
            </Button>
          )}
          {resource.email && (
            <Button size="sm" variant="ghost" asChild>
              <a href={`mailto:${resource.email}`} data-testid={`link-resource-email-${resource.id}`}>
                <Mail className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>

        {resource.languages && resource.languages.length > 0 && (
          <p className="text-xs text-muted-foreground" data-testid={`text-languages-${resource.id}`}>
            Available in: {resource.languages.join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
