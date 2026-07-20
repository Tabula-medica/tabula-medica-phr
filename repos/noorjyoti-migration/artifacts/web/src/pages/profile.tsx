import { useState } from "react";
import { Link } from "wouter";
import { 
  useListMyBookmarks, useDeleteMyBookmark,
  useListMyFavorites, useDeleteMyFavorite,
  useListMyHistory,
  useGetMyPreferences, useUpdateMyPreferences,
  useListLanguages, useListVoices,
  type PreferencesItem
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Play, BookOpen, Clock, Heart, Bookmark } from "lucide-react";

export default function Profile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const { data: bookmarks, isLoading: isBookmarksLoading } = useListMyBookmarks();
  const { data: favorites, isLoading: isFavoritesLoading } = useListMyFavorites();
  const { data: history, isLoading: isHistoryLoading } = useListMyHistory();
  const { data: prefs, isLoading: isPrefsLoading } = useGetMyPreferences();
  const { data: languages } = useListLanguages();
  const { data: voices } = useListVoices();
  
  const deleteBookmark = useDeleteMyBookmark();
  const deleteFavorite = useDeleteMyFavorite();
  const updatePrefs = useUpdateMyPreferences();

  const handleUpdatePrefs = (updates: Partial<PreferencesItem>) => {
    const next: PreferencesItem = {
      defaultLanguage: prefs?.defaultLanguage ?? "en",
      defaultVoice: prefs?.defaultVoice ?? "female_warm",
      ...updates,
    };
    updatePrefs.mutate({ data: next }, {
      onSuccess: () => {
        toast({ title: "Preferences updated" });
        qc.invalidateQueries({ queryKey: ["/api/me/preferences"] });
      }
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container px-4 sm:px-8 max-w-5xl mx-auto py-12 min-h-screen">
      <h1 className="font-serif text-4xl font-bold mb-8 text-foreground">Your Sanctuary</h1>
      
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid grid-cols-4 mb-8 bg-card border border-border">
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="history">
          <div className="space-y-4">
            {isHistoryLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl border border-border" />)
            ) : history?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
                <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Your listening history will appear here.</p>
              </div>
            ) : (
              history?.map(item => (
                <div key={`${item.chapterId}-${item.lastPlayedAt}`} className="p-6 rounded-xl bg-card border border-border flex items-center justify-between group">
                  <div className="flex-1 flex items-center gap-6">
                    <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: item.accentColor }} />
                    <div>
                      <h3 className="font-serif text-xl font-bold mb-1">{item.chapterTitle}</h3>
                      <p className="text-sm text-muted-foreground">{item.scriptureName} • {item.traditionName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-medium text-muted-foreground px-3 py-1 bg-background rounded-full border border-border hidden sm:block">
                      {item.completed ? "Completed" : `${formatTime(item.positionSeconds)}`}
                    </div>
                    <Button asChild size="icon" className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                      <Link href={`/listen/${item.chapterId}`}>
                        <Play className="w-4 h-4 ml-0.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="bookmarks">
          <div className="space-y-4">
            {isBookmarksLoading ? (
              [1, 2].map(i => <div key={i} className="h-32 bg-card animate-pulse rounded-xl border border-border" />)
            ) : bookmarks?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
                <Bookmark className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Bookmarks you save while listening will appear here.</p>
              </div>
            ) : (
              bookmarks?.map(item => (
                <div key={item.id} className="p-6 rounded-xl bg-card border border-border flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.accentColor }} />
                      <h3 className="font-serif text-xl font-bold">{item.chapterTitle}</h3>
                      <span className="text-sm font-medium text-primary ml-2">{formatTime(item.positionSeconds)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{item.scriptureName} • {item.traditionName}</p>
                    {item.note && (
                      <div className="p-4 bg-background rounded-lg border border-border italic text-muted-foreground">
                        "{item.note}"
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 sm:self-start">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/listen/${item.chapterId}`}>Resume</Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" 
                      onClick={() => {
                        deleteBookmark.mutate({ id: item.id }, {
                          onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/me/bookmarks"] })
                        });
                      }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="favorites">
          <div className="space-y-4">
            {isFavoritesLoading ? (
              [1, 2].map(i => <div key={i} className="h-24 bg-card animate-pulse rounded-xl border border-border" />)
            ) : favorites?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
                <Heart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Scriptures you favorite will appear here.</p>
              </div>
            ) : (
              favorites?.map(item => (
                <div key={item.scriptureId} className="p-6 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div className="flex-1 flex items-center gap-4">
                    <div className="p-2 rounded bg-background border border-border">
                      <BookOpen className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-serif text-xl font-bold mb-1">{item.scriptureName}</h3>
                      <p className="text-sm text-muted-foreground uppercase tracking-wider text-[10px]" style={{ color: item.accentColor }}>{item.traditionName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/scriptures/${item.scriptureId}`}>View</Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        deleteFavorite.mutate({ scriptureId: item.scriptureId }, {
                          onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/me/favorites"] })
                        });
                      }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="p-8 rounded-xl bg-card border border-border max-w-xl">
            <h3 className="font-serif text-2xl font-bold mb-6">Playback Preferences</h3>
            
            {isPrefsLoading ? (
              <div className="space-y-6">
                <div className="h-16 bg-background animate-pulse rounded-lg" />
                <div className="h-16 bg-background animate-pulse rounded-lg" />
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Language</label>
                  <Select 
                    value={prefs?.defaultLanguage || "en"} 
                    onValueChange={(val) => handleUpdatePrefs({ defaultLanguage: val })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages?.map(l => (
                        <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The language used when starting a new chapter.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">Default Voice</label>
                  <Select 
                    value={prefs?.defaultVoice || "female_warm"} 
                    onValueChange={(val) => handleUpdatePrefs({ defaultVoice: val })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {voices?.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">The narrator voice used for playback.</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}