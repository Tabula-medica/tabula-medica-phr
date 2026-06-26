import { useState, useEffect, useRef } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Phone,
  Star,
  Clock,
  CheckCircle,
  ChevronRight,
  Filter,
  Calendar,
  Video,
  User,
  Building,
  CreditCard,
  Shield,
  Heart,
  Globe,
  Users,
  RefreshCw,
  ChevronLeft,
  CalendarDays,
  Stethoscope,
  Sparkles,
  Zap,
  Brain,
  AlertCircle,
} from "lucide-react";
import { format, addDays, startOfDay, parseISO } from "date-fns";

interface HealthcareProvider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  credentials: string[];
  providerType: string;
  specialties: string[];
  primarySpecialty: string;
  status: string;
  bio?: string;
  languages: string[];
  acceptingNewPatients: boolean;
  appointmentModes: string[];
  averageRating?: number;
  reviewCount: number;
  yearsExperience?: number;
  hospitalAffiliations: string[];
  primaryLocation?: ProviderLocation;
  networkStatus?: string;
  nextAvailable?: string;
}

interface ProviderLocation {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
}

interface ProviderSearchResult {
  providers: HealthcareProvider[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

interface Specialty {
  id: string;
  name: string;
}

interface InsurancePlan {
  id: string;
  carrierName: string;
  planName: string;
  planType: string;
}

interface AvailabilitySlot {
  id: string;
  providerId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  appointmentTypes: string[];
  appointmentModes: string[];
}

interface SearchSuggestion {
  text: string;
  type: "specialty" | "condition" | "symptom" | "provider_type";
  relevance: number;
  description?: string;
}

interface SemanticSearchResult {
  interpretedQuery: string;
  suggestedSpecialties: string[];
  suggestedConditions: string[];
  searchTerms: string[];
  patientNeedsSummary: string;
}

interface TelehealthTodayResult {
  providers: HealthcareProvider[];
  totalCount: number;
  date: string;
}

const specialtyLabels: Record<string, string> = {
  family_medicine: "Family Medicine",
  internal_medicine: "Internal Medicine",
  cardiology: "Cardiology",
  dermatology: "Dermatology",
  endocrinology: "Endocrinology",
  gastroenterology: "Gastroenterology",
  neurology: "Neurology",
  orthopedics: "Orthopedics",
  psychiatry: "Psychiatry",
  pediatrics: "Pediatrics",
  obstetrics_gynecology: "OB/GYN",
  oncology: "Oncology",
  ophthalmology: "Ophthalmology",
  pulmonology: "Pulmonology",
  rheumatology: "Rheumatology",
  urology: "Urology",
  allergy_immunology: "Allergy & Immunology",
  emergency_medicine: "Emergency Medicine",
  surgery_general: "General Surgery",
  physical_therapy: "Physical Therapy",
};

export default function ProviderDirectory() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedInsurance, setSelectedInsurance] = useState("");
  const [acceptingNewPatients, setAcceptingNewPatients] = useState<string>("");
  const [appointmentMode, setAppointmentMode] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<HealthcareProvider | null>(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [appointmentReason, setAppointmentReason] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [telehealthTodayOnly, setTelehealthTodayOnly] = useState(false);
  const [semanticSearchResult, setSemanticSearchResult] = useState<SemanticSearchResult | null>(null);
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: suggestions, isLoading: loadingSuggestions } = useQuery<SearchSuggestion[]>({
    queryKey: ["/api/provider-integration/ai-search/suggestions", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const res = await fetch(`/api/provider-integration/ai-search/suggestions?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.length >= 2 && showSuggestions,
  });

  const { data: autocompletions } = useQuery<string[]>({
    queryKey: ["/api/provider-integration/ai-search/autocomplete", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const res = await fetch(`/api/provider-integration/ai-search/autocomplete?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: searchQuery.length >= 2 && showSuggestions,
  });

  const semanticSearchMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await apiRequest("POST", "/api/provider-integration/ai-search/semantic", { query });
      return res.json();
    },
    onSuccess: (result: SemanticSearchResult) => {
      setSemanticSearchResult(result);
      if (result.suggestedSpecialties.length > 0) {
        setSelectedSpecialty(result.suggestedSpecialties[0]);
      }
      toast({
        title: "AI Search Complete",
        description: result.patientNeedsSummary,
      });
    },
    onError: () => {
      toast({
        title: "Search Error",
        description: "Failed to perform AI-powered search",
        variant: "destructive",
      });
    },
  });

  const { data: telehealthTodayProviders, isLoading: loadingTelehealthToday } = useQuery<TelehealthTodayResult>({
    queryKey: ["/api/provider-integration/providers/telehealth-today"],
    enabled: telehealthTodayOnly,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    if (suggestion.type === "specialty") {
      const specialtyId = Object.entries(specialtyLabels).find(
        ([_, label]) => label === suggestion.text
      )?.[0];
      if (specialtyId) {
        setSelectedSpecialty(specialtyId);
      }
    } else {
      setSearchQuery(suggestion.text);
    }
    setShowSuggestions(false);
  };

  const handleAutocompleteClick = (text: string) => {
    setSearchQuery(text);
    setShowSuggestions(false);
  };

  const handleAiSearch = () => {
    if (searchQuery.trim()) {
      semanticSearchMutation.mutate(searchQuery);
      setShowSuggestions(false);
    }
  };

  const { data: specialties } = useQuery<Specialty[]>({
    queryKey: ["/api/provider-integration/specialties"],
  });

  const { data: insurancePlans } = useQuery<InsurancePlan[]>({
    queryKey: ["/api/provider-integration/insurance/plans"],
  });

  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("name", searchQuery);
    if (selectedSpecialty) params.set("specialty", selectedSpecialty);
    if (selectedCity) params.set("city", selectedCity);
    if (selectedInsurance) params.set("insurancePlanId", selectedInsurance);
    if (acceptingNewPatients === "true") params.set("acceptingNewPatients", "true");
    if (appointmentMode) params.set("appointmentMode", appointmentMode);
    const queryString = params.toString();
    return queryString ? `/api/provider-integration/providers?${queryString}` : "/api/provider-integration/providers";
  };

  const searchUrl = buildSearchUrl();

  const { data: searchResults, isLoading } = useQuery<ProviderSearchResult>({
    queryKey: ["/api/provider-integration/providers", searchQuery, selectedSpecialty, selectedCity, selectedInsurance, acceptingNewPatients, appointmentMode],
    queryFn: async () => {
      const res = await fetch(searchUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch providers");
      return res.json();
    },
  });

  const startDate = format(selectedDate, "yyyy-MM-dd");
  const endDate = format(addDays(selectedDate, 7), "yyyy-MM-dd");

  const { data: availabilitySlots, isLoading: loadingSlots, refetch: refetchSlots } = useQuery<AvailabilitySlot[]>({
    queryKey: ["/api/provider-integration/availability", selectedProvider?.id, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/provider-integration/availability/${selectedProvider?.id}/slots?startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    enabled: !!selectedProvider,
  });

  const bookAppointmentMutation = useMutation({
    mutationFn: async (data: { slotId: string; patientId: string; appointmentType: string; reason: string }) => {
      const response = await apiRequest("POST", "/api/provider-integration/availability/book", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Appointment Booked",
        description: "Your appointment has been successfully scheduled.",
      });
      setShowBookingDialog(false);
      setSelectedSlot(null);
      setAppointmentReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/provider-integration/providers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider-integration/availability"] });
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to book appointment. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleBookAppointment = () => {
    if (!selectedSlot) return;
    bookAppointmentMutation.mutate({
      slotId: selectedSlot.id,
      patientId: "patient-1",
      appointmentType: selectedSlot.appointmentTypes[0] || "new_patient",
      reason: appointmentReason,
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSpecialty("");
    setSelectedCity("");
    setSelectedInsurance("");
    setAcceptingNewPatients("");
    setAppointmentMode("");
    setTelehealthTodayOnly(false);
    setSemanticSearchResult(null);
  };

  const hasActiveFilters = searchQuery || selectedSpecialty || selectedCity || selectedInsurance || acceptingNewPatients || appointmentMode || telehealthTodayOnly;

  const displayProviders = telehealthTodayOnly
    ? telehealthTodayProviders?.providers || []
    : searchResults?.providers || [];
  
  const displayTotalCount = telehealthTodayOnly
    ? telehealthTodayProviders?.totalCount || 0
    : searchResults?.totalCount || 0;

  const groupSlotsByDate = (slots: AvailabilitySlot[]) => {
    const grouped: Record<string, AvailabilitySlot[]> = {};
    slots?.forEach((slot) => {
      if (!grouped[slot.date]) {
        grouped[slot.date] = [];
      }
      grouped[slot.date].push(slot);
    });
    return grouped;
  };

  const availableSlots = availabilitySlots?.filter((s) => s.status === "available") || [];
  const groupedSlots = groupSlotsByDate(availableSlots);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Stethoscope className="h-6 w-6 text-primary" />
          Find a Provider
        </h1>
        <p className="text-muted-foreground">
          Search for healthcare providers by specialty, location, and insurance coverage
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Powered Provider Search
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="telehealth-today" className="text-sm flex items-center gap-1">
                <Zap className="h-4 w-4 text-green-500" />
                Telehealth Today
              </Label>
              <Switch
                id="telehealth-today"
                checked={telehealthTodayOnly}
                onCheckedChange={setTelehealthTodayOnly}
                data-testid="switch-telehealth-today"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Brain className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  ref={searchInputRef}
                  placeholder="Describe what you need... (e.g., 'doctor for chest pain' or 'therapist for anxiety')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && searchQuery.trim()) {
                      handleAiSearch();
                    }
                  }}
                  className="pl-9 border-primary/30"
                  data-testid="input-ai-search"
                />
                {showSuggestions && searchQuery.length >= 2 && (suggestions?.length || autocompletions?.length) ? (
                  <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto"
                    data-testid="dropdown-suggestions"
                  >
                    {autocompletions && autocompletions.length > 0 && (
                      <div className="p-2 border-b">
                        <p className="text-xs text-muted-foreground mb-1 px-2">Suggestions</p>
                        {autocompletions.map((text, i) => (
                          <button
                            key={`auto-${i}`}
                            className="w-full text-left px-3 py-2 text-sm rounded hover-elevate flex items-center gap-2"
                            onClick={() => handleAutocompleteClick(text)}
                            data-testid={`suggestion-autocomplete-${i}`}
                          >
                            <Search className="h-3 w-3 text-muted-foreground" />
                            {text}
                          </button>
                        ))}
                      </div>
                    )}
                    {suggestions && suggestions.length > 0 && (
                      <div className="p-2">
                        <p className="text-xs text-muted-foreground mb-1 px-2">AI Recommendations</p>
                        {suggestions.map((suggestion, i) => (
                          <button
                            key={`sug-${i}`}
                            className="w-full text-left px-3 py-2 text-sm rounded hover-elevate flex items-center justify-between gap-2"
                            onClick={() => handleSuggestionClick(suggestion)}
                            data-testid={`suggestion-ai-${i}`}
                          >
                            <div className="flex items-center gap-2">
                              {suggestion.type === "specialty" && <Stethoscope className="h-3 w-3 text-blue-500" />}
                              {suggestion.type === "condition" && <Heart className="h-3 w-3 text-red-500" />}
                              {suggestion.type === "symptom" && <AlertCircle className="h-3 w-3 text-yellow-500" />}
                              <span>{suggestion.text}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {suggestion.type}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
              <Button
                onClick={handleAiSearch}
                disabled={!searchQuery.trim() || semanticSearchMutation.isPending}
                data-testid="button-ai-search"
              >
                {semanticSearchMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ml-1 hidden sm:inline">AI Search</span>
              </Button>
            </div>
            {semanticSearchResult && (
              <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm font-medium flex items-center gap-1">
                  <Brain className="h-4 w-4 text-primary" />
                  AI Interpretation
                </p>
                <p className="text-sm text-muted-foreground mt-1">{semanticSearchResult.patientNeedsSummary}</p>
                {semanticSearchResult.suggestedSpecialties.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {semanticSearchResult.suggestedSpecialties.map((spec) => (
                      <Badge key={spec} variant="secondary" className="text-xs">
                        {specialtyLabels[spec] || spec}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {telehealthTodayOnly && (
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">
                    Showing providers with telehealth slots available today
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {loadingTelehealthToday ? "Loading..." : `${telehealthTodayProviders?.totalCount || 0} providers available`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Additional Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by provider name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-name"
              />
            </div>

            <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
              <SelectTrigger data-testid="select-specialty">
                <Stethoscope className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Specialties</SelectItem>
                {specialties?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="City or ZIP code..."
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="pl-9"
                data-testid="input-location"
              />
            </div>

            <Select value={selectedInsurance} onValueChange={setSelectedInsurance}>
              <SelectTrigger data-testid="select-insurance">
                <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Insurance Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Insurance Plans</SelectItem>
                {insurancePlans?.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.carrierName} - {plan.planName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={appointmentMode} onValueChange={setAppointmentMode}>
              <SelectTrigger data-testid="select-appointment-mode">
                <Video className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Visit Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Visit Types</SelectItem>
                <SelectItem value="in_person">In-Person</SelectItem>
                <SelectItem value="telehealth">Video/Telehealth</SelectItem>
              </SelectContent>
            </Select>

            <Select value={acceptingNewPatients} onValueChange={setAcceptingNewPatients}>
              <SelectTrigger data-testid="select-accepting">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Any Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Any Availability</SelectItem>
                <SelectItem value="true">Accepting New Patients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-muted-foreground">
                Found {displayTotalCount} provider(s)
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                Clear All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {(isLoading || (telehealthTodayOnly && loadingTelehealthToday)) ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {displayProviders.map((provider) => (
            <Card key={provider.id} className="hover-elevate" data-testid={`card-provider-${provider.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <Avatar className="h-20 w-20 shrink-0">
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {provider.firstName[0]}
                      {provider.lastName[0]}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-semibold">
                          Dr. {provider.firstName} {provider.lastName}
                        </h3>
                        <span className="text-sm text-muted-foreground">
                          {provider.credentials.join(", ")}
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        {specialtyLabels[provider.primarySpecialty] || provider.primarySpecialty}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      {provider.averageRating && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          <span className="font-medium">{provider.averageRating.toFixed(1)}</span>
                          <span className="text-muted-foreground">({provider.reviewCount} reviews)</span>
                        </div>
                      )}
                      {provider.yearsExperience && (
                        <span className="text-sm text-muted-foreground">
                          {provider.yearsExperience} years experience
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {provider.acceptingNewPatients && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accepting New Patients
                        </Badge>
                      )}
                      {provider.networkStatus === "in_network" && (
                        <Badge className="text-xs bg-green-500/10 text-green-600 dark:text-green-400">
                          <Shield className="h-3 w-3 mr-1" />
                          In-Network
                        </Badge>
                      )}
                      {provider.appointmentModes.includes("telehealth") && (
                        <Badge variant="outline" className="text-xs">
                          <Video className="h-3 w-3 mr-1" />
                          Video Visits
                        </Badge>
                      )}
                    </div>

                    {provider.primaryLocation && (
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {provider.primaryLocation.city}, {provider.primaryLocation.state} {provider.primaryLocation.zipCode}
                          </span>
                        </div>
                        {provider.primaryLocation.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-4 w-4" />
                            <span>{provider.primaryLocation.phone}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {provider.languages.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <span>Speaks: {provider.languages.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0">
                    {provider.nextAvailable && (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Next Available</p>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          {format(parseISO(provider.nextAvailable.split(" ")[0]), "MMM d, yyyy")}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProvider(provider)}
                        data-testid={`button-view-${provider.id}`}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedProvider(provider);
                          setShowBookingDialog(true);
                        }}
                        data-testid={`button-book-${provider.id}`}
                      >
                        <Calendar className="h-4 w-4 mr-1" />
                        Book
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {displayProviders.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No providers found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {telehealthTodayOnly 
                    ? "No providers have telehealth slots available today. Try a different day or remove the filter."
                    : "Try adjusting your search filters or use AI search to find providers"}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {!telehealthTodayOnly && searchResults?.hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" data-testid="button-load-more">
                Load More Providers
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedProvider && !showBookingDialog} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedProvider.firstName[0]}
                      {selectedProvider.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      Dr. {selectedProvider.firstName} {selectedProvider.lastName}
                      <span className="text-sm font-normal text-muted-foreground">
                        {selectedProvider.credentials.join(", ")}
                      </span>
                    </div>
                    <p className="text-sm font-normal text-muted-foreground">
                      {specialtyLabels[selectedProvider.primarySpecialty] || selectedProvider.primarySpecialty}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {selectedProvider.bio && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">About</h4>
                    <p className="text-sm text-muted-foreground">{selectedProvider.bio}</p>
                  </div>
                )}

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Languages</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedProvider.languages.map((lang) => (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Visit Types</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedProvider.appointmentModes.map((mode) => (
                        <Badge key={mode} variant="secondary" className="text-xs">
                          {mode === "in_person" ? "In-Person" : mode === "telehealth" ? "Video" : mode}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {selectedProvider.hospitalAffiliations.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Hospital Affiliations</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {selectedProvider.hospitalAffiliations.map((h) => (
                          <li key={h} className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {selectedProvider.primaryLocation && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-2">Primary Location</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">{selectedProvider.primaryLocation.name}</p>
                        <p>{selectedProvider.primaryLocation.addressLine1}</p>
                        {selectedProvider.primaryLocation.addressLine2 && (
                          <p>{selectedProvider.primaryLocation.addressLine2}</p>
                        )}
                        <p>
                          {selectedProvider.primaryLocation.city}, {selectedProvider.primaryLocation.state}{" "}
                          {selectedProvider.primaryLocation.zipCode}
                        </p>
                        <p className="flex items-center gap-1 mt-2">
                          <Phone className="h-4 w-4" />
                          {selectedProvider.primaryLocation.phone}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => setShowBookingDialog(true)}
                  data-testid="button-schedule-from-profile"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showBookingDialog} onOpenChange={(open) => {
        setShowBookingDialog(open);
        if (!open) {
          setSelectedSlot(null);
          setAppointmentReason("");
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Schedule Appointment
                </DialogTitle>
                <DialogDescription>
                  Book an appointment with Dr. {selectedProvider.firstName} {selectedProvider.lastName}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedDate(addDays(selectedDate, -7))}
                      disabled={startOfDay(selectedDate) <= startOfDay(new Date())}
                      data-testid="button-prev-week"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[200px] text-center">
                      {format(selectedDate, "MMM d")} - {format(addDays(selectedDate, 6), "MMM d, yyyy")}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedDate(addDays(selectedDate, 7))}
                      data-testid="button-next-week"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetchSlots()}
                    data-testid="button-refresh-slots"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>

                {loadingSlots ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : availableSlots.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                      <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                      <h4 className="font-medium">No Available Slots</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Try selecting a different week
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedSlots).map(([date, slots]) => (
                      <Card key={date}>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm font-medium">
                            {format(parseISO(date), "EEEE, MMMM d")}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot) => (
                              <Button
                                key={slot.id}
                                variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedSlot(slot)}
                                data-testid={`button-slot-${slot.id}`}
                              >
                                <Clock className="h-3 w-3 mr-1" />
                                {slot.startTime}
                              </Button>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedSlot && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <h4 className="text-sm font-medium mb-2">Selected Time</h4>
                        <p className="text-sm">
                          {format(parseISO(selectedSlot.date), "EEEE, MMMM d, yyyy")} at{" "}
                          <span className="font-semibold">{selectedSlot.startTime}</span>
                        </p>
                        <div className="flex gap-1 mt-2">
                          {selectedSlot.appointmentModes.map((mode) => (
                            <Badge key={mode} variant="secondary" className="text-xs">
                              {mode === "in_person" ? "In-Person" : mode === "telehealth" ? "Video" : mode}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason for Visit</Label>
                        <Textarea
                          id="reason"
                          placeholder="Briefly describe your reason for this appointment..."
                          value={appointmentReason}
                          onChange={(e) => setAppointmentReason(e.target.value)}
                          rows={3}
                          data-testid="textarea-reason"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowBookingDialog(false);
                    setSelectedSlot(null);
                    setAppointmentReason("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleBookAppointment}
                  disabled={!selectedSlot || bookAppointmentMutation.isPending}
                  data-testid="button-confirm-booking"
                >
                  {bookAppointmentMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm Booking
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-provider-directory-disclaimer" />
    </div>
  );
}
