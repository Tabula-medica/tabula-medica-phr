import { useState } from "react";
import { useLocation } from "wouter";
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Heart, 
  AlertTriangle, 
  Pill, 
  Activity,
  User,
  Bell,
  Shield,
  Lock,
  Fingerprint,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DisclaimerBlock } from "@/components/copy-blocks";

interface WizardData {
  profile: {
    dateOfBirth: string;
    gender: string;
    bloodType: string;
    emergencyContact: string;
  };
  conditions: string[];
  allergies: string[];
  medications: string[];
  preferences: {
    enableReminders: boolean;
    enableAiInsights: boolean;
    shareWithProviders: boolean;
    darkMode: boolean;
  };
}

const COMMON_CONDITIONS = [
  "Hypertension",
  "Type 2 Diabetes",
  "Asthma",
  "COPD",
  "Heart Disease",
  "Arthritis",
  "Depression",
  "Anxiety",
  "High Cholesterol",
  "Thyroid Disorder",
  "Chronic Kidney Disease",
  "GERD",
];

const COMMON_ALLERGIES = [
  "Penicillin",
  "Sulfa drugs",
  "Aspirin",
  "NSAIDs",
  "Latex",
  "Peanuts",
  "Tree nuts",
  "Shellfish",
  "Eggs",
  "Dairy",
  "Soy",
  "Wheat/Gluten",
];

const COMMON_MEDICATIONS = [
  "Lisinopril",
  "Metformin",
  "Atorvastatin",
  "Levothyroxine",
  "Amlodipine",
  "Metoprolol",
  "Omeprazole",
  "Losartan",
  "Albuterol",
  "Gabapentin",
  "Hydrochlorothiazide",
  "Sertraline",
];

export default function SetupWizard() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [customCondition, setCustomCondition] = useState("");
  const [customAllergy, setCustomAllergy] = useState("");
  const [customMedication, setCustomMedication] = useState("");
  
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  const [wizardData, setWizardData] = useState<WizardData>({
    profile: {
      dateOfBirth: "",
      gender: "",
      bloodType: "",
      emergencyContact: "",
    },
    conditions: [],
    allergies: [],
    medications: [],
    preferences: {
      enableReminders: true,
      enableAiInsights: true,
      shareWithProviders: false,
      darkMode: false,
    },
  });

  const steps = [
    { id: "profile", title: "Basic Profile", icon: User },
    { id: "conditions", title: "Health Conditions", icon: Heart },
    { id: "allergies", title: "Allergies", icon: AlertTriangle },
    { id: "medications", title: "Current Medications", icon: Pill },
    { id: "preferences", title: "Preferences", icon: Bell },
    { id: "review", title: "Review & Complete", icon: Check },
  ];

  const progress = ((currentStep + 1) / steps.length) * 100;

  const toggleCondition = (condition: string) => {
    setWizardData(prev => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter(c => c !== condition)
        : [...prev.conditions, condition],
    }));
  };

  const toggleAllergy = (allergy: string) => {
    setWizardData(prev => ({
      ...prev,
      allergies: prev.allergies.includes(allergy)
        ? prev.allergies.filter(a => a !== allergy)
        : [...prev.allergies, allergy],
    }));
  };

  const toggleMedication = (medication: string) => {
    setWizardData(prev => ({
      ...prev,
      medications: prev.medications.includes(medication)
        ? prev.medications.filter(m => m !== medication)
        : [...prev.medications, medication],
    }));
  };

  const addCustomItem = (type: "conditions" | "allergies" | "medications", value: string) => {
    if (!value.trim()) return;
    setWizardData(prev => ({
      ...prev,
      [type]: [...prev[type], value.trim()],
    }));
    if (type === "conditions") setCustomCondition("");
    if (type === "allergies") setCustomAllergy("");
    if (type === "medications") setCustomMedication("");
  };

  const handleComplete = async () => {
    localStorage.setItem("tabula_setup_complete", "true");
    localStorage.setItem("tabula_patient_profile", JSON.stringify(wizardData));
    setLocation("/timeline");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={wizardData.profile.dateOfBirth}
                  onChange={(e) => setWizardData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, dateOfBirth: e.target.value }
                  }))}
                  data-testid="input-dob"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={wizardData.profile.gender}
                  onValueChange={(value) => setWizardData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, gender: value }
                  }))}
                >
                  <SelectTrigger id="gender" data-testid="select-gender">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="blood-type">Blood Type (optional)</Label>
                <Select
                  value={wizardData.profile.bloodType}
                  onValueChange={(value) => setWizardData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, bloodType: value }
                  }))}
                >
                  <SelectTrigger id="blood-type" data-testid="select-blood-type">
                    <SelectValue placeholder="Select blood type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="AB+">AB+</SelectItem>
                    <SelectItem value="AB-">AB-</SelectItem>
                    <SelectItem value="O+">O+</SelectItem>
                    <SelectItem value="O-">O-</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergency-contact">Emergency Contact Phone</Label>
                <Input
                  id="emergency-contact"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={wizardData.profile.emergencyContact}
                  onChange={(e) => setWizardData(prev => ({
                    ...prev,
                    profile: { ...prev.profile, emergencyContact: e.target.value }
                  }))}
                  data-testid="input-emergency-contact"
                />
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select any conditions you're currently managing. This helps us personalize your experience.
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_CONDITIONS.map((condition) => (
                <Badge
                  key={condition}
                  variant={wizardData.conditions.includes(condition) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCondition(condition)}
                  data-testid={`badge-condition-${condition.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {wizardData.conditions.includes(condition) && (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  {condition}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add other condition..."
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomItem("conditions", customCondition)}
                data-testid="input-custom-condition"
              />
              <Button
                variant="outline"
                onClick={() => addCustomItem("conditions", customCondition)}
                data-testid="button-add-condition"
              >
                Add
              </Button>
            </div>
            {wizardData.conditions.filter(c => !COMMON_CONDITIONS.includes(c)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {wizardData.conditions.filter(c => !COMMON_CONDITIONS.includes(c)).map((condition) => (
                  <Badge
                    key={condition}
                    variant="default"
                    className="cursor-pointer"
                    onClick={() => toggleCondition(condition)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    {condition}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select any known allergies. This information is critical for medication safety.
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_ALLERGIES.map((allergy) => (
                <Badge
                  key={allergy}
                  variant={wizardData.allergies.includes(allergy) ? "destructive" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleAllergy(allergy)}
                  data-testid={`badge-allergy-${allergy.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {wizardData.allergies.includes(allergy) && (
                    <AlertTriangle className="h-3 w-3 mr-1" />
                  )}
                  {allergy}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add other allergy..."
                value={customAllergy}
                onChange={(e) => setCustomAllergy(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomItem("allergies", customAllergy)}
                data-testid="input-custom-allergy"
              />
              <Button
                variant="outline"
                onClick={() => addCustomItem("allergies", customAllergy)}
                data-testid="button-add-allergy"
              >
                Add
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select medications you're currently taking. We'll check for interactions and send refill reminders.
            </p>
            <div className="flex flex-wrap gap-2">
              {COMMON_MEDICATIONS.map((medication) => (
                <Badge
                  key={medication}
                  variant={wizardData.medications.includes(medication) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleMedication(medication)}
                  data-testid={`badge-medication-${medication.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {wizardData.medications.includes(medication) && (
                    <Pill className="h-3 w-3 mr-1" />
                  )}
                  {medication}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add other medication..."
                value={customMedication}
                onChange={(e) => setCustomMedication(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomItem("medications", customMedication)}
                data-testid="input-custom-medication"
              />
              <Button
                variant="outline"
                onClick={() => addCustomItem("medications", customMedication)}
                data-testid="button-add-medication"
              >
                Add
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border flex-wrap">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="reminders" className="font-medium">Medication Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notifications for medication schedules and refills
                  </p>
                </div>
              </div>
              <Switch
                id="reminders"
                checked={wizardData.preferences.enableReminders}
                onCheckedChange={(checked) => setWizardData(prev => ({
                  ...prev,
                  preferences: { ...prev.preferences, enableReminders: checked }
                }))}
                data-testid="switch-reminders"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border flex-wrap">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="ai-insights" className="font-medium">AI Health Insights</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive personalized health tips and trend analysis
                  </p>
                </div>
              </div>
              <Switch
                id="ai-insights"
                checked={wizardData.preferences.enableAiInsights}
                onCheckedChange={(checked) => setWizardData(prev => ({
                  ...prev,
                  preferences: { ...prev.preferences, enableAiInsights: checked }
                }))}
                data-testid="switch-ai-insights"
              />
            </div>

            <div className="flex items-center justify-between gap-4 p-4 rounded-lg border flex-wrap">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label htmlFor="share-providers" className="font-medium">Share with Providers</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow your healthcare providers to access your profile
                  </p>
                </div>
              </div>
              <Switch
                id="share-providers"
                checked={wizardData.preferences.shareWithProviders}
                onCheckedChange={(checked) => setWizardData(prev => ({
                  ...prev,
                  preferences: { ...prev.preferences, shareWithProviders: checked }
                }))}
                data-testid="switch-share-providers"
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {wizardData.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {wizardData.conditions.map(c => (
                        <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None selected</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Allergies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {wizardData.allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {wizardData.allergies.map(a => (
                        <Badge key={a} variant="destructive" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None selected</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Pill className="h-4 w-4" />
                    Medications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {wizardData.medications.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {wizardData.medications.map(m => (
                        <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">None selected</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox checked={wizardData.preferences.enableReminders} disabled />
                    <span>Medication reminders</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox checked={wizardData.preferences.enableAiInsights} disabled />
                    <span>AI health insights</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Checkbox checked={wizardData.preferences.shareWithProviders} disabled />
                    <span>Share with providers</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border" data-testid="consent-acknowledgment">
              <Checkbox
                id="consent"
                checked={consentAcknowledged}
                onCheckedChange={(checked) => setConsentAcknowledged(checked === true)}
                className="mt-0.5"
                data-testid="checkbox-consent"
              />
              <Label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I understand that my health information is encrypted with zero-knowledge architecture, 
                protected under HIPAA, and that Tabula Medica does not hold the keys to my data. 
                I consent to the processing of my health profile as described in the{" "}
                <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-accent-foreground underline" data-testid="link-privacy-policy">
                  Notice of Privacy Practices
                </a>.
              </Label>
            </div>

            <DisclaimerBlock className="justify-center" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-setup-wizard">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mx-auto mb-4">
            <Heart className="h-6 w-6 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Set Up Your Health Profile</h1>
          <p className="text-muted-foreground">
            Tell us about yourself so we can personalize your experience
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mb-6 p-3 rounded-lg bg-muted/50 border text-sm text-muted-foreground flex-wrap" data-testid="banner-security-trust">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            AES-256 Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <Fingerprint className="h-3.5 w-3.5" />
            Zero-Knowledge
          </span>
          <span className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            HIPAA Compliant
          </span>
        </div>

        <div className="flex items-center justify-center gap-2 mb-6 overflow-x-auto pb-2">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isComplete = index < currentStep;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : isComplete
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <StepIcon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
            );
          })}
        </div>

        <Progress value={progress} className="h-2 mb-6" />

        <Card data-testid="card-wizard-step">
          <CardHeader>
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>
              {currentStep === 0 && "Basic information to help us identify you. All fields are optional."}
              {currentStep === 1 && "Select health conditions you're managing. Skip if none apply."}
              {currentStep === 2 && "Important allergy information for medication safety. Skip if none apply."}
              {currentStep === 3 && "Current medications for interaction checking. Skip if none apply."}
              {currentStep === 4 && "Customize your notification and privacy settings"}
              {currentStep === 5 && "Review your information before completing setup"}
            </CardDescription>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4 mt-6 flex-wrap">
          <Button
            variant="ghost"
            onClick={() => setLocation("/timeline")}
            data-testid="button-skip-wizard"
          >
            Skip for now
          </Button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(prev => prev - 1)}
                data-testid="button-wizard-prev"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
            <Button
              onClick={currentStep === steps.length - 1 ? handleComplete : () => setCurrentStep(prev => prev + 1)}
              disabled={currentStep === steps.length - 1 && !consentAcknowledged}
              data-testid="button-wizard-next"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Complete Setup
                </>
              ) : (
                <>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
