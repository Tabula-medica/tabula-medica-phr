import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuthState, friendlyAuthError } from "@/lib/auth";
import {
  useListScriptures,
  useGetScripture,
  useListLanguages,
  useListVoices,
} from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AdminPortal() {
  const { isSignedIn, isLoaded } = useAuthState();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground font-sans">
      {!isLoaded ? null : !isSignedIn ? <AdminSignIn /> : <AdminGate />}
    </div>
  );
}

function AdminSignIn() {
  const { signIn } = useAuthState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Enter your email and password."); return; }
    setError(null); setBusy(true);
    try {
      await signIn(email, password); // AdminGate re-verifies admin server-side
    } catch (err: any) {
      setError(friendlyAuthError(err?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <p className="text-primary text-xs font-semibold uppercase tracking-[0.3em]">
          NoorJyoti
        </p>
        <h1 className="mt-3 font-serif text-3xl font-bold">Admin Portal</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Restricted access for authorized administrators.
        </p>
      </div>
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
        {error && <p className="text-sm text-destructive text-center">{error}</p>}
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Email
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy}
            className="rounded-lg bg-input border border-border px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className="rounded-lg bg-input border border-border px-3 py-2 text-foreground focus:border-primary focus:ring-1 focus:ring-primary" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg py-2.5 font-semibold bg-primary text-primary-foreground disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <a href={basePath || "/"} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
        ← Back to NoorJyoti
      </a>
    </div>
  );
}

type GateState = "loading" | "admin" | "denied" | "error";

function AdminGate() {
  const { signOut } = useAuthState();
  const [state, setState] = useState<GateState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/admin", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { isAdmin?: boolean }) => {
        if (!cancelled) setState(d.isAdmin ? "admin" : "denied");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  if (state === "admin") {
    return <AdminPanel onSignOut={() => signOut()} />;
  }

  const title = state === "error" ? "Something went wrong" : "Access denied";
  const message =
    state === "error"
      ? "We couldn't verify your access. Please try again."
      : "Your account isn't authorized to use the admin portal.";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h1 className="font-serif text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-2 max-w-sm text-sm">{message}</p>
      </div>
      <button
        onClick={() => signOut()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

type Tab = "audio" | "content" | "users";

function AdminPanel({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("audio");

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-4xl flex-col px-6 py-10">
      <header className="flex items-center justify-between border-b border-border pb-6 mb-8">
        <div>
          <p className="text-primary text-xs font-semibold uppercase tracking-[0.3em]">NoorJyoti</p>
          <h1 className="mt-1 font-serif text-2xl font-bold">Admin Portal</h1>
        </div>
        <button
          onClick={onSignOut}
          className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-4 py-2 text-sm transition-colors"
        >
          Sign out
        </button>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 bg-card rounded-xl p-1 border border-border w-fit">
        {(["audio", "content", "users"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "audio" ? "🎵 Audio" : t === "content" ? "📖 Content" : "👥 Users"}
          </button>
        ))}
      </div>

      {tab === "audio" && <AudioTab />}
      {tab === "content" && <ContentTab />}
      {tab === "users" && <UsersTab />}
    </div>
  );
}

// ─── Audio Tab ────────────────────────────────────────────────────────────────

type ReplaceResult = { type: "success" | "error"; message: string } | null;

function AudioTab() {
  const { data: scriptures } = useListScriptures();
  const { data: languages } = useListLanguages();
  const { data: voices } = useListVoices();

  const [scriptureId, setScriptureId] = useState<number | null>(null);
  const [chapterId, setChapterId] = useState<number | null>(null);
  const [language, setLanguage] = useState("");
  const [voice, setVoice] = useState("");
  const [duration, setDuration] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ReplaceResult>(null);

  const { data: scriptureDetail } = useGetScripture(scriptureId ?? 0, {
    query: {
      queryKey: ["/api/scriptures", scriptureId],
      enabled: scriptureId != null,
    },
  });

  const chapters = useMemo(
    () => scriptureDetail?.chapters ?? [],
    [scriptureDetail],
  );

  const canSubmit =
    chapterId != null && !!language && !!voice && !!file && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || chapterId == null || !file) return;
    setResult(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("chapterId", String(chapterId));
      form.append("language", language);
      form.append("voice", voice);
      form.append("audio", file);
      if (duration.trim()) form.append("durationSeconds", duration.trim());

      const res = await fetch("/api/tracks/admin/replace", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        let detail = `Request failed (${res.status}).`;
        try {
          const body = await res.json();
          if (body?.error) detail = String(body.error);
        } catch { /* keep default */ }
        setResult({ type: "error", message: detail });
        return;
      }
      setResult({ type: "success", message: "Audio track replaced successfully." });
      setFile(null);
      setDuration("");
    } catch {
      setResult({ type: "error", message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h2 className="font-serif text-lg font-semibold mb-1">Replace chapter audio</h2>
      <p className="text-muted-foreground mb-6 text-sm">
        Upload a new audio file to replace the AI-generated track for a specific chapter, language and voice.
      </p>
      <div className="space-y-5 max-w-2xl">
        <Field label="Scripture">
          <Select
            value={scriptureId == null ? "" : String(scriptureId)}
            onChange={(v) => { setScriptureId(v ? Number(v) : null); setChapterId(null); }}
          >
            <option value="">Select a scripture…</option>
            {(scriptures ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.traditionName} — {s.name}</option>
            ))}
          </Select>
        </Field>

        <Field label="Chapter">
          <Select
            value={chapterId == null ? "" : String(chapterId)}
            onChange={(v) => setChapterId(v ? Number(v) : null)}
            disabled={scriptureId == null}
          >
            <option value="">{scriptureId == null ? "Select a scripture first" : "Select a chapter…"}</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.number}. {c.title}</option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Language">
            <Select value={language} onChange={setLanguage}>
              <option value="">Select language…</option>
              {(languages ?? []).map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Voice">
            <Select value={voice} onChange={setVoice}>
              <option value="">Select voice…</option>
              {(voices ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Audio file">
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-muted-foreground file:bg-input file:text-foreground hover:file:bg-input/80 block w-full text-sm file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium"
          />
        </Field>

        <Field label="Duration (seconds, optional)">
          <input
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="e.g. 480"
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none"
          />
        </Field>

        {result && (
          <p className={result.type === "success" ? "text-sm text-green-500" : "text-destructive text-sm"}>
            {result.message}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-5 py-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Replacing…" : "Replace audio"}
        </button>
      </div>
    </section>
  );
}

// ─── Content Tab ──────────────────────────────────────────────────────────────

type AdminScripture = {
  id: number; name: string; originalName: string; description: string;
  era: string; traditionName: string;
};
type AdminChapter = {
  id: number; number: number; title: string; summary: string;
  passageEn: string; estimatedReadSeconds: number; sortOrder: number;
};

function ContentTab() {
  const [scriptures, setScriptures] = useState<AdminScripture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedScripture, setSelectedScripture] = useState<AdminScripture | null>(null);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [editingChapter, setEditingChapter] = useState<AdminChapter | null>(null);
  const [editingScripture, setEditingScripture] = useState<AdminScripture | null>(null);

  useEffect(() => {
    fetch("/api/admin/scriptures", { credentials: "include" })
      .then(r => r.json())
      .then(setScriptures)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadChapters = async (scripture: AdminScripture) => {
    setSelectedScripture(scripture);
    setChapters([]);
    setEditingChapter(null);
    setChaptersLoading(true);
    try {
      const r = await fetch(`/api/admin/scriptures/${scripture.id}/chapters`, { credentials: "include" });
      const data = await r.json();
      setChapters(data);
    } finally {
      setChaptersLoading(false);
    }
  };

  if (editingChapter) {
    return (
      <ChapterEditor
        chapter={editingChapter}
        onBack={() => setEditingChapter(null)}
        onSaved={(updated) => {
          setChapters(cs => cs.map(c => c.id === updated.id ? updated : c));
          setEditingChapter(null);
        }}
      />
    );
  }

  if (editingScripture) {
    return (
      <ScriptureEditor
        scripture={editingScripture}
        onBack={() => setEditingScripture(null)}
        onSaved={(updated) => {
          setScriptures(ss => ss.map(s => s.id === updated.id ? { ...s, ...updated } : s));
          if (selectedScripture?.id === updated.id) setSelectedScripture(s => s ? { ...s, ...updated } : s);
          setEditingScripture(null);
        }}
      />
    );
  }

  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading scriptures…</div>;
  }

  return (
    <div className="grid md:grid-cols-5 gap-6">
      {/* Scripture list */}
      <div className="md:col-span-2">
        <h2 className="font-serif text-lg font-semibold mb-4">Scriptures</h2>
        <div className="space-y-2">
          {scriptures.map(s => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                selectedScripture?.id === s.id
                  ? "border-primary/60 bg-primary/5"
                  : "border-border bg-card hover:border-primary/30"
              }`}
              onClick={() => loadChapters(s)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{s.name}</p>
                <p className="text-xs text-muted-foreground truncate">{s.traditionName}</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setEditingScripture(s); }}
                className="ml-2 text-xs text-muted-foreground hover:text-primary shrink-0 px-2 py-1 rounded border border-transparent hover:border-primary/30 transition-colors"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chapter list */}
      <div className="md:col-span-3">
        {!selectedScripture ? (
          <div className="text-muted-foreground text-sm mt-2">← Select a scripture to view its chapters</div>
        ) : chaptersLoading ? (
          <div className="text-muted-foreground text-sm">Loading chapters…</div>
        ) : (
          <>
            <h2 className="font-serif text-lg font-semibold mb-4">
              {selectedScripture.name}
              <span className="ml-2 text-base font-normal text-muted-foreground">({chapters.length} chapters)</span>
            </h2>
            <div className="space-y-2">
              {chapters.map(c => (
                <div key={c.id} className="flex items-start justify-between p-3 rounded-lg border border-border bg-card gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded shrink-0">
                        {c.number}
                      </span>
                      <p className="text-sm font-medium truncate">{c.title}</p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.passageEn.slice(0, 120)}{c.passageEn.length > 120 ? "…" : ""}</p>
                    <p className="text-xs text-muted-foreground/50 mt-1">{c.passageEn.length.toLocaleString()} chars · {Math.ceil(c.estimatedReadSeconds / 60)} min</p>
                  </div>
                  <button
                    onClick={() => setEditingChapter(c)}
                    className="text-xs text-muted-foreground hover:text-primary shrink-0 px-2 py-1 rounded border border-transparent hover:border-primary/30 transition-colors"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChapterEditor({ chapter, onBack, onSaved }: {
  chapter: AdminChapter;
  onBack: () => void;
  onSaved: (updated: AdminChapter) => void;
}) {
  const [title, setTitle] = useState(chapter.title);
  const [summary, setSummary] = useState(chapter.summary);
  const [passageEn, setPassageEn] = useState(chapter.passageEn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = passageEn.trim().split(/\s+/).filter(Boolean).length;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/chapters/${chapter.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, summary, passageEn }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const updated = await res.json();
      onSaved(updated);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm mb-6 flex items-center gap-1 transition-colors">
        ← Back to chapters
      </button>
      <h2 className="font-serif text-xl font-bold mb-6">Edit Chapter {chapter.number}</h2>

      <div className="space-y-5">
        <Field label="Title">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none"
          />
        </Field>

        <Field label="Summary (shown in chapter lists)">
          <textarea
            value={summary}
            onChange={e => setSummary(e.target.value)}
            rows={3}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none resize-y"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-foreground text-sm font-medium">Full passage text (English)</span>
            <span className="text-xs text-muted-foreground">{wordCount.toLocaleString()} words · {passageEn.length.toLocaleString()} chars</span>
          </div>
          <textarea
            value={passageEn}
            onChange={e => setPassageEn(e.target.value)}
            rows={16}
            className="bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none font-serif leading-relaxed resize-y"
            placeholder="Enter the full scripture text here…"
          />
          <p className="text-xs text-muted-foreground mt-1">Separate paragraphs with a blank line.</p>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !passageEn.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            onClick={onBack}
            className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-6 py-2.5 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function ScriptureEditor({ scripture, onBack, onSaved }: {
  scripture: AdminScripture;
  onBack: () => void;
  onSaved: (updated: AdminScripture) => void;
}) {
  const [name, setName] = useState(scripture.name);
  const [originalName, setOriginalName] = useState(scripture.originalName);
  const [description, setDescription] = useState(scripture.description);
  const [era, setEra] = useState(scripture.era);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/scriptures/${scripture.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, originalName, description, era }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Failed (${res.status})`);
        return;
      }
      const updated = await res.json();
      onSaved({ ...scripture, ...updated });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-muted-foreground hover:text-foreground text-sm mb-6 flex items-center gap-1 transition-colors">
        ← Back to content
      </button>
      <h2 className="font-serif text-xl font-bold mb-6">Edit Scripture</h2>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Name">
            <input value={name} onChange={e => setName(e.target.value)}
              className="bg-input border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none" />
          </Field>
          <Field label="Original name">
            <input value={originalName} onChange={e => setOriginalName(e.target.value)}
              className="bg-input border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none" />
          </Field>
        </div>
        <Field label="Era">
          <input value={era} onChange={e => setEra(e.target.value)}
            className="bg-input border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
            className="bg-input border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none resize-y" />
        </Field>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-2.5 text-sm font-medium transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button onClick={onBack}
            className="border-border text-muted-foreground hover:text-foreground rounded-lg border px-6 py-2.5 text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

type AdminUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string;
  createdAt: number;
  lastSignInAt: number | null;
  banned: boolean;
  twoFactorEnabled: boolean;
  isAdmin: boolean;
};

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadUsers = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("query", q);
      const r = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setError(body.error ?? "Failed to load users");
        return;
      }
      setUsers(await r.json());
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(query.trim() || undefined);
  };

  const handleBan = async (userId: string, ban: boolean) => {
    setActionLoading(userId);
    try {
      await fetch(`/api/admin/users/${userId}/${ban ? "ban" : "unban"}`, {
        method: "POST", credentials: "include",
      });
      setUsers(us => us.map(u => u.id === userId ? { ...u, banned: ban } : u));
    } finally {
      setActionLoading(null);
    }
  };

  const fmt = (ts: number | null) => {
    if (!ts) return "Never";
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div>
      <h2 className="font-serif text-lg font-semibold mb-2">User Management</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Users are managed via Clerk. To enable 2FA for the admin account, sign in at{" "}
        <a href="https://accounts.noorjyoti.com" target="_blank" rel="noopener noreferrer"
          className="text-primary underline underline-offset-2">
          your account settings
        </a>{" "}
        and enable authenticator-app 2FA.
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6 max-w-md">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 bg-input border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none"
        />
        <button type="submit"
          className="bg-card border border-border hover:border-primary/50 text-foreground rounded-lg px-4 py-2 text-sm transition-colors">
          Search
        </button>
      </form>

      {error && <p className="text-destructive text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading users…</div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${u.banned ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}>
              {u.imageUrl ? (
                <img src={u.imageUrl} alt="" className="w-9 h-9 rounded-full bg-card shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {(u.firstName?.[0] ?? u.email[0] ?? "?").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">
                    {u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : u.email}
                  </p>
                  {u.isAdmin && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">Admin</span>
                  )}
                  {u.twoFactorEnabled && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-500/20 text-green-500">2FA</span>
                  )}
                  {u.banned && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/20 text-destructive">Banned</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                <p className="text-xs text-muted-foreground/60">
                  Joined {fmt(u.createdAt)} · Last sign in {fmt(u.lastSignInAt)}
                </p>
              </div>
              {!u.isAdmin && (
                <button
                  onClick={() => handleBan(u.id, !u.banned)}
                  disabled={actionLoading === u.id}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors shrink-0 ${
                    u.banned
                      ? "border-green-500/40 text-green-500 hover:bg-green-500/10"
                      : "border-destructive/40 text-destructive hover:bg-destructive/10"
                  } disabled:opacity-50`}
                >
                  {actionLoading === u.id ? "…" : u.banned ? "Unban" : "Ban"}
                </button>
              )}
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-muted-foreground text-sm">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-foreground mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value, onChange, disabled, children,
}: {
  value: string; onChange: (v: string) => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="bg-input border-border text-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </select>
  );
}
