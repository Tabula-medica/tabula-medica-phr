import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Hospital,
  Stethoscope,
  TestTube2,
  ScanLine,
  Pill,
  Video,
  Siren,
  Search,
  Plus,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  MapPin,
  Phone,
  Globe,
  Edit2,
  Trash2,
  Loader2,
  SkipForward,
  Activity,
} from "lucide-react";
import type {
  FacilityType,
  ServiceType,
  PortalStatus,
  PatientCareFacility,
  FacilitySearchResult,
  FacilityOnboardingSession,
} from "@shared/schema";

const FACILITY_TYPE_OPTIONS: { value: FacilityType; label: string; icon: typeof Building2 }[] = [
  { value: "hospital", label: "Hospital / ER", icon: Hospital },
  { value: "primary_care", label: "Primary care clinic", icon: Stethoscope },
  { value: "specialist", label: "Specialist clinic", icon: Activity },
  { value: "urgent_care", label: "Urgent care", icon: Siren },
  { value: "lab", label: "Lab (bloodwork)", icon: TestTube2 },
  { value: "imaging", label: "Imaging / diagnostic center (MRI/CT/X-ray/US)", icon: ScanLine },
  { value: "pharmacy", label: "Pharmacy", icon: Pill },
  { value: "telehealth", label: "Telehealth service", icon: Video },
  { value: "other", label: "Other", icon: Building2 },
];

const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = [
  { value: "office_visits", label: "Office visits" },
  { value: "emergency_visit", label: "Emergency visit" },
  { value: "surgery_procedure", label: "Surgery/procedure" },
  { value: "imaging", label: "Imaging" },
  { value: "lab_tests", label: "Lab tests" },
  { value: "hospital_admission", label: "Hospital admission" },
  { value: "physical_therapy", label: "Physical therapy" },
  { value: "mental_health", label: "Mental health" },
  { value: "telehealth", label: "Telehealth" },
  { value: "other", label: "Other" },
];

const TOTAL_STEPS = 7;

export default function FacilityOnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFacilityTypes, setSelectedFacilityTypes] = useState<FacilityType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FacilitySearchResult[]>([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [editingFacility, setEditingFacility] = useState<PatientCareFacility | null>(null);
  const [quickPickLabs, setQuickPickLabs] = useState<string[]>([]);
  const [quickPickImaging, setQuickPickImaging] = useState<string[]>([]);

  const [manualFacility, setManualFacility] = useState({
    facilityName: "",
    facilityType: "other" as FacilityType,
    city: "",
    state: "",
    country: "USA",
    phone: "",
    website: "",
    notes: "",
  });

  const [facilityDetails, setFacilityDetails] = useState({
    firstVisitYear: "",
    lastVisitYear: "",
    visitDateUnsure: false,
    servicesReceived: [] as ServiceType[],
    hasPortalAccount: "not_sure" as PortalStatus,
    knowsPortalLogin: null as boolean | null,
  });

  const { data: session } = useQuery<FacilityOnboardingSession>({
    queryKey: ["/api/facility-onboarding/session"],
  });

  const { data: patientFacilities = [], refetch: refetchFacilities } = useQuery<PatientCareFacility[]>({
    queryKey: ["/api/facility-onboarding/facilities"],
  });

  const { data: labQuickPicks = [] } = useQuery<{ id: string; name: string; popular: boolean }[]>({
    queryKey: ["/api/facility-onboarding/quick-picks/lab"],
  });

  const { data: imagingQuickPicks = [] } = useQuery<{ id: string; name: string; popular: boolean }[]>({
    queryKey: ["/api/facility-onboarding/quick-picks/imaging"],
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: Partial<FacilityOnboardingSession>) => {
      return apiRequest("PATCH", "/api/facility-onboarding/session", data);
    },
  });

  const addFacilityMutation = useMutation({
    mutationFn: async (data: Partial<PatientCareFacility>) => {
      return apiRequest("POST", "/api/facility-onboarding/facilities", data);
    },
    onSuccess: () => {
      refetchFacilities();
      toast({ title: "Location added", description: "Your care location has been saved." });
      resetFacilityForm();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add location", variant: "destructive" });
    },
  });

  const updateFacilityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<PatientCareFacility> }) => {
      return apiRequest("PATCH", `/api/facility-onboarding/facilities/${id}`, data);
    },
    onSuccess: () => {
      refetchFacilities();
      setEditingFacility(null);
      toast({ title: "Location updated" });
    },
  });

  const deleteFacilityMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/facility-onboarding/facilities/${id}`);
    },
    onSuccess: () => {
      refetchFacilities();
      toast({ title: "Location removed" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/facility-onboarding/session/skip");
    },
    onSuccess: () => {
      toast({ title: "Skipped", description: "You can add locations later from your profile." });
      navigate("/");
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/facility-onboarding/session/complete");
    },
    onSuccess: () => {
      toast({ title: "Complete!", description: "Your care locations have been saved." });
      navigate("/");
    },
  });

  useEffect(() => {
    if (session) {
      setCurrentStep(session.currentStep);
      setSelectedFacilityTypes(session.selectedFacilityTypes || []);
      setQuickPickLabs(session.quickPickLabs || []);
      setQuickPickImaging(session.quickPickImaging || []);
    }
  }, [session]);

  useEffect(() => {
    const searchFacilities = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/facility-onboarding/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchFacilities, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const resetFacilityForm = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowManualEntry(false);
    setManualFacility({
      facilityName: "",
      facilityType: "other",
      city: "",
      state: "",
      country: "USA",
      phone: "",
      website: "",
      notes: "",
    });
    setFacilityDetails({
      firstVisitYear: "",
      lastVisitYear: "",
      visitDateUnsure: false,
      servicesReceived: [],
      hasPortalAccount: "not_sure",
      knowsPortalLogin: null,
    });
  };

  const handleSelectFacility = async (result: FacilitySearchResult) => {
    await addFacilityMutation.mutateAsync({
      facilityId: result.id,
      facilityName: result.name,
      facilityType: result.facilityType,
      city: result.city,
      state: result.state,
      country: result.country,
      isManualEntry: false,
    });
  };

  const handleAddManualFacility = async () => {
    if (!manualFacility.facilityName || !manualFacility.city || !manualFacility.state) {
      toast({ title: "Required fields", description: "Please fill in name, city, and state", variant: "destructive" });
      return;
    }

    await addFacilityMutation.mutateAsync({
      ...manualFacility,
      ...facilityDetails,
      firstVisitYear: facilityDetails.firstVisitYear ? parseInt(facilityDetails.firstVisitYear) : undefined,
      lastVisitYear: facilityDetails.lastVisitYear ? parseInt(facilityDetails.lastVisitYear) : undefined,
      isManualEntry: true,
    });
  };

  const handleNextStep = () => {
    const nextStep = Math.min(currentStep + 1, TOTAL_STEPS - 1);
    setCurrentStep(nextStep);
    updateSessionMutation.mutate({ currentStep: nextStep, selectedFacilityTypes, quickPickLabs, quickPickImaging });
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(currentStep - 1, 0);
    setCurrentStep(prevStep);
    updateSessionMutation.mutate({ currentStep: prevStep });
  };

  const toggleFacilityType = (type: FacilityType) => {
    setSelectedFacilityTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleService = (service: ServiceType) => {
    setFacilityDetails(prev => ({
      ...prev,
      servicesReceived: prev.servicesReceived.includes(service)
        ? prev.servicesReceived.filter(s => s !== service)
        : [...prev.servicesReceived, service],
    }));
  };

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold" data-testid="text-title">Connect your care locations</h1>
              <p className="text-muted-foreground max-w-md mx-auto" data-testid="text-description">
                Add the hospitals, clinics, labs, and imaging centers you've used so we can help organize your records.
              </p>
            </div>
            <div className="flex flex-col gap-3 max-w-sm mx-auto">
              <Button onClick={handleNextStep} size="lg" data-testid="button-add-locations">
                Add locations
                <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="ghost" onClick={() => skipMutation.mutate()} data-testid="button-skip">
                <SkipForward className="mr-2 w-4 h-4" />
                Skip for now
              </Button>
            </div>
          </motion.div>
        );

      case 1:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Which types of places have you used?</h2>
              <p className="text-muted-foreground mt-1">Select all that apply (optional)</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
              {FACILITY_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => toggleFacilityType(value)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all hover-elevate ${
                    selectedFacilityTypes.includes(value)
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  data-testid={`button-facility-type-${value}`}
                >
                  <Icon className={`w-6 h-6 ${selectedFacilityTypes.includes(value) ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm text-center">{label}</span>
                  {selectedFacilityTypes.includes(value) && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Search and add a location</h2>
              <p className="text-muted-foreground mt-1">Find your healthcare providers</p>
            </div>

            <div className="max-w-xl mx-auto space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Start typing name (e.g., Inova Fairfax, Labcorp, Kaiser)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-facility-search"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <Card key={result.id} className="hover-elevate cursor-pointer" onClick={() => handleSelectFacility(result)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium" data-testid={`text-facility-name-${result.id}`}>{result.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{result.city}, {result.state}</span>
                              <Badge variant="secondary" className="text-xs">
                                {result.facilityType.replace("_", " ")}
                              </Badge>
                            </div>
                            {result.healthSystemName && (
                              <p className="text-xs text-muted-foreground mt-1">{result.healthSystemName}</p>
                            )}
                          </div>
                          <Button size="sm" data-testid={`button-add-${result.id}`}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-muted-foreground">No results found</p>
              )}

              <div className="text-center pt-4">
                <Button variant="outline" onClick={() => setShowManualEntry(true)} data-testid="button-manual-entry">
                  <Plus className="w-4 h-4 mr-2" />
                  Not listed? Add manually
                </Button>
              </div>

              {patientFacilities.length > 0 && (
                <div className="pt-6 border-t">
                  <h3 className="font-medium mb-3">Added locations ({patientFacilities.length})</h3>
                  <div className="space-y-2">
                    {patientFacilities.map((facility) => (
                      <Card key={facility.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{facility.facilityName}</p>
                            <p className="text-sm text-muted-foreground">{facility.city}, {facility.state}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => setEditingFacility(facility)} data-testid={`button-edit-${facility.id}`}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deleteFacilityMutation.mutate(facility.id)} data-testid={`button-delete-${facility.id}`}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {showManualEntry && (
              <Card className="max-w-xl mx-auto">
                <CardHeader>
                  <CardTitle className="text-lg">Add facility manually</CardTitle>
                  <CardDescription>Enter the details for a facility not in our database</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label htmlFor="facility-onboarding-facility-name">Facility name *</Label>
                      <Input id="facility-onboarding-facility-name"
                        value={manualFacility.facilityName}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, facilityName: e.target.value }))}
                        placeholder="e.g., Memorial Hospital"
                        data-testid="input-manual-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-city">City *</Label>
                      <Input id="facility-onboarding-city"
                        value={manualFacility.city}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, city: e.target.value }))}
                        data-testid="input-manual-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-state">State *</Label>
                      <Input id="facility-onboarding-state"
                        value={manualFacility.state}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, state: e.target.value }))}
                        data-testid="input-manual-state"
                      />
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-facility-type">Facility type *</Label>
                      <Select
                        value={manualFacility.facilityType}
                        onValueChange={(v) => setManualFacility(prev => ({ ...prev, facilityType: v as FacilityType }))}
                      >
                        <SelectTrigger id="facility-onboarding-facility-type" data-testid="select-manual-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FACILITY_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-country">Country</Label>
                      <Input id="facility-onboarding-country"
                        value={manualFacility.country}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, country: e.target.value }))}
                        data-testid="input-manual-country"
                      />
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-phone-optional">Phone (optional)</Label>
                      <Input id="facility-onboarding-phone-optional"
                        value={manualFacility.phone}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, phone: e.target.value }))}
                        data-testid="input-manual-phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="facility-onboarding-website-optional">Website (optional)</Label>
                      <Input id="facility-onboarding-website-optional"
                        value={manualFacility.website}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, website: e.target.value }))}
                        data-testid="input-manual-website"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="facility-onboarding-notes-optional">Notes (optional)</Label>
                      <Textarea id="facility-onboarding-notes-optional"
                        value={manualFacility.notes}
                        onChange={(e) => setManualFacility(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="e.g., near my old house"
                        data-testid="input-manual-notes"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowManualEntry(false)} data-testid="button-cancel-manual">
                    Cancel
                  </Button>
                  <Button onClick={handleAddManualFacility} disabled={addFacilityMutation.isPending} data-testid="button-save-manual">
                    {addFacilityMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add location
                  </Button>
                </CardFooter>
              </Card>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Which labs have you used?</h2>
              <p className="text-muted-foreground mt-1">Select all that apply</p>
            </div>
            <div className="max-w-md mx-auto space-y-3">
              {labQuickPicks.map((pick) => (
                <button
                  key={pick.id}
                  onClick={() => {
                    if (pick.id === "other-lab") {
                      setCurrentStep(2);
                    } else {
                      setQuickPickLabs(prev => prev.includes(pick.id) ? prev.filter(p => p !== pick.id) : [...prev, pick.id]);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all hover-elevate ${
                    quickPickLabs.includes(pick.id) ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`button-lab-${pick.id}`}
                >
                  <div className="flex items-center gap-3">
                    <TestTube2 className={`w-5 h-5 ${quickPickLabs.includes(pick.id) ? "text-primary" : "text-muted-foreground"}`} />
                    <span>{pick.name}</span>
                    {pick.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                  </div>
                  {pick.id === "other-lab" ? (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  ) : quickPickLabs.includes(pick.id) ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Which imaging centers have you used?</h2>
              <p className="text-muted-foreground mt-1">Select all that apply</p>
            </div>
            <div className="max-w-md mx-auto space-y-3">
              {imagingQuickPicks.map((pick) => (
                <button
                  key={pick.id}
                  onClick={() => {
                    if (pick.id === "other-imaging") {
                      setCurrentStep(2);
                    } else {
                      setQuickPickImaging(prev => prev.includes(pick.id) ? prev.filter(p => p !== pick.id) : [...prev, pick.id]);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all hover-elevate ${
                    quickPickImaging.includes(pick.id) ? "border-primary bg-primary/5" : "border-border"
                  }`}
                  data-testid={`button-imaging-${pick.id}`}
                >
                  <div className="flex items-center gap-3">
                    <ScanLine className={`w-5 h-5 ${quickPickImaging.includes(pick.id) ? "text-primary" : "text-muted-foreground"}`} />
                    <span>{pick.name}</span>
                    {pick.popular && <Badge variant="secondary" className="text-xs">Popular</Badge>}
                  </div>
                  {pick.id === "other-imaging" ? (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  ) : quickPickImaging.includes(pick.id) ? (
                    <Check className="w-5 h-5 text-primary" />
                  ) : null}
                </button>
              ))}
            </div>
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Facility details</h2>
              <p className="text-muted-foreground mt-1">Help us retrieve your records more accurately</p>
            </div>

            {patientFacilities.length > 0 ? (
              <div className="max-w-xl mx-auto space-y-6">
                {patientFacilities.map((facility) => (
                  <Card key={facility.id}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Facility Card</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Section A: Facility Identity */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">A) Facility Identity</h4>
                        <div className="grid gap-3">
                          <div>
                            <FieldCaption>Facility name</FieldCaption>
                            <Input aria-label="Facility name"
                              value={facility.facilityName}
                              disabled
                              className="bg-muted"
                              data-testid={`input-facility-name-${facility.id}`}
                            />
                          </div>
                          <div>
                            <FieldCaption>Facility type</FieldCaption>
                            <Select
                              value={facility.facilityType}
                              onValueChange={(value) => updateFacilityMutation.mutate({
                                id: facility.id,
                                data: { facilityType: value as FacilityType }
                              })}
                            >
                              <SelectTrigger aria-label="Facility type" data-testid={`select-facility-type-${facility.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FACILITY_TYPE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <FieldCaption>City</FieldCaption>
                              <Input aria-label="City"
                                value={facility.city || ""}
                                disabled
                                className="bg-muted"
                                data-testid={`input-city-${facility.id}`}
                              />
                            </div>
                            <div>
                              <FieldCaption>State</FieldCaption>
                              <Input aria-label="State"
                                value={facility.state || ""}
                                disabled
                                className="bg-muted"
                                data-testid={`input-state-${facility.id}`}
                              />
                            </div>
                          </div>
                          {facility.country && facility.country !== "USA" && (
                            <div>
                              <FieldCaption>Country</FieldCaption>
                              <Input aria-label="Country"
                                value={facility.country}
                                disabled
                                className="bg-muted"
                                data-testid={`input-country-${facility.id}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Section B: When did you go here? */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">B) When did you go here?</h4>
                        <p className="text-xs text-muted-foreground">Helps with deduplication and record retrieval</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <FieldCaption>First visit year (optional)</FieldCaption>
                            <Input aria-label="First visit year (optional)"
                              type="number"
                              placeholder="e.g., 2018"
                              min="1900"
                              max={new Date().getFullYear()}
                              defaultValue={facility.firstVisitYear || ""}
                              disabled={facility.visitDateUnsure}
                              data-testid={`input-first-visit-${facility.id}`}
                              onChange={(e) => updateFacilityMutation.mutate({
                                id: facility.id,
                                data: { firstVisitYear: parseInt(e.target.value) || undefined }
                              })}
                            />
                          </div>
                          <div>
                            <FieldCaption>Most recent visit year (optional)</FieldCaption>
                            <Input aria-label="Most recent visit year (optional)"
                              type="number"
                              placeholder="e.g., 2024"
                              min="1900"
                              max={new Date().getFullYear()}
                              defaultValue={facility.lastVisitYear || ""}
                              disabled={facility.visitDateUnsure}
                              data-testid={`input-last-visit-${facility.id}`}
                              onChange={(e) => updateFacilityMutation.mutate({
                                id: facility.id,
                                data: { lastVisitYear: parseInt(e.target.value) || undefined }
                              })}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`unsure-${facility.id}`}
                            checked={facility.visitDateUnsure || false}
                            onCheckedChange={(checked) => updateFacilityMutation.mutate({
                              id: facility.id,
                              data: { visitDateUnsure: !!checked }
                            })}
                            data-testid={`checkbox-unsure-${facility.id}`}
                          />
                          <Label htmlFor={`unsure-${facility.id}`} className="text-sm font-normal cursor-pointer">
                            I'm not sure
                          </Label>
                        </div>
                      </div>

                      {/* Section C: What did you do there? */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">C) What did you do there? (optional)</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {SERVICE_TYPE_OPTIONS.map((service) => (
                            <div key={service.value} className="flex items-center gap-2">
                              <Checkbox
                                id={`service-${service.value}-${facility.id}`}
                                checked={(facility.servicesReceived || []).includes(service.value)}
                                onCheckedChange={(checked) => {
                                  const current = facility.servicesReceived || [];
                                  const updated = checked
                                    ? [...current, service.value]
                                    : current.filter(s => s !== service.value);
                                  updateFacilityMutation.mutate({
                                    id: facility.id,
                                    data: { servicesReceived: updated }
                                  });
                                }}
                                data-testid={`checkbox-service-${service.value}-${facility.id}`}
                              />
                              <Label htmlFor={`service-${service.value}-${facility.id}`} className="text-sm font-normal cursor-pointer">
                                {service.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section D: Portal Account */}
                      <div className="space-y-3">
                        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">D) Do you have a portal account here?</h4>
                        <div className="flex flex-wrap gap-2">
                          {(["yes", "no", "not_sure"] as PortalStatus[]).map((status) => (
                            <Button
                              key={status}
                              variant={facility.hasPortalAccount === status ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateFacilityMutation.mutate({
                                id: facility.id,
                                data: { hasPortalAccount: status }
                              })}
                              data-testid={`button-portal-${status}-${facility.id}`}
                            >
                              {status === "yes" ? "Yes" : status === "no" ? "No" : "Not sure"}
                            </Button>
                          ))}
                        </div>

                        {facility.hasPortalAccount === "yes" && (
                          <div className="pl-4 border-l-2 border-primary/20 space-y-2">
                            <FieldCaption className="text-sm">I know my portal login</FieldCaption>
                            <div className="flex gap-2">
                              <Button
                                variant={facility.knowsPortalLogin === true ? "default" : "outline"}
                                size="sm"
                                onClick={() => updateFacilityMutation.mutate({
                                  id: facility.id,
                                  data: { knowsPortalLogin: true }
                                })}
                                data-testid={`button-knows-login-yes-${facility.id}`}
                              >
                                Yes
                              </Button>
                              <Button
                                variant={facility.knowsPortalLogin === false ? "default" : "outline"}
                                size="sm"
                                onClick={() => updateFacilityMutation.mutate({
                                  id: facility.id,
                                  data: { knowsPortalLogin: false }
                                })}
                                data-testid={`button-knows-login-no-${facility.id}`}
                              >
                                No
                              </Button>
                            </div>
                            {facility.knowsPortalLogin === false && (
                              <p className="text-xs text-muted-foreground">We'll guide you later</p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No locations added yet. Go back to add some.</p>
              </div>
            )}
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center">
              <h2 className="text-xl font-semibold" data-testid="text-step-title">Review your locations</h2>
              <p className="text-muted-foreground mt-1">Confirm your care locations</p>
            </div>

            {patientFacilities.length > 0 ? (
              <div className="max-w-xl mx-auto space-y-3">
                {patientFacilities.map((facility) => (
                  <Card key={facility.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium">{facility.facilityName}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span>{facility.city}, {facility.state}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary">{facility.facilityType.replace("_", " ")}</Badge>
                            <Badge variant={facility.hasPortalAccount === "yes" ? "default" : "outline"}>
                              Portal: {facility.hasPortalAccount === "yes" ? "Yes" : facility.hasPortalAccount === "no" ? "No" : "Not sure"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setCurrentStep(2)} data-testid={`button-review-edit-${facility.id}`}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteFacilityMutation.mutate(facility.id)} data-testid={`button-review-delete-${facility.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" className="w-full" onClick={() => setCurrentStep(2)} data-testid="button-add-another">
                  <Plus className="w-4 h-4 mr-2" />
                  Add another location
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No locations added yet.</p>
                <Button variant="outline" className="mt-4" onClick={() => setCurrentStep(2)} data-testid="button-add-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Add a location
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 max-w-sm mx-auto pt-4">
              <Button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                size="lg"
                data-testid="button-save-complete"
              >
                {completeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Check className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button variant="ghost" onClick={() => skipMutation.mutate()} data-testid="button-skip-final">
                <SkipForward className="mr-2 w-4 h-4" />
                Skip for now
              </Button>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        {currentStep > 0 && (
          <div className="mb-8">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between mt-2 text-sm text-muted-foreground">
              <span>Step {currentStep} of {TOTAL_STEPS - 1}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        {currentStep > 0 && currentStep < TOTAL_STEPS - 1 && (
          <div className="flex justify-between mt-8 max-w-xl mx-auto">
            <Button variant="ghost" onClick={handlePrevStep} data-testid="button-prev">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button onClick={handleNextStep} data-testid="button-next">
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
