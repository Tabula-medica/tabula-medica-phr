import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  User, Heart, Pill, CheckCircle, ArrowRight, ArrowLeft, Plus, X, 
  Sparkles, Loader2, ClipboardList, AlertTriangle, Phone, Mail, 
  MapPin, Calendar, Users, FileText, Stethoscope, Activity, Link2,
  HelpCircle, Zap, Brain, MessageSquare, RefreshCw, Database
} from "lucide-react";

const SAMPLE_PATIENT_ID = "patient-onboarding-1";

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
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
  timezone: string;
}

interface ConditionItem {
  id: string;
  name: string;
  diagnosisDate: string;
  status: "active" | "resolved" | "managed";
  severity: "mild" | "moderate" | "severe";
  notes: string;
}

interface AllergyItem {
  id: string;
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
}

interface SurgeryItem {
  id: string;
  procedure: string;
  date: string;
  hospital: string;
}

interface FamilyHistoryItem {
  id: string;
  condition: string;
  relationship: string;
}

interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: string;
  purpose: string;
  instructions: string;
}

interface SupplementItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
}

const steps = [
  { id: 1, name: "Connect Data", icon: Database, description: "Import your records" },
  { id: 2, name: "Profile", icon: User, description: "Basic information" },
  { id: 3, name: "Health History", icon: Heart, description: "Conditions & allergies" },
  { id: 4, name: "Medications", icon: Pill, description: "Current medications" },
  { id: 5, name: "Wellness", icon: Brain, description: "How you're feeling" },
  { id: 6, name: "Review", icon: CheckCircle, description: "Confirm details" },
];

interface PromsInstrument {
  id: string;
  name: string;
  description: string;
  questions: Array<{ id: string; text: string }>;
  responseOptions: Array<{ value: number; label: string }>;
  maxScore: number;
  timeframe: string;
}

interface ConnectedSource {
  id: string;
  name: string;
  type: string;
  status: string;
  lastSync: string | null;
  dataTypes: string[];
}

export default function PatientOnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [healthDescription, setHealthDescription] = useState("");
  const { toast } = useToast();

  const [connectedSources, setConnectedSources] = useState<ConnectedSource[]>([]);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [showConnectionGuide, setShowConnectionGuide] = useState(false);
  const [selectedSourceForGuide, setSelectedSourceForGuide] = useState<string | null>(null);
  const [connectionGuideData, setConnectionGuideData] = useState<any>(null);
  const [guideQuestion, setGuideQuestion] = useState("");
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);

  const [promsInstruments, setPromsInstruments] = useState<PromsInstrument[]>([]);
  const [currentProms, setCurrentProms] = useState<string | null>(null);
  const [promsResponses, setPromsResponses] = useState<Record<string, number>>({});
  const [completedProms, setCompletedProms] = useState<Array<{ instrument: string; score: number; severity: string }>>([]);
  const [isSubmittingProms, setIsSubmittingProms] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: { street: "", city: "", state: "", zipCode: "" },
    emergencyContact: { name: "", relationship: "", phone: "" },
    preferredLanguage: "en",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [allergies, setAllergies] = useState<AllergyItem[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryItem[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryItem[]>([]);

  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [supplements, setSupplements] = useState<SupplementItem[]>([]);
  const [pharmacyInfo, setPharmacyInfo] = useState({ name: "", phone: "", address: "" });

  const { data: progressData, isLoading: isLoadingProgress } = useQuery({
    queryKey: ["/api/patient-onboarding-wizard/progress", SAMPLE_PATIENT_ID],
  });

  const saveStepMutation = useMutation({
    mutationFn: async (data: { stepName: string; stepData: any }) => {
      return apiRequest("POST", "/api/patient-onboarding-wizard/save-step", {
        patientId: SAMPLE_PATIENT_ID,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patient-onboarding-wizard/progress", SAMPLE_PATIENT_ID] });
    },
    onError: (error) => {
      toast({
        title: "Error Saving",
        description: "Failed to save your progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/patient-onboarding-wizard/complete", {
        patientId: SAMPLE_PATIENT_ID,
      });
    },
    onSuccess: () => {
      toast({
        title: "Onboarding Complete",
        description: "Your health profile has been set up successfully!",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete onboarding. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getAIConditionSuggestions = async () => {
    if (!healthDescription.trim()) return;
    
    setIsLoadingAI(true);
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/ai-suggest/conditions", {
        patientId: SAMPLE_PATIENT_ID,
        inputText: healthDescription,
        age: profile.dateOfBirth ? calculateAge(profile.dateOfBirth) : undefined,
        gender: profile.gender,
      });
      const data = await response.json();
      setAiSuggestions(data.suggestions || []);
      if (data.suggestions?.length > 0) {
        toast({
          title: "AI Suggestions Ready",
          description: `Found ${data.suggestions.length} potential conditions to document. These are NOT diagnoses.`,
        });
      }
    } catch (error) {
      console.error("AI suggestion error:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const getAIMedicationSuggestions = async (conditionName: string) => {
    setIsLoadingAI(true);
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/ai-suggest/medications", {
        patientId: SAMPLE_PATIENT_ID,
        conditionName,
      });
      const data = await response.json();
      setAiSuggestions(data.suggestions || []);
    } catch (error) {
      console.error("AI medication suggestion error:", error);
    } finally {
      setIsLoadingAI(false);
    }
  };

  const calculateAge = (dob: string): number => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const addCondition = (suggestion?: any) => {
    const newCondition: ConditionItem = {
      id: `cond-${Date.now()}`,
      name: suggestion?.name || "",
      diagnosisDate: "",
      status: suggestion?.suggestedStatus || "active",
      severity: suggestion?.severity || "moderate",
      notes: suggestion?.reason || "",
    };
    setConditions([...conditions, newCondition]);
    if (suggestion) {
      setAiSuggestions(aiSuggestions.filter(s => s.name !== suggestion.name));
    }
  };

  const addAllergy = () => {
    setAllergies([...allergies, {
      id: `allergy-${Date.now()}`,
      allergen: "",
      reaction: "",
      severity: "moderate",
    }]);
  };

  const addSurgery = () => {
    setSurgeries([...surgeries, {
      id: `surgery-${Date.now()}`,
      procedure: "",
      date: "",
      hospital: "",
    }]);
  };

  const addFamilyHistory = () => {
    setFamilyHistory([...familyHistory, {
      id: `fh-${Date.now()}`,
      condition: "",
      relationship: "",
    }]);
  };

  const addMedication = (suggestion?: any) => {
    const newMed: MedicationItem = {
      id: `med-${Date.now()}`,
      name: suggestion?.name || "",
      dosage: suggestion?.commonDosage || "",
      frequency: suggestion?.typicalFrequency || "",
      prescribedBy: "",
      startDate: "",
      purpose: suggestion?.purpose || "",
      instructions: "",
    };
    setMedications([...medications, newMed]);
    if (suggestion) {
      setAiSuggestions(aiSuggestions.filter(s => s.name !== suggestion.name));
    }
  };

  const addSupplement = () => {
    setSupplements([...supplements, {
      id: `supp-${Date.now()}`,
      name: "",
      dosage: "",
      frequency: "",
    }]);
  };

  useEffect(() => {
    fetchConnectedSources();
    fetchPromsInstruments();
  }, []);

  const fetchConnectedSources = async () => {
    try {
      const response = await apiRequest("GET", `/api/patient-onboarding-wizard/connected-sources/${SAMPLE_PATIENT_ID}`);
      const data = await response.json();
      if (data.success) {
        setConnectedSources(data.sources);
      }
    } catch (error) {
      console.error("Failed to fetch connected sources:", error);
    }
  };

  const fetchPromsInstruments = async () => {
    try {
      const response = await apiRequest("GET", "/api/patient-onboarding-wizard/proms/instruments");
      const data = await response.json();
      if (data.success) {
        setPromsInstruments(data.instruments);
      }
    } catch (error) {
      console.error("Failed to fetch PROMS instruments:", error);
    }
  };

  const handleAIPrefill = async () => {
    setIsLoadingAI(true);
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/ai-prefill", {
        patientId: SAMPLE_PATIENT_ID,
      });
      const data = await response.json();
      
      if (data.success && data.prefillData) {
        if (data.prefillData.profile) {
          setProfile(prev => ({
            ...prev,
            firstName: data.prefillData.profile.firstName || prev.firstName,
            lastName: data.prefillData.profile.lastName || prev.lastName,
            dateOfBirth: data.prefillData.profile.dateOfBirth || prev.dateOfBirth,
            gender: data.prefillData.profile.gender || prev.gender,
          }));
        }
        
        if (data.prefillData.conditions?.length) {
          setConditions(data.prefillData.conditions.map((c: any, i: number) => ({
            id: `prefill-cond-${i}`,
            name: c.name,
            diagnosisDate: c.diagnosisDate || "",
            status: c.status || "active",
            severity: c.severity || "moderate",
            notes: "",
          })));
        }
        
        if (data.prefillData.medications?.length) {
          setMedications(data.prefillData.medications.map((m: any, i: number) => ({
            id: `prefill-med-${i}`,
            name: m.name,
            dosage: m.dosage || "",
            frequency: m.frequency || "",
            prescribedBy: "",
            startDate: "",
            purpose: m.purpose || "",
            instructions: "",
          })));
        }
        
        if (data.prefillData.allergies?.length) {
          setAllergies(data.prefillData.allergies.map((a: any, i: number) => ({
            id: `prefill-allergy-${i}`,
            allergen: a.allergen,
            reaction: a.reaction || "",
            severity: a.severity || "moderate",
          })));
        }
        
        setPrefillApplied(true);
        toast({
          title: "Data Imported",
          description: `Pre-filled your profile from ${data.source}. Please review and confirm all information.`,
        });
      } else {
        toast({
          title: "No Data Available",
          description: data.message || "Connect a health data source to auto-fill your profile.",
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Could not import data from connected sources.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAI(false);
    }
  };

  const openConnectionGuide = async (sourceType: string) => {
    setSelectedSourceForGuide(sourceType);
    setIsLoadingGuide(true);
    setShowConnectionGuide(true);
    
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/ai-connection-guide", {
        patientId: SAMPLE_PATIENT_ID,
        sourceType,
      });
      const data = await response.json();
      if (data.success) {
        setConnectionGuideData(data);
      }
    } catch (error) {
      console.error("Failed to fetch connection guide:", error);
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const askGuideQuestion = async () => {
    if (!guideQuestion.trim() || !selectedSourceForGuide) return;
    
    setIsLoadingGuide(true);
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/ai-connection-guide", {
        patientId: SAMPLE_PATIENT_ID,
        sourceType: selectedSourceForGuide,
        userQuestion: guideQuestion,
      });
      const data = await response.json();
      if (data.success) {
        setConnectionGuideData(data);
        setGuideQuestion("");
      }
    } catch (error) {
      console.error("Failed to get answer:", error);
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const submitPromsAssessment = async () => {
    if (!currentProms) return;
    
    setIsSubmittingProms(true);
    try {
      const response = await apiRequest("POST", "/api/patient-onboarding-wizard/proms/submit", {
        patientId: SAMPLE_PATIENT_ID,
        instrument: currentProms,
        responses: promsResponses,
      });
      const data = await response.json();
      
      if (data.success) {
        setCompletedProms(prev => [...prev, {
          instrument: currentProms,
          score: data.result.totalScore,
          severity: data.result.severity,
        }]);
        setCurrentProms(null);
        setPromsResponses({});
        toast({
          title: "Assessment Completed",
          description: `${data.result.interpretation}`,
        });
      }
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Could not submit assessment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingProms(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      await saveStepMutation.mutateAsync({ stepName: "profile", stepData: profile });
    } else if (currentStep === 3) {
      await saveStepMutation.mutateAsync({
        stepName: "conditions",
        stepData: { conditions, allergies, surgeries, familyHistory },
      });
    } else if (currentStep === 4) {
      await saveStepMutation.mutateAsync({
        stepName: "medications",
        stepData: { currentMedications: medications, pastMedications: [], supplements, pharmacyInfo },
      });
    } else if (currentStep === 5) {
      await saveStepMutation.mutateAsync({
        stepName: "wellness",
        stepData: { completedProms },
      });
    }
    
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
      setAiSuggestions([]);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setAiSuggestions([]);
    }
  };

  const handleComplete = async () => {
    await saveStepMutation.mutateAsync({ stepName: "review", stepData: {} });
    await completeMutation.mutateAsync();
  };

  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to Tabula Medica</h1>
        <p className="text-muted-foreground">
          Let's set up your health profile. This information helps us provide you with personalized health insights.
        </p>
      </div>

      <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm flex items-start gap-2">
          <FileText className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <span>
            <strong>Important (NO-CDS Compliance):</strong> This onboarding wizard uses AI to help you document your health history. 
            AI suggestions are for <strong>record-keeping purposes only</strong> and are NOT medical advice, diagnoses, or treatment recommendations. 
            Always consult your healthcare provider for medical decisions.
          </span>
        </p>
      </div>

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex flex-col items-center flex-1 ${index < steps.length - 1 ? "relative" : ""}`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-colors ${
                  currentStep > step.id
                    ? "bg-green-500 text-white"
                    : currentStep === step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? (
                  <CheckCircle className="h-6 w-6" />
                ) : (
                  <step.icon className="h-6 w-6" />
                )}
              </div>
              <span className={`text-sm font-medium ${currentStep >= step.id ? "text-foreground" : "text-muted-foreground"}`}>
                {step.name}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:block">{step.description}</span>
              {index < steps.length - 1 && (
                <div
                  className={`absolute top-6 left-1/2 w-full h-0.5 ${
                    currentStep > step.id ? "bg-green-500" : "bg-muted"
                  }`}
                  style={{ transform: "translateX(50%)" }}
                />
              )}
            </div>
          ))}
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <p className="text-sm text-muted-foreground text-center mt-2">
          Step {currentStep} of {steps.length}
        </p>
      </div>

      {currentStep === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Connect Your Health Data
              </CardTitle>
              <CardDescription>
                Import your existing health records to pre-fill your profile. This saves time and ensures accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-blue-500/10 border-blue-500/20">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  <strong>AI-Powered Import:</strong> When you connect a health data source, our AI will automatically extract and organize your health information. You'll review everything before it's saved.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <h3 className="font-semibold">Available Data Sources</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {connectedSources.map((source) => (
                    <Card key={source.id} className={`${source.status === "connected" ? "border-green-500/50 bg-green-500/5" : ""}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{source.name}</span>
                              {source.status === "connected" ? (
                                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">Connected</Badge>
                              ) : (
                                <Badge variant="outline">Available</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">{source.type.replace("_", " ")}</p>
                            {source.lastSync && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Last synced: {new Date(source.lastSync).toLocaleDateString()}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {source.dataTypes.slice(0, 3).map((dt) => (
                                <Badge key={dt} variant="secondary" className="text-xs">{dt}</Badge>
                              ))}
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => openConnectionGuide(source.id.split("-")[0])}
                            data-testid={`button-guide-${source.id}`}
                          >
                            <HelpCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {connectedSources.some(s => s.status === "connected") && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Import Your Data</h3>
                      <p className="text-sm text-muted-foreground">
                        Use AI to automatically fill in your profile from connected sources
                      </p>
                    </div>
                    <Button 
                      onClick={handleAIPrefill} 
                      disabled={isLoadingAI || prefillApplied}
                      data-testid="button-ai-prefill"
                    >
                      {isLoadingAI ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</>
                      ) : prefillApplied ? (
                        <><CheckCircle className="h-4 w-4 mr-2" /> Data Imported</>
                      ) : (
                        <><Zap className="h-4 w-4 mr-2" /> Auto-Fill Profile</>
                      )}
                    </Button>
                  </div>
                  
                  {prefillApplied && (
                    <Alert className="bg-green-500/10 border-green-500/20">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Your data has been imported! Continue to the next steps to review and confirm your information.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {!connectedSources.some(s => s.status === "connected") && (
                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    No data sources connected yet. You can skip this step and enter your information manually, or connect a source to save time.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              {prefillApplied 
                ? "Review your imported information and make any corrections."
                : "Please provide your basic information to set up your profile."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {prefillApplied && (
              <Alert className="bg-blue-500/10 border-blue-500/20 mb-4">
                <Sparkles className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  This information was imported from your connected health records. Please verify it's correct.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  data-testid="input-first-name"
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  placeholder="Enter your first name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  data-testid="input-last-name"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  placeholder="Enter your last name"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  data-testid="input-dob"
                  type="date"
                  value={profile.dateOfBirth}
                  onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={profile.gender}
                  onValueChange={(value) => setProfile({ ...profile, gender: value })}
                >
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

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  data-testid="input-phone"
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  data-testid="input-email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </h3>
              <Input
                data-testid="input-street"
                value={profile.address.street}
                onChange={(e) => setProfile({ ...profile, address: { ...profile.address, street: e.target.value } })}
                placeholder="Street address"
              />
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  data-testid="input-city"
                  value={profile.address.city}
                  onChange={(e) => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}
                  placeholder="City"
                />
                <Input
                  data-testid="input-state"
                  value={profile.address.state}
                  onChange={(e) => setProfile({ ...profile, address: { ...profile.address, state: e.target.value } })}
                  placeholder="State"
                />
                <Input
                  data-testid="input-zip"
                  value={profile.address.zipCode}
                  onChange={(e) => setProfile({ ...profile, address: { ...profile.address, zipCode: e.target.value } })}
                  placeholder="ZIP Code"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Emergency Contact
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  data-testid="input-emergency-name"
                  value={profile.emergencyContact.name}
                  onChange={(e) => setProfile({
                    ...profile,
                    emergencyContact: { ...profile.emergencyContact, name: e.target.value },
                  })}
                  placeholder="Contact name"
                />
                <Input
                  data-testid="input-emergency-relationship"
                  value={profile.emergencyContact.relationship}
                  onChange={(e) => setProfile({
                    ...profile,
                    emergencyContact: { ...profile.emergencyContact, relationship: e.target.value },
                  })}
                  placeholder="Relationship"
                />
                <Input
                  data-testid="input-emergency-phone"
                  value={profile.emergencyContact.phone}
                  onChange={(e) => setProfile({
                    ...profile,
                    emergencyContact: { ...profile.emergencyContact, phone: e.target.value },
                  })}
                  placeholder="Phone number"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="patient-onboarding-wizar-preferred-language">Preferred Language</Label>
                <Select
                  value={profile.preferredLanguage}
                  onValueChange={(value) => setProfile({ ...profile, preferredLanguage: value })}
                >
                  <SelectTrigger id="patient-onboarding-wizar-preferred-language" data-testid="select-language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="it">Italian</SelectItem>
                    <SelectItem value="pt">Portuguese</SelectItem>
                    <SelectItem value="ru">Russian</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="ko">Korean</SelectItem>
                    <SelectItem value="ar">Arabic</SelectItem>
                    <SelectItem value="hi">Hindi</SelectItem>
                    <SelectItem value="vi">Vietnamese</SelectItem>
                    <SelectItem value="tl">Tagalog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI-Assisted Health History
              </CardTitle>
              <CardDescription>
                Describe your health history in your own words, and our AI will help identify conditions to document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                data-testid="textarea-health-description"
                value={healthDescription}
                onChange={(e) => setHealthDescription(e.target.value)}
                placeholder="Example: I've been managing high blood pressure for 5 years. I also have some seasonal allergies and had my appendix removed in 2018..."
                className="min-h-[100px]"
              />
              <Button
                onClick={getAIConditionSuggestions}
                disabled={isLoadingAI || !healthDescription.trim()}
                data-testid="button-ai-suggest"
              >
                {isLoadingAI ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Get AI Suggestions
                  </>
                )}
              </Button>

              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">AI Suggestions (click to add):</p>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((suggestion, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="cursor-pointer hover-elevate py-2 px-3"
                        onClick={() => addCondition(suggestion)}
                        data-testid={`badge-suggestion-${idx}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {suggestion.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    These are NOT diagnoses. They are suggestions based on your description.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Medical Conditions
              </CardTitle>
              <CardDescription>
                Add conditions you've been diagnosed with.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conditions.map((condition, idx) => (
                <div key={condition.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-2">
                      <Input
                        data-testid={`input-condition-name-${idx}`}
                        value={condition.name}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].name = e.target.value;
                          setConditions(updated);
                        }}
                        placeholder="Condition name"
                      />
                      <Input
                        data-testid={`input-condition-date-${idx}`}
                        type="date"
                        value={condition.diagnosisDate}
                        onChange={(e) => {
                          const updated = [...conditions];
                          updated[idx].diagnosisDate = e.target.value;
                          setConditions(updated);
                        }}
                        placeholder="Diagnosis date"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setConditions(conditions.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-condition-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      value={condition.status}
                      onValueChange={(value: "active" | "resolved" | "managed") => {
                        const updated = [...conditions];
                        updated[idx].status = value;
                        setConditions(updated);
                      }}
                    >
                      <SelectTrigger data-testid={`select-condition-status-${idx}`}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="managed">Managed</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={condition.severity}
                      onValueChange={(value: "mild" | "moderate" | "severe") => {
                        const updated = [...conditions];
                        updated[idx].severity = value;
                        setConditions(updated);
                      }}
                    >
                      <SelectTrigger data-testid={`select-condition-severity-${idx}`}>
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild">Mild</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="severe">Severe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => addCondition()} data-testid="button-add-condition">
                <Plus className="h-4 w-4 mr-2" />
                Add Condition
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {allergies.map((allergy, idx) => (
                <div key={allergy.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-3">
                      <Input
                        data-testid={`input-allergen-${idx}`}
                        value={allergy.allergen}
                        onChange={(e) => {
                          const updated = [...allergies];
                          updated[idx].allergen = e.target.value;
                          setAllergies(updated);
                        }}
                        placeholder="Allergen (e.g., Penicillin)"
                      />
                      <Input
                        data-testid={`input-reaction-${idx}`}
                        value={allergy.reaction}
                        onChange={(e) => {
                          const updated = [...allergies];
                          updated[idx].reaction = e.target.value;
                          setAllergies(updated);
                        }}
                        placeholder="Reaction (e.g., Hives)"
                      />
                      <Select
                        value={allergy.severity}
                        onValueChange={(value: "mild" | "moderate" | "severe") => {
                          const updated = [...allergies];
                          updated[idx].severity = value;
                          setAllergies(updated);
                        }}
                      >
                        <SelectTrigger data-testid={`select-allergy-severity-${idx}`}>
                          <SelectValue placeholder="Severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mild">Mild</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="severe">Severe/Life-threatening</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setAllergies(allergies.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-allergy-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addAllergy} data-testid="button-add-allergy">
                <Plus className="h-4 w-4 mr-2" />
                Add Allergy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Surgical History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {surgeries.map((surgery, idx) => (
                <div key={surgery.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-3">
                      <Input
                        data-testid={`input-surgery-procedure-${idx}`}
                        value={surgery.procedure}
                        onChange={(e) => {
                          const updated = [...surgeries];
                          updated[idx].procedure = e.target.value;
                          setSurgeries(updated);
                        }}
                        placeholder="Procedure name"
                      />
                      <Input
                        data-testid={`input-surgery-date-${idx}`}
                        type="date"
                        value={surgery.date}
                        onChange={(e) => {
                          const updated = [...surgeries];
                          updated[idx].date = e.target.value;
                          setSurgeries(updated);
                        }}
                      />
                      <Input
                        data-testid={`input-surgery-hospital-${idx}`}
                        value={surgery.hospital}
                        onChange={(e) => {
                          const updated = [...surgeries];
                          updated[idx].hospital = e.target.value;
                          setSurgeries(updated);
                        }}
                        placeholder="Hospital/Facility"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSurgeries(surgeries.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-surgery-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addSurgery} data-testid="button-add-surgery">
                <Plus className="h-4 w-4 mr-2" />
                Add Surgery
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Family History
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {familyHistory.map((fh, idx) => (
                <div key={fh.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-2">
                      <Input
                        data-testid={`input-fh-condition-${idx}`}
                        value={fh.condition}
                        onChange={(e) => {
                          const updated = [...familyHistory];
                          updated[idx].condition = e.target.value;
                          setFamilyHistory(updated);
                        }}
                        placeholder="Condition"
                      />
                      <Input
                        data-testid={`input-fh-relationship-${idx}`}
                        value={fh.relationship}
                        onChange={(e) => {
                          const updated = [...familyHistory];
                          updated[idx].relationship = e.target.value;
                          setFamilyHistory(updated);
                        }}
                        placeholder="Relationship (e.g., Mother)"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setFamilyHistory(familyHistory.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-fh-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addFamilyHistory} data-testid="button-add-family-history">
                <Plus className="h-4 w-4 mr-2" />
                Add Family History
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Current Medications
              </CardTitle>
              <CardDescription>
                List all medications you are currently taking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {conditions.length > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Get medication suggestions based on your conditions:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {conditions.map((condition) => (
                      <Button
                        key={condition.id}
                        size="sm"
                        variant="outline"
                        onClick={() => getAIMedicationSuggestions(condition.name)}
                        disabled={isLoadingAI}
                        data-testid={`button-suggest-meds-${condition.id}`}
                      >
                        {condition.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">AI Medication Suggestions (click to add):</p>
                  <div className="flex flex-wrap gap-2">
                    {aiSuggestions.map((suggestion, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="cursor-pointer hover-elevate py-2 px-3"
                        onClick={() => addMedication(suggestion)}
                        data-testid={`badge-med-suggestion-${idx}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {suggestion.name} - {suggestion.commonDosage}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    These are NOT prescriptions. Verify all medications with your healthcare provider.
                  </p>
                </div>
              )}

              {medications.map((med, idx) => (
                <div key={med.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-2">
                      <Input
                        data-testid={`input-med-name-${idx}`}
                        value={med.name}
                        onChange={(e) => {
                          const updated = [...medications];
                          updated[idx].name = e.target.value;
                          setMedications(updated);
                        }}
                        placeholder="Medication name"
                      />
                      <Input
                        data-testid={`input-med-dosage-${idx}`}
                        value={med.dosage}
                        onChange={(e) => {
                          const updated = [...medications];
                          updated[idx].dosage = e.target.value;
                          setMedications(updated);
                        }}
                        placeholder="Dosage (e.g., 10mg)"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setMedications(medications.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-med-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <Input
                      data-testid={`input-med-frequency-${idx}`}
                      value={med.frequency}
                      onChange={(e) => {
                        const updated = [...medications];
                        updated[idx].frequency = e.target.value;
                        setMedications(updated);
                      }}
                      placeholder="Frequency (e.g., Twice daily)"
                    />
                    <Input
                      data-testid={`input-med-purpose-${idx}`}
                      value={med.purpose}
                      onChange={(e) => {
                        const updated = [...medications];
                        updated[idx].purpose = e.target.value;
                        setMedications(updated);
                      }}
                      placeholder="Purpose"
                    />
                    <Input
                      data-testid={`input-med-prescriber-${idx}`}
                      value={med.prescribedBy}
                      onChange={(e) => {
                        const updated = [...medications];
                        updated[idx].prescribedBy = e.target.value;
                        setMedications(updated);
                      }}
                      placeholder="Prescribed by"
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => addMedication()} data-testid="button-add-medication">
                <Plus className="h-4 w-4 mr-2" />
                Add Medication
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Supplements & Vitamins</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {supplements.map((supp, idx) => (
                <div key={supp.id} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid gap-3 md:grid-cols-3">
                      <Input
                        data-testid={`input-supp-name-${idx}`}
                        value={supp.name}
                        onChange={(e) => {
                          const updated = [...supplements];
                          updated[idx].name = e.target.value;
                          setSupplements(updated);
                        }}
                        placeholder="Supplement name"
                      />
                      <Input
                        data-testid={`input-supp-dosage-${idx}`}
                        value={supp.dosage}
                        onChange={(e) => {
                          const updated = [...supplements];
                          updated[idx].dosage = e.target.value;
                          setSupplements(updated);
                        }}
                        placeholder="Dosage"
                      />
                      <Input
                        data-testid={`input-supp-frequency-${idx}`}
                        value={supp.frequency}
                        onChange={(e) => {
                          const updated = [...supplements];
                          updated[idx].frequency = e.target.value;
                          setSupplements(updated);
                        }}
                        placeholder="Frequency"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSupplements(supplements.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-supp-${idx}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addSupplement} data-testid="button-add-supplement">
                <Plus className="h-4 w-4 mr-2" />
                Add Supplement
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pharmacy Information (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Input
                  data-testid="input-pharmacy-name"
                  value={pharmacyInfo.name}
                  onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, name: e.target.value })}
                  placeholder="Pharmacy name"
                />
                <Input
                  data-testid="input-pharmacy-phone"
                  value={pharmacyInfo.phone}
                  onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, phone: e.target.value })}
                  placeholder="Phone number"
                />
                <Input
                  data-testid="input-pharmacy-address"
                  value={pharmacyInfo.address}
                  onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, address: e.target.value })}
                  placeholder="Address"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Wellness Assessment
              </CardTitle>
              <CardDescription>
                Complete a brief assessment to help us understand your current well-being.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-amber-500/10 border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  <strong>NOT medical advice.</strong> These questionnaires are for baseline documentation only. They are NOT diagnostic tools and do NOT replace professional evaluation.
                </AlertDescription>
              </Alert>

              {!currentProms ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Available Assessments</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {promsInstruments.map((instrument) => {
                      const isCompleted = completedProms.some(p => p.instrument === instrument.id);
                      return (
                        <Card key={instrument.id} className={isCompleted ? "border-green-500/50 bg-green-500/5" : ""}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{instrument.name}</span>
                                  {isCompleted && (
                                    <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Done
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{instrument.description}</p>
                                <p className="text-xs text-muted-foreground mt-1">Timeframe: {instrument.timeframe}</p>
                              </div>
                              {!isCompleted && (
                                <Button 
                                  size="sm" 
                                  onClick={() => setCurrentProms(instrument.id)}
                                  data-testid={`button-start-${instrument.id}`}
                                >
                                  Start
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {completedProms.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="font-semibold">Completed Assessments</h3>
                      <div className="flex flex-wrap gap-2">
                        {completedProms.map((p, idx) => (
                          <Badge key={idx} variant="secondary">
                            {p.instrument}: {p.score} ({p.severity})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    These assessments are optional. You can skip this step if you prefer.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {promsInstruments.filter(i => i.id === currentProms).map((instrument) => (
                    <div key={instrument.id} className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{instrument.name}</h3>
                          <p className="text-sm text-muted-foreground">{instrument.timeframe}</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setCurrentProms(null); setPromsResponses({}); }}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>

                      <div className="space-y-6">
                        {instrument.questions.map((question, qIdx) => (
                          <div key={question.id} className="space-y-3">
                            <p className="font-medium text-sm">
                              {qIdx + 1}. {question.text}
                            </p>
                            <RadioGroup
                              value={promsResponses[question.id]?.toString() || ""}
                              onValueChange={(value) => setPromsResponses(prev => ({ ...prev, [question.id]: parseInt(value) }))}
                              className="flex flex-wrap gap-3"
                            >
                              {instrument.responseOptions.map((option) => (
                                <div key={option.value} className="flex items-center gap-2">
                                  <RadioGroupItem value={option.value.toString()} id={`${question.id}-${option.value}`} />
                                  <Label htmlFor={`${question.id}-${option.value}`} className="text-sm cursor-pointer">
                                    {option.label}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => { setCurrentProms(null); setPromsResponses({}); }}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={submitPromsAssessment}
                          disabled={isSubmittingProms || Object.keys(promsResponses).length < instrument.questions.length}
                          data-testid="button-submit-proms"
                        >
                          {isSubmittingProms ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...</>
                          ) : (
                            "Submit Assessment"
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === 6 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Review Your Information
            </CardTitle>
            <CardDescription>
              Please review the information you've entered before completing your profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Personal Information
              </h3>
              <div className="grid gap-2 md:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>{" "}
                  {profile.firstName} {profile.lastName}
                </div>
                <div>
                  <span className="text-muted-foreground">Date of Birth:</span>{" "}
                  {profile.dateOfBirth || "Not provided"}
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>{" "}
                  {profile.phone || "Not provided"}
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {profile.email || "Not provided"}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Health History
              </h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {conditions.length > 0 ? (
                    conditions.map((c) => (
                      <Badge key={c.id} variant="secondary">
                        {c.name} ({c.status})
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No conditions added</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allergies.length > 0 ? (
                    allergies.map((a) => (
                      <Badge key={a.id} variant="destructive">
                        {a.allergen}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No allergies listed</span>
                  )}
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Surgeries:</span>{" "}
                  {surgeries.length > 0 ? surgeries.map(s => s.procedure).join(", ") : "None"}
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Family History:</span>{" "}
                  {familyHistory.length > 0
                    ? familyHistory.map(f => `${f.condition} (${f.relationship})`).join(", ")
                    : "None"}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Pill className="h-4 w-4" />
                Medications
              </h3>
              <div className="space-y-2">
                {medications.length > 0 ? (
                  medications.map((m) => (
                    <div key={m.id} className="text-sm">
                      <span className="font-medium">{m.name}</span> - {m.dosage}, {m.frequency}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No medications listed</span>
                )}
                {supplements.length > 0 && (
                  <div className="mt-2">
                    <span className="text-muted-foreground text-sm">Supplements: </span>
                    {supplements.map(s => s.name).join(", ")}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Important:</strong> This information is for your personal health record only.
                  It is NOT medical advice and does not replace consultation with your healthcare provider.
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showConnectionGuide} onOpenChange={setShowConnectionGuide}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Connection Guide
            </DialogTitle>
            <DialogDescription>
              Step-by-step instructions to connect your health data
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingGuide && !connectionGuideData ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : connectionGuideData ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Steps to Connect
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  {connectionGuideData.guide?.steps?.map((step: string, idx: number) => (
                    <li key={idx} className="text-muted-foreground">{step}</li>
                  ))}
                </ol>
              </div>

              {connectionGuideData.guide?.tips?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Tips
                  </h4>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    {connectionGuideData.guide.tips.map((tip: string, idx: number) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {connectionGuideData.guide?.commonIssues?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Common Issues</h4>
                  <div className="space-y-2">
                    {connectionGuideData.guide.commonIssues.map((issue: any, idx: number) => (
                      <div key={idx} className="text-sm p-2 bg-muted rounded">
                        <p className="font-medium">{issue.issue}</p>
                        <p className="text-muted-foreground">{issue.solution}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {connectionGuideData.aiResponse && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-sm flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <span>{connectionGuideData.aiResponse}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="patient-onboarding-wizar-ask-a-question-about-connecting" className="text-sm">Ask a question about connecting</Label>
                <div className="flex gap-2">
                  <Input id="patient-onboarding-wizar-ask-a-question-about-connecting"
                    value={guideQuestion}
                    onChange={(e) => setGuideQuestion(e.target.value)}
                    placeholder="e.g., What if I forgot my password?"
                    data-testid="input-guide-question"
                  />
                  <Button 
                    onClick={askGuideQuestion}
                    disabled={isLoadingGuide || !guideQuestion.trim()}
                    size="sm"
                    data-testid="button-ask-guide"
                  >
                    {isLoadingGuide ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Estimated time: {connectionGuideData.guide?.estimatedTime || "5-10 minutes"}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">No guide available for this source.</p>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < steps.length ? (
          <Button
            onClick={handleNext}
            disabled={saveStepMutation.isPending}
            data-testid="button-next"
          >
            {saveStepMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleComplete}
            disabled={completeMutation.isPending}
            data-testid="button-complete"
          >
            {completeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
