import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { clickable } from "@/lib/a11y";
import {
  Search, Plus, Trash2, Play, Brain, Save, Clock, Filter,
  ChevronRight, Database, Sparkles, X, Copy, RefreshCw
} from "lucide-react";

type SearchOperator = "eq" | "ne" | "lt" | "le" | "gt" | "ge" | "contains" | "exact" | "starts" | "ends" | "fuzzy" | "in" | "not-in" | "missing";

interface SearchParameter {
  id: string;
  name: string;
  type: string;
  description: string;
  resourceTypes: string[];
  comparators?: SearchOperator[];
}

interface SearchCondition {
  id: string;
  parameter: string;
  operator: SearchOperator;
  value: string;
}

interface SearchResult {
  resourceType: string;
  id: string;
  data: Record<string, unknown>;
  score?: number;
  matchedFields?: string[];
}

interface SearchSuggestion {
  id: string;
  type: string;
  suggestion: string;
  description: string;
  confidence: number;
  example?: string;
}

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  query: { resourceType: string; conditions: SearchCondition[] };
  usageCount: number;
}

const OPERATORS: { value: SearchOperator; label: string; description: string }[] = [
  { value: "eq", label: "Equals", description: "Exact match" },
  { value: "ne", label: "Not Equals", description: "Does not equal" },
  { value: "contains", label: "Contains", description: "Contains text" },
  { value: "starts", label: "Starts With", description: "Starts with text" },
  { value: "ends", label: "Ends With", description: "Ends with text" },
  { value: "fuzzy", label: "Fuzzy Match", description: "Approximate match (typo-tolerant)" },
  { value: "lt", label: "Less Than", description: "Less than value" },
  { value: "le", label: "Less or Equal", description: "Less than or equal" },
  { value: "gt", label: "Greater Than", description: "Greater than value" },
  { value: "ge", label: "Greater or Equal", description: "Greater than or equal" },
  { value: "in", label: "In List", description: "Value in comma-separated list" },
  { value: "not-in", label: "Not In List", description: "Value not in list" },
  { value: "missing", label: "Missing", description: "Field is missing (true/false)" },
];

export default function FHIRAdvancedSearch() {
  const [activeTab, setActiveTab] = useState("builder");
  const [selectedResourceType, setSelectedResourceType] = useState("Patient");
  const [conditions, setConditions] = useState<SearchCondition[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [resultCount, setResultCount] = useState(0);
  const [executionTime, setExecutionTime] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: resourceTypesData } = useQuery<{ resourceTypes: string[] }>({
    queryKey: ["/api/fhir-search/resource-types"],
  });

  const { data: parametersData } = useQuery<{ parameters: SearchParameter[] }>({
    queryKey: ["/api/fhir-search/parameters", selectedResourceType],
    queryFn: async () => {
      const res = await fetch(`/api/fhir-search/parameters/${selectedResourceType}`);
      return res.json();
    },
  });

  const { data: suggestionsData, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<{ suggestions: SearchSuggestion[] }>({
    queryKey: ["/api/fhir-search/ai-suggestions", selectedResourceType, conditions],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/fhir-search/ai-suggestions", {
        resourceType: selectedResourceType,
        conditions
      });
      return res.json();
    },
    enabled: false
  });

  const { data: savedQueriesData, refetch: refetchSavedQueries } = useQuery<{ queries: SavedQuery[] }>({
    queryKey: ["/api/fhir-search/saved-queries"],
  });

  const saveQueryMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; query: unknown }) => {
      return apiRequest("POST", "/api/fhir-search/saved-queries", data);
    },
    onSuccess: () => {
      refetchSavedQueries();
      toast({ title: "Query Saved", description: "Your search query has been saved." });
    }
  });

  const resourceTypes = resourceTypesData?.resourceTypes || ["Patient", "Observation", "Condition", "MedicationRequest", "Encounter"];
  const parameters = parametersData?.parameters || [];
  const suggestions = suggestionsData?.suggestions || [];
  const savedQueries = savedQueriesData?.queries || [];

  const addCondition = () => {
    const newCondition: SearchCondition = {
      id: `cond-${Date.now()}`,
      parameter: parameters[0]?.name || "name",
      operator: "eq",
      value: ""
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, field: keyof SearchCondition, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const executeSearch = async () => {
    setIsSearching(true);
    try {
      const query = {
        id: `query-${Date.now()}`,
        resourceType: selectedResourceType,
        conditions,
        limit: 50
      };
      const response = await apiRequest("POST", "/api/fhir-search/execute", query);
      const data = await response.json();
      setSearchResults(data.results || []);
      setResultCount(data.total || 0);
      setExecutionTime(data.executionTimeMs || 0);
    } catch (error) {
      toast({ title: "Search Error", description: "Failed to execute search", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const loadSavedQuery = (query: SavedQuery) => {
    setSelectedResourceType(query.query.resourceType);
    setConditions(query.query.conditions);
    toast({ title: "Query Loaded", description: `Loaded "${query.name}"` });
  };

  const applySuggestion = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "parameter") {
      const param = parameters.find(p => p.name === suggestion.suggestion);
      if (param) {
        setConditions(prev => [
          ...prev,
          {
            id: `cond-${Date.now()}`,
            parameter: suggestion.suggestion,
            operator: "eq" as SearchOperator,
            value: ""
          }
        ]);
      }
    }
    toast({ title: "Suggestion Applied", description: suggestion.suggestion });
  };

  const getOperatorColor = (op: SearchOperator) => {
    if (["fuzzy", "contains", "starts", "ends"].includes(op)) return "default";
    if (["lt", "le", "gt", "ge"].includes(op)) return "secondary";
    return "outline";
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-6">
        <Search className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">FHIR Advanced Search</h1>
          <p className="text-muted-foreground">Build complex queries with fuzzy matching, ranges, and AI suggestions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="builder" data-testid="tab-builder">
            <Filter className="h-4 w-4 mr-2" />Query Builder
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            <Database className="h-4 w-4 mr-2" />Results {resultCount > 0 && `(${resultCount})`}
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="tab-saved">
            <Clock className="h-4 w-4 mr-2" />Saved Queries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Search Query</span>
                    <div className="flex items-center gap-2">
                      <Select value={selectedResourceType} onValueChange={setSelectedResourceType}>
                        <SelectTrigger className="w-48" data-testid="select-resource-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {resourceTypes.map(rt => (
                            <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardTitle>
                  <CardDescription>Add conditions to filter {selectedResourceType} resources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {conditions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Filter className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No conditions added yet</p>
                        <p className="text-sm">Click "Add Condition" to start building your query</p>
                      </div>
                    ) : (
                      conditions.map((condition, index) => (
                        <div key={condition.id} className="flex items-center gap-2 p-3 rounded-lg border" data-testid={`condition-row-${index}`}>
                          {index > 0 && <Badge variant="outline" className="shrink-0">AND</Badge>}
                          <Select
                            value={condition.parameter}
                            onValueChange={(v) => updateCondition(condition.id, "parameter", v)}
                          >
                            <SelectTrigger className="w-40" data-testid={`select-parameter-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {parameters.map(p => (
                                <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={condition.operator}
                            onValueChange={(v) => updateCondition(condition.id, "operator", v as SearchOperator)}
                          >
                            <SelectTrigger className="w-36" data-testid={`select-operator-${index}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map(op => (
                                <SelectItem key={op.value} value={op.value}>
                                  {op.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            placeholder="Value..."
                            value={condition.value}
                            onChange={(e) => updateCondition(condition.id, "value", e.target.value)}
                            className="flex-1"
                            data-testid={`input-value-${index}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCondition(condition.id)}
                            data-testid={`button-remove-condition-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <Button variant="outline" onClick={addCondition} data-testid="button-add-condition">
                      <Plus className="h-4 w-4 mr-2" />Add Condition
                    </Button>
                    <Button
                      onClick={executeSearch}
                      disabled={isSearching}
                      data-testid="button-execute-search"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {isSearching ? "Searching..." : "Execute Search"}
                    </Button>
                    {conditions.length > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const name = prompt("Enter a name for this query:");
                          if (name) {
                            saveQueryMutation.mutate({
                              name,
                              description: "",
                              query: { id: `q-${Date.now()}`, resourceType: selectedResourceType, conditions }
                            });
                          }
                        }}
                        data-testid="button-save-query"
                      >
                        <Save className="h-4 w-4 mr-2" />Save Query
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {conditions.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Query Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="p-3 rounded-lg bg-muted font-mono text-sm">
                      <span className="text-primary">{selectedResourceType}</span>
                      {conditions.map((c, i) => (
                        <span key={c.id}>
                          {i === 0 ? "?" : "&"}
                          <span className="text-blue-500">{c.parameter}</span>
                          <span className="text-orange-500">:{c.operator}</span>
                          =<span className="text-green-500">"{c.value}"</span>
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />AI Suggestions
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refetchSuggestions()}
                      disabled={suggestionsLoading}
                      data-testid="button-refresh-suggestions"
                    >
                      <RefreshCw className={`h-4 w-4 ${suggestionsLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </CardTitle>
                  <CardDescription>Intelligent parameter recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  {suggestionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Brain className="h-8 w-8 animate-pulse text-primary" />
                    </div>
                  ) : suggestions.length > 0 ? (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {suggestions.map(suggestion => (
                          <div
                            key={suggestion.id}
                            className="p-3 rounded-lg border hover-elevate cursor-pointer"
                            {...clickable(() => applySuggestion(suggestion))}
                            data-testid={`suggestion-${suggestion.id}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{suggestion.suggestion}</span>
                              <Badge variant="outline">{suggestion.confidence}%</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                            {suggestion.example && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">{suggestion.example}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click refresh to get AI suggestions</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Available Parameters</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {parameters.slice(0, 12).map(param => (
                        <div
                          key={param.id}
                          className="flex items-center justify-between p-2 rounded hover-elevate cursor-pointer text-sm"
                          {...clickable(() => {
                            const newCond: SearchCondition = {
                              id: `cond-${Date.now()}`,
                              parameter: param.name,
                              operator: "eq",
                              value: ""
                            };
                            setConditions([...conditions, newCond]);
                          })}
                          data-testid={`param-${param.name}`}
                        >
                          <span className="font-medium">{param.name}</span>
                          <Badge variant="secondary" className="text-xs">{param.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Search Results</CardTitle>
                  <CardDescription>
                    {resultCount} results found in {executionTime}ms
                  </CardDescription>
                </div>
                {resultCount > 0 && (
                  <Button variant="outline" size="icon" data-testid="button-copy-results">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {searchResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results yet</p>
                  <p className="text-sm">Execute a search to see results here</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3">
                    {searchResults.map((result, index) => (
                      <Card key={result.id} data-testid={`result-card-${index}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="default">{result.resourceType}</Badge>
                                <span className="font-mono text-sm">{result.id}</span>
                                {result.score && (
                                  <Badge variant="outline">Score: {(result.score * 100).toFixed(0)}%</Badge>
                                )}
                              </div>
                              {result.matchedFields && result.matchedFields.length > 0 && (
                                <div className="flex gap-1 mb-2">
                                  <span className="text-xs text-muted-foreground">Matched:</span>
                                  {result.matchedFields.map(field => (
                                    <Badge key={field} variant="secondary" className="text-xs">{field}</Badge>
                                  ))}
                                </div>
                              )}
                              <pre className="text-xs p-2 rounded bg-muted overflow-x-auto max-h-32">
                                {JSON.stringify(result.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved">
          <Card>
            <CardHeader>
              <CardTitle>Saved Queries</CardTitle>
              <CardDescription>Reuse your frequently used search queries</CardDescription>
            </CardHeader>
            <CardContent>
              {savedQueries.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No saved queries yet</p>
                  <p className="text-sm">Save a query from the builder to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedQueries.map(query => (
                    <Card
                      key={query.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => loadSavedQuery(query)}
                      data-testid={`saved-query-${query.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{query.name}</span>
                          <Badge variant="outline">{query.query.resourceType}</Badge>
                        </div>
                        {query.description && (
                          <p className="text-sm text-muted-foreground mb-2">{query.description}</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{query.query.conditions.length} conditions</span>
                          <span>{query.usageCount} uses</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
