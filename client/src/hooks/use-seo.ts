import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  /**
   * Canonical path for this page. Defaults to the current `location.pathname`,
   * so a page never inherits the previous route's canonical URL.
   */
  canonicalPath?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /**
   * Set `false` on pages that must never be indexed — anything behind auth, or
   * a surface whose content belongs to one patient. Emits
   * `noindex, nofollow` and drops the canonical link.
   */
  indexable?: boolean;
}

/** Create the tag if it is missing, then set its content. */
function setMeta(selector: string, attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

const SITE_NAME = "Tabula Medica";
const SITE_URL = "https://tabulamedica.health";

export function useSEO({
  title,
  description,
  canonicalPath,
  structuredData,
  indexable = true,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} - ${SITE_NAME}`;
    document.title = fullTitle;

    // Fall back to the live path so single-page navigations cannot leave a
    // stale canonical or og:url pointing at whichever page ran last.
    const path =
      canonicalPath ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const pageUrl = `${SITE_URL}${path}`;

    if (description) {
      setMeta('meta[name="description"]', "name", "description", description);
    }

    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    setMeta('meta[property="og:type"]', "property", "og:type", "website");
    setMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME);
    setMeta('meta[property="og:url"]', "property", "og:url", pageUrl);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    if (description) {
      setMeta('meta[property="og:description"]', "property", "og:description", description);
      setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    }

    // Search and answer engines are told, per page, whether it may be indexed.
    // Patient-facing surfaces carry PHI and must stay out of every index even
    // if a link to one escapes.
    setMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      indexable
        ? "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
        : "noindex, nofollow, noarchive",
    );

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (indexable) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", pageUrl);
    } else if (canonical) {
      canonical.remove();
    }

    const scriptId = "structured-data-seo";
    let existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredData) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      const data = Array.isArray(structuredData) ? structuredData : [structuredData];
      script.textContent = JSON.stringify(data.length === 1 ? data[0] : data);
      document.head.appendChild(script);
    }

    return () => {
      document.title = SITE_NAME;
      const scriptEl = document.getElementById(scriptId);
      if (scriptEl) scriptEl.remove();
    };
  }, [title, description, canonicalPath, structuredData, indexable]);
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tabula Medica",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: "Patient-owned health record platform. Connect all your hospitals, clinics, and labs into one secure, HIPAA-compliant timeline.",
    foundingDate: "2024",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: ["English", "Spanish", "French", "German", "Chinese", "Japanese", "Korean", "Arabic", "Hindi", "Portuguese"],
    },
  };
}

export function buildWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Tabula Medica",
    url: SITE_URL,
    applicationCategory: "HealthApplication",
    operatingSystem: "iOS, Android, Web",
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free tier — 1 FHIR connection, timeline view, drug savings finder, FQHC locator",
      },
      {
        "@type": "Offer",
        price: "9.99",
        priceCurrency: "USD",
        description: "Pro tier — unlimited connections, AI health assistant, care team sharing, 6 family profiles",
        priceValidUntil: "2027-12-31",
      },
    ],
    featureList: [
      "SMART on FHIR EHR connections",
      "TEFCA federated health record queries",
      "AI health insights and plain-language summaries",
      "19-language medical terminology translation",
      "HIPAA & SOC 2 Type II compliant",
      "Zero-knowledge encryption",
      "Drug savings finder",
      "FQHC free care locator",
      "Wearable device sync",
      "Care team sharing",
      "Family health profiles",
    ],
    screenshot: `${SITE_URL}/logo.png`,
    softwareVersion: "2.0",
  };
}

export function buildFAQSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function buildMedicalWebPageSchema(opts: {
  name: string;
  description: string;
  path: string;
  medicalAudience?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    ...(opts.medicalAudience && {
      audience: {
        "@type": "MedicalAudience",
        audienceType: opts.medicalAudience,
      },
    }),
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "Tabula Medica",
      url: SITE_URL,
    },
  };
}

export function buildHowToSchema(opts: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime && { totalTime: opts.totalTime }),
    step: opts.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function buildHealthServiceSchema(opts: {
  name: string;
  description: string;
  path: string;
  serviceType: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    about: {
      "@type": "MedicalTherapy",
      name: opts.serviceType,
    },
    audience: {
      "@type": "MedicalAudience",
      audienceType: "Patient",
    },
    inLanguage: "en",
    isAccessibleForFree: true,
    publisher: {
      "@type": "Organization",
      name: "Tabula Medica",
      url: SITE_URL,
    },
  };
}

export function buildSiteNavigationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SiteNavigationElement",
    name: "Tabula Medica Navigation",
    hasPart: [
      { "@type": "WebPage", name: "Home", url: SITE_URL },
      { "@type": "WebPage", name: "Dashboard", url: `${SITE_URL}/dashboard` },
      { "@type": "WebPage", name: "Health Timeline", url: `${SITE_URL}/timeline` },
      { "@type": "WebPage", name: "Connections", url: `${SITE_URL}/connections` },
      { "@type": "WebPage", name: "Drug Savings", url: `${SITE_URL}/drug-savings` },
      { "@type": "WebPage", name: "Try Free", url: `${SITE_URL}/try` },
      { "@type": "WebPage", name: "FAQ", url: `${SITE_URL}/faq` },
      { "@type": "WebPage", name: "Security", url: `${SITE_URL}/about/security` },
    ],
  };
}

export function buildPageSchemas(opts: {
  pageName: string;
  pageDescription: string;
  pagePath: string;
  breadcrumbs: { name: string; path: string }[];
  medicalAudience?: string;
}) {
  return [
    buildBreadcrumbSchema(opts.breadcrumbs),
    buildMedicalWebPageSchema({
      name: opts.pageName,
      description: opts.pageDescription,
      path: opts.pagePath,
      medicalAudience: opts.medicalAudience || "Patient",
    }),
  ];
}
