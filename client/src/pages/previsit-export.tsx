import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Download,
  Printer,
  Package,
  User,
  Pill,
  AlertTriangle,
  Activity,
  FileImage,
  Stethoscope,
  Calendar,
  Clock,
  CheckCircle,
  FileDown,
  Shield,
  Building,
  Heart,
  Loader2,
} from "lucide-react";

interface DocumentOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "core" | "labs" | "imaging" | "other";
  pages: number;
  lastUpdated: string;
  included: boolean;
}

const mockPatient = {
  name: "Sarah Johnson",
  dob: "1985-03-15",
  age: 40,
  gender: "Female",
  mrn: "MRN-2024-001",
  phone: "(555) 123-4567",
  email: "sarah.johnson@email.com",
  primaryCare: "Dr. Robert Smith, MD",
  upcomingVisit: {
    provider: "Dr. Emily Chen, MD",
    specialty: "Cardiology",
    date: "2026-01-22",
    time: "10:30 AM",
    reason: "Follow-up: Chest pain evaluation",
  },
};

const initialDocuments: DocumentOption[] = [
  {
    id: "medications",
    label: "Current Medications",
    description: "Patient-confirmed medication list with dosages",
    icon: <Pill className="h-4 w-4" />,
    category: "core",
    pages: 1,
    lastUpdated: "2026-01-15",
    included: true,
  },
  {
    id: "allergies",
    label: "Allergies",
    description: "Known allergies with severity and reactions",
    icon: <AlertTriangle className="h-4 w-4" />,
    category: "core",
    pages: 1,
    lastUpdated: "2026-01-10",
    included: true,
  },
  {
    id: "conditions",
    label: "Active Conditions",
    description: "Current diagnoses and problem list",
    icon: <Heart className="h-4 w-4" />,
    category: "core",
    pages: 1,
    lastUpdated: "2026-01-12",
    included: true,
  },
  {
    id: "vitals",
    label: "Recent Vitals",
    description: "Blood pressure, heart rate, weight trends",
    icon: <Activity className="h-4 w-4" />,
    category: "core",
    pages: 1,
    lastUpdated: "2026-01-14",
    included: true,
  },
  {
    id: "labs_cbc",
    label: "Complete Blood Count",
    description: "CBC results from January 8, 2026",
    icon: <FileText className="h-4 w-4" />,
    category: "labs",
    pages: 2,
    lastUpdated: "2026-01-08",
    included: true,
  },
  {
    id: "labs_metabolic",
    label: "Comprehensive Metabolic Panel",
    description: "CMP results from January 8, 2026",
    icon: <FileText className="h-4 w-4" />,
    category: "labs",
    pages: 2,
    lastUpdated: "2026-01-08",
    included: true,
  },
  {
    id: "labs_lipid",
    label: "Lipid Panel",
    description: "Cholesterol and lipid results",
    icon: <FileText className="h-4 w-4" />,
    category: "labs",
    pages: 1,
    lastUpdated: "2026-01-08",
    included: false,
  },
  {
    id: "imaging_ecg",
    label: "ECG Report",
    description: "12-lead ECG from December 2025",
    icon: <FileImage className="h-4 w-4" />,
    category: "imaging",
    pages: 2,
    lastUpdated: "2025-12-20",
    included: true,
  },
  {
    id: "imaging_echo",
    label: "Echocardiogram Report",
    description: "Echo results from December 2025",
    icon: <FileImage className="h-4 w-4" />,
    category: "imaging",
    pages: 4,
    lastUpdated: "2025-12-18",
    included: false,
  },
  {
    id: "imaging_chest",
    label: "Chest X-Ray",
    description: "CXR report from December 2025",
    icon: <FileImage className="h-4 w-4" />,
    category: "imaging",
    pages: 1,
    lastUpdated: "2025-12-15",
    included: false,
  },
  {
    id: "referral",
    label: "Referral Letter",
    description: "Original referral from Dr. Smith",
    icon: <Stethoscope className="h-4 w-4" />,
    category: "other",
    pages: 1,
    lastUpdated: "2026-01-05",
    included: true,
  },
  {
    id: "notes",
    label: "Recent Visit Notes",
    description: "Notes from last 3 visits",
    icon: <FileText className="h-4 w-4" />,
    category: "other",
    pages: 6,
    lastUpdated: "2025-12-28",
    included: false,
  },
];

export default function PrevisitExport() {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<DocumentOption[]>(initialDocuments);
  const [generating, setGenerating] = useState(false);
  const [generatingBundle, setGeneratingBundle] = useState(false);

  const toggleDocument = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, included: !doc.included } : doc
    ));
  };

  const selectAll = (category: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.category === category ? { ...doc, included: true } : doc
    ));
  };

  const deselectAll = (category: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.category === category ? { ...doc, included: false } : doc
    ));
  };

  const includedDocs = documents.filter(d => d.included);
  const totalPages = includedDocs.reduce((sum, doc) => sum + doc.pages, 0);

  const handleGenerateSnapshot = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/previsit/snapshot");
      if (!response.ok) throw new Error("Failed to generate snapshot");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "patient-snapshot.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ 
        title: "1-Page Snapshot Downloaded",
        description: "PDF saved to your downloads"
      });
    } catch (error) {
      toast({ 
        title: "Download failed",
        description: "Could not generate snapshot PDF",
        variant: "destructive"
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateBundle = async () => {
    setGeneratingBundle(true);
    try {
      const response = await fetch("/api/previsit/bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: includedDocs.map(d => d.id) }),
      });
      if (!response.ok) throw new Error("Failed to generate bundle");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "supporting-documents.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({ 
        title: "Document Bundle Downloaded",
        description: `${includedDocs.length} documents (${totalPages} pages) saved`
      });
    } catch (error) {
      toast({ 
        title: "Download failed",
        description: "Could not generate document bundle",
        variant: "destructive"
      });
    } finally {
      setGeneratingBundle(false);
    }
  };

  const getCategoryDocs = (category: string) => documents.filter(d => d.category === category);
  const getCategoryIncluded = (category: string) => documents.filter(d => d.category === category && d.included).length;

  return (
    <div className="p-6 space-y-6" data-testid="page-previsit-export">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="h-6 w-6" />
            Pre-Visit Packet Export
          </h1>
          <p className="text-muted-foreground">
            Provider-friendly PDF packets for upcoming visits
          </p>
        </div>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">Provider-Ready Format</h4>
            <p className="text-sm text-muted-foreground">
              Export shows a 1-page snapshot for quick reference plus supporting documents bundle. 
              Format refers to standard PDF for universal compatibility.
            </p>
          </div>
        </div>
      </Card>

      {/* Upcoming Visit Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Visit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{mockPatient.name}</span>
                <Badge variant="outline">MRN: {mockPatient.mrn}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {mockPatient.age} years old | {mockPatient.gender} | DOB: {mockPatient.dob}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope className="h-4 w-4 text-primary" />
                <span className="font-medium">{mockPatient.upcomingVisit.provider}</span>
              </div>
              <div className="text-sm text-muted-foreground">{mockPatient.upcomingVisit.specialty}</div>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {mockPatient.upcomingVisit.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {mockPatient.upcomingVisit.time}
                </span>
              </div>
              <div className="text-sm mt-1">{mockPatient.upcomingVisit.reason}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 1-Page Snapshot */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              1-Page Snapshot
            </CardTitle>
            <CardDescription>
              Quick reference summary for the provider
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg border bg-card">
              <h4 className="font-medium mb-3">Snapshot shows:</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Patient demographics and contact info
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Visit reason and referring provider
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Current medications (patient-confirmed)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Allergies with severity
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Active conditions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Recent vitals summary
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Data sources with sync dates
                </li>
              </ul>
            </div>
            <Button 
              className="w-full" 
              onClick={handleGenerateSnapshot}
              disabled={generating}
              data-testid="button-generate-snapshot"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {generating ? "Generating..." : "Download 1-Page Snapshot"}
            </Button>
          </CardContent>
        </Card>

        {/* Supporting Documents Bundle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Supporting Documents Bundle
            </CardTitle>
            <CardDescription>
              Select documents to include in the bundle
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <div className="font-medium">{includedDocs.length} documents selected</div>
                <div className="text-sm text-muted-foreground">{totalPages} total pages</div>
              </div>
              <Badge variant="outline" className="text-lg px-3 py-1">
                ~{totalPages} pages
              </Badge>
            </div>
            <Button 
              className="w-full" 
              onClick={handleGenerateBundle}
              disabled={generatingBundle || includedDocs.length === 0}
              data-testid="button-generate-bundle"
            >
              {generatingBundle ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              {generatingBundle ? "Generating Bundle..." : "Download Document Bundle"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Document Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Supporting Documents</CardTitle>
          <CardDescription>
            Choose which documents to include in the bundle
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Core Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Heart className="h-4 w-4" />
                Core Clinical Data
                <Badge variant="secondary">{getCategoryIncluded("core")}/{getCategoryDocs("core").length}</Badge>
              </h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => selectAll("core")} data-testid="button-select-all-core">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deselectAll("core")} data-testid="button-deselect-all-core">
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {getCategoryDocs("core").map((doc) => (
                <div role="presentation" 
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    doc.included ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleDocument(doc.id)}
                  data-testid={`doc-option-${doc.id}`}
                >
                  <Checkbox 
                    checked={doc.included} 
                    onCheckedChange={() => toggleDocument(doc.id)}
                    data-testid={`checkbox-${doc.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {doc.icon}
                      <span className="font-medium">{doc.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{doc.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{doc.pages} page{doc.pages > 1 ? "s" : ""}</span>
                      <span>Updated: {doc.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Lab Results */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Laboratory Results
                <Badge variant="secondary">{getCategoryIncluded("labs")}/{getCategoryDocs("labs").length}</Badge>
              </h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => selectAll("labs")} data-testid="button-select-all-labs">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deselectAll("labs")} data-testid="button-deselect-all-labs">
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {getCategoryDocs("labs").map((doc) => (
                <div role="presentation" 
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    doc.included ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleDocument(doc.id)}
                  data-testid={`doc-option-${doc.id}`}
                >
                  <Checkbox 
                    checked={doc.included} 
                    onCheckedChange={() => toggleDocument(doc.id)}
                    data-testid={`checkbox-${doc.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {doc.icon}
                      <span className="font-medium">{doc.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{doc.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{doc.pages} page{doc.pages > 1 ? "s" : ""}</span>
                      <span>Updated: {doc.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Imaging */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <FileImage className="h-4 w-4" />
                Imaging Reports
                <Badge variant="secondary">{getCategoryIncluded("imaging")}/{getCategoryDocs("imaging").length}</Badge>
              </h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => selectAll("imaging")} data-testid="button-select-all-imaging">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deselectAll("imaging")} data-testid="button-deselect-all-imaging">
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {getCategoryDocs("imaging").map((doc) => (
                <div role="presentation" 
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    doc.included ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleDocument(doc.id)}
                  data-testid={`doc-option-${doc.id}`}
                >
                  <Checkbox 
                    checked={doc.included} 
                    onCheckedChange={() => toggleDocument(doc.id)}
                    data-testid={`checkbox-${doc.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {doc.icon}
                      <span className="font-medium">{doc.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{doc.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{doc.pages} page{doc.pages > 1 ? "s" : ""}</span>
                      <span>Updated: {doc.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Other Documents */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Other Documents
                <Badge variant="secondary">{getCategoryIncluded("other")}/{getCategoryDocs("other").length}</Badge>
              </h4>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => selectAll("other")} data-testid="button-select-all-other">
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deselectAll("other")} data-testid="button-deselect-all-other">
                  Deselect All
                </Button>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {getCategoryDocs("other").map((doc) => (
                <div role="presentation" 
                  key={doc.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    doc.included ? "bg-primary/5 border-primary/30" : "hover:bg-muted/50"
                  }`}
                  onClick={() => toggleDocument(doc.id)}
                  data-testid={`doc-option-${doc.id}`}
                >
                  <Checkbox 
                    checked={doc.included} 
                    onCheckedChange={() => toggleDocument(doc.id)}
                    data-testid={`checkbox-${doc.id}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {doc.icon}
                      <span className="font-medium">{doc.label}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{doc.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{doc.pages} page{doc.pages > 1 ? "s" : ""}</span>
                      <span>Updated: {doc.lastUpdated}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Options */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Printer className="h-5 w-5 text-muted-foreground" />
            <div>
              <h4 className="font-medium">Print-Ready Format</h4>
              <p className="text-sm text-muted-foreground">
                PDFs show standard letter size (8.5 x 11) for easy printing
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" data-testid="button-print-snapshot">
              <Printer className="h-4 w-4 mr-2" />
              Print Snapshot
            </Button>
            <Button variant="outline" data-testid="button-print-bundle">
              <Printer className="h-4 w-4 mr-2" />
              Print Bundle
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
