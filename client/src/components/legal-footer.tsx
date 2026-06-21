import { useLocation } from "wouter";
import { ShieldCheck } from "lucide-react";

/**
 * App-wide legal footer.
 *
 * Renders the four baseline links required for HIPAA-grade transparency:
 *   - Terms of Service
 *   - Privacy Policy
 *   - Cookie Policy
 *   - HIPAA Notice of Privacy Practices
 *
 * On any /care/* route an additional link to the Care Access privacy
 * policy is shown (that subsystem is explicitly designed to be PHI-free
 * for uninsured/anonymous users).
 *
 * Routes where this footer is suppressed:
 *   - /login, /welcome, /onboarding/*  (auth pre-shell pages already
 *     show their own legal links / disclaimer)
 *   - /admin/*  (internal tools)
 *   - /print/*  (printable views — keep paper output clean)
 */
export function LegalFooter() {
  const [location] = useLocation();

  // Suppress on routes that handle their own legal text or are not
  // patient-facing.
  const suppressed =
    location === "/login" ||
    location === "/welcome" ||
    location.startsWith("/onboarding") ||
    location.startsWith("/admin") ||
    location.startsWith("/print") ||
    location.startsWith("/auth/");

  if (suppressed) return null;

  const isCareAccess = location.startsWith("/care");

  return (
    <footer
      className="mt-12 border-t border-border bg-background/50"
      role="contentinfo"
      aria-label="Legal information"
      data-testid="footer-legal"
    >
      <div className="mx-auto max-w-6xl px-4 py-6 flex flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            &copy; {new Date().getFullYear()} Tabula Medica. HIPAA-aware. Educational use only — not a medical device.
          </span>
        </div>
        <nav aria-label="Legal links" className="flex flex-wrap gap-x-4 gap-y-2">
          <a
            href="/legal/terms"
            className="hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-legal-terms"
          >
            Terms of Service
          </a>
          <a
            href="/legal/privacy"
            className="hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-legal-privacy"
          >
            Privacy Policy
          </a>
          <a
            href="/legal/cookie"
            className="hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-legal-cookie"
          >
            Cookie Policy
          </a>
          <a
            href="/legal/hipaa-notice"
            className="hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-legal-hipaa"
          >
            HIPAA Notice
          </a>
          {isCareAccess && (
            <a
              href="/legal/care-access-privacy"
              className="hover:text-foreground hover:underline underline-offset-4"
              data-testid="link-legal-care-privacy"
            >
              Care Access Privacy
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}

export default LegalFooter;
