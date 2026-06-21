import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  FileText, 
  Pill, 
  Activity, 
  Heart, 
  AlertTriangle,
  Stethoscope,
  Syringe,
  Clock,
  Database,
  ArrowRight,
  X,
  Sparkles,
  Filter
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
  source: string;
  sourcePlatform?: string;
  matchType: "exact" | "synonym" | "fuzzy";
  matchedTerms: string[];
  relevanceScore: number;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalCount: number;
  synonymsUsed?: string[];
}

const typeIcons: Record<string, typeof FileText> = {
  lab_result: Activity,
  medication: Pill,
  imaging: FileText,
  visit: Stethoscope,
  document: FileText,
  condition: Heart,
  allergy: AlertTriangle,
  procedure: Stethoscope,
  vaccination: Syringe,
};

const typeColors: Record<string, string> = {
  lab_result: "bg-blue-500/10 text-blue-600 border-blue-200",
  medication: "bg-green-500/10 text-green-600 border-green-200",
  imaging: "bg-purple-500/10 text-purple-600 border-purple-200",
  visit: "bg-amber-500/10 text-amber-600 border-amber-200",
  document: "bg-slate-500/10 text-slate-600 border-slate-200",
  condition: "bg-red-500/10 text-red-600 border-red-200",
  allergy: "bg-orange-500/10 text-orange-600 border-orange-200",
  procedure: "bg-teal-500/10 text-teal-600 border-teal-200",
  vaccination: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
};

const matchTypeBadges: Record<string, { label: string; className: string }> = {
  exact: { label: "Exact Match", className: "bg-green-500/10 text-green-600" },
  synonym: { label: "Synonym Match", className: "bg-blue-500/10 text-blue-600" },
  fuzzy: { label: "Similar Match", className: "bg-amber-500/10 text-amber-600" },
};

const typeFilters = [
  { id: "all", label: "All Types", icon: Filter },
  { id: "lab_result", label: "Labs", icon: Activity },
  { id: "medication", label: "Medications", icon: Pill },
  { id: "imaging", label: "Imaging", icon: FileText },
  { id: "condition", label: "Conditions", icon: Heart },
  { id: "allergy", label: "Allergies", icon: AlertTriangle },
  { id: "visit", label: "Visits", icon: Stethoscope },
  { id: "vaccination", label: "Vaccines", icon: Syringe },
];

export default function SmartSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const logAnalytics = useMutation({
    mutationFn: async (data: { eventType: string; metadata?: Record<string, string> }) => {
      return apiRequest("POST", "/api/search/analytics", data);
    },
  });

  useEffect(() => {
    logAnalytics.mutate({ eventType: "search_opened" });
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        setDebouncedQuery(searchQuery.trim());
        setHasSearched(true);
        logAnalytics.mutate({ 
          eventType: "search_query_submitted", 
          metadata: { queryLength: searchQuery.length.toString() } 
        });
      } else if (searchQuery.trim().length === 0) {
        setDebouncedQuery("");
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: searchResults, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ["/api/search", debouncedQuery, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ query: debouncedQuery });
      if (typeFilter !== "all") {
        params.append("types", typeFilter);
      }
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error("Search failed");
      return response.json();
    },
    enabled: debouncedQuery.length >= 2,
  });

  useEffect(() => {
    if (searchResults && searchResults.totalCount === 0 && hasSearched) {
      logAnalytics.mutate({ eventType: "search_zero_results" });
    }
  }, [searchResults, hasSearched]);

  const handleResultClick = useCallback((result: SearchResult) => {
    logAnalytics.mutate({ 
      eventType: "search_result_clicked", 
      metadata: { 
        resultType: result.type, 
        resultId: result.id,
        matchType: result.matchType 
      } 
    });
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatTypeName = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const filteredResults = searchResults?.results.filter(r => 
    typeFilter === "all" || r.type === typeFilter
  ) || [];

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Smart Search
            </h1>
            <p className="text-muted-foreground">Search across all your health records instantly</p>
          </div>
        </div>

        <div className="relative" data-testid="search-input-container">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search for labs, medications, conditions... (e.g., 'LDL', 'metformin', 'CT chest')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-12 text-base"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={clearSearch}
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap" data-testid="search-type-filters">
          {typeFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = typeFilter === filter.id;
            return (
              <Button
                key={filter.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter(filter.id)}
                className="gap-1.5"
                data-testid={`filter-${filter.id}`}
              >
                <Icon className="h-4 w-4" />
                {filter.label}
              </Button>
            );
          })}
        </div>

        {searchResults?.synonymsUsed && searchResults.synonymsUsed.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="synonym-indicator">
            <Sparkles className="h-4 w-4" />
            <span>Also searching for: </span>
            <div className="flex gap-1 flex-wrap">
              {searchResults.synonymsUsed.slice(0, 5).map((syn, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {syn}
                </Badge>
              ))}
              {searchResults.synonymsUsed.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{searchResults.synonymsUsed.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        {!hasSearched && !debouncedQuery ? (
          <Card className="border-dashed" data-testid="search-empty-state">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Search Your Health Records</h3>
              <p className="text-muted-foreground max-w-md mb-6">
                Find labs, medications, conditions, and more. Try searching for:
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                {["LDL", "metformin", "CT chest", "diabetes", "blood pressure"].map((term) => (
                  <Button
                    key={term}
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery(term)}
                    data-testid={`suggestion-${term.replace(/\s+/g, '-')}`}
                  >
                    {term}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3" data-testid="search-loading">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredResults.length === 0 ? (
          <Card className="border-dashed" data-testid="search-no-results">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                No records match "{debouncedQuery}"
                {typeFilter !== "all" && ` in ${formatTypeName(typeFilter)}`}
              </p>
              <div className="flex gap-2">
                {typeFilter !== "all" && (
                  <Button variant="outline" onClick={() => setTypeFilter("all")}>
                    Search All Types
                  </Button>
                )}
                <Button variant="outline" onClick={clearSearch}>
                  Clear Search
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span data-testid="text-result-count">
                {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''} found
                {typeFilter !== "all" && ` in ${formatTypeName(typeFilter)}`}
              </span>
            </div>

            {filteredResults.map((result) => {
              const Icon = typeIcons[result.type] || FileText;
              const colorClass = typeColors[result.type] || "bg-muted text-muted-foreground";
              const matchBadge = matchTypeBadges[result.matchType];

              return (
                <Card 
                  key={result.id} 
                  className="hover-elevate cursor-pointer transition-all"
                  onClick={() => handleResultClick(result)}
                  data-testid={`search-result-${result.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold truncate" data-testid={`text-result-title-${result.id}`}>
                            {result.title}
                          </h3>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {formatTypeName(result.type)}
                          </Badge>
                          <Badge className={`text-xs ${matchBadge.className}`}>
                            {matchBadge.label}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {result.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1" data-testid={`text-result-date-${result.id}`}>
                            <Clock className="h-3 w-3" />
                            {formatDate(result.date)}
                          </span>
                          <span className="flex items-center gap-1" data-testid={`text-result-source-${result.id}`}>
                            <Database className="h-3 w-3" />
                            {result.source}
                          </span>
                          {result.matchedTerms.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Matched: {result.matchedTerms.slice(0, 2).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
