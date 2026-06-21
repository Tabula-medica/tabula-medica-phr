import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Users,
  FileText,
  Download,
  Filter,
  Search,
  Activity,
  Heart,
  Pill,
  Brain,
  Shield,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

type ResearchCategory = 
  | "treatment_outcomes"
  | "late_effects"
  | "adherence_rates"
  | "quality_of_life"
  | "survival_rates"
  | "demographics"
  | "treatment_regimens"
  | "symptom_prevalence";

interface CategoryInfo {
  id: ResearchCategory;
  title: string;
  description: string;
}

interface AggregatedResult {
  category: ResearchCategory;
  totalPatients: number;
  consentedPatients: number;
  metrics: Record<string, any>;
  breakdown?: Record<string, any>;
  generatedAt: string;
  disclaimer: string;
}

interface FilterOptions {
  cancerTypes: string[];
  treatmentRegimens: string[];
  ageRanges: string[];
  stages: string[];
  genders: string[];
  treatmentPhases: string[];
}

const categoryIcons: Record<ResearchCategory, any> = {
  treatment_outcomes: TrendingUp,
  late_effects: AlertTriangle,
  adherence_rates: CheckCircle,
  quality_of_life: Heart,
  survival_rates: Activity,
  demographics: Users,
  treatment_regimens: Pill,
  symptom_prevalence: Brain,
};

const categoryColors: Record<ResearchCategory, string> = {
  treatment_outcomes: "text-green-500",
  late_effects: "text-orange-500",
  adherence_rates: "text-blue-500",
  quality_of_life: "text-pink-500",
  survival_rates: "text-purple-500",
  demographics: "text-cyan-500",
  treatment_regimens: "text-indigo-500",
  symptom_prevalence: "text-amber-500",
};

function MetricCard({ 
  label, 
  value, 
  format = "number",
  trend,
}: { 
  label: string; 
  value: number | string; 
  format?: "number" | "percent" | "months";
  trend?: "up" | "down" | "neutral";
}) {
  const formatValue = () => {
    if (typeof value === "string") return value;
    switch (format) {
      case "percent":
        return `${(value * 100).toFixed(1)}%`;
      case "months":
        return `${value} mo`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <div className="p-4 rounded-lg bg-muted/50">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className="text-2xl font-bold flex items-center gap-2">
        {formatValue()}
        {trend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
        {trend === "down" && <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />}
      </div>
    </div>
  );
}

function BreakdownChart({ 
  data, 
  title,
  valueKey = "responseRate",
  valueFormat = "percent",
}: { 
  data: Record<string, any>; 
  title: string;
  valueKey?: string;
  valueFormat?: "percent" | "number";
}) {
  const entries = Object.entries(data);
  const maxValue = Math.max(...entries.map(([_, v]) => 
    typeof v === "object" ? (v[valueKey] || v.n || 0) : v
  ));

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm">{title}</h4>
      {entries.map(([key, value]) => {
        const numValue = typeof value === "object" ? (value[valueKey] || 0) : value;
        const count = typeof value === "object" ? value.n : undefined;
        const percentage = maxValue > 0 ? (numValue / maxValue) * 100 : 0;
        
        return (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{key}</span>
              <span className="font-medium">
                {valueFormat === "percent" 
                  ? `${(numValue * 100).toFixed(1)}%` 
                  : numValue.toLocaleString()}
                {count !== undefined && <span className="text-muted-foreground ml-1">(n={count})</span>}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
          </div>
        );
      })}
    </div>
  );
}

function CategoryResultCard({ result }: { result: AggregatedResult }) {
  const Icon = categoryIcons[result.category] || BarChart3;
  const colorClass = categoryColors[result.category] || "text-primary";

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Icon className={`w-5 h-5 ${colorClass}`} />
            {result.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {result.consentedPatients.toLocaleString()} consented
            </Badge>
            <Badge variant="outline">
              {result.totalPatients.toLocaleString()} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(result.metrics).slice(0, 4).map(([key, value]) => (
            <MetricCard 
              key={key}
              label={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
              value={typeof value === "object" ? JSON.stringify(value) : value}
              format={typeof value === "number" && value < 1 ? "percent" : "number"}
            />
          ))}
        </div>

        {result.breakdown && Object.keys(result.breakdown).length > 0 && (
          <>
            <Separator />
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(result.breakdown).slice(0, 2).map(([key, data]) => (
                <BreakdownChart 
                  key={key}
                  title={key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                  data={data as Record<string, any>}
                />
              ))}
            </div>
          </>
        )}

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {result.disclaimer}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function QueryBuilder({
  categories,
  selectedCategories,
  onCategoriesChange,
  filters,
  selectedFilters,
  onFiltersChange,
  onQuery,
  isLoading,
}: {
  categories: CategoryInfo[];
  selectedCategories: ResearchCategory[];
  onCategoriesChange: (cats: ResearchCategory[]) => void;
  filters: FilterOptions | null;
  selectedFilters: Record<string, string[]>;
  onFiltersChange: (filters: Record<string, string[]>) => void;
  onQuery: () => void;
  isLoading: boolean;
}) {
  const toggleCategory = (cat: ResearchCategory) => {
    if (selectedCategories.includes(cat)) {
      onCategoriesChange(selectedCategories.filter(c => c !== cat));
    } else {
      onCategoriesChange([...selectedCategories, cat]);
    }
  };

  const toggleFilter = (filterKey: string, value: string) => {
    const current = selectedFilters[filterKey] || [];
    if (current.includes(value)) {
      onFiltersChange({
        ...selectedFilters,
        [filterKey]: current.filter(v => v !== value),
      });
    } else {
      onFiltersChange({
        ...selectedFilters,
        [filterKey]: [...current, value],
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="w-5 h-5" />
          Query Builder
        </CardTitle>
        <CardDescription>
          Select data categories and apply filters to query aggregated research data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-3">Data Categories</h4>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2">
            {categories.map(cat => {
              const Icon = categoryIcons[cat.id] || BarChart3;
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors min-h-[44px] ${
                    isSelected 
                      ? "bg-primary/10 border-primary" 
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  }`}
                  data-testid={`category-${cat.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={isSelected} 
                      className="pointer-events-none"
                    />
                    <Icon className={`w-4 h-4 ${categoryColors[cat.id]}`} />
                    <span className="text-sm font-medium">{cat.title}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {filters && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h5 className="text-sm text-muted-foreground mb-2">Cancer Types</h5>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {filters.cancerTypes.map(type => (
                      <div key={type} className="flex items-center gap-2 min-h-[44px]" data-testid={`filter-cancer-${type.replace(/\s+/g, "-").toLowerCase()}`}>
                        <Checkbox
                          id={`cancer-${type}`}
                          checked={(selectedFilters.cancerTypes || []).includes(type)}
                          onCheckedChange={() => toggleFilter("cancerTypes", type)}
                          className="w-5 h-5"
                          data-testid={`checkbox-cancer-${type.replace(/\s+/g, "-").toLowerCase()}`}
                        />
                        <label htmlFor={`cancer-${type}`} className="text-sm cursor-pointer flex-1">
                          {type}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <h5 className="text-sm text-muted-foreground mb-2">Treatment Regimens</h5>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {filters.treatmentRegimens.map(regimen => (
                      <div key={regimen} className="flex items-center gap-2 min-h-[44px]" data-testid={`filter-regimen-${regimen.replace(/\s+/g, "-").toLowerCase()}`}>
                        <Checkbox
                          id={`regimen-${regimen}`}
                          checked={(selectedFilters.treatmentRegimens || []).includes(regimen)}
                          onCheckedChange={() => toggleFilter("treatmentRegimens", regimen)}
                          className="w-5 h-5"
                          data-testid={`checkbox-regimen-${regimen.replace(/\s+/g, "-").toLowerCase()}`}
                        />
                        <label htmlFor={`regimen-${regimen}`} className="text-sm cursor-pointer flex-1">
                          {regimen}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <h5 className="text-sm text-muted-foreground mb-2">Demographics</h5>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Age Ranges</span>
                    <div className="flex flex-wrap gap-1">
                      {filters.ageRanges.map(age => (
                        <Badge
                          key={age}
                          variant={(selectedFilters.ageRanges || []).includes(age) ? "default" : "outline"}
                          className="cursor-pointer min-h-[44px] px-4"
                          onClick={() => toggleFilter("ageRanges", age)}
                          data-testid={`filter-age-${age}`}
                        >
                          {age}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">Stages</span>
                    <div className="flex flex-wrap gap-1">
                      {filters.stages.map(stage => (
                        <Badge
                          key={stage}
                          variant={(selectedFilters.stages || []).includes(stage) ? "default" : "outline"}
                          className="cursor-pointer min-h-[44px] px-4"
                          onClick={() => toggleFilter("stages", stage)}
                          data-testid={`filter-stage-${stage}`}
                        >
                          {stage}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedCategories.length} categories selected
          </div>
          <Button
            onClick={onQuery}
            disabled={selectedCategories.length === 0 || isLoading}
            className="min-h-[44px]"
            data-testid="button-run-query"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Querying...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Run Query
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickStatsOverview({ data }: { data: any }) {
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Research Data Overview
        </CardTitle>
        <CardDescription>
          Summary of available anonymized research data with patient consent
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.categorySummary?.map((cat: any) => {
            const Icon = categoryIcons[cat.category as ResearchCategory] || BarChart3;
            const colorClass = categoryColors[cat.category as ResearchCategory] || "text-primary";
            return (
              <div key={cat.category} className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${colorClass}`} />
                  <span className="text-sm font-medium">{cat.title}</span>
                </div>
                <div className="text-2xl font-bold">{cat.consentedPatients}</div>
                <div className="text-xs text-muted-foreground">consented patients</div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {data.disclaimer || "Patient counts reflect those who have explicitly opted in to share their data for research purposes."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProviderResearchPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedCategories, setSelectedCategories] = useState<ResearchCategory[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});
  const [queryResults, setQueryResults] = useState<AggregatedResult[] | null>(null);

  const { data: categories } = useQuery<{ data: CategoryInfo[] }>({
    queryKey: ["/api/research/categories"],
  });

  const { data: quickStats, isLoading: statsLoading } = useQuery<{ data: any }>({
    queryKey: ["/api/research/provider/quick-stats"],
  });

  const { data: filterOptions } = useQuery<{ data: FilterOptions }>({
    queryKey: ["/api/research/provider/filters"],
  });

  const queryMutation = useMutation({
    mutationFn: async (query: { categories: ResearchCategory[]; filters: Record<string, string[]> }) => {
      const res = await apiRequest("POST", "/api/research/provider/query", {
        categories: query.categories,
        filters: {
          cancerTypes: query.filters.cancerTypes,
          treatmentRegimens: query.filters.treatmentRegimens,
          ageRanges: query.filters.ageRanges,
          stages: query.filters.stages,
        },
      });
      return res.json();
    },
    onSuccess: (data) => {
      setQueryResults(data.data);
      toast({
        title: "Query Complete",
        description: `Retrieved data for ${data.data.length} categories.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Query Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "json" | "csv") => {
      const cats = selectedCategories.length > 0 
        ? selectedCategories.join(",") 
        : undefined;
      const res = await apiRequest(
        "GET", 
        `/api/research/provider/export/${format}${cats ? `?categories=${cats}` : ""}`
      );
      return { data: await res.text(), format };
    },
    onSuccess: ({ data, format }) => {
      const blob = new Blob([data], { 
        type: format === "json" ? "application/json" : "text/csv" 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `research_data_${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "Export Complete",
        description: `Data exported as ${format.toUpperCase()}.`,
      });
    },
  });

  const handleRunQuery = () => {
    if (selectedCategories.length === 0) {
      toast({
        title: "No Categories Selected",
        description: "Please select at least one data category.",
        variant: "destructive",
      });
      return;
    }
    queryMutation.mutate({ categories: selectedCategories, filters: selectedFilters });
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-muted-foreground">Loading research portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Research Data Portal
          </h1>
          <p className="text-muted-foreground">
            Access anonymized and aggregated patient data for clinical insights
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate("csv")}
            disabled={exportMutation.isPending}
            className="min-h-[44px]"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => exportMutation.mutate("json")}
            disabled={exportMutation.isPending}
            className="min-h-[44px]"
            data-testid="button-export-json"
          >
            <FileText className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Data Protection Notice</AlertTitle>
        <AlertDescription>
          All data displayed is anonymized and aggregated. Individual patient identification is not possible.
          Only data from patients who have explicitly consented to research use is included.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="min-h-[44px]" data-testid="tab-overview">
            Overview
          </TabsTrigger>
          <TabsTrigger value="query" className="min-h-[44px]" data-testid="tab-query">
            Query Builder
          </TabsTrigger>
          <TabsTrigger value="results" className="min-h-[44px]" data-testid="tab-results">
            Results {queryResults && `(${queryResults.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          <QuickStatsOverview data={quickStats?.data} />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Available Research Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {categories?.data?.map(cat => {
                  const Icon = categoryIcons[cat.id] || BarChart3;
                  return (
                    <div key={cat.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                      <Icon className={`w-5 h-5 mt-0.5 ${categoryColors[cat.id]}`} />
                      <div>
                        <div className="font-medium">{cat.title}</div>
                        <div className="text-sm text-muted-foreground">{cat.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="query" className="mt-6">
          <QueryBuilder
            categories={categories?.data || []}
            selectedCategories={selectedCategories}
            onCategoriesChange={setSelectedCategories}
            filters={filterOptions?.data || null}
            selectedFilters={selectedFilters}
            onFiltersChange={setSelectedFilters}
            onQuery={handleRunQuery}
            isLoading={queryMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          {queryResults ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Query Results ({queryResults.length} categories)
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("query")}
                  className="min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Query
                </Button>
              </div>
              {queryResults.map(result => (
                <CategoryResultCard key={result.category} result={result} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Use the Query Builder to search aggregated research data.
                </p>
                <Button onClick={() => setActiveTab("query")} className="min-h-[44px]">
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Go to Query Builder
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
