import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Lock, FileCheck, Globe, Mail } from "lucide-react";
import { Link } from "wouter";

interface CertStatus {
  name: string;
  status: "live" | "in-progress" | "planned";
  target?: string;
  description: string;
}

const certifications: CertStatus[] = [
  {
    name: "HIPAA",
    status: "live",
    description:
      "Layered security controls aligned to the HIPAA Security Rule. Administrative, physical, and technical safeguards in place. Business Associate Agreements executed with all PHI sub-processors.",
  },
  {
    name: "SOC 2 Type 1",
    status: "in-progress",
    target: "Q3 2026",
    description:
      "Independent attestation of security, availability, and confidentiality controls. Audit window scheduled with Strike Graph.",
  },
  {
    name: "SOC 2 Type 2",
    status: "planned",
    target: "Q1 2027",
    description: "6-month observation window begins immediately after Type 1 attestation.",
  },
  {
    name: "GDPR",
    status: "in-progress",
    target: "Q1 2027",
    description:
      "Patient data portability, erasure, rectification, and consent flows live at /gdpr. EU representative and DPO appointment in progress.",
  },
  {
    name: "ISO 27001:2022",
    status: "planned",
    target: "Q2 2027",
    description: "Annex A control mapping in scoping. Stage 1 audit targeted for Q2 2027.",
  },
  {
    name: "HITRUST r2",
    status: "planned",
    target: "2028",
    description: "Pre-assessment after ISO 27001 certification.",
  },
];

const subProcessors = [
  { name: "Google Cloud Platform", purpose: "Hosting, Healthcare API, BigQuery, Vertex AI", baa: "Yes" },
  { name: "Google Cloud Identity Platform (GCIP)", purpose: "Patient identity & MFA (covered under GCP BAA)", baa: "Yes" },
  { name: "Stripe", purpose: "Payment processing (no PHI)", baa: "N/A" },
  { name: "Sentry", purpose: "Application error tracking (PHI scrubbing enabled)", baa: "Pending" },
  { name: "Twilio", purpose: "SMS notifications (no PHI)", baa: "Pending" },
];

const securityControls = [
  "TLS 1.3 in transit, AES-256-GCM at rest",
  "Mandatory MFA for all account types",
  "PHI-safe structured logging with hash-chained audit trail (7-year retention)",
  "Granular role-based access control with patient consent enforcement",
  "Zero-knowledge encryption for highly sensitive PHI fields",
  "Quarterly disaster recovery exercises (RTO ≤ 4h, RPO ≤ 15m)",
  "External web application penetration testing (annual)",
];

function statusBadge(status: CertStatus["status"]) {
  if (status === "live") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Live</Badge>;
  if (status === "in-progress") return <Badge className="bg-amber-600 hover:bg-amber-700">In progress</Badge>;
  return <Badge variant="outline">Planned</Badge>;
}

export default function TrustCenter() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-9 w-9 text-primary" />
            <h1 className="text-3xl font-bold" data-testid="text-trust-center-title">
              Tabula Medica Trust Center
            </h1>
          </div>
          <p className="text-muted-foreground max-w-3xl">
            Tabula Medica handles protected health information (PHI) for patients and
            their families. This page is the single source of truth for our security
            posture, compliance status, sub-processor list, and how to report a
            vulnerability.
          </p>
          <p className="text-xs text-muted-foreground">Last updated: May 6, 2026</p>
        </header>

        <Card data-testid="card-certifications">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" /> Certifications & attestations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {certifications.map((c) => (
              <div key={c.name} className="flex items-start justify-between gap-4 py-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" data-testid={`text-cert-${c.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      {c.name}
                    </span>
                    {statusBadge(c.status)}
                    {c.target && (
                      <span className="text-xs text-muted-foreground">target {c.target}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-testid="card-security-controls">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Security controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {securityControls.map((s) => (
                <li key={s} className="flex gap-2">
                  <span className="text-primary">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card data-testid="card-subprocessors">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Sub-processors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Vendor</th>
                    <th className="py-2 pr-4">Purpose</th>
                    <th className="py-2">BAA / DPA</th>
                  </tr>
                </thead>
                <tbody>
                  {subProcessors.map((sp) => (
                    <tr key={sp.name} className="border-t">
                      <td className="py-2 pr-4 font-medium">{sp.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{sp.purpose}</td>
                      <td className="py-2">{sp.baa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-vuln-disclosure" id="acknowledgments">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" /> Coordinated vulnerability disclosure
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              We welcome security research conducted under the safe-harbor terms
              published in our{" "}
              <a
                href="/.well-known/security.txt"
                className="text-primary underline"
                data-testid="link-security-txt"
              >
                /.well-known/security.txt
              </a>
              .
            </p>
            <p>
              Report vulnerabilities to{" "}
              <a
                href="mailto:security@tabulamedica.health"
                className="text-primary underline"
                data-testid="link-security-email"
              >
                security@tabulamedica.health
              </a>
              . We acknowledge receipt within 3 business days and provide a triage
              decision within 10 business days.
            </p>
            <p className="text-muted-foreground">
              Researchers acting in good faith — avoiding PHI access, service
              disruption, and premature disclosure — will not be pursued legally.
              Public acknowledgments will appear in this section after fixes ship.
            </p>
          </CardContent>
        </Card>

        <Separator />

        <footer className="text-sm text-muted-foreground space-y-2">
          <p>
            Related pages:{" "}
            <Link href="/legal/privacy" className="text-primary underline">
              Privacy Policy
            </Link>{" "}
            ·{" "}
            <Link href="/legal/hipaa-notice" className="text-primary underline">
              HIPAA Notice
            </Link>{" "}
            ·{" "}
            <Link href="/gdpr" className="text-primary underline">
              GDPR Self-Service
            </Link>{" "}
            ·{" "}
            <Link href="/ccpa" className="text-primary underline">
              CCPA Notice
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
