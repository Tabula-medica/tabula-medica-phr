import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Pill,
  AlertTriangle,
  TestTube,
  FileImage,
  ClipboardList,
  Database,
  QrCode,
  Link2,
  Clock,
  CheckCircle,
  Copy,
  Share2,
  Shield,
  User,
  Building,
  Eye,
  Timer,
  Check,
  Printer,
} from "lucide-react";

interface Medication {
  name: string;
  dose: string;
  frequency: string;
  status: "taking" | "confirmed";
  source: string;
  lastUpdated: string;
}

interface Allergy {
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
  source: string;
}

interface LabResult {
  test: string;
  value: string;
  unit: string;
  reference: string;
  flag?: "high" | "low" | "critical";
  date: string;
  source: string;
}

interface ImagingResult {
  study: string;
  impression: string;
  date: string;
  source: string;
}

interface Problem {
  condition: string;
  status: "active" | "resolved";
  onset?: string;
  source: string;
}

interface DataSource {
  name: string;
  type: string;
  lastSync: string;
  recordCount: number;
}

const mockPatient = {
  name: "Michael Johnson",
  dob: "1978-03-15",
  age: 47,
  gender: "Male",
  lastUpdated: "2026-01-18T10:30:00Z",
};

const mockMedications: Medication[] = [
  { name: "Lisinopril", dose: "10mg", frequency: "Once daily", status: "confirmed", source: "Fasten Health", lastUpdated: "2026-01-15" },
  { name: "Metformin", dose: "500mg", frequency: "Twice daily", status: "confirmed", source: "Patient Confirmed", lastUpdated: "2026-01-10" },
  { name: "Atorvastatin", dose: "20mg", frequency: "Once daily at bedtime", status: "taking", source: "Fasten Health", lastUpdated: "2026-01-15" },
  { name: "Omeprazole", dose: "20mg", frequency: "Once daily before breakfast", status: "confirmed", source: "CVS Pharmacy", lastUpdated: "2026-01-12" },
];

const mockAllergies: Allergy[] = [
  { allergen: "Penicillin", reaction: "Hives, difficulty breathing", severity: "severe", source: "Fasten Health" },
  { allergen: "Sulfa drugs", reaction: "Rash", severity: "moderate", source: "Patient Reported" },
  { allergen: "Shellfish", reaction: "Swelling, itching", severity: "moderate", source: "Fasten Health" },
];

const mockLabs: LabResult[] = [
  { test: "HbA1c", value: "7.2", unit: "%", reference: "< 5.7", flag: "high", date: "2026-01-10", source: "Quest Diagnostics" },
  { test: "eGFR", value: "72", unit: "mL/min", reference: "> 60", date: "2026-01-10", source: "Quest Diagnostics" },
  { test: "LDL Cholesterol", value: "118", unit: "mg/dL", reference: "< 100", flag: "high", date: "2026-01-10", source: "Quest Diagnostics" },
  { test: "Creatinine", value: "1.1", unit: "mg/dL", reference: "0.7-1.3", date: "2026-01-10", source: "Quest Diagnostics" },
  { test: "Potassium", value: "4.2", unit: "mEq/L", reference: "3.5-5.0", date: "2026-01-10", source: "Quest Diagnostics" },
  { test: "TSH", value: "2.1", unit: "mIU/L", reference: "0.4-4.0", date: "2025-12-15", source: "LabCorp" },
];

const mockImaging: ImagingResult[] = [
  { 
    study: "Chest X-Ray", 
    impression: "No acute cardiopulmonary abnormality. Heart size within normal limits. Lungs are clear bilaterally.", 
    date: "2026-01-05", 
    source: "City Radiology" 
  },
  { 
    study: "Abdominal Ultrasound", 
    impression: "Mild hepatic steatosis. No biliary dilation. Kidneys appear normal bilaterally.", 
    date: "2025-11-20", 
    source: "University Hospital" 
  },
];

const mockProblems: Problem[] = [
  { condition: "Type 2 Diabetes Mellitus", status: "active", onset: "2018", source: "Fasten Health" },
  { condition: "Essential Hypertension", status: "active", onset: "2015", source: "Fasten Health" },
  { condition: "Hyperlipidemia", status: "active", onset: "2019", source: "Fasten Health" },
  { condition: "GERD", status: "active", onset: "2020", source: "Patient Reported" },
  { condition: "Appendectomy", status: "resolved", onset: "2005", source: "Patient Reported" },
];

const mockSources: DataSource[] = [
  { name: "Fasten Health", type: "EHR", lastSync: "2026-01-15", recordCount: 156 },
  { name: "Quest Diagnostics", type: "Lab", lastSync: "2026-01-10", recordCount: 42 },
  { name: "CVS Pharmacy", type: "Pharmacy", lastSync: "2026-01-12", recordCount: 18 },
  { name: "City Radiology", type: "Imaging", lastSync: "2026-01-05", recordCount: 8 },
  { name: "Patient Reported", type: "Self-Reported", lastSync: "2026-01-18", recordCount: 12 },
];

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "severe": return <Badge variant="destructive">Severe</Badge>;
    case "moderate": return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400">Moderate</Badge>;
    case "mild": return <Badge variant="secondary">Mild</Badge>;
    default: return <Badge variant="outline">{severity}</Badge>;
  }
}

function getLabFlag(flag?: string) {
  if (!flag) return null;
  switch (flag) {
    case "high": return <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-600 dark:border-red-400">High</Badge>;
    case "low": return <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400">Low</Badge>;
    case "critical": return <Badge variant="destructive">Critical</Badge>;
    default: return null;
  }
}

export default function ProviderView() {
  const { toast } = useToast();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareExpiry, setShareExpiry] = useState("24h");
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/provider-view/${token}`;
    setShareLink(link);
    toast({ title: "Secure link generated", description: `Link expires in ${shareExpiry === "24h" ? "24 hours" : shareExpiry === "72h" ? "72 hours" : "1 hour"}` });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied" });
  };

  const handlePrint = () => {
    window.print();
    toast({ title: "Print dialog opened" });
  };

  const confirmedMeds = mockMedications.filter(m => m.status === "confirmed" || m.status === "taking");
  const activeProblems = mockProblems.filter(p => p.status === "active");
  const recentLabs = mockLabs.slice(0, 5);

  return (
    <div className="p-6 space-y-6" data-testid="page-provider-view">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Provider View
          </h1>
          <p className="text-muted-foreground">
            Read-only patient summary for healthcare providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => setShowShareDialog(true)} data-testid="button-share">
            <Share2 className="h-4 w-4 mr-2" />
            Share with Provider
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">Patient-Authorized Summary</h4>
            <p className="text-sm text-muted-foreground">
              This read-only view contains patient-confirmed health information. 
              Data shown here has been aggregated from multiple sources and confirmed by the patient.
              Always verify critical information with the patient directly.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>{mockPatient.name}</CardTitle>
                <CardDescription>
                  DOB: {mockPatient.dob} | Age: {mockPatient.age} | {mockPatient.gender}
                </CardDescription>
              </div>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Last updated: {new Date(mockPatient.lastUpdated).toLocaleString()}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Pill className="h-5 w-5" />
              Current Medications
              <Badge variant="secondary">{confirmedMeds.length}</Badge>
            </CardTitle>
            <CardDescription>Patient-confirmed active medications</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {confirmedMeds.map((med, idx) => (
                <div key={idx} className="p-3 rounded-lg border" data-testid={`med-item-${idx}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{med.name} {med.dose}</div>
                    <Badge variant="default" className="bg-green-600 dark:bg-green-700">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Confirmed
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{med.frequency}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Source: {med.source} | Updated: {med.lastUpdated}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Allergies
              <Badge variant="destructive">{mockAllergies.length}</Badge>
            </CardTitle>
            <CardDescription>Known allergies and reactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockAllergies.map((allergy, idx) => {
                const isPatientReported = allergy.source.toLowerCase().includes("patient");
                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border ${
                      allergy.severity === "severe" 
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" 
                        : isPatientReported 
                          ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800"
                          : ""
                    }`}
                    data-testid={`allergy-item-${idx}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{allergy.allergen}</div>
                      {getSeverityBadge(allergy.severity)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{allergy.reaction}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      Source: {isPatientReported && <span className="text-orange-600 dark:text-orange-400 font-medium">{allergy.source}</span>}
                      {!isPatientReported && allergy.source}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TestTube className="h-5 w-5" />
              Recent Labs
              <Badge variant="secondary">{recentLabs.length}</Badge>
            </CardTitle>
            <CardDescription>Most recent laboratory results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentLabs.map((lab, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg border" data-testid={`lab-item-${idx}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{lab.test}</span>
                      {getLabFlag(lab.flag)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Ref: {lab.reference} | {lab.date}
                    </div>
                  </div>
                  <div className={`text-right font-mono ${lab.flag ? "text-red-600 dark:text-red-400 font-bold" : ""}`}>
                    {lab.value} <span className="text-muted-foreground text-sm">{lab.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5" />
              Active Problems
              <Badge variant="secondary">{activeProblems.length}</Badge>
            </CardTitle>
            <CardDescription>Current diagnoses and conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeProblems.map((problem, idx) => {
                const isPatientReported = problem.source.toLowerCase().includes("patient");
                return (
                  <div 
                    key={idx} 
                    className={`flex items-center justify-between p-2 rounded-lg border ${
                      isPatientReported ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800" : ""
                    }`}
                    data-testid={`problem-item-${idx}`}
                  >
                    <div>
                      <div className="font-medium">{problem.condition}</div>
                      <div className="text-xs text-muted-foreground">
                        {problem.onset && `Since ${problem.onset} | `}Source: {isPatientReported ? <span className="text-orange-600 dark:text-orange-400 font-medium">{problem.source}</span> : problem.source}
                      </div>
                    </div>
                    <Badge variant="default">Active</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileImage className="h-5 w-5" />
            Recent Imaging
            <Badge variant="secondary">{mockImaging.length}</Badge>
          </CardTitle>
          <CardDescription>Recent imaging study impressions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockImaging.map((img, idx) => (
              <div key={idx} className="p-4 rounded-lg border" data-testid={`imaging-item-${idx}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{img.study}</div>
                  <div className="text-sm text-muted-foreground">{img.date}</div>
                </div>
                <div className="text-sm bg-muted/50 p-3 rounded-lg">
                  <span className="font-medium">Impression: </span>
                  {img.impression}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Source: {img.source}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5" />
            Data Sources
            <Badge variant="secondary">{mockSources.length}</Badge>
          </CardTitle>
          <CardDescription>Connected health record sources</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mockSources.map((source, idx) => {
              const isPatientReported = source.type.toLowerCase().includes("self") || source.name.toLowerCase().includes("patient");
              return (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border ${
                    isPatientReported ? "bg-orange-50/50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800" : ""
                  }`}
                  data-testid={`source-item-${idx}`}
                >
                  <div className="flex items-center gap-2">
                    <Building className={`h-4 w-4 ${isPatientReported ? "text-orange-500" : "text-muted-foreground"}`} />
                    <span className={`font-medium ${isPatientReported ? "text-orange-700 dark:text-orange-400" : ""}`}>{source.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {isPatientReported ? <span className="text-orange-600 dark:text-orange-400">{source.type}</span> : source.type} | {source.recordCount} records
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last sync: {source.lastSync}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">Disclaimer</h4>
            <p className="text-sm text-muted-foreground">
              This summary is provided for informational purposes only and does not constitute a complete medical record.
              Healthcare providers should verify all information and consult authoritative sources for clinical decision-making.
              This view shows patient-confirmed data only and may not include all historical records.
            </p>
          </div>
        </div>
      </Card>

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Share with Provider
            </DialogTitle>
            <DialogDescription>
              Generate a secure, expiring link for your healthcare provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Link Expiration</Label>
              <Select value={shareExpiry} onValueChange={setShareExpiry}>
                <SelectTrigger data-testid="select-expiry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="72h">72 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!shareLink ? (
              <Button className="w-full" onClick={handleGenerateLink} data-testid="button-generate-link">
                <Link2 className="h-4 w-4 mr-2" />
                Generate Secure Link
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Secure Link</div>
                  <div className="font-mono text-sm break-all">{shareLink}</div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleCopyLink} data-testid="button-copy-link">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                  <Button variant="outline" className="flex-1" data-testid="button-show-qr">
                    <QrCode className="h-4 w-4 mr-2" />
                    Show QR
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  Link expires in {shareExpiry === "24h" ? "24 hours" : shareExpiry === "72h" ? "72 hours" : "1 hour"}
                </div>
              </div>
            )}

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Secure Access</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    This link provides read-only access to your health summary.
                    The link automatically expires and can only be used once.
                    No login required for the provider.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowShareDialog(false); setShareLink(""); }} data-testid="button-close-share">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
