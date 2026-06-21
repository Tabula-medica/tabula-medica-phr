import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Lock, 
  Server, 
  FileText, 
  Users, 
  Database,
  CheckCircle2,
  Clock,
  Cloud,
  Key,
  Eye,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Building2,
  Globe,
  Workflow,
  Plug,
  FileCode,
  Activity,
  Pill,
  Stethoscope,
  Image,
  Smartphone,
  ScanLine
} from "lucide-react";
import { Link } from "wouter";
import { useSEO } from "@/hooks/use-seo";

interface SecurityItem {
  title: string;
  description: string;
  status: "implemented" | "roadmap" | "planned";
  icon: React.ElementType;
}

export default function Procurement() {
  useSEO({
    title: "Security & Procurement | Tabula Medica",
    description: "Enterprise security architecture, compliance posture, and procurement information for Tabula Medica healthcare platform."
  });

  const dataFlows: SecurityItem[] = [
    {
      title: "Patient Data at Rest",
      description: "AES-256-GCM encryption with KMS-managed keys. Zero-knowledge architecture available.",
      status: "implemented",
      icon: Database
    },
    {
      title: "Data in Transit",
      description: "TLS 1.2+ for all API communications. Certificate pinning for mobile apps.",
      status: "implemented",
      icon: Lock
    },
    {
      title: "PHI Logging",
      description: "PHI-safe logging with automatic PII redaction. No PHI in application logs.",
      status: "implemented",
      icon: Eye
    },
    {
      title: "Analytics Pipeline",
      description: "Separate de-identified analytics. Patient opt-out supported.",
      status: "implemented",
      icon: Workflow
    }
  ];

  const accessControls: SecurityItem[] = [
    {
      title: "Role-Based Access Control (RBAC)",
      description: "Granular permissions with patient, caregiver, provider, and admin roles.",
      status: "implemented",
      icon: Users
    },
    {
      title: "Multi-Factor Authentication",
      description: "TOTP, SMS, and biometric authentication options.",
      status: "implemented",
      icon: Key
    },
    {
      title: "Tenant Isolation",
      description: "Logical tenant separation with dedicated encryption keys per organization.",
      status: "implemented",
      icon: Building2
    },
    {
      title: "Session Management",
      description: "Configurable session timeouts, device tracking, and forced logout capabilities.",
      status: "implemented",
      icon: Clock
    }
  ];

  const auditCompliance: SecurityItem[] = [
    {
      title: "WORM Audit Logs",
      description: "Append-only, tamper-evident logging with hash chain verification. Designed to support audit trail requirements.",
      status: "implemented",
      icon: FileText
    },
    {
      title: "Audit Log Export",
      description: "SIEM-compatible export formats (JSON, CSV). Real-time streaming available.",
      status: "implemented",
      icon: ArrowRight
    },
    {
      title: "Retention Policies",
      description: "Configurable retention (7 years default for HIPAA). Automated purge with audit trail.",
      status: "implemented",
      icon: Trash2
    },
    {
      title: "Compliance Alerts",
      description: "Automated anomaly detection for suspicious access patterns.",
      status: "implemented",
      icon: AlertTriangle
    }
  ];

  const certifications = [
    {
      name: "HIPAA-Aligned Design",
      description: "Designed for HIPAA-eligible cloud services under BAA for pilots",
      status: "Current",
      color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
    },
    {
      name: "SOC 2 Type II",
      description: "Audit scheduled Q2 2026",
      status: "Roadmap",
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
    },
    {
      name: "HITRUST CSF",
      description: "Assessment planned Q4 2026",
      status: "Planned",
      color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
    },
    {
      name: "Penetration Testing",
      description: "Annual third-party testing. Last completed: Q4 2025",
      status: "Current",
      color: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
    }
  ];

  const subprocessors = [
    { name: "Google Cloud Platform", purpose: "Cloud infrastructure (under BAA)", region: "US" },
    { name: "AWS", purpose: "Cloud infrastructure (under BAA)", region: "US" },
    { name: "OpenAI", purpose: "AI processing (PHI-safe, no training)", region: "US" },
    { name: "Stripe", purpose: "Payment processing (no PHI)", region: "US" }
  ];

  const dataStandards = [
    {
      category: "Clinical Data Exchange",
      icon: FileCode,
      standards: [
        { name: "HL7 FHIR R4", description: "Modern global standard for EHR exchange", status: "implemented" as const },
        { name: "HL7 v2/v3", description: "Hospital system messaging & HIE integration", status: "implemented" as const },
        { name: "C-CDA", description: "Clinical summaries, discharge notes, referrals", status: "implemented" as const }
      ]
    },
    {
      category: "Terminology & Coding",
      icon: Stethoscope,
      standards: [
        { name: "LOINC", description: "Laboratory & clinical observation codes", status: "implemented" as const },
        { name: "SNOMED CT", description: "Clinical diagnosis & condition terminology", status: "implemented" as const },
        { name: "RxNorm", description: "Medication naming & drug interaction data", status: "implemented" as const },
        { name: "ICD-10", description: "Diagnosis & procedure classification", status: "implemented" as const }
      ]
    },
    {
      category: "Imaging & Radiology",
      icon: Image,
      standards: [
        { name: "DICOM", description: "Medical imaging standard (radiology, cardiology)", status: "implemented" as const },
        { name: "WADO-RS/URI", description: "Web access to DICOM objects", status: "implemented" as const },
        { name: "DICOMweb", description: "RESTful services for imaging data", status: "implemented" as const }
      ]
    },
    {
      category: "Claims & Transactions",
      icon: FileText,
      standards: [
        { name: "X12 EDI", description: "Insurance claims, eligibility, payments", status: "implemented" as const }
      ]
    },
    {
      category: "Patient Data Sources",
      icon: Smartphone,
      standards: [
        { name: "Apple HealthKit", description: "Patient-authorized device & app data", status: "implemented" as const },
        { name: "Google Health Connect", description: "Android health & fitness data", status: "implemented" as const }
      ]
    },
    {
      category: "Document Processing",
      icon: ScanLine,
      standards: [
        { name: "PDF Import", description: "Structured data extraction from PDFs", status: "implemented" as const },
        { name: "OCR Processing", description: "AI-powered text extraction from scans & images", status: "implemented" as const }
      ]
    }
  ];

  const renderSecurityItems = (items: SecurityItem[]) => (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
          <div className="p-2 rounded-lg bg-primary/10">
            <item.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm">{item.title}</h4>
              <Badge 
                variant="outline" 
                className={
                  item.status === "implemented" 
                    ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" 
                    : item.status === "roadmap"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                    : "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
                }
              >
                {item.status === "implemented" ? "Implemented" : item.status === "roadmap" ? "Roadmap" : "Planned"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-procurement-title">
              Security & Procurement
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enterprise security architecture and compliance posture for healthcare organizations evaluating Tabula Medica.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button asChild data-testid="button-request-pilot">
              <Link href="/contact">
                Request Pilot
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => alert("Security overview PDF download coming soon")}
              data-testid="button-download-security-overview"
            >
              <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
              Download Security Overview PDF
            </Button>
          </div>
        </div>

        <Card data-testid="card-compliance-status">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Compliance Status
            </CardTitle>
            <CardDescription>Current certifications and roadmap</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              {certifications.map((cert, index) => (
                <div key={index} className={`p-4 rounded-lg border-2 ${cert.color}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <h4 className="font-semibold">{cert.name}</h4>
                    <Badge variant="outline">{cert.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{cert.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card data-testid="card-data-flows">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Flows & Encryption
              </CardTitle>
              <CardDescription>How patient data is protected</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSecurityItems(dataFlows)}
            </CardContent>
          </Card>

          <Card data-testid="card-access-control">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Access Control
              </CardTitle>
              <CardDescription>RBAC and tenant isolation</CardDescription>
            </CardHeader>
            <CardContent>
              {renderSecurityItems(accessControls)}
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-audit-logs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Logs & Compliance
            </CardTitle>
            <CardDescription>Immutable audit trail and compliance monitoring</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {auditCompliance.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">{item.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-subprocessors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Subprocessors
            </CardTitle>
            <CardDescription>Third-party services that may process data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Service</th>
                    <th className="text-left py-2 font-medium">Purpose</th>
                    <th className="text-left py-2 font-medium">Region</th>
                  </tr>
                </thead>
                <tbody>
                  {subprocessors.map((sub, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 font-medium">{sub.name}</td>
                      <td className="py-3 text-muted-foreground">{sub.purpose}</td>
                      <td className="py-3">
                        <Badge variant="outline">{sub.region}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-data-standards">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              Data Standards & Interoperability
            </CardTitle>
            <CardDescription>
              Industry-standard protocols for healthcare data exchange, enabling accurate matching and summarization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dataStandards.map((category, index) => (
                <div key={index} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <category.icon className="h-4 w-4 text-primary" />
                    </div>
                    <h4 className="font-medium text-sm">{category.category}</h4>
                  </div>
                  <div className="space-y-2">
                    {category.standards.map((standard, sIndex) => (
                      <div key={sIndex} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{standard.name}</p>
                          <p className="text-xs text-muted-foreground">{standard.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-incident-response">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Incident Response
            </CardTitle>
            <CardDescription>Security incident handling procedures</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-primary">15 min</div>
                <div className="text-xs text-muted-foreground mt-1">Initial Response SLA</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-primary">24/7</div>
                <div className="text-xs text-muted-foreground mt-1">Security Team Coverage</div>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 text-center">
                <div className="text-2xl font-bold text-primary">72 hrs</div>
                <div className="text-xs text-muted-foreground mt-1">Breach Notification</div>
              </div>
            </div>
            <Separator />
            <div className="text-sm text-muted-foreground">
              <p>
                Our incident response plan includes automated detection, escalation procedures, 
                forensic analysis, and customer notification in compliance with HIPAA breach notification requirements.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20" data-testid="card-contact-security">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">Ready to evaluate Tabula Medica?</h3>
                <p className="text-sm text-muted-foreground">
                  Request a security review, BAA discussion, or pilot program access.
                </p>
              </div>
              <div className="flex gap-3">
                <Button asChild data-testid="button-contact-security">
                  <Link href="/contact">
                    Contact Security Team
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground py-4">
          <p>
            <strong>Informational Only:</strong> Tabula Medica provides patient-controlled health data access. 
            No diagnosis or treatment recommendations are made by this platform.
          </p>
        </div>
      </div>
    </div>
  );
}
