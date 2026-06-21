import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  TestTubes,
  Pill,
  Stethoscope,
  Syringe,
  AlertTriangle,
  ImageIcon,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  ExternalLink,
  Search,
  Shield,
  ChevronDown,
  ChevronUp,
  Eye,
  Clock,
  User,
  FileText,
} from "lucide-react";

interface LabResult {
  id: string;
  testName: string;
  value: number;
  unit: string;
  referenceRange: { low: number; high: number };
  date: string;
  flag: "normal" | "high" | "low" | "critical";
  source: string;
  loincCode: string;
  trend: number[];
}

interface Medication {
  id: string;
  drugName: string;
  dose: string;
  prescriber: string;
  dateWritten: string;
  status: "active" | "stopped" | "hold";
  rxNormCode: string;
}

interface Condition {
  id: string;
  name: string;
  icd10Code: string;
  onsetDate: string;
  status: "active" | "resolved" | "recurrence";
  clinicalStatus: string;
}

interface Immunization {
  id: string;
  vaccineName: string;
  date: string;
  lotNumber: string;
  cvxCode: string;
  overdue: boolean;
  nextDue?: string;
}

interface Allergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
  clinicalStatus: string;
}

interface Procedure {
  id: string;
  name: string;
  cdtCode: string;
  date: string;
  provider: string;
  category: "dental" | "surgical" | "diagnostic";
}

interface ImagingStudy {
  id: string;
  studyType: string;
  modality: string;
  date: string;
  bodyPart: string;
  status: string;
  hasReport: boolean;
}

const SPECIALTY_HINTS: Record<string, { cptCode: string; specialty: string; price: number }> = {
  "HbA1c": { cptCode: "99213", specialty: "endocrinology", price: 82 },
  "LDL": { cptCode: "99213", specialty: "cardiology", price: 82 },
  "HDL": { cptCode: "99213", specialty: "cardiology", price: 82 },
  "TSH": { cptCode: "99213", specialty: "endocrinology", price: 82 },
  "Total Cholesterol": { cptCode: "99213", specialty: "cardiology", price: 82 },
  "Triglycerides": { cptCode: "99213", specialty: "cardiology", price: 82 },
  "Glucose": { cptCode: "99213", specialty: "endocrinology", price: 82 },
  "Creatinine": { cptCode: "99213", specialty: "nephrology", price: 82 },
  "ALT": { cptCode: "99213", specialty: "hepatology", price: 82 },
  "AST": { cptCode: "99213", specialty: "hepatology", price: 82 },
  "WBC": { cptCode: "99213", specialty: "hematology", price: 82 },
  "Hemoglobin": { cptCode: "99213", specialty: "hematology", price: 82 },
  "Platelets": { cptCode: "99213", specialty: "hematology", price: 82 },
  "PSA": { cptCode: "99213", specialty: "urology", price: 82 },
};

const SAMPLE_LABS: LabResult[] = [
  { id: "lab-1", testName: "HbA1c", value: 6.8, unit: "%", referenceRange: { low: 4.0, high: 5.6 }, date: "2026-03-15", flag: "high", source: "Quest Diagnostics", loincCode: "4548-4", trend: [5.4, 5.7, 6.1, 6.5, 6.8] },
  { id: "lab-2", testName: "LDL", value: 142, unit: "mg/dL", referenceRange: { low: 0, high: 100 }, date: "2026-03-15", flag: "high", source: "Quest Diagnostics", loincCode: "2089-1", trend: [110, 118, 125, 138, 142] },
  { id: "lab-3", testName: "HDL", value: 58, unit: "mg/dL", referenceRange: { low: 40, high: 200 }, date: "2026-03-15", flag: "normal", source: "Quest Diagnostics", loincCode: "2085-9", trend: [62, 60, 59, 58, 58] },
  { id: "lab-4", testName: "TSH", value: 2.1, unit: "mIU/L", referenceRange: { low: 0.4, high: 4.0 }, date: "2026-02-28", flag: "normal", source: "LabCorp", loincCode: "3016-3", trend: [1.8, 2.0, 2.1] },
  { id: "lab-5", testName: "Glucose", value: 126, unit: "mg/dL", referenceRange: { low: 70, high: 99 }, date: "2026-03-15", flag: "high", source: "Quest Diagnostics", loincCode: "2345-7", trend: [95, 102, 112, 118, 126] },
  { id: "lab-6", testName: "Creatinine", value: 0.9, unit: "mg/dL", referenceRange: { low: 0.7, high: 1.3 }, date: "2026-03-15", flag: "normal", source: "Quest Diagnostics", loincCode: "2160-0", trend: [0.8, 0.9, 0.9] },
  { id: "lab-7", testName: "WBC", value: 11.2, unit: "K/uL", referenceRange: { low: 4.5, high: 11.0 }, date: "2026-01-20", flag: "high", source: "LabCorp", loincCode: "6690-2", trend: [7.2, 8.1, 9.5, 11.2] },
  { id: "lab-8", testName: "Hemoglobin", value: 14.2, unit: "g/dL", referenceRange: { low: 12.0, high: 17.5 }, date: "2026-01-20", flag: "normal", source: "LabCorp", loincCode: "718-7", trend: [13.8, 14.0, 14.2] },
];

const SAMPLE_MEDS: Medication[] = [
  { id: "med-1", drugName: "Metformin", dose: "500mg twice daily", prescriber: "Dr. Sarah Chen", dateWritten: "2025-11-01", status: "active", rxNormCode: "6809" },
  { id: "med-2", drugName: "Lisinopril", dose: "10mg daily", prescriber: "Dr. Sarah Chen", dateWritten: "2025-11-01", status: "active", rxNormCode: "29046" },
  { id: "med-3", drugName: "Atorvastatin", dose: "20mg daily", prescriber: "Dr. James Park", dateWritten: "2025-08-15", status: "active", rxNormCode: "83367" },
  { id: "med-4", drugName: "Omeprazole", dose: "20mg daily", prescriber: "Dr. Sarah Chen", dateWritten: "2025-06-10", status: "stopped", rxNormCode: "7646" },
  { id: "med-5", drugName: "Amoxicillin", dose: "500mg three times daily", prescriber: "Dr. Lisa Wong", dateWritten: "2025-04-20", status: "stopped", rxNormCode: "723" },
];

const SAMPLE_CONDITIONS: Condition[] = [
  { id: "cond-1", name: "Type 2 Diabetes Mellitus", icd10Code: "E11.9", onsetDate: "2024-03-10", status: "active", clinicalStatus: "Active" },
  { id: "cond-2", name: "Essential Hypertension", icd10Code: "I10", onsetDate: "2023-06-15", status: "active", clinicalStatus: "Active" },
  { id: "cond-3", name: "Hyperlipidemia", icd10Code: "E78.5", onsetDate: "2023-08-20", status: "active", clinicalStatus: "Active" },
  { id: "cond-4", name: "Acute Bronchitis", icd10Code: "J20.9", onsetDate: "2025-02-10", status: "resolved", clinicalStatus: "Resolved" },
  { id: "cond-5", name: "Seasonal Allergic Rhinitis", icd10Code: "J30.2", onsetDate: "2022-04-01", status: "recurrence", clinicalStatus: "Recurrence" },
];

const SAMPLE_IMMUNIZATIONS: Immunization[] = [
  { id: "imm-1", vaccineName: "Tdap (Tetanus, Diphtheria, Pertussis)", date: "2023-03-15", lotNumber: "AC94B218", cvxCode: "115", overdue: false, nextDue: "2033-03-15" },
  { id: "imm-2", vaccineName: "Influenza (2025-2026)", date: "2025-10-08", lotNumber: "UH749AB", cvxCode: "197", overdue: false },
  { id: "imm-3", vaccineName: "COVID-19 (Updated 2025)", date: "2025-09-20", lotNumber: "FL8271A", cvxCode: "309", overdue: false },
  { id: "imm-4", vaccineName: "Shingles (Shingrix) Dose 2", date: "", lotNumber: "", cvxCode: "187", overdue: true, nextDue: "2025-12-01" },
  { id: "imm-5", vaccineName: "Pneumococcal (PCV20)", date: "2024-01-10", lotNumber: "PN320C", cvxCode: "216", overdue: false },
];

const SAMPLE_ALLERGIES: Allergy[] = [
  { id: "alg-1", allergen: "Penicillin", reaction: "Rash, Urticaria", severity: "moderate", clinicalStatus: "Active" },
  { id: "alg-2", allergen: "Shellfish", reaction: "Anaphylaxis", severity: "severe", clinicalStatus: "Active" },
  { id: "alg-3", allergen: "Sulfa drugs", reaction: "GI distress", severity: "mild", clinicalStatus: "Active" },
];

const SAMPLE_PROCEDURES: Procedure[] = [
  { id: "proc-1", name: "Periodic oral evaluation", cdtCode: "D0120", date: "2026-02-10", provider: "Dr. Kim, DDS", category: "dental" },
  { id: "proc-2", name: "Dental prophylaxis (cleaning)", cdtCode: "D1110", date: "2026-02-10", provider: "Dr. Kim, DDS", category: "dental" },
  { id: "proc-3", name: "Bitewing radiographs (4 films)", cdtCode: "D0274", date: "2026-02-10", provider: "Dr. Kim, DDS", category: "dental" },
];

const SAMPLE_IMAGING: ImagingStudy[] = [
  { id: "img-1", studyType: "Chest X-Ray PA & Lateral", modality: "CR", date: "2025-12-05", bodyPart: "Chest", status: "available", hasReport: true },
  { id: "img-2", studyType: "MRI Lumbar Spine w/o Contrast", modality: "MR", date: "2025-08-20", bodyPart: "Lumbar Spine", status: "available", hasReport: true },
];

function FlagBadge({ flag }: { flag: string }) {
  const config: Record<string, { variant: "destructive" | "default" | "secondary" | "outline"; label: string }> = {
    high: { variant: "destructive", label: "HIGH" },
    low: { variant: "default", label: "LOW" },
    critical: { variant: "destructive", label: "CRITICAL" },
    normal: { variant: "secondary", label: "Normal" },
  };
  const c = config[flag] || config.normal;
  return <Badge variant={c.variant} className="text-[10px]" data-testid={`badge-flag-${flag}`}>{c.label}</Badge>;
}

function MiniSparkline({ values, flag }: { values: number[]; flag: string }) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const h = 24;
  const w = 60;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const color = flag === "high" || flag === "critical" ? "#ef4444" : flag === "low" ? "#f59e0b" : "#22c55e";
  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function LabResultCard({ lab }: { lab: LabResult }) {
  const hint = SPECIALTY_HINTS[lab.testName];
  const TrendIcon = lab.flag === "high" ? TrendingUp : lab.flag === "low" ? TrendingDown : Minus;

  return (
    <Card className={`${lab.flag === "critical" ? "border-red-500 bg-red-50 dark:bg-red-950/30" : lab.flag === "high" ? "border-amber-300" : ""}`} data-testid={`lab-card-${lab.id}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{lab.testName}</span>
              <FlagBadge flag={lab.flag} />
              <MiniSparkline values={lab.trend} flag={lab.flag} />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-xl font-bold ${lab.flag === "high" || lab.flag === "critical" ? "text-red-600" : lab.flag === "low" ? "text-amber-600" : ""}`}>
                {lab.value}
              </span>
              <span className="text-xs text-muted-foreground">{lab.unit}</span>
              <span className="text-xs text-muted-foreground ml-2">
                Ref: {lab.referenceRange.low}–{lab.referenceRange.high}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{lab.date}</span>
              <span>{lab.source}</span>
              <span className="font-mono text-[10px]">LOINC: {lab.loincCode}</span>
            </div>
          </div>
          <TrendIcon className={`w-4 h-4 mt-1 ${lab.flag === "high" ? "text-red-500" : lab.flag === "low" ? "text-amber-500" : "text-green-500"}`} />
        </div>
        {hint && lab.flag !== "normal" && (
          <div className="mt-2 pt-2 border-t">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200"
              data-testid={`button-book-followup-${lab.id}`}
              onClick={async () => {
                try {
                  const resp = await fetch("/api/shared/cross-app/generate-link", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      saidPatientId: "SAID-PENDING",
                      cptCode: hint.cptCode,
                      specialty: hint.specialty,
                    }),
                  });
                  const data = await resp.json();
                  window.open(data.url || `https://uninsurance.care/book?cpt=${hint.cptCode}&specialty=${hint.specialty}`, "_blank");
                } catch {
                  window.open(`https://uninsurance.care/book?cpt=${hint.cptCode}&specialty=${hint.specialty}`, "_blank");
                }
              }}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Book follow-up at ${hint.price} · {hint.specialty}
              <span className="ml-1 font-mono text-[9px]">CPT {hint.cptCode}</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MedicationCard({ med }: { med: Medication }) {
  return (
    <Card className={med.status === "stopped" ? "opacity-60" : ""} data-testid={`med-card-${med.id}`}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Pill className={`w-4 h-4 ${med.status === "active" ? "text-green-500" : "text-gray-400"}`} />
              <span className="font-semibold text-sm">{med.drugName}</span>
              <Badge variant={med.status === "active" ? "default" : "secondary"} className="text-[10px]">
                {med.status === "active" ? "Active" : "Stopped"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{med.dose}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{med.prescriber}</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{med.dateWritten}</span>
              <span className="font-mono text-[10px]">RxNorm: {med.rxNormCode}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HealthRecordsDisplay() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showResolvedConditions, setShowResolvedConditions] = useState(false);

  const severeAllergies = SAMPLE_ALLERGIES.filter((a) => a.severity === "severe");
  const overdueVaccines = SAMPLE_IMMUNIZATIONS.filter((i) => i.overdue);
  const flaggedLabs = SAMPLE_LABS.filter((l) => l.flag !== "normal");

  const activeConditions = SAMPLE_CONDITIONS.filter((c) => c.status === "active" || c.status === "recurrence");
  const resolvedConditions = SAMPLE_CONDITIONS.filter((c) => c.status === "resolved");

  return (
    <div className="min-h-screen bg-background">
      {severeAllergies.length > 0 && (
        <div className="bg-red-600 text-white px-4 py-2" data-testid="allergy-banner">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">Severe Allergy Alert:</span>
            {severeAllergies.map((a) => (
              <Badge key={a.id} variant="outline" className="text-white border-white/50 text-xs">
                {a.allergen} — {a.reaction}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-records-title">
              Health Records
            </h1>
            <p className="text-muted-foreground mt-1">
              Your unified medical records from all connected sources
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950 px-3 py-1">
              <Shield className="w-3 h-3 mr-1" />
              FHIR R4
            </Badge>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search records..."
                className="pl-9 w-64"
                data-testid="input-search-records"
              />
            </div>
          </div>
        </div>

        {(flaggedLabs.length > 0 || overdueVaccines.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flaggedLabs.length > 0 && (
              <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-flagged-summary">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold">{flaggedLabs.length} Flagged Lab Results</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {flaggedLabs.map((l) => l.testName).join(", ")} — review recommended
                  </p>
                </CardContent>
              </Card>
            )}
            {overdueVaccines.length > 0 && (
              <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20" data-testid="card-overdue-vaccines">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2">
                    <Syringe className="w-5 h-5 text-amber-500" />
                    <span className="font-semibold">{overdueVaccines.length} Overdue Vaccine{overdueVaccines.length > 1 ? "s" : ""}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {overdueVaccines.map((v) => v.vaccineName.split(" (")[0]).join(", ")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        <Tabs defaultValue="labs" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-records">
            <TabsTrigger value="labs" data-testid="tab-labs"><TestTubes className="w-4 h-4 mr-1" />Labs</TabsTrigger>
            <TabsTrigger value="medications" data-testid="tab-medications"><Pill className="w-4 h-4 mr-1" />Medications</TabsTrigger>
            <TabsTrigger value="conditions" data-testid="tab-conditions"><Stethoscope className="w-4 h-4 mr-1" />Conditions</TabsTrigger>
            <TabsTrigger value="immunizations" data-testid="tab-immunizations"><Syringe className="w-4 h-4 mr-1" />Immunizations</TabsTrigger>
            <TabsTrigger value="allergies" data-testid="tab-allergies"><AlertTriangle className="w-4 h-4 mr-1" />Allergies</TabsTrigger>
            <TabsTrigger value="procedures" data-testid="tab-procedures"><FileText className="w-4 h-4 mr-1" />Procedures</TabsTrigger>
            <TabsTrigger value="imaging" data-testid="tab-imaging"><ImageIcon className="w-4 h-4 mr-1" />Imaging</TabsTrigger>
          </TabsList>

          <TabsContent value="labs" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TestTubes className="w-5 h-5 text-blue-500" />
                Lab Results (Observations)
              </h2>
              <Badge variant="secondary">{SAMPLE_LABS.length} results</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_LABS.filter((l) => !searchTerm || l.testName.toLowerCase().includes(searchTerm.toLowerCase())).map((lab) => (
                <LabResultCard key={lab.id} lab={lab} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="medications" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Pill className="w-5 h-5 text-green-500" />
                Medications
              </h2>
              <Badge variant="secondary">{SAMPLE_MEDS.length} medications</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SAMPLE_MEDS.filter((m) => !searchTerm || m.drugName.toLowerCase().includes(searchTerm.toLowerCase())).map((med) => (
                <MedicationCard key={med.id} med={med} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="conditions" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-purple-500" />
                Conditions & Diagnoses
              </h2>
              <Badge variant="secondary">{SAMPLE_CONDITIONS.length} conditions</Badge>
            </div>
            <div className="space-y-2">
              {activeConditions.map((cond) => (
                <Card key={cond.id} data-testid={`condition-card-${cond.id}`}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${cond.status === "active" ? "bg-red-500" : "bg-amber-500"}`} />
                        <div>
                          <span className="font-semibold text-sm">{cond.name}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{cond.icd10Code}</span>
                            <span>Onset: {cond.onsetDate}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={cond.status === "active" ? "destructive" : "default"} className="text-[10px]">
                        {cond.clinicalStatus}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {resolvedConditions.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => setShowResolvedConditions(!showResolvedConditions)}
                    data-testid="button-toggle-resolved"
                  >
                    {showResolvedConditions ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
                    {resolvedConditions.length} Resolved Condition{resolvedConditions.length > 1 ? "s" : ""}
                  </Button>
                  {showResolvedConditions && resolvedConditions.map((cond) => (
                    <Card key={cond.id} className="opacity-60" data-testid={`condition-card-${cond.id}`}>
                      <CardContent className="pt-3 pb-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <div>
                              <span className="font-semibold text-sm">{cond.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="font-mono">{cond.icd10Code}</span>
                                <span>Onset: {cond.onsetDate}</span>
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Resolved</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="immunizations" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Syringe className="w-5 h-5 text-teal-500" />
                Immunizations
              </h2>
              <Badge variant="secondary">{SAMPLE_IMMUNIZATIONS.length} vaccines</Badge>
            </div>
            <div className="space-y-2">
              {SAMPLE_IMMUNIZATIONS.map((imm) => (
                <Card key={imm.id} className={imm.overdue ? "border-amber-300 bg-amber-50/30 dark:bg-amber-950/20" : ""} data-testid={`imm-card-${imm.id}`}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{imm.vaccineName}</span>
                          {imm.overdue && (
                            <Badge variant="default" className="text-[10px] bg-amber-500">OVERDUE</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          {imm.date ? (
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{imm.date}</span>
                          ) : (
                            <span className="text-amber-600">Not yet administered</span>
                          )}
                          {imm.lotNumber && <span>Lot: {imm.lotNumber}</span>}
                          <span className="font-mono text-[10px]">CVX: {imm.cvxCode}</span>
                        </div>
                      </div>
                      {imm.nextDue && (
                        <div className="text-right text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Next: {imm.nextDue}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="allergies" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Allergies & Intolerances
              </h2>
              <Badge variant="secondary">{SAMPLE_ALLERGIES.length} allergies</Badge>
            </div>
            <div className="space-y-2">
              {SAMPLE_ALLERGIES.sort((a, b) => {
                const sev = { severe: 0, moderate: 1, mild: 2 };
                return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3);
              }).map((allergy) => (
                <Card
                  key={allergy.id}
                  className={allergy.severity === "severe" ? "border-red-400 bg-red-50 dark:bg-red-950/30" : ""}
                  data-testid={`allergy-card-${allergy.id}`}
                >
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{allergy.allergen}</span>
                          <Badge
                            variant={allergy.severity === "severe" ? "destructive" : allergy.severity === "moderate" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {allergy.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Reaction: {allergy.reaction}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{allergy.clinicalStatus}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="procedures" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                Procedures (incl. Dental)
              </h2>
              <Badge variant="secondary">{SAMPLE_PROCEDURES.length} procedures</Badge>
            </div>
            <div className="space-y-2">
              {SAMPLE_PROCEDURES.map((proc) => (
                <Card key={proc.id} data-testid={`procedure-card-${proc.id}`}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{proc.name}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="font-mono text-gray-400">{proc.cdtCode}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{proc.date}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{proc.provider}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{proc.category}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="imaging" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-cyan-500" />
                Imaging Studies
              </h2>
              <Badge variant="secondary">{SAMPLE_IMAGING.length} studies</Badge>
            </div>
            <div className="space-y-2">
              {SAMPLE_IMAGING.map((study) => (
                <Card key={study.id} data-testid={`imaging-card-${study.id}`}>
                  <CardContent className="pt-3 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm">{study.studyType}</span>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <Badge variant="outline" className="text-[10px]">{study.modality}</Badge>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{study.date}</span>
                          <span>{study.bodyPart}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        data-testid={`button-view-images-${study.id}`}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View Images
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
