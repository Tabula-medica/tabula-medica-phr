import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Lock, Server, FileCheck, AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";

interface AttestationData {
  document: string;
  version: string;
  generatedAt: string;
  organization: string;
  encryptionAtRest: Record<string, string>;
  encryptionInTransit: Record<string, string>;
  authentication: any;
  phiHandling: any;
  baaStatus: Record<string, string>;
  hipaaSecurityRule: Record<string, string>;
  soc2: any;
  lastReviewed: string;
  nextScheduledReview: string;
  contactEmail: string;
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "implemented" || status === "Active" || status === "in progress" ||
    status === "covered" || status === "SOC 2 Type II alignment (in progress)";
  return (
    <Badge
      variant={ok ? "default" : "secondary"}
      className={ok ? "bg-green-600 text-white dark:bg-green-700" : ""}
    >
      {ok ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
      {status}
    </Badge>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 py-1 text-sm">
      <span className="text-muted-foreground min-w-[160px]">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

export default function SecurityAttestationPage() {
  const { data, isLoading, error } = useQuery<AttestationData>({
    queryKey: ["/api/security/attestation"],
    queryFn: async () => {
      const res = await fetch("/api/security/attestation");
      if (!res.ok) throw new Error("Failed to load attestation");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl mx-auto py-12 px-4 text-center text-muted-foreground">
        Loading attestation…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-3xl mx-auto py-12 px-4 text-center text-destructive">
        Unable to load security attestation. Please try again.
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-9 w-9 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold">{data.document}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data.organization} · Version {data.version} · Last reviewed{" "}
            {new Date(data.lastReviewed).toLocaleDateString(undefined, {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
      </div>

      <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
        <CardContent className="pt-4 pb-3">
          <p className="text-sm text-green-800 dark:text-green-300">
            Tabula Medica is architected to meet the requirements of the proposed 2026 HIPAA Security Rule
            (NPRM Dec 2024) — including mandatory ePHI encryption at rest and in transit, phishing-resistant
            MFA, and 72-hour incident response — before they become law.
          </p>
        </CardContent>
      </Card>

      <Section title="Encryption at Rest" icon={<Lock className="h-4 w-4 text-primary" />}>
        <Row label="Status" value={<StatusBadge status={data.encryptionAtRest.status} />} />
        <Separator />
        <Row label="Algorithm" value={data.encryptionAtRest.algorithm} />
        <Row label="Key Management" value={data.encryptionAtRest.keyManagement} />
        <Row label="Scope" value={data.encryptionAtRest.scope} />
        <Row label="FIPS Standard" value={data.encryptionAtRest.standard} />
      </Section>

      <Section title="Encryption in Transit" icon={<Lock className="h-4 w-4 text-primary" />}>
        <Row label="Status" value={<StatusBadge status={data.encryptionInTransit.status} />} />
        <Separator />
        <Row label="Protocol" value={data.encryptionInTransit.protocol} />
        <Row label="Scope" value={data.encryptionInTransit.scope} />
        <Row label="Enforcement" value={data.encryptionInTransit.enforcement} />
      </Section>

      <Section title="Authentication" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
        <Row label="Identity Provider" value={data.authentication.primaryIdP} />
        <Separator />
        <Row
          label="MFA Methods"
          value={
            <ul className="text-right space-y-0.5">
              {data.authentication.mfa.supported.map((m: string) => (
                <li key={m} className="text-xs">{m}</li>
              ))}
            </ul>
          }
        />
        <Row label="MFA Enforcement" value={data.authentication.mfa.enforcement} />
        <Row label="Session Management" value={data.authentication.sessionManagement} />
      </Section>

      <Section title="PHI Handling" icon={<Server className="h-4 w-4 text-primary" />}>
        <Row label="Storage" value={data.phiHandling.storage} />
        <Row
          label="No PHI on non-BAA infra"
          value={
            data.phiHandling.noPhiOnReplitInfrastructure ? (
              <Badge className="bg-green-600 text-white">Confirmed</Badge>
            ) : (
              <Badge variant="destructive">No</Badge>
            )
          }
        />
        <Row
          label="De-identification before LLM"
          value={
            data.phiHandling.deidentificationBeforeLLM ? (
              <Badge className="bg-green-600 text-white">Applied</Badge>
            ) : (
              <Badge variant="secondary">Not applied</Badge>
            )
          }
        />
        <Row label="Audit Log" value={data.phiHandling.auditLog} />
      </Section>

      <Section title="Business Associate Agreements (BAA)" icon={<FileCheck className="h-4 w-4 text-primary" />}>
        {Object.entries(data.baaStatus).map(([vendor, status], i) => (
          <div key={vendor}>
            {i > 0 && <Separator />}
            <Row label={vendor} value={<StatusBadge status={status} />} />
          </div>
        ))}
      </Section>

      <Section title="HIPAA Security Rule Controls" icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
        {Object.entries(data.hipaaSecurityRule).map(([key, value], i) => (
          <div key={key}>
            {i > 0 && <Separator />}
            <Row
              label={key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
              value={value}
            />
          </div>
        ))}
      </Section>

      <Section title="SOC 2" icon={<FileCheck className="h-4 w-4 text-primary" />}>
        <Row label="Status" value={<StatusBadge status={data.soc2.type} />} />
        <Row label="Trust Service Criteria" value={data.soc2.trustServiceCriteria.join(", ")} />
        <Row label="Evidence Pipeline" value={data.soc2.evidencePipeline} />
      </Section>

      <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
        <p>Next scheduled review: {new Date(data.nextScheduledReview).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
        <p>
          Questions?{" "}
          <a href={`mailto:${data.contactEmail}`} className="underline underline-offset-2 inline-flex items-center gap-0.5">
            {data.contactEmail}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </div>
  );
}
