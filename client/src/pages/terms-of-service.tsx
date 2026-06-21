import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  Shield,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Heart,
  Ban,
  Globe,
  Clock,
  Mail,
  Smartphone,
  Server,
  Lock,
} from "lucide-react";

export default function TermsOfService() {
  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="text-center space-y-4">
          <Scale className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-terms-of-service-title">Terms of Service</h1>
          <p className="text-muted-foreground" data-testid="text-tos-effective-date">Effective Date: March 5, 2026</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-sm">
              <FileText className="h-3 w-3 mr-1" />
              Tabula Medica Terms of Service
            </Badge>
            <Badge variant="default" className="text-sm">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              HIPAA-Compliant Platform
            </Badge>
          </div>
        </div>

        <Alert className="border-primary/50 bg-primary/5">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>Summary:</strong> By using Tabula Medica, you agree to these terms. We provide a HIPAA-compliant platform to centralize your health records. We are not a healthcare provider and do not offer medical advice.
          </AlertDescription>
        </Alert>

        <Card data-testid="card-acceptance-of-terms">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              1. Acceptance of Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              By accessing or using Tabula Medica ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service.
            </p>
            <p className="text-muted-foreground">
              These Terms constitute a legally binding agreement between you and Tabula Medica regarding your use of the Service. We may update these Terms from time to time, and material changes will be communicated through the Service or via email.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-description-of-service">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              2. Description of Service
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Tabula Medica is a HIPAA-compliant healthcare data platform that enables users to centralize, view, and manage their health records from various healthcare providers. The Service includes:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Electronic health record (EHR) integration via Fasten Health</li>
              <li>Health data aggregation from multiple providers</li>
              <li>AI-powered health insights and medication explanations</li>
              <li>Medication management and allergy tracking</li>
              <li>Lab results and vitals visualization</li>
              <li>Secure health record sharing</li>
              <li>Section 508 accessibility features for users with disabilities</li>
              <li>Multi-language support (19 languages)</li>
            </ul>
          </CardContent>
        </Card>

        <Card data-testid="card-eligibility">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              3. Eligibility & Account Responsibilities
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              You must be at least 13 years of age to use the Service. By using the Service, you represent that you meet this age requirement and have the legal capacity to enter into these Terms.
            </p>
            <div>
              <h4 className="font-semibold mb-2">Your Responsibilities</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>Provide accurate and truthful information during registration</li>
                <li>Maintain the confidentiality of your account credentials</li>
                <li>Notify us immediately of any unauthorized access to your account</li>
                <li>Use the Service for lawful purposes only</li>
                <li>Not attempt to access other users' health information</li>
                <li>Not interfere with or disrupt the Service or its infrastructure</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-medical-disclaimer" className="border-2 border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              4. Medical Disclaimer
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Tabula Medica is not a healthcare provider.</strong> The information provided through the Service, including AI-generated health insights and medication information, is for informational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
              </AlertDescription>
            </Alert>
            <p className="text-muted-foreground">
              Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of information obtained through the Service.
            </p>
            <p className="text-muted-foreground">
              All AI-powered features operate under strict NO-CDS (No Clinical Decision Support) compliance, meaning outputs are informational only and never constitute clinical recommendations.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-health-data-privacy">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              5. Health Data & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Your use of the Service involves the processing of Protected Health Information (PHI) as defined by HIPAA. Our handling of your health data is governed by our{" "}
              <a href="/privacy-policy" className="text-primary underline" data-testid="link-tos-privacy">Privacy Policy</a>{" "}
              and HIPAA Notice of Privacy Practices.
            </p>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Data Encryption</p>
                  <p className="text-sm text-muted-foreground">All PHI is encrypted at rest using AES-256-GCM and in transit using TLS 1.2+.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Audit Logging</p>
                  <p className="text-sm text-muted-foreground">All access to PHI is logged and auditable. You can review who has accessed your data at any time.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-third-party-integrations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              6. Third-Party Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              The Service integrates with third-party healthcare providers, EHR systems, and data aggregators. We are not responsible for the accuracy, completeness, or availability of data provided by third-party sources. Your use of connected third-party services is subject to their respective terms and conditions.
            </p>
            <p className="text-muted-foreground">
              Connected services include Fasten Health (supporting 25,000+ US healthcare providers) and CMS Blue Button 2.0.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-intellectual-property">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              7. Intellectual Property
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              The Service, including its design, features, content, and underlying technology, is owned by Tabula Medica and is protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Service without our express written permission.
            </p>
            <p className="text-muted-foreground">
              Your health data remains yours. We do not claim ownership of any health records or personal information you provide or import into the Service.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-limitation-of-liability">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              8. Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, Tabula Medica shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of data, loss of profits, or damages arising from your use of or inability to use the Service.
            </p>
            <p className="text-muted-foreground">
              Our total liability for any claims arising from these Terms shall not exceed the amount you paid us in the twelve (12) months preceding the claim.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-service-availability">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              9. Service Availability & Termination
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              We strive to maintain high availability and reliability of the Service, but we do not guarantee uninterrupted or error-free operation. We may modify, suspend, or discontinue the Service at any time with reasonable notice.
            </p>
            <p className="text-muted-foreground">
              We may terminate or suspend your access for violation of these Terms. Upon termination, you may request export of your health data in standard formats (FHIR, C-CDA) in accordance with our Privacy Policy and applicable law.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-accessibility">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              10. Accessibility Commitment
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Tabula Medica is committed to Section 508 compliance and accessibility for all users, including those with disabilities. The Service includes voice navigation, screen reader support, keyboard shortcuts, dyslexia-friendly fonts, color-blind modes, and other accessibility features.
            </p>
            <p className="text-muted-foreground">
              If you encounter accessibility barriers, please contact us so we can address them promptly.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-governing-law">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              11. Governing Law
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles.
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-contact-us">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              12. Contact Us
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">If you have questions about these Terms of Service, please contact us:</p>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-sm text-muted-foreground">legal@tabulamedica.health</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Globe className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Website</p>
                  <p className="text-sm text-muted-foreground">
                    <a href="https://tabulamedica.health" className="text-primary underline" data-testid="link-website">https://tabulamedica.health</a>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-muted-foreground text-sm py-8 border-t space-y-1">
          <p>&copy; 2026 Tabula Medica. All rights reserved.</p>
          <p>HIPAA-Compliant Healthcare Data Platform</p>
          <div className="flex justify-center gap-4 mt-4">
            <a href="/privacy-policy" className="text-primary underline" data-testid="link-footer-privacy">Privacy Policy</a>
            <a href="/terms-of-service" className="text-primary underline" data-testid="link-footer-terms">Terms of Service</a>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
