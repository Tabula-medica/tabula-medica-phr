import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Lock, 
  Eye, 
  Database, 
  Server, 
  UserCheck, 
  Mail, 
  FileText,
  RefreshCw,
  Share2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  Camera,
  Heart,
  Ban,
  Scale
} from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-privacy-policy-title">Notice of Privacy Practices</h1>
          <p className="text-muted-foreground" data-testid="text-npp-effective-date">Effective Date: February 16, 2026</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm">
              <FileText className="h-3 w-3 mr-1" />
              HIPAA Notice of Privacy Practices
            </Badge>
            <Badge variant="default" className="text-sm" data-testid="badge-2026-updated">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Updated for 2026 Regulations
            </Badge>
          </div>
        </div>

        <Alert className="border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Plain Language Summary:</strong> This notice is written in plain language as required by HIPAA. It describes how your health information may be used and shared, and your rights regarding that information. If anything is unclear, please contact our Privacy Officer.
          </AlertDescription>
        </Alert>

        <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" data-testid="alert-2026-update-notice">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>February 2026 Update:</strong> This Notice of Privacy Practices has been updated to comply with new HIPAA regulations effective February 16, 2026, including enhanced protections for Substance Use Disorder (SUD) records under 42 CFR Part 2 alignment and reproductive health information privacy under the HIPAA Privacy Rule modifications.
          </AlertDescription>
        </Alert>

        <Card className="border-2 border-primary/30 bg-primary/5" data-testid="card-privacy-tldr">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Privacy TL;DR (The Short Version)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>Your data is yours.</strong> We collect your health records to show them to you in one place. You control who else sees them.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>We don't sell your data.</strong> Ever. Not to advertisers, not to data brokers, not to anyone.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>Substance use disorder records get extra protection.</strong> SUD treatment records are now protected under unified HIPAA rules (42 CFR Part 2 alignment) with strict limits on use in legal proceedings, except where specifically permitted by law.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>Reproductive health information is private.</strong> We will never disclose your reproductive health data for investigations or legal proceedings related to lawful reproductive healthcare.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>We merge your records carefully.</strong> When we combine records from different sources, we ask you to verify matches. Original data is always preserved.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>You have rights.</strong> You can see, correct, delete, or export your data at any time. You can also see who has accessed it.</p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p><strong>We protect your data.</strong> Encryption, secure login, and audit logs keep your health information safe.</p>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p><strong>Informational only.</strong> Tabula Medica helps you understand your health data but does not provide medical advice, diagnosis, or treatment.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-sud-protections" className="border-2 border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Substance Use Disorder (SUD) Records Protection
            </CardTitle>
            <Badge variant="outline" className="w-fit text-xs">
              42 CFR Part 2 / HIPAA Alignment - Effective February 16, 2026
            </Badge>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Effective February 16, 2026, substance use disorder treatment records receive the same protections as all other health information under HIPAA, with additional safeguards:
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Shield className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Unified Protection Standard</p>
                  <p className="text-sm text-muted-foreground">SUD records are now integrated into HIPAA's general framework under the updated 42 CFR Part 2 rules. This means your SUD treatment records receive consistent, strong protections alongside all other health data.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Ban className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Anti-Discrimination Safeguard</p>
                  <p className="text-sm text-muted-foreground">SUD records obtained through consent or permitted disclosures are generally prohibited from use in civil, criminal, administrative, or legislative proceedings against you. Exceptions apply where required by law, including court-ordered disclosures for medical emergencies, scientific research with safeguards, audit and evaluation activities, or as otherwise permitted under 42 CFR Part 2 as amended.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Lock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Consent Requirements</p>
                  <p className="text-sm text-muted-foreground">We will obtain your specific written consent before sharing SUD treatment records for purposes beyond treatment, payment, and healthcare operations. You may revoke this consent at any time.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <FileText className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Re-disclosure Notice</p>
                  <p className="text-sm text-muted-foreground">Any SUD records shared with authorized recipients include a notice prohibiting further re-disclosure without your additional consent, ensuring your information remains controlled.</p>
                </div>
              </div>
            </div>

            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Your Treatment History Is Protected:</strong> Under these updated rules, past, present, or future SUD treatment records in Tabula Medica are protected from unauthorized use in proceedings against you, subject to limited exceptions required by law. We do not use your treatment-seeking behavior against you.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card data-testid="card-reproductive-health-protections" className="border-2 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Reproductive Health Information Privacy
            </CardTitle>
            <Badge variant="outline" className="w-fit text-xs">
              HIPAA Privacy Rule Modification - Effective February 16, 2026
            </Badge>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Under the updated HIPAA Privacy Rule effective February 16, 2026, Tabula Medica provides enhanced protections for reproductive health information:
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Ban className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Prohibited Disclosures</p>
                  <p className="text-sm text-muted-foreground">We will not disclose your reproductive health information for the purpose of investigating or imposing liability on any person for seeking, obtaining, providing, or facilitating reproductive healthcare that is lawful under the circumstances in which it was provided. Disclosures may still occur when required for treatment, payment, healthcare operations, or as specifically required by other applicable law.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Scale className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Legal Process Protection</p>
                  <p className="text-sm text-muted-foreground">Requests for reproductive health information via court orders, subpoenas, or other legal processes will be reviewed and challenged as appropriate. We will not produce records to support investigations targeting lawful reproductive healthcare.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <FileText className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Attestation Requirement</p>
                  <p className="text-sm text-muted-foreground">Any request for reproductive health information that is not for treatment, payment, or healthcare operations must include an attestation that the information will not be used to investigate or impose liability for lawful reproductive healthcare.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <Eye className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Scope of Protection</p>
                  <p className="text-sm text-muted-foreground">This protection covers all reproductive health information including but not limited to: contraception, fertility treatments, prenatal care, pregnancy, miscarriage, stillbirth, and all other reproductive health services received lawfully.</p>
                </div>
              </div>
            </div>

            <Alert className="border-purple-500/50 bg-purple-50 dark:bg-purple-950/20">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <strong>Your Reproductive Health Data Is Protected:</strong> Tabula Medica will not voluntarily disclose your reproductive health records to law enforcement, government agencies, or any third party seeking to use the information to investigate or penalize lawful reproductive healthcare decisions. Disclosures required by applicable law or for permitted HIPAA purposes (treatment, payment, healthcare operations) may still apply.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card data-testid="card-information-collected">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              1. Information We Collect
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Protected Health Information (PHI)</h4>
              <p className="text-muted-foreground mb-2">Health data imported from your connected sources:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Medical records from EHR systems via Fasten Health</li>
                <li>Medications, conditions, allergies, and immunizations</li>
                <li>Lab results, vital signs, and clinical notes</li>
                <li>Imaging reports and procedures</li>
                <li>Substance use disorder treatment records (protected under 42 CFR Part 2 alignment)</li>
                <li>Reproductive health information (protected under 2026 HIPAA Privacy Rule)</li>
                <li>Documents you manually upload or scan</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Personal Information</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Name, email address, and contact information</li>
                <li>Date of birth and demographic information</li>
                <li>Account credentials (securely encrypted)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Metadata from Third-Party Aggregators</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Sync timestamps and source identifiers</li>
                <li>Data quality indicators and provenance information</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Technical Information</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Device type, operating system, and app version</li>
                <li>Usage patterns for improving the service (no PHI included)</li>
                <li>Error logs for troubleshooting (no PHI included)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-how-we-use-data">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              2. How We Use Your Data
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Permitted Uses (Treatment, Payment, Healthcare Operations)</h4>
              <p className="text-muted-foreground mb-2">Under HIPAA, we may use your PHI for:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Treatment:</strong> Displaying your unified health record and enabling sharing with your care team</li>
                <li><strong>Healthcare Operations:</strong> Improving our service, quality assurance, and care coordination</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Creating Your Longitudinal Health Journey</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Aggregating data from multiple sources (EHRs, wearables, manual uploads)</li>
                <li>Creating a unified timeline of your health events</li>
                <li>Generating AI-powered summaries and explanations (informational only)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Identity Resolution (Deduplication)</h4>
              <p className="text-muted-foreground mb-2">To create your unified record, we:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Use the NMN (No Middle Name) standard for demographic formatting</li>
                <li>Apply deterministic and probabilistic matching algorithms</li>
                <li>Prompt you to verify "near-matches" before merging</li>
                <li>Preserve original source data for audit purposes</li>
              </ul>
            </div>

            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Minimum Necessary Rule:</strong> We only access the minimum data necessary to provide our service. We do not access or store more than is required.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card data-testid="card-data-sharing">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              3. How We Share Your Data
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <p className="font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                We Never Sell Your Data
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                We do not sell your personal or health information to advertisers, data brokers, or any third parties. This includes HealthKit data if you use our iOS app.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sharing With Your Consent</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Healthcare providers you authorize via Care Packets</li>
                <li>Family members or caregivers you designate</li>
                <li>Other apps or services you explicitly connect</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Sharing Restrictions for Sensitive Data</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>SUD Records:</strong> Shared only with your specific written consent beyond TPO (Treatment, Payment, Operations). Recipients receive re-disclosure prohibition notices.</li>
                <li><strong>Reproductive Health Data:</strong> Never disclosed for investigations targeting lawful reproductive healthcare. Requestors must provide attestation of permitted purpose.</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Service Providers Under BAA</h4>
              <p className="text-muted-foreground mb-2">We work with the following subprocessors, all bound by Business Associate Agreements:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Google Cloud Platform:</strong> Cloud hosting and data storage (US regions)</li>
                <li><strong>Google Cloud Run:</strong> Application hosting with HIPAA-aligned infrastructure</li>
                <li><strong>OpenAI:</strong> AI processing with zero data retention for PHI</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Legal Requirements</h4>
              <p className="text-muted-foreground">We may disclose PHI as required by law (e.g., public health reporting, court orders), subject to the enhanced protections for SUD and reproductive health information described above.</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-your-rights">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              4. Your Rights Under HIPAA
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">As a patient, you have the following rights regarding your health information:</p>
            
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Eye className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Inspect and Copy</p>
                  <p className="text-sm text-muted-foreground">Request and receive a copy of your medical records at any time. Under ONC HTI-1 Information Blocking rules, we fulfill access requests without unreasonable delay, within 15 calendar days.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <RefreshCw className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Request Amendment</p>
                  <p className="text-sm text-muted-foreground">Request corrections to inaccurate information, including records incorrectly merged during deduplication.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Accounting of Disclosures</p>
                  <p className="text-sm text-muted-foreground">See a list of who has accessed your health data and when, including any disclosures of SUD records or reproductive health information.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Request Restrictions</p>
                  <p className="text-sm text-muted-foreground">Limit how we use or share your information, including additional restrictions on SUD and reproductive health data.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Database className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Data Portability</p>
                  <p className="text-sm text-muted-foreground">Export your data in standard FHIR format for use with other systems. Access provided without information blocking per ONC HTI-1.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Share2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Right to Revoke Consent</p>
                  <p className="text-sm text-muted-foreground">Withdraw consent for data sharing at any time (does not affect prior disclosures). SUD record consent may be revoked separately.</p>
                </div>
              </div>
            </div>

            <p className="text-sm">
              To exercise these rights, use the <strong>Privacy Settings</strong> in the app or contact our Privacy Officer at <a href="mailto:privacy@tabulamedica.com" className="text-primary">privacy@tabulamedica.com</a>.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-security">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              5. Security Safeguards
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Encryption</p>
                  <p className="text-sm text-muted-foreground">All data encrypted in transit (TLS 1.3) and at rest (AES-256-GCM). Zero-knowledge encryption available for sensitive documents.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Fingerprint className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Mandatory Multi-Factor Authentication (2026 Requirement)</p>
                  <p className="text-sm text-muted-foreground">As of 2026, MFA is required for all administrative and user logins per updated HIPAA security requirements. Supported methods include TOTP authenticator apps, biometric verification (FaceID/TouchID), and backup recovery codes. Automatic session timeout after inactivity.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Audit Logging</p>
                  <p className="text-sm text-muted-foreground">Every access to your health data is logged with timestamps, user identity, and action taken. Tamper-evident WORM (Write Once Read Many) storage. Includes specific tracking for SUD and reproductive health record access.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Database className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">NMN Standard Compliance</p>
                  <p className="text-sm text-muted-foreground">Industry-standard demographic formatting (No Middle Name standard) prevents matching errors during deduplication.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Data Integrity</p>
                  <p className="text-sm text-muted-foreground">Original source data preserved even after merging. "Golden Record" can be audited and unmerged if needed.</p>
                </div>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                <strong>Compliance Status:</strong> HIPAA-aligned design with administrative, physical, and technical safeguards. SOC 2 Type II certification on roadmap for Q2 2026. Full compliance with 42 CFR Part 2 alignment and HIPAA reproductive health privacy modifications.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-information-blocking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              6. Information Blocking Compliance (ONC HTI-1)
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Tabula Medica complies with the ONC Health IT Certification Program (HTI-1) and 21st Century Cures Act information blocking regulations:
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">15-Day Access Guarantee</p>
                  <p className="text-sm text-muted-foreground">All patient data access requests are fulfilled within 15 calendar days. Most requests via our platform are fulfilled instantly through our self-service portal.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Database className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">No Data Gating</p>
                  <p className="text-sm text-muted-foreground">We do not restrict, delay, or gate access to your Electronic Health Information (EHI). All available data is accessible without unreasonable barriers.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Share2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">USCDI v6 Compliance</p>
                  <p className="text-sm text-muted-foreground">Data access supports all US Core Data for Interoperability (USCDI) v6 data classes (released July 2025) via standard FHIR R4/R5 APIs. USCDI v7 draft (January 2026) is being tracked for future compliance.</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              For more details on our information blocking policies and to submit data access requests, visit the <a href="/information-blocking-compliance" className="text-primary font-medium">Information Blocking Compliance</a> page.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-app-permissions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              7. App Permissions (iOS/Android)
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">We request the following device permissions:</p>
            
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Camera:</strong> To scan and upload paper medical documents or prescription labels.
              </li>
              <li>
                <strong>Face ID / Touch ID:</strong> For secure biometric login without entering passwords.
              </li>
              <li>
                <strong>Notifications:</strong> To alert you about health reminders and shared record access.
              </li>
              <li>
                <strong>HealthKit / Health Connect:</strong> To import vitals and activity data (with your explicit consent).
              </li>
            </ul>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>HealthKit Data:</strong> If you connect Apple HealthKit, we never share this data with advertisers or data brokers. It is used solely to display your health information.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card data-testid="card-data-retention">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              8. Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">We retain your data as follows:</p>
            
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Active Account:</strong> Data retained for the life of your account.
              </li>
              <li>
                <strong>After Account Deletion:</strong> Medical records retained for 7 years per healthcare record retention laws, then securely deleted.
              </li>
              <li>
                <strong>Audit Logs:</strong> Retained for 7 years for compliance purposes.
              </li>
              <li>
                <strong>Technical Logs:</strong> Deleted after 90 days.
              </li>
              <li>
                <strong>SUD Treatment Records:</strong> Subject to 42 CFR Part 2 retention requirements; consent records maintained for the duration of data retention.
              </li>
            </ul>

            <p className="text-sm text-muted-foreground">
              You may request earlier deletion of certain data, subject to legal retention requirements.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-contact">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              9. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p>If you have questions about this Notice of Privacy Practices or wish to exercise your rights:</p>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Privacy Officer</strong></p>
              <p>Email: <a href="mailto:privacy@tabulamedica.com" className="text-primary">privacy@tabulamedica.com</a></p>
              <p>Website: <a href="https://www.tabulamedica.digital" className="text-primary">www.tabulamedica.digital</a></p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Filing a Complaint</h4>
              <p className="text-sm text-muted-foreground">
                If you believe your privacy rights have been violated, you may file a complaint with us or with the U.S. Department of Health and Human Services Office for Civil Rights. You will not be penalized or retaliated against for filing a complaint.
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-4">
              This Notice of Privacy Practices may be updated periodically. We will notify you of any material changes via the app or email. Continued use after updates constitutes acknowledgment of the revised notice.
            </p>
          </CardContent>
        </Card>

        <div className="text-center space-y-2 py-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              NO-CDS Compliant
            </Badge>
            <Badge variant="outline" className="text-xs">
              42 CFR Part 2 Aligned
            </Badge>
            <Badge variant="outline" className="text-xs">
              ONC HTI-1 Compliant
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Tabula Medica is for informational purposes only and does not provide medical advice, diagnosis, or treatment recommendations.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
