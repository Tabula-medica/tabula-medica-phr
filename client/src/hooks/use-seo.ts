import { useEffect } from "react";

interface SEOProps {
  title: string;
  description?: string;
  canonicalPath?: string;
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_NAME = "Tabula Medica";
const SITE_URL = "https://tabulamedica.health";

export function useSEO({ title, description, canonicalPath, structuredData }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} - ${SITE_NAME}`;
    document.title = fullTitle;

    let metaDesc = document.querySelector('meta[name="description"]');
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

    // Host-aware base so .us / .world / .health each self-canonicalize, instead of
    // every host pointing canonical at .health (which split multi-domain ranking).
    const siteBase =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : SITE_URL;

    if (canonicalPath) {
      let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", `${siteBase}${canonicalPath}`);

      let ogUrl = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
      if (!ogUrl) {
        ogUrl = document.createElement("meta");
        ogUrl.setAttribute("property", "og:url");
        document.head.appendChild(ogUrl);
      }
      ogUrl.setAttribute("content", `${siteBase}${canonicalPath}`);

      // hreflang cluster: .us = US/TEFCA product, .world = global (x-default).
      const alternates = [
        { hreflang: "en-US", host: "https://tabulamedica.us" },
        { hreflang: "en", host: "https://tabulamedica.world" },
        { hreflang: "x-default", host: "https://tabulamedica.world" },
      ];
      document
        .querySelectorAll('link[rel="alternate"][data-seo-hreflang]')
        .forEach((el) => el.remove());
      for (const alt of alternates) {
        const link = document.createElement("link");
        link.setAttribute("rel", "alternate");
        link.setAttribute("hreflang", alt.hreflang);
        link.setAttribute("href", `${alt.host}${canonicalPath}`);
        link.setAttribute("data-seo-hreflang", "true");
        document.head.appendChild(link);
      }
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
  }, [title, description, canonicalPath, structuredData]);
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
      "HIPAA-aligned infrastructure (SOC 2 Type II audit in progress)",
      "AES-256 encryption at rest, TLS 1.3 in transit",
      "Drug savings finder",
      "FQHC free care locator",
      "Wearable device sync",
      "Care team sharing",
      "Family health profiles",
    ],
    screenshot: `${SITE_URL}/logo.png`,
    softwareVersion: "2.0",
    // NOTE: aggregateRating intentionally omitted. Self-serving/fake review
    // structured data violates Google's policies and risks a manual penalty.
    // Re-add ONLY with genuine, on-site user reviews backing it.
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
