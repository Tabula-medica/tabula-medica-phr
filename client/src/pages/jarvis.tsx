import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VoiceInput } from "@/components/voice-input";
import { useLanguage } from "@/components/language-provider";
import { useAuth } from "@/hooks/use-auth";
import { JARVIS_SKILLS, greetingKey, routeCommand, type JarvisSkillId } from "@/lib/jarvis-intents";
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Bot,
  CalendarClock,
  ClipboardCheck,
  FileText,
  FolderOpen,
  HeartPulse,
  Languages,
  Loader2,
  MapPin,
  Mic,
  PiggyBank,
  Pill,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface Reminder {
  id: string;
  type?: string;
  priority?: "low" | "medium" | "high";
  title?: string;
  description?: string;
  actionUrl?: string;
}

const SKILL_ICONS: Record<JarvisSkillId, LucideIcon> = {
  symptoms: Stethoscope,
  interactions: Pill,
  drugSavings: PiggyBank,
  visitSummary: ClipboardCheck,
  scribe: Mic,
  evidence: BookOpen,
  priorAuth: FileText,
  careGaps: Activity,
  screening: CalendarClock,
  translate: Languages,
  freeCare: MapPin,
  timeline: HeartPulse,
  documents: FolderOpen,
};

const SUGGESTION_KEYS = [
  "jarvis.suggest.1",
  "jarvis.suggest.2",
  "jarvis.suggest.3",
  "jarvis.suggest.4",
] as const;

// Reads the health-assistant SSE stream. Buffers partial lines so a JSON
// payload split across network chunks is not dropped.
async function streamChat(message: string, onDelta: (full: string) => void, signal: AbortSignal): Promise<string> {
  const res = await fetch("/api/health-assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`chat ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
        if (parsed.content) {
          full += parsed.content;
          onDelta(full);
        }
      } catch {
        // Non-JSON keep-alive lines are ignored.
      }
    }
  }
  return full;
}

export default function Jarvis() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [command, setCommand] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [routingTo, setRoutingTo] = useState<JarvisSkillId | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "";
  const greeting = t(greetingKey(new Date().getHours()));

  const { data: summaryData, isLoading: summaryLoading, isError: summaryError } = useQuery<{ summary: string }>({
    queryKey: ["/api/health-assistant/summary"],
    staleTime: 5 * 60_000,
  });
  const { data: remindersData, isLoading: remindersLoading } = useQuery<{ reminders: Reminder[] }>({
    queryKey: ["/api/health-assistant/reminders"],
    staleTime: 5 * 60_000,
  });
  const reminders = (remindersData?.reminders ?? []).slice(0, 5);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  const ask = async (question: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setStreaming("");
    try {
      const answer = await streamChat(question, setStreaming, controller.signal);
      setMessages((prev) => [...prev, { role: "assistant", content: answer || t("jarvis.chat.empty") }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(t("jarvis.chat.error"));
    } finally {
      setStreaming(null);
    }
  };

  const submit = (raw?: string) => {
    const text = (raw ?? command).trim();
    if (!text || streaming !== null) return;
    setCommand("");
    const intent = routeCommand(text);
    if (intent.kind === "navigate") {
      setRoutingTo(intent.skill.id);
      setLocation(intent.skill.route);
      return;
    }
    if (intent.kind === "ask") void ask(intent.question);
  };

  const busy = streaming !== null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6" data-testid="page-jarvis">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-semibold" data-testid="text-jarvis-greeting">
            {firstName ? `${greeting}, ${firstName}` : greeting}
          </h1>
        </div>
        <p className="text-muted-foreground">{t("jarvis.subtitle")}</p>
      </header>

      <Card className="border-primary/30">
        <CardContent className="space-y-3 pt-6">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <label htmlFor="jarvis-command" className="sr-only">
              {t("jarvis.command.label")}
            </label>
            <Input
              id="jarvis-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={t("jarvis.command.placeholder")}
              autoComplete="off"
              maxLength={2000}
              disabled={busy}
              data-testid="input-jarvis-command"
            />
            <VoiceInput onResult={(text) => setCommand(text)} label={t("jarvis.command.voice")} disabled={busy} />
            <Button type="submit" disabled={busy || !command.trim()} aria-label={t("jarvis.command.send")} data-testid="button-jarvis-send">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {SUGGESTION_KEYS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => submit(t(key))}
                data-testid={`button-jarvis-${key.split(".").pop()}`}
              >
                {t(key)}
              </Button>
            ))}
          </div>
          {routingTo && (
            <p className="text-sm text-muted-foreground" role="status">
              {t("jarvis.command.opening")} {t(`jarvis.skill.${routingTo}.title`)}
            </p>
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {t("jarvis.privacy")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bot className="h-5 w-5" aria-hidden="true" />
              {t("jarvis.chat.title")}
            </CardTitle>
            <CardDescription>{t("jarvis.chat.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-3" aria-live="polite">
                {messages.length === 0 && streaming === null && (
                  <p className="text-sm text-muted-foreground">{t("jarvis.chat.placeholder")}</p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                        : "max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm"
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {streaming !== null && (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm">
                    {streaming || <Loader2 className="h-4 w-4 animate-spin" aria-label={t("jarvis.chat.thinking")} />}
                  </div>
                )}
                {error && (
                  <p className="flex items-center gap-2 text-sm text-destructive" role="alert">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    {error}
                  </p>
                )}
                <div ref={endRef} />
              </div>
            </ScrollArea>
            <p className="mt-3 text-xs text-muted-foreground">{t("jarvis.disclaimer")}</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <HeartPulse className="h-5 w-5" aria-hidden="true" />
                {t("jarvis.briefing.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {summaryLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-label={t("jarvis.chat.thinking")} />
              ) : summaryError || !summaryData?.summary ? (
                <p className="text-muted-foreground">{t("jarvis.briefing.empty")}</p>
              ) : (
                <p className="line-clamp-[10] whitespace-pre-wrap">{summaryData.summary}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" aria-hidden="true" />
                {t("jarvis.reminders.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {remindersLoading && <Loader2 className="h-4 w-4 animate-spin" aria-label={t("jarvis.chat.thinking")} />}
              {!remindersLoading && reminders.length === 0 && (
                <p className="text-muted-foreground">{t("jarvis.reminders.empty")}</p>
              )}
              {reminders.map((r) => (
                <div key={r.id} className="rounded-md border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.title}</span>
                    {r.priority === "high" && <Badge variant="destructive">{t("jarvis.reminders.high")}</Badge>}
                  </div>
                  {r.description && <p className="mt-1 text-muted-foreground">{r.description}</p>}
                  {r.actionUrl?.startsWith("/") && (
                    <Button variant="ghost" size="sm" className="h-auto px-0 text-primary underline-offset-4 hover:underline" onClick={() => setLocation(r.actionUrl!)}>
                      {t("jarvis.open")}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <section aria-labelledby="jarvis-skills-heading" className="space-y-3">
        <h2 id="jarvis-skills-heading" className="text-lg font-semibold">
          {t("jarvis.skills.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JARVIS_SKILLS.map((skill) => {
            const Icon = SKILL_ICONS[skill.id];
            return (
              <button
                key={skill.id}
                type="button"
                onClick={() => setLocation(skill.route)}
                className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid={`button-jarvis-skill-${skill.id}`}
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium">{t(`jarvis.skill.${skill.id}.title`)}</span>
                  <span className="block text-xs text-muted-foreground">{t(`jarvis.skill.${skill.id}.desc`)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
