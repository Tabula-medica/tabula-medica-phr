import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Link } from "wouter";
import {
  Search,
  Filter,
  FileText,
  Calendar,
  User,
  Pill,
  Stethoscope,
  Building2,
  Tag,
  ChevronDown,
  ChevronRight,
  X,
  ArrowLeft,
  Download,
  Eye,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";
import type { AutoTagCategory } from "@shared/schema";

interface SearchFilters {
  query: string;
  contentSearch: boolean;
  dateFrom: string;
  dateTo: string;
  documentTypes: AutoTagCategory[];
  profiles: string[];
  extractedPatientName: string;
  extractedDiagnosis: string;
  extractedMedication: string;
  facility: string;
  provider: string;
}

interface SearchResult {
  id: string;
  title: string;
  category: AutoTagCategory;
  date: string;
  profile?: string;
  facility?: string;
  provider?: string;
  matchScore: number;
  matchedIn: ("title" | "content" | "extracted" | "tags")[];
  snippet: string;
  highlights: string[];
  extractedData?: {
    patientName?: string;
    diagnoses?: string[];
    medications?: string[];
    labResults?: number;
  };
}

const CATEGORY_CONFIG: Record<AutoTagCategory, { label: string; icon: typeof FileText; color: string }> = {
  discharge_summary: { label: "Discharge Summary", icon: FileText, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  lab: { label: "Lab Results", icon: Stethoscope, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  imaging: { label: "Imaging", icon: FileText, color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  referral: { label: "Referral", icon: User, color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  insurance: { label: "Insurance", icon: FileText, color: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300" },
  other: { label: "Other", icon: FileText, color: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300" },
};

const SAMPLE_PROFILES = [
  { id: "self", name: "Self" },
  { id: "child-1", name: "Alex (Child)" },
  { id: "parent-1", name: "Mom (Elder)" },
];

function generateSampleResults(filters: SearchFilters): SearchResult[] {
  const sampleResults: SearchResult[] = [
    {
      id: "doc-1",
      title: "Annual Physical Exam - January 2026",
      category: "discharge_summary",
      date: "2026-01-20",
      profile: "Self",
      facility: "City Medical Center",
      provider: "Dr. Sarah Smith",
      matchScore: 0.95,
      matchedIn: ["title", "content"],
      snippet: "...comprehensive physical examination including blood pressure measurement, heart rate check, and routine blood work...",
      highlights: ["blood pressure", "heart rate", "blood work"],
      extractedData: { patientName: "John Doe", diagnoses: ["Hypertension", "Pre-diabetes"], medications: ["Lisinopril", "Metformin"], labResults: 5 },
    },
    {
      id: "doc-2",
      title: "Lipid Panel Results",
      category: "lab",
      date: "2026-01-15",
      profile: "Self",
      facility: "Quest Diagnostics",
      provider: "Dr. Sarah Smith",
      matchScore: 0.88,
      matchedIn: ["content", "extracted"],
      snippet: "...LDL cholesterol: 125 mg/dL (borderline high), HDL cholesterol: 52 mg/dL (normal), Total cholesterol: 210 mg/dL...",
      highlights: ["LDL cholesterol", "HDL cholesterol"],
      extractedData: { patientName: "John Doe", labResults: 8 },
    },
    {
      id: "doc-3",
      title: "Cardiology Consultation",
      category: "referral",
      date: "2026-01-10",
      profile: "Self",
      facility: "Heart Care Specialists",
      provider: "Dr. Michael Williams",
      matchScore: 0.82,
      matchedIn: ["title", "content"],
      snippet: "...follow-up for elevated blood pressure readings. ECG shows normal sinus rhythm. Recommend continued monitoring...",
      highlights: ["blood pressure", "ECG", "normal sinus rhythm"],
      extractedData: { diagnoses: ["Essential hypertension"], medications: ["Lisinopril 10mg"] },
    },
    {
      id: "doc-4",
      title: "Pediatric Well-Child Visit",
      category: "other",
      date: "2026-01-08",
      profile: "Alex (Child)",
      facility: "Pediatric Associates",
      provider: "Dr. Emily Chen",
      matchScore: 0.75,
      matchedIn: ["title"],
      snippet: "...routine wellness checkup for 8-year-old. Growth percentiles normal. Immunizations up to date...",
      highlights: ["wellness checkup", "growth percentiles", "immunizations"],
      extractedData: { patientName: "Alex Doe" },
    },
    {
      id: "doc-5",
      title: "Metformin Prescription",
      category: "other",
      date: "2026-01-05",
      profile: "Self",
      facility: "City Medical Center",
      provider: "Dr. Sarah Smith",
      matchScore: 0.92,
      matchedIn: ["extracted", "tags"],
      snippet: "...Metformin 500mg twice daily for management of pre-diabetes. Take with meals to reduce GI side effects...",
      highlights: ["Metformin", "pre-diabetes"],
      extractedData: { medications: ["Metformin 500mg"] },
    },
    {
      id: "doc-6",
      title: "Senior Wellness Assessment",
      category: "discharge_summary",
      date: "2025-12-28",
      profile: "Mom (Elder)",
      facility: "Geriatric Care Clinic",
      provider: "Dr. Robert Taylor",
      matchScore: 0.70,
      matchedIn: ["title", "content"],
      snippet: "...annual geriatric assessment. Cognitive screening normal. Balance and mobility evaluation completed...",
      highlights: ["cognitive screening", "balance", "mobility"],
      extractedData: { patientName: "Jane Doe", diagnoses: ["Osteoarthritis", "Mild hearing loss"] },
    },
  ];

  let results = [...sampleResults];

  if (filters.query) {
    const query = filters.query.toLowerCase();
    results = results.filter(r => 
      r.title.toLowerCase().includes(query) ||
      r.snippet.toLowerCase().includes(query) ||
      r.extractedData?.diagnoses?.some(d => d.toLowerCase().includes(query)) ||
      r.extractedData?.medications?.some(m => m.toLowerCase().includes(query))
    );
  }

  if (filters.documentTypes.length > 0) {
    results = results.filter(r => filters.documentTypes.includes(r.category));
  }

  if (filters.profiles.length > 0) {
    results = results.filter(r => filters.profiles.some(p => 
      SAMPLE_PROFILES.find(sp => sp.id === p)?.name === r.profile
    ));
  }

  if (filters.dateFrom) {
    results = results.filter(r => r.date >= filters.dateFrom);
  }

  if (filters.dateTo) {
    results = results.filter(r => r.date <= filters.dateTo);
  }

  if (filters.facility) {
    results = results.filter(r => r.facility?.toLowerCase().includes(filters.facility.toLowerCase()));
  }

  if (filters.provider) {
    results = results.filter(r => r.provider?.toLowerCase().includes(filters.provider.toLowerCase()));
  }

  if (filters.extractedDiagnosis) {
    results = results.filter(r => 
      r.extractedData?.diagnoses?.some(d => d.toLowerCase().includes(filters.extractedDiagnosis.toLowerCase()))
    );
  }

  if (filters.extractedMedication) {
    results = results.filter(r => 
      r.extractedData?.medications?.some(m => m.toLowerCase().includes(filters.extractedMedication.toLowerCase()))
    );
  }

  return results.sort((a, b) => b.matchScore - a.matchScore);
}

export default function DocumentSearch() {
  const [filters, setFilters] = useState<SearchFilters>({
    query: "",
    contentSearch: true,
    dateFrom: "",
    dateTo: "",
    documentTypes: [],
    profiles: [],
    extractedPatientName: "",
    extractedDiagnosis: "",
    extractedMedication: "",
    facility: "",
    provider: "",
  });
  
  const [showFilters, setShowFilters] = useState(true);
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    return generateSampleResults(filters);
  }, [filters]);

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 500);
  };

  const handleClearFilters = () => {
    setFilters({
      query: "",
      contentSearch: true,
      dateFrom: "",
      dateTo: "",
      documentTypes: [],
      profiles: [],
      extractedPatientName: "",
      extractedDiagnosis: "",
      extractedMedication: "",
      facility: "",
      provider: "",
    });
  };

  const activeFilterCount = [
    filters.dateFrom,
    filters.dateTo,
    filters.documentTypes.length > 0,
    filters.profiles.length > 0,
    filters.extractedDiagnosis,
    filters.extractedMedication,
    filters.facility,
    filters.provider,
  ].filter(Boolean).length;

  const toggleDocumentType = (type: AutoTagCategory) => {
    setFilters(prev => ({
      ...prev,
      documentTypes: prev.documentTypes.includes(type)
        ? prev.documentTypes.filter(t => t !== type)
        : [...prev.documentTypes, type],
    }));
  };

  const toggleProfile = (profileId: string) => {
    setFilters(prev => ({
      ...prev,
      profiles: prev.profiles.includes(profileId)
        ? prev.profiles.filter(p => p !== profileId)
        : [...prev.profiles, profileId],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild data-testid="button-back">
            <Link href="/documents">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Advanced Document Search
            </h1>
            <p className="text-sm text-muted-foreground">Search by content, extracted data, and metadata</p>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto p-4">
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary">{activeFilterCount} active</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="search-query">Search Query</Label>
                  <div className="flex gap-2">
                    <Input
                      id="search-query"
                      placeholder="Search documents..."
                      value={filters.query}
                      onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                      className="min-h-[44px]"
                      data-testid="input-search"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="content-search"
                      checked={filters.contentSearch}
                      onCheckedChange={(checked) => setFilters(prev => ({ ...prev, contentSearch: !!checked }))}
                      data-testid="checkbox-content-search"
                    />
                    <label htmlFor="content-search" className="text-sm">Search within document content</label>
                  </div>
                </div>

                <Separator />

                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium min-h-[44px] p-2 hover-elevate rounded-md">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Date Range
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="date-from" className="text-xs">From</Label>
                        <Input
                          id="date-from"
                          type="date"
                          value={filters.dateFrom}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                          className="min-h-[44px]"
                          data-testid="input-date-from"
                        />
                      </div>
                      <div>
                        <Label htmlFor="date-to" className="text-xs">To</Label>
                        <Input
                          id="date-to"
                          type="date"
                          value={filters.dateTo}
                          onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                          className="min-h-[44px]"
                          data-testid="input-date-to"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium min-h-[44px] p-2 hover-elevate rounded-md">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Document Type
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-2">
                        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`type-${key}`}
                              checked={filters.documentTypes.includes(key as AutoTagCategory)}
                              onCheckedChange={() => toggleDocumentType(key as AutoTagCategory)}
                              data-testid={`checkbox-type-${key}`}
                            />
                            <label htmlFor={`type-${key}`} className="text-sm flex items-center gap-2">
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium min-h-[44px] p-2 hover-elevate rounded-md">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Profile
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    {SAMPLE_PROFILES.map((profile) => (
                      <div key={profile.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`profile-${profile.id}`}
                          checked={filters.profiles.includes(profile.id)}
                          onCheckedChange={() => toggleProfile(profile.id)}
                          data-testid={`checkbox-profile-${profile.id}`}
                        />
                        <label htmlFor={`profile-${profile.id}`} className="text-sm">{profile.name}</label>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium min-h-[44px] p-2 hover-elevate rounded-md">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Extracted Data
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-3">
                    <div>
                      <Label htmlFor="diagnosis" className="text-xs">Diagnosis</Label>
                      <Input
                        id="diagnosis"
                        placeholder="e.g., hypertension"
                        value={filters.extractedDiagnosis}
                        onChange={(e) => setFilters(prev => ({ ...prev, extractedDiagnosis: e.target.value }))}
                        className="min-h-[44px]"
                        data-testid="input-diagnosis"
                      />
                    </div>
                    <div>
                      <Label htmlFor="medication" className="text-xs">Medication</Label>
                      <Input
                        id="medication"
                        placeholder="e.g., metformin"
                        value={filters.extractedMedication}
                        onChange={(e) => setFilters(prev => ({ ...prev, extractedMedication: e.target.value }))}
                        className="min-h-[44px]"
                        data-testid="input-medication"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full text-sm font-medium min-h-[44px] p-2 hover-elevate rounded-md">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    Facility & Provider
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-3">
                    <div>
                      <Label htmlFor="facility" className="text-xs">Facility</Label>
                      <Input
                        id="facility"
                        placeholder="e.g., City Medical"
                        value={filters.facility}
                        onChange={(e) => setFilters(prev => ({ ...prev, facility: e.target.value }))}
                        className="min-h-[44px]"
                        data-testid="input-facility"
                      />
                    </div>
                    <div>
                      <Label htmlFor="provider" className="text-xs">Provider</Label>
                      <Input
                        id="provider"
                        placeholder="e.g., Dr. Smith"
                        value={filters.provider}
                        onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                        className="min-h-[44px]"
                        data-testid="input-provider"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSearch} className="flex-1 min-h-[44px]" data-testid="button-search">
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </Button>
                  <Button variant="outline" onClick={handleClearFilters} className="min-h-[44px]" data-testid="button-clear">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Clear filters</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isSearching ? "Searching..." : `${results.length} document${results.length !== 1 ? "s" : ""} found`}
              </p>
            </div>

            {isSearching ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : results.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No documents found</h3>
                  <p className="text-muted-foreground">Try adjusting your search criteria or filters</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map((result) => {
                  const categoryConfig = CATEGORY_CONFIG[result.category];
                  const CategoryIcon = categoryConfig.icon;
                  
                  return (
                    <Card key={result.id} className="hover-elevate" data-testid={`result-${result.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={categoryConfig.color}>
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {categoryConfig.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(result.date).toLocaleDateString()}
                              </span>
                              {result.profile && (
                                <Badge variant="outline">
                                  <User className="h-3 w-3 mr-1" />
                                  {result.profile}
                                </Badge>
                              )}
                            </div>
                            
                            <h3 className="font-medium text-base mb-1">{result.title}</h3>
                            
                            <p className="text-sm text-muted-foreground mb-2">{result.snippet}</p>
                            
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              {result.matchedIn.map((match) => (
                                <Badge key={match} variant="secondary" className="text-xs">
                                  {match === "title" && "Title match"}
                                  {match === "content" && "Content match"}
                                  {match === "extracted" && "Extracted data match"}
                                  {match === "tags" && "Tag match"}
                                </Badge>
                              ))}
                              <span className="text-muted-foreground">
                                Score: {Math.round(result.matchScore * 100)}%
                              </span>
                            </div>

                            {result.extractedData && (
                              <div className="mt-3 pt-3 border-t flex items-center gap-3 flex-wrap text-xs">
                                {result.extractedData.diagnoses && (
                                  <span className="flex items-center gap-1">
                                    <Stethoscope className="h-3 w-3 text-purple-500" />
                                    {result.extractedData.diagnoses.slice(0, 2).join(", ")}
                                  </span>
                                )}
                                {result.extractedData.medications && (
                                  <span className="flex items-center gap-1">
                                    <Pill className="h-3 w-3 text-pink-500" />
                                    {result.extractedData.medications.slice(0, 2).join(", ")}
                                  </span>
                                )}
                                {result.extractedData.labResults && (
                                  <span className="flex items-center gap-1 text-muted-foreground">
                                    {result.extractedData.labResults} lab values
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 flex-shrink-0">
                            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" data-testid={`button-view-${result.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View document</span>
                            </Button>
                            <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" data-testid={`button-download-${result.id}`}>
                              <Download className="h-4 w-4" />
                              <span className="sr-only">Download document</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
