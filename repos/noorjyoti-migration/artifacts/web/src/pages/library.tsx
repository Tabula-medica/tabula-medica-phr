import { Link } from "wouter";
import { useGetMyDashboard, useListTraditions } from "@workspace/api-client-react";
import { Book, Play, Clock, Bookmark, Heart, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Library() {
  const { data: dashboard, isLoading: isDashboardLoading } = useGetMyDashboard();
  const { data: traditions, isLoading: isTraditionsLoading } = useListTraditions();

  return (
    <div className="container px-4 sm:px-8 max-w-5xl mx-auto py-12">
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-bold mb-2 text-foreground">Your Library</h1>
        <p className="text-muted-foreground">Continue your journey of sacred listening.</p>
      </div>

      {isDashboardLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="h-48 rounded-2xl bg-card border border-border animate-pulse md:col-span-2" />
          <div className="h-48 rounded-2xl bg-card border border-border animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {/* Continue Listening Card */}
          <div className="md:col-span-2 p-8 rounded-2xl bg-card border border-border flex flex-col sm:flex-row gap-8 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 text-primary text-sm font-medium mb-4">
                <Play className="w-4 h-4" />
                Continue Listening
              </div>
              {dashboard?.suggestedNext ? (
                <>
                  <h2 className="font-serif text-3xl font-bold mb-2 text-foreground">
                    {dashboard.suggestedNext.title}
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    {dashboard.suggestedNext.scriptureName} • {dashboard.suggestedNext.traditionName}
                  </p>
                  <Button asChild className="mt-auto self-start bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6">
                    <Link href={`/listen/${dashboard.suggestedNext.id}`}>Resume</Link>
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-2xl font-bold mb-2 text-foreground">
                    Ready to begin?
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Explore the traditions below to start listening.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Stats Card */}
          <div className="p-8 rounded-2xl bg-card border border-border flex flex-col justify-center">
            <h3 className="font-serif text-xl font-semibold mb-6">Your Progress</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Play className="w-4 h-4" /> Started
                </span>
                <span className="font-medium text-foreground">{dashboard?.chaptersStarted || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Completed
                </span>
                <span className="font-medium text-foreground">{dashboard?.chaptersCompleted || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Favorites
                </span>
                <span className="font-medium text-foreground">{dashboard?.favoriteCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Continue Exploring Rail */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl font-bold">Continue Exploring</h2>
          <Link href="/all-teachings">
            <span className="text-sm text-primary hover:underline cursor-pointer flex items-center gap-1">
              All Teachings <ChevronRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
        
        {isTraditionsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-card border border-border animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {traditions?.map((tradition) => (
              <Link key={tradition.id} href={`/traditions/${tradition.slug}`}>
                <div className="p-5 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors flex items-center gap-4 cursor-pointer group">
                  <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: tradition.accentColor }} />
                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-semibold group-hover:text-primary transition-colors">{tradition.name}</h3>
                    <p className="text-sm text-muted-foreground">{tradition.scriptureCount} Scriptures</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}