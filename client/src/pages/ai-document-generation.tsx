import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  FileText,
  Sparkles,
  Send,
  Save,
  Check,
  X,
  AlertTriangle,
  Shield,
  Clock,
  Edit,
  Trash2,
  ChevronRight,
  FileCheck,
  FilePlus,
  Stethoscope,
  ClipboardList,
  Users,
  Activity,
  Heart,
  Pill,
  RefreshCw,
  Eye,
  Copy,
  Download,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Zap,
  Bell,
  Play,
  Settings,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  ArrowRight,
} from "lucide-react";

interface DocumentType {
  id: string;
  name: string;
  description: string;
  category: "clinical" | "administrative" | "patient-facing";
  requiredFields: string[];
  optionalFields: string[];
  clinicalStandard?: string;
  fieldHints?: Record<string, string>;
}

interface GeneratedDocument {
  id: string;
  documentTypeId: string;
  documentTypeName: string;
  userId: string;
  patientId?: string;
  patientName?: string;
  title: string;
  content: string;
  status: "draft" | "reviewed" | "finalized" | "discarded";
  complianceFlags: string[];
  clinicalStandard?: string;
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  eventType: string;
  eventFilters: Record<string, string>;
  targetDocumentTypeId: string;
  contextTemplate: Record<string, string>;
  priority: "low" | "medium" | "high" | "urgent";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkflowSuggestion {
  id: string;
  ruleId: string;
  ruleName: string;
  eventType: string;
  eventSummary: string;
  patientId: string;
  patientName: string;
  targetDocumentTypeId: string;
  targetDocumentTypeName: string;
  prefilledContext: Record<string, string>;
  priority: "low" | "medium" | "high" | "urgent";
  status: "pending" | "accepted" | "dismissed" | "expired";
  generatedDraftId?: string;
  userId: string;
  createdAt: string;
  resolvedAt?: string;
  disclaimer: string;
}

interface EventType {
  id: string;
  label: string;
}

interface AutoFillPrompt {
  title: string;
  message: string;
  action: string;
  priority: "low" | "medium" | "high" | "urgent";
  dismissable: boolean;
}

interface AutoFillResult {
  scenarioId: string;
  scenarioName: string;
  targetDocumentTypeId: string;
  targetDocumentTypeName: string;
  prefilledFields: Record<string, string>;
  fieldsAutoFilled: number;
  totalFields: number;
  confidence: "high" | "medium" | "low";
  prompt: AutoFillPrompt;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
  high: { label: "High", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  low: { label: "Low", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
};

const EVENT_SIMULATOR_PRESETS: Record<string, { patientName: string; patientId: string; data: Record<string, string> }> = {
  diagnosis_added: {
    patientName: "Jane Doe",
    patientId: "PT-2001",
    data: { diagnosis: "Congestive Heart Failure", diagnosisCode: "I50.9", severity: "moderate", diagnosisPattern: "heart failure" },
  },
  diagnosis_updated: {
    patientName: "Robert Wilson",
    patientId: "PT-2002",
    data: { diagnosis: "Type 2 Diabetes with complications", previousDiagnosis: "Type 2 Diabetes", diagnosisCode: "E11.65" },
  },
  patient_status_changed: {
    patientName: "Mary Johnson",
    patientId: "PT-2003",
    data: { newStatus: "discharged", previousStatus: "inpatient", primaryDiagnosis: "Pneumonia", admissionDate: "2026-02-15" },
  },
  lab_result_flagged: {
    patientName: "David Chen",
    patientId: "PT-2004",
    data: { labName: "Troponin I", labValue: "0.8 ng/mL", flagStatus: "critical", referenceRange: "< 0.04 ng/mL", severity: "critical" },
  },
  medication_prescribed: {
    patientName: "Sarah Miller",
    patientId: "PT-2005",
    data: { medicationName: "Metformin", dosage: "500mg twice daily", indication: "Type 2 Diabetes management", prescriber: "Dr. Adams" },
  },
  referral_requested: {
    patientName: "John Smith",
    patientId: "PT-2006",
    data: { specialty: "Neurology", reason: "Recurrent migraines unresponsive to first-line treatment", urgency: "Routine" },
  },
  procedure_scheduled: {
    patientName: "Lisa Brown",
    patientId: "PT-2007",
    data: { procedure: "Cardiac catheterization", scheduledDate: "2026-03-01", indication: "Chest pain evaluation" },
  },
  vitals_abnormal: {
    patientName: "Michael Taylor",
    patientId: "PT-2008",
    data: { vitalType: "Blood Pressure", vitalValue: "180/110 mmHg", normalRange: "< 120/80 mmHg", severity: "high" },
  },
};

const FIELD_LABELS: Record<string, string> = {
  patientName: "Patient Name",
  patientDOB: "Date of Birth",
  referringProvider: "Referring Provider",
  referredToProvider: "Referred To (Provider/Specialist)",
  reasonForReferral: "Reason for Referral",
  relevantHistory: "Relevant Medical History",
  currentMedications: "Current Medications",
  urgency: "Urgency Level",
  preferredDate: "Preferred Date",
  insuranceInfo: "Insurance Information",
  clinicalQuestionsForSpecialist: "Clinical Questions for Specialist",
  recentImagingFindings: "Key Findings from Recent Imaging",
  relevantLabResults: "Relevant Lab Results",
  functionalLimitations: "Functional Limitations",
  treatmentsTriedAndOutcomes: "Treatments Tried & Outcomes",
  relevantFamilyHistory: "Relevant Family History",
  summaryPeriod: "Summary Period",
  conditions: "Active Conditions",
  medications: "Current Medications",
  allergies: "Known Allergies",
  recentLabs: "Recent Lab Results",
  vitalSigns: "Vital Signs",
  carePlan: "Care Plan",
  socialHistory: "Social History",
  familyHistory: "Family History",
  recentHospitalizations: "Recent Hospitalizations",
  pendingOrders: "Pending Orders & Tests",
  activeReferrals: "Active Referrals",
  immunizationStatus: "Immunization Status",
  preventiveScreenings: "Preventive Screenings",
  functionalStatus: "Functional Status",
  advanceDirectives: "Advance Directives",
  keyTrendChanges: "Key Trend Changes",
  labTests: "Lab Tests & Results",
  labValues: "Lab Values (Detailed)",
  referenceRanges: "Reference Ranges",
  orderingProvider: "Ordering Provider",
  testDate: "Test Date",
  clinicalContext: "Clinical Context",
  priorLabComparison: "Prior Lab Comparison / Trends",
  reasonForTest: "Reason for Test",
  resultSignificance: "Clinical Significance of Results",
  recommendedFollowUp: "Recommended Follow-Up",
  dietaryMedicationImpact: "Dietary/Medication Impact on Results",
  patientReadingLevel: "Patient Reading Level",
  admissionDate: "Admission Date",
  dischargeDate: "Discharge Date",
  primaryDiagnosis: "Primary Diagnosis",
  secondaryDiagnoses: "Secondary Diagnoses",
  proceduresPerformed: "Procedures Performed",
  medicationsAtDischarge: "Medications at Discharge",
  followUpInstructions: "Follow-up Instructions",
  dietaryRestrictions: "Dietary Restrictions",
  activityRestrictions: "Activity Restrictions",
  hospitalCourse: "Hospital Course",
  reasonForAdmission: "Reason for Admission",
  keyFindings: "Key Diagnostic Findings",
  conditionAtDischarge: "Condition at Discharge",
  medicationChangesExplained: "Medication Changes with Reasons",
  pendingResultsAtDischarge: "Pending Results at Discharge",
  dischargeDisposition: "Discharge Disposition",
  patientEducationProvided: "Patient Education Provided",
  caregiverInstructions: "Caregiver Instructions",
  requestedService: "Requested Service/Procedure",
  medicalNecessityJustification: "Medical Necessity Justification",
  diagnosisCode: "Diagnosis Code (ICD-10)",
  previousTreatments: "Previous Treatments",
  supportingEvidence: "Supporting Evidence",
  providerNPI: "Provider NPI",
  clinicalGuidelinesReference: "Clinical Guidelines Reference",
  alternativesConsideredAndRuledOut: "Alternatives Considered & Ruled Out",
  expectedOutcomeWithoutTreatment: "Expected Outcome Without Treatment",
  peerReviewedEvidence: "Peer-Reviewed Evidence",
  durationOfNeed: "Duration of Need",
  stepTherapyHistory: "Step Therapy History",
  visitDate: "Visit Date",
  chiefComplaint: "Chief Complaint",
  subjective: "Subjective",
  objective: "Objective",
  physicalExam: "Physical Exam Findings",
  assessment: "Assessment",
  plan: "Plan",
  medicationChanges: "Medication Changes",
  followUp: "Follow-up",
  reasonForMedicationChange: "Reason for Medication Change",
  reviewOfSystems: "Review of Systems",
  riskFactorsAssessed: "Risk Factors Assessed",
  sharedDecisionMaking: "Shared Decision-Making Notes",
  careCoordinationNotes: "Care Coordination Notes",
  timeSpent: "Time Spent on Encounter",
  goals: "Care Goals",
  lifestyle: "Lifestyle Recommendations",
  appointments: "Upcoming Appointments",
  emergencySigns: "Warning Signs",
  supportResources: "Support Resources",
  selfMonitoringInstructions: "Self-Monitoring Instructions",
  triggerSymptoms: "Trigger Symptoms for Action",
  dietaryGuidelines: "Dietary Guidelines",
  exerciseRecommendations: "Exercise Recommendations",
  mentalHealthResources: "Mental Health Resources",
  requestingProvider: "Requesting Provider",
  recordsFrom: "Records From (Provider/Facility)",
  recordsPeriod: "Records Period",
  specificRecords: "Specific Records Needed",
  purpose: "Purpose of Request",
  deliveryMethod: "Delivery Method",
};

const FIELD_TYPES: Record<string, "text" | "textarea" | "date"> = {
  patientDOB: "date",
  preferredDate: "date",
  admissionDate: "date",
  dischargeDate: "date",
  testDate: "date",
  visitDate: "date",
  relevantHistory: "textarea",
  currentMedications: "textarea",
  conditions: "textarea",
  medications: "textarea",
  allergies: "textarea",
  recentLabs: "textarea",
  vitalSigns: "textarea",
  carePlan: "textarea",
  socialHistory: "textarea",
  familyHistory: "textarea",
  labTests: "textarea",
  labValues: "textarea",
  referenceRanges: "textarea",
  clinicalContext: "textarea",
  secondaryDiagnoses: "textarea",
  proceduresPerformed: "textarea",
  medicationsAtDischarge: "textarea",
  followUpInstructions: "textarea",
  medicalNecessityJustification: "textarea",
  previousTreatments: "textarea",
  supportingEvidence: "textarea",
  subjective: "textarea",
  objective: "textarea",
  physicalExam: "textarea",
  assessment: "textarea",
  plan: "textarea",
  goals: "textarea",
  lifestyle: "textarea",
  emergencySigns: "textarea",
  supportResources: "textarea",
  clinicalQuestionsForSpecialist: "textarea",
  recentImagingFindings: "textarea",
  relevantLabResults: "textarea",
  functionalLimitations: "textarea",
  treatmentsTriedAndOutcomes: "textarea",
  relevantFamilyHistory: "textarea",
  recentHospitalizations: "textarea",
  pendingOrders: "textarea",
  activeReferrals: "textarea",
  immunizationStatus: "textarea",
  preventiveScreenings: "textarea",
  functionalStatus: "textarea",
  advanceDirectives: "textarea",
  keyTrendChanges: "textarea",
  priorLabComparison: "textarea",
  resultSignificance: "textarea",
  recommendedFollowUp: "textarea",
  dietaryMedicationImpact: "textarea",
  hospitalCourse: "textarea",
  keyFindings: "textarea",
  medicationChangesExplained: "textarea",
  pendingResultsAtDischarge: "textarea",
  patientEducationProvided: "textarea",
  caregiverInstructions: "textarea",
  clinicalGuidelinesReference: "textarea",
  alternativesConsideredAndRuledOut: "textarea",
  expectedOutcomeWithoutTreatment: "textarea",
  peerReviewedEvidence: "textarea",
  stepTherapyHistory: "textarea",
  reasonForMedicationChange: "textarea",
  reviewOfSystems: "textarea",
  riskFactorsAssessed: "textarea",
  sharedDecisionMaking: "textarea",
  careCoordinationNotes: "textarea",
  selfMonitoringInstructions: "textarea",
  triggerSymptoms: "textarea",
  dietaryGuidelines: "textarea",
  exerciseRecommendations: "textarea",
  mentalHealthResources: "textarea",
};

const CATEGORY_ICONS: Record<string, typeof FileText> = {
  clinical: Stethoscope,
  administrative: ClipboardList,
  "patient-facing": Users,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Check }> = {
  draft: { label: "Draft", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Edit },
  reviewed: { label: "Reviewed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: Eye },
  finalized: { label: "Finalized", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
  discarded: { label: "Discarded", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
};

function DocumentTypeSelector({ types, onSelect }: { types: DocumentType[]; onSelect: (t: DocumentType) => void }) {
  const categories = ["clinical", "administrative", "patient-facing"] as const;
  const categoryLabels = { clinical: "Clinical", administrative: "Administrative", "patient-facing": "Patient-Facing" };

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const catTypes = types.filter((t) => t.category === cat);
        if (catTypes.length === 0) return null;
        const CatIcon = CATEGORY_ICONS[cat];
        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <CatIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {categoryLabels[cat]}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {catTypes.map((docType) => (
                <Card
                  key={docType.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => onSelect(docType)}
                  data-testid={`card-doctype-${docType.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{docType.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{docType.description}</p>
                        {docType.clinicalStandard && (
                          <div className="flex items-center gap-1 mt-2">
                            <Shield className="h-3 w-3 text-green-600" />
                            <span className="text-[10px] text-green-600 dark:text-green-400">{docType.clinicalStandard}</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentForm({
  docType,
  onBack,
  onGenerated,
  initialData,
}: {
  docType: DocumentType;
  onBack: () => void;
  onGenerated: (doc: GeneratedDocument) => void;
  initialData?: Record<string, string>;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Record<string, string>>(initialData || {});
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set(Object.keys(initialData || {})));
  const [patientIdForAutoFill, setPatientIdForAutoFill] = useState("");
  const [showAutoFillOptions, setShowAutoFillOptions] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData((prev) => {
        const merged = { ...prev };
        const newAutoFilled = new Set<string>();
        for (const [key, value] of Object.entries(initialData)) {
          if (value?.trim()) {
            merged[key] = value;
            newAutoFilled.add(key);
          }
        }
        setAutoFilledFields(newAutoFilled);
        return merged;
      });
    } else {
      setFormData({});
      setAutoFilledFields(new Set());
    }
  }, [initialData]);

  const smartFillMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const res = await apiRequest("GET", `/api/ai-document-generation/autofill/patient/${patientId}/${docType.id}`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.fields && Object.keys(data.fields).length > 0) {
        const newAutoFilled = new Set(autoFilledFields);
        const merged = { ...formData };
        let count = 0;
        for (const [key, value] of Object.entries(data.fields as Record<string, string>)) {
          if (!merged[key]?.trim()) {
            merged[key] = value;
            newAutoFilled.add(key);
            count++;
          }
        }
        setFormData(merged);
        setAutoFilledFields(newAutoFilled);
        toast({ title: "Smart Fill Complete", description: `${count} field${count !== 1 ? "s" : ""} auto-populated from patient records.` });
      } else {
        toast({ title: "No Data Found", description: "No matching patient data found for auto-fill.", variant: "destructive" });
      }
      setShowAutoFillOptions(false);
    },
    onError: (error: any) => {
      toast({ title: "Auto-Fill Failed", description: error.message || "Could not retrieve patient data.", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-document-generation/generate", {
        documentTypeId: docType.id,
        context: formData,
        additionalInstructions: additionalInstructions || undefined,
        patientName: formData.patientName,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Document Generated", description: `${docType.name} draft created successfully.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
      onGenerated(data.draft);
    },
    onError: (error: any) => {
      toast({ title: "Generation Failed", description: error.message || "Failed to generate document.", variant: "destructive" });
    },
  });

  const updateField = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const allFields = [...docType.requiredFields, ...docType.optionalFields];
  const missingRequired = docType.requiredFields.filter((f) => !formData[f]?.trim());

  const renderField = (field: string, required: boolean) => {
    const fieldType = FIELD_TYPES[field] || "text";
    const label = FIELD_LABELS[field] || field;
    const hint = docType.fieldHints?.[field];
    const isAutoFilled = autoFilledFields.has(field) && formData[field]?.trim();

    return (
      <div key={field} className="space-y-1.5">
        <div className="flex items-center gap-2">
          <FieldCaption className="text-sm">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </FieldCaption>
          {isAutoFilled && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800" data-testid={`badge-autofill-${field}`}>
              <Zap className="h-2.5 w-2.5 mr-0.5" />
              Auto-filled
            </Badge>
          )}
        </div>
        {hint && (
          <p className="text-xs text-muted-foreground leading-relaxed" data-testid={`hint-${field}`}>{hint}</p>
        )}
        {fieldType === "textarea" ? (
          <Textarea
            value={formData[field] || ""}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={hint ? hint.split("(e.g.,")[0].trim() : `Enter ${label.toLowerCase()}...`}
            rows={3}
            className={isAutoFilled ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20" : ""}
            data-testid={`input-${field}`}
          />
        ) : fieldType === "date" ? (
          <Input
            type="date"
            value={formData[field] || ""}
            onChange={(e) => updateField(field, e.target.value)}
            className={isAutoFilled ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20" : ""}
            data-testid={`input-${field}`}
          />
        ) : (
          <Input
            value={formData[field] || ""}
            onChange={(e) => updateField(field, e.target.value)}
            placeholder={hint ? hint.split("(e.g.,")[0].trim() : `Enter ${label.toLowerCase()}...`}
            className={isAutoFilled ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20" : ""}
            data-testid={`input-${field}`}
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-types">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h3 className="font-semibold">{docType.name}</h3>
            <p className="text-xs text-muted-foreground">{docType.description}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAutoFillOptions(!showAutoFillOptions)} data-testid="button-smart-fill-toggle">
          <Zap className="h-4 w-4 mr-1 text-amber-500" />
          Smart Fill
        </Button>
      </div>

      {showAutoFillOptions && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 space-y-3" data-testid="panel-smart-fill">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Smart Auto-Fill from Patient Records</h4>
          </div>
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Enter a Patient ID to automatically populate known fields from their records. Only empty fields will be filled — existing entries won't be overwritten.
          </p>
          <div className="flex gap-2">
            <Input
              value={patientIdForAutoFill}
              onChange={(e) => setPatientIdForAutoFill(e.target.value)}
              placeholder="Patient ID (e.g., PT-2001)"
              className="flex-1"
              data-testid="input-autofill-patient-id"
            />
            <Button
              size="sm"
              onClick={() => patientIdForAutoFill.trim() && smartFillMutation.mutate(patientIdForAutoFill.trim())}
              disabled={!patientIdForAutoFill.trim() || smartFillMutation.isPending}
              data-testid="button-run-smart-fill"
            >
              {smartFillMutation.isPending ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Filling...</>
              ) : (
                <><Zap className="h-3 w-3 mr-1" />Auto-Fill</>
              )}
            </Button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {["PT-2001", "PT-2002", "PT-2003", "PT-2004", "PT-2005", "PT-2006", "PT-2008"].map((pid) => (
              <Button
                key={pid}
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPatientIdForAutoFill(pid);
                  smartFillMutation.mutate(pid);
                }}
                disabled={smartFillMutation.isPending}
                data-testid={`button-quick-fill-${pid}`}
              >
                {pid}
              </Button>
            ))}
          </div>
        </div>
      )}

      {autoFilledFields.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800" data-testid="banner-autofill-summary">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-300">
            {autoFilledFields.size} field{autoFilledFields.size !== 1 ? "s" : ""} auto-filled — review and edit as needed before generating
          </span>
        </div>
      )}

      {docType.clinicalStandard && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
          <Shield className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-700 dark:text-green-300">Standard: {docType.clinicalStandard}</span>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <span className="text-red-500">*</span> Required Information
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {docType.requiredFields.map((f) => renderField(f, true))}
          </div>
        </div>

        {docType.optionalFields.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Optional Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docType.optionalFields.map((f) => renderField(f, false))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="ai-document-generation-additional-instructions-optional" className="text-sm">Additional Instructions (Optional)</Label>
          <Textarea id="ai-document-generation-additional-instructions-optional"
            value={additionalInstructions}
            onChange={(e) => setAdditionalInstructions(e.target.value)}
            placeholder="Any specific formatting preferences, tone adjustments, or additional context for the AI..."
            rows={2}
            data-testid="input-additional-instructions"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          All generated documents require provider review
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={missingRequired.length > 0 || generateMutation.isPending}
          data-testid="button-generate-document"
        >
          {generateMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Document
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function DocumentEditor({
  document: doc,
  onBack,
}: {
  document: GeneratedDocument;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [editedContent, setEditedContent] = useState(doc.content);
  const [isEditing, setIsEditing] = useState(false);

  const updateContentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/ai-document-generation/drafts/${doc.id}/content`, { content: editedContent });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Document content updated." });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest("PATCH", `/api/ai-document-generation/drafts/${doc.id}/status`, { status });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Status Updated", description: `Document marked as ${data.draft.status}.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update status.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/ai-document-generation/drafts/${doc.id}`);
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Draft permanently deleted." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
      onBack();
    },
    onError: () => toast({ title: "Error", description: "Failed to delete draft.", variant: "destructive" }),
  });

  const copyToClipboard = () => {
    navigator.clipboard.writeText(editedContent);
    toast({ title: "Copied", description: "Document content copied to clipboard." });
  };

  const statusConfig = STATUS_CONFIG[doc.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-to-drafts">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h3 className="font-semibold text-sm">{doc.title}</h3>
            <p className="text-xs text-muted-foreground">{doc.documentTypeName}</p>
          </div>
        </div>
        <Badge className={statusConfig.color} data-testid="badge-doc-status">
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
      </div>

      {doc.complianceFlags.length > 0 && (
        <div className="space-y-1 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            Compliance Notes
          </div>
          {doc.complianceFlags.map((flag, i) => (
            <div key={i} className="text-xs text-amber-600 dark:text-amber-400 pl-6">
              {flag}
            </div>
          ))}
        </div>
      )}

      {doc.clinicalStandard && (
        <div className="flex items-center gap-2 text-xs">
          <Shield className="h-3 w-3 text-green-600" />
          <span className="text-green-600 dark:text-green-400">Standard: {doc.clinicalStandard}</span>
        </div>
      )}

      <div className="border rounded-lg">
        <div className="flex items-center justify-between p-2 border-b bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground">Document Content</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={copyToClipboard} data-testid="button-copy">
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            {!isEditing ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsEditing(true)} data-testid="button-edit">
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                className="h-7 text-xs"
                onClick={() => updateContentMutation.mutate()}
                disabled={updateContentMutation.isPending}
                data-testid="button-save-edit"
              >
                <Save className="h-3 w-3 mr-1" />
                Save
              </Button>
            )}
          </div>
        </div>
        {isEditing ? (
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[400px] border-0 rounded-none font-mono text-sm"
            data-testid="textarea-doc-content"
          />
        ) : (
          <ScrollArea className="h-[400px] p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans" data-testid="text-doc-content">{editedContent}</pre>
          </ScrollArea>
        )}
      </div>

      <div className="p-3 bg-muted/30 rounded-lg border text-xs text-muted-foreground italic" data-testid="text-disclaimer">
        {doc.disclaimer}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />
          Created: {new Date(doc.createdAt).toLocaleString()}
          {doc.updatedAt !== doc.createdAt && ` | Updated: ${new Date(doc.updatedAt).toLocaleString()}`}
        </div>
        <div className="flex items-center gap-2">
          {doc.status === "draft" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateStatusMutation.mutate("reviewed")}
              disabled={updateStatusMutation.isPending}
              data-testid="button-mark-reviewed"
            >
              <Eye className="h-3 w-3 mr-1" />
              Mark Reviewed
            </Button>
          )}
          {(doc.status === "draft" || doc.status === "reviewed") && (
            <Button
              size="sm"
              onClick={() => updateStatusMutation.mutate("finalized")}
              disabled={updateStatusMutation.isPending}
              data-testid="button-finalize"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Finalize
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            data-testid="button-delete-draft"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function DraftsList({ drafts, onSelect }: { drafts: GeneratedDocument[]; onSelect: (d: GeneratedDocument) => void }) {
  if (drafts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No documents generated yet</p>
        <p className="text-xs mt-1">Select a document type to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => {
        const statusConfig = STATUS_CONFIG[draft.status];
        const StatusIcon = statusConfig.icon;
        return (
          <Card
            key={draft.id}
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => onSelect(draft)}
            data-testid={`card-draft-${draft.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{draft.title}</h4>
                    <Badge className={`${statusConfig.color} text-[10px] h-5`}>
                      <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                      {statusConfig.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{draft.documentTypeName}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(draft.updatedAt).toLocaleDateString()}
                    </span>
                    {draft.complianceFlags.length > 0 && (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {draft.complianceFlags.length} note{draft.complianceFlags.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2 mt-1" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CreateRuleForm({
  eventTypes,
  documentTypes,
  onSubmit,
  isPending,
  onCancel,
}: {
  eventTypes: EventType[];
  documentTypes: DocumentType[];
  onSubmit: (rule: { name: string; description: string; eventType: string; targetDocumentTypeId: string; priority: string; eventFilters: Record<string, string>; contextTemplate: Record<string, string> }) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("");
  const [targetDocType, setTargetDocType] = useState("");
  const [priority, setPriority] = useState("medium");
  const [filterKey, setFilterKey] = useState("");
  const [filterValue, setFilterValue] = useState("");

  const canSubmit = name.trim() && eventType && targetDocType;

  return (
    <div className="border rounded-lg p-4 bg-primary/5 space-y-4 mb-4" data-testid="form-create-rule">
      <h4 className="font-medium text-sm flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create New Workflow Rule
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ai-document-generation-rule-name" className="text-sm">Rule Name <span className="text-red-500">*</span></Label>
          <Input id="ai-document-generation-rule-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Oncology Referral on Cancer Diagnosis"
            data-testid="input-rule-name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-document-generation-priority" className="text-sm">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger id="ai-document-generation-priority" data-testid="select-rule-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-document-generation-description" className="text-sm">Description</Label>
        <Textarea id="ai-document-generation-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe when this rule should trigger..."
          data-testid="input-rule-description"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ai-document-generation-trigger-event" className="text-sm">Trigger Event <span className="text-red-500">*</span></Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger id="ai-document-generation-trigger-event" data-testid="select-rule-event-type">
              <SelectValue placeholder="Select event type..." />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((et) => (
                <SelectItem key={et.id} value={et.id}>{et.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ai-document-generation-target-document" className="text-sm">Target Document <span className="text-red-500">*</span></Label>
          <Select value={targetDocType} onValueChange={setTargetDocType}>
            <SelectTrigger id="ai-document-generation-target-document" data-testid="select-rule-doc-type">
              <SelectValue placeholder="Select document type..." />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((dt) => (
                <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-document-generation-event-filter-optional" className="text-sm">Event Filter (Optional)</Label>
        <div className="flex gap-2">
          <Input id="ai-document-generation-event-filter-optional"
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            placeholder="Filter key (e.g., diagnosisPattern)"
            className="flex-1"
            data-testid="input-filter-key"
          />
          <Input
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            placeholder="Filter value (e.g., cancer|tumor)"
            className="flex-1"
            data-testid="input-filter-value"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">Use pipe (|) to separate multiple matching patterns. Leave empty to match all events of this type.</p>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Rules generate suggestions only — documents still require manual approval
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-rule">Cancel</Button>
          <Button
            size="sm"
            disabled={!canSubmit || isPending}
            onClick={() => {
              const eventFilters: Record<string, string> = {};
              if (filterKey.trim() && filterValue.trim()) {
                eventFilters[filterKey.trim()] = filterValue.trim();
              }
              onSubmit({
                name: name.trim(),
                description: description.trim(),
                eventType,
                targetDocumentTypeId: targetDocType,
                priority,
                eventFilters,
                contextTemplate: {},
              });
            }}
            data-testid="button-submit-rule"
          >
            {isPending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Creating...</> : <><Plus className="h-3 w-3 mr-1" />Create Rule</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AIDocumentGeneration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("generate");
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [viewingDraft, setViewingDraft] = useState<GeneratedDocument | null>(null);
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [simulatorEventType, setSimulatorEventType] = useState<string>("");
  const [expandedRules, setExpandedRules] = useState<Record<string, boolean>>({});
  const [autoFillPrompts, setAutoFillPrompts] = useState<AutoFillResult[]>([]);
  const [initialFormData, setInitialFormData] = useState<Record<string, string> | undefined>(undefined);

  const { data: typesData, isLoading: typesLoading } = useQuery<{ types: DocumentType[] }>({
    queryKey: ["/api/ai-document-generation/types"],
  });

  const { data: draftsData, isLoading: draftsLoading } = useQuery<{ drafts: GeneratedDocument[] }>({
    queryKey: ["/api/ai-document-generation/drafts"],
  });

  const { data: statsData } = useQuery<{ stats: any }>({
    queryKey: ["/api/ai-document-generation/stats"],
  });

  const { data: rulesData, isLoading: rulesLoading } = useQuery<{ rules: WorkflowRule[] }>({
    queryKey: ["/api/ai-document-generation/workflows/rules"],
  });

  const { data: suggestionsData, isLoading: suggestionsLoading } = useQuery<{ suggestions: WorkflowSuggestion[]; pendingCount: number }>({
    queryKey: ["/api/ai-document-generation/workflows/suggestions"],
  });

  const { data: eventTypesData } = useQuery<{ eventTypes: EventType[] }>({
    queryKey: ["/api/ai-document-generation/workflows/event-types"],
  });

  const { data: workflowStatsData } = useQuery<{ stats: any }>({
    queryKey: ["/api/ai-document-generation/workflows/stats"],
  });

  const types = typesData?.types || [];
  const userDrafts = draftsData?.drafts || [];
  const stats = statsData?.stats;
  const workflowRules = rulesData?.rules || [];
  const workflowSuggestions = suggestionsData?.suggestions || [];
  const pendingSuggestionCount = suggestionsData?.pendingCount || 0;
  const eventTypes = eventTypesData?.eventTypes || [];
  const wfStats = workflowStatsData?.stats;

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/ai-document-generation/workflows/rules/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/rules"] });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/ai-document-generation/workflows/rules/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Rule Deleted", description: "Workflow rule removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/rules"] });
    },
  });

  const evaluateAutoFillMutation = useMutation({
    mutationFn: async (params: { triggerType: string; data: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/ai-document-generation/autofill/evaluate", params);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.results && data.results.length > 0) {
        setAutoFillPrompts(data.results);
      }
    },
  });

  const simulateEventMutation = useMutation({
    mutationFn: async (event: { eventType: string; patientId: string; patientName: string; data: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/ai-document-generation/workflows/events", event);
      return res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/stats"] });

      const triggerTypeMap: Record<string, string> = {
        diagnosis_added: "diagnosis",
        diagnosis_updated: "diagnosis",
        patient_status_changed: "status_change",
        lab_result_flagged: "lab_result",
        medication_prescribed: "medication",
        referral_requested: "referral",
        vitals_abnormal: "vitals",
      };
      const triggerType = triggerTypeMap[variables.eventType] || variables.eventType;
      evaluateAutoFillMutation.mutate({
        triggerType,
        data: { ...variables.data, patientId: variables.patientId, patientName: variables.patientName },
      });

      if (data.suggestionsGenerated > 0) {
        toast({
          title: `${data.suggestionsGenerated} Workflow Suggestion${data.suggestionsGenerated > 1 ? "s" : ""} Generated`,
          description: "Review the suggestions in the Suggestions panel below.",
        });
      } else {
        toast({ title: "Event Processed", description: "No matching workflow rules found for this event." });
      }
    },
    onError: (error: any) => {
      toast({ title: "Event Error", description: error.message, variant: "destructive" });
    },
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/ai-document-generation/workflows/suggestions/${id}/accept`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Document Generated", description: `${data.suggestion.targetDocumentTypeName} draft created from workflow suggestion.` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/stats"] });
      if (data.draft) {
        setViewingDraft(data.draft);
        setActiveTab("drafts");
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to accept suggestion.", variant: "destructive" });
    },
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/ai-document-generation/workflows/suggestions/${id}/dismiss`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/stats"] });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: { name: string; description: string; eventType: string; targetDocumentTypeId: string; priority: string; eventFilters: Record<string, string>; contextTemplate: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/ai-document-generation/workflows/rules", rule);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rule Created", description: "New workflow rule has been created." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-document-generation/workflows/stats"] });
      setShowCreateRule(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create rule.", variant: "destructive" });
    },
  });

  const handleGenerated = (doc: GeneratedDocument) => {
    setViewingDraft(doc);
    setSelectedType(null);
    setInitialFormData(undefined);
    setActiveTab("drafts");
  };

  const handleAutoFillPromptAccept = (result: AutoFillResult) => {
    const docType = types.find((t) => t.id === result.targetDocumentTypeId);
    if (docType) {
      setInitialFormData(result.prefilledFields);
      setSelectedType(docType);
      setActiveTab("generate");
      setAutoFillPrompts((prev) => prev.filter((p) => p.scenarioId !== result.scenarioId));
      toast({
        title: "Form Pre-Populated",
        description: `${result.fieldsAutoFilled} fields auto-filled for ${result.targetDocumentTypeName}. Review and complete the remaining fields.`,
      });
    }
  };

  const handleAutoFillPromptDismiss = (scenarioId: string) => {
    setAutoFillPrompts((prev) => prev.filter((p) => p.scenarioId !== scenarioId));
  };

  const handleSimulateEvent = () => {
    if (!simulatorEventType) return;
    const preset = EVENT_SIMULATOR_PRESETS[simulatorEventType];
    if (!preset) return;
    simulateEventMutation.mutate({
      eventType: simulatorEventType,
      patientId: preset.patientId,
      patientName: preset.patientName,
      data: preset.data,
    });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <FileCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Document Generation</h1>
            <p className="text-sm text-muted-foreground">
              Generate clinical documents with AI assistance — review and edit before use
            </p>
          </div>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold" data-testid="text-stat-total">{stats.totalDrafts}</p>
                <p className="text-xs text-muted-foreground">Total Drafts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <Edit className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.byStatus?.draft || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.byStatus?.finalized || 0}</p>
                <p className="text-xs text-muted-foreground">Finalized</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Sparkles className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.documentTypesAvailable || 0}</p>
                <p className="text-xs text-muted-foreground">Document Types</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {autoFillPrompts.length > 0 && (
        <div className="space-y-3 mb-4" data-testid="autofill-prompts-container">
          {autoFillPrompts.map((result) => {
            const priorityConfig = PRIORITY_CONFIG[result.prompt.priority];
            const confidenceColors = {
              high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
              medium: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
              low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
            };
            return (
              <div
                key={result.scenarioId}
                className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-sm"
                data-testid={`autofill-prompt-${result.scenarioId}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Zap className="h-4 w-4 text-primary shrink-0" />
                      <h4 className="font-semibold text-sm">{result.prompt.title}</h4>
                      <Badge className={`${priorityConfig.color} text-[10px] h-5`}>{priorityConfig.label}</Badge>
                      <Badge className={`${confidenceColors[result.confidence]} text-[10px] h-5`}>
                        {result.fieldsAutoFilled}/{result.totalFields} fields ready
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{result.prompt.message}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {Object.entries(result.prefilledFields).slice(0, 3).map(([key, value]) => (
                        <span key={key} className="text-[10px] px-2 py-0.5 bg-muted rounded-full">
                          {FIELD_LABELS[key] || key}: {value.length > 30 ? value.substring(0, 30) + "..." : value}
                        </span>
                      ))}
                      {Object.keys(result.prefilledFields).length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{Object.keys(result.prefilledFields).length - 3} more</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAutoFillPromptAccept(result)}
                      data-testid={`button-accept-autofill-${result.scenarioId}`}
                    >
                      <ArrowRight className="h-3 w-3 mr-1" />
                      {result.prompt.action}
                    </Button>
                    {result.prompt.dismissable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAutoFillPromptDismiss(result.scenarioId)}
                        data-testid={`button-dismiss-autofill-${result.scenarioId}`}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Dismiss
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pendingSuggestionCount > 0 && activeTab !== "workflows" && (
        <Alert className="mb-4 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 cursor-pointer" onClick={() => setActiveTab("workflows")} data-testid="alert-pending-suggestions">
          <Bell className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Workflow Suggestions Available</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
            You have {pendingSuggestionCount} pending document suggestion{pendingSuggestionCount > 1 ? "s" : ""} based on clinical events. Click to review.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelectedType(null); setViewingDraft(null); if (v !== "generate") setInitialFormData(undefined); }}>
        <TabsList className="mb-4">
          <TabsTrigger value="generate" data-testid="tab-generate">
            <FilePlus className="h-4 w-4 mr-1" />
            Generate
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            <FileText className="h-4 w-4 mr-1" />
            My Documents
            {userDrafts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">{userDrafts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">
            <Zap className="h-4 w-4 mr-1" />
            Workflows
            {pendingSuggestionCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] h-4 px-1.5">{pendingSuggestionCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {selectedType ? selectedType.name : "Select Document Type"}
              </CardTitle>
              <CardDescription>
                {selectedType
                  ? "Fill in the details below and the AI will generate a draft document for your review."
                  : "Choose a document type to generate. All documents require provider review before clinical use."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {typesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : selectedType ? (
                <DocumentForm
                  key={`${selectedType.id}-${initialFormData ? Object.keys(initialFormData).length : 0}`}
                  docType={selectedType}
                  onBack={() => { setSelectedType(null); setInitialFormData(undefined); }}
                  onGenerated={handleGenerated}
                  initialData={initialFormData}
                />
              ) : (
                <DocumentTypeSelector types={types} onSelect={setSelectedType} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {viewingDraft ? viewingDraft.title : "My Documents"}
              </CardTitle>
              <CardDescription>
                {viewingDraft
                  ? "Review, edit, and manage this document."
                  : "View and manage your generated documents."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : viewingDraft ? (
                <DocumentEditor
                  document={viewingDraft}
                  onBack={() => setViewingDraft(null)}
                />
              ) : (
                <DraftsList drafts={userDrafts} onSelect={setViewingDraft} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workflows" data-testid="tab-content-workflows">
          <div className="space-y-6">
            {wfStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Settings className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{wfStats.enabledRules}/{wfStats.totalRules}</p>
                      <p className="text-xs text-muted-foreground">Active Rules</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                      <Bell className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{wfStats.pendingSuggestions}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{wfStats.acceptedSuggestions}</p>
                      <p className="text-xs text-muted-foreground">Accepted</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-900/30">
                      <XCircle className="h-4 w-4 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">{wfStats.dismissedSuggestions}</p>
                      <p className="text-xs text-muted-foreground">Dismissed</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card data-testid="card-event-simulator">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Clinical Event Simulator
                </CardTitle>
                <CardDescription>Simulate clinical events to trigger automated workflow suggestions. In production, these events would be triggered by EHR integrations automatically.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="ai-document-generation-event-type" className="text-sm">Event Type</Label>
                    <Select value={simulatorEventType} onValueChange={setSimulatorEventType}>
                      <SelectTrigger id="ai-document-generation-event-type" data-testid="select-event-type">
                        <SelectValue placeholder="Select a clinical event..." />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((et) => (
                          <SelectItem key={et.id} value={et.id}>{et.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {simulatorEventType && EVENT_SIMULATOR_PRESETS[simulatorEventType] && (
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded border">
                        <span className="font-medium">Preview:</span> {EVENT_SIMULATOR_PRESETS[simulatorEventType].patientName} (ID: {EVENT_SIMULATOR_PRESETS[simulatorEventType].patientId})
                        {Object.entries(EVENT_SIMULATOR_PRESETS[simulatorEventType].data).slice(0, 2).map(([k, v]) => (
                          <span key={k} className="ml-2">| {k}: {v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleSimulateEvent}
                    disabled={!simulatorEventType || simulateEventMutation.isPending}
                    data-testid="button-simulate-event"
                  >
                    {simulateEventMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" />Trigger Event</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-workflow-inbox">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="h-5 w-5 text-amber-500" />
                      Workflow Inbox
                      {workflowSuggestions.filter((s) => s.status === "pending").length > 0 && (
                        <Badge variant="destructive" className="text-xs">{workflowSuggestions.filter((s) => s.status === "pending").length} pending</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Document suggestions triggered by clinical events. One-click to generate or dismiss.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span>Automation active</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {workflowSuggestions.filter((s) => s.status === "pending").length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="inbox-empty">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">All caught up! No pending suggestions.</p>
                    <p className="text-xs mt-1">Use the event simulator below to trigger workflow suggestions.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workflowSuggestions
                      .filter((s) => s.status === "pending")
                      .sort((a, b) => {
                        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
                        return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
                      })
                      .map((suggestion) => {
                        const priorityConfig = PRIORITY_CONFIG[suggestion.priority];
                        const isUrgent = suggestion.priority === "urgent" || suggestion.priority === "high";
                        const prefilledCount = Object.keys(suggestion.prefilledContext).filter(k => k !== "patientName").length;

                        return (
                          <div
                            key={suggestion.id}
                            className={`border rounded-lg overflow-hidden ${
                              isUrgent ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10"
                            }`}
                            data-testid={`suggestion-${suggestion.id}`}
                          >
                            <div className={`h-1 ${isUrgent ? "bg-red-400" : "bg-amber-400"}`} />
                            <div className="p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <Zap className={`h-4 w-4 shrink-0 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
                                    <span className="font-medium text-sm">{suggestion.targetDocumentTypeName}</span>
                                    <Badge className={`${priorityConfig.color} text-[10px] h-5`}>{priorityConfig.label}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{suggestion.eventSummary}</p>
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {suggestion.patientName}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {new Date(suggestion.createdAt).toLocaleString()}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Settings className="h-3 w-3" />
                                      {suggestion.ruleName}
                                    </span>
                                    {prefilledCount > 0 && (
                                      <Badge variant="outline" className="text-[9px] h-4">{prefilledCount} fields pre-filled</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    className="gap-1"
                                    onClick={() => acceptSuggestionMutation.mutate(suggestion.id)}
                                    disabled={acceptSuggestionMutation.isPending}
                                    data-testid={`button-accept-${suggestion.id}`}
                                  >
                                    {acceptSuggestionMutation.isPending ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Sparkles className="h-3.5 w-3.5" />
                                    )}
                                    Generate Now
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => dismissSuggestionMutation.mutate(suggestion.id)}
                                    disabled={dismissSuggestionMutation.isPending}
                                    data-testid={`button-dismiss-${suggestion.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-workflow-rules">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Workflow Rules
                    </CardTitle>
                    <CardDescription className="mt-1">Define rules that automatically suggest document generation when clinical events occur.</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateRule(!showCreateRule)} data-testid="button-add-rule">
                    {showCreateRule ? <><X className="h-4 w-4 mr-1" />Cancel</> : <><Plus className="h-4 w-4 mr-1" />Add Rule</>}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {showCreateRule && (
                  <CreateRuleForm
                    eventTypes={eventTypes}
                    documentTypes={types}
                    onSubmit={(rule) => createRuleMutation.mutate(rule)}
                    isPending={createRuleMutation.isPending}
                    onCancel={() => setShowCreateRule(false)}
                  />
                )}

                {rulesLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : workflowRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Settings className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No workflow rules configured</p>
                    <p className="text-xs mt-1">Create a rule to automatically suggest document generation on clinical events.</p>
                  </div>
                ) : (
                  workflowRules.map((rule) => {
                    const priorityConfig = PRIORITY_CONFIG[rule.priority];
                    const isExpanded = expandedRules[rule.id];
                    const eventLabel = eventTypes.find((et) => et.id === rule.eventType)?.label || rule.eventType;
                    const docType = types.find((t) => t.id === rule.targetDocumentTypeId);
                    return (
                      <div key={rule.id} className={`border rounded-lg overflow-hidden ${rule.enabled ? "" : "opacity-60"}`} data-testid={`rule-${rule.id}`}>
                        <div className="flex items-center justify-between px-4 py-3">
                          <button
                            className="flex items-center gap-3 flex-1 text-left min-w-0"
                            onClick={() => setExpandedRules((prev) => ({ ...prev, [rule.id]: !prev[rule.id] }))}
                            data-testid={`button-toggle-rule-${rule.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm truncate">{rule.name}</span>
                                <Badge className={`${priorityConfig.color} text-[10px] h-5`}>{priorityConfig.label}</Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px]">{eventLabel}</Badge>
                                <ArrowRight className="h-3 w-3" />
                                <Badge variant="secondary" className="text-[10px]">{docType?.name || rule.targetDocumentTypeId}</Badge>
                              </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>
                          <div className="flex items-center gap-3 ml-3">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(enabled) => toggleRuleMutation.mutate({ id: rule.id, enabled })}
                              data-testid={`switch-rule-${rule.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 pt-0 border-t bg-muted/20 space-y-2">
                            <p className="text-sm text-muted-foreground pt-2">{rule.description}</p>
                            {Object.keys(rule.eventFilters).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Event Filters:</p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(rule.eventFilters).map(([k, v]) => (
                                    <Badge key={k} variant="outline" className="text-[10px]">{k}: {v}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Object.keys(rule.contextTemplate).length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground">Context Template:</p>
                                <div className="mt-1 p-2 bg-white dark:bg-gray-900 rounded border text-xs space-y-0.5">
                                  {Object.entries(rule.contextTemplate).map(([k, v]) => (
                                    <div key={k}>
                                      <span className="text-muted-foreground">{FIELD_LABELS[k] || k}:</span>{" "}
                                      <span className="font-mono text-primary">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground">Created: {new Date(rule.createdAt).toLocaleDateString()} by {rule.createdBy}</p>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {workflowSuggestions.filter((s) => s.status !== "pending").length > 0 && (
              <Card data-testid="card-suggestion-history">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Suggestion History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {workflowSuggestions
                      .filter((s) => s.status !== "pending")
                      .slice(0, 10)
                      .map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm" data-testid={`history-${s.id}`}>
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {s.status === "accepted" ? (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-gray-400 shrink-0" />
                            )}
                            <span className="truncate">{s.targetDocumentTypeName} — {s.patientName}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            <Badge variant={s.status === "accepted" ? "default" : "secondary"} className="text-[10px]">{s.status}</Badge>
                            <span>{s.resolvedAt ? new Date(s.resolvedAt).toLocaleDateString() : ""}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-6 p-4 bg-muted/30 rounded-lg border">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium">Privacy & Compliance</h4>
            <p className="text-xs text-muted-foreground mt-1">
              All document generation is logged for HIPAA compliance. Generated documents are drafts requiring provider review and are NOT clinical decision support (NO-CDS). Patient data is processed securely and not stored by the AI provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
