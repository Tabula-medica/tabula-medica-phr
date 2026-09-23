import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  AlertCircle,
  BookmarkPlus,
  Brain,
  ChevronRight,
  Clock,
  FileText,
  History,
  Lightbulb,
  Loader2,
  Microscope,
  Search,
  Sparkles,
  Star,
  Trash2,
  User,
  Zap,
} from "lucide-react";

interface SearchParameter {
  resourceType: string;
  parameter: string;
  comparator?: string;
  value: string | number | boolean;
  system?: string;
}

interface ParsedQuery {
  id: string;
  originalQuery: string;
  intent: string;
  resourceTypes: string[];
  searchParameters: SearchParameter[];
  fhirQuery: string;
  confidence: number;
  explanation: string;
  suggestedRefinements: string[];
  parsedAt: string;
}

interface SearchResult {
  id: string;
  resourceType: string;
  resourceId: string;
  display: string;
  summary: string;
  relevanceScore: number;
  matchedCriteria: string[];
  data: Record<string, unknown>;
  source: string;
  lastUpdated: string;
}

interface NLSearchResponse {
  query: ParsedQuery;
  results: SearchResult[];
  total: number;
  executionTimeMs: number;
  aiExplanation: string;
  relatedQueries: string[];
}

interface SearchHistoryEntry {
  id: string;
  query: string;
  resultCount: number;
  searchedAt: string;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  createdAt: string;
}

interface Metadata {
  version: string;
  supportedResourceTypes: string[];
  clinicalConcepts: string[];
  aiEnabled: boolean;
  features: string[];
}

export default function AIFHIRNLSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NLSearchResponse | null>(null);
  const [saveQueryName, setSaveQueryName] = useState("");
  const { toast } = useToast();

  const { data: metadata } = useQuery<Metadata>({
    queryKey: ["/api/fhir-nl-search/metadata"],
  });

  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ["/api/fhir-nl-search/suggestions"],
  });

  const { data: historyData, refetch: refetchHistory } = useQuery<{ history: SearchHistoryEntry[] }>({
    queryKey: ["/api/fhir-nl-search/history"],
  });

  const { data: savedData, refetch: refetchSaved } = useQuery<{ savedQueries: SavedQuery[] }>({
    queryKey: ["/api/fhir-nl-search/saved"],
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/fhir-nl-search", { query });
      return response.json() as Promise<NLSearchResponse>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
      refetchHistory();
    },
    onError: () => {
      toast({ 
        title: "Search Failed", 
        description: "Could not process your search query. Please try again.", 
        variant: "destructive" 
      });
    },
  });

  const saveQueryMutation = useMutation({
    mutationFn: async ({ name, query }: { name: string; query: string }) => {
      const response = await apiRequest("POST", "/api/fhir-nl-search/saved", { name, query });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Query Saved", description: "Your search query has been saved." });
      setSaveQueryName("");
      refetchSaved();
    },
    onError: () => {
      toast({ title: "Save Failed", description: "Could not save the query.", variant: "destructive" });
    },
  });

  const deleteQueryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/fhir-nl-search/saved/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Query Deleted" });
      refetchSaved();
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim().length < 3) {
      toast({ 
        title: "Query Too Short", 
        description: "Please enter at least 3 characters.", 
        variant: "destructive" 
      });
      return;
    }
    searchMutation.mutate(searchQuery);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    searchMutation.mutate(suggestion);
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType) {
      case "Patient": return <User className="w-4 h-4" />;
      case "Observation": return <Microscope className="w-4 h-4" />;
      case "Condition": return <AlertCircle className="w-4 h-4" />;
      case "MedicationRequest": return <FileText className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-500/20 text-green-700 dark:text-green-400";
    if (confidence >= 0.6) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400";
    return "bg-orange-500/20 text-orange-700 dark:text-orange-400";
  };

  return (
    <div className="space-y-6" data-testid="fhir-nl-search-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-search-title">
            <Brain className="w-6 h-6 text-primary" />
            AI-Powered Clinical Search
          </h1>
          <p className="text-muted-foreground">
            Search your health data using natural language queries
          </p>
        </div>
        {metadata?.aiEnabled && (
          <Badge variant="outline" className="gap-1">
            <Sparkles className="w-3 h-3" />
            AI Enhanced
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Clinical Data
          </CardTitle>
          <CardDescription>
            Ask questions in plain English, like &quot;Find patients with diabetes and HbA1c above 8%&quot;
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-search-query"
              placeholder="Enter your clinical query in plain English..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button
              data-testid="button-search"
              onClick={handleSearch}
              disabled={searchMutation.isPending}
            >
              {searchMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {suggestionsData?.suggestions && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Lightbulb className="w-4 h-4" />
                Try these example queries:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestionsData.suggestions.slice(0, 5).map((suggestion, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs"
                    data-testid={`button-suggestion-${i}`}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {searchMutation.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyzing your query with AI...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {searchResults && !searchMutation.isPending && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Query Analysis
                </CardTitle>
                <Badge className={getConfidenceColor(searchResults.query.confidence)}>
                  {Math.round(searchResults.query.confidence * 100)}% confidence
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Intent Detected</p>
                  <p className="font-medium" data-testid="text-query-intent">{searchResults.query.intent}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Resource Types</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {searchResults.query.resourceTypes.map((type) => (
                      <Badge key={type} variant="secondary" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">AI Explanation</p>
                <p className="text-sm bg-muted/50 p-3 rounded-md" data-testid="text-ai-explanation">
                  {searchResults.aiExplanation}
                </p>
              </div>

              {searchResults.query.suggestedRefinements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Suggestions to Refine</p>
                  <ul className="text-sm space-y-1">
                    {searchResults.query.suggestedRefinements.map((ref, i) => (
                      <li key={i} className="flex items-center gap-2 text-muted-foreground">
                        <ChevronRight className="w-3 h-3" />
                        {ref}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  placeholder="Name this query to save..."
                  value={saveQueryName}
                  onChange={(e) => setSaveQueryName(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveQueryMutation.mutate({ 
                    name: saveQueryName || `Query ${new Date().toLocaleDateString()}`, 
                    query: searchResults.query.originalQuery 
                  })}
                  disabled={saveQueryMutation.isPending}
                  data-testid="button-save-query"
                >
                  <BookmarkPlus className="w-4 h-4 mr-1" />
                  Save Query
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Search Results ({searchResults.total})
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {searchResults.executionTimeMs}ms
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {searchResults.results.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No results found for your query.</p>
                  <p className="text-sm mt-2">Try broadening your search criteria.</p>
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-search-results">
                  {searchResults.results.map((result) => (
                    <div
                      key={result.id}
                      className="p-4 border rounded-lg hover-elevate cursor-pointer"
                      data-testid={`result-${result.resourceId}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10">
                            {getResourceIcon(result.resourceType)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{result.display}</h4>
                              <Badge variant="outline" className="text-xs">
                                {result.resourceType}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {result.summary}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.matchedCriteria.map((criteria, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {criteria}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-primary/20 text-primary">
                            {Math.round(result.relevanceScore * 100)}%
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {result.source}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {searchResults.relatedQueries.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Related Queries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {searchResults.relatedQueries.map((query, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSuggestionClick(query)}
                      data-testid={`button-related-${i}`}
                    >
                      {query}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs defaultValue="history" className="w-full">
        <TabsList>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-2" />
            Recent Searches
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved">
            <Star className="w-4 h-4 mr-2" />
            Saved Queries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history">
          <Card>
            <CardContent className="pt-6">
              {!historyData?.history || historyData.history.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No recent searches yet.
                </p>
              ) : (
                <div className="space-y-2" data-testid="list-search-history">
                  {historyData.history.slice(0, 10).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover-elevate cursor-pointer"
                      {...clickable(() => handleSuggestionClick(entry.query))}
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{entry.query}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {entry.resultCount} results
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.searchedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved">
          <Card>
            <CardContent className="pt-6">
              {!savedData?.savedQueries || savedData.savedQueries.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No saved queries yet. Save a query after searching.
                </p>
              ) : (
                <div className="space-y-2" data-testid="list-saved-queries">
                  {savedData.savedQueries.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                    >
                      <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        {...clickable(() => handleSuggestionClick(saved.query))}
                      >
                        <Star className="w-4 h-4 text-yellow-500" />
                        <div>
                          <p className="font-medium text-sm">{saved.name}</p>
                          <p className="text-xs text-muted-foreground">{saved.query}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteQueryMutation.mutate(saved.id)}
                        data-testid={`button-delete-saved-${saved.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {metadata && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Supported Clinical Concepts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {metadata.clinicalConcepts.slice(0, 20).map((concept) => (
                <Badge
                  key={concept}
                  variant="outline"
                  className="text-xs cursor-pointer hover-elevate"
                  onClick={() => handleSuggestionClick(`Find patients with ${concept}`)}
                >
                  {concept}
                </Badge>
              ))}
              {metadata.clinicalConcepts.length > 20 && (
                <Badge variant="outline" className="text-xs">
                  +{metadata.clinicalConcepts.length - 20} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
