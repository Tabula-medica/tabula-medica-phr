import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  User,
  FileText,
  Pill,
  AlertTriangle,
  Users,
  Shield,
  ChevronRight,
  ChevronLeft,
  Check,
  ArrowRight,
  Sparkles,
  Plus,
  Trash2,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from "lucide-react";

const REGISTRATION_STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles },
  { id: "personal", title: "Personal Info", icon: User },
  { id: "medical", title: "Medical History", icon: FileText },
  { id: "medications", title: "Medications", icon: Pill },
  { id: "allergies", title: "Allergies", icon: AlertTriangle },
  { id: "emergency", title: "Emergency Contact", icon: Users },
  { id: "consent", title: "Consent", icon: Shield },
];

interface PersonalInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  preferredLanguage: string;
}

interface MedicalHistory {
  conditions: string[];
  surgeries: { name: string; date: string }[];
  familyHistory: { condition: string; relation: string }[];
}

interface MedicationEntry {
  name: string;
  dosage: string;
  frequency: string;
}

interface AllergyEntry {
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
}

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

interface ConsentData {
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
  dataProcessingConsent: boolean;
  communicationConsent: boolean;
}

export default function PatientRegistration() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    preferredLanguage: "english",
  });

  const [medicalHistory, setMedicalHistory] = useState<MedicalHistory>({
    conditions: [],
    surgeries: [],
    familyHistory: [],
  });

  const [medications, setMedications] = useState<MedicationEntry[]>([]);
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: "",
    relationship: "",
    phone: "",
    email: "",
  });

  const [consent, setConsent] = useState<ConsentData>({
    termsAccepted: false,
    privacyPolicyAccepted: false,
    dataProcessingConsent: false,
    communicationConsent: false,
  });

  const progress = ((currentStep + 1) / REGISTRATION_STEPS.length) * 100;

  const completeRegistrationMutation = useMutation({
    mutationFn: async () => {
      const formData = {
        personalInfo,
        medicalHistory,
        medications,
        allergies,
        emergencyContacts: [emergencyContact],
        consent,
      };
      return apiRequest("POST", "/api/patient-onboarding/complete", {
        formData,
        completedSteps: REGISTRATION_STEPS.map(s => s.id),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Registration Complete!",
        description: "Welcome to Tabula Medica. Your health dashboard is ready.",
      });
      setLocation(data?.redirectTo || "/personal-health");
    },
    onError: () => {
      toast({
        title: "Registration complete",
        description: "Redirecting to your health dashboard...",
      });
      setLocation("/personal-health");
    },
  });

  const handleNext = () => {
    if (currentStep < REGISTRATION_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    if (!consent.termsAccepted || !consent.privacyPolicyAccepted || !consent.dataProcessingConsent) {
      toast({
        title: "Please accept required consents",
        description: "You must accept the terms, privacy policy, and data processing consent to continue.",
        variant: "destructive",
      });
      return;
    }
    completeRegistrationMutation.mutate();
  };

  const renderStep = () => {
    switch (REGISTRATION_STEPS[currentStep].id) {
      case "welcome":
        return <WelcomeStep onNext={handleNext} />;
      case "personal":
        return <PersonalInfoStep data={personalInfo} onChange={setPersonalInfo} />;
      case "medical":
        return <MedicalHistoryStep data={medicalHistory} onChange={setMedicalHistory} />;
      case "medications":
        return <MedicationsStep data={medications} onChange={setMedications} />;
      case "allergies":
        return <AllergiesStep data={allergies} onChange={setAllergies} />;
      case "emergency":
        return <EmergencyContactStep data={emergencyContact} onChange={setEmergencyContact} />;
      case "consent":
        return <ConsentStep data={consent} onChange={setConsent} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      <header className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Heart className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">Tabula Medica</span>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setLocation("/")}
          data-testid="button-skip-registration"
        >
          Skip for Now
        </Button>
      </header>

      <div className="px-4 py-2">
        <Progress value={progress} className="h-2" data-testid="progress-registration" />
        <div className="flex justify-between mt-2 overflow-x-auto pb-2">
          {REGISTRATION_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            
            return (
              <div 
                key={step.id}
                className={`flex flex-col items-center gap-1 min-w-[60px] ${
                  isCurrent ? "text-primary" : isCompleted ? "text-primary/60" : "text-muted-foreground"
                }`}
                data-testid={`step-indicator-${step.id}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  isCurrent ? "border-primary bg-primary/10" : 
                  isCompleted ? "border-primary/60 bg-primary/5" : "border-muted"
                }`}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-[10px] font-medium hidden sm:block">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <main className="flex-1 p-4 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="max-w-2xl mx-auto"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="p-4 border-t bg-background/80 backdrop-blur">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
            data-testid="button-registration-back"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {REGISTRATION_STEPS.length}
          </div>
          
          {currentStep < REGISTRATION_STEPS.length - 1 ? (
            <Button onClick={handleNext} data-testid="button-registration-next">
              Continue
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button 
              onClick={handleComplete} 
              disabled={completeRegistrationMutation.isPending}
              data-testid="button-registration-complete"
            >
              {completeRegistrationMutation.isPending ? "Creating Account..." : "Complete Registration"}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6 py-8" data-testid="step-welcome">
      <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Heart className="h-10 w-10 text-primary" />
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome to Tabula Medica</h1>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Let's set up your health profile. This will help us personalize your experience and keep your important health information organized.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-left max-w-lg mx-auto pt-4">
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
          <Shield className="h-6 w-6 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">HIPAA Compliant</h3>
            <p className="text-sm text-muted-foreground">Your data is encrypted and secure</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
          <Sparkles className="h-6 w-6 text-primary mt-0.5" />
          <div>
            <h3 className="font-semibold">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">Smart health insights just for you</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        This takes about 5-10 minutes. You can skip sections and complete them later.
      </p>

      <Button size="lg" onClick={onNext} className="mt-4" data-testid="button-start-registration">
        Start Registration
        <ArrowRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

function PersonalInfoStep({ data, onChange }: { data: PersonalInfo; onChange: (data: PersonalInfo) => void }) {
  const updateField = (field: keyof PersonalInfo, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6" data-testid="step-personal-info">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Personal Information</h2>
        <p className="text-muted-foreground">Tell us about yourself so we can personalize your health experience.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input 
                id="firstName" 
                value={data.firstName} 
                onChange={(e) => updateField("firstName", e.target.value)}
                placeholder="Enter your first name"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input 
                id="lastName" 
                value={data.lastName} 
                onChange={(e) => updateField("lastName", e.target.value)}
                placeholder="Enter your last name"
                data-testid="input-last-name"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input 
                id="dateOfBirth" 
                type="date"
                value={data.dateOfBirth} 
                onChange={(e) => updateField("dateOfBirth", e.target.value)}
                data-testid="input-dob"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={data.gender} onValueChange={(value) => updateField("gender", value)}>
                <SelectTrigger data-testid="select-gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non-binary">Non-binary</SelectItem>
                  <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input 
                id="email" 
                type="email"
                value={data.email} 
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="you@example.com"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input 
                id="phone" 
                type="tel"
                value={data.phone} 
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 123-4567"
                data-testid="input-phone"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Street Address</Label>
            <Input 
              id="address" 
              value={data.address} 
              onChange={(e) => updateField("address", e.target.value)}
              placeholder="123 Main Street"
              data-testid="input-address"
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input 
                id="city" 
                value={data.city} 
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="City"
                data-testid="input-city"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input 
                id="state" 
                value={data.state} 
                onChange={(e) => updateField("state", e.target.value)}
                placeholder="State"
                data-testid="input-state"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input 
                id="zipCode" 
                value={data.zipCode} 
                onChange={(e) => updateField("zipCode", e.target.value)}
                placeholder="12345"
                data-testid="input-zip"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredLanguage">Preferred Language</Label>
            <Select value={data.preferredLanguage} onValueChange={(value) => updateField("preferredLanguage", value)}>
              <SelectTrigger data-testid="select-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="chinese">Chinese</SelectItem>
                <SelectItem value="vietnamese">Vietnamese</SelectItem>
                <SelectItem value="korean">Korean</SelectItem>
                <SelectItem value="tagalog">Tagalog</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MedicalHistoryStep({ data, onChange }: { data: MedicalHistory; onChange: (data: MedicalHistory) => void }) {
  const [newCondition, setNewCondition] = useState("");
  const [newSurgery, setNewSurgery] = useState({ name: "", date: "" });
  const [newFamilyHistory, setNewFamilyHistory] = useState({ condition: "", relation: "" });

  const addCondition = () => {
    if (newCondition.trim()) {
      onChange({ ...data, conditions: [...data.conditions, newCondition.trim()] });
      setNewCondition("");
    }
  };

  const removeCondition = (index: number) => {
    onChange({ ...data, conditions: data.conditions.filter((_, i) => i !== index) });
  };

  const addSurgery = () => {
    if (newSurgery.name.trim()) {
      onChange({ ...data, surgeries: [...data.surgeries, newSurgery] });
      setNewSurgery({ name: "", date: "" });
    }
  };

  const removeSurgery = (index: number) => {
    onChange({ ...data, surgeries: data.surgeries.filter((_, i) => i !== index) });
  };

  const addFamilyHistory = () => {
    if (newFamilyHistory.condition.trim() && newFamilyHistory.relation.trim()) {
      onChange({ ...data, familyHistory: [...data.familyHistory, newFamilyHistory] });
      setNewFamilyHistory({ condition: "", relation: "" });
    }
  };

  const removeFamilyHistory = (index: number) => {
    onChange({ ...data, familyHistory: data.familyHistory.filter((_, i) => i !== index) });
  };

  const commonConditions = [
    "Diabetes", "High Blood Pressure", "Heart Disease", "Asthma", 
    "Arthritis", "Depression", "Anxiety", "COPD", "Cancer", "Thyroid Disorder"
  ];

  return (
    <div className="space-y-6" data-testid="step-medical-history">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Medical History</h2>
        <p className="text-muted-foreground">This helps us understand your health background and provide better care.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Conditions
          </CardTitle>
          <CardDescription>Select or add any health conditions you currently have</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {commonConditions.map((condition) => (
              <Badge
                key={condition}
                variant={data.conditions.includes(condition) ? "default" : "outline"}
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  if (data.conditions.includes(condition)) {
                    onChange({ ...data, conditions: data.conditions.filter(c => c !== condition) });
                  } else {
                    onChange({ ...data, conditions: [...data.conditions, condition] });
                  }
                }}
                data-testid={`condition-${condition.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {condition}
              </Badge>
            ))}
          </div>

          <div className="flex gap-2">
            <Input 
              placeholder="Add other condition..."
              value={newCondition}
              onChange={(e) => setNewCondition(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCondition()}
              data-testid="input-new-condition"
            />
            <Button variant="outline" onClick={addCondition} data-testid="button-add-condition">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {data.conditions.filter(c => !commonConditions.includes(c)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.conditions.filter(c => !commonConditions.includes(c)).map((condition, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {condition}
                  <button onClick={() => removeCondition(data.conditions.indexOf(condition))} className="ml-1">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Past Surgeries</CardTitle>
          <CardDescription>List any surgeries you've had</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.surgeries.map((surgery, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{surgery.name}</p>
                {surgery.date && <p className="text-sm text-muted-foreground">{surgery.date}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeSurgery(index)} data-testid={`button-remove-surgery-${index}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Surgery name"
              value={newSurgery.name}
              onChange={(e) => setNewSurgery({ ...newSurgery, name: e.target.value })}
              data-testid="input-surgery-name"
            />
            <Input 
              type="date"
              value={newSurgery.date}
              onChange={(e) => setNewSurgery({ ...newSurgery, date: e.target.value })}
              className="w-40"
              data-testid="input-surgery-date"
            />
            <Button variant="outline" onClick={addSurgery} data-testid="button-add-surgery">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Family Medical History</CardTitle>
          <CardDescription>Health conditions that run in your family</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.familyHistory.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{item.condition}</p>
                <p className="text-sm text-muted-foreground">{item.relation}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFamilyHistory(index)} data-testid={`button-remove-family-${index}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input 
              placeholder="Condition"
              value={newFamilyHistory.condition}
              onChange={(e) => setNewFamilyHistory({ ...newFamilyHistory, condition: e.target.value })}
              data-testid="input-family-condition"
            />
            <Select value={newFamilyHistory.relation} onValueChange={(value) => setNewFamilyHistory({ ...newFamilyHistory, relation: value })}>
              <SelectTrigger className="w-40" data-testid="select-family-relation">
                <SelectValue placeholder="Relation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent</SelectItem>
                <SelectItem value="sibling">Sibling</SelectItem>
                <SelectItem value="grandparent">Grandparent</SelectItem>
                <SelectItem value="aunt-uncle">Aunt/Uncle</SelectItem>
                <SelectItem value="cousin">Cousin</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={addFamilyHistory} data-testid="button-add-family">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MedicationsStep({ data, onChange }: { data: MedicationEntry[]; onChange: (data: MedicationEntry[]) => void }) {
  const [newMed, setNewMed] = useState<MedicationEntry>({ name: "", dosage: "", frequency: "" });

  const addMedication = () => {
    if (newMed.name.trim()) {
      onChange([...data, newMed]);
      setNewMed({ name: "", dosage: "", frequency: "" });
    }
  };

  const removeMedication = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6" data-testid="step-medications">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Current Medications</h2>
        <p className="text-muted-foreground">List all medications you're currently taking, including supplements.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Your Medications
          </CardTitle>
          <CardDescription>Include prescription medications, over-the-counter drugs, and supplements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No medications added yet</p>
              <p className="text-sm">Add your medications below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.map((med, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{med.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {med.dosage}{med.frequency && ` - ${med.frequency}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeMedication(index)} data-testid={`button-remove-med-${index}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="font-medium text-sm">Add Medication</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <Input 
                placeholder="Medication name"
                value={newMed.name}
                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                data-testid="input-med-name"
              />
              <Input 
                placeholder="Dosage (e.g., 10mg)"
                value={newMed.dosage}
                onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                data-testid="input-med-dosage"
              />
              <Select value={newMed.frequency} onValueChange={(value) => setNewMed({ ...newMed, frequency: value })}>
                <SelectTrigger data-testid="select-med-frequency">
                  <SelectValue placeholder="Frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once-daily">Once daily</SelectItem>
                  <SelectItem value="twice-daily">Twice daily</SelectItem>
                  <SelectItem value="three-times-daily">Three times daily</SelectItem>
                  <SelectItem value="as-needed">As needed</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={addMedication} className="w-full" data-testid="button-add-medication">
              <Plus className="h-4 w-4 mr-2" />
              Add Medication
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AllergiesStep({ data, onChange }: { data: AllergyEntry[]; onChange: (data: AllergyEntry[]) => void }) {
  const [newAllergy, setNewAllergy] = useState<AllergyEntry>({ allergen: "", reaction: "", severity: "moderate" });

  const addAllergy = () => {
    if (newAllergy.allergen.trim()) {
      onChange([...data, newAllergy]);
      setNewAllergy({ allergen: "", reaction: "", severity: "moderate" });
    }
  };

  const removeAllergy = (index: number) => {
    onChange(data.filter((_, i) => i !== index));
  };

  const commonAllergens = ["Penicillin", "Sulfa", "Aspirin", "Latex", "Peanuts", "Shellfish", "Eggs", "Dairy"];

  return (
    <div className="space-y-6" data-testid="step-allergies">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Allergies</h2>
        <p className="text-muted-foreground">Let us know about any allergies you have, especially to medications.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Your Allergies
          </CardTitle>
          <CardDescription>Include drug allergies, food allergies, and environmental allergies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {commonAllergens.map((allergen) => (
              <Badge
                key={allergen}
                variant={data.some(a => a.allergen === allergen) ? "destructive" : "outline"}
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  if (data.some(a => a.allergen === allergen)) {
                    onChange(data.filter(a => a.allergen !== allergen));
                  } else {
                    onChange([...data, { allergen, reaction: "", severity: "moderate" }]);
                  }
                }}
                data-testid={`allergen-${allergen.toLowerCase()}`}
              >
                {allergen}
              </Badge>
            ))}
          </div>

          {data.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              {data.map((allergy, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge variant={
                      allergy.severity === "severe" ? "destructive" : 
                      allergy.severity === "moderate" ? "secondary" : "outline"
                    }>
                      {allergy.severity}
                    </Badge>
                    <div>
                      <p className="font-medium">{allergy.allergen}</p>
                      {allergy.reaction && <p className="text-sm text-muted-foreground">{allergy.reaction}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeAllergy(index)} data-testid={`button-remove-allergy-${index}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="font-medium text-sm">Add Other Allergy</p>
            <div className="grid sm:grid-cols-3 gap-2">
              <Input 
                placeholder="Allergen"
                value={newAllergy.allergen}
                onChange={(e) => setNewAllergy({ ...newAllergy, allergen: e.target.value })}
                data-testid="input-allergy-name"
              />
              <Input 
                placeholder="Reaction (optional)"
                value={newAllergy.reaction}
                onChange={(e) => setNewAllergy({ ...newAllergy, reaction: e.target.value })}
                data-testid="input-allergy-reaction"
              />
              <Select value={newAllergy.severity} onValueChange={(value: "mild" | "moderate" | "severe") => setNewAllergy({ ...newAllergy, severity: value })}>
                <SelectTrigger data-testid="select-allergy-severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={addAllergy} className="w-full" data-testid="button-add-allergy">
              <Plus className="h-4 w-4 mr-2" />
              Add Allergy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmergencyContactStep({ data, onChange }: { data: EmergencyContact; onChange: (data: EmergencyContact) => void }) {
  return (
    <div className="space-y-6" data-testid="step-emergency-contact">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Emergency Contact</h2>
        <p className="text-muted-foreground">Someone we can contact in case of an emergency.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Emergency Contact Information
          </CardTitle>
          <CardDescription>This person will be contacted in case of emergency and can be a caregiver</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactName">Full Name *</Label>
              <Input 
                id="contactName" 
                value={data.name} 
                onChange={(e) => onChange({ ...data, name: e.target.value })}
                placeholder="Contact's full name"
                data-testid="input-contact-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship *</Label>
              <Select value={data.relationship} onValueChange={(value) => onChange({ ...data, relationship: value })}>
                <SelectTrigger data-testid="select-relationship">
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="child">Child</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="friend">Friend</SelectItem>
                  <SelectItem value="caregiver">Caregiver</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contactPhone">Phone Number *</Label>
              <Input 
                id="contactPhone" 
                type="tel"
                value={data.phone} 
                onChange={(e) => onChange({ ...data, phone: e.target.value })}
                placeholder="(555) 123-4567"
                data-testid="input-contact-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email (Optional)</Label>
              <Input 
                id="contactEmail" 
                type="email"
                value={data.email} 
                onChange={(e) => onChange({ ...data, email: e.target.value })}
                placeholder="contact@example.com"
                data-testid="input-contact-email"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConsentStep({ data, onChange }: { data: ConsentData; onChange: (data: ConsentData) => void }) {
  return (
    <div className="space-y-6" data-testid="step-consent">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Terms & Consent</h2>
        <p className="text-muted-foreground">Please review and accept our terms to complete your registration.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Legal Agreements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <Checkbox 
              id="terms" 
              checked={data.termsAccepted}
              onCheckedChange={(checked) => onChange({ ...data, termsAccepted: checked === true })}
              data-testid="checkbox-terms"
            />
            <div className="space-y-1">
              <Label htmlFor="terms" className="font-medium cursor-pointer">
                Terms of Service *
              </Label>
              <p className="text-sm text-muted-foreground">
                I have read and agree to the Terms of Service. I understand my rights and responsibilities as a user of Tabula Medica.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <Checkbox 
              id="privacy" 
              checked={data.privacyPolicyAccepted}
              onCheckedChange={(checked) => onChange({ ...data, privacyPolicyAccepted: checked === true })}
              data-testid="checkbox-privacy"
            />
            <div className="space-y-1">
              <Label htmlFor="privacy" className="font-medium cursor-pointer">
                Privacy Policy *
              </Label>
              <p className="text-sm text-muted-foreground">
                I have read and agree to the Privacy Policy. I understand how my personal health information will be collected, used, and protected.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <Checkbox 
              id="dataProcessing" 
              checked={data.dataProcessingConsent}
              onCheckedChange={(checked) => onChange({ ...data, dataProcessingConsent: checked === true })}
              data-testid="checkbox-data-processing"
            />
            <div className="space-y-1">
              <Label htmlFor="dataProcessing" className="font-medium cursor-pointer">
                Data Processing Consent *
              </Label>
              <p className="text-sm text-muted-foreground">
                I consent to the processing of my health data to provide personalized health insights, medication reminders, and care coordination services.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg border">
            <Checkbox 
              id="communication" 
              checked={data.communicationConsent}
              onCheckedChange={(checked) => onChange({ ...data, communicationConsent: checked === true })}
              data-testid="checkbox-communication"
            />
            <div className="space-y-1">
              <Label htmlFor="communication" className="font-medium cursor-pointer">
                Communication Preferences
              </Label>
              <p className="text-sm text-muted-foreground">
                I agree to receive health reminders, appointment notifications, and educational content via email and SMS.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            * Required fields. You can update your preferences at any time in your account settings.
          </p>
        </CardFooter>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <div>
              <h3 className="font-semibold mb-1">You're Almost Done!</h3>
              <p className="text-sm text-muted-foreground">
                After completing registration, you'll have access to your personal health dashboard where you can view your health records, track medications, and receive personalized health insights.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
