import { useRoute, Link } from "wouter";
import { useGetTradition } from "@workspace/api-client-react";
import { ArrowLeft, MapPin, Calendar, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { useEntitySeo, breadcrumbJsonLd } from "@/lib/entity-seo";

export default function Tradition() {
  const [, params] = useRoute("/traditions/:slug");
  const slug = params?.slug || "";
  
  const { data: tradition, isLoading } = useGetTradition(slug);

  useEntitySeo(
    tradition
      ? {
          title: `${tradition.name} Scriptures — Read Aloud | NoorJyoti`,
          description: `Explore the sacred texts of ${tradition.name}, narrated in soothing AI voices. ${tradition.scriptures.length} scriptures from ${tradition.region}, founded ${tradition.founded}.`,
          jsonLd: [
            breadcrumbJsonLd([
              { name: "NoorJyoti", path: "/" },
              { name: "All Teachings", path: "/all-teachings" },
              { name: tradition.name },
            ]),
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: `${tradition.name} scriptures on NoorJyoti`,
              numberOfItems: tradition.scriptures.length,
              itemListElement: tradition.scriptures.map((s, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: s.name,
                url: `${window.location.origin}/scriptures/${s.id}`,
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
        <div className="h-4 w-96 bg-card animate-pulse rounded mb-8" />
        <div className="h-48 bg-card animate-pulse rounded-2xl mb-12" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!tradition) {
    return (
      <div className="container px-4 py-24 text-center">
        <h1 className="font-serif text-3xl mb-4">Tradition not found</h1>
        <Button asChild variant="outline">
          <Link href="/library">Return to Library</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container px-4 sm:px-8 max-w-4xl mx-auto py-12">
      <Breadcrumbs
        items={[
          { label: "All Teachings", href: "/all-teachings" },
          { label: tradition.name },
        ]}
      />
      <Button asChild variant="ghost" className="mb-8 -ml-4 text-muted-foreground hover:text-foreground">
        <Link href="/library"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Library</Link>
      </Button>

      <div className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-2 h-12 rounded-full" style={{ backgroundColor: tradition.accentColor }} />
          <h1 className="font-serif text-4xl md:text-5xl font-bold">{tradition.name}</h1>
        </div>
        
        <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mb-8">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> {tradition.region}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Founded: {tradition.founded}
          </div>
          <div className="flex items-center gap-2">
            <Book className="w-4 h-4" /> {tradition.scriptures.length} Scriptures
          </div>
        </div>

        <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed font-serif text-lg">
          {tradition.longDescription.split('\n\n').map((paragraph, i) => (
            <p key={i} className="mb-4">{paragraph}</p>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-serif text-2xl font-bold mb-6">Sacred Texts</h2>
        <div className="grid gap-4">
          {tradition.scriptures.map(scripture => (
            <Link key={scripture.id} href={`/scriptures/${scripture.id}`}>
              <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all cursor-pointer group flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-xl font-bold group-hover:text-primary transition-colors mb-1">{scripture.name}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="font-serif italic">{scripture.originalName}</span>
                    <span>•</span>
                    <span>{scripture.era}</span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-sm font-medium text-muted-foreground bg-background px-3 py-1 rounded-full border border-border mb-2">
                    {scripture.chapterCount} Chapters
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}