import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Shield, 
  Lock, 
  Server, 
  FileText, 
  Users, 
  Database,
  CheckCircle2,
  AlertTriangle,
  Cloud,
  Key
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface SampleConfig {
  enabled: boolean;
  blockRealPatientEntry: boolean;
  blockFileUploads: boolean;
  blockExternalComms: boolean;
  watermarkUI: boolean;
}

export default function AboutSecurity() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-security-title">
              Security & Compliance Architecture
            </h1>
          </div>
          <p className="text-muted-foreground">
            Tabula Medica is built with healthcare security and compliance as foundational principles.
          </p>
        </div>

        <Card data-testid="card-current-environment">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Current Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="default" className="bg-green-600 text-lg px-4 py-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Production Environment
              </Badge>
              <span className="text-muted-foreground">HIPAA-aligned PHI handling under BAA</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card data-testid="card-environment-notice">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5" />
                Environment Notice
              </CardTitle>
              <CardDescription>Current current configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Sample/synthetic patient data only</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>No real PHI processed or stored</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>External communications blocked</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Real patient import disabled</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>File upload size limits enforced</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card data-testid="card-production-environment">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <Cloud className="h-5 w-5" />
                Production Environment
              </CardTitle>
              <CardDescription>Enterprise deployment architecture</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>AWS/GCP with signed BAA for pilots</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>HIPAA-aligned infrastructure design</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>SOC 2 Type II program in progress (Q2 2026)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Geographic data residency options</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <span>Enterprise SLA and support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Separator />

        <Card data-testid="card-security-controls">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Security Controls
            </CardTitle>
            <CardDescription>Core security measures implemented across all environments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Encryption
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>AES-256-GCM for PHI at rest</li>
                  <li>TLS 1.2+ for data in transit</li>
                  <li>Field-level encryption for sensitive data</li>
                  <li>Secure key management (AWS KMS/GCP KMS)</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Access Control
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Role-based access control (RBAC)</li>
                  <li>Multi-factor authentication (MFA)</li>
                  <li>Session timeout enforcement</li>
                  <li>Least-privilege principle</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Audit Logging
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>HIPAA-compliant audit trails</li>
                  <li>PHI access logging</li>
                  <li>7-year log retention</li>
                  <li>Tamper-evident log storage</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Data Protection
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>PHI redaction in logs</li>
                  <li>Data minimization practices</li>
                  <li>Secure data disposal</li>
                  <li>Backup encryption</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance Framework
            </CardTitle>
            <CardDescription>Regulatory and industry standards adherence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="px-3 py-1 bg-green-500/10 border-green-500/30">HIPAA-Aligned</Badge>
              <Badge variant="outline" className="px-3 py-1 bg-green-500/10 border-green-500/30">FHIR R4</Badge>
              <Badge variant="outline" className="px-3 py-1 bg-green-500/10 border-green-500/30">SMART on FHIR</Badge>
              <Badge variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/30">SOC 2 Roadmap</Badge>
              <Badge variant="outline" className="px-3 py-1">HL7 v2</Badge>
              <Badge variant="outline" className="px-3 py-1">GDPR Ready</Badge>
              <Badge variant="outline" className="px-3 py-1">CCPA Ready</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              <strong>Note:</strong> Designed for HIPAA-eligible cloud services under BAA for pilots. SOC 2 Type II audit scheduled Q2 2026.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-ai-compliance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              AI Safety & NO-CDS Policy
            </CardTitle>
            <CardDescription>Responsible AI implementation in healthcare</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm">
                <strong>Clinical Decision Support (CDS) is DISABLED</strong> per HIPAA/SOC2 compliance requirements.
                All AI features provide educational information and operational insights only — never clinical recommendations.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>AI guardrails detect and refuse medical advice requests</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>All AI outputs include explicit disclaimers</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>Operational predictions for scheduling/resources only</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span>Patient insights are educational, not diagnostic</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground py-4">
          <p>For security inquiries or compliance documentation requests, contact security@tabulamedica.com</p>
        </div>
      </div>
    </div>
  );
}
