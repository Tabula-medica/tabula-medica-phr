import { Link } from "wouter";
import { useMemo, useState } from "react";
import {
  useListScriptures,
  useListTraditions,
} from "@workspace/api-client-react";
import { ChevronRight, BookOpen, Search } from "lucide-react";

export default function AllTeachings() {
  const { data: scriptures, isLoading } = useListScriptures();
  const { data: traditions } = useListTraditions();
  const [query, setQuery] = useState("");
  const [traditionSlug, setTraditionSlug] = useState<string>("");

  const filtered = useMemo(() => {
    const list = scriptures ?? [];
    const q = query.trim().toLowerCase();
    return list
      .filter((s) =>
        traditionSlug ? s.traditionSlug === traditionSlug : true,
      )
      .filter((s) => {
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.originalName ?? "").toLowerCase().includes(q) ||
          s.traditionName.toLowerCase().includes(q) ||
          (s.description ?? "").toLowerCase().includes(q)
        );
      });
  }, [scriptures, query, traditionSlug]);

  return (
    <div className="container px-4 sm:px-8 max-w-5xl mx-auto py-12">
      <div className="mb-8">
        <p className="text-sm text-primary font-medium mb-2">
          All Teachings
        </p>
        <h1 className="font-serif text-4xl font-bold mb-2 text-foreground">
          Every scripture, side by side
        </h1>
        <p className="text-muted-foreground">
          Browse every text in the library across all traditions.
        </p>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scriptures or traditions"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-card border border-border focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={traditionSlug}
          onChange={(e) => setTraditionSlug(e.target.value)}
          className="py-2.5 px-3 rounded-xl bg-card border border-border focus:outline-none focus:border-primary text-foreground"
        >
          <option value="">All traditions</option>
          {(traditions ?? []).map((t) => (
            <option key={t.id} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-card border border-border animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 rounded-xl bg-card border border-border text-center">
          <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">
            No scriptures match your search.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((s) => (
            <Link key={s.id} href={`/scriptures/${s.id}`}>
              <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors flex items-start gap-4 cursor-pointer group h-full">
                <div
                  className="w-1.5 h-12 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: s.accentColor }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">
                    {s.traditionName}
                  </p>
                  <h3 className="font-serif text-lg font-semibold group-hover:text-primary transition-colors">
                    {s.name}
                  </h3>
                  {s.originalName ? (
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {s.originalName}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground mt-2">
                    {s.chapterCount}{" "}
                    {s.chapterCount === 1 ? "chapter" : "chapters"}
                    {s.era ? ` · ${s.era}` : ""}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
