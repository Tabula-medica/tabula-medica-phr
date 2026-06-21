import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  FileText,
  Building2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  Users,
  Server,
  Database,
  Cloud,
  Eye,
  Globe,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";

interface Subprocessor {
  name: string;
  purpose: string;
  dataProcessed: string[];
  location: string;
  certifications: string[];
  baaStatus: "active" | "pending" | "not_required";
  lastReviewed: string;
}

const subprocessors: Subprocessor[] = [
  {
    name: "Google Cloud Platform (GCP)",
    purpose: "Cloud infrastructure and Healthcare API",
    dataProcessed: ["Encrypted PHI storage", "FHIR data processing", "Analytics"],
    location: "United States",
    certifications: ["HIPAA", "SOC 2 Type II", "ISO 27001", "FedRAMP"],
    baaStatus: "active",
    lastReviewed: "2025-01-15",
  },
  {
    name: "OpenAI",
    purpose: "AI-powered medical term explanations and document summarization",
    dataProcessed: ["De-identified health summaries", "Medical terminology queries"],
    location: "United States",
    certifications: ["SOC 2 Type II", "HIPAA (via BAA)"],
    baaStatus: "active",
    lastReviewed: "2025-01-20",
  },
  {
    name: "Stripe",
    purpose: "Payment processing for premium subscriptions",
    dataProcessed: ["Billing information only", "No PHI processed"],
    location: "United States",
    certifications: ["PCI DSS Level 1", "SOC 2 Type II"],
    baaStatus: "not_required",
    lastReviewed: "2025-01-10",
  },
  {
    name: "Neon (PostgreSQL)",
    purpose: "Primary database for application data",
    dataProcessed: ["Encrypted PHI at rest", "User accounts", "Audit logs"],
    location: "United States",
    certifications: ["SOC 2 Type II", "HIPAA"],
    baaStatus: "active",
    lastReviewed: "2025-01-12",
  },
  {
    name: "Google Cloud Storage",
    purpose: "Document and file storage",
    dataProcessed: ["Encrypted uploaded documents", "Medical records"],
    location: "United States",
    certifications: ["SOC 2 Type II"],
    baaStatus: "active",
    lastReviewed: "2025-01-18",
  },
];

const sampleModePolicy = {
  title: "Preview Mode Non-PHI Policy",
  version: "1.0",
  effectiveDate: "2025-01-01",
  sections: [
    {
      title: "Purpose",
      content: "This policy governs the Preview Mode feature of Tabula Medica, ensuring that no real Protected Health Information (PHI) is processed, stored, or transmitted during preview sessions."
    },
    {
      title: "Scope",
      content: "Preview Mode applies to all preview, training, and evaluation instances of the Tabula Medica platform. It is automatically enabled for non-production environments and trial accounts."
    },
    {
      title: "Key Controls",
      items: [
        "All patient data in Preview Mode is synthetically generated and clearly marked as sample data",
        "Real patient entry is blocked - any attempt to enter real patient identifiers triggers a warning",
        "External communications (email, SMS, fax) are disabled to prevent accidental PHI disclosure",
        "File uploads are sandboxed and not stored permanently",
        "No Preview Mode data is included in audit logs that may be reviewed for compliance purposes",
        "Session data is automatically purged after 24 hours"
      ]
    },
    {
      title: "Visual Indicators",
      content: "Preview Mode displays a persistent watermark and banner indicating 'PREVIEW - Not for clinical use' to prevent confusion with production systems."
    },
    {
      title: "Compliance Statement",
      content: "While Preview Mode simulates HIPAA-compliant workflows, it is explicitly not covered under any Business Associate Agreement as no real PHI is processed. Organizations evaluating Tabula Medica should not enter any real patient information during preview sessions."
    }
  ]
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SubprocessorCard({ subprocessor }: { subprocessor: Subprocessor }) {
  const statusColors = {
    active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
    pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    not_required: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };

  const statusLabels = {
    active: "BAA Active",
    pending: "BAA Pending",
    not_required: "No BAA Required",
  };

  return (
    <Card className="hover-elevate" data-testid={`card-subprocessor-${subprocessor.name.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-semibold">{subprocessor.name}</h3>
              <Badge variant="outline" className={statusColors[subprocessor.baaStatus]}>
                {subprocessor.baaStatus === "active" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                {subprocessor.baaStatus === "pending" && <AlertTriangle className="h-3 w-3 mr-1" />}
                {statusLabels[subprocessor.baaStatus]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{subprocessor.purpose}</p>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Database className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Data Processed: </span>
                  {subprocessor.dataProcessed.join(", ")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Location: </span>
                {subprocessor.location}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Last Reviewed: </span>
                {formatDate(subprocessor.lastReviewed)}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-3 pt-3 border-t">
          <div className="flex flex-wrap gap-1.5">
            {subprocessor.certifications.map((cert) => (
              <Badge key={cert} variant="secondary" className="text-xs">
                <Shield className="h-2.5 w-2.5 mr-1" />
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BAADocumentation() {
  const [activeTab, setActiveTab] = useState("overview");

  const downloadBAA = () => {
    const baaContent = `
BUSINESS ASSOCIATE AGREEMENT (BAA) TEMPLATE

This Business Associate Agreement ("Agreement") is entered into between:
Covered Entity: [Customer Organization Name]
Business Associate: Tabula Medica, Inc.

RECITALS:
The Covered Entity and Business Associate intend to enter into an arrangement whereby 
Business Associate will perform certain services for Covered Entity that require the 
use and/or disclosure of Protected Health Information (PHI) as defined by the Health 
Insurance Portability and Accountability Act of 1996 (HIPAA).

[Full BAA template content would be included here]

For a complete BAA, please contact: compliance@tabulamedica.com
    `.trim();

    const blob = new Blob([baaContent], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "tabula-medica-baa-template.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="container mx-auto px-4 py-6" data-testid="page-baa-documentation">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-title">
            BAA & Compliance Documentation
          </h1>
          <p className="text-muted-foreground">
            Business Associate Agreements, subprocessor list, and compliance policies.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="gap-1">
            <Shield className="h-3 w-3" />
            HIPAA Compliant
          </Badge>
          <Button variant="outline" className="gap-2" onClick={downloadBAA} data-testid="button-download-baa">
            <Download className="h-4 w-4" />
            Download BAA Template
          </Button>
        </div>
      </div>

      <Alert className="mb-6" data-testid="alert-preview-mode">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Environment Notice</AlertTitle>
        <AlertDescription>
          This instance is running in Preview Mode. No real PHI is processed, and standard BAA provisions do not apply to sample data.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6" data-testid="tabs-baa">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="subprocessors" data-testid="tab-subprocessors">Subprocessors</TabsTrigger>
          <TabsTrigger value="policy-default" data-testid="tab-sample-policy">Sample Policy</TabsTrigger>
          <TabsTrigger value="contact" data-testid="tab-contact">Contact</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            <Card data-testid="card-baa-overview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Business Associate Agreement
                </CardTitle>
                <CardDescription>
                  Required for HIPAA-covered entities processing PHI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Tabula Medica maintains Business Associate Agreements with all customers who process Protected Health Information through our platform. Our BAA covers:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Permitted uses and disclosures of PHI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Safeguards for PHI protection (encryption, access controls)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Breach notification procedures (within 24 hours)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Termination provisions and data return/destruction</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Subcontractor obligations and downstream BAAs</span>
                  </li>
                </ul>
                <Button className="w-full" onClick={downloadBAA} data-testid="button-request-baa">
                  <Download className="h-4 w-4 mr-2" />
                  Download BAA Template
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-security-measures">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Security Measures
                </CardTitle>
                <CardDescription>
                  Technical and administrative safeguards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Shield className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Encryption</h4>
                      <p className="text-xs text-muted-foreground">AES-256-GCM at rest, TLS 1.3 in transit</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Access Control</h4>
                      <p className="text-xs text-muted-foreground">RBAC, MFA, session timeout</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Eye className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Audit Logging</h4>
                      <p className="text-xs text-muted-foreground">Complete PHI access audit trail</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Server className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Infrastructure</h4>
                      <p className="text-xs text-muted-foreground">HIPAA-compliant cloud hosting (GCP)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2" data-testid="card-compliance-certifications">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Compliance & Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center">
                    <Badge className="mb-2">Active</Badge>
                    <h4 className="font-semibold">HIPAA</h4>
                    <p className="text-xs text-muted-foreground">Health Insurance Portability and Accountability Act</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Badge className="mb-2">Active</Badge>
                    <h4 className="font-semibold">SOC 2 Type II</h4>
                    <p className="text-xs text-muted-foreground">Security, Availability, Confidentiality</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Badge variant="secondary" className="mb-2">In Progress</Badge>
                    <h4 className="font-semibold">HITRUST</h4>
                    <p className="text-xs text-muted-foreground">Healthcare Information Trust Alliance</p>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Badge className="mb-2">Active</Badge>
                    <h4 className="font-semibold">GDPR Ready</h4>
                    <p className="text-xs text-muted-foreground">EU General Data Protection Regulation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subprocessors">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Subprocessor List</CardTitle>
              <CardDescription>
                Third-party services that may process data on behalf of Tabula Medica. 
                All subprocessors with PHI access maintain active Business Associate Agreements.
              </CardDescription>
            </CardHeader>
          </Card>
          
          <div className="space-y-4">
            {subprocessors.map((subprocessor) => (
              <SubprocessorCard key={subprocessor.name} subprocessor={subprocessor} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="policy-default">
          <Card data-testid="card-sample-policy">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                {sampleModePolicy.title}
              </CardTitle>
              <CardDescription>
                Version {sampleModePolicy.version} - Effective {formatDate(sampleModePolicy.effectiveDate)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-6">
                  {sampleModePolicy.sections.map((section, index) => (
                    <div key={index}>
                      <h3 className="font-semibold text-lg mb-2">{section.title}</h3>
                      {section.content && (
                        <p className="text-muted-foreground">{section.content}</p>
                      )}
                      {section.items && (
                        <ul className="space-y-2 mt-2">
                          {section.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="flex items-start gap-2 text-muted-foreground">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {index < sampleModePolicy.sections.length - 1 && (
                        <Separator className="mt-6" />
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contact">
          <Card data-testid="card-contact">
            <CardHeader>
              <CardTitle>Compliance Contact</CardTitle>
              <CardDescription>
                For BAA requests, compliance inquiries, or security questions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Compliance Team</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href="mailto:compliance@tabulamedica.com" className="text-primary hover:underline">
                        compliance@tabulamedica.com
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>1-800-TABULA-1 (1-800-822-8521)</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold">Security Team</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href="mailto:security@tabulamedica.com" className="text-primary hover:underline">
                        security@tabulamedica.com
                      </a>
                    </div>
                    <div className="flex items-center gap-3">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <a
                        href="https://trust.tabulamedica.health"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Visit Tabula Medica Security Portal
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-semibold mb-3">Request a BAA</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  To request a Business Associate Agreement, please contact our compliance team with the following information:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">1</span>
                    <span>Organization name and address</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">2</span>
                    <span>Primary contact for BAA execution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">3</span>
                    <span>Description of intended PHI use</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">4</span>
                    <span>Any specific BAA requirements or modifications needed</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
