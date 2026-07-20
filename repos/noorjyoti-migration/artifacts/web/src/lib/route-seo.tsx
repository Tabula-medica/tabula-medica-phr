import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Runtime SEO for this client-rendered SPA: keeps <title>, the description /
 * Open Graph / Twitter meta, the canonical link, and a robots directive in sync
 * with the current route. Search engines that render JavaScript (Google) pick
 * these up; the static tags in index.html cover non-rendering crawlers.
 *
 * No dependency is added — we mutate document.head directly.
 */

type RouteMeta = {
  title: string;
  description: string;
  /** Private / transient pages should not be indexed. */
  noindex?: boolean;
};

const SITE = "NoorJyoti";

const DEFAULT_DESCRIPTION =
  "Listen to the world's great scriptures read aloud in soothing AI voices across nine languages. Free and public domain.";

const DEFAULT_META: RouteMeta = {
  title: `${SITE} — Sacred Audio Library`,
  description: DEFAULT_DESCRIPTION,
};

const ROUTES: { match: (path: string) => boolean; meta: RouteMeta }[] = [
  {
    match: (p) => p === "/",
    meta: DEFAULT_META,
  },
  {
    match: (p) => p === "/library",
    meta: {
      title: `Your Library — ${SITE}`,
      description: "Pick up where you left off across every scripture you're listening to.",
    },
  },
  {
    match: (p) => p === "/all-teachings",
    meta: {
      title: `All Teachings — ${SITE}`,
      description:
        "Browse every scripture and tradition available on NoorJyoti, from the Bible and Quran to the Bhagavad Gita and Guru Granth Sahib.",
    },
  },
  {
    match: (p) => p.startsWith("/traditions/"),
    meta: {
      title: `Tradition — ${SITE}`,
      description: "Explore the scriptures of this spiritual tradition, narrated in soothing AI voices.",
    },
  },
  {
    match: (p) => p.startsWith("/scriptures/"),
    meta: {
      title: `Scripture — ${SITE}`,
      description: "Listen to this scripture read aloud chapter by chapter, with the full public-domain text.",
    },
  },
  {
    match: (p) => p.startsWith("/listen/"),
    meta: {
      title: `Now Playing — ${SITE}`,
      description: "Continuous chapter-to-chapter recitation with a calm, distraction-free player.",
    },
  },
  {
    match: (p) => p === "/unity",
    meta: {
      title: `Unity — ${SITE}`,
      description: "Discover the shared wisdom that runs through the world's great spiritual traditions.",
    },
  },
  {
    match: (p) => p === "/me",
    meta: { title: `Profile — ${SITE}`, description: DEFAULT_DESCRIPTION, noindex: true },
  },
  {
    match: (p) => p.startsWith("/sign-in") || p.startsWith("/sign-up"),
    meta: { title: `Sign in — ${SITE}`, description: DEFAULT_DESCRIPTION, noindex: true },
  },
];

function metaForPath(path: string): RouteMeta {
  return ROUTES.find((r) => r.match(path))?.meta ?? DEFAULT_META;
}

export function upsertMeta(key: string, content: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function RouteSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const meta = metaForPath(location);
    document.title = meta.title;
    upsertMeta("description", meta.description);
    upsertMeta("robots", meta.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large");
    upsertMeta("og:title", meta.title, "property");
    upsertMeta("og:description", meta.description, "property");
    upsertMeta("twitter:title", meta.title);
    upsertMeta("twitter:description", meta.description);

    const url = window.location.origin + window.location.pathname;
    upsertCanonical(url);
    upsertMeta("og:url", url, "property");
  }, [location]);

  return null;
}
