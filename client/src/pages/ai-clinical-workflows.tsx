import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Shield, 
  Image, 
  Info, 
  Sparkles,
  User,
  Activity,
  Settings2,
  Loader2,
  Save,
  ClipboardList
} from "lucide-react";
import { AIPatientSummaryPanel } from "@/components/ai-patient-summary-panel";
import { AIRiskStratificationPanel } from "@/components/ai-risk-stratification-panel";
import { AIImagingAnalysisPanel } from "@/components/ai-imaging-analysis-panel";
import { AIFeedbackControls } from "@/components/ai-feedback-controls";
import { AITrendParameters } from "@/components/ai-trend-parameters";
import { AIInsightPreferences } from "@/components/ai-insight-preferences";
import { AIAuditLogViewer } from "@/components/ai-audit-log-viewer";
import { apiRequest } from "@/lib/queryClient";
import type { TrendParameters, InsightPreferences } from "@shared/schema";
import { DEFAULT_TREND_PARAMETERS, DEFAULT_INSIGHT_PREFERENCES } from "@shared/schema";

const SAMPLE_USER_ID = "current-user";

const SAMPLE_PATIENT_DATA = {
  demographics: {
    id: "patient-001",
    name: "John Smith",
    dateOfBirth: "1958-03-15",
    gender: "Male",
    age: 67
  },
  medications: [
    { name: "Metformin", dosage: "500mg", frequency: "twice daily", status: "active" },
    { name: "Lisinopril", dosage: "10mg", frequency: "once daily", status: "active" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "once daily", status: "active" },
    { name: "Aspirin", dosage: "81mg", frequency: "once daily", status: "active" },
    { name: "Metoprolol", dosage: "25mg", frequency: "twice daily", status: "active" },
    { name: "Omeprazole", dosage: "20mg", frequency: "once daily", status: "active" }
  ],
  conditions: [
    { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2015-06-01" },
    { name: "Essential Hypertension", status: "active", onsetDate: "2012-03-15" },
    { name: "Hyperlipidemia", status: "active", onsetDate: "2014-09-20" },
    { name: "Osteoarthritis", status: "active", onsetDate: "2020-01-10" }
  ],
  encounters: [
    { type: "Office Visit", date: "2025-12-15", reason: "Routine follow-up" },
    { type: "Lab Work", date: "2025-12-10", reason: "HbA1c and lipid panel" },
    { type: "Office Visit", date: "2025-09-20", reason: "Medication review" },
    { type: "Emergency", date: "2025-06-05", reason: "Chest pain evaluation" }
  ],
  allergies: [
    { substance: "Penicillin", reaction: "Rash", severity: "Moderate" },
    { substance: "Sulfa drugs", reaction: "Hives", severity: "Mild" }
  ],
  vitals: [
    { type: "Blood Pressure", value: 142, unit: "mmHg systolic", date: "2025-12-15" },
    { type: "Heart Rate", value: 78, unit: "bpm", date: "2025-12-15" },
    { type: "Weight", value: 195, unit: "lbs", date: "2025-12-15" },
    { type: "Temperature", value: 98.6, unit: "°F", date: "2025-12-15" }
  ],
  labResults: [
    { name: "HbA1c", value: 7.2, unit: "%", abnormal: true, date: "2025-12-10" },
    { name: "Fasting Glucose", value: 145, unit: "mg/dL", abnormal: true, date: "2025-12-10" },
    { name: "Total Cholesterol", value: 198, unit: "mg/dL", abnormal: false, date: "2025-12-10" },
    { name: "LDL", value: 112, unit: "mg/dL", abnormal: true, date: "2025-12-10" },
    { name: "Creatinine", value: 1.1, unit: "mg/dL", abnormal: false, date: "2025-12-10" }
  ]
};

const SAMPLE_RISK_DATA = {
  demographics: { age: 67, gender: "Male" },
  conditions: SAMPLE_PATIENT_DATA.conditions.map(c => ({ name: c.name, status: c.status })),
  medications: SAMPLE_PATIENT_DATA.medications.map(m => ({ name: m.name, status: m.status })),
  vitals: SAMPLE_PATIENT_DATA.vitals,
  labResults: SAMPLE_PATIENT_DATA.labResults,
  socialHistory: {
    smokingStatus: "former",
    alcoholUse: "moderate",
    exerciseLevel: "sedentary"
  },
  encounters: SAMPLE_PATIENT_DATA.encounters.map(e => ({ type: e.type, date: e.date }))
};

const SAMPLE_IMAGING_STUDY = {
  id: "imaging-001",
  modality: "CT",
  bodyPart: "Chest",
  studyDate: "2025-12-01",
  orderingProvider: "Dr. Sarah Johnson",
  indication: "Follow-up pulmonary nodule",
  status: "Final"
};

const SAMPLE_IMAGING_REPORT = {
  studyId: "imaging-001",
  reportText: `CT CHEST WITHOUT CONTRAST

CLINICAL INDICATION: Follow-up pulmonary nodule identified on prior imaging.

TECHNIQUE: Helical CT of the chest was performed without intravenous contrast.

COMPARISON: CT chest dated 2025-06-01.

FINDINGS:
Lungs: The previously identified 6mm nodule in the right lower lobe (series 4, image 156) is stable compared to prior examination. No new pulmonary nodules identified. Lungs are otherwise clear without consolidation or effusion.

Mediastinum: Heart size is normal. No pericardial effusion. Mediastinal and hilar lymph nodes are within normal limits.

Bones: Degenerative changes of the thoracic spine. No suspicious osseous lesions.

Incidental findings: Small hepatic cyst noted on the included upper abdominal images.

IMPRESSION:
1. Stable 6mm right lower lobe pulmonary nodule. Given stability over 6 months, continued annual surveillance recommended per Fleischner guidelines.
2. Small hepatic cyst, likely benign, no follow-up required.
3. Thoracic spine degenerative changes.`,
  findings: "Stable 6mm right lower lobe pulmonary nodule. No new pulmonary nodules. Lungs clear. Heart normal size. Degenerative thoracic spine changes. Incidental hepatic cyst.",
  impression: "Stable pulmonary nodule. Annual surveillance recommended. Benign hepatic cyst. Degenerative spine changes.",
  radiologist: "Dr. Michael Chen, MD",
  reportDate: "2025-12-02"
};

export default function AIClinicalWorkflowsPage() {
  const [viewMode, setViewMode] = useState<'patient' | 'provider'>('provider');
  const [trendParams, setTrendParams] = useState<TrendParameters>(DEFAULT_TREND_PARAMETERS);
  const [insightPrefs, setInsightPrefs] = useState<InsightPreferences>({ ...DEFAULT_INSIGHT_PREFERENCES, userId: SAMPLE_USER_ID });
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [riskGenerated, setRiskGenerated] = useState(false);
  const [imagingGenerated, setImagingGenerated] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const trendParamsQuery = useQuery<{ success: boolean; data: TrendParameters }>({
    queryKey: ["/api/ai-feedback/trend-params", SAMPLE_USER_ID],
    staleTime: 5 * 60 * 1000,
  });

  const insightPrefsQuery = useQuery<{ success: boolean; data: InsightPreferences }>({
    queryKey: ["/api/ai-feedback/preferences", SAMPLE_USER_ID],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (trendParamsQuery.data?.data) {
      setTrendParams(trendParamsQuery.data.data);
    }
  }, [trendParamsQuery.data]);

  useEffect(() => {
    if (insightPrefsQuery.data?.data) {
      setInsightPrefs(insightPrefsQuery.data.data);
    }
  }, [insightPrefsQuery.data]);

  const saveTrendParams = useMutation({
    mutationFn: async (params: TrendParameters) => {
      return apiRequest("POST", `/api/ai-feedback/trend-params/${SAMPLE_USER_ID}`, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-feedback/trend-params", SAMPLE_USER_ID] });
      toast({
        title: "Settings Saved",
        description: "Your trend analysis parameters have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save trend parameters.",
        variant: "destructive",
      });
    }
  });

  const saveInsightPrefs = useMutation({
    mutationFn: async (prefs: InsightPreferences) => {
      return apiRequest("POST", `/api/ai-feedback/preferences/${SAMPLE_USER_ID}`, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-feedback/preferences", SAMPLE_USER_ID] });
      toast({
        title: "Settings Saved",
        description: "Your insight preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save insight preferences.",
        variant: "destructive",
      });
    }
  });

  const handleTrendParamsApply = (params: TrendParameters) => {
    saveTrendParams.mutate(params);
  };

  const handleInsightPrefsApply = (prefs: InsightPreferences) => {
    saveInsightPrefs.mutate(prefs);
  };

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="ai-clinical-workflows-page">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-blue-500" />
            AI Clinical Workflows
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-enhanced tools for clinical documentation review and organization
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-1">
            <Info className="h-3 w-3" />
            Informational Only
          </Badge>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'patient' | 'provider')}>
            <SelectTrigger className="w-40" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="patient">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Patient View
                </div>
              </SelectItem>
              <SelectItem value="provider">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Provider View
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* NO-CDS Compliance Alert */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-200">Informational Purposes Only</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          All AI-generated content on this page is strictly for documentation review and organization purposes. 
          These tools do not provide clinical decision support, treatment recommendations, or medical advice. 
          All clinical decisions must be made by qualified healthcare providers.
        </AlertDescription>
      </Alert>

      {/* Workflow Tabs */}
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2" data-testid="tab-summary">
            <FileText className="h-4 w-4" />
            Patient Summary
          </TabsTrigger>
          <TabsTrigger value="risk" className="flex items-center gap-2" data-testid="tab-risk">
            <Shield className="h-4 w-4" />
            Risk Stratification
          </TabsTrigger>
          <TabsTrigger value="imaging" className="flex items-center gap-2" data-testid="tab-imaging">
            <Image className="h-4 w-4" />
            Imaging Analysis
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-settings">
            <Settings2 className="h-4 w-4" />
            AI Settings
          </TabsTrigger>
          <TabsTrigger value="audit-log" className="flex items-center gap-2" data-testid="tab-audit-log">
            <ClipboardList className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Patient Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                AI Patient Record Summarization
              </CardTitle>
              <CardDescription>
                Generate comprehensive patient record summaries from documented health information. 
                The AI organizes and presents existing documentation in an accessible format.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Sample Patient: {SAMPLE_PATIENT_DATA.demographics.name}</h4>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>{SAMPLE_PATIENT_DATA.demographics.age} years old</span>
                  <span>•</span>
                  <span>{SAMPLE_PATIENT_DATA.demographics.gender}</span>
                  <span>•</span>
                  <span>{SAMPLE_PATIENT_DATA.conditions.length} conditions</span>
                  <span>•</span>
                  <span>{SAMPLE_PATIENT_DATA.medications.length} medications</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <AIPatientSummaryPanel 
            patientId={SAMPLE_PATIENT_DATA.demographics.id}
            patientData={SAMPLE_PATIENT_DATA}
            showDisclaimer={true}
            onGenerated={() => setSummaryGenerated(true)}
          />

          {summaryGenerated && (
            <AIFeedbackControls
              feedbackType="document_summary"
              summaryId={`summary-${SAMPLE_PATIENT_DATA.demographics.id}`}
            />
          )}
        </TabsContent>

        {/* Risk Stratification Tab */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                AI Risk Factor Organization
              </CardTitle>
              <CardDescription>
                Organize documented risk factors from patient records into categories. 
                Risk scores reflect the presence of documented factors only - this is not predictive analytics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Risk Assessment for: {SAMPLE_PATIENT_DATA.demographics.name}</h4>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Age: {SAMPLE_RISK_DATA.demographics.age}</span>
                  <span>•</span>
                  <span>Conditions: {SAMPLE_RISK_DATA.conditions.length}</span>
                  <span>•</span>
                  <span>Medications: {SAMPLE_RISK_DATA.medications.length}</span>
                  <span>•</span>
                  <span>Recent Encounters: {SAMPLE_RISK_DATA.encounters.length}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <AIRiskStratificationPanel 
            patientId={SAMPLE_PATIENT_DATA.demographics.id}
            riskData={SAMPLE_RISK_DATA}
            showDisclaimer={true}
            onGenerated={() => setRiskGenerated(true)}
          />

          {riskGenerated && (
            <AIFeedbackControls
              feedbackType="copilot_insight"
              summaryId={`risk-${SAMPLE_PATIENT_DATA.demographics.id}`}
            />
          )}
        </TabsContent>

        {/* Imaging Analysis Tab */}
        <TabsContent value="imaging" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                AI Imaging Report Assistance
              </CardTitle>
              <CardDescription>
                Get plain-language explanations of imaging report findings. 
                The AI summarizes what the radiologist documented - it does not interpret images directly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium text-sm mb-2">Sample Study: {SAMPLE_IMAGING_STUDY.modality} {SAMPLE_IMAGING_STUDY.bodyPart}</h4>
                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                  <span>Date: {new Date(SAMPLE_IMAGING_STUDY.studyDate).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>Provider: {SAMPLE_IMAGING_STUDY.orderingProvider}</span>
                  <span>•</span>
                  <span>Status: {SAMPLE_IMAGING_STUDY.status}</span>
                </div>
                <p className="text-sm mt-2">Indication: {SAMPLE_IMAGING_STUDY.indication}</p>
              </div>
            </CardContent>
          </Card>

          <AIImagingAnalysisPanel 
            study={SAMPLE_IMAGING_STUDY}
            report={SAMPLE_IMAGING_REPORT}
            viewMode={viewMode}
            showDisclaimer={true}
            onGenerated={() => setImagingGenerated(true)}
          />

          {imagingGenerated && (
            <AIFeedbackControls
              feedbackType="imaging_summary"
              summaryId={`imaging-${SAMPLE_IMAGING_STUDY.id}`}
            />
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                AI Analysis Settings
              </CardTitle>
              <CardDescription>
                Customize how AI generates insights and summaries. These settings help personalize 
                the analysis to your preferences and use case.
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <AITrendParameters
              parameters={trendParams}
              onChange={setTrendParams}
              onApply={handleTrendParamsApply}
            />

            <AIInsightPreferences
              preferences={insightPrefs}
              onChange={setInsightPrefs}
              onApply={handleInsightPrefsApply}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Current Settings Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sensitivity:</span>
                <Badge variant="outline" className="capitalize" data-testid="badge-setting-sensitivity">{trendParams.sensitivity}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Timeframe:</span>
                <Badge variant="outline" data-testid="badge-setting-timeframe">{trendParams.timeframeDays} days</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detail Level:</span>
                <Badge variant="outline" className="capitalize" data-testid="badge-setting-detail">{insightPrefs.detailLevel}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language:</span>
                <Badge variant="outline" className="capitalize" data-testid="badge-setting-language">{insightPrefs.language}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Highlight Critical:</span>
                <Badge variant={insightPrefs.highlightCritical ? "default" : "outline"} data-testid="badge-setting-highlight">
                  {insightPrefs.highlightCritical ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit-log" className="space-y-4" data-testid="tab-content-audit-log">
          <AIAuditLogViewer />
        </TabsContent>
      </Tabs>

      {/* Footer Disclaimer */}
      <div className="text-center text-xs text-muted-foreground p-4 border-t">
        <p>
          All AI-generated content is for informational and documentation review purposes only. 
          This system is strictly NO-CDS compliant and does not provide clinical decision support, 
          treatment recommendations, or medical advice.
        </p>
      </div>
    </div>
  );
}
