import { useState, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import {
  useGetChapter,
  useGetScripture,
  useListLanguages,
  useListVoices,
  useSynthesizeTrack,
  useUpsertMyHistory,
  useCreateMyBookmark,
  useListMyHistory,
  useGetMySynthQuota,
  getGetMySynthQuotaQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Play, Pause, ArrowLeft, BookmarkPlus, SkipBack, SkipForward, ChevronLeft, ChevronRight, LogIn, Gauge, RotateCcw, X, BookOpen, Clock, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/lib/auth";
import { useGetMyPreferences } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { enabledWhen } from "@/lib/queryEnabled";

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function TextPanel({ passageEn, summary }: { passageEn: string; summary: string }) {
  const wordCount = countWords(passageEn);
  const isShortVerse = passageEn.length < 600;
  const paragraphs = passageEn.split(/\n\n+/).filter(Boolean);

  if (isShortVerse) {
    return (
      <div className="flex flex-col h-full">
        <div className="mb-6">
          <h2 className="font-serif text-2xl font-bold mb-1">Sacred Text</h2>
          <p className="text-muted-foreground text-sm flex items-center gap-3">
            <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{wordCount} words</span>
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Math.max(1, Math.ceil(wordCount / 130))} min read</span>
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
            <blockquote className="font-serif text-xl md:text-2xl leading-relaxed text-foreground/95 italic">
              {paragraphs.map((p, i) => (
                <p key={i} className={i > 0 ? "mt-4" : ""}>{p}</p>
              ))}
            </blockquote>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>

          {summary && summary !== passageEn.slice(0, summary.length) && (
            <div className="rounded-xl bg-card border border-border p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Reflection
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[70vh] md:h-auto overflow-hidden">
      <div className="mb-4">
        <h2 className="font-serif text-2xl font-bold mb-1">Original Text</h2>
        <p className="text-muted-foreground text-sm flex items-center gap-3">
          <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{wordCount.toLocaleString()} words</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{Math.ceil(wordCount / 130)} min read</span>
          <span className="text-muted-foreground/50">Follow along as you listen</span>
        </p>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 prose prose-invert max-w-none font-serif text-lg leading-relaxed text-foreground/90 pb-12 hide-scrollbar">
        {paragraphs.map((p, i) => (
          <p key={i} className="mb-6">{p}</p>
        ))}
      </div>
    </div>
  );
}

export default function Listen() {
  const [, params] = useRoute("/listen/:chapterId");
  const [, navigate] = useLocation();
  const chapterId = Number(params?.chapterId);
  const { toast } = useToast();
  const { isSignedIn } = useAuthState();
  const { data: prefs } = useGetMyPreferences({
    query: enabledWhen(!!isSignedIn),
  });

  const { data: chapter, isLoading: isChapterLoading } = useGetChapter(chapterId);
  const { data: scripture } = useGetScripture(chapter?.scriptureId ?? 0);
  const { data: languages } = useListLanguages();
  const { data: voices } = useListVoices();
  
  const [language, setLanguage] = useState("en");
  const [voice, setVoice] = useState("female_warm");
  const [prefsApplied, setPrefsApplied] = useState(false);
  useEffect(() => {
    if (prefsApplied || !prefs) return;
    if (prefs.defaultLanguage) setLanguage(prefs.defaultLanguage);
    if (prefs.defaultVoice) setVoice(prefs.defaultVoice);
    setPrefsApplied(true);
  }, [prefs, prefsApplied]);
  const [speed, setSpeed] = useState<number>(1);
  
  const synthesize = useSynthesizeTrack();
  const upsertHistory = useUpsertMyHistory();
  const createBookmark = useCreateMyBookmark();
  const { data: history, isLoading: isHistoryLoading } = useListMyHistory({
    query: enabledWhen(!!isSignedIn),
  });
  const historyReady = !isSignedIn || !isHistoryLoading;

  const savedEntry = history?.find((h) => h.chapterId === chapterId);
  const savedPosition =
    savedEntry && !savedEntry.completed && savedEntry.positionSeconds > 5
      ? savedEntry.positionSeconds
      : 0;

  const qc = useQueryClient();
  const { data: quota } = useGetMySynthQuota({
    query: enabledWhen(!!isSignedIn),
  });


  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resumeOffered, setResumeOffered] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const lastHistorySecondRef = useRef<number>(-1);
  const pendingSeekRef = useRef<number | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (err) {
        console.warn("[listen] failed to pause stale audio", err);
      }
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setAudioUrl(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setResumeOffered(false);
    setResumeDismissed(false);
    lastHistorySecondRef.current = -1;
    pendingSeekRef.current = null;
  }, [chapterId, language, voice]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.error(e);
          setIsPlaying(false);
        });
        progressIntervalRef.current = window.setInterval(() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime);
            const cur = Math.floor(audioRef.current.currentTime);
            if (
              isSignedIn &&
              cur > 0 &&
              cur % 10 === 0 &&
              cur !== lastHistorySecondRef.current
            ) {
              lastHistorySecondRef.current = cur;
              upsertHistory.mutate({ data: { chapterId, positionSeconds: audioRef.current.currentTime, completed: false } });
            }
          }
        }, 1000);
      } else {
        audioRef.current.pause();
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        const cur = audioRef.current.currentTime;
        const curSec = Math.floor(cur);
        if (isSignedIn && cur > 0 && curSec !== lastHistorySecondRef.current) {
          lastHistorySecondRef.current = curSec;
          upsertHistory.mutate({
            data: { chapterId, positionSeconds: cur, completed: false },
          });
        }
      }
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, chapterId]);

  useEffect(() => {
    return () => {
      const el = audioRef.current;
      if (!el || !isSignedIn) return;
      const cur = el.currentTime;
      const curSec = Math.floor(cur);
      if (cur > 0 && !el.ended && curSec !== lastHistorySecondRef.current) {
        upsertHistory.mutate({
          data: { chapterId, positionSeconds: cur, completed: false },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  const loadAudio = async (resumeFrom: number) => {
    try {
      const track = await synthesize.mutateAsync({
        data: { chapterId, language, voice }
      });
      pendingSeekRef.current = resumeFrom > 0 ? resumeFrom : null;
      setAudioUrl(import.meta.env.BASE_URL + track.audioUrl.replace(/^\//, ''));
      setProgress(resumeFrom);
      setIsPlaying(true);
      setResumeOffered(true);
      if (isSignedIn) {
        upsertHistory.mutate({ data: { chapterId, positionSeconds: resumeFrom, completed: false } });
        qc.invalidateQueries({ queryKey: getGetMySynthQuotaQueryKey() });
      }
    } catch (e) {
      if (isSignedIn) {
        qc.invalidateQueries({ queryKey: getGetMySynthQuotaQueryKey() });
      }
      toast({ title: "Failed to load audio", variant: "destructive" });
    }
  };

  const handlePlayPause = async () => {
    if (audioUrl) {
      setIsPlaying(!isPlaying);
      return;
    }
    await loadAudio(savedPosition);
  };

  const handleResumeFromStart = async () => {
    setResumeDismissed(true);
    if (audioUrl && audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      setIsPlaying(true);
      return;
    }
    await loadAudio(0);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setProgress(value[0]);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    if (isSignedIn) {
      upsertHistory.mutate({ data: { chapterId, positionSeconds: duration, completed: true } });
    }
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, audioUrl]);

  const orderedChapters = scripture?.chapters ?? [];
  const idx = orderedChapters.findIndex(c => c.id === chapterId);
  const prev = idx > 0 ? orderedChapters[idx - 1] : null;
  const next = idx >= 0 && idx < orderedChapters.length - 1 ? orderedChapters[idx + 1] : null;

  const handleBookmark = () => {
    createBookmark.mutate({ data: { chapterId, positionSeconds: progress } }, {
      onSuccess: () => toast({ title: "Bookmark saved" })
    });
  };

  if (isChapterLoading || !chapter) {
    return (
      <div
        className="container max-w-5xl mx-auto py-8 px-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Loading chapter…</span>
        <div className="h-9 w-40 mb-6 rounded-md bg-card/60 animate-pulse" />
        <div className="grid md:grid-cols-2 gap-12">
          <div className="flex flex-col items-center bg-card rounded-3xl p-8 border border-border">
            <div className="h-4 w-24 mb-4 rounded bg-background animate-pulse" />
            <div className="h-8 w-3/4 mb-2 rounded bg-background animate-pulse" />
            <div className="h-4 w-1/2 mb-12 rounded bg-background animate-pulse" />
            <div className="w-24 h-24 rounded-full bg-primary/20 animate-pulse mb-6" />
            <div className="w-full max-w-md h-2 mb-3 rounded-full bg-background animate-pulse" />
            <div className="flex gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-10 rounded bg-background animate-pulse" />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-card/60 animate-pulse" style={{ width: `${60 + ((i * 13) % 35)}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4 flex flex-col min-h-[calc(100vh-4rem)]">
      <Button asChild variant="ghost" className="self-start mb-6 text-muted-foreground">
        <Link href={`/scriptures/${chapter.scriptureId}`}><ArrowLeft className="w-4 h-4 mr-2" /> Back to Scripture</Link>
      </Button>

      <div className="grid md:grid-cols-2 gap-12 flex-1">
        {/* Player Side */}
        <div className="flex flex-col justify-center items-center bg-card rounded-3xl p-8 border border-border relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: chapter.accentColor }} />
          
          <div className="text-center mb-12">
            <div className="text-sm font-medium tracking-widest uppercase mb-4" style={{ color: chapter.accentColor }}>
              {chapter.traditionName}
            </div>
            <h1 className="font-serif text-3xl font-bold mb-2">{chapter.title}</h1>
            <p className="text-muted-foreground">{chapter.scriptureName}</p>
          </div>

          {synthesize.isPending ? (
            <div className="w-24 h-24 rounded-full bg-primary/20 animate-pulse flex items-center justify-center mb-12 shadow-[0_0_30px_rgba(251,191,36,0.3)]">
              <div className="w-16 h-16 rounded-full bg-primary/40 animate-pulse" />
            </div>
          ) : (
            <Button
              size="icon"
              disabled={!historyReady && !audioUrl}
              className="w-24 h-24 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 mb-6 transition-transform hover:scale-105 disabled:opacity-60"
              onClick={handlePlayPause}
              title={!historyReady && !audioUrl ? "Looking for your saved spot..." : undefined}
            >
              {isPlaying ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-2" />}
            </Button>
          )}

          {savedPosition > 0 && !resumeOffered && !resumeDismissed && !synthesize.isPending && (
            <div className="mb-6 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm">
              <RotateCcw className="w-4 h-4 text-primary" />
              <span className="text-foreground/90">
                Resume from <span className="font-mono font-medium">{formatTime(savedPosition)}</span>?
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-3 text-primary hover:text-primary"
                onClick={handlePlayPause}
              >
                Resume
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-muted-foreground"
                onClick={handleResumeFromStart}
                title="Start from beginning"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
          {(resumeOffered || resumeDismissed || savedPosition === 0) && <div className="mb-6" />}

          <div className="w-full max-w-md mb-8">
            <Slider 
              value={[progress]} 
              max={duration || 100} 
              step={1}
              onValueChange={handleSeek}
              className="mb-4 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration || chapter.estimatedReadSeconds)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-muted-foreground flex-wrap justify-center">
            <Button
              variant="ghost"
              size="icon"
              disabled={!prev}
              onClick={() => prev && navigate(`/listen/${prev.id}`)}
              title={prev ? `Previous: ${prev.title}` : "No previous chapter"}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleSeek([Math.max(0, progress - 15)])} title="Back 15s"><SkipBack className="w-5 h-5" /></Button>
            {isSignedIn && (
              <Button variant="ghost" size="icon" onClick={handleBookmark} title="Bookmark"><BookmarkPlus className="w-5 h-5" /></Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => handleSeek([Math.min(duration, progress + 15)])} title="Forward 15s"><SkipForward className="w-5 h-5" /></Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!next}
              onClick={() => next && navigate(`/listen/${next.id}`)}
              title={next ? `Next: ${next.title}` : "No next chapter"}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          <div
            className="flex items-center gap-2 mt-6 text-xs text-muted-foreground"
            role="radiogroup"
            aria-label="Playback speed"
          >
            <Gauge className="w-4 h-4" aria-hidden="true" />
            <span className="mr-1">Speed</span>
            {SPEED_OPTIONS.map(s => {
              const selected = speed === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${s} times speed`}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1 rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                    selected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/40"
                  }`}
                >
                  {s}x
                </button>
              );
            })}
          </div>

          <div className="w-full max-w-sm mt-12 pt-6 border-t border-border grid grid-cols-2 gap-4">
            <Select value={language} onValueChange={setLanguage} disabled={isPlaying || synthesize.isPending}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages?.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={voice} onValueChange={setVoice} disabled={isPlaying || synthesize.isPending}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Voice" />
              </SelectTrigger>
              <SelectContent>
                {voices?.map(v => <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isSignedIn && quota ? (
            <p
              className="mt-3 text-xs text-muted-foreground text-center max-w-sm"
              title="Already-generated tracks play instantly and don't count against this limit."
            >
              {quota.remainingDay > 0 ? (
                <>
                  <span className="font-medium text-foreground/80">
                    {quota.remainingDay}
                  </span>{" "}
                  of {quota.limitPerDay} new audio generations left today ·
                  saved tracks play free
                </>
              ) : (
                <>
                  Daily limit reached — saved tracks still play instantly.
                  Resets in ~{Math.max(1, Math.round(quota.resetDaySeconds / 3600))}h.
                </>
              )}
            </p>
          ) : !isSignedIn ? (
            <p className="mt-3 text-xs text-muted-foreground text-center max-w-sm">
              Tap play to listen instantly.{" "}
              <button
                type="button"
                onClick={() => navigate("/sign-in")}
                className="underline underline-offset-2 hover:text-foreground"
              >
                Sign in
              </button>{" "}
              to save bookmarks and track your progress.
            </p>
          ) : null}
        </div>

        {/* Text Side */}
        <TextPanel passageEn={chapter.passageEn} summary={chapter.summary} />
      </div>

      {/* Next chapter teaser */}
      {next && (
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Up next</p>
          <Link href={`/listen/${next.id}`}>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-all group cursor-pointer">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-mono text-sm font-bold shrink-0">
                {next.number}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif font-semibold group-hover:text-primary transition-colors truncate">{next.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{orderedChapters[idx + 1]?.summary ?? ""}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {audioUrl && (
        <audio 
          ref={audioRef} 
          src={audioUrl} 
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration);
            const target = pendingSeekRef.current;
            if (target !== null && target > 0 && target < e.currentTarget.duration) {
              try {
                e.currentTarget.currentTime = target;
                setProgress(target);
              } catch (err) {
                console.warn("[listen] failed to seek to saved position", err);
              }
            }
            pendingSeekRef.current = null;
          }}
          onEnded={handleEnded}
          className="hidden" 
        />
      )}
    </div>
  );
}
