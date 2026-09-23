import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Search, Mic, MicOff, Filter, Clock, User, 
  Pill, Activity, Heart, FileText, AlertCircle,
  Calendar, ChevronDown, ChevronRight, Loader2,
  Languages, X, History, Stethoscope, FlaskConical,
} from "lucide-react";
import type { SearchResult, SearchableDataType, UniversalSearchResponse, SearchQuery } from "@shared/schema";
import { PageHeader, LoadingState } from "@/components/shared";

const DATA_TYPE_ICONS: Record<SearchableDataType, React.ReactNode> = {
  conditions: <Heart className="h-4 w-4" />,
  medications: <Pill className="h-4 w-4" />,
  prescriptions: <FileText className="h-4 w-4" />,
  lab_results: <FlaskConical className="h-4 w-4" />,
  vitals: <Activity className="h-4 w-4" />,
  allergies: <AlertCircle className="h-4 w-4" />,
  immunizations: <Stethoscope className="h-4 w-4" />,
  procedures: <Stethoscope className="h-4 w-4" />,
  documents: <FileText className="h-4 w-4" />,
  telehealth_notes: <FileText className="h-4 w-4" />,
  triage_assessments: <AlertCircle className="h-4 w-4" />,
  family_history: <User className="h-4 w-4" />,
  appointments: <Calendar className="h-4 w-4" />,
};

const DATA_TYPE_LABELS: Record<SearchableDataType, string> = {
  conditions: "Conditions",
  medications: "Medications",
  prescriptions: "Prescriptions",
  lab_results: "Lab Results",
  vitals: "Vitals",
  allergies: "Allergies",
  immunizations: "Immunizations",
  procedures: "Procedures",
  documents: "Documents",
  telehealth_notes: "Telehealth Notes",
  triage_assessments: "Triage Assessments",
  family_history: "Family History",
  appointments: "Appointments",
};

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "zh", name: "Chinese" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
];

export default function UniversalSearchPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("en");
  const [isRecording, setIsRecording] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDataTypes, setSelectedDataTypes] = useState<SearchableDataType[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchResults, setSearchResults] = useState<UniversalSearchResponse | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const { data: recentSearches } = useQuery<SearchQuery[]>({
    queryKey: ["/api/search/history"],
  });

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await apiRequest("POST", "/api/search", {
        query: searchQuery,
        filters: {
          dataTypes: selectedDataTypes.length > 0 ? selectedDataTypes : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        queryLanguage: selectedLanguage,
        isVoiceQuery: false,
      });
      return response.json() as Promise<UniversalSearchResponse>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: () => {
      toast({ title: "Search Failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const voiceSearchMutation = useMutation({
    mutationFn: async (audioBase64: string) => {
      const response = await apiRequest("POST", "/api/search/voice", {
        audioBase64,
        language: selectedLanguage,
      });
      return response.json() as Promise<UniversalSearchResponse & { transcription: string }>;
    },
    onSuccess: (data) => {
      setQuery(data.transcription);
      setSearchResults(data);
    },
    onError: () => {
      toast({ title: "Voice Search Failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    searchMutation.mutate(query);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(",")[1];
          voiceSearchMutation.mutate(base64);
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      toast({ title: "Microphone Access", description: "Please allow microphone access.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const toggleDataType = (dataType: SearchableDataType) => {
    setSelectedDataTypes((prev) =>
      prev.includes(dataType)
        ? prev.filter((t) => t !== dataType)
        : [...prev, dataType]
    );
  };

  const clearFilters = () => {
    setSelectedDataTypes([]);
    setDateFrom("");
    setDateTo("");
  };

  const useRecentSearch = (search: SearchQuery) => {
    setQuery(search.query);
    searchMutation.mutate(search.query);
  };

  const getResultTypeColor = (dataType: SearchableDataType): string => {
    const colors: Record<string, string> = {
      conditions: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
      medications: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      lab_results: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
      allergies: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
      vitals: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      telehealth_notes: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
      triage_assessments: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
    };
    return colors[dataType] || "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <PageHeader
          title="Universal Search"
          subtitle="Search across all patient data using natural language or voice"
          data-testid="text-page-title"
        />
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search for conditions, medications, lab results... (e.g., 'Show me all diabetes-related records')"
                  className="pl-10 pr-4"
                  data-testid="input-search"
                />
              </div>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-40" data-testid="select-language">
                  <Languages className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={isRecording ? "destructive" : "secondary"}
                size="icon"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={voiceSearchMutation.isPending}
                data-testid="button-voice-search"
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
                {selectedDataTypes.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{selectedDataTypes.length}</Badge>
                )}
              </Button>
              <Button 
                type="submit" 
                disabled={searchMutation.isPending || !query.trim()}
                data-testid="button-search"
              >
                {searchMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            <Collapsible open={showFilters}>
              <CollapsibleContent className="pt-4 border-t">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <FieldCaption>Filter by Data Type</FieldCaption>
                    {(selectedDataTypes.length > 0 || dateFrom || dateTo) && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {(Object.keys(DATA_TYPE_LABELS) as SearchableDataType[]).map((dataType) => (
                      <div role="presentation"
                        key={dataType}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedDataTypes.includes(dataType)
                            ? "border-primary bg-primary/10"
                            : "border-transparent hover:bg-muted"
                        }`}
                        onClick={() => toggleDataType(dataType)}
                        data-testid={`filter-${dataType}`}
                      >
                        <Checkbox
                          checked={selectedDataTypes.includes(dataType)}
                          onCheckedChange={() => toggleDataType(dataType)}
                        />
                        {DATA_TYPE_ICONS[dataType]}
                        <span className="text-sm">{DATA_TYPE_LABELS[dataType]}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="universal-search-from-date">From Date</Label>
                      <Input id="universal-search-from-date"
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        data-testid="input-date-from"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="universal-search-to-date">To Date</Label>
                      <Input id="universal-search-to-date"
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        data-testid="input-date-to"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </form>
        </CardContent>
      </Card>

      {isRecording && (
        <Card className="mb-6 border-red-500 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4 flex items-center justify-center gap-4">
            <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-700 dark:text-red-400 font-medium">Recording... Speak your search query</span>
            <Button variant="destructive" size="sm" onClick={stopRecording}>
              Stop
            </Button>
          </CardContent>
        </Card>
      )}

      {voiceSearchMutation.isPending && (
        <div className="mb-6">
          <LoadingState message="Transcribing and searching..." />
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-3">
          {searchResults ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {searchResults.totalResults} Result{searchResults.totalResults !== 1 ? "s" : ""}
                  </h2>
                  {searchResults.interpretedQuery !== searchResults.query && (
                    <p className="text-sm text-muted-foreground">
                      Interpreted as: "{searchResults.interpretedQuery}"
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {searchResults.executionTimeMs}ms
                </span>
              </div>

              {searchResults.results.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">No Results Found</h3>
                    <p className="text-muted-foreground mb-4">
                      Try different keywords or adjust your filters.
                    </p>
                    {searchResults.suggestions.length > 0 && (
                      <div className="text-sm">
                        <p className="text-muted-foreground mb-2">Suggestions:</p>
                        <ul className="list-disc list-inside text-left max-w-md mx-auto">
                          {searchResults.suggestions.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {searchResults.results.map((result) => (
                    <Card key={result.id} className="hover-elevate" data-testid={`card-result-${result.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${getResultTypeColor(result.dataType)}`}>
                              {DATA_TYPE_ICONS[result.dataType]}
                            </div>
                            <div>
                              <CardTitle className="text-base" data-testid={`text-result-title-${result.id}`}>
                                {result.title}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <User className="h-3 w-3" />
                                {result.patientName}
                                {result.provider && (
                                  <>
                                    <Separator orientation="vertical" className="h-3" />
                                    {result.provider}
                                  </>
                                )}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className={getResultTypeColor(result.dataType)}>
                            {DATA_TYPE_LABELS[result.dataType]}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">{result.summary}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(result.date).toLocaleDateString()}
                          </span>
                          <span>Relevance: {result.relevanceScore}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchResults.facets.dataTypes.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Results by Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.facets.dataTypes.map((facet) => (
                        <Badge key={facet.type} variant="secondary">
                          {DATA_TYPE_LABELS[facet.type as SearchableDataType]} ({facet.count})
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card data-testid="card-search-placeholder">
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Search Patient Data</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Use natural language to search across conditions, medications, lab results, 
                  telehealth notes, and more. Try voice search for hands-free queries in any language.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {recentSearches && recentSearches.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Recent Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentSearches.slice(0, 5).map((search) => (
                    <Button
                      key={search.id}
                      variant="ghost"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => useRecentSearch(search)}
                      data-testid={`button-recent-search-${search.id}`}
                    >
                      <div className="truncate">
                        <p className="text-sm truncate">{search.query}</p>
                        <p className="text-xs text-muted-foreground">
                          {search.resultsCount} results - {new Date(search.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Search Tips</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Use natural language like:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>"Show me all diabetes medications"</li>
                <li>"Lab results from last month"</li>
                <li>"Patients with heart conditions"</li>
                <li>"Recent telehealth notes about pain"</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
