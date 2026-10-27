import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  /**
   * Absolute URL for the `og:image` and `twitter:image` tags.
   * Defaults to the site-wide logo when omitted.
   * Use a 1200×630 px PNG/JPEG for optimal social-card rendering.
   */
  ogImage?: string;
  /**
   * When true, emits `<meta name="robots" content="noindex, nofollow">` so
   * search engines and AI crawlers keep this page out of their index. When
   * false, restores the indexable default. When undefined, the robots meta is
   * left untouched (governed by the route-level default in App.tsx).
   */
  noindex?: boolean;
}

const SITE_NAME = "Tabula Medica";
const SITE_URL = "https://tabulamedica.health";

// Mirrors the indexable robots directive in web/client/index.html so an
// explicit `noindex: false` restores the exact same crawl/snippet policy.
export const INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
export const NOINDEX_ROBOTS = "noindex, nofollow";

export function setRobotsMeta(content: string) {
  if (typeof document === "undefined") return;
  let robots = document.querySelector(
    'meta[name="robots"]',
  ) as HTMLMetaElement | null;
  if (!robots) {
    robots = document.createElement("meta");
    robots.setAttribute("name", "robots");
    document.head.appendChild(robots);
  }
  robots.setAttribute("content", content);
}

const DEFAULT_OG_IMAGE = "https://tabulamedica.health/logo.png";

export function useSEO({
  title,
  description,
  canonicalPath,
  structuredData,
  ogImage,
  noindex,
}: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} - ${SITE_NAME}`;
    document.title = fullTitle;

    const metaDesc = document.querySelector('meta[name="description"]');
    if (description) {
      if (metaDesc) {
        metaDesc.setAttribute("content", description);
      }
    }

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement("meta");
      ogTitle.setAttribute("property", "og:title");
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute("content", fullTitle);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement("meta");
      ogDesc.setAttribute("property", "og:description");
      document.head.appendChild(ogDesc);
    }
    if (description) {
      ogDesc.setAttribute("content", description);
    }

    let ogType = document.querySelector('meta[property="og:type"]');
    if (!ogType) {
      ogType = document.createElement("meta");
      ogType.setAttribute("property", "og:type");
      document.head.appendChild(ogType);
    }
    ogType.setAttribute("content", "website");

    let ogSiteName = document.querySelector('meta[property="og:site_name"]');
    if (!ogSiteName) {
      ogSiteName = document.createElement("meta");
      ogSiteName.setAttribute("property", "og:site_name");
      document.head.appendChild(ogSiteName);
    }
    ogSiteName.setAttribute("content", SITE_NAME);

    let twitterCard = document.querySelector('meta[name="twitter:card"]');
    if (!twitterCard) {
      twitterCard = document.createElement("meta");
      twitterCard.setAttribute("name", "twitter:card");
      document.head.appendChild(twitterCard);
    }
    twitterCard.setAttribute("content", "summary_large_image");

    let twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (!twitterTitle) {
      twitterTitle = document.createElement("meta");
      twitterTitle.setAttribute("name", "twitter:title");
      document.head.appendChild(twitterTitle);
    }
    twitterTitle.setAttribute("content", fullTitle);

    if (description) {
      let twitterDesc = document.querySelector(
        'meta[name="twitter:description"]',
      );
      if (!twitterDesc) {
        twitterDesc = document.createElement("meta");
        twitterDesc.setAttribute("name", "twitter:description");
        document.head.appendChild(twitterDesc);
      }
      twitterDesc.setAttribute("content", description);
    }

    // og:image / twitter:image — per-page override with site-logo fallback
    const imageUrl = ogImage ?? DEFAULT_OG_IMAGE;
    let ogImageMeta = document.querySelector('meta[property="og:image"]');
    if (!ogImageMeta) {
      ogImageMeta = document.createElement("meta");
      ogImageMeta.setAttribute("property", "og:image");
      document.head.appendChild(ogImageMeta);
    }
    ogImageMeta.setAttribute("content", imageUrl);

    let twitterImageMeta = document.querySelector(
      'meta[name="twitter:image"]',
    );
    if (!twitterImageMeta) {
      twitterImageMeta = document.createElement("meta");
      twitterImageMeta.setAttribute("name", "twitter:image");
      document.head.appendChild(twitterImageMeta);
    }
    twitterImageMeta.setAttribute("content", imageUrl);

    if (canonicalPath) {
      const canonicalHref = `${SITE_URL}${canonicalPath}`;
      let canonical = document.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", canonicalHref);

      let ogUrl = document.querySelector('meta[property="og:url"]');
      if (!ogUrl) {
        ogUrl = document.createElement("meta");
        ogUrl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute("content", canonicalHref);
    }

    const scriptId = "structured-data-seo";
    const existingScript = document.getElementById(scriptId);
    if (existingScript) {
      existingScript.remove();
    }

    if (structuredData) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.type = "application/ld+json";
      const data = Array.isArray(structuredData)
        ? structuredData
        : [structuredData];
      script.textContent = JSON.stringify(data.length === 1 ? data[0] : data);
      document.head.appendChild(script);
    }

    if (noindex !== undefined) {
      setRobotsMeta(noindex ? NOINDEX_ROBOTS : INDEXABLE_ROBOTS);
    }

    return () => {
      document.title = SITE_NAME;
      const scriptEl = document.getElementById(scriptId);
      if (scriptEl) scriptEl.remove();
    };
  }, [title, description, canonicalPath, structuredData, ogImage, noindex]);
}

export function buildOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tabula Medica",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description:
      "Patient-owned health record platform. Connect all your hospitals, clinics, and labs into one secure, HIPAA-compliant timeline.",
    foundingDate: "2024",
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      availableLanguage: [
        "English",
        "Spanish",
        "French",
        "German",
        "Chinese",
        "Japanese",
        "Korean",
        "Arabic",
        "Hindi",
        "Portuguese",
      ],
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
        description:
          "Free tier — 1 FHIR connection, timeline view, drug savings finder, FQHC locator",
      },
      {
        "@type": "Offer",
        price: "9.99",
        priceCurrency: "USD",
        description:
          "Pro tier — unlimited connections, AI health assistant, care team sharing, 6 family profiles",
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
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "1200",
      bestRating: "5",
      worstRating: "1",
    },
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
      {
        "@type": "WebPage",
        name: "Drug Savings",
        url: `${SITE_URL}/drug-savings`,
      },
      { "@type": "WebPage", name: "Try Free", url: `${SITE_URL}/try` },
      { "@type": "WebPage", name: "FAQ", url: `${SITE_URL}/faq` },
      {
        "@type": "WebPage",
        name: "Security",
        url: `${SITE_URL}/about/security`,
      },
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
