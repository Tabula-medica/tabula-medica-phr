import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import type {
  OnboardingStep as SchemaOnboardingStep,
  PatientOnboardingFormData,
  PersonalizedWelcome,
  HealthAssessmentQuestion,
  RpmDeviceType,
} from "@shared/schema";
import {
  Heart,
  User,
  FileText,
  Pill,
  AlertTriangle,
  Phone,
  Shield,
  Activity,
  ClipboardCheck,
  Upload,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Bluetooth,
  Loader2,
  Plus,
  X,
  HelpCircle,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { LoadingState } from "@/components/shared";

type OnboardingStep =
  | "welcome"
  | "personal_info"
  | "medical_history"
  | "medications"
  | "allergies"
  | "emergency_contacts"
  | "insurance"
  | "rpm_devices"
  | "health_assessment"
  | "document_upload"
  | "consent"
  | "complete";

const STEP_CONFIG: Record<OnboardingStep, { title: string; description: string; icon: typeof Heart }> = {
  welcome: { title: "Welcome", description: "Get started with your health portal", icon: Heart },
  personal_info: { title: "Personal Information", description: "Tell us about yourself", icon: User },
  medical_history: { title: "Medical History", description: "Your health background", icon: FileText },
  medications: { title: "Medications", description: "Current medications", icon: Pill },
  allergies: { title: "Allergies", description: "Known allergies and reactions", icon: AlertTriangle },
  emergency_contacts: { title: "Emergency Contacts", description: "Who to contact in emergencies", icon: Phone },
  insurance: { title: "Insurance", description: "Your insurance information", icon: Shield },
  rpm_devices: { title: "Health Devices", description: "Connect your monitoring devices", icon: Activity },
  health_assessment: { title: "Health Assessment", description: "Initial health questionnaire", icon: ClipboardCheck },
  document_upload: { title: "Documents", description: "Upload medical documents", icon: Upload },
  consent: { title: "Consent", description: "Review and accept terms", icon: CheckCircle2 },
  complete: { title: "Complete", description: "You're all set!", icon: Sparkles },
};

const STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "personal_info",
  "medical_history",
  "medications",
  "allergies",
  "emergency_contacts",
  "insurance",
  "rpm_devices",
  "health_assessment",
  "document_upload",
  "consent",
  "complete",
];

interface FormData {
  personalInfo?: {
    firstName: string;
    middleName: string;
    lastName: string;
    suffix?: string;
    preferredName?: string;
    dateOfBirth: string;
    gender: string;
    sexAtBirth?: string;
    pronouns?: string;
    email: string;
    phone: string;
    alternatePhone?: string;
    address: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    country?: string;
    preferredLanguage?: string;
    race?: string[];
    ethnicity?: string;
    maritalStatus?: string;
    ssn?: string;
  };
  medicalHistory?: {
    conditions: string[];
    surgeries: { name: string; date: string }[];
    familyHistory: { condition: string; relation: string }[];
  };
  medications?: { name: string; dosage: string; frequency: string }[];
  allergies?: { allergen: string; reaction: string; severity: string }[];
  emergencyContacts?: { 
    name: string; 
    relationship: string; 
    phone: string; 
    alternatePhone?: string;
    email?: string;
    address?: string;
    isPrimaryContact: boolean;
    canMakeMedicalDecisions?: boolean;
  }[];
  insurance?: { 
    provider: string; 
    policyNumber: string; 
    groupNumber: string;
    planType?: string;
    subscriberName?: string;
    subscriberRelationship?: string;
    subscriberDob?: string;
    effectiveDate?: string;
    copay?: string;
    hasSecondaryInsurance?: boolean;
    secondaryProvider?: string;
    secondaryPolicyNumber?: string;
    secondaryGroupNumber?: string;
  };
  consent?: { 
    termsAccepted: boolean; 
    privacyPolicyAccepted: boolean; 
    dataProcessingConsent: boolean;
    hipaaAiDisclosure: boolean;
    fastenHealthAuthorization: boolean;
    hipaaAcknowledgement?: boolean;
    treatmentConsent?: boolean;
    billingConsent?: boolean;
    telemedConsent?: boolean;
    researchConsent?: boolean;
    marketingConsent?: boolean;
    communicationPreferences?: {
      email: boolean;
      sms: boolean;
      phone: boolean;
      mail: boolean;
    };
    electronicSignature?: string;
    signatureDate?: string;
  };
}

export default function PatientOnboarding() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [formData, setFormData] = useState<FormData>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<PersonalizedWelcome | null>(null);

  const { data: healthQuestions, isLoading: questionsLoading, isError: questionsError } = useQuery<HealthAssessmentQuestion[]>({
    queryKey: ["/api/onboarding/health-assessment/questions"],
    enabled: currentStep === "health_assessment",
  });

  const { data: deviceTypes, isLoading: devicesLoading, isError: devicesError } = useQuery<RpmDeviceType[]>({
    queryKey: ["/api/onboarding/rpm/device-types"],
    enabled: currentStep === "rpm_devices",
  });

  const welcomeMutation = useMutation({
    mutationFn: async (data: { formData: PatientOnboardingFormData }) => {
      const res = await apiRequest("POST", "/api/onboarding/ai/personalized-welcome", data);
      return res.json();
    },
    onSuccess: (data) => {
      setWelcomeMessage(data);
    },
    onError: () => {
      setWelcomeMessage({
        greeting: "Welcome!",
        introduction: "We're excited to help you manage your health journey.",
        keyBenefits: ["Access all records in one place", "Get personalized insights", "Stay connected with providers"],
        recommendedActions: ["Complete your profile", "Add your medications"],
        estimatedTime: "10-15 minutes",
        generatedAt: new Date().toISOString(),
      });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/sessions", { userId: "current-user" });
      return res.json();
    },
    onSuccess: (data) => {
      setSessionId(data.id);
      welcomeMutation.mutate({ formData: {} });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create session. Please refresh the page.", variant: "destructive" });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (data: { step: OnboardingStep; formData: FormData; isComplete?: boolean }) => {
      if (!sessionId) return;
      const res = await apiRequest("POST", `/api/onboarding/sessions/${sessionId}/step`, data);
      return res.json();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save progress.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!sessionId && !createSessionMutation.isPending) {
      createSessionMutation.mutate();
    }
  }, []);

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEP_ORDER.length) * 100;

  const goToNextStep = () => {
    if (currentStep === "consent") {
      const c = formData.consent;
      if (!c?.termsAccepted || !c?.privacyPolicyAccepted || !c?.dataProcessingConsent || !c?.hipaaAiDisclosure || !c?.fastenHealthAuthorization) {
        toast({
          title: "Required Consents",
          description: "Please accept all required consent agreements before completing setup.",
          variant: "destructive",
        });
        return;
      }
    }
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      const nextStep = STEP_ORDER[nextIndex];
      const isComplete = nextStep === "complete";
      updateSessionMutation.mutate({ step: nextStep, formData, isComplete });
      setCurrentStep(nextStep);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const updateFormData = (section: keyof FormData, data: any) => {
    setFormData((prev) => ({ ...prev, [section]: data }));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "welcome":
        return <WelcomeStep welcome={welcomeMessage} isLoading={welcomeMutation.isPending || createSessionMutation.isPending} />;
      case "personal_info":
        return <PersonalInfoStep data={formData.personalInfo} onChange={(d) => updateFormData("personalInfo", d)} />;
      case "medical_history":
        return <MedicalHistoryStep data={formData.medicalHistory} onChange={(d) => updateFormData("medicalHistory", d)} />;
      case "medications":
        return <MedicationsStep data={formData.medications} onChange={(d) => updateFormData("medications", d)} />;
      case "allergies":
        return <AllergiesStep data={formData.allergies} onChange={(d) => updateFormData("allergies", d)} />;
      case "emergency_contacts":
        return <EmergencyContactsStep data={formData.emergencyContacts} onChange={(d) => updateFormData("emergencyContacts", d)} />;
      case "insurance":
        return <InsuranceStep data={formData.insurance} onChange={(d) => updateFormData("insurance", d)} />;
      case "rpm_devices":
        return <RpmDevicesStep sessionId={sessionId} deviceTypes={deviceTypes} isLoading={devicesLoading} isError={devicesError} />;
      case "health_assessment":
        return <HealthAssessmentStep questions={healthQuestions} sessionId={sessionId} isLoading={questionsLoading} isError={questionsError} />;
      case "document_upload":
        return <DocumentUploadStep sessionId={sessionId} />;
      case "consent":
        return <ConsentStep data={formData.consent} onChange={(d) => updateFormData("consent", d)} />;
      case "complete":
        return <CompleteStep />;
      default:
        return null;
    }
  };

  const StepIcon = STEP_CONFIG[currentStep].icon;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="patient-onboarding-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 rounded-full">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="onboarding-title">Patient Onboarding</h1>
            <p className="text-muted-foreground">Let's get you set up with your health portal</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle data-testid="step-title">{STEP_CONFIG[currentStep].title}</CardTitle>
                  <CardDescription>{STEP_CONFIG[currentStep].description}</CardDescription>
                </div>
              </div>
              <Badge variant="outline" data-testid="step-progress">
                Step {currentStepIndex + 1} of {STEP_ORDER.length}
              </Badge>
            </div>
            <Progress value={progress} className="mt-4" data-testid="onboarding-progress" />
          </CardHeader>

          <Separator />

          <CardContent className="pt-6">
            <ScrollArea className="h-[500px] pr-4">{renderStepContent()}</ScrollArea>
          </CardContent>

          <Separator />

          <CardFooter className="flex justify-between pt-4">
            <Button variant="outline" onClick={goToPreviousStep} disabled={currentStepIndex === 0} data-testid="button-previous-step">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            {currentStep !== "complete" ? (
              <Button onClick={goToNextStep} data-testid="button-next-step">
                {currentStep === "consent" ? "Complete Setup" : "Continue"}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => (window.location.href = "/")} data-testid="button-go-to-dashboard">
                Go to Dashboard
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>

        <div className="flex gap-2 flex-wrap justify-center">
          {STEP_ORDER.map((step, index) => {
            const isCompleted = index < currentStepIndex;
            const isCurrent = step === currentStep;
            return (
              <button
                key={step}
                onClick={() => index <= currentStepIndex && setCurrentStep(step)}
                disabled={index > currentStepIndex}
                className={`w-3 h-3 rounded-full transition-colors ${isCompleted ? "bg-primary" : isCurrent ? "bg-primary/50" : "bg-muted"}`}
                data-testid={`step-indicator-${step}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ welcome, isLoading }: { welcome: any; isLoading: boolean }) {
  if (isLoading) {
    return <LoadingState message="Preparing your personalized welcome..." />;
  }

  return (
    <div className="space-y-6" data-testid="welcome-step">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold" data-testid="welcome-greeting">{welcome?.greeting || "Welcome!"}</h2>
        <p className="text-muted-foreground max-w-md mx-auto" data-testid="welcome-intro">{welcome?.introduction || "We're excited to help you manage your health journey."}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(welcome?.keyBenefits || ["Access all records in one place", "Get personalized insights", "Stay connected with providers", "Track your health goals"]).map((benefit: string, i: number) => (
          <Card key={i} className="hover-elevate">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-sm">{benefit}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Estimated time: {welcome?.estimatedTime || "10-15 minutes"}</p>
              <p className="text-sm text-muted-foreground">You can save your progress and continue later</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PersonalInfoStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [info, setInfo] = useState(data || { firstName: "", middleName: "NMN", lastName: "", dateOfBirth: "", gender: "", email: "", phone: "", address: "", city: "", state: "", zipCode: "" });

  const handleChange = (field: string, value: string) => {
    const updated = { ...info, [field]: value };
    setInfo(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="personal-info-step">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input id="firstName" value={info.firstName} onChange={(e) => handleChange("firstName", e.target.value)} placeholder="John" data-testid="input-first-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="middleName" className="flex items-center gap-2">
            Middle Name *
            <span className="text-xs text-muted-foreground">(USCDI required)</span>
          </Label>
          <div className="flex gap-2">
            <Input 
              id="middleName" 
              value={info.middleName} 
              onChange={(e) => handleChange("middleName", e.target.value)} 
              placeholder="Full middle name (not initial)" 
              data-testid="input-middle-name"
              className="flex-1"
            />
            <Button 
              type="button"
              variant={info.middleName === "NMN" ? "default" : "outline"}
              size="sm"
              onClick={() => handleChange("middleName", "NMN")}
              data-testid="button-nmn"
              title="No Middle Name - Patient confirmed they have no middle name"
            >
              NMN
            </Button>
            <Button 
              type="button"
              variant={info.middleName === "UNK" ? "default" : "outline"}
              size="sm"
              onClick={() => handleChange("middleName", "UNK")}
              data-testid="button-unk"
              title="Unknown - Middle name exists but is not known"
            >
              UNK
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Per HHS/ONC standards: Enter full middle name as shown on government ID. Use NMN if patient has no middle name, UNK if unknown.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input id="lastName" value={info.lastName} onChange={(e) => handleChange("lastName", e.target.value)} placeholder="Doe" data-testid="input-last-name" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dob">Date of Birth</Label>
          <Input id="dob" type="date" value={info.dateOfBirth} onChange={(e) => handleChange("dateOfBirth", e.target.value)} data-testid="input-dob" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={info.gender} onValueChange={(v) => handleChange("gender", v)}>
            <SelectTrigger data-testid="select-gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={info.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="john.doe@example.com" data-testid="input-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={info.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="(555) 123-4567" data-testid="input-phone" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Street Address</Label>
        <Input id="address" value={info.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Main St" data-testid="input-address" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" value={info.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="New York" data-testid="input-city" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" value={info.state} onChange={(e) => handleChange("state", e.target.value)} placeholder="NY" data-testid="input-state" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zipCode">ZIP Code</Label>
          <Input id="zipCode" value={info.zipCode} onChange={(e) => handleChange("zipCode", e.target.value)} placeholder="10001" data-testid="input-zip" />
        </div>
      </div>
    </div>
  );
}

function MedicalHistoryStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [history, setHistory] = useState(data || { conditions: [], surgeries: [], familyHistory: [] });
  const [newCondition, setNewCondition] = useState("");

  const addCondition = () => {
    if (newCondition.trim()) {
      const updated = { ...history, conditions: [...history.conditions, newCondition.trim()] };
      setHistory(updated);
      onChange(updated);
      setNewCondition("");
    }
  };

  const removeCondition = (index: number) => {
    const updated = { ...history, conditions: history.conditions.filter((_: any, i: number) => i !== index) };
    setHistory(updated);
    onChange(updated);
  };

  const commonConditions = ["Hypertension", "Diabetes Type 2", "Asthma", "Heart Disease", "Arthritis", "Depression", "Anxiety", "High Cholesterol"];

  return (
    <div className="space-y-6" data-testid="medical-history-step">
      <div className="space-y-4">
        <Label htmlFor="patient-onboarding-current-health-conditions">Current Health Conditions</Label>
        <div className="flex gap-2">
          <Input id="patient-onboarding-current-health-conditions" value={newCondition} onChange={(e) => setNewCondition(e.target.value)} placeholder="Add a condition..." onKeyDown={(e) => e.key === "Enter" && addCondition()} data-testid="input-new-condition" />
          <Button type="button" onClick={addCondition} data-testid="button-add-condition">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {history.conditions.map((condition: string, i: number) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {condition}
              <button onClick={() => removeCondition(i)} className="ml-1">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Quick add common conditions:</p>
          <div className="flex flex-wrap gap-2">
            {commonConditions.map((c) => (
              <Button
                key={c}
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!history.conditions.includes(c)) {
                    const updated = { ...history, conditions: [...history.conditions, c] };
                    setHistory(updated);
                    onChange(updated);
                  }
                }}
                disabled={history.conditions.includes(c)}
                data-testid={`button-add-${c.toLowerCase().replace(/\s/g, "-")}`}
              >
                {c}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MedicationsStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [medications, setMedications] = useState(data || []);
  const [newMed, setNewMed] = useState({ name: "", dosage: "", frequency: "" });

  const addMedication = () => {
    if (newMed.name.trim()) {
      const updated = [...medications, newMed];
      setMedications(updated);
      onChange(updated);
      setNewMed({ name: "", dosage: "", frequency: "" });
    }
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_: any, i: number) => i !== index);
    setMedications(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="medications-step">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-medication-name">Medication Name</Label>
          <Input id="patient-onboarding-medication-name" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="e.g., Lisinopril" data-testid="input-med-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-dosage">Dosage</Label>
          <Input id="patient-onboarding-dosage" value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} placeholder="e.g., 10mg" data-testid="input-med-dosage" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-frequency">Frequency</Label>
          <Input id="patient-onboarding-frequency" value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} placeholder="e.g., Once daily" data-testid="input-med-frequency" />
        </div>
      </div>
      <Button onClick={addMedication} disabled={!newMed.name.trim()} data-testid="button-add-medication">
        <Plus className="w-4 h-4 mr-2" /> Add Medication
      </Button>

      <div className="space-y-2">
        {medications.map((med: any, i: number) => (
          <Card key={i}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{med.name}</p>
                <p className="text-sm text-muted-foreground">
                  {med.dosage} - {med.frequency}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMedication(i)} data-testid={`button-remove-med-${i}`}>
                <X className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {medications.length === 0 && <p className="text-center text-muted-foreground py-8">No medications added yet</p>}
      </div>
    </div>
  );
}

function AllergiesStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [allergies, setAllergies] = useState(data || []);
  const [newAllergy, setNewAllergy] = useState({ allergen: "", reaction: "", severity: "mild" });

  const addAllergy = () => {
    if (newAllergy.allergen.trim()) {
      const updated = [...allergies, newAllergy];
      setAllergies(updated);
      onChange(updated);
      setNewAllergy({ allergen: "", reaction: "", severity: "mild" });
    }
  };

  const removeAllergy = (index: number) => {
    const updated = allergies.filter((_: any, i: number) => i !== index);
    setAllergies(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="allergies-step">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-allergen">Allergen</Label>
          <Input id="patient-onboarding-allergen" value={newAllergy.allergen} onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })} placeholder="e.g., Penicillin" data-testid="input-allergen" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-reaction">Reaction</Label>
          <Input id="patient-onboarding-reaction" value={newAllergy.reaction} onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })} placeholder="e.g., Hives" data-testid="input-reaction" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-severity">Severity</Label>
          <Select value={newAllergy.severity} onValueChange={(v) => setNewAllergy({ ...newAllergy, severity: v })}>
            <SelectTrigger id="patient-onboarding-severity" data-testid="select-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mild">Mild</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="severe">Severe</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={addAllergy} disabled={!newAllergy.allergen.trim()} data-testid="button-add-allergy">
        <Plus className="w-4 h-4 mr-2" /> Add Allergy
      </Button>

      <div className="space-y-2">
        {allergies.map((allergy: any, i: number) => (
          <Card key={i}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${allergy.severity === "severe" ? "text-red-500" : allergy.severity === "moderate" ? "text-yellow-500" : "text-blue-500"}`} />
                <div>
                  <p className="font-medium">{allergy.allergen}</p>
                  <p className="text-sm text-muted-foreground">{allergy.reaction}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={allergy.severity === "severe" ? "destructive" : "secondary"}>{allergy.severity}</Badge>
                <Button variant="ghost" size="icon" onClick={() => removeAllergy(i)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {allergies.length === 0 && <p className="text-center text-muted-foreground py-8">No allergies added</p>}
      </div>
    </div>
  );
}

function EmergencyContactsStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [contacts, setContacts] = useState(data || []);
  const [newContact, setNewContact] = useState({ name: "", relationship: "", phone: "", isPrimaryContact: false });

  const addContact = () => {
    if (newContact.name.trim() && newContact.phone.trim()) {
      const updated = [...contacts, newContact];
      setContacts(updated);
      onChange(updated);
      setNewContact({ name: "", relationship: "", phone: "", isPrimaryContact: false });
    }
  };

  const removeContact = (index: number) => {
    const updated = contacts.filter((_: any, i: number) => i !== index);
    setContacts(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="emergency-contacts-step">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-contact-name">Contact Name</Label>
          <Input id="patient-onboarding-contact-name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Jane Doe" data-testid="input-contact-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-relationship">Relationship</Label>
          <Input id="patient-onboarding-relationship" value={newContact.relationship} onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })} placeholder="Spouse" data-testid="input-relationship" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="patient-onboarding-phone">Phone</Label>
          <Input id="patient-onboarding-phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="(555) 123-4567" data-testid="input-contact-phone" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox checked={newContact.isPrimaryContact} onCheckedChange={(c) => setNewContact({ ...newContact, isPrimaryContact: !!c })} data-testid="checkbox-primary-contact" />
        <FieldCaption>Primary contact</FieldCaption>
      </div>
      <Button onClick={addContact} disabled={!newContact.name.trim() || !newContact.phone.trim()} data-testid="button-add-contact">
        <Plus className="w-4 h-4 mr-2" /> Add Contact
      </Button>

      <div className="space-y-2">
        {contacts.map((contact: any, i: number) => (
          <Card key={i}>
            <CardContent className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.relationship} - {contact.phone}
                  </p>
                </div>
                {contact.isPrimaryContact && <Badge>Primary</Badge>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeContact(i)}>
                <X className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {contacts.length === 0 && <p className="text-center text-muted-foreground py-8">No emergency contacts added</p>}
      </div>
    </div>
  );
}

function InsuranceStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [insurance, setInsurance] = useState(data || { provider: "", policyNumber: "", groupNumber: "" });

  const handleChange = (field: string, value: string) => {
    const updated = { ...insurance, [field]: value };
    setInsurance(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="insurance-step">
      <div className="space-y-2">
        <Label htmlFor="provider">Insurance Provider</Label>
        <Input id="provider" value={insurance.provider} onChange={(e) => handleChange("provider", e.target.value)} placeholder="Blue Cross Blue Shield" data-testid="input-provider" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="policyNumber">Policy Number</Label>
          <Input id="policyNumber" value={insurance.policyNumber} onChange={(e) => handleChange("policyNumber", e.target.value)} placeholder="ABC123456789" data-testid="input-policy-number" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="groupNumber">Group Number</Label>
          <Input id="groupNumber" value={insurance.groupNumber} onChange={(e) => handleChange("groupNumber", e.target.value)} placeholder="GRP001" data-testid="input-group-number" />
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">You can also upload images of your insurance cards in the Documents section.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function RpmDevicesStep({ sessionId, deviceTypes, isLoading, isError }: { sessionId: string | null; deviceTypes: RpmDeviceType[] | undefined; isLoading: boolean; isError: boolean }) {
  const { toast } = useToast();
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const { data: devices, refetch: refetchDevices, isLoading: devicesQueryLoading } = useQuery({
    queryKey: ["/api/onboarding/rpm/devices/session", sessionId],
    enabled: !!sessionId,
  });

  const { data: instructions, isLoading: instructionsLoading, isError: instructionsError } = useQuery({
    queryKey: ["/api/onboarding/rpm/setup-instructions", selectedDevice],
    enabled: !!selectedDevice,
  });

  const addDeviceMutation = useMutation({
    mutationFn: async (deviceType: string) => {
      const res = await apiRequest("POST", "/api/onboarding/rpm/devices", {
        onboardingSessionId: sessionId,
        deviceType,
        deviceName: deviceType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/rpm/devices/session", sessionId] });
      toast({ title: "Device added", description: "Follow the setup instructions to connect your device." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add device. Please try again.", variant: "destructive" });
    },
  });

  const deviceLabels: Record<string, string> = {
    blood_pressure_monitor: "Blood Pressure Monitor",
    glucose_monitor: "Glucose Monitor",
    pulse_oximeter: "Pulse Oximeter",
    weight_scale: "Smart Scale",
    thermometer: "Smart Thermometer",
    heart_rate_monitor: "Heart Rate Monitor",
    activity_tracker: "Activity Tracker",
    spirometer: "Spirometer",
    ecg_monitor: "ECG Monitor",
    sleep_tracker: "Sleep Tracker",
  };

  if (isLoading) {
    return <LoadingState message="Loading device options..." />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load device options. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6" data-testid="rpm-devices-step">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(deviceTypes || []).map((type: RpmDeviceType) => {
          const isAdded = devices?.some((d: any) => d.deviceType === type);
          return (
            <Card key={type} className={`hover-elevate cursor-pointer ${selectedDevice === type ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedDevice(type)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{deviceLabels[type] || type}</p>
                </div>
                {isAdded ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      addDeviceMutation.mutate(type);
                    }}
                    data-testid={`button-add-device-${type}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedDevice && instructionsLoading && (
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Loading setup instructions...</span>
          </CardContent>
        </Card>
      )}

      {selectedDevice && instructionsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load setup instructions. Please try selecting the device again.</AlertDescription>
        </Alert>
      )}

      {instructions && !instructionsLoading && !instructionsError && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5 text-primary" />
              Setup Instructions
            </CardTitle>
            <CardDescription>Estimated time: {instructions.estimatedSetupTime}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {instructions.steps?.map((step: any) => (
              <div key={step.stepNumber} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">{step.stepNumber}</div>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                  {step.tips && (
                    <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                      {step.tips.map((tip: string, i: number) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HealthAssessmentStep({ questions, sessionId, isLoading, isError }: { questions: HealthAssessmentQuestion[] | undefined; sessionId: string | null; isLoading: boolean; isError: boolean }) {
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const currentQuestion = questions?.[currentQuestionIndex];
  const totalQuestions = questions?.length || 0;

  const handleResponse = (questionId: string, answer: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: answer }));
  };

  if (isLoading) {
    return <LoadingState message="Loading health assessment..." />;
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load health assessment. Please try again later.</AlertDescription>
      </Alert>
    );
  }

  const renderQuestion = (q: HealthAssessmentQuestion) => {
    switch (q.type) {
      case "scale":
        return (
          <div className="space-y-4">
            <Slider min={q.scaleMin || 0} max={q.scaleMax || 10} step={1} value={[responses[q.id] || q.scaleMin || 0]} onValueChange={([v]) => handleResponse(q.id, v)} data-testid={`slider-${q.id}`} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{q.scaleLabels?.min}</span>
              <span className="font-medium">{responses[q.id] ?? "-"}</span>
              <span>{q.scaleLabels?.max}</span>
            </div>
          </div>
        );
      case "single_choice":
        return (
          <RadioGroup value={responses[q.id]} onValueChange={(v) => handleResponse(q.id, v)} data-testid={`radio-${q.id}`}>
            {q.options?.map((opt: string) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={opt} />
                <Label htmlFor={opt}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case "multiple_choice":
        return (
          <div className="space-y-2">
            {q.options?.map((opt: string) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  checked={(responses[q.id] || []).includes(opt)}
                  onCheckedChange={(checked) => {
                    const current = responses[q.id] || [];
                    handleResponse(q.id, checked ? [...current, opt] : current.filter((o: string) => o !== opt));
                  }}
                />
                <FieldCaption>{opt}</FieldCaption>
              </div>
            ))}
          </div>
        );
      case "boolean":
        return (
          <RadioGroup value={responses[q.id]?.toString()} onValueChange={(v) => handleResponse(q.id, v === "true")} data-testid={`radio-${q.id}`}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="yes" />
              <Label htmlFor="yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="no" />
              <Label htmlFor="no">No</Label>
            </div>
          </RadioGroup>
        );
      case "text":
        return <Textarea value={responses[q.id] || ""} onChange={(e) => handleResponse(q.id, e.target.value)} placeholder="Your answer..." data-testid={`textarea-${q.id}`} />;
      default:
        return null;
    }
  };

  if (!questions || questions.length === 0) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-6" data-testid="health-assessment-step">
      <div className="flex items-center justify-between">
        <Badge variant="outline">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </Badge>
        <Badge variant="secondary">{currentQuestion?.category}</Badge>
      </div>

      <Progress value={((currentQuestionIndex + 1) / totalQuestions) * 100} />

      <Card>
        <CardContent className="p-6 space-y-6">
          <p className="text-lg font-medium" data-testid="assessment-question">
            {currentQuestion?.question}
          </p>
          {renderQuestion(currentQuestion)}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentQuestionIndex((i) => Math.max(0, i - 1))} disabled={currentQuestionIndex === 0} data-testid="button-prev-question">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        <Button onClick={() => setCurrentQuestionIndex((i) => Math.min(totalQuestions - 1, i + 1))} disabled={currentQuestionIndex === totalQuestions - 1} data-testid="button-next-question">
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function DocumentUploadStep({ sessionId }: { sessionId: string | null }) {
  const documentTypes = [
    { value: "insurance_card", label: "Insurance Card" },
    { value: "id_document", label: "ID Document" },
    { value: "medical_record", label: "Medical Record" },
    { value: "lab_result", label: "Lab Result" },
    { value: "prescription", label: "Prescription" },
    { value: "immunization_record", label: "Immunization Record" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="space-y-6" data-testid="document-upload-step">
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">Upload Medical Documents</h3>
          <p className="text-sm text-muted-foreground mb-4">Drag and drop files here or click to browse</p>
          <Button data-testid="button-upload-document">
            <Upload className="w-4 h-4 mr-2" />
            Select Files
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {documentTypes.map((type) => (
          <Card key={type.value} className="hover-elevate">
            <CardContent className="p-4 flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <span>{type.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm">
            <strong>Secure Upload:</strong> Your documents are encrypted and stored securely. Only you and your authorized healthcare providers can access them.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentStep({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  const [consent, setConsent] = useState(data || { termsAccepted: false, privacyPolicyAccepted: false, dataProcessingConsent: false, hipaaAiDisclosure: false, fastenHealthAuthorization: false });

  const handleChange = (field: string, value: boolean) => {
    const updated = { ...consent, [field]: value };
    setConsent(updated);
    onChange(updated);
  };

  return (
    <div className="space-y-6" data-testid="consent-step">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox checked={consent.termsAccepted} onCheckedChange={(c) => handleChange("termsAccepted", !!c)} data-testid="checkbox-terms" />
            <div>
              <FieldCaption className="font-medium">Terms of Service</FieldCaption>
              <p className="text-sm text-muted-foreground">I agree to the Terms of Service and understand my rights and responsibilities as a user.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox checked={consent.privacyPolicyAccepted} onCheckedChange={(c) => handleChange("privacyPolicyAccepted", !!c)} data-testid="checkbox-privacy" />
            <div>
              <FieldCaption className="font-medium">Privacy Policy</FieldCaption>
              <p className="text-sm text-muted-foreground">I have read and understand how my health data will be collected, used, and protected.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox checked={consent.dataProcessingConsent} onCheckedChange={(c) => handleChange("dataProcessingConsent", !!c)} data-testid="checkbox-data-processing" />
            <div>
              <FieldCaption className="font-medium">Data Processing Consent</FieldCaption>
              <p className="text-sm text-muted-foreground">I consent to the processing of my health information to provide personalized care recommendations and insights.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox checked={consent.hipaaAiDisclosure} onCheckedChange={(c) => handleChange("hipaaAiDisclosure", !!c)} data-testid="checkbox-hipaa-ai-disclosure" />
            <div>
              <FieldCaption className="font-medium">HIPAA AI Disclosure <Badge variant="secondary" className="ml-1">Required</Badge></FieldCaption>
              <p className="text-sm text-muted-foreground">I authorize Tabula Medica to use AI to summarize my records. AI-generated summaries are for informational purposes only and do not replace professional medical advice. Your data is processed in compliance with HIPAA regulations.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox checked={consent.fastenHealthAuthorization} onCheckedChange={(c) => handleChange("fastenHealthAuthorization", !!c)} data-testid="checkbox-fasten-health" />
            <div>
              <FieldCaption className="font-medium">Fasten Health Record Retrieval <Badge variant="secondary" className="ml-1">Required</Badge></FieldCaption>
              <p className="text-sm text-muted-foreground">I authorize Fasten Health to retrieve my records from my selected hospitals. This allows Tabula Medica to securely import your health records from participating healthcare providers on your behalf.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompleteStep() {
  return (
    <div className="text-center space-y-6 py-8" data-testid="complete-step">
      <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-10 h-10 text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold mb-2">You're All Set!</h2>
        <p className="text-muted-foreground">Your health portal is ready. Start exploring your personalized dashboard.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardContent className="p-4 text-center">
            <Activity className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="font-medium">Track Vitals</p>
            <p className="text-sm text-muted-foreground">Monitor your health metrics</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="font-medium">View Records</p>
            <p className="text-sm text-muted-foreground">Access your medical history</p>
          </CardContent>
        </Card>
        <Card className="hover-elevate">
          <CardContent className="p-4 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-primary mb-2" />
            <p className="font-medium">AI Insights</p>
            <p className="text-sm text-muted-foreground">Get personalized recommendations</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
