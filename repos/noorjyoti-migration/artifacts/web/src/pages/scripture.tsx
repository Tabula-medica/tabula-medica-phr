import { useRoute, Link } from "wouter";
import { useGetScripture, useCreateMyFavorite, useDeleteMyFavorite, useListMyFavorites } from "@workspace/api-client-react";
import { useAuthState } from "@/lib/auth";
import { ArrowLeft, Clock, BookOpen, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useEntitySeo, breadcrumbJsonLd } from "@/lib/entity-seo";
import { useQueryClient } from "@tanstack/react-query";

export default function Scripture() {
  const [, params] = useRoute("/scriptures/:id");
  const id = Number(params?.id);
  const qc = useQueryClient();
  
  const { isSignedIn } = useAuthState();
  const { data: scripture, isLoading } = useGetScripture(id);
  const { data: favorites } = useListMyFavorites({
    query: { queryKey: ["/api/me/favorites"], enabled: !!isSignedIn },
  });

  const createFav = useCreateMyFavorite();
  const deleteFav = useDeleteMyFavorite();

  useEntitySeo(
    scripture
      ? {
          title: `${scripture.name} — ${scripture.traditionName} | NoorJyoti`,
          description: `Listen to the ${scripture.name} (${scripture.originalName}), a sacred text of ${scripture.traditionName}, read aloud chapter by chapter in soothing AI voices. ${scripture.chapters.length} chapters available.`,
          jsonLd: [
            breadcrumbJsonLd([
              { name: "NoorJyoti", path: "/" },
              { name: "All Teachings", path: "/all-teachings" },
              { name: scripture.traditionName, path: `/traditions/${scripture.traditionSlug}` },
              { name: scripture.name },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "Book",
              name: scripture.name,
              alternateName: scripture.originalName,
              description: scripture.description,
              url: window.location.origin + window.location.pathname,
              bookFormat: "https://schema.org/AudiobookFormat",
              genre: "Religious text",
              about: scripture.traditionName,
              numberOfPages: scripture.chapters.length,
              hasPart: scripture.chapters.map((c, i) => ({
                "@type": "Chapter",
                name: c.title,
                position: i + 1,
                url: `${window.location.origin}/listen/${c.id}`,
              })),
            },
          ],
        }
      : null,
  );

  if (isLoading) {
    return (
      <div className="container px-4 sm:px-8 max-w-4xl mx-auto py-12">
        <div className="h-8 w-24 bg-card animate-pulse rounded mb-8" />
        <div className="h-12 w-64 bg-card animate-pulse rounded mb-4" />
        <div className="h-4 w-96 bg-card animate-pulse rounded mb-12" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!scripture) {
    return (
      <div className="container px-4 py-24 text-center">
        <h1 className="font-serif text-3xl mb-4">Scripture not found</h1>
        <Button asChild variant="outline">
          <Link href="/library">Return to Library</Link>
        </Button>
      </div>
    );
  }

  const isFavorite = !!favorites?.some((f) => f.scriptureId === id);

  const handleFavorite = () => {
    if (!isSignedIn) {
      qc.invalidateQueries();
      return;
    }
    const opts = {
      onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/me/favorites"] }),
    };
    if (isFavorite) {
      deleteFav.mutate({ scriptureId: id }, opts);
    } else {
      createFav.mutate({ data: { scriptureId: id } }, opts);
    }
  };

  return (
    <div className="container px-4 sm:px-8 max-w-4xl mx-auto py-12">
      <Breadcrumbs
        items={[
          { label: "All Teachings", href: "/all-teachings" },
          { label: scripture.traditionName, href: `/traditions/${scripture.traditionSlug}` },
          { label: scripture.name },
        ]}
      />
      <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-foreground">
        <Link href={`/traditions/${scripture.traditionSlug}`}><ArrowLeft className="w-4 h-4 mr-2" /> Back to {scripture.traditionName}</Link>
      </Button>

      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium tracking-wider uppercase" style={{ color: scripture.accentColor }}>
            {scripture.traditionName}
          </div>
          <Button variant="ghost" size="icon" onClick={handleFavorite} className={isFavorite ? "text-primary hover:text-primary" : "text-muted-foreground"}>
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-current" : ""}`} />
          </Button>
        </div>
        
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2">{scripture.name}</h1>
        <h2 className="font-serif text-xl italic text-muted-foreground mb-6">{scripture.originalName} • {scripture.era}</h2>
        
        <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
          {scripture.description}
        </p>
      </div>

      <div>
        <h3 className="font-serif text-2xl font-bold mb-6 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Chapters
        </h3>
        <div className="space-y-4">
          {scripture.chapters.map(chapter => (
            <Link key={chapter.id} href={`/listen/${chapter.id}`}>
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                      {chapter.number}
                    </span>
                    <h4 className="font-serif text-xl font-bold group-hover:text-primary transition-colors">{chapter.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{chapter.summary}</p>
                </div>
                <div className="flex items-center text-sm text-muted-foreground whitespace-nowrap bg-background px-3 py-1.5 rounded-full border border-border self-start sm:self-auto">
                  <Clock className="w-4 h-4 mr-1.5" />
                  {Math.ceil(chapter.estimatedReadSeconds / 60)} min read
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}