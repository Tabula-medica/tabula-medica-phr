import { Link } from "wouter";
import { Mail } from "lucide-react";

import { LegalDocument } from "@/components/legal-document";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSEO, buildMedicalWebPageSchema, buildBreadcrumbSchema } from "@/hooks/use-seo";

const CONTACT_EMAIL = "accessibility@tabulamedica.health";
const LAST_UPDATED = "August 23, 2026";

/**
 * Published accessibility statement for `/legal/accessibility`.
 *
 * Unlike the neighbouring legal pages this one is not Termly-managed policy
 * text awaiting review — it is a statement of what the product does and does
 * not yet support, which only the engineering record can supply. It mirrors
 * `docs/accessibility-conformance-report.md`; the two must be updated
 * together.
 *
 * Section 508 §E103.4 and EN 301 549 clause 12.1.2 both expect a published
 * statement of conformance, the evaluation method behind it, and a route for
 * reporting problems. Claiming full conformance while parts of the product are
 * untested would misstate all three.
 */
export default function AccessibilityStatement() {
  useSEO({
    title: "Accessibility Statement",
    description:
      "How Tabula Medica conforms to WCAG 2.2 Level AA and Section 508, what has been tested, the gaps that remain, and how to report an accessibility problem.",
    canonicalPath: "/legal/accessibility",
    structuredData: [
      buildBreadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Legal", path: "/legal/accessibility" },
        { name: "Accessibility Statement", path: "/legal/accessibility" },
      ]),
      buildMedicalWebPageSchema({
        name: "Accessibility Statement",
        description:
          "Tabula Medica's conformance with WCAG 2.2 Level AA and Section 508, the evaluation method, known gaps, and how to report a problem.",
        path: "/legal/accessibility",
      }),
    ],
  });

  return (
    <LegalDocument
      slug="accessibility"
      title="Accessibility Statement"
      lastUpdated={LAST_UPDATED}
    >
      <p data-testid="text-accessibility-commitment">
        Tabula Medica is a personal health record. People who need it most are
        often the people managing a chronic condition, a disability, or a
        parent's care alongside their own — so an interface that only works with
        a mouse and clear eyesight fails the people it was built for. We treat
        accessibility as part of whether the product works, not as an
        afterthought.
      </p>

      <h2>Conformance status</h2>
      <p>
        Tabula Medica aims to conform to the{" "}
        <a
          href="https://www.w3.org/TR/WCAG22/"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Web Content Accessibility Guidelines (WCAG) 2.2, Level AA
        </a>
        , and to the applicable provisions of{" "}
        <a
          href="https://www.access-board.gov/ict/"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Revised Section 508
        </a>{" "}
        (36 CFR Part 1194), which incorporates WCAG by reference.
      </p>
      <p>
        Our current status is <strong>partially conformant</strong>. That means
        most of the standard is met, and some parts are not yet met or not yet
        verified. The specific gaps are listed below rather than summarised
        away.
      </p>

      <h2>What we have done</h2>
      <ul>
        <li>
          Every form field in the application has a programmatically associated
          name, so a screen reader announces which field it is reading rather
          than just its current value.
        </li>
        <li>
          Every action that could previously be reached only by clicking can now
          be reached by keyboard, with Enter and Space, in a sensible tab order.
        </li>
        <li>
          Information that appeared only when hovering — such as the reasoning
          behind an AI insight — now appears on keyboard focus too, and can be
          dismissed with Escape.
        </li>
        <li>
          Lists, headings and dialogs keep their structure, so screen-reader
          users can navigate by heading and hear "list, 3 items" where a list
          exists.
        </li>
        <li>
          The{" "}
          <Link href="/accessibility" className="text-primary hover:underline">
            accessibility settings page
          </Link>{" "}
          offers larger text, high contrast, reduced motion, a dyslexia-friendly
          typeface, colour-blind palettes, a larger cursor, a reading guide,
          simplified layouts and voice navigation. The interface is available in
          19 languages, and the page language and text direction follow your
          choice.
        </li>
        <li>
          Accessibility rules run automatically on every code change, so a
          regression fails the build before it reaches you.
        </li>
      </ul>

      <h2>Known gaps</h2>
      <p>These are the parts that are not yet met. We are working on them.</p>
      <ul>
        <li>
          <strong>Live captions in video visits.</strong> Telehealth calls do
          not yet carry real-time captions (WCAG 1.2.4). This needs a
          transcription service on the video pipeline and is the largest
          outstanding item.
        </li>
        <li>
          <strong>Captions on the onboarding explainer video</strong> (WCAG
          1.2.2). The production video will ship with a caption track.
        </li>
        <li>
          <strong>Colour contrast has not been measured</strong> across every
          screen against the rendered interface (WCAG 1.4.3).
        </li>
        <li>
          <strong>No screen-reader testing has been completed.</strong> We have
          not yet run the product through NVDA, JAWS, VoiceOver or TalkBack, and
          we have not yet had it tested by people with disabilities. Automated
          checks catch roughly a third of accessibility problems; the rest need
          people.
        </li>
      </ul>

      <h2>How this was evaluated</h2>
      <p>
        This statement reflects a <strong>self-evaluation</strong> completed on{" "}
        {LAST_UPDATED}, using automated static analysis of every screen in the
        application, automated accessibility rule checks in our test suite, and
        manual review of the cases those tools could not decide. It has not been
        audited by a third party, and it is not a signed VPAT<sup>®</sup>. The
        full engineering record is kept in the repository as{" "}
        <code>docs/accessibility-conformance-report.md</code>.
      </p>

      <h2>Compatibility</h2>
      <p>
        Tabula Medica is built to work with current versions of Chrome, Edge,
        Firefox and Safari on desktop and mobile, and with the assistive
        technologies those browsers support. The iOS and Android apps render the
        same interface. Because screen-reader testing is still outstanding, we
        cannot yet state which specific assistive technologies are fully
        supported.
      </p>

      <h2>Tell us when something does not work</h2>
      <p>
        If any part of Tabula Medica is difficult or impossible for you to use,
        we want to hear about it — including problems this statement does not
        list. Tell us what you were trying to do, the page you were on, and the
        device or assistive technology you were using, if you can.
      </p>
      <p className="flex items-center gap-2">
        <Mail className="h-4 w-4" aria-hidden="true" />
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="text-primary hover:underline"
          data-testid="link-accessibility-contact"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
      <p>
        We aim to acknowledge every report within five business days and to tell
        you what we intend to do about it. If a fix will take time, we will say
        so and offer another way to get what you needed.
      </p>

      <Alert data-testid="alert-accessibility-alternative">
        <AlertDescription>
          If an accessibility problem is blocking you from reaching your health
          records right now, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>{" "}
          and we will get you your records another way while we fix it. You
          should never lose access to your own medical history because of how our
          interface is built.
        </AlertDescription>
      </Alert>
    </LegalDocument>
  );
}
