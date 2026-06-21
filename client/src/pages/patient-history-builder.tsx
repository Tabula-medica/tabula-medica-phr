import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ClipboardList, 
  Heart, 
  Scissors, 
  AlertTriangle, 
  Users, 
  Activity,
  Pill,
  FileText,
  Download,
  Search,
  Plus,
  X,
  Calendar,
  MapPin,
  Building2,
  ExternalLink,
  Check,
  ChevronRight,
  Shield,
  Sparkles,
  Loader2,
  Zap,
  ListChecks
} from "lucide-react";

// Comprehensive condition pick list (ICD-10 based)
const conditionPickList = [
  { code: "I10", name: "Essential hypertension", category: "Cardiovascular" },
  { code: "E11", name: "Type 2 diabetes mellitus", category: "Endocrine" },
  { code: "E78.5", name: "Hyperlipidemia", category: "Metabolic" },
  { code: "J45", name: "Asthma", category: "Respiratory" },
  { code: "J44", name: "Chronic obstructive pulmonary disease", category: "Respiratory" },
  { code: "I25", name: "Coronary artery disease", category: "Cardiovascular" },
  { code: "I50", name: "Heart failure", category: "Cardiovascular" },
  { code: "I48", name: "Atrial fibrillation", category: "Cardiovascular" },
  { code: "N18", name: "Chronic kidney disease", category: "Renal" },
  { code: "K21", name: "Gastroesophageal reflux disease", category: "Gastrointestinal" },
  { code: "M54.5", name: "Low back pain", category: "Musculoskeletal" },
  { code: "M17", name: "Osteoarthritis of knee", category: "Musculoskeletal" },
  { code: "G43", name: "Migraine", category: "Neurological" },
  { code: "F32", name: "Major depressive disorder", category: "Mental Health" },
  { code: "F41", name: "Anxiety disorder", category: "Mental Health" },
  { code: "G47.33", name: "Obstructive sleep apnea", category: "Sleep" },
  { code: "E66", name: "Obesity", category: "Metabolic" },
  { code: "K58", name: "Irritable bowel syndrome", category: "Gastrointestinal" },
  { code: "L40", name: "Psoriasis", category: "Dermatological" },
  { code: "M06", name: "Rheumatoid arthritis", category: "Musculoskeletal" },
  { code: "E05", name: "Hyperthyroidism", category: "Endocrine" },
  { code: "E03", name: "Hypothyroidism", category: "Endocrine" },
  { code: "D64", name: "Anemia", category: "Hematological" },
  { code: "I73.9", name: "Peripheral vascular disease", category: "Cardiovascular" },
  { code: "G20", name: "Parkinson disease", category: "Neurological" },
  { code: "G30", name: "Alzheimer disease", category: "Neurological" },
  { code: "C50", name: "Breast cancer (history)", category: "Oncology" },
  { code: "C61", name: "Prostate cancer (history)", category: "Oncology" },
  { code: "C18", name: "Colon cancer (history)", category: "Oncology" },
  { code: "N40", name: "Benign prostatic hyperplasia", category: "Urological" },
];

// Surgery pick list
const surgeryPickList = [
  { code: "appendectomy", name: "Appendectomy", category: "Abdominal" },
  { code: "cholecystectomy", name: "Cholecystectomy (gallbladder removal)", category: "Abdominal" },
  { code: "hernia-repair", name: "Hernia repair", category: "Abdominal" },
  { code: "hysterectomy", name: "Hysterectomy", category: "Gynecological" },
  { code: "cesarean", name: "Cesarean section", category: "Gynecological" },
  { code: "tonsillectomy", name: "Tonsillectomy", category: "ENT" },
  { code: "knee-replacement", name: "Total knee replacement", category: "Orthopedic" },
  { code: "hip-replacement", name: "Total hip replacement", category: "Orthopedic" },
  { code: "spinal-fusion", name: "Spinal fusion", category: "Orthopedic" },
  { code: "rotator-cuff", name: "Rotator cuff repair", category: "Orthopedic" },
  { code: "acl-repair", name: "ACL reconstruction", category: "Orthopedic" },
  { code: "cabg", name: "Coronary artery bypass grafting", category: "Cardiac" },
  { code: "angioplasty", name: "Coronary angioplasty/stent", category: "Cardiac" },
  { code: "pacemaker", name: "Pacemaker implantation", category: "Cardiac" },
  { code: "valve-replacement", name: "Heart valve replacement", category: "Cardiac" },
  { code: "mastectomy", name: "Mastectomy", category: "Oncology" },
  { code: "lumpectomy", name: "Lumpectomy", category: "Oncology" },
  { code: "prostatectomy", name: "Prostatectomy", category: "Urological" },
  { code: "colectomy", name: "Colectomy", category: "Abdominal" },
  { code: "thyroidectomy", name: "Thyroidectomy", category: "Endocrine" },
  { code: "cataract", name: "Cataract surgery", category: "Ophthalmology" },
  { code: "lasik", name: "LASIK eye surgery", category: "Ophthalmology" },
  { code: "carpal-tunnel", name: "Carpal tunnel release", category: "Orthopedic" },
  { code: "bariatric", name: "Bariatric surgery", category: "Abdominal" },
];

// Drug allergy pick list
const drugAllergyPickList = [
  { name: "Penicillin", category: "Antibiotic" },
  { name: "Amoxicillin", category: "Antibiotic" },
  { name: "Sulfa drugs (Sulfonamides)", category: "Antibiotic" },
  { name: "Cephalosporins", category: "Antibiotic" },
  { name: "Erythromycin", category: "Antibiotic" },
  { name: "Ciprofloxacin", category: "Antibiotic" },
  { name: "Aspirin", category: "Pain/Anti-inflammatory" },
  { name: "Ibuprofen", category: "Pain/Anti-inflammatory" },
  { name: "Naproxen", category: "Pain/Anti-inflammatory" },
  { name: "Codeine", category: "Opioid" },
  { name: "Morphine", category: "Opioid" },
  { name: "Hydrocodone", category: "Opioid" },
  { name: "Tramadol", category: "Opioid" },
  { name: "Latex", category: "Material" },
  { name: "Contrast dye (iodine)", category: "Diagnostic" },
  { name: "Lidocaine", category: "Anesthetic" },
  { name: "Novocaine", category: "Anesthetic" },
  { name: "ACE inhibitors", category: "Cardiovascular" },
  { name: "Statins", category: "Cardiovascular" },
  { name: "Metformin", category: "Diabetes" },
  { name: "Insulin", category: "Diabetes" },
];

// Food allergy pick list
const foodAllergyPickList = [
  { name: "Peanuts", category: "Nuts/Legumes" },
  { name: "Tree nuts (almonds, walnuts, etc.)", category: "Nuts/Legumes" },
  { name: "Milk/Dairy", category: "Dairy" },
  { name: "Eggs", category: "Animal Products" },
  { name: "Wheat/Gluten", category: "Grains" },
  { name: "Soy", category: "Legumes" },
  { name: "Fish", category: "Seafood" },
  { name: "Shellfish", category: "Seafood" },
  { name: "Sesame", category: "Seeds" },
  { name: "Corn", category: "Grains" },
  { name: "Strawberries", category: "Fruits" },
  { name: "Citrus fruits", category: "Fruits" },
  { name: "Tomatoes", category: "Vegetables" },
  { name: "Mustard", category: "Condiments" },
  { name: "Sulfites", category: "Preservatives" },
];

// Family history conditions for genetic risk
const familyHistoryConditions = [
  { name: "Heart disease", riskCategory: "Cardiovascular", description: "Coronary artery disease, heart attack" },
  { name: "Stroke", riskCategory: "Cardiovascular", description: "Ischemic or hemorrhagic stroke" },
  { name: "High blood pressure", riskCategory: "Cardiovascular", description: "Essential hypertension" },
  { name: "Type 2 diabetes", riskCategory: "Metabolic", description: "Adult-onset diabetes" },
  { name: "Type 1 diabetes", riskCategory: "Metabolic", description: "Juvenile diabetes" },
  { name: "Breast cancer", riskCategory: "Oncology", description: "BRCA1/BRCA2 related" },
  { name: "Ovarian cancer", riskCategory: "Oncology", description: "BRCA1/BRCA2 related" },
  { name: "Colon cancer", riskCategory: "Oncology", description: "Lynch syndrome, FAP" },
  { name: "Prostate cancer", riskCategory: "Oncology", description: "Hereditary prostate cancer" },
  { name: "Lung cancer", riskCategory: "Oncology", description: "Familial lung cancer" },
  { name: "Melanoma", riskCategory: "Oncology", description: "Familial melanoma" },
  { name: "Alzheimer disease", riskCategory: "Neurological", description: "Early or late onset" },
  { name: "Parkinson disease", riskCategory: "Neurological", description: "Familial Parkinson" },
  { name: "Huntington disease", riskCategory: "Neurological", description: "Genetic movement disorder" },
  { name: "Sickle cell disease", riskCategory: "Hematological", description: "Hemoglobin disorder" },
  { name: "Hemophilia", riskCategory: "Hematological", description: "Bleeding disorder" },
  { name: "Cystic fibrosis", riskCategory: "Pulmonary", description: "CFTR gene mutation" },
  { name: "Muscular dystrophy", riskCategory: "Neuromuscular", description: "Progressive muscle weakness" },
  { name: "Polycystic kidney disease", riskCategory: "Renal", description: "PKD1/PKD2 related" },
  { name: "Hyperlipidemia", riskCategory: "Metabolic", description: "Familial hypercholesterolemia" },
  { name: "Thyroid disease", riskCategory: "Endocrine", description: "Hypo/hyperthyroidism" },
  { name: "Rheumatoid arthritis", riskCategory: "Autoimmune", description: "Inflammatory arthritis" },
  { name: "Lupus", riskCategory: "Autoimmune", description: "Systemic lupus erythematosus" },
  { name: "Celiac disease", riskCategory: "Autoimmune", description: "Gluten intolerance" },
  { name: "Mental health disorder", riskCategory: "Psychiatric", description: "Depression, bipolar, schizophrenia" },
  { name: "Substance use disorder", riskCategory: "Psychiatric", description: "Alcoholism, addiction" },
];

// Common medications pick list
const medicationPickList = [
  { name: "Lisinopril", category: "Blood Pressure", strengths: ["2.5mg", "5mg", "10mg", "20mg", "40mg"] },
  { name: "Metoprolol", category: "Blood Pressure", strengths: ["25mg", "50mg", "100mg", "200mg"] },
  { name: "Amlodipine", category: "Blood Pressure", strengths: ["2.5mg", "5mg", "10mg"] },
  { name: "Losartan", category: "Blood Pressure", strengths: ["25mg", "50mg", "100mg"] },
  { name: "Metformin", category: "Diabetes", strengths: ["500mg", "850mg", "1000mg"] },
  { name: "Glipizide", category: "Diabetes", strengths: ["5mg", "10mg"] },
  { name: "Atorvastatin", category: "Cholesterol", strengths: ["10mg", "20mg", "40mg", "80mg"] },
  { name: "Simvastatin", category: "Cholesterol", strengths: ["5mg", "10mg", "20mg", "40mg"] },
  { name: "Rosuvastatin", category: "Cholesterol", strengths: ["5mg", "10mg", "20mg", "40mg"] },
  { name: "Omeprazole", category: "Gastrointestinal", strengths: ["10mg", "20mg", "40mg"] },
  { name: "Pantoprazole", category: "Gastrointestinal", strengths: ["20mg", "40mg"] },
  { name: "Levothyroxine", category: "Thyroid", strengths: ["25mcg", "50mcg", "75mcg", "100mcg", "125mcg", "150mcg"] },
  { name: "Gabapentin", category: "Neurological", strengths: ["100mg", "300mg", "400mg", "600mg", "800mg"] },
  { name: "Sertraline", category: "Mental Health", strengths: ["25mg", "50mg", "100mg"] },
  { name: "Escitalopram", category: "Mental Health", strengths: ["5mg", "10mg", "20mg"] },
  { name: "Fluoxetine", category: "Mental Health", strengths: ["10mg", "20mg", "40mg"] },
  { name: "Alprazolam", category: "Mental Health", strengths: ["0.25mg", "0.5mg", "1mg", "2mg"] },
  { name: "Prednisone", category: "Anti-inflammatory", strengths: ["1mg", "2.5mg", "5mg", "10mg", "20mg", "50mg"] },
  { name: "Albuterol inhaler", category: "Respiratory", strengths: ["90mcg/actuation"] },
  { name: "Fluticasone inhaler", category: "Respiratory", strengths: ["44mcg", "110mcg", "220mcg"] },
  { name: "Montelukast", category: "Respiratory", strengths: ["4mg", "5mg", "10mg"] },
  { name: "Warfarin", category: "Blood Thinner", strengths: ["1mg", "2mg", "2.5mg", "3mg", "4mg", "5mg", "6mg", "7.5mg", "10mg"] },
  { name: "Aspirin", category: "Blood Thinner", strengths: ["81mg", "325mg"] },
  { name: "Clopidogrel", category: "Blood Thinner", strengths: ["75mg"] },
  { name: "Hydrochlorothiazide", category: "Diuretic", strengths: ["12.5mg", "25mg", "50mg"] },
  { name: "Furosemide", category: "Diuretic", strengths: ["20mg", "40mg", "80mg"] },
];

// SDOH resources by category
const sdohResources = [
  { category: "Food Security", name: "SNAP Benefits", description: "Supplemental Nutrition Assistance Program", url: "https://www.fns.usda.gov/snap" },
  { category: "Food Security", name: "Local Food Banks", description: "Find food banks in your area", url: "https://www.feedingamerica.org/find-your-local-foodbank" },
  { category: "Housing", name: "HUD Housing Assistance", description: "Rental assistance programs", url: "https://www.hud.gov/topics/rental_assistance" },
  { category: "Housing", name: "211 Housing Resources", description: "Local housing support", url: "https://www.211.org" },
  { category: "Transportation", name: "Medicaid Transportation", description: "Non-emergency medical transportation", url: "" },
  { category: "Transportation", name: "Public Transit", description: "Local public transportation options", url: "" },
  { category: "Utilities", name: "LIHEAP", description: "Low Income Home Energy Assistance", url: "https://www.acf.hhs.gov/ocs/programs/liheap" },
  { category: "Employment", name: "CareerOneStop", description: "Job search and training resources", url: "https://www.careeronestop.org" },
  { category: "Healthcare", name: "Community Health Centers", description: "Federally Qualified Health Centers", url: "https://findahealthcenter.hrsa.gov" },
  { category: "Mental Health", name: "SAMHSA Helpline", description: "Substance Abuse and Mental Health", url: "https://www.samhsa.gov/find-help/national-helpline" },
];

type SelectedCondition = {
  code: string;
  name: string;
  category: string;
  diagnosedYear?: string;
  status: "active" | "resolved" | "managed";
};

type SelectedSurgery = {
  code: string;
  name: string;
  category: string;
  year: string;
  hospital?: string;
};

type SelectedAllergy = {
  name: string;
  category: string;
  type: "drug" | "food";
  severity: "mild" | "moderate" | "severe";
  reaction?: string;
};

type FamilyMember = {
  relation: string;
  conditions: string[];
  ageAtDiagnosis?: Record<string, string>;
  deceased?: boolean;
  ageAtDeath?: string;
};

type SocialHistory = {
  smokingStatus: string;
  smokingYears?: string;
  packsPerDay?: string;
  quitYear?: string;
  vapingStatus: string;
  chewingStatus: string;
  alcoholStatus: string;
  drinksPerWeek?: string;
  exerciseFrequency: string;
  occupation?: string;
  educationLevel?: string;
  housingStatus?: string;
  foodSecurity?: string;
  transportationAccess?: string;
};

type SelectedMedication = {
  name: string;
  category: string;
  strength: string;
  frequency: string;
  pharmacy?: string;
};

export default function PatientHistoryBuilder() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState("conditions");
  const [searchTerm, setSearchTerm] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Form state
  const [selectedConditions, setSelectedConditions] = useState<SelectedCondition[]>([]);
  const [selectedSurgeries, setSelectedSurgeries] = useState<SelectedSurgery[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<SelectedAllergy[]>([]);
  const [familyHistory, setFamilyHistory] = useState<FamilyMember[]>([]);
  const [socialHistory, setSocialHistory] = useState<SocialHistory>({
    smokingStatus: "",
    vapingStatus: "",
    chewingStatus: "",
    alcoholStatus: "",
    exerciseFrequency: "",
  });
  const [selectedMedications, setSelectedMedications] = useState<SelectedMedication[]>([]);
  const [pharmacies, setPharmacies] = useState<Array<{name: string; address: string; phone: string}>>([]);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"pdf" | "fhir">("pdf");
  const [aiLoading, setAiLoading] = useState(false);
  const [showPertinentPositives, setShowPertinentPositives] = useState(false);
  const [pertinentPositives, setPertinentPositives] = useState<{
    conditions: string[];
    allergies: string[];
    medications: string[];
    familyRisks: string[];
    socialFactors: string[];
    summary: string;
  } | null>(null);

  // Calculate completion progress
  const sections = [
    { id: "conditions", name: "Medical History", complete: selectedConditions.length > 0 },
    { id: "surgeries", name: "Surgeries", complete: selectedSurgeries.length > 0 },
    { id: "allergies", name: "Allergies", complete: selectedAllergies.length > 0 },
    { id: "family", name: "Family History", complete: familyHistory.length > 0 },
    { id: "social", name: "Social History", complete: socialHistory.smokingStatus !== "" },
    { id: "medications", name: "Medications", complete: selectedMedications.length > 0 },
  ];
  
  const completedSections = sections.filter(s => s.complete).length;
  const progressPercent = Math.round((completedSections / sections.length) * 100);

  const handleAddCondition = (condition: typeof conditionPickList[0]) => {
    if (!selectedConditions.find(c => c.code === condition.code)) {
      setSelectedConditions([...selectedConditions, {
        ...condition,
        status: "active",
        diagnosedYear: new Date().getFullYear().toString()
      }]);
    }
  };

  const handleRemoveCondition = (code: string) => {
    setSelectedConditions(selectedConditions.filter(c => c.code !== code));
  };

  const handleAddSurgery = (surgery: typeof surgeryPickList[0]) => {
    if (!selectedSurgeries.find(s => s.code === surgery.code)) {
      setSelectedSurgeries([...selectedSurgeries, {
        ...surgery,
        year: ""
      }]);
    }
  };

  const handleRemoveSurgery = (code: string) => {
    setSelectedSurgeries(selectedSurgeries.filter(s => s.code !== code));
  };

  const handleAddAllergy = (allergy: { name: string; category: string }, type: "drug" | "food") => {
    if (!selectedAllergies.find(a => a.name === allergy.name)) {
      setSelectedAllergies([...selectedAllergies, {
        ...allergy,
        type,
        severity: "moderate"
      }]);
    }
  };

  const handleRemoveAllergy = (name: string) => {
    setSelectedAllergies(selectedAllergies.filter(a => a.name !== name));
  };

  const handleAddFamilyMember = (relation: string) => {
    if (!familyHistory.find(f => f.relation === relation)) {
      setFamilyHistory([...familyHistory, { relation, conditions: [] }]);
    }
  };

  const handleToggleFamilyCondition = (relation: string, condition: string) => {
    setFamilyHistory(familyHistory.map(f => {
      if (f.relation === relation) {
        const hasCondition = f.conditions.includes(condition);
        return {
          ...f,
          conditions: hasCondition 
            ? f.conditions.filter(c => c !== condition)
            : [...f.conditions, condition]
        };
      }
      return f;
    }));
  };

  const handleAddMedication = (med: typeof medicationPickList[0]) => {
    if (!selectedMedications.find(m => m.name === med.name)) {
      setSelectedMedications([...selectedMedications, {
        name: med.name,
        category: med.category,
        strength: med.strengths[0],
        frequency: "Once daily"
      }]);
    }
  };

  const handleRemoveMedication = (name: string) => {
    setSelectedMedications(selectedMedications.filter(m => m.name !== name));
  };

  // AI prepopulation from health records
  const handleAIPrepopulate = async () => {
    setAiLoading(true);
    try {
      const response = await fetch("/api/patient-history/ai-prepopulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: "current" }),
      });
      
      if (!response.ok) throw new Error("AI analysis failed");
      
      const data = await response.json();
      
      // Populate conditions (deduplicated)
      if (data.conditions && data.conditions.length > 0) {
        const newConditions: SelectedCondition[] = data.conditions
          .filter((c: any) => !selectedConditions.find(sc => sc.code === c.code))
          .map((c: any) => ({
            code: c.code,
            name: c.name,
            category: c.category,
            status: c.status || "active",
            diagnosedYear: c.diagnosedYear,
          }));
        setSelectedConditions([...selectedConditions, ...newConditions]);
      }
      
      // Populate surgeries (deduplicated)
      if (data.surgeries && data.surgeries.length > 0) {
        const newSurgeries: SelectedSurgery[] = data.surgeries
          .filter((s: any) => !selectedSurgeries.find(ss => ss.code === s.code))
          .map((s: any) => ({
            code: s.code,
            name: s.name,
            category: s.category,
            year: s.year || "",
          }));
        setSelectedSurgeries([...selectedSurgeries, ...newSurgeries]);
      }
      
      // Populate allergies (deduplicated)
      if (data.allergies && data.allergies.length > 0) {
        const newAllergies: SelectedAllergy[] = data.allergies
          .filter((a: any) => !selectedAllergies.find(sa => sa.name === a.name))
          .map((a: any) => ({
            name: a.name,
            category: a.category,
            type: a.type as "drug" | "food",
            severity: a.severity as "mild" | "moderate" | "severe",
          }));
        setSelectedAllergies([...selectedAllergies, ...newAllergies]);
      }
      
      // Populate medications (deduplicated)
      if (data.medications && data.medications.length > 0) {
        const newMeds: SelectedMedication[] = data.medications
          .filter((m: any) => !selectedMedications.find(sm => sm.name === m.name))
          .map((m: any) => ({
            name: m.name,
            category: m.category,
            strength: m.strength,
            frequency: m.frequency,
          }));
        setSelectedMedications([...selectedMedications, ...newMeds]);
      }
      
      // Populate family history
      if (data.familyHistory && data.familyHistory.length > 0) {
        const newFamily: FamilyMember[] = data.familyHistory
          .filter((f: any) => !familyHistory.find(fh => fh.relation === f.relation))
          .map((f: any) => ({
            relation: f.relation,
            conditions: f.conditions || [],
          }));
        setFamilyHistory([...familyHistory, ...newFamily]);
      }
      
      // Populate social history
      if (data.socialHistory) {
        setSocialHistory(prev => ({
          ...prev,
          ...data.socialHistory,
        }));
      }
      
      // Store pertinent positives
      if (data.pertinentPositives) {
        setPertinentPositives(data.pertinentPositives);
        setShowPertinentPositives(true);
      }
      
      toast({ 
        title: "Records Loaded",
        description: `Data shows ${data.conditions?.length || 0} conditions, ${data.medications?.length || 0} medications from your health records`
      });
    } catch (error) {
      toast({ 
        title: "Loading failed",
        description: "Could not load health records",
        variant: "destructive"
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleLookupPharmacies = async () => {
    if (!zipCode || zipCode.length !== 5) {
      toast({ title: "Enter a valid 5-digit ZIP code", variant: "destructive" });
      return;
    }
    
    try {
      const response = await fetch(`/api/patient-history/pharmacies?zip=${zipCode}`);
      if (!response.ok) throw new Error("Failed to lookup pharmacies");
      const data = await response.json();
      setPharmacies(data.pharmacies);
    } catch (error) {
      toast({ title: "Could not load pharmacies", variant: "destructive" });
    }
  };

  const handleExport = async (format: "pdf" | "fhir") => {
    setExporting(true);
    setExportFormat(format);
    
    try {
      const historyData = {
        conditions: selectedConditions,
        surgeries: selectedSurgeries,
        allergies: selectedAllergies,
        familyHistory,
        socialHistory,
        medications: selectedMedications,
      };
      
      const endpoint = format === "pdf" 
        ? "/api/patient-history/export/pdf"
        : "/api/patient-history/export/fhir";
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyData),
      });
      
      if (!response.ok) throw new Error("Export failed");
      
      if (format === "pdf") {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "patient-history.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "PDF Downloaded", description: "Patient history saved to downloads" });
      } else {
        const fhirData = await response.json();
        const blob = new Blob([JSON.stringify(fhirData, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "questionnaire-response.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast({ title: "FHIR Export Complete", description: "QuestionnaireResponse saved" });
      }
    } catch (error) {
      toast({ title: "Export failed", description: "Could not export history", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const filteredConditions = conditionPickList.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSurgeries = surgeryPickList.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDrugAllergies = drugAllergyPickList.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFoodAllergies = foodAllergyPickList.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMedications = medicationPickList.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Patient-Reported History Builder
          </h1>
          <p className="text-muted-foreground">
            Complete your health history with structured data for providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => handleExport("fhir")}
            disabled={exporting}
            data-testid="button-export-fhir"
          >
            <FileText className="h-4 w-4 mr-2" />
            FHIR Export
          </Button>
          <Button 
            onClick={() => handleExport("pdf")}
            disabled={exporting}
            data-testid="button-export-pdf"
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-orange-500 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-orange-700 dark:text-orange-400">Patient-Reported History</h4>
            <p className="text-sm text-muted-foreground">
              This form shows your self-reported health history. Data refers to what you provide 
              and states your health information in structured format. Not for diagnostic purposes.
            </p>
          </div>
          <Button 
            onClick={handleAIPrepopulate}
            disabled={aiLoading}
            data-testid="button-ai-prepopulate"
          >
            {aiLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Import from Health Records
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Pertinent Positives Summary */}
      {showPertinentPositives && pertinentPositives && (
        <Card className="p-4 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Pertinent Positives Summary</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowPertinentPositives(false)}
              data-testid="button-close-pertinent"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4">{pertinentPositives.summary}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pertinentPositives.conditions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Active Conditions</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pertinentPositives.conditions.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {pertinentPositives.allergies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Allergies</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pertinentPositives.allergies.map((a, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {pertinentPositives.medications.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Current Medications</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pertinentPositives.medications.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{m}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {pertinentPositives.familyRisks.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Family Risk Factors</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pertinentPositives.familyRisks.map((r, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
            
            {pertinentPositives.socialFactors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Social Factors</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {pertinentPositives.socialFactors.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Progress indicator */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Completion Progress</span>
          <span className="text-sm text-muted-foreground">{completedSections} of {sections.length} sections</span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <div className="flex gap-2 mt-3 flex-wrap">
          {sections.map((section) => (
            <Badge 
              key={section.id}
              variant={section.complete ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setActiveSection(section.id)}
              data-testid={`badge-section-${section.id}`}
            >
              {section.complete && <Check className="h-3 w-3 mr-1" />}
              {section.name}
            </Badge>
          ))}
        </div>
      </Card>

      <Tabs value={activeSection} onValueChange={setActiveSection}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="conditions" data-testid="tab-conditions">
            <Heart className="h-4 w-4 mr-2" />
            Medical
          </TabsTrigger>
          <TabsTrigger value="surgeries" data-testid="tab-surgeries">
            <Scissors className="h-4 w-4 mr-2" />
            Surgeries
          </TabsTrigger>
          <TabsTrigger value="allergies" data-testid="tab-allergies">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Allergies
          </TabsTrigger>
          <TabsTrigger value="family" data-testid="tab-family">
            <Users className="h-4 w-4 mr-2" />
            Family
          </TabsTrigger>
          <TabsTrigger value="social" data-testid="tab-social">
            <Activity className="h-4 w-4 mr-2" />
            Social
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Medications
          </TabsTrigger>
        </TabsList>

        {/* Past Medical History */}
        <TabsContent value="conditions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Past Medical History
              </CardTitle>
              <CardDescription>
                Select conditions from the list or search by name or code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conditions by name, ICD code, or category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-conditions"
                />
              </div>

              {/* Selected conditions */}
              {selectedConditions.length > 0 && (
                <div className="space-y-2">
                  <Label>Your Selected Conditions</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedConditions.map((condition) => (
                      <Badge key={condition.code} variant="secondary" className="py-1.5 px-3">
                        <span className="font-mono text-xs mr-2">{condition.code}</span>
                        {condition.name}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-2 hover:bg-transparent"
                          onClick={() => handleRemoveCondition(condition.code)}
                          data-testid={`button-remove-condition-${condition.code}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Condition pick list */}
              <ScrollArea className="h-80">
                <div className="space-y-1">
                  {filteredConditions.map((condition) => {
                    const isSelected = selectedConditions.some(c => c.code === condition.code);
                    return (
                      <div
                        key={condition.code}
                        className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover-elevate ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                        onClick={() => !isSelected && handleAddCondition(condition)}
                        data-testid={`condition-item-${condition.code}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">{condition.code}</span>
                              <span className="font-medium">{condition.name}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{condition.category}</span>
                          </div>
                        </div>
                        {!isSelected && <Plus className="h-4 w-4 text-muted-foreground" />}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Surgeries */}
        <TabsContent value="surgeries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="h-5 w-5" />
                Surgical History
              </CardTitle>
              <CardDescription>
                Select past surgeries and add approximate dates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search surgeries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-surgeries"
                />
              </div>

              {/* Selected surgeries with timeline */}
              {selectedSurgeries.length > 0 && (
                <div className="space-y-3">
                  <Label>Your Surgical History</Label>
                  {selectedSurgeries.map((surgery) => (
                    <Card key={surgery.code} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{surgery.name}</div>
                          <div className="text-sm text-muted-foreground">{surgery.category}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <Input
                              type="number"
                              placeholder="Year"
                              className="w-24"
                              value={surgery.year}
                              onChange={(e) => {
                                setSelectedSurgeries(selectedSurgeries.map(s =>
                                  s.code === surgery.code ? { ...s, year: e.target.value } : s
                                ));
                              }}
                              data-testid={`input-surgery-year-${surgery.code}`}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSurgery(surgery.code)}
                            data-testid={`button-remove-surgery-${surgery.code}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Separator />

              <ScrollArea className="h-72">
                <div className="space-y-1">
                  {filteredSurgeries.map((surgery) => {
                    const isSelected = selectedSurgeries.some(s => s.code === surgery.code);
                    return (
                      <div
                        key={surgery.code}
                        className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover-elevate ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                        onClick={() => !isSelected && handleAddSurgery(surgery)}
                        data-testid={`surgery-item-${surgery.code}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div>
                            <div className="font-medium">{surgery.name}</div>
                            <span className="text-xs text-muted-foreground">{surgery.category}</span>
                          </div>
                        </div>
                        {!isSelected && <Plus className="h-4 w-4 text-muted-foreground" />}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Allergies */}
        <TabsContent value="allergies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Allergies
              </CardTitle>
              <CardDescription>
                Select drug and food allergies with severity levels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search allergies..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-allergies"
                />
              </div>

              {/* Selected allergies */}
              {selectedAllergies.length > 0 && (
                <div className="space-y-3">
                  <Label>Your Allergies</Label>
                  {selectedAllergies.map((allergy) => (
                    <Card key={allergy.name} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant={allergy.type === "drug" ? "destructive" : "secondary"}>
                            {allergy.type === "drug" ? "Drug" : "Food"}
                          </Badge>
                          <div>
                            <div className="font-medium">{allergy.name}</div>
                            <div className="text-sm text-muted-foreground">{allergy.category}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Select
                            value={allergy.severity}
                            onValueChange={(value) => {
                              setSelectedAllergies(selectedAllergies.map(a =>
                                a.name === allergy.name ? { ...a, severity: value as any } : a
                              ));
                            }}
                          >
                            <SelectTrigger className="w-28" data-testid={`select-severity-${allergy.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mild">Mild</SelectItem>
                              <SelectItem value="moderate">Moderate</SelectItem>
                              <SelectItem value="severe">Severe</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAllergy(allergy.name)}
                            data-testid={`button-remove-allergy-${allergy.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Separator />

              <Tabs defaultValue="drugs">
                <TabsList>
                  <TabsTrigger value="drugs">Drug Allergies</TabsTrigger>
                  <TabsTrigger value="food">Food Allergies</TabsTrigger>
                </TabsList>
                <TabsContent value="drugs">
                  <ScrollArea className="h-56">
                    <div className="space-y-1 pt-2">
                      {filteredDrugAllergies.map((allergy) => {
                        const isSelected = selectedAllergies.some(a => a.name === allergy.name);
                        return (
                          <div
                            key={allergy.name}
                            className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover-elevate ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                            onClick={() => !isSelected && handleAddAllergy(allergy, "drug")}
                            data-testid={`drug-allergy-${allergy.name}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isSelected} />
                              <div>
                                <div className="font-medium">{allergy.name}</div>
                                <span className="text-xs text-muted-foreground">{allergy.category}</span>
                              </div>
                            </div>
                            {!isSelected && <Plus className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
                <TabsContent value="food">
                  <ScrollArea className="h-56">
                    <div className="space-y-1 pt-2">
                      {filteredFoodAllergies.map((allergy) => {
                        const isSelected = selectedAllergies.some(a => a.name === allergy.name);
                        return (
                          <div
                            key={allergy.name}
                            className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover-elevate ${
                              isSelected ? "bg-primary/10" : ""
                            }`}
                            onClick={() => !isSelected && handleAddAllergy(allergy, "food")}
                            data-testid={`food-allergy-${allergy.name}`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox checked={isSelected} />
                              <div>
                                <div className="font-medium">{allergy.name}</div>
                                <span className="text-xs text-muted-foreground">{allergy.category}</span>
                              </div>
                            </div>
                            {!isSelected && <Plus className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Family History */}
        <TabsContent value="family" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Family Medical History
              </CardTitle>
              <CardDescription>
                Select conditions that run in your family for genetic risk assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {["Mother", "Father", "Maternal Grandmother", "Maternal Grandfather", "Paternal Grandmother", "Paternal Grandfather", "Sibling"].map((relation) => (
                  <Button
                    key={relation}
                    variant={familyHistory.some(f => f.relation === relation) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleAddFamilyMember(relation)}
                    data-testid={`button-add-${relation.toLowerCase().replace(/ /g, "-")}`}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {relation}
                  </Button>
                ))}
              </div>

              {familyHistory.length > 0 && (
                <div className="space-y-4">
                  {familyHistory.map((member) => (
                    <Card key={member.relation} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{member.relation}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFamilyHistory(familyHistory.filter(f => f.relation !== member.relation))}
                          data-testid={`button-remove-family-${member.relation}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {familyHistoryConditions.map((condition) => (
                          <div
                            key={condition.name}
                            className={`flex items-center gap-2 p-2 rounded-md cursor-pointer hover-elevate ${
                              member.conditions.includes(condition.name) ? "bg-primary/10" : ""
                            }`}
                            onClick={() => handleToggleFamilyCondition(member.relation, condition.name)}
                            data-testid={`family-condition-${member.relation}-${condition.name}`}
                          >
                            <Checkbox checked={member.conditions.includes(condition.name)} />
                            <span className="text-sm">{condition.name}</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {familyHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Click a family member above to add their health history
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social History */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Social History
              </CardTitle>
              <CardDescription>
                Lifestyle factors and social determinants of health
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tobacco Use */}
              <div className="space-y-4">
                <h4 className="font-medium">Tobacco Use</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Smoking Status</Label>
                    <Select
                      value={socialHistory.smokingStatus}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, smokingStatus: value })}
                    >
                      <SelectTrigger data-testid="select-smoking-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never smoked</SelectItem>
                        <SelectItem value="former">Former smoker</SelectItem>
                        <SelectItem value="current">Current smoker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Vaping Status</Label>
                    <Select
                      value={socialHistory.vapingStatus}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, vapingStatus: value })}
                    >
                      <SelectTrigger data-testid="select-vaping-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="former">Former</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Chewing Tobacco</Label>
                    <Select
                      value={socialHistory.chewingStatus}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, chewingStatus: value })}
                    >
                      <SelectTrigger data-testid="select-chewing-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="former">Former</SelectItem>
                        <SelectItem value="current">Current</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(socialHistory.smokingStatus === "current" || socialHistory.smokingStatus === "former") && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
                    <div className="space-y-2">
                      <Label>Packs per Day</Label>
                      <Input
                        placeholder="e.g., 1"
                        value={socialHistory.packsPerDay || ""}
                        onChange={(e) => setSocialHistory({ ...socialHistory, packsPerDay: e.target.value })}
                        data-testid="input-packs-per-day"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Years Smoked</Label>
                      <Input
                        placeholder="e.g., 10"
                        value={socialHistory.smokingYears || ""}
                        onChange={(e) => setSocialHistory({ ...socialHistory, smokingYears: e.target.value })}
                        data-testid="input-smoking-years"
                      />
                    </div>
                    {socialHistory.smokingStatus === "former" && (
                      <div className="space-y-2">
                        <Label>Year Quit</Label>
                        <Input
                          placeholder="e.g., 2020"
                          value={socialHistory.quitYear || ""}
                          onChange={(e) => setSocialHistory({ ...socialHistory, quitYear: e.target.value })}
                          data-testid="input-quit-year"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Alcohol Use */}
              <div className="space-y-4">
                <h4 className="font-medium">Alcohol Use</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Alcohol Status</Label>
                    <Select
                      value={socialHistory.alcoholStatus}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, alcoholStatus: value })}
                    >
                      <SelectTrigger data-testid="select-alcohol-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never drinks</SelectItem>
                        <SelectItem value="occasional">Occasional (less than weekly)</SelectItem>
                        <SelectItem value="moderate">Moderate (1-2 drinks/day)</SelectItem>
                        <SelectItem value="heavy">Heavy (more than 2 drinks/day)</SelectItem>
                        <SelectItem value="former">Former drinker</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {socialHistory.alcoholStatus && socialHistory.alcoholStatus !== "never" && socialHistory.alcoholStatus !== "former" && (
                    <div className="space-y-2">
                      <Label>Drinks per Week</Label>
                      <Input
                        placeholder="e.g., 7"
                        value={socialHistory.drinksPerWeek || ""}
                        onChange={(e) => setSocialHistory({ ...socialHistory, drinksPerWeek: e.target.value })}
                        data-testid="input-drinks-per-week"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Exercise */}
              <div className="space-y-4">
                <h4 className="font-medium">Physical Activity</h4>
                <div className="space-y-2">
                  <Label>Exercise Frequency</Label>
                  <Select
                    value={socialHistory.exerciseFrequency}
                    onValueChange={(value) => setSocialHistory({ ...socialHistory, exerciseFrequency: value })}
                  >
                    <SelectTrigger data-testid="select-exercise-frequency">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No regular exercise</SelectItem>
                      <SelectItem value="light">Light (1-2 days/week)</SelectItem>
                      <SelectItem value="moderate">Moderate (3-4 days/week)</SelectItem>
                      <SelectItem value="active">Active (5+ days/week)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* SDOH */}
              <div className="space-y-4">
                <h4 className="font-medium">Social Determinants of Health</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Housing Status</Label>
                    <Select
                      value={socialHistory.housingStatus || ""}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, housingStatus: value })}
                    >
                      <SelectTrigger data-testid="select-housing-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owned">Own home</SelectItem>
                        <SelectItem value="rented">Rent</SelectItem>
                        <SelectItem value="family">Living with family</SelectItem>
                        <SelectItem value="temporary">Temporary housing</SelectItem>
                        <SelectItem value="homeless">Experiencing homelessness</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Food Security</Label>
                    <Select
                      value={socialHistory.foodSecurity || ""}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, foodSecurity: value })}
                    >
                      <SelectTrigger data-testid="select-food-security">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="secure">Always have enough food</SelectItem>
                        <SelectItem value="sometimes">Sometimes worried about food</SelectItem>
                        <SelectItem value="often">Often don't have enough food</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transportation Access</Label>
                    <Select
                      value={socialHistory.transportationAccess || ""}
                      onValueChange={(value) => setSocialHistory({ ...socialHistory, transportationAccess: value })}
                    >
                      <SelectTrigger data-testid="select-transportation">
                        <SelectValue placeholder="Select access" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="own-vehicle">Own vehicle</SelectItem>
                        <SelectItem value="public">Public transportation</SelectItem>
                        <SelectItem value="rideshare">Rideshare/family</SelectItem>
                        <SelectItem value="limited">Limited access</SelectItem>
                        <SelectItem value="none">No reliable transportation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* ZIP-based resources */}
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-3 mb-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <div>
                      <h5 className="font-medium">Community Resources</h5>
                      <p className="text-sm text-muted-foreground">Enter your ZIP code to find local resources</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="ZIP Code"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      maxLength={5}
                      className="w-32"
                      data-testid="input-zip-code"
                    />
                    <Button variant="outline" onClick={handleLookupPharmacies} data-testid="button-find-resources">
                      Find Resources
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    {sdohResources.map((resource) => (
                      <a
                        key={resource.name}
                        href={resource.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-md bg-background hover-elevate"
                        data-testid={`resource-${resource.name}`}
                      >
                        <div>
                          <div className="text-sm font-medium">{resource.name}</div>
                          <div className="text-xs text-muted-foreground">{resource.category}</div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medications */}
        <TabsContent value="medications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Current Medications
              </CardTitle>
              <CardDescription>
                Add your active medications with dosing and pharmacy information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search medications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-medications"
                />
              </div>

              {/* Pharmacy lookup */}
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <h5 className="font-medium">Your Pharmacy</h5>
                    <p className="text-sm text-muted-foreground">Find pharmacies by ZIP code</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="ZIP Code"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    maxLength={5}
                    className="w-32"
                    data-testid="input-pharmacy-zip"
                  />
                  <Button variant="outline" onClick={handleLookupPharmacies} data-testid="button-lookup-pharmacies">
                    <Search className="h-4 w-4 mr-2" />
                    Find Pharmacies
                  </Button>
                </div>
                
                {pharmacies.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                    {pharmacies.map((pharmacy, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-md bg-background cursor-pointer hover-elevate"
                        data-testid={`pharmacy-${idx}`}
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm font-medium">{pharmacy.name}</div>
                          <div className="text-xs text-muted-foreground">{pharmacy.address}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Selected medications */}
              {selectedMedications.length > 0 && (
                <div className="space-y-3">
                  <Label>Your Medications</Label>
                  {selectedMedications.map((med) => (
                    <Card key={med.name} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="font-medium">{med.name}</div>
                          <div className="text-sm text-muted-foreground">{med.category}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={med.strength}
                            onValueChange={(value) => {
                              setSelectedMedications(selectedMedications.map(m =>
                                m.name === med.name ? { ...m, strength: value } : m
                              ));
                            }}
                          >
                            <SelectTrigger className="w-24" data-testid={`select-strength-${med.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {medicationPickList.find(m => m.name === med.name)?.strengths.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={med.frequency}
                            onValueChange={(value) => {
                              setSelectedMedications(selectedMedications.map(m =>
                                m.name === med.name ? { ...m, frequency: value } : m
                              ));
                            }}
                          >
                            <SelectTrigger className="w-36" data-testid={`select-frequency-${med.name}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Once daily">Once daily</SelectItem>
                              <SelectItem value="Twice daily">Twice daily</SelectItem>
                              <SelectItem value="Three times daily">Three times daily</SelectItem>
                              <SelectItem value="Four times daily">Four times daily</SelectItem>
                              <SelectItem value="Every morning">Every morning</SelectItem>
                              <SelectItem value="At bedtime">At bedtime</SelectItem>
                              <SelectItem value="As needed">As needed</SelectItem>
                              <SelectItem value="Weekly">Weekly</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMedication(med.name)}
                            data-testid={`button-remove-med-${med.name}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <Separator />

              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {filteredMedications.map((med) => {
                    const isSelected = selectedMedications.some(m => m.name === med.name);
                    return (
                      <div
                        key={med.name}
                        className={`flex items-center justify-between p-3 rounded-md cursor-pointer hover-elevate ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                        onClick={() => !isSelected && handleAddMedication(med)}
                        data-testid={`medication-item-${med.name}`}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} />
                          <div>
                            <div className="font-medium">{med.name}</div>
                            <span className="text-xs text-muted-foreground">{med.category}</span>
                          </div>
                        </div>
                        {!isSelected && <Plus className="h-4 w-4 text-muted-foreground" />}
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Export summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Ready to Export</h3>
            <p className="text-sm text-muted-foreground">
              {selectedConditions.length} conditions, {selectedSurgeries.length} surgeries, 
              {" "}{selectedAllergies.length} allergies, {selectedMedications.length} medications, 
              {" "}{familyHistory.length} family members
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => handleExport("fhir")}
              disabled={exporting}
              data-testid="button-export-fhir-bottom"
            >
              {exporting && exportFormat === "fhir" ? (
                <>Exporting...</>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  FHIR QuestionnaireResponse
                </>
              )}
            </Button>
            <Button 
              onClick={() => handleExport("pdf")}
              disabled={exporting}
              data-testid="button-export-pdf-bottom"
            >
              {exporting && exportFormat === "pdf" ? (
                <>Exporting...</>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
