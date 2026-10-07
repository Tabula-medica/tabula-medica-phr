import { z } from "zod";

/**
 * Manifest for the public /discover video feed.
 *
 * An item reaches the feed only when it is `verified` AND has a self-hosted
 * `file`. "Verified" means a person opened the source record, confirmed the
 * licence permits unmodified commercial display, and copied the attribution
 * text exactly. Never point `file` at a third-party host: the feed is a public
 * page and must not hand visitors' IP addresses to outside trackers.
 */
export const discoverTopics = ["heart", "stomach", "blood", "microscopy"] as const;
export type DiscoverTopic = (typeof discoverTopics)[number];

export const discoverItemSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    topic: z.enum(discoverTopics),
    title: z.string().min(1),
    blurb: z.string().min(1),
    /** Self-hosted path under client/public, e.g. /discover/beating-heart.mp4 */
    file: z.string().regex(/^\/discover\/[\w.-]+\.(mp4|webm)$/).optional(),
    poster: z.string().regex(/^\/discover\/[\w.-]+\.(jpg|webp)$/).optional(),
    /** Plain-text description for screen readers; no autoplay-only information. */
    altText: z.string().min(1),
    source: z.object({
      name: z.string().min(1),
      recordUrl: z.string().url(),
      license: z.string().min(1),
      attribution: z.string().min(1),
    }),
    status: z.enum(["pending", "verified"]),
  })
  .refine((item) => item.status !== "verified" || !!item.file, {
    message: "verified items must have a self-hosted file",
  });

export type DiscoverItem = z.infer<typeof discoverItemSchema>;

export const DISCOVER_ITEMS: DiscoverItem[] = [
  {
    id: "beating-mammalian-heart",
    topic: "heart",
    title: "A living heart, mid-beat",
    blurb: "Watch the chambers squeeze and relax on a live, beating mammalian heart.",
    altText: "Film of a live mammalian heart beating, showing the chambers contracting and relaxing.",
    source: {
      name: "U.S. National Library of Medicine",
      recordUrl: "https://digirepo.nlm.nih.gov/catalog/nlm:nlmuid-8800227A-vid",
      license: "Believed public domain (search-summary only; confirm on record page)",
      attribution: "National Library of Medicine, Digital Collections",
    },
    status: "pending",
  },
  {
    id: "gut-motion-monkey",
    topic: "stomach",
    title: "How the gut moves food along",
    blurb: "Waves of muscle (peristalsis) pushing through the stomach and intestines.",
    altText: "Film of stomach and intestinal movements showing waves of muscle contraction.",
    source: {
      name: "U.S. National Library of Medicine",
      recordUrl: "https://collections.nlm.nih.gov/catalog/nlm:nlmuid-8600935A-vid",
      license: "Believed public domain (search-summary only; confirm on record page)",
      attribution: "National Library of Medicine, Digital Collections",
    },
    status: "pending",
  },
  {
    id: "heart-3d-cycle",
    topic: "heart",
    title: "The heart in 3D: squeeze and fill",
    blurb: "An animation of systole and diastole, the two halves of every heartbeat.",
    altText: "3D animation of a heart alternating between contraction and relaxation.",
    source: {
      name: "Wikimedia Commons (Santiago Pérez)",
      recordUrl: "https://commons.wikimedia.org/wiki/File:Movimientos_del_coraz%C3%B3n.ogv",
      license: "Creative Commons (exact version unverified; confirm on file page)",
      attribution: "Santiago Pérez, via Wikimedia Commons",
    },
    status: "pending",
  },
  {
    id: "platelets-sem",
    topic: "microscopy",
    title: "Platelets switch on",
    blurb: "Smooth discs turn into spiky stars as they activate and start a clot.",
    altText: "Electron micrograph footage of platelets changing from round discs to spiky activated forms.",
    source: {
      name: "TBD: no open-licensed video found yet",
      recordUrl: "https://commons.wikimedia.org/wiki/Category:Platelets",
      license: "Unknown. Journal supplementary videos are often CC BY-NC; do not use unless licence allows commercial display.",
      attribution: "TBD",
    },
    status: "pending",
  },
];

/** Items safe to render: verified, self-hosted, and in a stable order. */
export function playableItems(items: DiscoverItem[] = DISCOVER_ITEMS): DiscoverItem[] {
  return items.filter((i) => i.status === "verified" && !!i.file);
}
