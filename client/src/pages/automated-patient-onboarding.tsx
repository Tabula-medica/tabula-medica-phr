import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Heart,
  Pill,
  Calendar,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Sparkles,
  Loader2,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Video,
  Clock,
  Database,
  FileText,
  Stethoscope,
  Shield,
  Building,
  UserCheck,
  Info
} from "lucide-react";

interface RegistrationData {
  id: string;
  status: string;
  demographics?: Demographics;
  medicalHistory?: MedicalHistory;
  scheduledAppointment?: ScheduledAppointment;
  fhirPrefillApplied: boolean;
  onboardingScore?: number;
}

interface Demographics {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  preferredLanguage: string;
  insuranceProvider?: string;
  insuranceMemberId?: string;
}

interface MedicalHistory {
  conditions: ConditionEntry[];
  allergies: AllergyEntry[];
  medications: MedicationEntry[];
  surgeries: SurgeryEntry[];
  familyHistory: FamilyHistoryEntry[];
  socialHistory?: {
    smokingStatus: string;
    alcoholUse: string;
    exerciseFrequency: string;
  };
}

interface ConditionEntry {
  id: string;
  name: string;
  diagnosisDate?: string;
  status: "active" | "resolved" | "managed";
  severity?: "mild" | "moderate" | "severe";
  source: "patient_reported" | "fhir_imported";
}

interface AllergyEntry {
  id: string;
  allergen: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe";
  source: "patient_reported" | "fhir_imported";
}

interface MedicationEntry {
  id: string;
  name: string;
  dosage?: string;
  frequency?: string;
  prescribedBy?: string;
  source: "patient_reported" | "fhir_imported";
}

interface SurgeryEntry {
  id: string;
  procedure: string;
  date?: string;
  hospital?: string;
  source: "patient_reported" | "fhir_imported";
}

interface FamilyHistoryEntry {
  id: string;
  condition: string;
  relationship: string;
  source: "patient_reported" | "fhir_imported";
}

interface ScheduledAppointment {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  scheduledAt: string;
  duration: number;
  type: string;
  isTelehealth: boolean;
  telehealthUrl?: string;
  facilityName?: string;
  facilityAddress?: string;
  preVisitInstructions?: string;
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  bio?: string;
  acceptingNewPatients: boolean;
  telehealthAvailable: boolean;
  inPersonAvailable: boolean;
  rating?: number;
  nextAvailable: string;
}

interface TimeSlot {
  id: string;
  providerId: string;
  providerName: string;
  startTime: string;
  endTime: string;
  duration: number;
  isTelehealth: boolean;
  facilityName?: string;
}

interface FHIRSource {
  id: string;
  name: string;
  system: string;
}

const steps = [
  { id: 1, name: "Connect Data", icon: Database, description: "Import from EHR" },
  { id: 2, name: "Demographics", icon: User, description: "Personal info" },
  { id: 3, name: "Medical History", icon: Heart, description: "Health conditions" },
  { id: 4, name: "Schedule", icon: Calendar, description: "First appointment" },
  { id: 5, name: "Complete", icon: CheckCircle, description: "Review & finish" },
];

export default function AutomatedPatientOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [selectedFHIRSource, setSelectedFHIRSource] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [appointmentType, setAppointmentType] = useState<string>("initial_consultation");
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const [demographics, setDemographics] = useState<Demographics>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phone: "",
    address: { street: "", city: "", state: "", zipCode: "" },
    emergencyContact: { name: "", relationship: "", phone: "" },
    preferredLanguage: "English",
    insuranceProvider: "",
    insuranceMemberId: ""
  });

  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    conditions: [],
    allergies: [],
    medications: [],
    surgeries: [],
    familyHistory: [],
    socialHistory: { smokingStatus: "never", alcoholUse: "none", exerciseFrequency: "moderate" }
  });

  const { data: metadata } = useQuery<{ noCdsDisclaimer: string }>({
    queryKey: ["/api/automated-patient-onboarding/metadata"]
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/automated-patient-onboarding/stats"]
  });

  const { data: fhirSources } = useQuery<{ sources: FHIRSource[] }>({
    queryKey: ["/api/automated-patient-onboarding/fhir-sources"]
  });

  const { data: providers } = useQuery<{ providers: Provider[] }>({
    queryKey: ["/api/automated-patient-onboarding/providers"],
    enabled: currentStep >= 4
  });

  const { data: timeSlots, refetch: refetchSlots } = useQuery<{ slots: TimeSlot[] }>({
    queryKey: ["/api/automated-patient-onboarding/providers", selectedProvider, "slots"],
    enabled: !!selectedProvider
  });

  const startMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/automated-patient-onboarding/start"),
    onSuccess: (data: any) => {
      setRegistrationId(data.registration.id);
      toast({ title: "Onboarding started", description: "Let's get you set up!" });
    }
  });

  const saveDemographicsMutation = useMutation({
    mutationFn: (data: { demographics: Demographics; fhirSourceId?: string }) =>
      apiRequest("POST", `/api/automated-patient-onboarding/${registrationId}/demographics`, data),
    onSuccess: () => {
      setCurrentStep(3);
      toast({ title: "Demographics saved", description: "Now let's add your medical history." });
    }
  });

  const saveMedicalHistoryMutation = useMutation({
    mutationFn: (data: MedicalHistory) =>
      apiRequest("POST", `/api/automated-patient-onboarding/${registrationId}/medical-history`, data),
    onSuccess: () => {
      setCurrentStep(4);
      toast({ title: "Medical history saved", description: "Now let's schedule your first appointment." });
    }
  });

  const scheduleAppointmentMutation = useMutation({
    mutationFn: (data: { slotId: string; appointmentType: string }) =>
      apiRequest("POST", `/api/automated-patient-onboarding/${registrationId}/schedule-appointment`, data),
    onSuccess: () => {
      setCurrentStep(5);
      toast({ title: "Appointment scheduled!", description: "Review your information to complete onboarding." });
    }
  });

  const completeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/automated-patient-onboarding/${registrationId}/complete`),
    onSuccess: (data: any) => {
      setCompletionMessage(data.welcomeMessage);
      toast({ title: "Welcome to Tabula Medica!", description: "Your onboarding is complete." });
    }
  });

  const { data: fhirPrefillData } = useQuery<{ prefillData: any }>({
    queryKey: ["/api/automated-patient-onboarding/fhir-prefill", selectedFHIRSource],
    enabled: !!selectedFHIRSource
  });

  useEffect(() => {
    if (fhirPrefillData?.prefillData) {
      const prefill = fhirPrefillData.prefillData;
      if (prefill.demographics) {
        setDemographics(prev => ({
          ...prev,
          ...prefill.demographics,
          address: { ...prev.address, ...prefill.demographics.address },
          emergencyContact: { ...prev.emergencyContact }
        }));
      }
      if (prefill.conditions) {
        setMedicalHistory(prev => ({
          ...prev,
          conditions: prefill.conditions
        }));
      }
      if (prefill.allergies) {
        setMedicalHistory(prev => ({
          ...prev,
          allergies: prefill.allergies
        }));
      }
      if (prefill.medications) {
        setMedicalHistory(prev => ({
          ...prev,
          medications: prefill.medications
        }));
      }
      toast({
        title: "Data imported from EHR",
        description: `Imported from ${prefill.sourceSystem}`
      });
    }
  }, [fhirPrefillData, toast]);

  const handleStartOnboarding = () => {
    startMutation.mutate();
    setCurrentStep(1);
  };

  const handleNextFromFHIR = () => {
    setCurrentStep(2);
  };

  const handleSaveDemographics = () => {
    if (!demographics.firstName || !demographics.lastName || !demographics.email) {
      toast({ title: "Missing required fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    saveDemographicsMutation.mutate({
      demographics,
      fhirSourceId: selectedFHIRSource || undefined
    });
  };

  const handleSaveMedicalHistory = () => {
    saveMedicalHistoryMutation.mutate(medicalHistory);
  };

  const handleScheduleAppointment = () => {
    if (!selectedSlot) {
      toast({ title: "Select a time slot", description: "Please select an appointment time.", variant: "destructive" });
      return;
    }
    scheduleAppointmentMutation.mutate({ slotId: selectedSlot, appointmentType });
  };

  const handleComplete = () => {
    completeMutation.mutate();
  };

  const addCondition = () => {
    setMedicalHistory(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        id: `cond-${Date.now()}`,
        name: "",
        status: "active",
        severity: "mild",
        source: "patient_reported"
      }]
    }));
  };

  const addAllergy = () => {
    setMedicalHistory(prev => ({
      ...prev,
      allergies: [...prev.allergies, {
        id: `allergy-${Date.now()}`,
        allergen: "",
        severity: "mild",
        source: "patient_reported"
      }]
    }));
  };

  const addMedication = () => {
    setMedicalHistory(prev => ({
      ...prev,
      medications: [...prev.medications, {
        id: `med-${Date.now()}`,
        name: "",
        source: "patient_reported"
      }]
    }));
  };

  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="h-6 w-6 text-primary" />
                <CardTitle>Patient Onboarding</CardTitle>
              </div>
              {registrationId && (
                <Badge variant="outline" className="text-xs">
                  ID: {registrationId.slice(0, 12)}...
                </Badge>
              )}
            </div>
            <CardDescription>
              Secure registration with FHIR data import and appointment scheduling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={progressPercent} className="h-2 mb-4" />
            <div className="flex justify-between">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={`flex flex-col items-center text-center ${
                    step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                      step.id < currentStep
                        ? "bg-primary text-primary-foreground"
                        : step.id === currentStep
                        ? "bg-primary/20 border-2 border-primary"
                        : "bg-muted"
                    }`}
                  >
                    {step.id < currentStep ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <step.icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-xs hidden sm:block">{step.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {!registrationId ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Welcome to Tabula Medica
              </CardTitle>
              <CardDescription>
                Complete your secure registration to access your health records and schedule your first appointment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>What to expect</AlertTitle>
                <AlertDescription>
                  This process takes about 10 minutes. You can import data from your existing EHR to save time.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <Database className="h-8 w-8 text-primary mb-2" />
                  <h4 className="font-medium">Import from EHR</h4>
                  <p className="text-sm text-muted-foreground">Connect your existing health records</p>
                </Card>
                <Card className="p-4">
                  <FileText className="h-8 w-8 text-primary mb-2" />
                  <h4 className="font-medium">Complete Forms</h4>
                  <p className="text-sm text-muted-foreground">Demographics and medical history</p>
                </Card>
                <Card className="p-4">
                  <Calendar className="h-8 w-8 text-primary mb-2" />
                  <h4 className="font-medium">Schedule Visit</h4>
                  <p className="text-sm text-muted-foreground">Book your first appointment</p>
                </Card>
              </div>
              <Button 
                onClick={handleStartOnboarding} 
                className="w-full" 
                size="lg"
                disabled={startMutation.isPending}
                data-testid="button-start-onboarding"
              >
                {startMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Begin Registration
              </Button>
            </CardContent>
          </Card>
        ) : currentStep === 1 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Connect Your Health Records
              </CardTitle>
              <CardDescription>
                Import data from your existing EHR to pre-fill your information (optional)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {fhirSources?.sources.map((source) => (
                  <Card
                    key={source.id}
                    className={`p-4 cursor-pointer hover-elevate ${
                      selectedFHIRSource === source.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedFHIRSource(source.id)}
                    data-testid={`fhir-source-${source.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Building className="h-8 w-8 text-primary" />
                        <div>
                          <h4 className="font-medium">{source.name}</h4>
                          <p className="text-sm text-muted-foreground">{source.system}</p>
                        </div>
                      </div>
                      {selectedFHIRSource === source.id && (
                        <Badge className="bg-primary">Selected</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleNextFromFHIR} className="flex-1">
                  Skip - Enter Manually
                </Button>
                <Button 
                  onClick={handleNextFromFHIR} 
                  className="flex-1"
                  disabled={!selectedFHIRSource}
                  data-testid="button-continue-demographics"
                >
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : currentStep === 2 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Enter your demographic information
                {selectedFHIRSource && (
                  <Badge variant="secondary" className="ml-2">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Pre-filled from EHR
                  </Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={demographics.firstName}
                        onChange={(e) => setDemographics(prev => ({ ...prev, firstName: e.target.value }))}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={demographics.lastName}
                        onChange={(e) => setDemographics(prev => ({ ...prev, lastName: e.target.value }))}
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="dob">Date of Birth *</Label>
                      <Input
                        id="dob"
                        type="date"
                        value={demographics.dateOfBirth}
                        onChange={(e) => setDemographics(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        data-testid="input-dob"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender *</Label>
                      <Select
                        value={demographics.gender}
                        onValueChange={(value) => setDemographics(prev => ({ ...prev, gender: value }))}
                      >
                        <SelectTrigger data-testid="select-gender">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                          <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={demographics.email}
                        onChange={(e) => setDemographics(prev => ({ ...prev, email: e.target.value }))}
                        data-testid="input-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone *</Label>
                      <Input
                        id="phone"
                        value={demographics.phone}
                        onChange={(e) => setDemographics(prev => ({ ...prev, phone: e.target.value }))}
                        data-testid="input-phone"
                      />
                    </div>
                  </div>
                  <Separator />
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Address
                  </h4>
                  <div>
                    <Label htmlFor="street">Street Address *</Label>
                    <Input
                      id="street"
                      value={demographics.address.street}
                      onChange={(e) => setDemographics(prev => ({
                        ...prev,
                        address: { ...prev.address, street: e.target.value }
                      }))}
                      data-testid="input-street"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={demographics.address.city}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          address: { ...prev.address, city: e.target.value }
                        }))}
                        data-testid="input-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State *</Label>
                      <Input
                        id="state"
                        value={demographics.address.state}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          address: { ...prev.address, state: e.target.value }
                        }))}
                        data-testid="input-state"
                      />
                    </div>
                    <div>
                      <Label htmlFor="zip">ZIP Code *</Label>
                      <Input
                        id="zip"
                        value={demographics.address.zipCode}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          address: { ...prev.address, zipCode: e.target.value }
                        }))}
                        data-testid="input-zip"
                      />
                    </div>
                  </div>
                  <Separator />
                  <h4 className="font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Emergency Contact
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="ecName">Name *</Label>
                      <Input
                        id="ecName"
                        value={demographics.emergencyContact.name}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                        }))}
                        data-testid="input-ec-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ecRel">Relationship *</Label>
                      <Input
                        id="ecRel"
                        value={demographics.emergencyContact.relationship}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                        }))}
                        data-testid="input-ec-relationship"
                      />
                    </div>
                    <div>
                      <Label htmlFor="ecPhone">Phone *</Label>
                      <Input
                        id="ecPhone"
                        value={demographics.emergencyContact.phone}
                        onChange={(e) => setDemographics(prev => ({
                          ...prev,
                          emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                        }))}
                        data-testid="input-ec-phone"
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleSaveDemographics}
                  className="flex-1"
                  disabled={saveDemographicsMutation.isPending}
                  data-testid="button-save-demographics"
                >
                  {saveDemographicsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save & Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : currentStep === 3 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-primary" />
                Medical History
              </CardTitle>
              <CardDescription>
                Add your health conditions, allergies, and medications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FieldCaption className="text-base font-medium flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" /> Conditions
                      </FieldCaption>
                      <Button size="sm" variant="outline" onClick={addCondition}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {medicalHistory.conditions.map((cond, idx) => (
                      <div key={cond.id} className="flex gap-2 mb-2">
                        <Input
                          placeholder="Condition name"
                          value={cond.name}
                          onChange={(e) => {
                            const updated = [...medicalHistory.conditions];
                            updated[idx].name = e.target.value;
                            setMedicalHistory(prev => ({ ...prev, conditions: updated }));
                          }}
                          className="flex-1"
                          data-testid={`input-condition-${idx}`}
                        />
                        <Select
                          value={cond.status}
                          onValueChange={(v: "active" | "resolved" | "managed") => {
                            const updated = [...medicalHistory.conditions];
                            updated[idx].status = v;
                            setMedicalHistory(prev => ({ ...prev, conditions: updated }));
                          }}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="managed">Managed</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                        {cond.source === "fhir_imported" && (
                          <Badge variant="secondary" className="shrink-0">FHIR</Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setMedicalHistory(prev => ({
                              ...prev,
                              conditions: prev.conditions.filter(c => c.id !== cond.id)
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {medicalHistory.conditions.length === 0 && (
                      <p className="text-sm text-muted-foreground">No conditions added yet</p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FieldCaption className="text-base font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Allergies
                      </FieldCaption>
                      <Button size="sm" variant="outline" onClick={addAllergy}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {medicalHistory.allergies.map((allergy, idx) => (
                      <div key={allergy.id} className="flex gap-2 mb-2">
                        <Input
                          placeholder="Allergen"
                          value={allergy.allergen}
                          onChange={(e) => {
                            const updated = [...medicalHistory.allergies];
                            updated[idx].allergen = e.target.value;
                            setMedicalHistory(prev => ({ ...prev, allergies: updated }));
                          }}
                          className="flex-1"
                          data-testid={`input-allergy-${idx}`}
                        />
                        <Select
                          value={allergy.severity}
                          onValueChange={(v: "mild" | "moderate" | "severe") => {
                            const updated = [...medicalHistory.allergies];
                            updated[idx].severity = v;
                            setMedicalHistory(prev => ({ ...prev, allergies: updated }));
                          }}
                        >
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mild">Mild</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="severe">Severe</SelectItem>
                          </SelectContent>
                        </Select>
                        {allergy.source === "fhir_imported" && (
                          <Badge variant="secondary" className="shrink-0">FHIR</Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setMedicalHistory(prev => ({
                              ...prev,
                              allergies: prev.allergies.filter(a => a.id !== allergy.id)
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {medicalHistory.allergies.length === 0 && (
                      <p className="text-sm text-muted-foreground">No allergies added yet</p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FieldCaption className="text-base font-medium flex items-center gap-2">
                        <Pill className="h-4 w-4" /> Medications
                      </FieldCaption>
                      <Button size="sm" variant="outline" onClick={addMedication}>
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                    {medicalHistory.medications.map((med, idx) => (
                      <div key={med.id} className="flex gap-2 mb-2">
                        <Input
                          placeholder="Medication name"
                          value={med.name}
                          onChange={(e) => {
                            const updated = [...medicalHistory.medications];
                            updated[idx].name = e.target.value;
                            setMedicalHistory(prev => ({ ...prev, medications: updated }));
                          }}
                          className="flex-1"
                          data-testid={`input-medication-${idx}`}
                        />
                        <Input
                          placeholder="Dosage"
                          value={med.dosage || ""}
                          onChange={(e) => {
                            const updated = [...medicalHistory.medications];
                            updated[idx].dosage = e.target.value;
                            setMedicalHistory(prev => ({ ...prev, medications: updated }));
                          }}
                          className="w-24"
                        />
                        {med.source === "fhir_imported" && (
                          <Badge variant="secondary" className="shrink-0">FHIR</Badge>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setMedicalHistory(prev => ({
                              ...prev,
                              medications: prev.medications.filter(m => m.id !== med.id)
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    {medicalHistory.medications.length === 0 && (
                      <p className="text-sm text-muted-foreground">No medications added yet</p>
                    )}
                  </div>
                </div>
              </ScrollArea>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleSaveMedicalHistory}
                  className="flex-1"
                  disabled={saveMedicalHistoryMutation.isPending}
                  data-testid="button-save-medical-history"
                >
                  {saveMedicalHistoryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save & Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : currentStep === 4 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Schedule Your First Appointment
              </CardTitle>
              <CardDescription>
                Choose a provider and time for your initial consultation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <FieldCaption className="text-base font-medium mb-2 block">Appointment Type</FieldCaption>
                  <RadioGroup
                    value={appointmentType}
                    onValueChange={setAppointmentType}
                    className="grid grid-cols-1 md:grid-cols-3 gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="initial_consultation" id="initial" />
                      <Label htmlFor="initial" className="cursor-pointer">Initial Consultation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="wellness_check" id="wellness" />
                      <Label htmlFor="wellness" className="cursor-pointer">Wellness Check</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="telehealth_intro" id="telehealth" />
                      <Label htmlFor="telehealth" className="cursor-pointer">Telehealth Intro</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div>
                  <FieldCaption className="text-base font-medium mb-2 block">Select Provider</FieldCaption>
                  <div className="grid gap-3">
                    {providers?.providers.map((provider) => (
                      <Card
                        key={provider.id}
                        className={`p-4 cursor-pointer hover-elevate ${
                          selectedProvider === provider.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setSelectedSlot(null);
                        }}
                        data-testid={`provider-${provider.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <Stethoscope className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <h4 className="font-medium">{provider.name}</h4>
                              <p className="text-sm text-muted-foreground">{provider.specialty}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {provider.telehealthAvailable && (
                                  <Badge variant="outline" className="text-xs">
                                    <Video className="h-3 w-3 mr-1" /> Telehealth
                                  </Badge>
                                )}
                                {provider.inPersonAvailable && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building className="h-3 w-3 mr-1" /> In-person
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {provider.rating && (
                            <Badge variant="secondary">{provider.rating.toFixed(1)} ★</Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                {selectedProvider && timeSlots?.slots && (
                  <>
                    <Separator />
                    <div>
                      <FieldCaption className="text-base font-medium mb-2 block">Available Times</FieldCaption>
                      <ScrollArea className="h-[200px]">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {timeSlots.slots.slice(0, 12).map((slot) => (
                            <Button
                              key={slot.id}
                              variant={selectedSlot === slot.id ? "default" : "outline"}
                              className="justify-start h-auto py-2"
                              onClick={() => setSelectedSlot(slot.id)}
                              data-testid={`slot-${slot.id}`}
                            >
                              <div className="text-left">
                                <div className="flex items-center gap-1">
                                  {slot.isTelehealth ? (
                                    <Video className="h-3 w-3" />
                                  ) : (
                                    <Building className="h-3 w-3" />
                                  )}
                                  <span className="text-xs">
                                    {new Date(slot.startTime).toLocaleDateString(undefined, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric"
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span className="text-xs">
                                    {new Date(slot.startTime).toLocaleTimeString(undefined, {
                                      hour: "numeric",
                                      minute: "2-digit"
                                    })}
                                  </span>
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back
                </Button>
                <Button
                  onClick={handleScheduleAppointment}
                  className="flex-1"
                  disabled={!selectedSlot || scheduleAppointmentMutation.isPending}
                  data-testid="button-schedule-appointment"
                >
                  {scheduleAppointmentMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  Schedule Appointment
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : currentStep === 5 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Review & Complete
              </CardTitle>
              <CardDescription>
                Confirm your information to complete registration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {completionMessage ? (
                  <Alert className="bg-primary/10 border-primary">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertTitle>Welcome!</AlertTitle>
                    <AlertDescription>{completionMessage}</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <Card className="p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <User className="h-4 w-4" /> Demographics
                      </h4>
                      <p className="text-sm">
                        {demographics.firstName} {demographics.lastName} | {demographics.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {demographics.address.city}, {demographics.address.state}
                      </p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4" /> Medical History
                      </h4>
                      <p className="text-sm">
                        {medicalHistory.conditions.length} conditions, {medicalHistory.allergies.length} allergies, {medicalHistory.medications.length} medications
                      </p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4" /> First Appointment
                      </h4>
                      <p className="text-sm">
                        {appointmentType.replace(/_/g, " ")} scheduled
                      </p>
                    </Card>
                  </>
                )}
              </div>
              {!completionMessage && (
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    className="flex-1"
                    disabled={completeMutation.isPending}
                    data-testid="button-complete-onboarding"
                  >
                    {completeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Complete Registration
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Alert className="mt-6" variant="default">
          <Shield className="h-4 w-4" />
          <AlertTitle>Secure & HIPAA Compliant</AlertTitle>
          <AlertDescription className="text-xs">
            {metadata?.noCdsDisclaimer || "Your information is protected and handled in compliance with healthcare privacy regulations."}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
