import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Heart,
  User,
  FileText,
  Pill,
  AlertTriangle,
  Phone,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Loader2,
  Plus,
  X,
  Info,
  Lightbulb,
  Search,
  ArrowLeft,
} from "lucide-react";
import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";

type OnboardingStep = "welcome" | "personal" | "conditions" | "medications" | "allergies" | "contacts" | "complete";

interface Condition {
  name: string;
  diagnosedYear?: string;
  status: "active" | "resolved" | "managed";
}

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  purpose?: string;
}

interface Allergy {
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
}

interface Contact {
  name: string;
  relationship: string;
  phone: string;
  isPrimary: boolean;
}

interface FormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  conditions: Condition[];
  medications: Medication[];
  allergies: Allergy[];
  emergencyContacts: Contact[];
}

const STEP_CONFIG: Record<OnboardingStep, { title: string; description: string; icon: typeof Heart }> = {
  welcome: { title: "Welcome", icon: Heart, description: "Let's set up your health profile" },
  personal: { title: "About You", icon: User, description: "Basic information" },
  conditions: { title: "Medical History", icon: FileText, description: "Your health conditions" },
  medications: { title: "Medications", icon: Pill, description: "Current medications" },
  allergies: { title: "Allergies", icon: AlertTriangle, description: "Known allergies" },
  contacts: { title: "Emergency Contacts", icon: Phone, description: "Who to contact" },
  complete: { title: "All Set!", icon: CheckCircle2, description: "You're ready to go" },
};

const STEP_ORDER: OnboardingStep[] = ["welcome", "personal", "conditions", "medications", "allergies", "contacts", "complete"];

const COMMON_CONDITIONS = [
  "Hypertension (High Blood Pressure)",
  "Type 2 Diabetes",
  "High Cholesterol",
  "Asthma",
  "Arthritis",
  "Anxiety",
  "Depression",
  "GERD/Acid Reflux",
  "Thyroid Disorder",
  "Heart Disease",
];

const COMMON_MEDICATIONS = [
  { name: "Lisinopril", purpose: "Blood Pressure", dosage: "10mg", frequency: "Once daily" },
  { name: "Metformin", purpose: "Diabetes", dosage: "500mg", frequency: "Twice daily" },
  { name: "Atorvastatin", purpose: "Cholesterol", dosage: "20mg", frequency: "Once daily" },
  { name: "Levothyroxine", purpose: "Thyroid", dosage: "50mcg", frequency: "Once daily" },
  { name: "Omeprazole", purpose: "Acid Reflux", dosage: "20mg", frequency: "Once daily" },
  { name: "Amlodipine", purpose: "Blood Pressure", dosage: "5mg", frequency: "Once daily" },
  { name: "Metoprolol", purpose: "Heart/Blood Pressure", dosage: "25mg", frequency: "Twice daily" },
  { name: "Sertraline", purpose: "Depression/Anxiety", dosage: "50mg", frequency: "Once daily" },
];

const COMMON_ALLERGIES = [
  "Penicillin",
  "Sulfa drugs",
  "Aspirin/NSAIDs",
  "Latex",
  "Peanuts",
  "Shellfish",
  "Eggs",
  "Bee stings",
  "Contrast dye",
];

export default function AIOnboarding() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("welcome");
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    conditions: [],
    medications: [],
    allergies: [],
    emergencyContacts: [],
  });
  
  const [conditionSearch, setConditionSearch] = useState("");
  const [medicationSearch, setMedicationSearch] = useState("");
  const [allergySearch, setAllergySearch] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);

  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const progress = ((currentIndex) / (STEP_ORDER.length - 1)) * 100;

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setCurrentStep(STEP_ORDER[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
    }
  };

  const addCondition = (name: string) => {
    if (!formData.conditions.find(c => c.name === name)) {
      setFormData(prev => ({
        ...prev,
        conditions: [...prev.conditions, { name, status: "active" }],
      }));
    }
    setConditionSearch("");
  };

  const removeCondition = (name: string) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter(c => c.name !== name),
    }));
  };

  const addMedication = (med: Medication) => {
    if (!formData.medications.find(m => m.name === med.name)) {
      setFormData(prev => ({
        ...prev,
        medications: [...prev.medications, med],
      }));
    }
    setMedicationSearch("");
  };

  const removeMedication = (name: string) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter(m => m.name !== name),
    }));
  };

  const addAllergy = (allergen: string) => {
    if (!formData.allergies.find(a => a.allergen === allergen)) {
      setFormData(prev => ({
        ...prev,
        allergies: [...prev.allergies, { allergen, reaction: "", severity: "moderate" }],
      }));
    }
    setAllergySearch("");
  };

  const removeAllergy = (allergen: string) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.filter(a => a.allergen !== allergen),
    }));
  };

  const addEmergencyContact = () => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, { name: "", relationship: "", phone: "", isPrimary: prev.emergencyContacts.length === 0 }],
    }));
  };

  const updateContact = (index: number, field: keyof Contact, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((c, i) => 
        i === index ? { ...c, [field]: value } : c
      ),
    }));
  };

  const removeContact = (index: number) => {
    setFormData(prev => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.filter((_, i) => i !== index),
    }));
  };

  useEffect(() => {
    if (formData.conditions.length > 0 && currentStep === "medications") {
      const suggestions: string[] = [];
      formData.conditions.forEach(condition => {
        if (condition.name.toLowerCase().includes("hypertension") || condition.name.toLowerCase().includes("blood pressure")) {
          suggestions.push("Lisinopril", "Amlodipine", "Metoprolol");
        }
        if (condition.name.toLowerCase().includes("diabetes")) {
          suggestions.push("Metformin");
        }
        if (condition.name.toLowerCase().includes("cholesterol")) {
          suggestions.push("Atorvastatin");
        }
        if (condition.name.toLowerCase().includes("thyroid")) {
          suggestions.push("Levothyroxine");
        }
        if (condition.name.toLowerCase().includes("anxiety") || condition.name.toLowerCase().includes("depression")) {
          suggestions.push("Sertraline");
        }
        if (condition.name.toLowerCase().includes("reflux") || condition.name.toLowerCase().includes("gerd")) {
          suggestions.push("Omeprazole");
        }
      });
      const uniqueSuggestions = Array.from(new Set(suggestions)).filter(s => 
        !formData.medications.find(m => m.name === s)
      );
      setAiSuggestions(uniqueSuggestions);
      setShowAiSuggestions(uniqueSuggestions.length > 0);
    }
  }, [formData.conditions, formData.medications, currentStep]);

  const filteredConditions = COMMON_CONDITIONS.filter(c => 
    c.toLowerCase().includes(conditionSearch.toLowerCase()) &&
    !formData.conditions.find(fc => fc.name === c)
  );

  const filteredMedications = COMMON_MEDICATIONS.filter(m => 
    m.name.toLowerCase().includes(medicationSearch.toLowerCase()) &&
    !formData.medications.find(fm => fm.name === m.name)
  );

  const filteredAllergies = COMMON_ALLERGIES.filter(a => 
    a.toLowerCase().includes(allergySearch.toLowerCase()) &&
    !formData.allergies.find(fa => fa.allergen === a)
  );

  const StepIcon = STEP_CONFIG[currentStep].icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild data-testid="button-back">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI-Guided Health Setup
            </h1>
          </div>
          <div className="text-sm text-muted-foreground">
            Step {currentIndex + 1} of {STEP_ORDER.length}
          </div>
        </div>
        <Progress value={progress} className="h-1" data-testid="progress-onboarding" />
      </header>

      <main className="container max-w-2xl mx-auto p-4 space-y-6">
        <GuardrailsDisclaimer variant="inline" />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <StepIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{STEP_CONFIG[currentStep].title}</CardTitle>
                <CardDescription>{STEP_CONFIG[currentStep].description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentStep === "welcome" && (
              <div className="space-y-6 text-center py-8">
                <Heart className="h-16 w-16 mx-auto text-primary" />
                <div>
                  <h2 className="text-2xl font-bold mb-2">Welcome to Tabula Medica</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Let's set up your health profile. Our AI assistant will guide you through adding 
                    your medical history, medications, and allergies with smart suggestions.
                  </p>
                </div>
                <Alert className="text-left max-w-md mx-auto">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    This usually takes about 5-10 minutes. You can save and continue later.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {currentStep === "personal" && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className="min-h-[44px]"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className="min-h-[44px]"
                      data-testid="input-last-name"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="min-h-[44px]"
                      data-testid="input-dob"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => setFormData(prev => ({ ...prev, gender: v }))}>
                      <SelectTrigger className="min-h-[44px]" data-testid="select-gender">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {currentStep === "conditions" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conditions..."
                    value={conditionSearch}
                    onChange={(e) => setConditionSearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                    data-testid="input-condition-search"
                  />
                </div>

                {filteredConditions.length > 0 && conditionSearch && (
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    <div className="space-y-1">
                      {filteredConditions.map((condition) => (
                        <Button
                          key={condition}
                          variant="ghost"
                          className="w-full justify-start min-h-[44px]"
                          onClick={() => addCondition(condition)}
                          data-testid={`button-add-condition-${condition.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          {condition}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {!conditionSearch && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Common conditions:</p>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_CONDITIONS.slice(0, 6).filter(c => !formData.conditions.find(fc => fc.name === c)).map((condition) => (
                        <Badge
                          key={condition}
                          variant="outline"
                          className="cursor-pointer hover-elevate py-2"
                          onClick={() => addCondition(condition)}
                          data-testid={`badge-condition-${condition.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {condition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {formData.conditions.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Your conditions ({formData.conditions.length}):</p>
                    <div className="space-y-2">
                      {formData.conditions.map((condition) => (
                        <div key={condition.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <span>{condition.name}</span>
                          <Button variant="ghost" size="icon" onClick={() => removeCondition(condition.name)} className="min-h-[44px] min-w-[44px]">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === "medications" && (
              <div className="space-y-4">
                {showAiSuggestions && aiSuggestions.length > 0 && (
                  <Alert className="border-primary/50 bg-primary/5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      <span className="font-medium">AI Suggestion:</span> Based on your conditions, you might be taking:
                      <div className="flex flex-wrap gap-2 mt-2">
                        {aiSuggestions.map((med) => {
                          const medInfo = COMMON_MEDICATIONS.find(m => m.name === med);
                          return (
                            <Badge
                              key={med}
                              variant="outline"
                              className="cursor-pointer hover-elevate py-2 border-primary/50"
                              onClick={() => medInfo && addMedication(medInfo)}
                              data-testid={`badge-ai-suggestion-${med.toLowerCase()}`}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {med}
                            </Badge>
                          );
                        })}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search medications..."
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                    data-testid="input-medication-search"
                  />
                </div>

                {filteredMedications.length > 0 && medicationSearch && (
                  <ScrollArea className="h-[150px] border rounded-md p-2">
                    <div className="space-y-1">
                      {filteredMedications.map((med) => (
                        <Button
                          key={med.name}
                          variant="ghost"
                          className="w-full justify-start min-h-[44px]"
                          onClick={() => addMedication(med)}
                          data-testid={`button-add-medication-${med.name.toLowerCase()}`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          <span>{med.name}</span>
                          <span className="ml-2 text-muted-foreground text-xs">({med.purpose})</span>
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}

                {formData.medications.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Your medications ({formData.medications.length}):</p>
                    <div className="space-y-2">
                      {formData.medications.map((med) => (
                        <div key={med.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="font-medium">{med.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">{med.dosage} - {med.frequency}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeMedication(med.name)} className="min-h-[44px] min-w-[44px]">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentStep === "allergies" && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search allergies..."
                    value={allergySearch}
                    onChange={(e) => setAllergySearch(e.target.value)}
                    className="pl-10 min-h-[44px]"
                    data-testid="input-allergy-search"
                  />
                </div>

                {!allergySearch && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Common allergies:</p>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_ALLERGIES.filter(a => !formData.allergies.find(fa => fa.allergen === a)).map((allergy) => (
                        <Badge
                          key={allergy}
                          variant="outline"
                          className="cursor-pointer hover-elevate py-2"
                          onClick={() => addAllergy(allergy)}
                          data-testid={`badge-allergy-${allergy.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {allergy}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {formData.allergies.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Your allergies ({formData.allergies.length}):</p>
                    <div className="space-y-2">
                      {formData.allergies.map((allergy) => (
                        <div key={allergy.allergen} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                            <span>{allergy.allergen}</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => removeAllergy(allergy.allergen)} className="min-h-[44px] min-w-[44px]">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No known drug allergies? You can skip this step. Your allergies will be prominently displayed in emergency packets.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {currentStep === "contacts" && (
              <div className="space-y-4">
                {formData.emergencyContacts.map((contact, index) => (
                  <Card key={index}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Contact {index + 1}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeContact(index)} className="min-h-[44px] min-w-[44px]">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <FieldCaption>Name</FieldCaption>
                          <Input aria-label="Name"
                            value={contact.name}
                            onChange={(e) => updateContact(index, "name", e.target.value)}
                            className="min-h-[44px]"
                            data-testid={`input-contact-name-${index}`}
                          />
                        </div>
                        <div>
                          <FieldCaption>Relationship</FieldCaption>
                          <Input aria-label="Relationship"
                            value={contact.relationship}
                            onChange={(e) => updateContact(index, "relationship", e.target.value)}
                            placeholder="e.g., Spouse, Parent"
                            className="min-h-[44px]"
                            data-testid={`input-contact-relationship-${index}`}
                          />
                        </div>
                      </div>
                      <div>
                        <FieldCaption>Phone</FieldCaption>
                        <Input aria-label="Phone"
                          type="tel"
                          value={contact.phone}
                          onChange={(e) => updateContact(index, "phone", e.target.value)}
                          placeholder="(555) 123-4567"
                          className="min-h-[44px]"
                          data-testid={`input-contact-phone-${index}`}
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`primary-${index}`}
                          checked={contact.isPrimary}
                          onCheckedChange={(checked) => updateContact(index, "isPrimary", !!checked)}
                        />
                        <label htmlFor={`primary-${index}`} className="text-sm">Primary contact</label>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button variant="outline" onClick={addEmergencyContact} className="w-full min-h-[44px]" data-testid="button-add-contact">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Emergency Contact
                </Button>
              </div>
            )}

            {currentStep === "complete" && (
              <div className="space-y-6 text-center py-8">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />
                <div>
                  <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your health profile has been created. You can now access your personalized health dashboard,
                    generate emergency packets, and track your health journey.
                  </p>
                </div>
                <div className="grid gap-3 max-w-sm mx-auto">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-left">
                    <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span className="text-sm">{formData.conditions.length} conditions added</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-left">
                    <Pill className="h-5 w-5 text-pink-500 flex-shrink-0" />
                    <span className="text-sm">{formData.medications.length} medications tracked</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-left">
                    <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <span className="text-sm">{formData.allergies.length} allergies documented</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg text-left">
                    <Phone className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{formData.emergencyContacts.length} emergency contacts</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between gap-4">
            <Button
              variant="outline"
              onClick={goBack}
              disabled={currentIndex === 0}
              className="min-h-[44px]"
              data-testid="button-back-step"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            
            {currentStep === "complete" ? (
              <Button asChild className="min-h-[44px]" data-testid="button-go-to-dashboard">
                <Link href="/my-health-dashboard">
                  Go to Dashboard
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            ) : (
              <Button onClick={goNext} className="min-h-[44px]" data-testid="button-next-step">
                {currentStep === "contacts" ? "Complete Setup" : "Continue"}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
