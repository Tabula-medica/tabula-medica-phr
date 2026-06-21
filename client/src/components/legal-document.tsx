import { Link } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, FileText } from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import type { ReactNode } from "react";

/**
 * Shared wrapper for legal pages under /legal/*.
 *
 * Renders breadcrumb (Home → Legal → <title>), header with title +
 * last-updated date, and a `prose` body content area. Pages under
 * /legal/* are intentionally separate from the in-app
 * clinical-disclaimer flow — these are governance-of-the-app
 * documents (Privacy, Terms, Cookie, Disclaimer, Accessibility,
 * HIPAA Notice), not patient-facing clinical content. They do NOT
 * carry the "educational use only — not a medical device" banner
 * because that banner is about clinical content, not legal text.
 *
 * Body content API — TWO accepted shapes (use one, never both):
 *
 *   1. React children (PREFERRED). Pass JSX directly. No
 *      sanitization performed because React already escapes:
 *
 *        <LegalDocument slug="terms" title="Terms" lastUpdated="...">
 *          <p>...</p>
 *          <h2>...</h2>
 *        </LegalDocument>
 *
 *   2. Sanitized HTML string (use only for pasted Termly output).
 *      The string is run through DOMPurify before being injected
 *      via dangerouslySetInnerHTML. This is defense-in-depth — even
 *      if Termly's output is currently trusted, a future policy
 *      source change should not become a silent XSS vector. ALWAYS
 *      strip <bdt> wrapper tags and inline styles from Termly output
 *      first; DOMPurify will handle the rest:
 *
 *        <LegalDocument slug="privacy" title="Privacy" lastUpdated="..."
 *                       html={termlyHtmlString} />
 *
 *      Allowed tags/attrs are limited to a conservative prose set
 *      (no scripts, no iframes, no event handlers, no inline JS in
 *      href/src). External link targets are forced to rel="noopener
 *      noreferrer" and target="_blank" via DOMPurify hook below.
 *
 * Passing both `html` and `children` throws — pick one.
 */

const PROSE_ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "code", "pre", "blockquote",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "a",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr", "span", "div",
];
const PROSE_ALLOWED_ATTRS = ["href", "title", "id", "class"];

function sanitizeLegalHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: PROSE_ALLOWED_TAGS,
    ALLOWED_ATTR: PROSE_ALLOWED_ATTRS,
    FORBID_ATTR: ["style", "onerror", "onclick", "onload"],
    ALLOW_DATA_ATTR: false,
  });
}

export interface LegalDocumentProps {
  slug: string;
  title: string;
  lastUpdated: string;
  children?: ReactNode;
  html?: string;
}

export function LegalDocument({ slug, title, lastUpdated, children, html }: LegalDocumentProps) {
  if (children !== undefined && html !== undefined) {
    throw new Error(
      "LegalDocument: pass either `children` (React) or `html` (sanitized string), not both",
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl py-8 space-y-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-sm text-muted-foreground"
          data-testid={`breadcrumb-legal-${slug}`}
        >
          <Link href="/" className="hover:text-foreground" data-testid={`link-breadcrumb-home-${slug}`}>
            Home
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <Link href="/legal/privacy" className="hover:text-foreground" data-testid={`link-breadcrumb-legal-${slug}`}>
            Legal
          </Link>
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
          <span className="text-foreground" aria-current="page">{title}</span>
        </nav>

        <header className="space-y-3 border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" aria-hidden="true" />
            <h1 className="text-3xl font-bold" data-testid={`text-legal-${slug}-title`}>
              {title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground" data-testid={`text-legal-${slug}-updated`}>
            Last updated: {lastUpdated}
          </p>
        </header>

        {html !== undefined ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            data-testid={`content-legal-${slug}`}
            dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(html) }}
          />
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            data-testid={`content-legal-${slug}`}
          >
            {children}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

export default LegalDocument;
