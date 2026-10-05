import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

import { Button } from "@/components/ui/button";
import { useSEO } from "@/hooks/use-seo";
import {
  discoverTopics,
  playableItems,
  type DiscoverItem,
  type DiscoverTopic,
} from "@shared/discover-feed";

const TOPIC_LABELS: Record<DiscoverTopic, string> = {
  heart: "Heart",
  stomach: "Stomach & gut",
  blood: "Blood",
  microscopy: "Under the microscope",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function FeedCard({ item }: { item: DiscoverItem }) {
  const cardRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = useMemo(prefersReducedMotion, []);

  // Play only the card on screen; pause the rest so the feed stays light.
  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video || reduced || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.6 },
    );
    io.observe(card);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <article
      ref={cardRef}
      className="snap-start min-h-[85vh] flex flex-col justify-center gap-3 py-6"
      aria-labelledby={`discover-${item.id}`}
      data-testid={`discover-card-${item.id}`}
    >
      <video
        ref={videoRef}
        className="w-full max-h-[60vh] rounded-lg bg-black object-contain"
        src={item.file}
        poster={item.poster}
        muted
        loop
        playsInline
        preload="metadata"
        controls={reduced}
        aria-label={item.altText}
      />
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {TOPIC_LABELS[item.topic]}
      </p>
      <h2 id={`discover-${item.id}`} className="text-xl font-semibold">
        {item.title}
      </h2>
      <p className="text-muted-foreground">{item.blurb}</p>
      <p className="text-xs text-muted-foreground">
        {item.source.attribution} ·{" "}
        <a className="underline" href={item.source.recordUrl} rel="noopener noreferrer" target="_blank">
          {item.source.license}
        </a>
      </p>
    </article>
  );
}

/**
 * Public /discover feed: short, muted, looping educational clips from
 * open-licensed sources, self-hosted so no third party sees the visitor.
 */
export default function Discover() {
  useSEO({
    title: "Discover: Inside the Body",
    description:
      "Short educational clips of the heart, stomach, blood and cells under the microscope, from open-licensed medical archives.",
    canonicalPath: "/discover",
    indexable: true,
  });

  const items = useMemo(() => playableItems(), []);
  const [topic, setTopic] = useState<DiscoverTopic | "all">("all");
  const shown = topic === "all" ? items : items.filter((i) => i.topic === topic);

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">Discover: Inside the Body</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Educational only. This is not medical advice. Talk to your clinician about your own health.
      </p>

      <div className="flex flex-wrap gap-2 my-4" role="group" aria-label="Filter by topic">
        {(["all", ...discoverTopics] as const).map((t) => (
          <Button
            key={t}
            size="sm"
            variant={topic === t ? "default" : "outline"}
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
          >
            {t === "all" ? "All" : TOPIC_LABELS[t]}
          </Button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground" data-testid="discover-empty">
          New clips are on the way. Check back soon.
        </p>
      ) : (
        <div className="snap-y snap-proximity">
          {shown.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <p className="mt-8 text-sm">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
