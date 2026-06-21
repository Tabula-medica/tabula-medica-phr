import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  User,
  Phone,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Clipboard,
  Heart,
  Scale,
  Ruler,
  Calendar,
  Globe,
  Users,
  Activity,
  Brain,
  Pill,
  Stethoscope,
  AlertTriangle,
  UserPlus,
  Plus,
  X,
  Baby,
  Building2,
  Syringe,
  Scissors,
  ClipboardCheck,
  SkipForward,
} from "lucide-react";

const QUESTIONNAIRE_SECTIONS = [
  { id: "profile", title: "Profile Basics", icon: User, description: "Your basic information" },
  { id: "medical-history", title: "Conditions", icon: Stethoscope, description: "Quick picks for conditions" },
  { id: "allergies", title: "Allergies", icon: AlertTriangle, description: "Allergies and reactions" },
  { id: "surgeries", title: "Surgeries", icon: Scissors, description: "Past surgical procedures" },
  { id: "family-history", title: "Family History", icon: Users, description: "Family medical history" },
  { id: "social-history", title: "Social History", icon: Activity, description: "Lifestyle and habits" },
  { id: "medications", title: "Medications", icon: Pill, description: "Optional medications list" },
  { id: "emergency", title: "Emergency Contact", icon: Phone, description: "Optional emergency contact" },
  { id: "review", title: "Review", icon: ClipboardCheck, description: "Review and submit" },
];

const MEDICATION_CATEGORIES = [
  { value: "prescription", label: "Prescription medication" },
  { value: "otc", label: "Over-the-counter (OTC)" },
  { value: "supplement", label: "Supplement / Vitamin" },
];

const MEDICATION_FREQUENCY_OPTIONS = [
  { value: "once-daily", label: "Once daily" },
  { value: "twice-daily", label: "Twice daily" },
  { value: "three-times-daily", label: "Three times daily" },
  { value: "four-times-daily", label: "Four times daily" },
  { value: "as-needed", label: "As needed" },
  { value: "weekly", label: "Weekly" },
  { value: "other", label: "Other" },
];

const ALLERGY_TYPES = [
  { value: "medication", label: "Medication allergy" },
  { value: "food", label: "Food allergy" },
  { value: "environmental", label: "Environmental allergy" },
  { value: "latex", label: "Latex allergy" },
  { value: "contrast-dye", label: "Contrast dye reaction (CT/MRI)" },
];

const REACTION_TYPES = [
  { value: "rash", label: "Rash" },
  { value: "hives", label: "Hives" },
  { value: "swelling", label: "Swelling" },
  { value: "trouble-breathing", label: "Trouble breathing" },
  { value: "nausea", label: "Nausea" },
  { value: "anaphylaxis", label: "Anaphylaxis" },
  { value: "other", label: "Other" },
];

const SEVERITY_OPTIONS = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "unknown", label: "Unknown" },
];

const RELATIVE_OPTIONS = [
  { value: "mother", label: "Mother" },
  { value: "father", label: "Father" },
  { value: "sibling", label: "Sibling" },
  { value: "child", label: "Child" },
  { value: "grandparent", label: "Grandparent" },
];

const FAMILY_CONDITIONS = [
  { id: "heart-disease", label: "Heart disease / heart attack (before age 55/65)" },
  { id: "stroke", label: "Stroke" },
  { id: "high-blood-pressure", label: "High blood pressure" },
  { id: "high-cholesterol", label: "High cholesterol" },
  { id: "diabetes", label: "Diabetes" },
  { id: "colon-cancer", label: "Colon cancer" },
  { id: "breast-cancer", label: "Breast cancer" },
  { id: "ovarian-cancer", label: "Ovarian cancer" },
  { id: "prostate-cancer", label: "Prostate cancer" },
  { id: "melanoma", label: "Melanoma" },
  { id: "blood-clots", label: "Blood clots (DVT/PE)" },
  { id: "dementia", label: "Dementia/Alzheimer's" },
  { id: "kidney-disease", label: "Kidney disease" },
  { id: "autoimmune-disease", label: "Autoimmune disease" },
  { id: "mental-illness", label: "Mental illness" },
  { id: "substance-use", label: "Substance use disorder" },
];

const CONDITION_STATUS_OPTIONS = [
  { value: "controlled", label: "Controlled" },
  { value: "uncontrolled", label: "Uncontrolled" },
  { value: "resolved", label: "Resolved" },
  { value: "unsure", label: "Unsure" },
];

const NICOTINE_STATUS_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "former", label: "Former" },
  { value: "current", label: "Current" },
];

const NICOTINE_TYPES = [
  { value: "cigarettes", label: "Cigarettes" },
  { value: "cigars", label: "Cigars" },
  { value: "chewing-tobacco", label: "Chewing tobacco" },
  { value: "nicotine-pouches", label: "Nicotine pouches" },
  { value: "nicotine-gum-patch", label: "Nicotine gum/patch" },
  { value: "hookah", label: "Hookah" },
];

const VAPING_STATUS_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "former", label: "Former" },
  { value: "current", label: "Current" },
];

const VAPING_SUBSTANCE_OPTIONS = [
  { value: "nicotine", label: "Nicotine" },
  { value: "thc", label: "THC" },
  { value: "both", label: "Both" },
  { value: "unsure", label: "Unsure" },
];

const VAPING_FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "occasional", label: "Occasional" },
];

const ALCOHOL_FREQUENCY_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "rare", label: "Rare (1 or less per month)" },
  { value: "social", label: "Social (1-4 per month)" },
  { value: "weekly", label: "Weekly" },
  { value: "daily", label: "Daily" },
];

const DRUG_STATUS_OPTIONS = [
  { value: "never", label: "Never" },
  { value: "past", label: "Past only" },
  { value: "current", label: "Current" },
];

const DRUG_TYPES = [
  { value: "marijuana", label: "Marijuana" },
  { value: "cocaine", label: "Cocaine" },
  { value: "methamphetamine", label: "Methamphetamine" },
  { value: "opioids", label: "Opioids (non-prescribed)" },
  { value: "benzodiazepines", label: "Benzodiazepines (non-prescribed)" },
  { value: "hallucinogens", label: "Hallucinogens" },
  { value: "other", label: "Other" },
];

interface ConditionCategory {
  id: string;
  name: string;
  icon: typeof Heart;
  conditions: { id: string; label: string }[];
}

const CONDITION_CATEGORIES: ConditionCategory[] = [
  {
    id: "cardiovascular",
    name: "Cardiovascular",
    icon: Heart,
    conditions: [
      { id: "hypertension", label: "High blood pressure (hypertension)" },
      { id: "high-cholesterol", label: "High cholesterol" },
      { id: "coronary-artery-disease", label: "Coronary artery disease / heart attack" },
      { id: "heart-failure", label: "Heart failure" },
      { id: "afib", label: "Atrial fibrillation / arrhythmia" },
      { id: "stroke-tia", label: "Stroke / TIA" },
      { id: "blood-clots", label: "Blood clots (DVT/PE)" },
      { id: "peripheral-artery-disease", label: "Peripheral artery disease" },
      { id: "aneurysm", label: "Aneurysm" },
    ],
  },
  {
    id: "endocrine",
    name: "Endocrine / Metabolic",
    icon: Activity,
    conditions: [
      { id: "diabetes", label: "Diabetes (Type 1 / Type 2 / gestational)" },
      { id: "prediabetes", label: "Prediabetes" },
      { id: "thyroid-disease", label: "Thyroid disease (hypothyroid/hyperthyroid)" },
      { id: "obesity", label: "Obesity" },
      { id: "gout", label: "Gout" },
    ],
  },
  {
    id: "pulmonary",
    name: "Pulmonary",
    icon: Activity,
    conditions: [
      { id: "asthma", label: "Asthma" },
      { id: "copd", label: "COPD / emphysema" },
      { id: "sleep-apnea", label: "Sleep apnea" },
      { id: "pulmonary-embolism", label: "Pulmonary embolism history" },
      { id: "chronic-lung-disease", label: "Chronic lung disease" },
    ],
  },
  {
    id: "kidney-urology",
    name: "Kidney / Urology",
    icon: Activity,
    conditions: [
      { id: "chronic-kidney-disease", label: "Chronic kidney disease" },
      { id: "kidney-stones", label: "Kidney stones" },
      { id: "recurrent-utis", label: "Recurrent UTIs" },
      { id: "enlarged-prostate", label: "Enlarged prostate (BPH)" },
    ],
  },
  {
    id: "gi-liver",
    name: "GI / Liver",
    icon: Activity,
    conditions: [
      { id: "gerd", label: "GERD / reflux" },
      { id: "ulcers", label: "Ulcers" },
      { id: "ibs", label: "IBS" },
      { id: "ibd", label: "IBD (Crohn's/ulcerative colitis)" },
      { id: "hepatitis", label: "Hepatitis B/C" },
      { id: "fatty-liver", label: "Fatty liver disease" },
      { id: "cirrhosis", label: "Cirrhosis" },
      { id: "gallstones", label: "Gallstones" },
    ],
  },
  {
    id: "neurologic",
    name: "Neurologic",
    icon: Brain,
    conditions: [
      { id: "seizures", label: "Seizures / epilepsy" },
      { id: "migraines", label: "Migraines" },
      { id: "multiple-sclerosis", label: "Multiple sclerosis" },
      { id: "parkinsons", label: "Parkinson's" },
      { id: "dementia", label: "Dementia / memory disorder" },
      { id: "neuropathy", label: "Neuropathy" },
    ],
  },
  {
    id: "cancer",
    name: "Cancer",
    icon: Activity,
    conditions: [
      { id: "cancer-history", label: "History of cancer (type + year)" },
      { id: "current-cancer-treatment", label: "Current cancer treatment" },
    ],
  },
  {
    id: "hematology-immune",
    name: "Hematology / Immune",
    icon: Activity,
    conditions: [
      { id: "anemia", label: "Anemia" },
      { id: "bleeding-disorder", label: "Bleeding disorder" },
      { id: "sickle-cell", label: "Sickle cell disease/trait" },
      { id: "hiv", label: "HIV" },
      { id: "autoimmune-disease", label: "Autoimmune disease (lupus, RA, psoriasis/psoriatic arthritis, etc.)" },
      { id: "transplant-history", label: "Transplant history" },
    ],
  },
  {
    id: "mental-health",
    name: "Mental Health",
    icon: Brain,
    conditions: [
      { id: "depression", label: "Depression" },
      { id: "anxiety", label: "Anxiety" },
      { id: "bipolar-disorder", label: "Bipolar disorder" },
      { id: "ptsd", label: "PTSD" },
      { id: "adhd", label: "ADHD" },
      { id: "substance-use-disorder", label: "Substance use disorder history" },
    ],
  },
  {
    id: "musculoskeletal",
    name: "Musculoskeletal",
    icon: Activity,
    conditions: [
      { id: "osteoarthritis", label: "Osteoarthritis" },
      { id: "rheumatoid-arthritis", label: "Rheumatoid arthritis" },
      { id: "chronic-back-pain", label: "Chronic back pain" },
      { id: "osteoporosis", label: "Osteoporosis" },
    ],
  },
  {
    id: "infectious-disease",
    name: "Infectious Disease",
    icon: Activity,
    conditions: [
      { id: "tuberculosis", label: "Tuberculosis exposure or treatment" },
      { id: "recurrent-infections", label: "Recurrent serious infections" },
    ],
  },
  {
    id: "other",
    name: "Other",
    icon: Pill,
    conditions: [
      { id: "chronic-pain", label: "Chronic pain syndrome" },
      { id: "other-diagnosis", label: "Any other diagnosis" },
    ],
  },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "zh", label: "Chinese (Mandarin)" },
  { value: "vi", label: "Vietnamese" },
  { value: "ko", label: "Korean" },
  { value: "tl", label: "Tagalog" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ru", label: "Russian" },
  { value: "ja", label: "Japanese" },
  { value: "hi", label: "Hindi" },
  { value: "other", label: "Other" },
];

const SEX_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "intersex", label: "Intersex" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const GENDER_OPTIONS = [
  { value: "man", label: "Man" },
  { value: "woman", label: "Woman" },
  { value: "non-binary", label: "Non-binary" },
  { value: "transgender-man", label: "Transgender man" },
  { value: "transgender-woman", label: "Transgender woman" },
  { value: "genderqueer", label: "Genderqueer" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const RELATIONSHIP_OPTIONS = [
  { value: "spouse", label: "Spouse" },
  { value: "partner", label: "Partner" },
  { value: "parent", label: "Parent" },
  { value: "child", label: "Child" },
  { value: "sibling", label: "Sibling" },
  { value: "friend", label: "Friend" },
  { value: "other", label: "Other" },
];

const PREGNANCY_STATUS_OPTIONS = [
  { value: "not-pregnant", label: "Not pregnant" },
  { value: "pregnant", label: "Currently pregnant" },
  { value: "trying", label: "Trying to conceive" },
  { value: "postpartum", label: "Postpartum (within 6 months)" },
  { value: "unsure", label: "Unsure" },
  { value: "not-applicable", label: "Not applicable" },
];

const IMMUNIZATION_OPTIONS = [
  { value: "flu-current", label: "Flu shot (current season)" },
  { value: "covid-primary", label: "COVID-19 primary series" },
  { value: "covid-booster", label: "COVID-19 booster (within past year)" },
  { value: "tetanus", label: "Tetanus/Tdap (within past 10 years)" },
  { value: "shingles", label: "Shingles vaccine" },
  { value: "pneumonia", label: "Pneumonia vaccine" },
];

const COMMON_SURGERIES = [
  { value: "appendectomy", label: "Appendectomy" },
  { value: "gallbladder", label: "Gallbladder removal" },
  { value: "hernia", label: "Hernia repair" },
  { value: "c-section", label: "C-section" },
  { value: "hysterectomy", label: "Hysterectomy" },
  { value: "knee-replacement", label: "Knee replacement" },
  { value: "hip-replacement", label: "Hip replacement" },
  { value: "heart-bypass", label: "Heart bypass (CABG)" },
  { value: "tonsillectomy", label: "Tonsillectomy" },
  { value: "back-surgery", label: "Back/spine surgery" },
  { value: "cataract", label: "Cataract surgery" },
  { value: "other", label: "Other surgery" },
];

interface ProfileData {
  fullName: string;
  dateOfBirth: string;
  sexAtBirth: string;
  genderIdentity: string;
  preferredLanguage: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  pregnancyStatus: string;
  primaryCareDoctor: string;
  preferredPharmacy: string;
  immunizations: string[];
}

interface EmergencyContactData {
  name: string;
  relationship: string;
  phone: string;
}

interface ConditionDetail {
  yearDiagnosed: string;
  status: string;
  treatment: string;
}

interface MedicalHistoryData {
  selectedConditions: string[];
  conditionDetails: Record<string, ConditionDetail>;
  otherDiagnosisText: string;
}

interface AllergyEntry {
  id: string;
  type: string;
  allergen: string;
  reactionType: string;
  severity: string;
  yearOfReaction: string;
  notSure: boolean;
}

interface AllergiesData {
  noKnownAllergies: boolean;
  allergies: AllergyEntry[];
}

interface FamilyHistoryEntry {
  id: string;
  conditionId: string;
  relative: string;
  ageAtDiagnosis: string;
}

interface FamilyHistoryData {
  entries: FamilyHistoryEntry[];
}

interface TobaccoData {
  status: string;
  types: string[];
  yearsUsed: string;
  amountPerDay: string;
  quitYear: string;
}

interface VapingData {
  status: string;
  substance: string;
  frequency: string;
}

interface AlcoholData {
  frequency: string;
  drinksPerWeek: string;
  pastHeavyUse: boolean;
}

interface DrugData {
  status: string;
  types: string[];
  frequencyAndLastUse: string;
}

interface SocialHistoryData {
  tobacco: TobaccoData;
  vaping: VapingData;
  alcohol: AlcoholData;
  drugs: DrugData;
}

interface MedicationEntry {
  id: string;
  category: string;
  name: string;
  dose: string;
  frequency: string;
  notSure: boolean;
}

interface MedicationsData {
  noCurrentMedications: boolean;
  medications: MedicationEntry[];
}

interface SurgeryEntry {
  id: string;
  name: string;
  year: string;
  notes: string;
}

interface SurgeriesData {
  noSurgeries: boolean;
  skipForNow: boolean;
  surgeries: SurgeryEntry[];
}

export default function HealthQuestionnaire() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  
  const [profile, setProfile] = useState<ProfileData>({
    fullName: "",
    dateOfBirth: "",
    sexAtBirth: "",
    genderIdentity: "",
    preferredLanguage: "en",
    heightFeet: "",
    heightInches: "",
    weight: "",
    pregnancyStatus: "",
    primaryCareDoctor: "",
    preferredPharmacy: "",
    immunizations: [],
  });

  const [emergencyContact, setEmergencyContact] = useState<EmergencyContactData>({
    name: "",
    relationship: "",
    phone: "",
  });

  const [medicalHistory, setMedicalHistory] = useState<MedicalHistoryData>({
    selectedConditions: [],
    conditionDetails: {},
    otherDiagnosisText: "",
  });

  const [allergies, setAllergies] = useState<AllergiesData>({
    noKnownAllergies: false,
    allergies: [],
  });

  const [familyHistory, setFamilyHistory] = useState<FamilyHistoryData>({
    entries: [],
  });

  const [socialHistory, setSocialHistory] = useState<SocialHistoryData>({
    tobacco: {
      status: "",
      types: [],
      yearsUsed: "",
      amountPerDay: "",
      quitYear: "",
    },
    vaping: {
      status: "",
      substance: "",
      frequency: "",
    },
    alcohol: {
      frequency: "",
      drinksPerWeek: "",
      pastHeavyUse: false,
    },
    drugs: {
      status: "",
      types: [],
      frequencyAndLastUse: "",
    },
  });

  const [medications, setMedications] = useState<MedicationsData>({
    noCurrentMedications: false,
    medications: [],
  });

  const [surgeries, setSurgeries] = useState<SurgeriesData>({
    noSurgeries: false,
    skipForNow: false,
    surgeries: [],
  });

  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const progress = ((currentSection + 1) / QUESTIONNAIRE_SECTIONS.length) * 100;

  const submitQuestionnaireMutation = useMutation({
    mutationFn: async (data: { 
      profile: ProfileData; 
      emergencyContact: EmergencyContactData; 
      medicalHistory: MedicalHistoryData;
      allergies: AllergiesData;
      medications: MedicationsData;
      surgeries: SurgeriesData;
      familyHistory: FamilyHistoryData;
      socialHistory: SocialHistoryData;
    }) => {
      const res = await apiRequest("POST", "/api/health-questionnaire", data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Questionnaire Submitted",
        description: "Your health information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save your information. Please try again.",
        variant: "destructive",
      });
    },
  });

  const validateProfile = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!profile.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    }
    if (!profile.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required";
    }
    if (!profile.preferredLanguage) {
      newErrors.preferredLanguage = "Preferred language is required";
    }
    if (!profile.heightFeet || !profile.heightInches) {
      newErrors.height = "Height is required";
    }
    if (!profile.weight) {
      newErrors.weight = "Weight is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const sectionId = QUESTIONNAIRE_SECTIONS[currentSection].id;
    
    if (sectionId === "profile") {
      if (!validateProfile()) {
        toast({
          title: "Required Fields",
          description: "Please fill in all required fields.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!completedSections.includes(sectionId)) {
      setCompletedSections([...completedSections, sectionId]);
    }
    
    if (currentSection < QUESTIONNAIRE_SECTIONS.length - 1) {
      setCurrentSection(currentSection + 1);
    }
  };

  const handleBack = () => {
    if (currentSection > 0) {
      setCurrentSection(currentSection - 1);
    }
  };

  const handleSubmit = () => {
    if (!completedSections.includes("profile")) {
      if (!validateProfile()) {
        setCurrentSection(0);
        toast({
          title: "Required Fields",
          description: "Please complete the profile section first.",
          variant: "destructive",
        });
        return;
      }
    }

    submitQuestionnaireMutation.mutate({
      profile,
      emergencyContact,
      medicalHistory,
      allergies,
      medications,
      surgeries,
      familyHistory,
      socialHistory,
    });
  };

  const addMedication = () => {
    const newMedication: MedicationEntry = {
      id: `med-${Date.now()}`,
      category: "",
      name: "",
      dose: "",
      frequency: "",
      notSure: false,
    };
    setMedications({
      ...medications,
      medications: [...medications.medications, newMedication],
    });
  };

  const removeMedication = (id: string) => {
    setMedications({
      ...medications,
      medications: medications.medications.filter(m => m.id !== id),
    });
  };

  const updateMedication = (id: string, field: keyof MedicationEntry, value: string | boolean) => {
    setMedications({
      ...medications,
      medications: medications.medications.map(m =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    });
  };

  const addAllergy = () => {
    const newAllergy: AllergyEntry = {
      id: `allergy-${Date.now()}`,
      type: "",
      allergen: "",
      reactionType: "",
      severity: "",
      yearOfReaction: "",
      notSure: false,
    };
    setAllergies({
      ...allergies,
      allergies: [...allergies.allergies, newAllergy],
    });
  };

  const removeAllergy = (id: string) => {
    setAllergies({
      ...allergies,
      allergies: allergies.allergies.filter(a => a.id !== id),
    });
  };

  const updateAllergy = (id: string, field: keyof AllergyEntry, value: string | boolean) => {
    setAllergies({
      ...allergies,
      allergies: allergies.allergies.map(a => 
        a.id === id ? { ...a, [field]: value } : a
      ),
    });
  };

  const addFamilyHistoryEntry = () => {
    const newEntry: FamilyHistoryEntry = {
      id: `family-${Date.now()}`,
      conditionId: "",
      relative: "",
      ageAtDiagnosis: "",
    };
    setFamilyHistory({
      entries: [...familyHistory.entries, newEntry],
    });
  };

  const removeFamilyHistoryEntry = (id: string) => {
    setFamilyHistory({
      entries: familyHistory.entries.filter(e => e.id !== id),
    });
  };

  const updateFamilyHistoryEntry = (id: string, field: keyof FamilyHistoryEntry, value: string) => {
    setFamilyHistory({
      entries: familyHistory.entries.map(e =>
        e.id === id ? { ...e, [field]: value } : e
      ),
    });
  };

  const renderProfileSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Profile Basics</h3>
          <p className="text-sm text-muted-foreground">Required information</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName" className="flex items-center gap-1">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fullName"
            data-testid="input-full-name"
            placeholder="Enter your full legal name"
            value={profile.fullName}
            onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
            className={errors.fullName ? "border-destructive" : ""}
          />
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateOfBirth" className="flex items-center gap-1">
            <Calendar className="h-4 w-4 mr-1" />
            Date of Birth <span className="text-destructive">*</span>
          </Label>
          <Input
            id="dateOfBirth"
            type="date"
            data-testid="input-date-of-birth"
            value={profile.dateOfBirth}
            onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
            className={errors.dateOfBirth ? "border-destructive" : ""}
          />
          {errors.dateOfBirth && <p className="text-sm text-destructive">{errors.dateOfBirth}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sexAtBirth" className="text-muted-foreground">
              Sex at Birth (optional)
            </Label>
            <Select
              value={profile.sexAtBirth}
              onValueChange={(value) => setProfile({ ...profile, sexAtBirth: value })}
            >
              <SelectTrigger data-testid="select-sex-at-birth">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {SEX_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="genderIdentity" className="text-muted-foreground">
              Gender Identity (optional)
            </Label>
            <Select
              value={profile.genderIdentity}
              onValueChange={(value) => setProfile({ ...profile, genderIdentity: value })}
            >
              <SelectTrigger data-testid="select-gender-identity">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferredLanguage" className="flex items-center gap-1">
            <Globe className="h-4 w-4 mr-1" />
            Preferred Language <span className="text-destructive">*</span>
          </Label>
          <Select
            value={profile.preferredLanguage}
            onValueChange={(value) => setProfile({ ...profile, preferredLanguage: value })}
          >
            <SelectTrigger data-testid="select-preferred-language">
              <SelectValue placeholder="Select language..." />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.preferredLanguage && <p className="text-sm text-destructive">{errors.preferredLanguage}</p>}
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Ruler className="h-4 w-4 mr-1" />
            Height <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                id="heightFeet"
                type="number"
                min="1"
                max="8"
                data-testid="input-height-feet"
                placeholder="Feet"
                value={profile.heightFeet}
                onChange={(e) => setProfile({ ...profile, heightFeet: e.target.value })}
                className={errors.height ? "border-destructive" : ""}
              />
            </div>
            <span className="flex items-center text-muted-foreground">ft</span>
            <div className="flex-1">
              <Input
                id="heightInches"
                type="number"
                min="0"
                max="11"
                data-testid="input-height-inches"
                placeholder="Inches"
                value={profile.heightInches}
                onChange={(e) => setProfile({ ...profile, heightInches: e.target.value })}
                className={errors.height ? "border-destructive" : ""}
              />
            </div>
            <span className="flex items-center text-muted-foreground">in</span>
          </div>
          {errors.height && <p className="text-sm text-destructive">{errors.height}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="weight" className="flex items-center gap-1">
            <Scale className="h-4 w-4 mr-1" />
            Weight <span className="text-destructive">*</span>
          </Label>
          <div className="flex gap-2">
            <Input
              id="weight"
              type="number"
              min="1"
              max="1000"
              data-testid="input-weight"
              placeholder="Enter weight"
              value={profile.weight}
              onChange={(e) => setProfile({ ...profile, weight: e.target.value })}
              className={errors.weight ? "border-destructive" : ""}
            />
            <span className="flex items-center text-muted-foreground px-3">lbs</span>
          </div>
          {errors.weight && <p className="text-sm text-destructive">{errors.weight}</p>}
        </div>

        {(profile.sexAtBirth === "female" || profile.sexAtBirth === "") && (
          <div className="space-y-2">
            <Label htmlFor="pregnancyStatus" className="flex items-center gap-1 text-muted-foreground">
              <Baby className="h-4 w-4 mr-1" />
              Pregnancy Status (optional)
            </Label>
            <Select
              value={profile.pregnancyStatus}
              onValueChange={(value) => setProfile({ ...profile, pregnancyStatus: value })}
            >
              <SelectTrigger data-testid="select-pregnancy-status">
                <SelectValue placeholder="Select if applicable..." />
              </SelectTrigger>
              <SelectContent>
                {PREGNANCY_STATUS_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="primaryCareDoctor" className="flex items-center gap-1 text-muted-foreground">
            <Stethoscope className="h-4 w-4 mr-1" />
            Primary Care Doctor (optional)
          </Label>
          <Input
            id="primaryCareDoctor"
            data-testid="input-primary-care-doctor"
            placeholder="Enter your doctor's name"
            value={profile.primaryCareDoctor}
            onChange={(e) => setProfile({ ...profile, primaryCareDoctor: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="preferredPharmacy" className="flex items-center gap-1 text-muted-foreground">
            <Building2 className="h-4 w-4 mr-1" />
            Preferred Pharmacy (optional)
          </Label>
          <Input
            id="preferredPharmacy"
            data-testid="input-preferred-pharmacy"
            placeholder="Enter pharmacy name and location"
            value={profile.preferredPharmacy}
            onChange={(e) => setProfile({ ...profile, preferredPharmacy: e.target.value })}
          />
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-1 text-muted-foreground">
            <Syringe className="h-4 w-4 mr-1" />
            Immunizations (optional)
          </Label>
          <p className="text-sm text-muted-foreground">Select any vaccines you've received</p>
          <div className="space-y-2">
            {IMMUNIZATION_OPTIONS.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-3">
                <Checkbox
                  id={`immunization-${value}`}
                  data-testid={`checkbox-immunization-${value}`}
                  checked={profile.immunizations.includes(value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setProfile({ ...profile, immunizations: [...profile.immunizations, value] });
                    } else {
                      setProfile({ ...profile, immunizations: profile.immunizations.filter(i => i !== value) });
                    }
                  }}
                />
                <Label htmlFor={`immunization-${value}`} className="text-sm font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const toggleCondition = (conditionId: string) => {
    const isSelected = medicalHistory.selectedConditions.includes(conditionId);
    
    if (isSelected) {
      setMedicalHistory({
        ...medicalHistory,
        selectedConditions: medicalHistory.selectedConditions.filter(id => id !== conditionId),
        conditionDetails: Object.fromEntries(
          Object.entries(medicalHistory.conditionDetails).filter(([key]) => key !== conditionId)
        ),
        otherDiagnosisText: conditionId === "other-diagnosis" ? "" : medicalHistory.otherDiagnosisText,
      });
    } else {
      setMedicalHistory({
        ...medicalHistory,
        selectedConditions: [...medicalHistory.selectedConditions, conditionId],
        conditionDetails: {
          ...medicalHistory.conditionDetails,
          [conditionId]: { yearDiagnosed: "", status: "", treatment: "" },
        },
      });
    }
  };

  const updateConditionDetail = (conditionId: string, field: keyof ConditionDetail, value: string) => {
    setMedicalHistory({
      ...medicalHistory,
      conditionDetails: {
        ...medicalHistory.conditionDetails,
        [conditionId]: {
          ...medicalHistory.conditionDetails[conditionId],
          [field]: value,
        },
      },
    });
  };

  const toggleCategory = (categoryId: string) => {
    if (openCategories.includes(categoryId)) {
      setOpenCategories(openCategories.filter(id => id !== categoryId));
    } else {
      setOpenCategories([...openCategories, categoryId]);
    }
  };

  const getSelectedCountForCategory = (categoryId: string) => {
    const category = CONDITION_CATEGORIES.find(c => c.id === categoryId);
    if (!category) return 0;
    return category.conditions.filter(c => medicalHistory.selectedConditions.includes(c.id)).length;
  };

  const renderMedicalHistorySection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-blue-500/10">
          <Stethoscope className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Medical History</h3>
          <p className="text-sm text-muted-foreground">Select any conditions you've been diagnosed with</p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            For each condition you select, you can optionally provide the year diagnosed, current status, and treatment details.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {CONDITION_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const selectedCount = getSelectedCountForCategory(category.id);
          const isOpen = openCategories.includes(category.id);

          return (
            <Collapsible
              key={category.id}
              open={isOpen}
              onOpenChange={() => toggleCategory(category.id)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="w-full flex items-center justify-between p-4 rounded-lg border hover-elevate transition-colors"
                  data-testid={`category-toggle-${category.id}`}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{category.name}</span>
                    {selectedCount > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {selectedCount} selected
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2 pl-4 border-l-2 border-muted ml-6">
                  {category.conditions.map((condition) => {
                    const isSelected = medicalHistory.selectedConditions.includes(condition.id);
                    const details = medicalHistory.conditionDetails[condition.id];

                    return (
                      <div key={condition.id} className="space-y-3">
                        <div className="flex items-start gap-3 py-2">
                          <Checkbox
                            id={condition.id}
                            checked={isSelected}
                            onCheckedChange={() => toggleCondition(condition.id)}
                            data-testid={`checkbox-${condition.id}`}
                          />
                          <label
                            htmlFor={condition.id}
                            className="text-sm cursor-pointer leading-tight"
                          >
                            {condition.label}
                          </label>
                        </div>

                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="ml-6 p-4 rounded-lg bg-muted/30 space-y-3"
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Year Diagnosed</Label>
                                <Input
                                  type="number"
                                  min="1900"
                                  max={new Date().getFullYear()}
                                  placeholder="e.g. 2020"
                                  value={details?.yearDiagnosed || ""}
                                  onChange={(e) => updateConditionDetail(condition.id, "yearDiagnosed", e.target.value)}
                                  data-testid={`input-year-${condition.id}`}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Current Status</Label>
                                <Select
                                  value={details?.status || ""}
                                  onValueChange={(value) => updateConditionDetail(condition.id, "status", value)}
                                >
                                  <SelectTrigger data-testid={`select-status-${condition.id}`}>
                                    <SelectValue placeholder="Select..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {CONDITION_STATUS_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Current Treatment</Label>
                              <Textarea
                                placeholder="Describe current treatment (optional)"
                                value={details?.treatment || ""}
                                onChange={(e) => updateConditionDetail(condition.id, "treatment", e.target.value)}
                                data-testid={`textarea-treatment-${condition.id}`}
                                className="resize-none"
                              />
                            </div>
                            {condition.id === "other-diagnosis" && (
                              <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Diagnosis Description</Label>
                                <Textarea
                                  placeholder="Please describe your other diagnosis..."
                                  value={medicalHistory.otherDiagnosisText}
                                  onChange={(e) => setMedicalHistory({ ...medicalHistory, otherDiagnosisText: e.target.value })}
                                  data-testid="textarea-other-diagnosis"
                                  className="resize-none"
                                />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>

      {medicalHistory.selectedConditions.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-sm font-medium">
              {medicalHistory.selectedConditions.length} condition{medicalHistory.selectedConditions.length !== 1 ? "s" : ""} selected
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderAllergiesSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-red-500/10">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Allergies</h3>
          <p className="text-sm text-muted-foreground">Do you have any allergies or bad reactions?</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border">
        <Checkbox
          id="no-known-allergies"
          checked={allergies.noKnownAllergies}
          onCheckedChange={(checked) => {
            setAllergies({
              noKnownAllergies: !!checked,
              allergies: checked ? [] : allergies.allergies,
            });
          }}
          data-testid="checkbox-nka"
        />
        <label htmlFor="no-known-allergies" className="text-sm font-medium cursor-pointer">
          No known allergies (NKA)
        </label>
      </div>

      {!allergies.noKnownAllergies && (
        <>
          <div className="space-y-4">
            {allergies.allergies.map((allergy, index) => (
              <Card key={allergy.id} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeAllergy(allergy.id)}
                  data-testid={`button-remove-allergy-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Allergy Type</Label>
                      <Select
                        value={allergy.type}
                        onValueChange={(value) => updateAllergy(allergy.id, "type", value)}
                      >
                        <SelectTrigger data-testid={`select-allergy-type-${index}`}>
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {ALLERGY_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Allergen</Label>
                      <Input
                        placeholder="e.g., Penicillin, Peanuts"
                        value={allergy.allergen}
                        onChange={(e) => updateAllergy(allergy.id, "allergen", e.target.value)}
                        data-testid={`input-allergen-${index}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Reaction Type</Label>
                      <Select
                        value={allergy.reactionType}
                        onValueChange={(value) => updateAllergy(allergy.id, "reactionType", value)}
                      >
                        <SelectTrigger data-testid={`select-reaction-type-${index}`}>
                          <SelectValue placeholder="Select reaction..." />
                        </SelectTrigger>
                        <SelectContent>
                          {REACTION_TYPES.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select
                        value={allergy.severity}
                        onValueChange={(value) => updateAllergy(allergy.id, "severity", value)}
                      >
                        <SelectTrigger data-testid={`select-severity-${index}`}>
                          <SelectValue placeholder="Select severity..." />
                        </SelectTrigger>
                        <SelectContent>
                          {SEVERITY_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Year of Reaction (optional)</Label>
                      <Input
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="e.g., 2020"
                        value={allergy.yearOfReaction}
                        onChange={(e) => updateAllergy(allergy.id, "yearOfReaction", e.target.value)}
                        data-testid={`input-year-reaction-${index}`}
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <Checkbox
                        id={`not-sure-${allergy.id}`}
                        checked={allergy.notSure}
                        onCheckedChange={(checked) => updateAllergy(allergy.id, "notSure", !!checked)}
                        data-testid={`checkbox-not-sure-${index}`}
                      />
                      <label htmlFor={`not-sure-${allergy.id}`} className="text-sm cursor-pointer">
                        Not sure about details
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addAllergy}
            className="w-full"
            data-testid="button-add-allergy"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Allergy
          </Button>
        </>
      )}

      {allergies.allergies.length > 0 && !allergies.noKnownAllergies && (
        <Card className="bg-red-500/5 border-red-500/20">
          <CardContent className="pt-4">
            <p className="text-sm font-medium">
              {allergies.allergies.length} allergy{allergies.allergies.length !== 1 ? "ies" : ""} recorded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderMedicationsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-blue-500/10">
          <Pill className="h-6 w-6 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Current Medications</h3>
          <p className="text-sm text-muted-foreground">Prescription, OTC, and supplements</p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-lg border">
        <Checkbox
          id="no-current-medications"
          checked={medications.noCurrentMedications}
          onCheckedChange={(checked) => {
            setMedications({
              noCurrentMedications: !!checked,
              medications: checked ? [] : medications.medications,
            });
          }}
          data-testid="checkbox-no-medications"
        />
        <label htmlFor="no-current-medications" className="text-sm font-medium cursor-pointer">
          I am not currently taking any medications or supplements
        </label>
      </div>

      {!medications.noCurrentMedications && (
        <>
          <div className="space-y-4">
            {medications.medications.map((med, index) => (
              <Card key={med.id} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeMedication(med.id)}
                  data-testid={`button-remove-medication-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={med.category}
                        onValueChange={(value) => updateMedication(med.id, "category", value)}
                      >
                        <SelectTrigger data-testid={`select-med-category-${index}`}>
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDICATION_CATEGORIES.map((c) => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Medication Name</Label>
                      <Input
                        placeholder="e.g., Lisinopril, Vitamin D"
                        value={med.name}
                        onChange={(e) => updateMedication(med.id, "name", e.target.value)}
                        data-testid={`input-med-name-${index}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dose (optional)</Label>
                      <Input
                        placeholder="e.g., 10mg, 1000 IU"
                        value={med.dose}
                        onChange={(e) => updateMedication(med.id, "dose", e.target.value)}
                        data-testid={`input-med-dose-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency (optional)</Label>
                      <Select
                        value={med.frequency}
                        onValueChange={(value) => updateMedication(med.id, "frequency", value)}
                      >
                        <SelectTrigger data-testid={`select-med-frequency-${index}`}>
                          <SelectValue placeholder="Select frequency..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MEDICATION_FREQUENCY_OPTIONS.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`not-sure-med-${med.id}`}
                      checked={med.notSure}
                      onCheckedChange={(checked) => updateMedication(med.id, "notSure", !!checked)}
                      data-testid={`checkbox-not-sure-med-${index}`}
                    />
                    <label htmlFor={`not-sure-med-${med.id}`} className="text-sm cursor-pointer">
                      Not sure about dose/frequency
                    </label>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addMedication}
            className="w-full"
            data-testid="button-add-medication"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Medication
          </Button>
        </>
      )}

      {medications.medications.length > 0 && !medications.noCurrentMedications && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <p className="text-sm font-medium">
              {medications.medications.length} medication{medications.medications.length !== 1 ? "s" : ""} recorded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const addSurgery = () => {
    const newSurgery: SurgeryEntry = {
      id: `surgery-${Date.now()}`,
      name: "",
      year: "",
      notes: "",
    };
    setSurgeries({
      ...surgeries,
      surgeries: [...surgeries.surgeries, newSurgery],
    });
  };

  const removeSurgery = (id: string) => {
    setSurgeries({
      ...surgeries,
      surgeries: surgeries.surgeries.filter(s => s.id !== id),
    });
  };

  const updateSurgery = (id: string, field: keyof SurgeryEntry, value: string) => {
    setSurgeries({
      ...surgeries,
      surgeries: surgeries.surgeries.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    });
  };

  const renderSurgeriesSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-orange-500/10">
          <Scissors className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Surgeries</h3>
          <p className="text-sm text-muted-foreground">Past surgical procedures</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-3 p-4 rounded-lg bg-muted/50">
          <Checkbox
            id="no-surgeries"
            data-testid="checkbox-no-surgeries"
            checked={surgeries.noSurgeries}
            onCheckedChange={(checked) => {
              setSurgeries({
                noSurgeries: !!checked,
                skipForNow: false,
                surgeries: checked ? [] : surgeries.surgeries,
              });
            }}
          />
          <Label htmlFor="no-surgeries" className="text-sm font-medium cursor-pointer">
            No previous surgeries
          </Label>
        </div>

        <div className="flex items-center space-x-3 p-4 rounded-lg border border-dashed">
          <Checkbox
            id="skip-surgeries"
            data-testid="checkbox-skip-surgeries"
            checked={surgeries.skipForNow}
            onCheckedChange={(checked) => {
              setSurgeries({
                ...surgeries,
                noSurgeries: false,
                skipForNow: !!checked,
              });
            }}
          />
          <div className="flex items-center gap-2">
            <SkipForward className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="skip-surgeries" className="text-sm cursor-pointer">
              Skip for now - I'll add this later
            </Label>
          </div>
        </div>
      </div>

      {!surgeries.noSurgeries && !surgeries.skipForNow && (
        <>
          <div className="space-y-4">
            {surgeries.surgeries.map((surgery, index) => (
              <Card key={surgery.id} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeSurgery(surgery.id)}
                  data-testid={`button-remove-surgery-${index}`}
                >
                  <X className="h-4 w-4" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Surgery Type</Label>
                    <Select
                      value={surgery.name}
                      onValueChange={(value) => updateSurgery(surgery.id, "name", value)}
                    >
                      <SelectTrigger data-testid={`select-surgery-type-${index}`}>
                        <SelectValue placeholder="Select surgery..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_SURGERIES.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Year (approximate)</Label>
                      <Input
                        type="number"
                        min="1900"
                        max={new Date().getFullYear()}
                        placeholder="e.g., 2020"
                        value={surgery.year}
                        onChange={(e) => updateSurgery(surgery.id, "year", e.target.value)}
                        data-testid={`input-surgery-year-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Input
                        placeholder="Any additional details"
                        value={surgery.notes}
                        onChange={(e) => updateSurgery(surgery.id, "notes", e.target.value)}
                        data-testid={`input-surgery-notes-${index}`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            variant="outline"
            onClick={addSurgery}
            className="w-full"
            data-testid="button-add-surgery"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Surgery
          </Button>
        </>
      )}

      {surgeries.surgeries.length > 0 && !surgeries.noSurgeries && !surgeries.skipForNow && (
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4">
            <p className="text-sm font-medium">
              {surgeries.surgeries.length} surger{surgeries.surgeries.length !== 1 ? "ies" : "y"} recorded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderReviewSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-green-500/10">
          <ClipboardCheck className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Review Your Information</h3>
          <p className="text-sm text-muted-foreground">Confirm your details before submitting</p>
        </div>
      </div>

      <Card className="bg-green-500/5 border-green-500/20">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">You can edit this information anytime after submission</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Name:</span> {profile.fullName || "Not provided"}</p>
            <p><span className="text-muted-foreground">DOB:</span> {profile.dateOfBirth || "Not provided"}</p>
            {profile.primaryCareDoctor && (
              <p><span className="text-muted-foreground">Doctor:</span> {profile.primaryCareDoctor}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Conditions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {medicalHistory.selectedConditions.length > 0 ? (
              <p>{medicalHistory.selectedConditions.length} condition(s) recorded</p>
            ) : (
              <p className="text-muted-foreground">None reported</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Allergies
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {allergies.noKnownAllergies ? (
              <p className="text-muted-foreground">No known allergies</p>
            ) : allergies.allergies.length > 0 ? (
              <p>{allergies.allergies.length} allergy/allergies recorded</p>
            ) : (
              <p className="text-muted-foreground">Not completed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" />
              Surgeries
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {surgeries.noSurgeries ? (
              <p className="text-muted-foreground">No previous surgeries</p>
            ) : surgeries.skipForNow ? (
              <p className="text-muted-foreground">Skipped - will add later</p>
            ) : surgeries.surgeries.length > 0 ? (
              <p>{surgeries.surgeries.length} surgery/surgeries recorded</p>
            ) : (
              <p className="text-muted-foreground">Not completed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Family History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {familyHistory.entries.length > 0 ? (
              <p>{familyHistory.entries.length} family condition(s) recorded</p>
            ) : (
              <p className="text-muted-foreground">None reported</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4" />
              Medications
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {medications.noCurrentMedications ? (
              <p className="text-muted-foreground">No current medications</p>
            ) : medications.medications.length > 0 ? (
              <p>{medications.medications.length} medication(s) recorded</p>
            ) : (
              <p className="text-muted-foreground">Not completed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Social History
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {socialHistory.tobacco.status || socialHistory.alcohol.frequency ? (
              <p>Social history recorded</p>
            ) : (
              <p className="text-muted-foreground">Not completed</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {emergencyContact.name ? (
              <p>{emergencyContact.name} ({emergencyContact.relationship || "Contact"})</p>
            ) : (
              <p className="text-muted-foreground">Not provided (optional)</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 text-center">
          <p className="text-sm text-muted-foreground">
            Click "Submit" to save your questionnaire. You can return and edit your responses at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderFamilyHistorySection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-purple-500/10">
          <Users className="h-6 w-6 text-purple-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Family History</h3>
          <p className="text-sm text-muted-foreground">Do any close family members have these conditions?</p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Include conditions from first-degree relatives (parents, siblings, children) and grandparents.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {familyHistory.entries.map((entry, index) => (
          <Card key={entry.id} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => removeFamilyHistoryEntry(entry.id)}
              data-testid={`button-remove-family-${index}`}
            >
              <X className="h-4 w-4" />
            </Button>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Relative</Label>
                  <Select
                    value={entry.relative}
                    onValueChange={(value) => updateFamilyHistoryEntry(entry.id, "relative", value)}
                  >
                    <SelectTrigger data-testid={`select-relative-${index}`}>
                      <SelectValue placeholder="Select relative..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIVE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={entry.conditionId}
                    onValueChange={(value) => updateFamilyHistoryEntry(entry.id, "conditionId", value)}
                  >
                    <SelectTrigger data-testid={`select-family-condition-${index}`}>
                      <SelectValue placeholder="Select condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FAMILY_CONDITIONS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Age at Diagnosis (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g., 55"
                  value={entry.ageAtDiagnosis}
                  onChange={(e) => updateFamilyHistoryEntry(entry.id, "ageAtDiagnosis", e.target.value)}
                  data-testid={`input-age-diagnosis-${index}`}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        variant="outline"
        onClick={addFamilyHistoryEntry}
        className="w-full"
        data-testid="button-add-family-history"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Family History Entry
      </Button>

      {familyHistory.entries.length > 0 && (
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4">
            <p className="text-sm font-medium">
              {familyHistory.entries.length} family condition{familyHistory.entries.length !== 1 ? "s" : ""} recorded
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const toggleNicotineType = (type: string) => {
    const types = socialHistory.tobacco.types.includes(type)
      ? socialHistory.tobacco.types.filter(t => t !== type)
      : [...socialHistory.tobacco.types, type];
    setSocialHistory({
      ...socialHistory,
      tobacco: { ...socialHistory.tobacco, types },
    });
  };

  const toggleDrugType = (type: string) => {
    const types = socialHistory.drugs.types.includes(type)
      ? socialHistory.drugs.types.filter(t => t !== type)
      : [...socialHistory.drugs.types, type];
    setSocialHistory({
      ...socialHistory,
      drugs: { ...socialHistory.drugs, types },
    });
  };

  const renderSocialHistorySection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-green-500/10">
          <Activity className="h-6 w-6 text-green-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Social History</h3>
          <p className="text-sm text-muted-foreground">Lifestyle habits and substance use</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tobacco / Nicotine</CardTitle>
          <CardDescription>Do you currently use nicotine products?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={socialHistory.tobacco.status}
              onValueChange={(value) => setSocialHistory({
                ...socialHistory,
                tobacco: { ...socialHistory.tobacco, status: value },
              })}
            >
              <SelectTrigger data-testid="select-tobacco-status">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {NICOTINE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(socialHistory.tobacco.status === "former" || socialHistory.tobacco.status === "current") && (
            <>
              <div className="space-y-2">
                <Label>Types used (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {NICOTINE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`nicotine-${type.value}`}
                        checked={socialHistory.tobacco.types.includes(type.value)}
                        onCheckedChange={() => toggleNicotineType(type.value)}
                        data-testid={`checkbox-nicotine-${type.value}`}
                      />
                      <label htmlFor={`nicotine-${type.value}`} className="text-sm cursor-pointer">
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Years used</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="e.g., 10"
                    value={socialHistory.tobacco.yearsUsed}
                    onChange={(e) => setSocialHistory({
                      ...socialHistory,
                      tobacco: { ...socialHistory.tobacco, yearsUsed: e.target.value },
                    })}
                    data-testid="input-tobacco-years"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Average per day</Label>
                  <Input
                    placeholder="e.g., 1 pack"
                    value={socialHistory.tobacco.amountPerDay}
                    onChange={(e) => setSocialHistory({
                      ...socialHistory,
                      tobacco: { ...socialHistory.tobacco, amountPerDay: e.target.value },
                    })}
                    data-testid="input-tobacco-amount"
                  />
                </div>
              </div>

              {socialHistory.tobacco.status === "former" && (
                <div className="space-y-2">
                  <Label>Quit year</Label>
                  <Input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    placeholder="e.g., 2020"
                    value={socialHistory.tobacco.quitYear}
                    onChange={(e) => setSocialHistory({
                      ...socialHistory,
                      tobacco: { ...socialHistory.tobacco, quitYear: e.target.value },
                    })}
                    data-testid="input-tobacco-quit-year"
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vaping</CardTitle>
          <CardDescription>E-cigarette or vaporizer use</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={socialHistory.vaping.status}
              onValueChange={(value) => setSocialHistory({
                ...socialHistory,
                vaping: { ...socialHistory.vaping, status: value },
              })}
            >
              <SelectTrigger data-testid="select-vaping-status">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {VAPING_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(socialHistory.vaping.status === "former" || socialHistory.vaping.status === "current") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Substance</Label>
                <Select
                  value={socialHistory.vaping.substance}
                  onValueChange={(value) => setSocialHistory({
                    ...socialHistory,
                    vaping: { ...socialHistory.vaping, substance: value },
                  })}
                >
                  <SelectTrigger data-testid="select-vaping-substance">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VAPING_SUBSTANCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={socialHistory.vaping.frequency}
                  onValueChange={(value) => setSocialHistory({
                    ...socialHistory,
                    vaping: { ...socialHistory.vaping, frequency: value },
                  })}
                >
                  <SelectTrigger data-testid="select-vaping-frequency">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {VAPING_FREQUENCY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alcohol</CardTitle>
          <CardDescription>Alcohol consumption</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select
              value={socialHistory.alcohol.frequency}
              onValueChange={(value) => setSocialHistory({
                ...socialHistory,
                alcohol: { ...socialHistory.alcohol, frequency: value },
              })}
            >
              <SelectTrigger data-testid="select-alcohol-frequency">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {ALCOHOL_FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {socialHistory.alcohol.frequency && socialHistory.alcohol.frequency !== "never" && (
            <>
              <div className="space-y-2">
                <Label>Typical drinks per week (optional)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 5"
                  value={socialHistory.alcohol.drinksPerWeek}
                  onChange={(e) => setSocialHistory({
                    ...socialHistory,
                    alcohol: { ...socialHistory.alcohol, drinksPerWeek: e.target.value },
                  })}
                  data-testid="input-alcohol-drinks"
                />
              </div>

              <div className="flex items-center gap-3">
                <Checkbox
                  id="past-heavy-use"
                  checked={socialHistory.alcohol.pastHeavyUse}
                  onCheckedChange={(checked) => setSocialHistory({
                    ...socialHistory,
                    alcohol: { ...socialHistory.alcohol, pastHeavyUse: !!checked },
                  })}
                  data-testid="checkbox-past-heavy-use"
                />
                <label htmlFor="past-heavy-use" className="text-sm cursor-pointer">
                  Any past heavy use
                </label>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recreational Drugs</CardTitle>
          <CardDescription>Have you ever used recreational drugs or misused prescription meds?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={socialHistory.drugs.status}
              onValueChange={(value) => setSocialHistory({
                ...socialHistory,
                drugs: { ...socialHistory.drugs, status: value },
              })}
            >
              <SelectTrigger data-testid="select-drug-status">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {DRUG_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(socialHistory.drugs.status === "past" || socialHistory.drugs.status === "current") && (
            <>
              <div className="space-y-2">
                <Label>Types (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {DRUG_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`drug-${type.value}`}
                        checked={socialHistory.drugs.types.includes(type.value)}
                        onCheckedChange={() => toggleDrugType(type.value)}
                        data-testid={`checkbox-drug-${type.value}`}
                      />
                      <label htmlFor={`drug-${type.value}`} className="text-sm cursor-pointer">
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Frequency and last use (optional)</Label>
                <Textarea
                  placeholder="e.g., Marijuana occasionally, last used 2 years ago"
                  value={socialHistory.drugs.frequencyAndLastUse}
                  onChange={(e) => setSocialHistory({
                    ...socialHistory,
                    drugs: { ...socialHistory.drugs, frequencyAndLastUse: e.target.value },
                  })}
                  data-testid="textarea-drug-details"
                  className="resize-none"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderEmergencyContactSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-full bg-orange-500/10">
          <Phone className="h-6 w-6 text-orange-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Emergency Contact</h3>
          <p className="text-sm text-muted-foreground">Optional but recommended</p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-4">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              Providing an emergency contact helps healthcare providers reach someone on your behalf in case of an emergency.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="emergencyName">Contact Name</Label>
          <Input
            id="emergencyName"
            data-testid="input-emergency-name"
            placeholder="Full name of emergency contact"
            value={emergencyContact.name}
            onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyRelationship">Relationship</Label>
          <Select
            value={emergencyContact.relationship}
            onValueChange={(value) => setEmergencyContact({ ...emergencyContact, relationship: value })}
          >
            <SelectTrigger data-testid="select-emergency-relationship">
              <SelectValue placeholder="Select relationship..." />
            </SelectTrigger>
            <SelectContent>
              {RELATIONSHIP_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Phone Number</Label>
          <Input
            id="emergencyPhone"
            type="tel"
            data-testid="input-emergency-phone"
            placeholder="(555) 123-4567"
            value={emergencyContact.phone}
            onChange={(e) => setEmergencyContact({ ...emergencyContact, phone: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  const renderCurrentSection = () => {
    switch (QUESTIONNAIRE_SECTIONS[currentSection].id) {
      case "profile":
        return renderProfileSection();
      case "medical-history":
        return renderMedicalHistorySection();
      case "allergies":
        return renderAllergiesSection();
      case "medications":
        return renderMedicationsSection();
      case "surgeries":
        return renderSurgeriesSection();
      case "family-history":
        return renderFamilyHistorySection();
      case "social-history":
        return renderSocialHistorySection();
      case "emergency":
        return renderEmergencyContactSection();
      case "review":
        return renderReviewSection();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Clipboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Health Questionnaire</h1>
              <p className="text-muted-foreground">Complete your health profile</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Section {currentSection + 1} of {QUESTIONNAIRE_SECTIONS.length}
              </span>
              <span className="font-medium">{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="flex gap-2 mt-4">
            {QUESTIONNAIRE_SECTIONS.map((section, index) => {
              const Icon = section.icon;
              const isCompleted = completedSections.includes(section.id);
              const isCurrent = index === currentSection;
              
              return (
                <button
                  key={section.id}
                  onClick={() => setCurrentSection(index)}
                  className={`flex-1 p-3 rounded-lg border transition-colors ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : isCompleted
                      ? "border-green-500 bg-green-500/5"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                  data-testid={`section-tab-${section.id}`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {isCompleted ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : (
                      <Icon className={`h-5 w-5 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    )}
                    <span className={`text-xs ${isCurrent ? "font-medium" : "text-muted-foreground"}`}>
                      {section.title}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {renderCurrentSection()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentSection === 0}
              data-testid="button-back"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            {currentSection === QUESTIONNAIRE_SECTIONS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={submitQuestionnaireMutation.isPending}
                data-testid="button-submit"
              >
                {submitQuestionnaireMutation.isPending ? (
                  "Saving..."
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Submit
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext} data-testid="button-next">
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardFooter>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your information is protected and handled in accordance with HIPAA regulations.
        </p>
      </div>
    </div>
  );
}
