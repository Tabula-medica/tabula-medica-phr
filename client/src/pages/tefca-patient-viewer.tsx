import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Download,
  Activity,
  Pill,
  Stethoscope,
  Search,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Calendar,
  Heart,
  Thermometer,
  FlaskConical,
  Eye,
  Info,
} from "lucide-react";

interface FHIRCondition {
  id: string;
  clinicalStatus: string;
  verificationStatus: string;
  category: string;
  code: { text: string; coding: { system: string; code: string; display: string }[] };
  onsetDateTime: string;
  abatementDateTime?: string;
  recordedDate: string;
  recorder: string;
  severity?: string;
  bodySite?: string;
  note?: string;
}

interface FHIRMedication {
  id: string;
  status: string;
  medicationCodeableConcept: { text: string; coding: { system: string; code: string; display: string }[] };
  dosageInstruction: string;
  route: string;
  frequency: string;
  authoredOn: string;
  requester: string;
  reasonCode?: string;
  note?: string;
}

interface FHIRObservation {
  id: string;
  status: string;
  category: string;
  code: { text: string; coding: { system: string; code: string; display: string }[] };
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string };
  valueString?: string;
  interpretation?: string;
  referenceRange?: { low?: string; high?: string; text?: string };
  performer: string;
  note?: string;
}

interface PatientFHIRData {
  patient: {
    id: string;
    name: string;
    birthDate: string;
    gender: string;
    identifier: string;
    address: string;
    telecom: string;
  };
  conditions: FHIRCondition[];
  medications: FHIRMedication[];
  observations: FHIRObservation[];
  metadata: {
    queryId: string;
    sourceQHINs: string[];
    retrievedAt: string;
    totalDocuments: number;
    fhirVersion: string;
    disclaimer: string;
  };
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    resolved: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    stopped: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    final: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[status] || "bg-gray-100 text-gray-600"}`} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InterpretationBadge({ interpretation }: { interpretation?: string }) {
  if (!interpretation) return null;
  const colorMap: Record<string, string> = {
    Normal: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
    High: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    Overweight: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    "Above optimal": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    "Near optimal": "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
    "Borderline high": "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorMap[interpretation] || "bg-gray-50 text-gray-600 border-gray-200"}`}>
      {interpretation}
    </span>
  );
}

function PatientHeader({ patient, metadata }: { patient: PatientFHIRData["patient"]; metadata: PatientFHIRData["metadata"] }) {
  return (
    <Card className="border-l-4 border-l-blue-500" data-testid="card-patient-header">
      <CardContent className="pt-5 pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground" data-testid="text-patient-name">{patient.name}</h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> DOB: {patient.birthDate}</span>
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {patient.gender}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {patient.address}</span>
                <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {patient.identifier}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs">{metadata.fhirVersion}</Badge>
            <span>Sources: {metadata.sourceQHINs.join(", ")}</span>
            <span>Retrieved: {new Date(metadata.retrievedAt).toLocaleString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConditionsTab({ conditions }: { conditions: FHIRCondition[] }) {
  const [search, setSearch] = useState("");
  const filtered = conditions.filter(c =>
    c.code.text.toLowerCase().includes(search.toLowerCase()) ||
    c.recorder.toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(c => c.clinicalStatus === "active");
  const resolved = filtered.filter(c => c.clinicalStatus !== "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search conditions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-conditions" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} condition{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Active Conditions</h3>
          {active.map(c => (
            <Card key={c.id} className="hover:shadow-md transition-shadow" data-testid={`card-condition-${c.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Stethoscope className="h-4 w-4 text-blue-500" />
                      <span className="font-medium text-foreground">{c.code.text}</span>
                      <StatusBadge status={c.clinicalStatus} />
                      {c.severity && <Badge variant="outline" className="text-xs">{c.severity}</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5 ml-6">
                      <p><Clock className="h-3 w-3 inline mr-1" />Onset: {c.onsetDateTime} | Recorded by: {c.recorder}</p>
                      {c.bodySite && <p>Body site: {c.bodySite}</p>}
                      {c.note && <p className="text-xs italic mt-1">{c.note}</p>}
                      <p className="text-xs text-muted-foreground/60">SNOMED CT: {c.code.coding[0]?.code}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Resolved / Inactive</h3>
          {resolved.map(c => (
            <Card key={c.id} className="opacity-75 hover:opacity-100 transition-opacity" data-testid={`card-condition-${c.id}`}>
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope className="h-4 w-4 text-slate-400" />
                  <span className="font-medium text-muted-foreground">{c.code.text}</span>
                  <StatusBadge status={c.clinicalStatus} />
                </div>
                <div className="text-sm text-muted-foreground ml-6 space-y-0.5">
                  <p>Onset: {c.onsetDateTime}{c.abatementDateTime ? ` — Resolved: ${c.abatementDateTime}` : ""}</p>
                  <p>Recorded by: {c.recorder}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No conditions found{search ? " matching your search" : ""}</p>
        </div>
      )}
    </div>
  );
}

function MedicationsTab({ medications }: { medications: FHIRMedication[] }) {
  const [search, setSearch] = useState("");
  const filtered = medications.filter(m =>
    m.medicationCodeableConcept.text.toLowerCase().includes(search.toLowerCase()) ||
    m.requester.toLowerCase().includes(search.toLowerCase()) ||
    (m.reasonCode || "").toLowerCase().includes(search.toLowerCase())
  );
  const active = filtered.filter(m => m.status === "active");
  const inactive = filtered.filter(m => m.status !== "active");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search medications..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-medications" />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} medication{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {active.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Current Medications</h3>
          {active.map(m => (
            <Card key={m.id} className="hover:shadow-md transition-shadow" data-testid={`card-medication-${m.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pill className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-foreground">{m.medicationCodeableConcept.text}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p className="font-medium text-foreground/80">{m.dosageInstruction}</p>
                      <p>{m.route} | {m.frequency} | Since {m.authoredOn}</p>
                      <p>Prescriber: {m.requester}{m.reasonCode ? ` | For: ${m.reasonCode}` : ""}</p>
                      {m.note && <p className="text-xs italic mt-1">{m.note}</p>}
                      <p className="text-xs text-muted-foreground/60">RxNorm: {m.medicationCodeableConcept.coding[0]?.code}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Medications</h3>
          {inactive.map(m => (
            <Card key={m.id} className="opacity-75 hover:opacity-100 transition-opacity" data-testid={`card-medication-${m.id}`}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pill className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-muted-foreground">{m.medicationCodeableConcept.text}</span>
                      <StatusBadge status={m.status} />
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>{m.dosageInstruction}</p>
                      <p>Prescribed: {m.authoredOn} | {m.requester}</p>
                      {m.note && <p className="text-xs italic">{m.note}</p>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Pill className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No medications found{search ? " matching your search" : ""}</p>
        </div>
      )}
    </div>
  );
}

function ObservationsTab({ observations }: { observations: FHIRObservation[] }) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = observations.filter(o => {
    const matchesSearch = o.code.text.toLowerCase().includes(search.toLowerCase()) ||
      o.performer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || o.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const vitalSigns = filtered.filter(o => o.category === "vital-signs");
  const labResults = filtered.filter(o => o.category === "laboratory");

  const categoryIcon = (cat: string) => {
    switch (cat) {
      case "vital-signs": return <Heart className="h-4 w-4 text-red-500" />;
      case "laboratory": return <FlaskConical className="h-4 w-4 text-amber-500" />;
      default: return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const renderObservation = (o: FHIRObservation) => {
    const value = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit}` : o.valueString || "N/A";
    return (
      <Card key={o.id} className="hover:shadow-md transition-shadow" data-testid={`card-observation-${o.id}`}>
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
              {categoryIcon(o.category)}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{o.code.text}</span>
                  <InterpretationBadge interpretation={o.interpretation} />
                </div>
                <span className="text-lg font-semibold text-foreground whitespace-nowrap" data-testid={`text-value-${o.id}`}>{value}</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>{new Date(o.effectiveDateTime).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} | {o.performer}</p>
                {o.referenceRange?.text && (
                  <p className="text-xs flex items-center gap-1"><Info className="h-3 w-3" />Ref: {o.referenceRange.text}</p>
                )}
                {!o.referenceRange?.text && (o.referenceRange?.low || o.referenceRange?.high) && (
                  <p className="text-xs flex items-center gap-1"><Info className="h-3 w-3" />Range: {o.referenceRange.low || "—"} – {o.referenceRange.high || "—"}</p>
                )}
                {o.note && <p className="text-xs italic mt-1">{o.note}</p>}
                <p className="text-xs text-muted-foreground/60">LOINC: {o.code.coding[0]?.code}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search observations..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-observations" />
        </div>
        <div className="flex items-center gap-2">
          {["all", "vital-signs", "laboratory"].map(cat => (
            <Button
              key={cat}
              variant={categoryFilter === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setCategoryFilter(cat)}
              data-testid={`button-filter-${cat}`}
            >
              {cat === "all" ? "All" : cat === "vital-signs" ? "Vital Signs" : "Lab Results"}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {categoryFilter === "all" ? (
        <>
          {vitalSigns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" /> Vital Signs
              </h3>
              {vitalSigns.map(renderObservation)}
            </div>
          )}
          {labResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-amber-500" /> Laboratory Results
              </h3>
              {labResults.map(renderObservation)}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {filtered.map(renderObservation)}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No observations found{search ? " matching your search" : ""}</p>
        </div>
      )}
    </div>
  );
}

export default function TEFCAPatientViewer() {
  const [patientId] = useState("pat-demo-001");
  const [downloading, setDownloading] = useState(false);

  const { data, isLoading, error } = useQuery<PatientFHIRData>({
    queryKey: ["/api/tefca-patient-viewer", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/tefca-patient-viewer/${patientId}`);
      if (!res.ok) throw new Error("Failed to fetch patient data");
      return res.json();
    },
  });

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/tefca-patient-viewer/${patientId}/pdf`);
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `health-record-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Failed to load patient health records. Please try again later.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" data-testid="page-tefca-patient-viewer">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Eye className="h-6 w-6 text-blue-500" />
            Patient Health Record Viewer
          </h1>
          <p className="text-sm text-muted-foreground mt-1">FHIR R4 data retrieved via TEFCA exchange network</p>
        </div>
        <Button onClick={handleDownloadPDF} disabled={downloading} className="gap-2" data-testid="button-download-pdf">
          <Download className="h-4 w-4" />
          {downloading ? "Generating PDF..." : "Download as PDF"}
        </Button>
      </div>

      <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-300 text-xs">
          {data.metadata.disclaimer}
        </AlertDescription>
      </Alert>

      <PatientHeader patient={data.patient} metadata={data.metadata} />

      <div className="grid grid-cols-3 gap-4">
        <Card data-testid="card-summary-conditions">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Stethoscope className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data.conditions.length}</p>
              <p className="text-xs text-muted-foreground">Conditions ({data.conditions.filter(c => c.clinicalStatus === "active").length} active)</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-summary-medications">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Pill className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data.medications.length}</p>
              <p className="text-xs text-muted-foreground">Medications ({data.medications.filter(m => m.status === "active").length} current)</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-summary-observations">
          <CardContent className="py-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <Activity className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data.observations.length}</p>
              <p className="text-xs text-muted-foreground">Observations ({data.observations.filter(o => o.category === "laboratory").length} lab)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="conditions" className="w-full">
        <TabsList className="grid w-full grid-cols-3" data-testid="tabs-fhir-data">
          <TabsTrigger value="conditions" className="gap-2" data-testid="tab-conditions">
            <Stethoscope className="h-4 w-4" /> Conditions
          </TabsTrigger>
          <TabsTrigger value="medications" className="gap-2" data-testid="tab-medications">
            <Pill className="h-4 w-4" /> Medications
          </TabsTrigger>
          <TabsTrigger value="observations" className="gap-2" data-testid="tab-observations">
            <Activity className="h-4 w-4" /> Observations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conditions" className="mt-4">
          <ConditionsTab conditions={data.conditions} />
        </TabsContent>
        <TabsContent value="medications" className="mt-4">
          <MedicationsTab medications={data.medications} />
        </TabsContent>
        <TabsContent value="observations" className="mt-4">
          <ObservationsTab observations={data.observations} />
        </TabsContent>
      </Tabs>

      <Separator />
      <div className="text-center text-xs text-muted-foreground space-y-1 pb-6">
        <p>Query ID: {data.metadata.queryId} | FHIR {data.metadata.fhirVersion}</p>
        <p>Sources: {data.metadata.sourceQHINs.join(" | ")}</p>
      </div>
    </div>
  );
}
