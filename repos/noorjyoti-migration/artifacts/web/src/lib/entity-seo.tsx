import { useEffect } from "react";
import { upsertCanonical, upsertMeta } from "./route-seo";

/**
 * Per-entity SEO for dynamic pages (a specific scripture, a specific tradition).
 *
 * RouteSeo handles the generic, path-based baseline. This hook runs once the
 * entity data has loaded and overrides the title / description / social meta with
 * the real name, then injects JSON-LD structured data (BreadcrumbList, Book,
 * ItemList, ...). Structured data is what AI answer engines and rich-result
 * crawlers read to cite and summarise the page, so each public detail page now
 * describes itself precisely.
 *
 * Pass `null` while data is still loading — the hook then leaves the baseline in
 * place. The injected <script> is removed on unmount / when the entity changes.
 */

export type EntitySeo = {
  title: string;
  description?: string;
  jsonLd?: object | object[];
};

export function useEntitySeo(seo: EntitySeo | null) {
  const key = seo ? JSON.stringify(seo) : null;

  useEffect(() => {
    if (!seo) return;

    document.title = seo.title;
    upsertMeta("og:title", seo.title, "property");
    upsertMeta("twitter:title", seo.title);

    if (seo.description) {
      upsertMeta("description", seo.description);
      upsertMeta("og:description", seo.description, "property");
      upsertMeta("twitter:description", seo.description);
    }

    const url = window.location.origin + window.location.pathname;
    upsertCanonical(url);
    upsertMeta("og:url", url, "property");

    let script: HTMLScriptElement | null = null;
    if (seo.jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.setAttribute("data-entity-seo", "true");
      script.textContent = JSON.stringify(seo.jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      script?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** Build a schema.org BreadcrumbList from ordered crumbs (last = current page). */
export function breadcrumbJsonLd(items: { name: string; path?: string }[]) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.path ? { item: origin + item.path } : {}),
    })),
  };
}
