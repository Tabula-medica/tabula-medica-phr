import { useState } from "react";
import { Link } from "wouter";
import { useListUnityQuotes, useListUnityThemes } from "@workspace/api-client-react";
import { Flame, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Unity() {
  const [activeTheme, setActiveTheme] = useState<string>("");
  
  const { data: themes, isLoading: isThemesLoading } = useListUnityThemes();
  const { data: quotes, isLoading: isQuotesLoading } = useListUnityQuotes({ theme: activeTheme || undefined });

  return (
    <div className="container px-4 sm:px-8 max-w-6xl mx-auto py-12 min-h-screen">
      <div className="text-center mb-16">
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-4 rounded-full text-primary border border-primary/20">
            <Flame className="w-8 h-8" />
          </div>
        </div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4 text-foreground">The Unity Wall</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
          Truth is one, though the wise speak of it in many ways. Discover the common threads across traditions.
        </p>
      </div>

      {/* Theme Filter */}
      <div className="flex items-center justify-center gap-2 flex-wrap mb-16">
        <Button 
          variant={activeTheme === "" ? "default" : "outline"}
          onClick={() => setActiveTheme("")}
          className="rounded-full"
        >
          All Themes
        </Button>
        {!isThemesLoading && themes?.map((theme) => (
          <Button 
            key={theme}
            variant={activeTheme === theme ? "default" : "outline"}
            onClick={() => setActiveTheme(theme)}
            className="rounded-full capitalize"
          >
            {theme}
          </Button>
        ))}
      </div>

      {/* Quotes Masonry */}
      {isQuotesLoading ? (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className={`bg-card rounded-2xl border border-border animate-pulse ${i % 2 === 0 ? 'h-64' : 'h-48'}`} />
          ))}
        </div>
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 pb-24">
          {quotes?.map((quote) => (
            <div 
              key={quote.id} 
              className="break-inside-avoid bg-card rounded-2xl border border-border p-8 relative overflow-hidden group hover:border-primary/30 transition-colors"
            >
              <div 
                className="absolute top-0 left-0 w-full h-1 opacity-60" 
                style={{ backgroundColor: quote.accentColor }} 
              />
              <p className="font-serif text-xl italic leading-relaxed mb-6 text-foreground/90">
                "{quote.quote}"
              </p>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-foreground">{quote.attribution}</span>
                <Link href={`/traditions/${quote.traditionSlug}`} className="text-xs font-medium uppercase tracking-wider hover:underline" style={{ color: quote.accentColor }}>
                  {quote.traditionName}
                </Link>
              </div>
            </div>
          ))}
          {quotes?.length === 0 && (
            <div className="col-span-full text-center py-24 text-muted-foreground">
              No quotes found for this theme.
            </div>
          )}
        </div>
      )}
    </div>
  );
}