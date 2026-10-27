/**
 * seo.ts — per-page SEO / AEO / GEO utilities.
 *
 * Primary export: `useSeoMeta(config)` — thin wrapper around the existing
 * `useSEO` hook that accepts a flat, page-specific config object and wires it
 * to <title>, all Open Graph / Twitter card tags, the canonical <link>, and an
 * optional JSON-LD <script> block. Import from this module whenever you need
 * per-page SEO on a public marketing or tool page.
 *
 * Re-exports all schema-builder helpers from @/hooks/use-seo so callers don't
 * need two separate imports.
 */

export {
  useSEO as useSeoMeta,
  setRobotsMeta,
  INDEXABLE_ROBOTS,
  NOINDEX_ROBOTS,
  buildOrganizationSchema,
  buildWebApplicationSchema,
  buildFAQSchema,
  buildBreadcrumbSchema,
  buildMedicalWebPageSchema,
  buildHowToSchema,
  buildHealthServiceSchema,
  buildSiteNavigationSchema,
  buildPageSchemas,
} from "@/hooks/use-seo";

export type { } from "@/hooks/use-seo";

const SITE_URL = "https://tabulamedica.health";

/**
 * Build a MedicalWebPage + FAQPage JSON-LD block for a public tool page.
 * Pass to `useSeoMeta({ structuredData: buildToolPageSchemas(...) })`.
 */
export function buildToolPageSchemas(opts: {
  pageName: string;
  pageDescription: string;
  pagePath: string;
  breadcrumbs: { name: string; path: string }[];
  faqs: { question: string; answer: string }[];
  medicalAudience?: string;
}) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: opts.breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: `${SITE_URL}${b.path}`,
    })),
  };

  const medicalPage = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: opts.pageName,
    description: opts.pageDescription,
    url: `${SITE_URL}${opts.pagePath}`,
    audience: {
      "@type": "MedicalAudience",
      audienceType: opts.medicalAudience ?? "Patient",
    },
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "Tabula Medica",
      url: SITE_URL,
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: opts.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.answer,
      },
    })),
  };

  return [breadcrumb, medicalPage, faqPage];
}

/**
 * Build a geo/state-specific MedicalWebPage JSON-LD block.
 */
export function buildGeoPageSchemas(opts: {
  stateName: string;
  stateSlug: string;
  pageDescription: string;
  faqs: { question: string; answer: string }[];
}) {
  const pagePath = `/care/${opts.stateSlug}`;

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: `${opts.stateName} Health Resources`,
        item: `${SITE_URL}${pagePath}`,
      },
    ],
  };

  const medicalPage = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: `Health Records & Free Care Resources in ${opts.stateName}`,
    description: opts.pageDescription,
    url: `${SITE_URL}${pagePath}`,
    audience: { "@type": "MedicalAudience", audienceType: "Patient" },
    spatialCoverage: { "@type": "State", name: opts.stateName },
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "Tabula Medica",
      url: SITE_URL,
    },
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: opts.faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return [breadcrumb, medicalPage, faqPage];
}
