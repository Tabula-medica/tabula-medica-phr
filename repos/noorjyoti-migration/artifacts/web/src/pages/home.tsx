import { Link } from "wouter";
import { useListTraditions, useGetFeatured, useListUnityQuotes, useGetMyDashboard } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { ArrowRight, ArrowDown, Flame, Book, Sparkles, BookOpen, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/lib/auth";
import { enabledWhen } from "@/lib/queryEnabled";
import heroBg from "@/assets/hero-bg.png";

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Home() {
  const { isSignedIn } = useAuthState();
  const { data: traditions, isLoading: isTraditionsLoading } = useListTraditions();
  const { data: featuredItems, isLoading: isFeaturedLoading } = useGetFeatured();
  const { data: unityQuotes, isLoading: isQuotesLoading } = useListUnityQuotes({});
  const { data: dashboard } = useGetMyDashboard({
    query: enabledWhen(!!isSignedIn),
  });

  const continueListening = (dashboard?.recentHistory ?? []).filter(
    (h) => !h.completed && h.positionSeconds > 5,
  );

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex flex-col items-center justify-center overflow-hidden pb-8">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-transparent" />
        </div>
        
        <div className="container relative z-10 px-4 sm:px-8 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="bg-primary/10 p-3 rounded-full mb-6 text-primary backdrop-blur-sm border border-primary/20">
              <Flame className="w-8 h-8" />
            </div>
            <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight mb-5 text-foreground text-balance">
              A sanctuary for <br/><span className="text-primary italic">sacred listening</span>.
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-8 font-light leading-relaxed">
              Explore the world's wisdom traditions in a calm, reverent space —
              every faith honored equally, every voice given the same light.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button asChild size="lg" className="rounded-full px-8 text-base bg-primary text-primary-foreground hover:bg-primary/90 h-14">
                <Link href="/sign-up">Begin Your Journey</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8 text-base bg-background/50 backdrop-blur border-border hover:bg-accent h-14">
                <Link href="/all-teachings">Explore Scriptures <ArrowRight className="ml-2 w-4 h-4" /></Link>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          className="relative z-10 mt-10 flex flex-col items-center text-muted-foreground/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span className="text-xs tracking-widest uppercase mb-2">Explore below</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          >
            <ArrowDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </section>

      {/* Continue Listening (signed-in only) */}
      {isSignedIn && (
        <section className="py-16 bg-background border-b border-border">
          <div className="container px-4 sm:px-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="font-serif text-2xl md:text-3xl font-bold mb-1 flex items-center gap-2">
                  <RotateCcw className="w-5 h-5 text-primary" aria-hidden="true" />
                  Continue Listening
                </h2>
                <p className="text-muted-foreground text-sm">
                  {continueListening.length > 0
                    ? "Pick up right where you left off."
                    : "Nothing in progress yet — start a chapter and we'll save your place."}
                </p>
              </div>
            </div>

            {continueListening.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                </div>
                <p className="font-serif text-lg mb-2">Your reading journey begins here.</p>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Browse the library to find a tradition that calls to you. Anything you start will appear in this row.
                </p>
                <Button asChild size="lg" className="rounded-full px-8 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Link href="/library">Explore the library <ArrowRight className="ml-2 w-4 h-4" aria-hidden="true" /></Link>
                </Button>
              </div>
            ) : (
            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 gap-4 snap-x snap-mandatory hide-scrollbar">
              {continueListening.map((item) => (
                <Link key={item.chapterId} href={`/listen/${item.chapterId}`}>
                  <div className="min-w-[280px] w-[280px] p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 cursor-pointer group snap-start relative overflow-hidden">
                    <div
                      className="absolute top-0 left-0 w-full h-1"
                      style={{ backgroundColor: item.accentColor }}
                    />
                    <div
                      className="text-[10px] font-medium tracking-widest uppercase mb-3"
                      style={{ color: item.accentColor }}
                    >
                      {item.traditionName}
                    </div>
                    <h3 className="font-serif text-lg font-bold mb-1 leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {item.chapterTitle}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {item.scriptureName}
                    </p>
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatTime(item.positionSeconds)}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <Play className="w-3 h-3" /> Resume
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            )}
          </div>
        </section>
      )}

      {/* Traditions Grid */}
      <section className="py-24 bg-background">
        <div className="container px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Wisdom Traditions</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Nine traditions, treated with equal reverence. Strict alphabetical order.
            </p>
          </div>

          {isTraditionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="h-48 rounded-2xl bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {traditions?.map((tradition) => (
                <Link key={tradition.id} href={`/traditions/${tradition.slug}`}>
                  <div className="group h-full p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col cursor-pointer relative overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                      style={{ backgroundColor: tradition.accentColor }} 
                    />
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 rounded-full bg-background border border-border group-hover:border-primary/30 transition-colors">
                        <Book className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="font-serif text-2xl font-semibold">{tradition.name}</h3>
                    </div>
                    <p className="text-muted-foreground text-sm flex-grow mb-4 leading-relaxed line-clamp-2">
                      {tradition.shortDescription}
                    </p>
                    <div className="flex items-center justify-between text-xs font-medium text-muted-foreground pt-4 border-t border-border">
                      <span>{tradition.scriptureCount} Scriptures</span>
                      <span className="flex items-center group-hover:text-primary transition-colors">
                        Explore <ArrowRight className="ml-1 w-3 h-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Shelf */}
      <section className="py-24 bg-card border-y border-border">
        <div className="container px-4 sm:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="font-serif text-3xl font-bold mb-2 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                Featured Shelf
              </h2>
              <p className="text-muted-foreground">Curated passages from across traditions.</p>
            </div>
          </div>

          <div className="flex overflow-x-auto pb-8 -mx-4 px-4 sm:mx-0 sm:px-0 gap-6 snap-x snap-mandatory hide-scrollbar">
            {isFeaturedLoading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="min-w-[300px] w-[300px] h-[400px] rounded-xl bg-background border border-border animate-pulse snap-center" />
              ))
            ) : (
              featuredItems?.map((item) => (
                <Link key={item.chapterId} href={`/listen/${item.chapterId}`}>
                  <div className="min-w-[300px] w-[300px] h-[400px] p-6 rounded-xl bg-background border border-border hover:border-primary/50 transition-all duration-300 flex flex-col cursor-pointer group snap-center relative overflow-hidden">
                    <div 
                      className="absolute top-0 right-0 w-16 h-16 opacity-10 rounded-bl-full" 
                      style={{ backgroundColor: item.accentColor }} 
                    />
                    <div className="mb-auto">
                      <div className="text-xs font-medium text-muted-foreground tracking-wider uppercase mb-4" style={{ color: item.accentColor }}>
                        {item.traditionName}
                      </div>
                      <h3 className="font-serif text-xl font-bold mb-2 leading-tight group-hover:text-primary transition-colors">
                        {item.chapterTitle}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {item.scriptureName}
                      </p>
                    </div>
                    <div className="mt-6 pt-6 border-t border-border">
                      <p className="font-serif italic text-muted-foreground text-sm line-clamp-3">
                        "{item.tagline}"
                      </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Unity Wall Glimpse */}
      <section className="py-32 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5 opacity-50 pointer-events-none" />
        <div className="container px-4 sm:px-8 max-w-4xl mx-auto text-center relative z-10">
          <h2 className="font-serif text-4xl font-bold mb-6">The Unity Wall</h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Truth wears many garments. Discover the common threads that weave through the world's great wisdom traditions.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left mb-12">
            {!isQuotesLoading && unityQuotes?.slice(0, 2).map((quote) => (
              <div key={quote.id} className="p-8 rounded-2xl bg-card border border-border relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r" style={{ backgroundColor: quote.accentColor }} />
                <p className="font-serif text-lg italic mb-6 leading-relaxed">"{quote.quote}"</p>
                <p className="text-sm font-medium text-muted-foreground">— {quote.attribution}, <span className="text-foreground">{quote.traditionName}</span></p>
              </div>
            ))}
          </div>

          <Button asChild size="lg" className="rounded-full px-8 text-base bg-secondary text-secondary-foreground hover:bg-secondary/80 h-14">
            <Link href="/unity">View Full Wall</Link>
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 border-t border-border bg-card text-center">
        <p className="text-muted-foreground flex items-center justify-center gap-2">
          <Flame className="w-4 h-4 text-primary" /> NoorJyoti Library
        </p>
      </footer>
    </div>
  );
}