import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, User, FileText, Pill, AlertTriangle, Phone, Shield,
  Activity, CheckCircle2, ChevronRight, ChevronLeft, Sparkles,
  Loader2, Plus, X, Stethoscope, Calendar, Users, Brain,
  Link2, Home, ClipboardCheck, Scale, Upload, Info, ArrowRight,
  Cigarette, Wine, Dumbbell, Moon, Globe, MapPin, Building2, Search,
  ExternalLink, DollarSign,
} from "lucide-react";
import { TRANSLATIONS, t } from "./onboarding-translations";
import { COUNTRY_CODES, CONDITIONS_ICD10, SURGERIES_CPT, COMMON_ALLERGENS, COMMON_MEDICATIONS, SOCIAL_HISTORY_ICD } from "./onboarding-clinical-data";
import { VoiceInput } from "@/components/voice-input";
import { OcrScanner } from "@/components/ocr-scanner";
import { Mic } from "lucide-react";


const COMMON_CONDITIONS_KEYS = [
  "hypertension", "type2Diabetes", "asthma", "depression", "anxiety",
  "hyperlipidemia", "gerd", "osteoarthritis", "hypothyroidism", "hyperthyroidism",
  "migraine", "obesity", "copd", "heartDisease", "kidneyDisease", "osteoporosis",
  "sleepApnea", "afib", "stroke", "ironDeficiency", "vitaminD",
  "allergicRhinitis", "backNeckPain", "coronaryArteryDisease", "recentPneumonia",
  "dementia", "lungCancer", "colorectalCancer", "tuberculosis",
  "cirrhosis", "fattyLiver", "hiv", "hepatitisC", "hepatitisB",
];

const COMMON_SURGERIES_KEYS = [
  "surgCataract", "surgCSection", "surgColonoscopy", "surgKneeReplacement",
  "surgHipReplacement", "surgShoulderReplacement", "surgCholecystectomy",
  "surgHerniaRepair", "surgAppendectomy", "surgCoronaryBypass",
  "surgHysterectomy", "surgHeartStent", "surgTonsillectomy",
  "surgSpinalFusion", "surgRotatorCuff", "surgCarpalTunnel",
  "surgACLRepair", "surgLumpectomy", "surgMastectomy", "surgEndoscopy",
  "surgWisdomTooth", "surgHemorrhoid", "surgArthroscopy",
];

const FAMILY_HISTORY_CONDITIONS_KEYS = [
  "fhHypertension", "fhHighCholesterol", "fhEarlyHeartDisease",
  "fhHeartDisease", "fhStrokeTIA", "fhBreastCancer", "fhColonCancer",
  "fhProstateCancer", "fhOvarianCancer", "fhType2Diabetes",
  "fhBloodClots", "fhSickleCell", "fhTaySachs", "fhThalassemia",
  "fhBleedingDisorder", "fhSchizophrenia", "fhDepressionBipolar",
  "fhAutoimmuneLupus", "fhRheumatoidArthritis", "fhCeliacDisease",
  "fhThyroidDisease", "fhEarlyDementia", "fhGlaucoma",
  "fhMacularDegeneration", "fhHearingLoss",
];

const STEPS_KEYS = [
  { id: "welcome", titleKey: "welcome", descKey: "getStarted", icon: Sparkles },
  { id: "demographics", titleKey: "demographics", descKey: "yourIdentity", icon: User },
  { id: "contacts", titleKey: "contacts", descKey: "emergencyInsurance", icon: Phone },
  { id: "conditions", titleKey: "medicalHistory", descKey: "conditionsSurgeries", icon: Heart },
  { id: "allergies", titleKey: "allergies", descKey: "knownAllergies", icon: AlertTriangle },
  { id: "medications", titleKey: "medications", descKey: "currentMedications", icon: Pill },
  { id: "lifestyle", titleKey: "lifestyle", descKey: "socialLifestyle", icon: Activity },
  { id: "review", titleKey: "review", descKey: "confirmFinish", icon: CheckCircle2 },
];

interface Demographics {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  preferredName: string;
  dateOfBirth: string;
  gender: string;
  sexAtBirth: string;
  pronouns: string;
  race: string[];
  ethnicity: string;
  preferredLanguage: string;
  maritalStatus: string;
  email: string;
  countryCode: string;
  phone: string;
  alternatePhone: string;
  address: string;
  addressLine2: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  canMakeMedicalDecisions: boolean;
}

interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber: string;
  planType: string;
  subscriberName: string;
  subscriberRelationship: string;
  effectiveDate: string;
  hasSecondary: boolean;
  secondaryProvider: string;
  secondaryPolicyNumber: string;
}

interface PharmacyPreferences {
  preferredPharmacyName: string;
  preferredPharmacyAddress: string;
  preferredPharmacyPhone: string;
  useMailOrder: boolean;
  mailOrderProvider: string;
  savingsServices: string[];
}

interface PrimaryCareProvider {
  name: string;
  practice: string;
  phone: string;
  address: string;
  specialty: string;
  npi: string;
}

const SAVINGS_PHARMACY_OPTIONS = [
  { key: "goodrx", label: "GoodRx", url: "https://www.goodrx.com" },
  { key: "costplus", label: "Mark Cuban Cost Plus Drugs", url: "https://costplusdrugs.com" },
  { key: "amazon", label: "Amazon Pharmacy", url: "https://pharmacy.amazon.com" },
  { key: "walmart", label: "Walmart $4 Prescriptions", url: "https://www.walmart.com/cp/4-prescriptions/1078664" },
  { key: "costco", label: "Costco Pharmacy", url: "https://www.costco.com/pharmacy" },
  { key: "rxsaver", label: "RxSaver by RetailMeNot", url: "https://www.rxsaver.com" },
  { key: "blink", label: "Blink Health", url: "https://www.blinkhealth.com" },
  { key: "honeybee", label: "Honeybee Health", url: "https://www.honeybeehealth.com" },
];

const MAIL_ORDER_OPTIONS = [
  "Express Scripts",
  "CVS Caremark",
  "OptumRx",
  "Amazon Pharmacy",
  "Mark Cuban Cost Plus Drugs",
  "Pillpack (by Amazon)",
  "Alto Pharmacy",
  "Capsule Pharmacy",
  "Other",
];

interface ConditionItem {
  id: string;
  name: string;
  icdCode: string;
  status: string;
  diagnosedDate: string;
  treatedBy: string;
  notes: string;
}

interface SurgeryItem {
  id: string;
  procedureName: string;
  cptCode: string;
  date: string;
  facility: string;
  outcome: string;
}

interface FamilyHistoryItem {
  id: string;
  condition: string;
  relationship: string;
  ageAtOnset: string;
  notes: string;
}

interface AllergyItem {
  id: string;
  allergen: string;
  reaction: string;
  severity: string;
  onsetDate: string;
}

interface MedicationItem {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  status: string;
  startDate: string;
  purpose: string;
}

interface VaccinationItem {
  id: string;
  name: string;
  date: string;
  provider: string;
}

interface LifestyleData {
  smokingStatus: string;
  smokingDetail: string;
  alcoholUse: string;
  alcoholDetail: string;
  exerciseFrequency: string;
  exerciseType: string;
  sleepHours: string;
  dietType: string;
  stressLevel: string;
  substanceUse: string;
  occupation: string;
  livingSituation: string;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","VI","GU","AS","MP",
];

export default function ComprehensiveOnboarding() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fastenConnected, setFastenConnected] = useState(false);
  const [aiPrefilling, setAiPrefilling] = useState(false);
  const [aiReview, setAiReview] = useState<any>(null);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [healthDescription, setHealthDescription] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const [demographics, setDemographics] = useState<Demographics>({
    firstName: "", middleName: "NMN", lastName: "", suffix: "", preferredName: "",
    dateOfBirth: "", gender: "", sexAtBirth: "", pronouns: "",
    race: [], ethnicity: "", preferredLanguage: "en", maritalStatus: "",
    email: "", countryCode: "+1", phone: "", alternatePhone: "",
    address: "", addressLine2: "", city: "", state: "", zipCode: "", country: "US",
  });

  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [insurance, setInsurance] = useState<InsuranceInfo>({
    provider: "", policyNumber: "", groupNumber: "", planType: "",
    subscriberName: "", subscriberRelationship: "self", effectiveDate: "",
    hasSecondary: false, secondaryProvider: "", secondaryPolicyNumber: "",
  });

  const [pharmacy, setPharmacy] = useState<PharmacyPreferences>({
    preferredPharmacyName: "", preferredPharmacyAddress: "", preferredPharmacyPhone: "",
    useMailOrder: false, mailOrderProvider: "", savingsServices: [],
  });
  const [pcp, setPcp] = useState<PrimaryCareProvider>({
    name: "", practice: "", phone: "", address: "", specialty: "", npi: "",
  });

  const [conditions, setConditions] = useState<ConditionItem[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryItem[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryItem[]>([]);

  const [allergies, setAllergies] = useState<AllergyItem[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [vaccinations, setVaccinations] = useState<VaccinationItem[]>([]);

  const [lifestyle, setLifestyle] = useState<LifestyleData>({
    smokingStatus: "", smokingDetail: "", alcoholUse: "", alcoholDetail: "",
    exerciseFrequency: "", exerciseType: "", sleepHours: "", dietType: "",
    stressLevel: "", substanceUse: "", occupation: "", livingSituation: "",
  });

  const [consents, setConsents] = useState({
    termsAccepted: false,
    privacyAccepted: false,
    hipaaAcknowledged: false,
    dataProcessing: false,
    aiDisclosure: false,
  });

  useEffect(() => {
    apiRequest("POST", "/api/comprehensive-onboarding/session", {})
      .then(r => r.json())
      .then(d => { if (d.success) setSessionId(d.session.id); })
      .catch(() => {});
  }, []);

  const saveStep = useCallback(async (stepIndex: number, stepName: string, stepData: any) => {
    if (!sessionId) return;
    try {
      await apiRequest("POST", "/api/comprehensive-onboarding/save-step", {
        sessionId, stepIndex, stepName, stepData,
      });
    } catch {}
  }, [sessionId]);

  const allData = {
    demographics, emergencyContacts, insurance, pharmacy, pcp, conditions, surgeries,
    familyHistory, allergies, medications, vaccinations, lifestyle,
  };

  const handleFastenPrefill = async () => {
    setAiPrefilling(true);
    try {
      const res = await apiRequest("POST", "/api/comprehensive-onboarding/ai-prefill", {
        sessionId,
        fastenData: { source: "fasten_health", connected: true },
      });
      const data = await res.json();
      if (data.success && data.prefillData) {
        const p = data.prefillData;
        if (p.demographics) {
          setDemographics(prev => ({
            ...prev,
            ...(p.demographics.firstName && { firstName: p.demographics.firstName }),
            ...(p.demographics.middleName && { middleName: p.demographics.middleName }),
            ...(p.demographics.lastName && { lastName: p.demographics.lastName }),
            ...(p.demographics.dateOfBirth && { dateOfBirth: p.demographics.dateOfBirth }),
            ...(p.demographics.gender && { gender: p.demographics.gender }),
            ...(p.demographics.sexAtBirth && { sexAtBirth: p.demographics.sexAtBirth }),
            ...(p.demographics.phone && { phone: p.demographics.phone }),
            ...(p.demographics.email && { email: p.demographics.email }),
            ...(p.demographics.preferredLanguage && { preferredLanguage: p.demographics.preferredLanguage }),
            ...(p.demographics.address?.street && { address: p.demographics.address.street }),
            ...(p.demographics.address?.city && { city: p.demographics.address.city }),
            ...(p.demographics.address?.state && { state: p.demographics.address.state }),
            ...(p.demographics.address?.zipCode && { zipCode: p.demographics.address.zipCode }),
            ...(p.demographics.race && { race: p.demographics.race }),
            ...(p.demographics.ethnicity && { ethnicity: p.demographics.ethnicity }),
          }));
        }
        if (p.conditions?.length) {
          setConditions(p.conditions.map((c: any, i: number) => ({
            id: `pf-c-${i}`, name: c.name || "", status: c.status || "active",
            diagnosedDate: c.diagnosedDate || "", treatedBy: c.treatedBy || "", notes: "",
          })));
        }
        if (p.medications?.length) {
          setMedications(p.medications.map((m: any, i: number) => ({
            id: `pf-m-${i}`, name: m.name || "", dose: m.dose || "",
            frequency: m.frequency || "", status: m.status || "active",
            startDate: m.startDate || "", purpose: m.purpose || "",
          })));
        }
        if (p.allergies?.length) {
          setAllergies(p.allergies.map((a: any, i: number) => ({
            id: `pf-a-${i}`, allergen: a.allergen || "", reaction: a.reaction || "",
            severity: a.severity || "moderate", onsetDate: "",
          })));
        }
        if (p.surgeries?.length) {
          setSurgeries(p.surgeries.map((s: any, i: number) => ({
            id: `pf-s-${i}`, procedureName: s.procedureName || "",
            date: s.date || "", facility: s.facility || "", outcome: s.outcome || "",
          })));
        }
        if (p.vaccinations?.length) {
          setVaccinations(p.vaccinations.map((v: any, i: number) => ({
            id: `pf-v-${i}`, name: v.name || "", date: v.date || "", provider: v.provider || "",
          })));
        }
        if (p.familyHistory?.length) {
          setFamilyHistory(p.familyHistory.map((f: any, i: number) => ({
            id: `pf-f-${i}`, condition: f.condition || "", relationship: f.relationship || "", ageAtOnset: f.ageAtOnset || "", notes: f.notes || "",
          })));
        }
        if (p.emergencyContacts?.length) {
          setEmergencyContacts(p.emergencyContacts.map((e: any, i: number) => ({
            id: `pf-e-${i}`, name: e.name || "", relationship: e.relationship || "",
            phone: e.phone || "", email: "", isPrimary: i === 0, canMakeMedicalDecisions: false,
          })));
        }
        if (p.insurance) {
          setInsurance(prev => ({ ...prev, ...p.insurance }));
        }
        if (p.socialHistory) {
          setLifestyle(prev => ({
            ...prev,
            ...(p.socialHistory.smokingStatus && { smokingStatus: p.socialHistory.smokingStatus }),
            ...(p.socialHistory.alcoholUse && { alcoholUse: p.socialHistory.alcoholUse }),
            ...(p.socialHistory.exerciseFrequency && { exerciseFrequency: p.socialHistory.exerciseFrequency }),
          }));
        }
        setFastenConnected(true);
        toast({ title: "Records Imported", description: "Health data has been pre-filled. Please review each section carefully." });
      } else {
        toast({ title: "No Data Found", description: "Connect your records first via Fasten Health, then try again." });
      }
    } catch {
      toast({ title: "Import Failed", description: "Could not import health records. You can enter your information manually.", variant: "destructive" });
    } finally {
      setAiPrefilling(false);
    }
  };

  const handleAiSuggestConditions = async () => {
    if (!healthDescription.trim()) return;
    setAiSuggesting(true);
    try {
      const res = await apiRequest("POST", "/api/comprehensive-onboarding/ai-suggest-conditions", {
        description: healthDescription,
        age: demographics.dateOfBirth ? calculateAge(demographics.dateOfBirth) : undefined,
        gender: demographics.gender,
      });
      const data = await res.json();
      setAiSuggestions(data.suggestions || []);
      if (data.suggestions?.length) {
        toast({ title: "Suggestions Ready", description: `Found ${data.suggestions.length} conditions you may want to document. These are NOT diagnoses.` });
      }
    } catch {
      toast({ title: "Error", description: "Could not get suggestions.", variant: "destructive" });
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleAiReview = async () => {
    setAiReviewing(true);
    try {
      const res = await apiRequest("POST", "/api/comprehensive-onboarding/ai-review", { allData });
      const data = await res.json();
      if (data.success) setAiReview(data.review);
    } catch {} finally {
      setAiReviewing(false);
    }
  };

  const handleComplete = async () => {
    try {
      await apiRequest("POST", "/api/comprehensive-onboarding/complete", { sessionId, allData });
      localStorage.setItem("tabula_onboarding_complete", "true");
      toast({ title: "Onboarding Complete!", description: "Your health profile has been created successfully." });
      setCurrentStep(STEPS_KEYS.length);
    } catch {
      toast({ title: "Error", description: "Failed to save. Your data is stored locally.", variant: "destructive" });
    }
  };

  const lang = demographics.preferredLanguage || "en";

  const goNext = async () => {
    const step = STEPS_KEYS[currentStep];
    if (step) {
      const stepDataMap: Record<string, any> = {
        demographics, contacts: { emergencyContacts, insurance, pharmacy, pcp },
        conditions: { conditions, surgeries, familyHistory },
        allergies, medications: { medications, vaccinations },
        lifestyle,
      };
      await saveStep(currentStep, step.id, stepDataMap[step.id] || {});
    }
    if (currentStep === STEPS_KEYS.length - 1) {
      handleComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, STEPS_KEYS.length - 1));
    }
  };

  const goBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const progress = currentStep === 0 ? 0 : currentStep >= STEPS_KEYS.length ? 100 : ((currentStep) / (STEPS_KEYS.length - 1)) * 100;

  if (currentStep >= STEPS_KEYS.length) {
    return <CompletionScreen onGoToDashboard={() => setLocation("/")} />;
  }

  const StepIcon = STEPS_KEYS[currentStep].icon;
  const stepTitle = t(lang, STEPS_KEYS[currentStep].titleKey);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" data-testid="comprehensive-onboarding-page" role="main" aria-label="Health Profile Onboarding">
      <a href="#step-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none" data-testid="skip-to-content">
        Skip to step content
      </a>
      <a href="#step-navigation" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-40 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded focus:outline-none" data-testid="skip-to-navigation">
        Skip to navigation
      </a>
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center gap-4" role="banner">
          <div className="p-3 bg-primary/10 rounded-full" aria-hidden="true">
            <Stethoscope className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="onboarding-title">{t(lang, "healthProfileSetup")}</h1>
            <p className="text-muted-foreground">{t(lang, "comprehensiveOnboarding")}</p>
          </div>
        </header>

        {currentStep > 0 && (
          <nav className="flex items-center gap-1 overflow-x-auto pb-2" role="navigation" aria-label="Onboarding progress" id="step-navigation">
            {STEPS_KEYS.slice(1).map((step, idx) => {
              const stepIdx = idx + 1;
              const isComplete = currentStep > stepIdx;
              const isCurrent = currentStep === stepIdx;
              const Icon = step.icon;
              const stepLabel = t(lang, step.titleKey);
              return (
                <div key={step.id} className="flex items-center min-w-0">
                  <div
                    className={`flex items-center justify-center w-9 h-9 rounded-full border-2 shrink-0 transition-colors ${
                      isComplete ? "bg-primary border-primary text-primary-foreground" :
                      isCurrent ? "border-primary text-primary" :
                      "border-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step.id}`}
                    role="listitem"
                    aria-label={`${stepLabel}: ${isComplete ? "completed" : isCurrent ? "current step" : "not started"}`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {isComplete ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : <Icon className="w-4 h-4" aria-hidden="true" />}
                  </div>
                  {idx < STEPS_KEYS.length - 2 && (
                    <div className={`w-4 md:w-8 h-0.5 mx-0.5 ${isComplete ? "bg-primary" : "bg-muted"}`} aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </nav>
        )}

        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <StepIcon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle data-testid="step-title">{t(lang, STEPS_KEYS[currentStep].titleKey)}</CardTitle>
                  <CardDescription>{t(lang, STEPS_KEYS[currentStep].descKey)}</CardDescription>
                </div>
              </div>
              {currentStep > 0 && (
                <Badge variant="outline" data-testid="step-badge">
                  Step {currentStep} of {STEPS_KEYS.length - 1}
                </Badge>
              )}
            </div>
            {currentStep > 0 && <Progress value={progress} className="mt-4" data-testid="onboarding-progress" />}
          </CardHeader>

          <Separator />

          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="step-announcer">
            {currentStep > 0 ? `Step ${currentStep} of ${STEPS_KEYS.length - 1}: ${stepTitle}` : stepTitle}
          </div>

          <CardContent className="pt-6" id="step-content">
            <ScrollArea className="min-h-[420px] max-h-[560px] pr-2" role="region" aria-label={`${stepTitle} form content`} tabIndex={0}>
              {currentStep === 0 && (
                <WelcomeStep
                  fastenConnected={fastenConnected}
                  aiPrefilling={aiPrefilling}
                  onConnectFasten={handleFastenPrefill}
                />
              )}
              {currentStep === 1 && (
                <DemographicsStep demographics={demographics} setDemographics={setDemographics} lang={lang} />
              )}
              {currentStep === 2 && (
                <ContactsStep
                  emergencyContacts={emergencyContacts}
                  setEmergencyContacts={setEmergencyContacts}
                  insurance={insurance}
                  setInsurance={setInsurance}
                  pharmacy={pharmacy}
                  setPharmacy={setPharmacy}
                  pcp={pcp}
                  setPcp={setPcp}
                  lang={lang}
                />
              )}
              {currentStep === 3 && (
                <ConditionsStep
                  conditions={conditions} setConditions={setConditions}
                  surgeries={surgeries} setSurgeries={setSurgeries}
                  familyHistory={familyHistory} setFamilyHistory={setFamilyHistory}
                  healthDescription={healthDescription} setHealthDescription={setHealthDescription}
                  aiSuggestions={aiSuggestions} aiSuggesting={aiSuggesting}
                  onAiSuggest={handleAiSuggestConditions}
                  lang={lang}
                />
              )}
              {currentStep === 4 && (
                <AllergiesStep allergies={allergies} setAllergies={setAllergies} lang={lang} />
              )}
              {currentStep === 5 && (
                <MedicationsStep
                  medications={medications} setMedications={setMedications}
                  vaccinations={vaccinations} setVaccinations={setVaccinations}
                  lang={lang}
                />
              )}
              {currentStep === 6 && (
                <LifestyleStep lifestyle={lifestyle} setLifestyle={setLifestyle} lang={lang} />
              )}
              {currentStep === 7 && (
                <ReviewStep
                  allData={allData}
                  consents={consents}
                  setConsents={setConsents}
                  aiReview={aiReview}
                  aiReviewing={aiReviewing}
                  onAiReview={handleAiReview}
                  lang={lang}
                />
              )}
            </ScrollArea>
          </CardContent>

          <Separator />

          <CardFooter className="flex justify-between pt-4 flex-wrap gap-3" id="step-navigation-buttons">
            {currentStep > 0 ? (
              <Button variant="outline" onClick={goBack} data-testid="button-back" aria-label={`Go back to ${currentStep > 1 ? t(lang, STEPS_KEYS[currentStep - 1].titleKey) : "welcome"}`}>
                <ChevronLeft className="w-4 h-4 mr-2" aria-hidden="true" /> {t(lang, "back")}
              </Button>
            ) : <div />}
            <Button
              onClick={goNext}
              disabled={currentStep === 7 && !consents.termsAccepted}
              data-testid="button-next"
              aria-label={currentStep === 0 ? t(lang, "getStarted") : currentStep === 7 ? t(lang, "completeSetup") : `Continue to ${currentStep < STEPS_KEYS.length - 1 ? t(lang, STEPS_KEYS[currentStep + 1].titleKey) : "finish"}`}
            >
              {currentStep === 0 ? t(lang, "getStarted") : currentStep === 7 ? t(lang, "completeSetup") : t(lang, "continue_")}
              <ChevronRight className="w-4 h-4 ml-2" aria-hidden="true" />
            </Button>
          </CardFooter>
        </Card>

        <Alert className="border-blue-500/20 bg-blue-500/5">
          <Info className="w-4 h-4 text-blue-500" />
          <AlertDescription className="text-xs">
            <strong>{t(lang, "noCdsCompliance")}:</strong> {t(lang, "noMedAdvice")}
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}

function calculateAge(dob: string): number {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function WelcomeStep({ fastenConnected, aiPrefilling, onConnectFasten }: {
  fastenConnected: boolean;
  aiPrefilling: boolean;
  onConnectFasten: () => void;
}) {
  return (
    <div className="space-y-6 py-2" data-testid="welcome-step">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold">Welcome to Your Health Journey</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          We'll walk you through setting up your complete health profile. You can import your existing records or enter information manually.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg shrink-0">
              <Link2 className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="font-semibold text-lg">Import from Fasten Health</h3>
                <p className="text-sm text-muted-foreground">
                  Connect to 25,000+ healthcare providers to automatically import your health records. AI will organize and pre-fill your profile.
                </p>
              </div>
              {fastenConnected ? (
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30" data-testid="badge-fasten-connected">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Records Imported
                </Badge>
              ) : (
                <div className="flex gap-3 flex-wrap">
                  <Button onClick={onConnectFasten} disabled={aiPrefilling} data-testid="button-connect-fasten">
                    {aiPrefilling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                    {aiPrefilling ? "Importing..." : "Connect & Import Records"}
                  </Button>
                  <a href="/fasten-connect" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" data-testid="button-open-fasten">
                      Open Fasten Health Connect
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { icon: User, title: "Demographics & Identity", desc: "Name, DOB, address, contact info, race, ethnicity" },
          { icon: Heart, title: "Complete Medical History", desc: "Conditions, surgeries, family history" },
          { icon: Pill, title: "Medications & Vaccinations", desc: "Current meds, dosages, immunization records" },
          { icon: Activity, title: "Lifestyle & Social History", desc: "Smoking, alcohol, exercise, diet, stress" },
          { icon: AlertTriangle, title: "Allergies & Reactions", desc: "Drug, food, and environmental allergies" },
          { icon: Shield, title: "Insurance & Emergency Contacts", desc: "Coverage details and emergency info" },
        ].map((item, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{item.title}</h4>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <Calendar className="w-4 h-4" />
        <AlertDescription>
          This setup takes about 10-15 minutes. All sections are optional — you can skip and complete them later from your profile.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function DemographicsStep({ demographics: d, setDemographics: setD, lang }: {
  demographics: Demographics;
  setDemographics: (d: Demographics) => void;
  lang: string;
}) {
  const update = (field: keyof Demographics, value: any) => setD({ ...d, [field]: value });
  const toggleRace = (race: string) => {
    setD({ ...d, race: d.race.includes(race) ? d.race.filter(r => r !== race) : [...d.race, race] });
  };

  return (
    <div className="space-y-6" data-testid="demographics-step" role="form" aria-label="Demographics information">
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Globe className="w-5 h-5 text-blue-500" aria-hidden="true" />
            <Label className="font-medium text-base">{t(lang, "preferredLanguage")}</Label>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{t(lang, "selectLanguageFirst")}</p>
          <Select value={d.preferredLanguage} onValueChange={v => update("preferredLanguage", v)}>
            <SelectTrigger data-testid="select-language-top" className="max-w-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español (Spanish)</SelectItem>
              <SelectItem value="zh-mandarin">中文 — 普通话 (Mandarin)</SelectItem>
              <SelectItem value="zh-cantonese">中文 — 粤语 (Cantonese)</SelectItem>
              <SelectItem value="tl">Tagalog / Filipino</SelectItem>
              <SelectItem value="vi">Tiếng Việt (Vietnamese)</SelectItem>
              <SelectItem value="ar">العربية (Arabic)</SelectItem>
              <SelectItem value="fr">Français (French)</SelectItem>
              <SelectItem value="fr-creole">Kreyòl Ayisyen (Haitian Creole)</SelectItem>
              <SelectItem value="ko">한국어 (Korean)</SelectItem>
              <SelectItem value="ru">Русский (Russian)</SelectItem>
              <SelectItem value="pt">Português (Portuguese)</SelectItem>
              <SelectItem value="pt-br">Português — Brasil (Brazilian Portuguese)</SelectItem>
              <SelectItem value="de">Deutsch (German)</SelectItem>
              <SelectItem value="ja">日本語 (Japanese)</SelectItem>
              <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
              <SelectItem value="ur">اردو (Urdu)</SelectItem>
              <SelectItem value="bn">বাংলা (Bengali)</SelectItem>
              <SelectItem value="pa">ਪੰਜਾਬੀ (Punjabi)</SelectItem>
              <SelectItem value="gu">ગુજરાતી (Gujarati)</SelectItem>
              <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
              <SelectItem value="te">తెలుగు (Telugu)</SelectItem>
              <SelectItem value="pl">Polski (Polish)</SelectItem>
              <SelectItem value="it">Italiano (Italian)</SelectItem>
              <SelectItem value="fa">فارسی (Farsi / Persian)</SelectItem>
              <SelectItem value="he">עברית (Hebrew)</SelectItem>
              <SelectItem value="th">ไทย (Thai)</SelectItem>
              <SelectItem value="sw">Kiswahili (Swahili)</SelectItem>
              <SelectItem value="am">አማርኛ (Amharic)</SelectItem>
              <SelectItem value="so">Soomaali (Somali)</SelectItem>
              <SelectItem value="yo">Yorùbá</SelectItem>
              <SelectItem value="ig">Igbo</SelectItem>
              <SelectItem value="hmn">Hmong</SelectItem>
              <SelectItem value="my">မြန်မာ (Burmese)</SelectItem>
              <SelectItem value="ne">नेपाली (Nepali)</SelectItem>
              <SelectItem value="km">ខ្មែរ (Khmer / Cambodian)</SelectItem>
              <SelectItem value="lo">ລາວ (Lao)</SelectItem>
              <SelectItem value="tr">Türkçe (Turkish)</SelectItem>
              <SelectItem value="el">Ελληνικά (Greek)</SelectItem>
              <SelectItem value="nl">Nederlands (Dutch)</SelectItem>
              <SelectItem value="ro">Română (Romanian)</SelectItem>
              <SelectItem value="uk">Українська (Ukrainian)</SelectItem>
              <SelectItem value="asl">American Sign Language (ASL)</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <h3 className="font-semibold text-lg flex items-center gap-2">
        <User className="w-5 h-5 text-primary" /> {t(lang, "personalIdentity")}
      </h3>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t(lang, "firstName")} *</Label>
          <div className="flex gap-1">
            <Input id="firstName" value={d.firstName} onChange={e => update("firstName", e.target.value)} placeholder={t(lang, "firstName")} data-testid="input-first-name" aria-required="true" className="flex-1" />
            <VoiceInput onResult={text => update("firstName", text)} language={lang} label="Voice input for first name" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="middleName" className="flex items-center gap-1">
            {t(lang, "middleName")} *
            <span className="text-xs text-muted-foreground">(USCDI)</span>
          </Label>
          <div className="flex gap-2">
            <Input id="middleName" value={d.middleName} onChange={e => update("middleName", e.target.value)} placeholder={t(lang, "middleName")} data-testid="input-middle-name" className="flex-1" aria-required="true" aria-describedby="middleName-help" />
            <VoiceInput onResult={text => update("middleName", text)} language={lang} label="Voice input for middle name" />
            <Button type="button" variant={d.middleName === "NMN" ? "default" : "outline"} size="sm" onClick={() => update("middleName", "NMN")} data-testid="button-nmn" aria-label="No Middle Name" aria-pressed={d.middleName === "NMN"}>NMN</Button>
            <Button type="button" variant={d.middleName === "UNK" ? "default" : "outline"} size="sm" onClick={() => update("middleName", "UNK")} data-testid="button-unk" aria-label="Unknown middle name" aria-pressed={d.middleName === "UNK"}>UNK</Button>
          </div>
          <p id="middleName-help" className="text-xs text-muted-foreground">Per HHS/ONC: Full middle name from government ID. NMN = No Middle Name, UNK = Unknown.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">{t(lang, "lastName")} *</Label>
          <div className="flex gap-1">
            <Input id="lastName" value={d.lastName} onChange={e => update("lastName", e.target.value)} placeholder={t(lang, "lastName")} data-testid="input-last-name" aria-required="true" className="flex-1" />
            <VoiceInput onResult={text => update("lastName", text)} language={lang} label="Voice input for last name" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="suffix">{t(lang, "suffix")}</Label>
          <Select value={d.suffix} onValueChange={v => update("suffix", v)}>
            <SelectTrigger data-testid="select-suffix"><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="Jr.">Jr.</SelectItem>
              <SelectItem value="Sr.">Sr.</SelectItem>
              <SelectItem value="II">II</SelectItem>
              <SelectItem value="III">III</SelectItem>
              <SelectItem value="IV">IV</SelectItem>
              <SelectItem value="MD">MD</SelectItem>
              <SelectItem value="DO">DO</SelectItem>
              <SelectItem value="PhD">PhD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="preferredName">{t(lang, "preferredName")}</Label>
          <Input id="preferredName" value={d.preferredName} onChange={e => update("preferredName", e.target.value)} placeholder={t(lang, "preferredName")} data-testid="input-preferred-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dob">{t(lang, "dateOfBirth")} *</Label>
          <Input
            id="dob"
            value={d.dateOfBirth}
            placeholder="MM/DD/YYYY"
            maxLength={10}
            onChange={e => {
              let val = e.target.value.replace(/[^\d/]/g, "");
              const raw = val.replace(/\//g, "");
              if (raw.length >= 2 && !val.includes("/")) {
                val = raw.slice(0, 2) + "/" + raw.slice(2);
              }
              if (raw.length >= 4) {
                val = raw.slice(0, 2) + "/" + raw.slice(2, 4) + "/" + raw.slice(4, 8);
              }
              update("dateOfBirth", val);
            }}
            onKeyDown={e => {
              const input = e.target as HTMLInputElement;
              const val = input.value;
              if (e.key === "Backspace" && (val.endsWith("/"))) {
                e.preventDefault();
                update("dateOfBirth", val.slice(0, -1));
              }
            }}
            data-testid="input-dob"
          />
          <p className="text-xs text-muted-foreground">Format: MM/DD/YYYY</p>
        </div>
      </div>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> {t(lang, "identityDemographics")}
      </h3>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{t(lang, "genderIdentity")}</Label>
          <Select value={d.gender} onValueChange={v => update("gender", v)}>
            <SelectTrigger data-testid="select-gender"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t(lang, "male")}</SelectItem>
              <SelectItem value="female">{t(lang, "female")}</SelectItem>
              <SelectItem value="non-binary">{t(lang, "nonBinary")}</SelectItem>
              <SelectItem value="transgender-male">{t(lang, "transgender")}</SelectItem>
              <SelectItem value="transgender-female">{t(lang, "transgenderFemale")}</SelectItem>
              <SelectItem value="other">{t(lang, "other")}</SelectItem>
              <SelectItem value="prefer-not-to-say">{t(lang, "preferNotToSay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "sexAtBirth")}</Label>
          <Select value={d.sexAtBirth} onValueChange={v => update("sexAtBirth", v)}>
            <SelectTrigger data-testid="select-sex-at-birth"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">{t(lang, "male")}</SelectItem>
              <SelectItem value="female">{t(lang, "female")}</SelectItem>
              <SelectItem value="intersex">Intersex</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "pronouns")}</Label>
          <Select value={d.pronouns} onValueChange={v => update("pronouns", v)}>
            <SelectTrigger data-testid="select-pronouns"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="he/him">{t(lang, "heHim")}</SelectItem>
              <SelectItem value="she/her">{t(lang, "sheHer")}</SelectItem>
              <SelectItem value="they/them">{t(lang, "theyThem")}</SelectItem>
              <SelectItem value="ze/zir">Ze/Zir</SelectItem>
              <SelectItem value="other">{t(lang, "other")}</SelectItem>
              <SelectItem value="prefer-not-to-say">{t(lang, "preferNotToSay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t(lang, "race")} ({t(lang, "selectAllApply")})</Label>
        <div className="flex flex-wrap gap-2">
          {[
            "American Indian or Alaska Native",
            "Asian — Chinese", "Asian — Filipino", "Asian — Indian (South Asian)", "Asian — Japanese",
            "Asian — Korean", "Asian — Vietnamese", "Asian — Bangladeshi", "Asian — Pakistani",
            "Asian — Sri Lankan", "Asian — Nepali", "Asian — Other Asian",
            "Black or African American",
            "Native Hawaiian", "Guamanian or Chamorro", "Samoan", "Other Pacific Islander",
            "White",
            "Middle Eastern or North African",
            "Two or More Races",
            "Other",
            "Prefer not to say",
          ].map(race => (
            <Badge
              key={race}
              variant={d.race.includes(race) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => toggleRace(race)}
              data-testid={`badge-race-${race.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {race}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "ethnicity")}</Label>
          <Select value={d.ethnicity} onValueChange={v => update("ethnicity", v)}>
            <SelectTrigger data-testid="select-ethnicity"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hispanic-latino-mexican">Hispanic or Latino — Mexican, Mexican American, Chicano/a</SelectItem>
              <SelectItem value="hispanic-latino-puerto-rican">Hispanic or Latino — Puerto Rican</SelectItem>
              <SelectItem value="hispanic-latino-cuban">Hispanic or Latino — Cuban</SelectItem>
              <SelectItem value="hispanic-latino-dominican">Hispanic or Latino — Dominican</SelectItem>
              <SelectItem value="hispanic-latino-salvadoran">Hispanic or Latino — Salvadoran</SelectItem>
              <SelectItem value="hispanic-latino-guatemalan">Hispanic or Latino — Guatemalan</SelectItem>
              <SelectItem value="hispanic-latino-colombian">Hispanic or Latino — Colombian</SelectItem>
              <SelectItem value="hispanic-latino-honduran">Hispanic or Latino — Honduran</SelectItem>
              <SelectItem value="hispanic-latino-ecuadorian">Hispanic or Latino — Ecuadorian</SelectItem>
              <SelectItem value="hispanic-latino-peruvian">Hispanic or Latino — Peruvian</SelectItem>
              <SelectItem value="hispanic-latino-venezuelan">Hispanic or Latino — Venezuelan</SelectItem>
              <SelectItem value="hispanic-latino-other">Hispanic or Latino — Other</SelectItem>
              <SelectItem value="not-hispanic-latino">Not Hispanic or Latino</SelectItem>
              <SelectItem value="prefer-not-to-say">{t(lang, "preferNotToSay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "maritalStatus")}</Label>
          <Select value={d.maritalStatus} onValueChange={v => update("maritalStatus", v)}>
            <SelectTrigger data-testid="select-marital"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">{t(lang, "single")}</SelectItem>
              <SelectItem value="married">{t(lang, "married")}</SelectItem>
              <SelectItem value="domestic-partner">{t(lang, "domesticPartner")}</SelectItem>
              <SelectItem value="divorced">{t(lang, "divorced")}</SelectItem>
              <SelectItem value="widowed">{t(lang, "widowed")}</SelectItem>
              <SelectItem value="separated">{t(lang, "separated")}</SelectItem>
              <SelectItem value="prefer-not-to-say">{t(lang, "preferNotToSay")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Phone className="w-5 h-5 text-primary" /> {t(lang, "contactInfo")}
      </h3>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">{t(lang, "email")} *</Label>
          <Input id="email" type="email" value={d.email} onChange={e => update("email", e.target.value)} placeholder="your.email@example.com" data-testid="input-email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">{t(lang, "phone")} *</Label>
          <div className="flex gap-2">
            <Select value={d.countryCode} onValueChange={v => update("countryCode", v)}>
              <SelectTrigger className="w-[120px]" data-testid="select-country-code">
                <SelectValue placeholder="+1" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map(cc => (
                  <SelectItem key={cc.code} value={cc.code}>
                    {cc.flag} {cc.code} ({cc.country})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input id="phone" type="tel" value={d.phone} onChange={e => update("phone", e.target.value)} placeholder="(555) 123-4567" data-testid="input-phone" className="flex-1" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="altPhone">{t(lang, "alternatePhone")}</Label>
        <div className="flex gap-2">
          <Select value={d.countryCode} onValueChange={v => update("countryCode", v)}>
            <SelectTrigger className="w-[120px]" data-testid="select-alt-country-code">
              <SelectValue placeholder="+1" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map(cc => (
                <SelectItem key={cc.code} value={cc.code}>
                  {cc.flag} {cc.code} ({cc.country})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input id="altPhone" type="tel" value={d.alternatePhone} onChange={e => update("alternatePhone", e.target.value)} placeholder="(555) 987-6543" data-testid="input-alt-phone" className="flex-1" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">{t(lang, "addressLine1")}</Label>
        <Input id="address" value={d.address} onChange={e => update("address", e.target.value)} placeholder="123 Main St" data-testid="input-address" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address2">{t(lang, "addressLine2")}</Label>
        <Input id="address2" value={d.addressLine2} onChange={e => update("addressLine2", e.target.value)} placeholder="Apt, Suite, Unit" data-testid="input-address2" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="city">{t(lang, "city")}</Label>
          <Input id="city" value={d.city} onChange={e => update("city", e.target.value)} placeholder={t(lang, "city")} data-testid="input-city" />
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "stateProvince")}</Label>
          <Select value={d.state} onValueChange={v => update("state", v)}>
            <SelectTrigger data-testid="select-state"><SelectValue placeholder="State" /></SelectTrigger>
            <SelectContent>
              {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">{t(lang, "zipCode")}</Label>
          <Input id="zip" value={d.zipCode} onChange={e => update("zipCode", e.target.value)} placeholder="10001" data-testid="input-zip" />
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "country")}</Label>
          <Select value={d.country} onValueChange={v => update("country", v)}>
            <SelectTrigger data-testid="select-country"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="MX">Mexico</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="IN">India</SelectItem>
              <SelectItem value="PK">Pakistan</SelectItem>
              <SelectItem value="BD">Bangladesh</SelectItem>
              <SelectItem value="LK">Sri Lanka</SelectItem>
              <SelectItem value="NP">Nepal</SelectItem>
              <SelectItem value="PH">Philippines</SelectItem>
              <SelectItem value="VN">Vietnam</SelectItem>
              <SelectItem value="CN">China</SelectItem>
              <SelectItem value="JP">Japan</SelectItem>
              <SelectItem value="KR">South Korea</SelectItem>
              <SelectItem value="TH">Thailand</SelectItem>
              <SelectItem value="ID">Indonesia</SelectItem>
              <SelectItem value="MY">Malaysia</SelectItem>
              <SelectItem value="SG">Singapore</SelectItem>
              <SelectItem value="AE">United Arab Emirates</SelectItem>
              <SelectItem value="SA">Saudi Arabia</SelectItem>
              <SelectItem value="EG">Egypt</SelectItem>
              <SelectItem value="NG">Nigeria</SelectItem>
              <SelectItem value="KE">Kenya</SelectItem>
              <SelectItem value="ZA">South Africa</SelectItem>
              <SelectItem value="ET">Ethiopia</SelectItem>
              <SelectItem value="GH">Ghana</SelectItem>
              <SelectItem value="TZ">Tanzania</SelectItem>
              <SelectItem value="BR">Brazil</SelectItem>
              <SelectItem value="CO">Colombia</SelectItem>
              <SelectItem value="PE">Peru</SelectItem>
              <SelectItem value="AR">Argentina</SelectItem>
              <SelectItem value="CL">Chile</SelectItem>
              <SelectItem value="VE">Venezuela</SelectItem>
              <SelectItem value="CU">Cuba</SelectItem>
              <SelectItem value="HT">Haiti</SelectItem>
              <SelectItem value="PR">Puerto Rico</SelectItem>
              <SelectItem value="FR">France</SelectItem>
              <SelectItem value="DE">Germany</SelectItem>
              <SelectItem value="IT">Italy</SelectItem>
              <SelectItem value="ES">Spain</SelectItem>
              <SelectItem value="PT">Portugal</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
              <SelectItem value="NZ">New Zealand</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ContactsStep({ emergencyContacts, setEmergencyContacts, insurance, setInsurance, pharmacy, setPharmacy, pcp, setPcp, lang }: {
  emergencyContacts: EmergencyContact[];
  setEmergencyContacts: (c: EmergencyContact[]) => void;
  lang: string;
  insurance: InsuranceInfo;
  setInsurance: (i: InsuranceInfo) => void;
  pharmacy: PharmacyPreferences;
  setPharmacy: (p: PharmacyPreferences) => void;
  pcp: PrimaryCareProvider;
  setPcp: (p: PrimaryCareProvider) => void;
}) {
  const addContact = () => {
    setEmergencyContacts([...emergencyContacts, {
      id: uid(), name: "", relationship: "", phone: "", email: "",
      isPrimary: emergencyContacts.length === 0, canMakeMedicalDecisions: false,
    }]);
  };
  const updateContact = (id: string, field: keyof EmergencyContact, value: any) => {
    setEmergencyContacts(emergencyContacts.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const removeContact = (id: string) => {
    setEmergencyContacts(emergencyContacts.filter(c => c.id !== id));
  };
  const updateIns = (field: keyof InsuranceInfo, value: any) => setInsurance({ ...insurance, [field]: value });

  const handleOcrInsurance = useCallback((text: string) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const joined = lines.join(" ");
    const policyMatch = joined.match(/(?:policy|member|id|subscriber)\s*[#:]?\s*([A-Z0-9-]+)/i);
    const groupMatch = joined.match(/(?:group|grp)\s*[#:]?\s*([A-Z0-9-]+)/i);
    const providerMatch = lines.find(l => /(?:aetna|cigna|united|anthem|blue\s*cross|humana|kaiser|medicare|medicaid|tricare|bcbs)/i.test(l));
    if (policyMatch) updateIns("policyNumber", policyMatch[1]);
    if (groupMatch) updateIns("groupNumber", groupMatch[1]);
    if (providerMatch) updateIns("provider", providerMatch.replace(/[^a-zA-Z\s]/g, "").trim());
  }, [insurance]);

  return (
    <div className="space-y-6" data-testid="contacts-step" role="form" aria-label="Contacts, insurance, and provider information">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Phone className="w-5 h-5 text-primary" aria-hidden="true" /> {t(lang, "emergencyContacts")}
      </h3>

      {emergencyContacts.map((c, idx) => (
        <Card key={c.id} className="relative">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={c.isPrimary ? "default" : "outline"}>
                {c.isPrimary ? t(lang, "primaryContact") : `${t(lang, "contacts")} ${idx + 1}`}
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => removeContact(c.id)} data-testid={`button-remove-contact-${idx}`}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t(lang, "fullName")} *</Label>
                <div className="flex gap-1">
                  <Input value={c.name} onChange={e => updateContact(c.id, "name", e.target.value)} placeholder={t(lang, "fullName")} data-testid={`input-contact-name-${idx}`} aria-required="true" className="flex-1" />
                  <VoiceInput onResult={text => updateContact(c.id, "name", text)} language={lang} label={`Voice input for contact ${idx + 1} name`} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t(lang, "relationship")} *</Label>
                <Select value={c.relationship} onValueChange={v => updateContact(c.id, "relationship", v)}>
                  <SelectTrigger data-testid={`select-contact-relationship-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spouse">Spouse</SelectItem>
                    <SelectItem value="domestic-partner">Domestic Partner</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="stepparent">Stepparent</SelectItem>
                    <SelectItem value="child">Child (Adult)</SelectItem>
                    <SelectItem value="stepchild">Stepchild</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="half-sibling">Half-Sibling</SelectItem>
                    <SelectItem value="grandparent">Grandparent</SelectItem>
                    <SelectItem value="grandchild">Grandchild</SelectItem>
                    <SelectItem value="aunt">Aunt</SelectItem>
                    <SelectItem value="uncle">Uncle</SelectItem>
                    <SelectItem value="niece">Niece</SelectItem>
                    <SelectItem value="nephew">Nephew</SelectItem>
                    <SelectItem value="cousin">Cousin</SelectItem>
                    <SelectItem value="in-law">In-Law</SelectItem>
                    <SelectItem value="legal-guardian">Legal Guardian</SelectItem>
                    <SelectItem value="ward">Ward (I am their guardian)</SelectItem>
                    <SelectItem value="power-of-attorney">Power of Attorney</SelectItem>
                    <SelectItem value="healthcare-proxy">Healthcare Proxy</SelectItem>
                    <SelectItem value="caregiver">Caregiver</SelectItem>
                    <SelectItem value="care-recipient">Care Recipient (I am their caregiver)</SelectItem>
                    <SelectItem value="foster-parent">Foster Parent</SelectItem>
                    <SelectItem value="foster-child">Foster Child</SelectItem>
                    <SelectItem value="friend">Friend</SelectItem>
                    <SelectItem value="neighbor">Neighbor</SelectItem>
                    <SelectItem value="coworker">Coworker</SelectItem>
                    <SelectItem value="caseworker">Social Worker / Caseworker</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t(lang, "phone")} *</Label>
                <Input type="tel" value={c.phone} onChange={e => updateContact(c.id, "phone", e.target.value)} placeholder="(555) 123-4567" data-testid={`input-contact-phone-${idx}`} />
              </div>
              <div className="space-y-2">
                <Label>{t(lang, "email")}</Label>
                <Input type="email" value={c.email} onChange={e => updateContact(c.id, "email", e.target.value)} placeholder="email@example.com" data-testid={`input-contact-email-${idx}`} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox checked={c.canMakeMedicalDecisions} onCheckedChange={v => updateContact(c.id, "canMakeMedicalDecisions", v)} data-testid={`checkbox-medical-decisions-${idx}`} />
                <Label className="text-sm">{t(lang, "canMakeMedicalDecisions")}</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={addContact} data-testid="button-add-contact">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addEmergencyContact")}
      </Button>

      <Separator />

      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" aria-hidden="true" /> {t(lang, "insuranceInfo")}
      </h3>

      <OcrScanner
        onTextExtracted={handleOcrInsurance}
        label="Scan Insurance Card"
        compact
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "insuranceProvider")}</Label>
          <div className="flex gap-1">
            <Input value={insurance.provider} onChange={e => updateIns("provider", e.target.value)} placeholder="e.g., Blue Cross Blue Shield" data-testid="input-insurance-provider" className="flex-1" />
            <VoiceInput onResult={text => updateIns("provider", text)} language={lang} label="Voice input for insurance provider" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "planType")}</Label>
          <Select value={insurance.planType} onValueChange={v => updateIns("planType", v)}>
            <SelectTrigger data-testid="select-plan-type"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hmo">HMO</SelectItem>
              <SelectItem value="ppo">PPO</SelectItem>
              <SelectItem value="epo">EPO</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
              <SelectItem value="hdhp">HDHP</SelectItem>
              <SelectItem value="medicare">Medicare</SelectItem>
              <SelectItem value="medicaid">Medicaid</SelectItem>
              <SelectItem value="tricare">TRICARE</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "policyNumber")}</Label>
          <Input value={insurance.policyNumber} onChange={e => updateIns("policyNumber", e.target.value)} placeholder="Policy number" data-testid="input-policy-number" />
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "groupNumber")}</Label>
          <Input value={insurance.groupNumber} onChange={e => updateIns("groupNumber", e.target.value)} placeholder="Group number" data-testid="input-group-number" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "subscriberName")}</Label>
          <Input value={insurance.subscriberName} onChange={e => updateIns("subscriberName", e.target.value)} placeholder="If different from patient" data-testid="input-subscriber-name" />
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "subscriberRelationship")}</Label>
          <Select value={insurance.subscriberRelationship} onValueChange={v => updateIns("subscriberRelationship", v)}>
            <SelectTrigger data-testid="select-subscriber-rel"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Self</SelectItem>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="domestic-partner">Domestic Partner</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
              <SelectItem value="stepparent">Stepparent</SelectItem>
              <SelectItem value="grandparent">Grandparent</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="legal-guardian">Legal Guardian</SelectItem>
              <SelectItem value="foster-parent">Foster Parent</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t(lang, "effectiveDate")}</Label>
        <Input type="date" value={insurance.effectiveDate} onChange={e => updateIns("effectiveDate", e.target.value)} data-testid="input-effective-date" />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox checked={insurance.hasSecondary} onCheckedChange={v => updateIns("hasSecondary", v)} data-testid="checkbox-secondary-insurance" />
        <Label className="text-sm">{t(lang, "secondaryInsurance")}</Label>
      </div>

      {insurance.hasSecondary && (
        <div className="grid gap-4 md:grid-cols-2 pl-6 border-l-2 border-muted">
          <div className="space-y-2">
            <Label>{t(lang, "secondaryProvider")}</Label>
            <Input value={insurance.secondaryProvider} onChange={e => updateIns("secondaryProvider", e.target.value)} placeholder="Secondary insurer" data-testid="input-secondary-provider" />
          </div>
          <div className="space-y-2">
            <Label>{t(lang, "secondaryPolicyNumber")}</Label>
            <Input value={insurance.secondaryPolicyNumber} onChange={e => updateIns("secondaryPolicyNumber", e.target.value)} placeholder="Policy number" data-testid="input-secondary-policy" />
          </div>
        </div>
      )}

      <Separator />

      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" /> {t(lang, "pharmacyPreferences")}
      </h3>

      <PharmacySearch pharmacy={pharmacy} setPharmacy={setPharmacy} lang={lang} />

      <Card className="border-primary/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox checked={pharmacy.useMailOrder} onCheckedChange={v => setPharmacy({ ...pharmacy, useMailOrder: !!v })} data-testid="checkbox-mail-order" />
            <Label className="text-sm font-medium">{t(lang, "useMailOrder")}</Label>
          </div>
          {pharmacy.useMailOrder && (
            <div className="space-y-2 pl-6 border-l-2 border-muted">
              <Label>{t(lang, "mailOrderProvider")}</Label>
              <Select value={pharmacy.mailOrderProvider} onValueChange={v => setPharmacy({ ...pharmacy, mailOrderProvider: v })}>
                <SelectTrigger data-testid="select-mail-order-provider"><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  {MAIL_ORDER_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-600" /> {t(lang, "savingsAlternatives")}</h4>
          <p className="text-sm text-muted-foreground">{t(lang, "savingsNote")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SAVINGS_PHARMACY_OPTIONS.map(opt => (
              <div key={opt.key} className="flex items-center gap-3 p-2 rounded-md border bg-background">
                <Checkbox
                  checked={pharmacy.savingsServices.includes(opt.key)}
                  onCheckedChange={v => {
                    const next = v
                      ? [...pharmacy.savingsServices, opt.key]
                      : pharmacy.savingsServices.filter(s => s !== opt.key);
                    setPharmacy({ ...pharmacy, savingsServices: next });
                  }}
                  data-testid={`checkbox-savings-${opt.key}`}
                />
                <div className="flex-1">
                  <Label className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                </div>
                <a href={opt.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Stethoscope className="w-5 h-5 text-primary" /> {t(lang, "primaryCareProvider")}
      </h3>

      <ProviderSearch pcp={pcp} setPcp={setPcp} lang={lang} />
    </div>
  );
}

function ProviderSearch({ pcp, setPcp, lang }: { pcp: PrimaryCareProvider; setPcp: (p: PrimaryCareProvider) => void; lang: string }) {
  const [providerQuery, setProviderQuery] = useState("");
  const [providerResults, setProviderResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const searchProviders = async () => {
    if (!providerQuery.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      const parts = providerQuery.trim().split(/\s+/);
      if (parts.length >= 2) {
        params.set("first_name", parts[0]);
        params.set("last_name", parts.slice(1).join(" "));
      } else {
        params.set("organization_name", providerQuery.trim());
      }
      params.set("enumeration_type", "NPI-1");
      params.set("limit", "10");
      params.set("version", "2.1");
      const resp = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params.toString()}`);
      const data = await resp.json();
      setProviderResults(data.results || []);
    } catch {
      setProviderResults([]);
    }
    setSearching(false);
  };

  const selectProvider = (result: any) => {
    const basic = result.basic || {};
    const addr = result.addresses?.[0] || {};
    setPcp({
      name: `${basic.first_name || ""} ${basic.last_name || ""}`.trim() || basic.organization_name || "",
      practice: basic.organization_name || addr.organization_name || "",
      phone: addr.telephone_number || "",
      address: [addr.address_1, addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
      specialty: result.taxonomies?.[0]?.desc || "",
      npi: result.number?.toString() || "",
    });
    setProviderResults([]);
    setProviderQuery("");
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-3 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2"><Search className="w-4 h-4 text-blue-500" /> Search NPI Registry</h4>
            <div className="flex gap-2">
              <Input
                value={providerQuery}
                onChange={e => setProviderQuery(e.target.value)}
                placeholder="Search by provider name or clinic..."
                onKeyDown={e => e.key === "Enter" && searchProviders()}
                data-testid="input-provider-search"
                className="flex-1"
              />
              <Button size="sm" onClick={searchProviders} disabled={searching} data-testid="button-search-provider">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {providerResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {providerResults.map((r: any, i: number) => {
                  const b = r.basic || {};
                  const a = r.addresses?.[0] || {};
                  const name = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.organization_name || "";
                  return (
                    <div key={i} className="p-2 bg-background rounded border hover:border-primary/50 cursor-pointer text-sm" onClick={() => selectProvider(r)} data-testid={`provider-result-${i}`}>
                      <div className="font-medium">{name} <span className="text-xs text-muted-foreground ml-1">NPI: {r.number}</span></div>
                      <div className="text-xs text-muted-foreground">{r.taxonomies?.[0]?.desc || ""} — {[a.city, a.state].filter(Boolean).join(", ")}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t(lang, "pcpName")} *</Label>
            <Input value={pcp.name} onChange={e => setPcp({ ...pcp, name: e.target.value })} placeholder="e.g., Dr. Jane Smith" data-testid="input-pcp-name" />
          </div>
          <div className="space-y-2">
            <Label>{t(lang, "pcpSpecialty")}</Label>
            <Input value={pcp.specialty} onChange={e => setPcp({ ...pcp, specialty: e.target.value })} placeholder="e.g., Family Medicine" data-testid="input-pcp-specialty" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t(lang, "pcpPractice")}</Label>
            <Input value={pcp.practice} onChange={e => setPcp({ ...pcp, practice: e.target.value })} placeholder="e.g., Springfield Family Medicine" data-testid="input-pcp-practice" />
          </div>
          <div className="space-y-2">
            <Label>{t(lang, "pcpPhone")}</Label>
            <Input type="tel" value={pcp.phone} onChange={e => setPcp({ ...pcp, phone: e.target.value })} placeholder="(555) 123-4567" data-testid="input-pcp-phone" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t(lang, "pcpAddress")}</Label>
            <Input value={pcp.address} onChange={e => setPcp({ ...pcp, address: e.target.value })} placeholder="Office address" data-testid="input-pcp-address" />
          </div>
          <div className="space-y-2">
            <Label>{t(lang, "pcpNpi")}</Label>
            <Input value={pcp.npi} onChange={e => setPcp({ ...pcp, npi: e.target.value })} placeholder="10-digit NPI" maxLength={10} data-testid="input-pcp-npi" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PharmacySearch({ pharmacy, setPharmacy, lang }: { pharmacy: PharmacyPreferences; setPharmacy: (p: PharmacyPreferences) => void; lang: string }) {
  const [pharmSearch, setPharmSearch] = useState("");
  const [pharmResults, setPharmResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const searchPharmacies = async () => {
    if (!pharmSearch.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams();
      const isZip = /^\d{5}/.test(pharmSearch.trim());
      if (isZip) {
        params.set("postal_code", pharmSearch.trim().slice(0, 5));
      } else {
        params.set("organization_name", pharmSearch.trim());
      }
      params.set("taxonomy_description", "Pharmacy");
      params.set("enumeration_type", "NPI-2");
      params.set("limit", "10");
      params.set("version", "2.1");
      const resp = await fetch(`https://npiregistry.cms.hhs.gov/api/?${params.toString()}`);
      const data = await resp.json();
      setPharmResults(data.results || []);
    } catch {
      setPharmResults([]);
    }
    setSearching(false);
  };

  const selectPharmacy = (result: any) => {
    const b = result.basic || {};
    const a = result.addresses?.[0] || {};
    setPharmacy({
      ...pharmacy,
      preferredPharmacyName: b.organization_name || "",
      preferredPharmacyPhone: a.telephone_number || "",
      preferredPharmacyAddress: [a.address_1, a.city, a.state, a.postal_code].filter(Boolean).join(", "),
    });
    setPharmResults([]);
    setPharmSearch("");
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        <h4 className="font-medium flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {t(lang, "preferredPharmacy")}</h4>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-3 space-y-2">
            <h4 className="font-medium text-sm flex items-center gap-2"><Search className="w-4 h-4 text-green-600" /> Search Pharmacy by Name or Zip Code</h4>
            <div className="flex gap-2">
              <Input
                value={pharmSearch}
                onChange={e => setPharmSearch(e.target.value)}
                placeholder="Enter pharmacy name or zip code (e.g., CVS or 10001)"
                onKeyDown={e => e.key === "Enter" && searchPharmacies()}
                data-testid="input-pharmacy-search"
                className="flex-1"
              />
              <Button size="sm" onClick={searchPharmacies} disabled={searching} data-testid="button-search-pharmacy">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {pharmResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {pharmResults.map((r: any, i: number) => {
                  const b = r.basic || {};
                  const a = r.addresses?.[0] || {};
                  return (
                    <div key={i} className="p-2 bg-background rounded border hover:border-primary/50 cursor-pointer text-sm" onClick={() => selectPharmacy(r)} data-testid={`pharmacy-result-${i}`}>
                      <div className="font-medium">{b.organization_name}</div>
                      <div className="text-xs text-muted-foreground">{[a.address_1, a.city, a.state, a.postal_code].filter(Boolean).join(", ")} — {a.telephone_number || ""}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t(lang, "pharmacyName")}</Label>
            <Input value={pharmacy.preferredPharmacyName} onChange={e => setPharmacy({ ...pharmacy, preferredPharmacyName: e.target.value })} placeholder="e.g., CVS, Walgreens, Rite Aid" data-testid="input-pharmacy-name" />
          </div>
          <div className="space-y-2">
            <Label>{t(lang, "pharmacyPhone")}</Label>
            <Input type="tel" value={pharmacy.preferredPharmacyPhone} onChange={e => setPharmacy({ ...pharmacy, preferredPharmacyPhone: e.target.value })} placeholder="(555) 123-4567" data-testid="input-pharmacy-phone" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "pharmacyAddress")}</Label>
          <Input value={pharmacy.preferredPharmacyAddress} onChange={e => setPharmacy({ ...pharmacy, preferredPharmacyAddress: e.target.value })} placeholder="Full address of your pharmacy" data-testid="input-pharmacy-address" />
        </div>
      </CardContent>
    </Card>
  );
}

function ConditionsStep({ conditions, setConditions, surgeries, setSurgeries, familyHistory, setFamilyHistory, healthDescription, setHealthDescription, aiSuggestions, aiSuggesting, onAiSuggest, lang }: {
  conditions: ConditionItem[];
  setConditions: (c: ConditionItem[]) => void;
  surgeries: SurgeryItem[];
  setSurgeries: (s: SurgeryItem[]) => void;
  familyHistory: FamilyHistoryItem[];
  setFamilyHistory: (f: FamilyHistoryItem[]) => void;
  healthDescription: string;
  setHealthDescription: (s: string) => void;
  aiSuggestions: any[];
  aiSuggesting: boolean;
  onAiSuggest: () => void;
  lang: string;
}) {
  const addCondition = (name?: string, key?: string) => {
    const icd = key ? (CONDITIONS_ICD10.find(c => c.key === key)?.icd10 || "") : "";
    setConditions([...conditions, { id: uid(), name: name || "", icdCode: icd, status: "active", diagnosedDate: "", treatedBy: "", notes: "" }]);
  };
  const updateCondition = (id: string, field: keyof ConditionItem, value: string) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const removeCondition = (id: string) => setConditions(conditions.filter(c => c.id !== id));

  const addSurgery = (name?: string, key?: string) => {
    const cpt = key ? (SURGERIES_CPT.find(s => s.key === key)?.cpt || "") : "";
    setSurgeries([...surgeries, { id: uid(), procedureName: name || "", cptCode: cpt, date: "", facility: "", outcome: "" }]);
  };
  const updateSurgery = (id: string, field: keyof SurgeryItem, value: string) => {
    setSurgeries(surgeries.map(s => s.id === id ? { ...s, [field]: value } : s));
  };
  const removeSurgery = (id: string) => setSurgeries(surgeries.filter(s => s.id !== id));

  const addFH = (conditionName?: string) => {
    setFamilyHistory([...familyHistory, { id: uid(), condition: conditionName || "", relationship: "", ageAtOnset: "", notes: "" }]);
  };
  const updateFH = (id: string, field: keyof FamilyHistoryItem, value: string) => {
    setFamilyHistory(familyHistory.map(f => f.id === id ? { ...f, [field]: value } : f));
  };
  const removeFH = (id: string) => setFamilyHistory(familyHistory.filter(f => f.id !== id));

  return (
    <div className="space-y-6" data-testid="conditions-step" role="form" aria-label="Medical conditions, surgeries, and family history">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-primary mt-1 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium">{t(lang, "aiHealthAssistant")}</h4>
              <p className="text-sm text-muted-foreground mb-2">{t(lang, "describeHealth")}</p>
              <div className="flex gap-1 items-start">
                <Textarea
                  value={healthDescription}
                  onChange={e => setHealthDescription(e.target.value)}
                  placeholder="E.g., I was diagnosed with high blood pressure about 5 years ago. I also have seasonal allergies and had my gallbladder removed in 2019..."
                  rows={3}
                  data-testid="textarea-health-description"
                  aria-label="Describe your health history in your own words"
                  className="flex-1"
                />
                <VoiceInput onResult={text => setHealthDescription(healthDescription ? `${healthDescription} ${text}` : text)} language={lang} label="Voice input for health description" />
              </div>
              <Button className="mt-2" onClick={onAiSuggest} disabled={aiSuggesting || !healthDescription.trim()} size="sm" data-testid="button-ai-suggest">
                {aiSuggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {t(lang, "getAiSuggestions")}
              </Button>
            </div>
          </div>
          {aiSuggestions.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-xs font-medium text-muted-foreground">{t(lang, "aiSuggestionsDisclaimer")}</p>
              {aiSuggestions.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 bg-background rounded border">
                  <div>
                    <span className="font-medium text-sm">{s.name}</span>
                    {s.reason && <p className="text-xs text-muted-foreground">{s.reason}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => addCondition(s.name)} data-testid={`button-add-suggestion-${i}`}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" /> {t(lang, "currentPastConditions")}
      </h3>

      <div className="flex flex-wrap gap-2">
        <p className="text-sm text-muted-foreground w-full">{t(lang, "quickAddCommon")}</p>
        {COMMON_CONDITIONS_KEYS.map(key => {
          const icdEntry = CONDITIONS_ICD10.find(c => c.key === key);
          return (
            <Badge key={key} variant="outline" className="cursor-pointer hover:bg-primary/10" onClick={() => addCondition(t(lang, key), key)} data-testid={`badge-common-${key}`}>
              <Plus className="w-3 h-3 mr-1" /> {t(lang, key)} {icdEntry && <span className="ml-1 text-[10px] opacity-60">({icdEntry.icd10})</span>}
            </Badge>
          );
        })}
      </div>

      {conditions.map((c, idx) => (
        <Card key={c.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{t(lang, "condition")} {idx + 1}</Badge>
              <Button variant="ghost" size="sm" onClick={() => removeCondition(c.id)} data-testid={`button-remove-condition-${idx}`}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{t(lang, "conditionName")} *</Label>
                <Input value={c.name} onChange={e => updateCondition(c.id, "name", e.target.value)} placeholder="e.g., Type 2 Diabetes" data-testid={`input-condition-name-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>ICD-10 Code</Label>
                <Input value={c.icdCode} onChange={e => updateCondition(c.id, "icdCode", e.target.value)} placeholder="e.g., E11.9" data-testid={`input-condition-icd-${idx}`} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "status")}</Label>
                <Select value={c.status} onValueChange={v => updateCondition(c.id, "status", v)}>
                  <SelectTrigger data-testid={`select-condition-status-${idx}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="managed">Managed</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="in-remission">In Remission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "diagnosisDate")}</Label>
                <Input type="date" value={c.diagnosedDate} onChange={e => updateCondition(c.id, "diagnosedDate", e.target.value)} data-testid={`input-condition-date-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "treatingProvider")}</Label>
                <Input value={c.treatedBy} onChange={e => updateCondition(c.id, "treatedBy", e.target.value)} placeholder="Dr. name" data-testid={`input-condition-provider-${idx}`} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t(lang, "notes")}</Label>
              <Textarea value={c.notes} onChange={e => updateCondition(c.id, "notes", e.target.value)} placeholder="Additional details..." rows={2} data-testid={`textarea-condition-notes-${idx}`} />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => addCondition()} data-testid="button-add-condition">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addCondition")}
      </Button>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Stethoscope className="w-5 h-5 text-primary" /> {t(lang, "surgeriesProcedures")}
      </h3>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t(lang, "quickAddSurgeries")}</p>
        <div className="flex flex-wrap gap-2" data-testid="quick-add-surgeries">
          {COMMON_SURGERIES_KEYS.map(key => {
            const cptEntry = SURGERIES_CPT.find(s => s.key === key);
            return (
              <Badge
                key={key}
                variant="outline"
                className="cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => addSurgery(t(lang, key), key)}
                data-testid={`badge-surgery-${key}`}
              >
                <Plus className="w-3 h-3 mr-1" /> {t(lang, key)} {cptEntry && <span className="ml-1 text-[10px] opacity-60">(CPT {cptEntry.cpt})</span>}
              </Badge>
            );
          })}
        </div>
      </div>

      {surgeries.map((s, idx) => (
        <Card key={s.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Surgery {idx + 1}</Badge>
              <Button variant="ghost" size="sm" onClick={() => removeSurgery(s.id)} data-testid={`button-remove-surgery-${idx}`}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1">
                <Label>{t(lang, "procedureName")} *</Label>
                <Input value={s.procedureName} onChange={e => updateSurgery(s.id, "procedureName", e.target.value)} placeholder="e.g., Appendectomy" data-testid={`input-surgery-name-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>CPT Code</Label>
                <Input value={s.cptCode} onChange={e => updateSurgery(s.id, "cptCode", e.target.value)} placeholder="e.g., 44970" data-testid={`input-surgery-cpt-${idx}`} className="font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "date")}</Label>
                <Input type="date" value={s.date} onChange={e => updateSurgery(s.id, "date", e.target.value)} data-testid={`input-surgery-date-${idx}`} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "facility")}</Label>
                <Input value={s.facility} onChange={e => updateSurgery(s.id, "facility", e.target.value)} placeholder="Hospital name" data-testid={`input-surgery-facility-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "outcome")}</Label>
                <Input value={s.outcome} onChange={e => updateSurgery(s.id, "outcome", e.target.value)} placeholder="e.g., Successful, no complications" data-testid={`input-surgery-outcome-${idx}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => addSurgery()} data-testid="button-add-surgery">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addSurgery")}
      </Button>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" /> {t(lang, "familyMedicalHistory")}
      </h3>
      <p className="text-sm text-muted-foreground italic">{t(lang, "firstDegreeNote")}</p>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t(lang, "quickAddFamilyConditions")}</p>
        <div className="flex flex-wrap gap-2" data-testid="quick-add-family-conditions">
          {FAMILY_HISTORY_CONDITIONS_KEYS.map(key => (
            <Badge
              key={key}
              variant="outline"
              className="cursor-pointer hover:bg-primary/10 transition-colors"
              onClick={() => addFH(t(lang, key))}
              data-testid={`badge-fh-${key}`}
            >
              <Plus className="w-3 h-3 mr-1" /> {t(lang, key)}
            </Badge>
          ))}
        </div>
      </div>

      {familyHistory.map((f, idx) => (
        <Card key={f.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline">{t(lang, "familyMedicalHistory")} {idx + 1}</Badge>
              <Button variant="ghost" size="sm" onClick={() => removeFH(f.id)} data-testid={`button-remove-fh-${idx}`}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "condition")} *</Label>
                <Input value={f.condition} onChange={e => updateFH(f.id, "condition", e.target.value)} placeholder="e.g., Heart Disease" data-testid={`input-fh-condition-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "relationship")} *</Label>
                <Select value={f.relationship} onValueChange={v => updateFH(f.id, "relationship", v)}>
                  <SelectTrigger data-testid={`select-fh-relationship-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="stepmother">Stepmother</SelectItem>
                    <SelectItem value="stepfather">Stepfather</SelectItem>
                    <SelectItem value="sibling">Sibling</SelectItem>
                    <SelectItem value="half-sibling">Half-Sibling</SelectItem>
                    <SelectItem value="sister">Sister</SelectItem>
                    <SelectItem value="brother">Brother</SelectItem>
                    <SelectItem value="maternal-grandmother">Maternal Grandmother</SelectItem>
                    <SelectItem value="maternal-grandfather">Maternal Grandfather</SelectItem>
                    <SelectItem value="paternal-grandmother">Paternal Grandmother</SelectItem>
                    <SelectItem value="paternal-grandfather">Paternal Grandfather</SelectItem>
                    <SelectItem value="maternal-aunt">Maternal Aunt</SelectItem>
                    <SelectItem value="maternal-uncle">Maternal Uncle</SelectItem>
                    <SelectItem value="paternal-aunt">Paternal Aunt</SelectItem>
                    <SelectItem value="paternal-uncle">Paternal Uncle</SelectItem>
                    <SelectItem value="cousin">Cousin</SelectItem>
                    <SelectItem value="child">Child</SelectItem>
                    <SelectItem value="daughter">Daughter</SelectItem>
                    <SelectItem value="son">Son</SelectItem>
                    <SelectItem value="grandchild">Grandchild</SelectItem>
                    <SelectItem value="niece">Niece</SelectItem>
                    <SelectItem value="nephew">Nephew</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "ageAtOnset")}</Label>
                <Input type="number" min="0" max="120" value={f.ageAtOnset} onChange={e => updateFH(f.id, "ageAtOnset", e.target.value)} placeholder="e.g., 55" data-testid={`input-fh-age-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "notes")}</Label>
                <Input value={f.notes} onChange={e => updateFH(f.id, "notes", e.target.value)} placeholder="e.g., Maternal side, on medication" data-testid={`input-fh-notes-${idx}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" onClick={() => addFH()} data-testid="button-add-family-history">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addFamilyHistory")}
      </Button>
    </div>
  );
}

function AllergiesStep({ allergies, setAllergies, lang }: {
  lang: string;
  allergies: AllergyItem[];
  setAllergies: (a: AllergyItem[]) => void;
}) {
  const addAllergy = (name?: string) => {
    setAllergies([...allergies, { id: uid(), allergen: name || "", reaction: "", severity: "moderate", onsetDate: "" }]);
  };
  const updateAllergy = (id: string, field: keyof AllergyItem, value: string) => {
    setAllergies(allergies.map(a => a.id === id ? { ...a, [field]: value } : a));
  };
  const removeAllergy = (id: string) => setAllergies(allergies.filter(a => a.id !== id));

  return (
    <div className="space-y-6" data-testid="allergies-step" role="form" aria-label="Allergies information">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-primary" aria-hidden="true" /> {t(lang, "knownAllergies")}
      </h3>

      {["Drug", "Food", "Environmental", "Other"].map(category => {
        const items = COMMON_ALLERGENS.filter(a => a.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category} className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{category} Allergies</p>
            <div className="flex flex-wrap gap-2">
              {items.map(item => (
                <Badge key={item.name} variant="outline" className="cursor-pointer hover:bg-destructive/10" onClick={() => addAllergy(item.name)} data-testid={`badge-allergen-${item.name.toLowerCase().replace(/[\s/()]+/g, "-")}`}>
                  <Plus className="w-3 h-3 mr-1" /> {item.name}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}

      {allergies.map((a, idx) => (
        <Card key={a.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30">Allergy {idx + 1}</Badge>
              <Button variant="ghost" size="sm" onClick={() => removeAllergy(a.id)} data-testid={`button-remove-allergy-${idx}`}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "allergyName")} *</Label>
                <Input value={a.allergen} onChange={e => updateAllergy(a.id, "allergen", e.target.value)} placeholder="e.g., Penicillin" data-testid={`input-allergen-${idx}`} />
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "reactions")}</Label>
                <Input value={a.reaction} onChange={e => updateAllergy(a.id, "reaction", e.target.value)} placeholder="e.g., Hives, swelling" data-testid={`input-reaction-${idx}`} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>{t(lang, "severity")}</Label>
                <Select value={a.severity} onValueChange={v => updateAllergy(a.id, "severity", v)}>
                  <SelectTrigger data-testid={`select-severity-${idx}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                    <SelectItem value="life-threatening">Life-Threatening</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "onsetDate")}</Label>
                <Input type="date" value={a.onsetDate} onChange={e => updateAllergy(a.id, "onsetDate", e.target.value)} data-testid={`input-allergy-onset-${idx}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => addAllergy()} data-testid="button-add-allergy">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addAllergy")}
      </Button>

      {allergies.length === 0 && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription>No known allergies? You can skip this section. It's important to document NKDA (No Known Drug Allergies) for your records.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MedicationsStep({ medications, setMedications, vaccinations, setVaccinations, lang }: {
  lang: string;
  medications: MedicationItem[];
  setMedications: (m: MedicationItem[]) => void;
  vaccinations: VaccinationItem[];
  setVaccinations: (v: VaccinationItem[]) => void;
}) {
  const [medSearch, setMedSearch] = useState("");

  const addMedication = () => {
    setMedications([...medications, { id: uid(), name: "", dose: "", frequency: "", status: "active", startDate: "", purpose: "" }]);
  };
  const addFromCommon = (med: typeof COMMON_MEDICATIONS[0]) => {
    setMedications([...medications, {
      id: uid(),
      name: med.name,
      dose: med.strengths[0] || "",
      frequency: med.dosing[0] || "",
      status: "active",
      startDate: "",
      purpose: `${med.forCondition} (ICD-10: ${med.icd10})`,
    }]);
    setMedSearch("");
  };
  const updateMed = (id: string, field: keyof MedicationItem, value: string) => {
    setMedications(medications.map(m => m.id === id ? { ...m, [field]: value } : m));
  };
  const removeMed = (id: string) => setMedications(medications.filter(m => m.id !== id));

  const addVaccination = () => {
    setVaccinations([...vaccinations, { id: uid(), name: "", date: "", provider: "" }]);
  };
  const updateVax = (id: string, field: keyof VaccinationItem, value: string) => {
    setVaccinations(vaccinations.map(v => v.id === id ? { ...v, [field]: value } : v));
  };
  const removeVax = (id: string) => setVaccinations(vaccinations.filter(v => v.id !== id));

  const filteredMeds = medSearch.trim()
    ? COMMON_MEDICATIONS.filter(m =>
        m.name.toLowerCase().includes(medSearch.toLowerCase()) ||
        m.genericName.toLowerCase().includes(medSearch.toLowerCase()) ||
        m.forCondition.toLowerCase().includes(medSearch.toLowerCase())
      )
    : [];

  const handleOcrPrescription = useCallback((text: string) => {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const matchedMeds = COMMON_MEDICATIONS.filter(m =>
      lines.some(l => l.toLowerCase().includes(m.name.toLowerCase()) || l.toLowerCase().includes(m.genericName.toLowerCase()))
    );
    matchedMeds.forEach(med => {
      const existing = medications.find(m => m.name.toLowerCase() === med.name.toLowerCase());
      if (!existing) {
        addFromCommon(med);
      }
    });
  }, [medications]);

  return (
    <div className="space-y-6" data-testid="medications-step" role="form" aria-label="Medications and vaccinations">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Pill className="w-5 h-5 text-primary" aria-hidden="true" /> {t(lang, "currentMedications")}
      </h3>

      <OcrScanner
        onTextExtracted={handleOcrPrescription}
        label="Scan Prescription Label"
        compact
      />

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" aria-hidden="true" /> Search Common Medications (65+)
          </h4>
          <div className="flex gap-1">
            <Input
              value={medSearch}
              onChange={e => setMedSearch(e.target.value)}
              placeholder="Type medication name, generic name, or condition..."
              className="flex-1"
              data-testid="input-med-search"
              aria-label="Search medications"
            />
            <VoiceInput onResult={text => setMedSearch(text)} language={lang} label="Voice search for medications" />
          </div>
          {filteredMeds.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredMeds.slice(0, 10).map(med => (
                <div key={med.name} className="flex items-center justify-between p-2 bg-background rounded border hover:border-primary/50 cursor-pointer" onClick={() => addFromCommon(med)}>
                  <div>
                    <span className="font-medium text-sm">{med.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">for {med.forCondition}</span>
                    <div className="text-xs text-muted-foreground">
                      Strengths: {med.strengths.join(", ")} | {med.dosing.join(", ")}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" data-testid={`button-add-common-med-${med.genericName.toLowerCase().replace(/\s+/g, "-")}`}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                  </Button>
                </div>
              ))}
            </div>
          )}
          {medSearch.trim() && filteredMeds.length === 0 && (
            <p className="text-xs text-muted-foreground">No matching medications. You can add it manually below.</p>
          )}
        </CardContent>
      </Card>

      {medications.map((m, idx) => {
        const matchedMed = COMMON_MEDICATIONS.find(cm => cm.name === m.name);
        return (
          <Card key={m.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Medication {idx + 1}</Badge>
                <Button variant="ghost" size="sm" onClick={() => removeMed(m.id)} data-testid={`button-remove-med-${idx}`}><X className="w-4 h-4" /></Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t(lang, "medicationName")} *</Label>
                  <Input value={m.name} onChange={e => updateMed(m.id, "name", e.target.value)} placeholder="e.g., Metformin" data-testid={`input-med-name-${idx}`} />
                </div>
                <div className="space-y-1">
                  <Label>{t(lang, "dosage")}</Label>
                  {matchedMed ? (
                    <Select value={m.dose} onValueChange={v => updateMed(m.id, "dose", v)}>
                      <SelectTrigger data-testid={`select-med-dose-${idx}`}><SelectValue placeholder="Select strength" /></SelectTrigger>
                      <SelectContent>
                        {matchedMed.strengths.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={m.dose} onChange={e => updateMed(m.id, "dose", e.target.value)} placeholder="e.g., 500mg" data-testid={`input-med-dose-${idx}`} />
                  )}
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>{t(lang, "frequency")}</Label>
                  {matchedMed ? (
                    <Select value={m.frequency} onValueChange={v => updateMed(m.id, "frequency", v)}>
                      <SelectTrigger data-testid={`select-med-frequency-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {matchedMed.dosing.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={m.frequency} onValueChange={v => updateMed(m.id, "frequency", v)}>
                      <SelectTrigger data-testid={`select-med-frequency-${idx}`}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once-daily">Once Daily</SelectItem>
                        <SelectItem value="twice-daily">Twice Daily</SelectItem>
                        <SelectItem value="three-times-daily">Three Times Daily</SelectItem>
                        <SelectItem value="four-times-daily">Four Times Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="as-needed">As Needed (PRN)</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>{t(lang, "status")}</Label>
                  <Select value={m.status} onValueChange={v => updateMed(m.id, "status", v)}>
                    <SelectTrigger data-testid={`select-med-status-${idx}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>{t(lang, "startDate")}</Label>
                  <Input type="date" value={m.startDate} onChange={e => updateMed(m.id, "startDate", e.target.value)} data-testid={`input-med-start-${idx}`} />
                </div>
              </div>
              <div className="space-y-1">
                <Label>{t(lang, "purpose")}</Label>
                <Input value={m.purpose} onChange={e => updateMed(m.id, "purpose", e.target.value)} placeholder="e.g., Blood sugar management" data-testid={`input-med-purpose-${idx}`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
      <Button variant="outline" onClick={addMedication} data-testid="button-add-medication">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addMedication")}
      </Button>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-primary" /> {t(lang, "vaccinations")}
      </h3>

      {vaccinations.map((v, idx) => (
        <div key={v.id} className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[150px] space-y-1">
            <Label>{t(lang, "vaccineName")}</Label>
            <Input value={v.name} onChange={e => updateVax(v.id, "name", e.target.value)} placeholder="e.g., COVID-19 Pfizer" data-testid={`input-vax-name-${idx}`} />
          </div>
          <div className="w-40 space-y-1">
            <Label>{t(lang, "date")}</Label>
            <Input type="date" value={v.date} onChange={e => updateVax(v.id, "date", e.target.value)} data-testid={`input-vax-date-${idx}`} />
          </div>
          <div className="flex-1 min-w-[120px] space-y-1">
            <Label>{t(lang, "treatingProvider")}</Label>
            <Input value={v.provider} onChange={e => updateVax(v.id, "provider", e.target.value)} placeholder="Where administered" data-testid={`input-vax-provider-${idx}`} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => removeVax(v.id)} data-testid={`button-remove-vax-${idx}`}><X className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button variant="outline" onClick={addVaccination} data-testid="button-add-vaccination">
        <Plus className="w-4 h-4 mr-2" /> {t(lang, "addVaccination")}
      </Button>
    </div>
  );
}

function LifestyleStep({ lifestyle, setLifestyle, lang }: {
  lang: string;
  lifestyle: LifestyleData;
  setLifestyle: (l: LifestyleData) => void;
}) {
  const update = (field: keyof LifestyleData, value: string) => setLifestyle({ ...lifestyle, [field]: value });

  return (
    <div className="space-y-6" data-testid="lifestyle-step" role="form" aria-label="Lifestyle and social history">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Cigarette className="w-5 h-5 text-primary" /> {t(lang, "tobaccoUse")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "smokingStatus")}</Label>
          <Select value={lifestyle.smokingStatus} onValueChange={v => update("smokingStatus", v)}>
            <SelectTrigger data-testid="select-smoking"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never Smoker</SelectItem>
              <SelectItem value="former">Former Smoker</SelectItem>
              <SelectItem value="current-daily">Current Daily Smoker</SelectItem>
              <SelectItem value="current-occasional">Current Occasional Smoker</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "details")}</Label>
          <Input value={lifestyle.smokingDetail} onChange={e => update("smokingDetail", e.target.value)} placeholder="e.g., Quit 2020, 10 pack-year history" data-testid="input-smoking-detail" />
        </div>
      </div>
      {lifestyle.smokingStatus && SOCIAL_HISTORY_ICD[lifestyle.smokingStatus] && (
        <p className="text-xs text-muted-foreground font-mono">ICD-10: {SOCIAL_HISTORY_ICD[lifestyle.smokingStatus].icd10} — {SOCIAL_HISTORY_ICD[lifestyle.smokingStatus].label}</p>
      )}

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Wine className="w-5 h-5 text-primary" /> {t(lang, "alcoholUse")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "alcoholUse")}</Label>
          <Select value={lifestyle.alcoholUse} onValueChange={v => update("alcoholUse", v)}>
            <SelectTrigger data-testid="select-alcohol"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="occasional">Occasional (social)</SelectItem>
              <SelectItem value="moderate">Moderate (1-2 drinks/day)</SelectItem>
              <SelectItem value="heavy">Heavy (3+ drinks/day)</SelectItem>
              <SelectItem value="former">Former Drinker</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "details")}</Label>
          <Input value={lifestyle.alcoholDetail} onChange={e => update("alcoholDetail", e.target.value)} placeholder="e.g., 2-3 glasses of wine per week" data-testid="input-alcohol-detail" />
        </div>
      </div>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Dumbbell className="w-5 h-5 text-primary" /> {t(lang, "physicalActivity")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "exerciseFrequency")}</Label>
          <Select value={lifestyle.exerciseFrequency} onValueChange={v => update("exerciseFrequency", v)}>
            <SelectTrigger data-testid="select-exercise"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sedentary">Sedentary (little/no exercise)</SelectItem>
              <SelectItem value="light">Light (1-2 days/week)</SelectItem>
              <SelectItem value="moderate">Moderate (3-4 days/week)</SelectItem>
              <SelectItem value="active">Active (5+ days/week)</SelectItem>
              <SelectItem value="very-active">Very Active (daily intense)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "exerciseType")}</Label>
          <Input value={lifestyle.exerciseType} onChange={e => update("exerciseType", e.target.value)} placeholder="e.g., Walking, swimming, yoga" data-testid="input-exercise-type" />
        </div>
      </div>

      {lifestyle.exerciseFrequency === "sedentary" && SOCIAL_HISTORY_ICD["sedentary"] && (
        <p className="text-xs text-muted-foreground font-mono">ICD-10: {SOCIAL_HISTORY_ICD["sedentary"].icd10} — {SOCIAL_HISTORY_ICD["sedentary"].label}</p>
      )}

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Moon className="w-5 h-5 text-primary" /> {t(lang, "socialHistory")}
      </h3>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>{t(lang, "sleepHours")}</Label>
          <Select value={lifestyle.sleepHours} onValueChange={v => update("sleepHours", v)}>
            <SelectTrigger data-testid="select-sleep"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="less-than-5">Less than 5 hours</SelectItem>
              <SelectItem value="5-6">5-6 hours</SelectItem>
              <SelectItem value="7-8">7-8 hours</SelectItem>
              <SelectItem value="more-than-8">More than 8 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "diet")}</Label>
          <Select value={lifestyle.dietType} onValueChange={v => update("dietType", v)}>
            <SelectTrigger data-testid="select-diet"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular / No restrictions</SelectItem>
              <SelectItem value="vegetarian">Vegetarian</SelectItem>
              <SelectItem value="vegan">Vegan</SelectItem>
              <SelectItem value="keto">Keto / Low Carb</SelectItem>
              <SelectItem value="mediterranean">Mediterranean</SelectItem>
              <SelectItem value="gluten-free">Gluten Free</SelectItem>
              <SelectItem value="halal">Halal</SelectItem>
              <SelectItem value="kosher">Kosher</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "stressLevel")}</Label>
          <Select value={lifestyle.stressLevel} onValueChange={v => update("stressLevel", v)}>
            <SelectTrigger data-testid="select-stress"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="severe">Severe / Chronic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Scale className="w-5 h-5 text-primary" /> {t(lang, "additionalInfo")}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t(lang, "occupation")}</Label>
          <Input value={lifestyle.occupation} onChange={e => update("occupation", e.target.value)} placeholder="Current occupation" data-testid="input-occupation" />
        </div>
        <div className="space-y-2">
          <Label>{t(lang, "livingSituation")}</Label>
          <Select value={lifestyle.livingSituation} onValueChange={v => update("livingSituation", v)}>
            <SelectTrigger data-testid="select-living"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alone">Lives Alone</SelectItem>
              <SelectItem value="with-spouse">With Spouse/Partner</SelectItem>
              <SelectItem value="with-family">With Family</SelectItem>
              <SelectItem value="with-roommates">With Roommates</SelectItem>
              <SelectItem value="assisted-living">Assisted Living</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t(lang, "substanceUse")}</Label>
        <Input value={lifestyle.substanceUse} onChange={e => update("substanceUse", e.target.value)} placeholder="Any other substances (optional, confidential)" data-testid="input-substance" />
      </div>
    </div>
  );
}

function ReviewStep({ allData, consents, setConsents, aiReview, aiReviewing, onAiReview, lang }: {
  lang: string;
  allData: any;
  consents: any;
  setConsents: (c: any) => void;
  aiReview: any;
  aiReviewing: boolean;
  onAiReview: () => void;
}) {
  const { demographics: d, emergencyContacts: ec, conditions: conds, allergies: alrg, medications: meds, vaccinations: vax, surgeries: surg, familyHistory: fh, lifestyle: ls, insurance: ins, pharmacy: pharm, pcp: pcpData } = allData;

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    value ? <div className="flex justify-between py-1 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right max-w-[60%]">{value}</span></div> : null
  );

  return (
    <div className="space-y-6" data-testid="review-step" role="form" aria-label="Review and confirm your health profile">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-lg">{t(lang, "reviewProfile")}</h3>
        <Button onClick={onAiReview} disabled={aiReviewing} variant="outline" size="sm" data-testid="button-ai-review">
          {aiReviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {t(lang, "aiCompletenessCheck")}
        </Button>
      </div>

      {aiReview && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> AI Review</h4>
              <Badge>{aiReview.completenessScore}% Complete</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{aiReview.summary}</p>
            {aiReview.missingFields?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Missing fields:</p>
                <div className="flex flex-wrap gap-1">
                  {aiReview.missingFields.map((f: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>
            )}
            {aiReview.suggestedActions?.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">Suggested next steps:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {aiReview.suggestedActions.map((a: string, i: number) => (
                    <li key={i} className="flex items-start gap-2"><ArrowRight className="w-3 h-3 mt-1 shrink-0" />{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4" /> {t(lang, "demographics")}</CardTitle></CardHeader>
        <CardContent className="pt-0 space-y-0 divide-y divide-muted">
          <SummaryRow label={t(lang, "fullName")} value={[d.firstName, d.middleName !== "NMN" && d.middleName !== "UNK" ? d.middleName : "", d.lastName, d.suffix !== "none" ? d.suffix : ""].filter(Boolean).join(" ")} />
          <SummaryRow label={t(lang, "dateOfBirth")} value={d.dateOfBirth} />
          <SummaryRow label={t(lang, "genderIdentity")} value={d.gender} />
          <SummaryRow label={t(lang, "sexAtBirth")} value={d.sexAtBirth} />
          <SummaryRow label={t(lang, "race")} value={d.race?.join(", ")} />
          <SummaryRow label={t(lang, "ethnicity")} value={d.ethnicity} />
          <SummaryRow label={t(lang, "email")} value={d.email} />
          <SummaryRow label={t(lang, "phone")} value={d.phone} />
          <SummaryRow label={t(lang, "mailingAddress")} value={[d.address, d.city, d.state, d.zipCode].filter(Boolean).join(", ")} />
        </CardContent>
      </Card>

      {ec.length > 0 && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Phone className="w-4 h-4" /> {t(lang, "emergencyContacts")} ({ec.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {ec.map((c: any, i: number) => (
              <div key={i} className="py-2 border-b border-muted last:border-0">
                <span className="font-medium text-sm">{c.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({c.relationship}) {c.phone}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {ins.provider && (
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> {t(lang, "insuranceInfo")}</CardTitle></CardHeader>
          <CardContent className="pt-0 space-y-0 divide-y divide-muted">
            <SummaryRow label={t(lang, "insuranceProvider")} value={ins.provider} />
            <SummaryRow label={t(lang, "policyNumber")} value={ins.policyNumber} />
            <SummaryRow label={t(lang, "groupNumber")} value={ins.groupNumber} />
            <SummaryRow label={t(lang, "planType")} value={ins.planType} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(pharm?.preferredPharmacyName || pharm?.mailOrderProvider) && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4" /> {t(lang, "pharmacyPreferences")}</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-0 divide-y divide-muted">
              <SummaryRow label={t(lang, "preferredPharmacy")} value={pharm.preferredPharmacyName} />
              {pharm.preferredPharmacyAddress && <SummaryRow label={t(lang, "pharmacyAddress")} value={pharm.preferredPharmacyAddress} />}
              {pharm.useMailOrder && <SummaryRow label={t(lang, "mailOrderPharmacy")} value={pharm.mailOrderProvider} />}
              {pharm.savingsServices?.length > 0 && (
                <SummaryRow label={t(lang, "savingsAlternatives")} value={pharm.savingsServices.map((s: string) => SAVINGS_PHARMACY_OPTIONS.find(o => o.key === s)?.label || s).join(", ")} />
              )}
            </CardContent>
          </Card>
        )}
        {pcpData?.name && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4" /> {t(lang, "primaryCareProvider")}</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-0 divide-y divide-muted">
              <SummaryRow label={t(lang, "pcpName")} value={pcpData.name} />
              {pcpData.practice && <SummaryRow label={t(lang, "pcpPractice")} value={pcpData.practice} />}
              {pcpData.specialty && <SummaryRow label={t(lang, "pcpSpecialty")} value={pcpData.specialty} />}
              {pcpData.phone && <SummaryRow label={t(lang, "pcpPhone")} value={pcpData.phone} />}
              {pcpData.npi && <SummaryRow label={t(lang, "pcpNpi")} value={pcpData.npi} />}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Heart className="w-4 h-4" /> {t(lang, "conditionsSurgeries")} ({conds.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {conds.length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> : conds.map((c: any, i: number) => (
              <div key={i} className="py-1 text-sm flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{c.status}</Badge> {c.name}
                {c.icdCode && <span className="text-[10px] font-mono text-muted-foreground">(ICD-10: {c.icdCode})</span>}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {t(lang, "allergies")} ({alrg.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {alrg.length === 0 ? <p className="text-sm text-muted-foreground">NKDA</p> : alrg.map((a: any, i: number) => (
              <div key={i} className="py-1 text-sm flex items-center gap-2">
                <Badge variant={a.severity === "severe" || a.severity === "life-threatening" ? "destructive" : "outline"} className="text-xs">{a.severity}</Badge> {a.allergen}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Pill className="w-4 h-4" /> {t(lang, "medications")} ({meds.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {meds.length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> : meds.map((m: any, i: number) => (
              <div key={i} className="py-1 text-sm">{m.name} {m.dose && `- ${m.dose}`}</div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4" /> {t(lang, "surgeriesProcedures")} ({surg.length})</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {surg.length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> : surg.map((s: any, i: number) => (
              <div key={i} className="py-1 text-sm">
                {s.procedureName} {s.date && `(${s.date})`}
                {s.cptCode && <span className="text-[10px] font-mono text-muted-foreground ml-1">(CPT: {s.cptCode})</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="py-3"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> {t(lang, "familyMedicalHistory")} ({fh.length})</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {fh.length === 0 ? <p className="text-sm text-muted-foreground">None recorded</p> : fh.map((f: any, i: number) => (
            <div key={i} className="py-1 text-sm">{f.condition} — {f.relationship} {f.ageAtOnset && `(onset ~${f.ageAtOnset})`}</div>
          ))}
        </CardContent>
      </Card>

      <Separator />
      <h3 className="font-semibold text-lg" id="consent-heading">Consent & Agreements</h3>
      <fieldset className="space-y-4" aria-labelledby="consent-heading">
        {[
          { key: "termsAccepted", label: "I accept the Terms of Service *", required: true },
          { key: "privacyAccepted", label: "I accept the Privacy Policy *", required: true },
          { key: "hipaaAcknowledged", label: "I acknowledge the HIPAA Notice of Privacy Practices", required: false },
          { key: "dataProcessing", label: "I consent to data processing for health record management", required: false },
          { key: "aiDisclosure", label: "I understand AI features are informational only and not medical advice", required: false },
        ].map(item => (
          <div key={item.key} className="flex items-start gap-3">
            <Checkbox
              id={`consent-${item.key}`}
              checked={(consents as any)[item.key]}
              onCheckedChange={v => setConsents({ ...consents, [item.key]: v })}
              data-testid={`checkbox-${item.key}`}
              aria-required={item.required}
              aria-label={item.label}
            />
            <Label htmlFor={`consent-${item.key}`} className="text-sm leading-relaxed cursor-pointer">{item.label}</Label>
          </div>
        ))}
      </fieldset>
    </div>
  );
}

function CompletionScreen({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center" data-testid="completion-screen" role="main" aria-label="Onboarding complete">
      <Card className="max-w-lg w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto" aria-hidden="true">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <div className="space-y-2" role="status" aria-live="polite">
            <h2 className="text-2xl font-semibold">You're All Set!</h2>
            <p className="text-muted-foreground">
              Your health profile has been created. You can update any information at any time from your profile settings.
            </p>
          </div>
          <div className="grid gap-3">
            <Button onClick={onGoToDashboard} className="w-full" data-testid="button-go-dashboard">
              <Home className="w-4 h-4 mr-2" /> Go to Dashboard
            </Button>
            <a href="/fasten-connect">
              <Button variant="outline" className="w-full" data-testid="button-connect-records">
                <Link2 className="w-4 h-4 mr-2" /> Connect More Health Records
              </Button>
            </a>
            <a href="/my-health-record">
              <Button variant="outline" className="w-full" data-testid="button-view-record">
                <FileText className="w-4 h-4 mr-2" /> View My Health Record
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
