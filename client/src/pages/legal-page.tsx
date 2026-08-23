import { LegalDocument } from "@/components/legal-document";
import AccessibilityStatement from "@/pages/accessibility-statement";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Mail } from "lucide-react";

interface LegalPageContent {
  title: string;
  /**
   * Last-updated date for THIS specific document.
   *
   * Each entry below has its own `lastUpdated` field intentionally —
   * do NOT replace with a shared constant. Each policy is revised on
   * its own cadence (Privacy when privacy practices change, Terms
   * when terms change, etc.) and the dates will diverge over time.
   *
   * Keep the format consistent ("Month D, YYYY"). When you paste real
   * Termly content into this map, also update the date for that
   * specific entry to match the date Termly reports as the policy's
   * effective date — not today's date.
   */
  lastUpdated: string;
}

const LEGAL_PLACEHOLDERS: Record<string, LegalPageContent> = {
  privacy: { title: "Privacy Policy", lastUpdated: "Pending publication" },
  terms: { title: "Terms of Service", lastUpdated: "Pending publication" },
  cookie: { title: "Cookie Policy", lastUpdated: "Pending publication" },
  disclaimer: { title: "Disclaimer", lastUpdated: "Pending publication" },
  "hipaa-notice": { title: "HIPAA Notice of Privacy Practices", lastUpdated: "Pending publication" },
  // Care Access Privacy Notice — hand-written, surfaced conditionally by
  // LegalFooter on /care/* routes but must render directly when a signed-out
  // user types the URL (publicLegalRoutes allowlist in App.tsx).
  "care-access-privacy": { title: "Care Access Privacy Notice", lastUpdated: "April 18, 2026" },
};

const CONTACT_EMAIL = "privacy@tabulamedica.health";

interface LegalPageProps {
  slug: string;
}

export function LegalPage({ slug }: LegalPageProps) {
  // The accessibility statement is not Termly-managed policy text waiting on
  // legal review — it states what the product does and does not support, which
  // only the engineering record can supply. It is published, so it renders its
  // own page rather than the pending-review placeholder.
  if (slug === "accessibility") {
    return <AccessibilityStatement />;
  }

  const content = LEGAL_PLACEHOLDERS[slug];

  if (!content) {
    return (
      <LegalDocument slug="unknown" title="Legal page not found" lastUpdated="—">
        <p data-testid="text-legal-unknown-message">
          The legal page <code>{slug}</code> does not exist. Please return to the
          {" "}<a href="/" className="text-primary hover:underline">home page</a>.
        </p>
      </LegalDocument>
    );
  }

  return (
    <LegalDocument slug={slug} title={content.title} lastUpdated={content.lastUpdated}>
      <Alert
        className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20"
        data-testid={`alert-legal-${slug}-pending`}
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Content pending legal review.</strong> This page will be published
          after final legal review of the Termly-managed policy text. The route is
          live so the link from the footer resolves; the body is intentionally
          placeholder.
        </AlertDescription>
      </Alert>

      <p data-testid={`text-legal-${slug}-placeholder`}>
        Content will be published here after legal review.
      </p>

      <p className="flex items-center gap-2">
        <Mail className="h-4 w-4" aria-hidden="true" />
        Questions in the meantime? Contact{" "}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-primary hover:underline"
          data-testid={`link-legal-${slug}-contact`}
        >
          {CONTACT_EMAIL}
        </a>.
      </p>
    </LegalDocument>
  );
}

export default LegalPage;
