import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  FlaskConical,
  FileText,
  Image,
  StickyNote,
  Pill,
  Heart,
  Stethoscope,
  AlertTriangle,
  Clock,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";

type SearchResultType = "lab" | "document" | "imaging" | "note" | "medication" | "condition" | "procedure" | "allergy";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  date: string;
  matchedTerms: string[];
  relevanceScore: number;
  snippet?: string;
  source: string;
}

interface SmartSearchResponse {
  query: string;
  expandedTerms: string[];
  results: SearchResult[];
  resultsByType: Record<SearchResultType, SearchResult[]>;
  totalCount: number;
  searchTime: number;
  suggestions?: string[];
}

const typeConfig: Record<SearchResultType, { icon: typeof Search; color: string; label: string; bg: string }> = {
  lab: { icon: FlaskConical, color: "text-green-500", label: "Labs", bg: "bg-green-100 dark:bg-green-900/30" },
  document: { icon: FileText, color: "text-blue-500", label: "Documents", bg: "bg-blue-100 dark:bg-blue-900/30" },
  imaging: { icon: Image, color: "text-purple-500", label: "Imaging", bg: "bg-purple-100 dark:bg-purple-900/30" },
  note: { icon: StickyNote, color: "text-yellow-500", label: "Notes", bg: "bg-yellow-100 dark:bg-yellow-900/30" },
  medication: { icon: Pill, color: "text-orange-500", label: "Medications", bg: "bg-orange-100 dark:bg-orange-900/30" },
  condition: { icon: Heart, color: "text-red-500", label: "Conditions", bg: "bg-red-100 dark:bg-red-900/30" },
  procedure: { icon: Stethoscope, color: "text-indigo-500", label: "Procedures", bg: "bg-indigo-100 dark:bg-indigo-900/30" },
  allergy: { icon: AlertTriangle, color: "text-pink-500", label: "Allergies", bg: "bg-pink-100 dark:bg-pink-900/30" },
};

function SearchResultCard({ result }: { result: SearchResult }) {
  const config = typeConfig[result.type];
  const Icon = config.icon;

  return (
    <div className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`search-result-${result.id}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{result.title}</p>
            <Badge variant="outline" className="text-xs shrink-0">{config.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
          {result.snippet && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.snippet}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs text-muted-foreground flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {new Date(result.date).toLocaleDateString()}
            </span>
            {result.matchedTerms.slice(0, 3).map((term, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{term}</Badge>
            ))}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  );
}

function ResultsSection({ results, title }: { results: SearchResult[]; title: string }) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title} ({results.length})</h4>
      {results.map((result) => (
        <SearchResultCard key={result.id} result={result} />
      ))}
    </div>
  );
}

export function SmartSearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        setDebouncedQuery(query);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await apiRequest("POST", "/api/smart-search", { query: searchQuery });
      return response.json() as Promise<SmartSearchResponse>;
    },
  });

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchMutation.mutate(debouncedQuery);
    }
  }, [debouncedQuery]);

  const handleClear = () => {
    setQuery("");
    setDebouncedQuery("");
  };

  const searchResults = searchMutation.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full justify-start text-muted-foreground" data-testid="button-smart-search">
          <Search className="h-4 w-4" />
          <span>Search across everything...</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col p-0">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder="Search labs, documents, imaging, medications..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-10"
              data-testid="input-smart-search"
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                onClick={handleClear}
                data-testid="button-clear-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchResults?.expandedTerms && searchResults.expandedTerms.length > 1 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-xs text-muted-foreground">Also searching:</span>
              {searchResults.expandedTerms.slice(1, 5).map((term, i) => (
                <Badge key={i} variant="outline" className="text-xs">{term}</Badge>
              ))}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {!query && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">Search across everything</p>
                <p className="text-xs mt-1">Find labs, documents, imaging reports, medications, and more</p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {["colonoscopy", "thyroid", "LDL", "metformin", "CT abdomen"].map((suggestion) => (
                    <Badge
                      key={suggestion}
                      variant="secondary"
                      className="cursor-pointer hover-elevate"
                      onClick={() => setQuery(suggestion)}
                      data-testid={`suggestion-${suggestion}`}
                    >
                      {suggestion}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {searchMutation.isPending && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            )}

            {searchResults && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Found {searchResults.totalCount} results in {searchResults.searchTime}ms
                  </p>
                </div>

                {searchResults.totalCount === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No results found for "{searchResults.query}"</p>
                    {searchResults.suggestions && (
                      <div className="mt-3 space-y-1">
                        {searchResults.suggestions.map((suggestion, i) => (
                          <p key={i} className="text-xs">{suggestion}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <Tabs defaultValue="all">
                    <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
                      <TabsTrigger value="all" className="text-xs">
                        All ({searchResults.totalCount})
                      </TabsTrigger>
                      {Object.entries(searchResults.resultsByType).map(([type, results]) => {
                        if (results.length === 0) return null;
                        const config = typeConfig[type as SearchResultType];
                        return (
                          <TabsTrigger key={type} value={type} className="text-xs gap-1">
                            <config.icon className={`h-3 w-3 ${config.color}`} />
                            {results.length}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>

                    <TabsContent value="all" className="mt-4 space-y-4">
                      {searchResults.results.slice(0, 20).map((result) => (
                        <SearchResultCard key={result.id} result={result} />
                      ))}
                    </TabsContent>

                    {Object.entries(searchResults.resultsByType).map(([type, results]) => (
                      <TabsContent key={type} value={type} className="mt-4 space-y-2">
                        {results.map((result) => (
                          <SearchResultCard key={result.id} result={result} />
                        ))}
                      </TabsContent>
                    ))}
                  </Tabs>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function SmartSearchBar() {
  return (
    <Card data-testid="card-smart-search">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Smart Search
          <Badge variant="secondary" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SmartSearchDialog />
        <p className="text-xs text-muted-foreground mt-2">
          Search across labs, documents, imaging, notes, and more with AI-powered fuzzy matching
        </p>
      </CardContent>
    </Card>
  );
}
