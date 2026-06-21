import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import {
  CheckCircle2,
  XCircle,
  Circle,
  ExternalLink,
  Download,
  RotateCcw,
  PlayCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type FlowStatus = "untested" | "pass" | "fail";

interface FlowStep {
  id: string;
  label: string;
  hint?: string;
}

interface FlowSection {
  id: string;
  title: string;
  description: string;
  route: string;
  required: boolean;
  steps: FlowStep[];
}

const SECTIONS: FlowSection[] = [
  {
    id: "auth",
    title: "Authentication & session",
    description: "Login, MFA, session timeout, sign-out.",
    route: "/login",
    required: true,
    steps: [
      { id: "auth-1", label: "Sign-in screen renders with Continue with Google button (GCIP)" },
      { id: "auth-2", label: "Google sign-in completes and lands on patient dashboard" },
      { id: "auth-3", label: "GCIP step-up / re-auth prompt appears for sensitive actions", hint: "Test in incognito" },
      { id: "auth-4", label: "Sign-out clears session and redirects to landing" },
    ],
  },
  {
    id: "dashboard",
    title: "Patient dashboard",
    description: "Home view, AI summary, recent activity, sidebar navigation.",
    route: "/",
    required: true,
    steps: [
      { id: "dash-1", label: "Dashboard loads within 3 seconds" },
      { id: "dash-2", label: "AI Health Summary card renders or shows skeleton" },
      { id: "dash-3", label: "Sidebar collapses/expands" },
      { id: "dash-4", label: "Unified Summary panel opens from FAB" },
    ],
  },
  {
    id: "record",
    title: "Health record (PHR)",
    description: "Conditions, medications, allergies, immunizations, vitals, labs.",
    route: "/timeline",
    required: true,
    steps: [
      { id: "rec-1", label: "Timeline renders chronologically" },
      { id: "rec-2", label: "Filter chips narrow results" },
      { id: "rec-3", label: "Medications page lists current and past meds" },
      { id: "rec-4", label: "Allergies, immunizations, vitals each render" },
      { id: "rec-5", label: "Search returns relevant results" },
    ],
  },
  {
    id: "ehr",
    title: "EHR connection",
    description: "Connect a sandbox EHR via SMART on FHIR.",
    route: "/fasten-connect",
    required: true,
    steps: [
      { id: "ehr-1", label: "Connect Health Records page loads" },
      { id: "ehr-2", label: "Provider search returns sandbox results" },
      { id: "ehr-3", label: "OAuth handoff redirects to EHR sandbox" },
      { id: "ehr-4", label: "Callback returns and shows imported record count" },
    ],
  },
  {
    id: "ambient",
    title: "Ambient encounter notes",
    description: "Whisper transcription + GPT-4 SOAP + action items.",
    route: "/ambient-encounter",
    required: true,
    steps: [
      { id: "amb-1", label: "Mic permission prompt appears with friendly copy" },
      { id: "amb-2", label: "Recording timer counts up while speaking" },
      { id: "amb-3", label: "Stop produces a transcript within 30s" },
      { id: "amb-4", label: "SOAP note generates with S/O/A/P sections" },
      { id: "amb-5", label: "Action items list populates" },
      { id: "amb-6", label: "Audio is NOT downloadable — memory-only verified" },
    ],
  },
  {
    id: "care-gaps",
    title: "USPSTF care gap detection",
    description: "8-rule preventive screening evaluator.",
    route: "/care-gaps",
    required: true,
    steps: [
      { id: "gap-1", label: "Form accepts age, sex, smoking history, last screening dates" },
      { id: "gap-2", label: "Submit returns gap list with grade A/B labels" },
      { id: "gap-3", label: "Status badges (overdue / due-soon / up-to-date) render" },
      { id: "gap-4", label: "Reasoning text reads coherently" },
    ],
  },
  {
    id: "care-access",
    title: "Care Access section",
    description: "Index, find a doctor, eligibility, share, export, VA, AI help.",
    route: "/care",
    required: true,
    steps: [
      { id: "ca-1", label: "/care index shows 6-tile grid" },
      { id: "ca-2", label: "/care/find-a-doctor lists providers with filters" },
      { id: "ca-3", label: "/care/eligibility — income $32000, household 3, ZIP 60601 → returns Medicaid eligible" },
      { id: "ca-4", label: "/care/share-records — generate link → QR + Copy/WhatsApp/More buttons" },
      { id: "ca-5", label: "/care/export — care packet PDF generates" },
      { id: "ca-6", label: "/care/va — DD-214 file picker accepts PDF" },
      { id: "ca-7", label: "/care/ai-help — chat returns a response" },
    ],
  },
  {
    id: "i18n",
    title: "Internationalization & RTL",
    description: "Language switcher, RTL flip, clinical glossary safety.",
    route: "/settings",
    required: true,
    steps: [
      { id: "i18n-1", label: "Settings → Language card lists 22 languages" },
      { id: "i18n-2", label: "Switching to Arabic flips layout to RTL" },
      { id: "i18n-3", label: "Switching to Urdu / Hebrew / Pashto shows 'translation in progress' banner" },
      { id: "i18n-4", label: "Drug names remain in English under any locale (verify on Medications page)" },
      { id: "i18n-5", label: "Switching back to English restores LTR" },
    ],
  },
  {
    id: "savings",
    title: "Drug savings & insurance learning",
    description: "AI Savings Advisor, generics, PAP guide, learning modules.",
    route: "/drug-savings",
    required: false,
    steps: [
      { id: "sav-1", label: "Drug savings page lists manufacturer assistance programs" },
      { id: "sav-2", label: "Generic alternatives searchable" },
      { id: "sav-3", label: "/insurance-learning module advances through steps with quiz" },
    ],
  },
  {
    id: "legal-pages",
    title: "Legal pages",
    description:
      "All seven /legal/* routes resolve (200) and render a title. Content is " +
      "placeholder until Termly export is finalized; route presence is the " +
      "TestFlight requirement.",
    route: "/legal/privacy",
    required: true,
    steps: [
      { id: "legal-1", label: "/legal/privacy returns 200 with 'Privacy Policy' title and breadcrumb" },
      { id: "legal-2", label: "/legal/terms returns 200 with 'Terms of Service' title" },
      { id: "legal-3", label: "/legal/cookie returns 200 with 'Cookie Policy' title" },
      { id: "legal-4", label: "/legal/disclaimer returns 200 with 'Disclaimer' title" },
      { id: "legal-5", label: "/legal/accessibility returns 200 with 'Accessibility Statement' title" },
      { id: "legal-6", label: "/legal/hipaa-notice returns 200 with 'HIPAA Notice of Privacy Practices' title" },
      { id: "legal-7", label: "/legal/care-access-privacy returns 200 with 'Care Access Privacy Notice' title (last updated April 18, 2026)" },
      { id: "legal-8", label: "Footer baseline links ('Terms', 'Privacy Policy', 'Cookie Policy', 'HIPAA Notice' — 4 links; 5 on /care/* with 'Care Access Privacy') navigate to the matching /legal/* route (no 404)" },
    ],
  },
  {
    id: "uninsured",
    title: "Uninsured discount platform",
    description: "60-CPT pricing, FQHC search, Sesame Care, FindHelp.org.",
    route: "/uninsured-resources",
    required: false,
    steps: [
      { id: "un-1", label: "60-CPT Medicare rate table loads with category filters" },
      { id: "un-2", label: "FQHC search by ZIP returns providers" },
      { id: "un-3", label: "Sesame Care booking shows availability" },
      { id: "un-4", label: "FindHelp.org SDoH search returns community resources" },
    ],
  },
  {
    id: "share-export",
    title: "Sharing, export, family",
    description: "Care packets, family hub, caregiver portal.",
    route: "/care-packets",
    required: false,
    steps: [
      { id: "se-1", label: "Care packet PDF downloads and opens cleanly" },
      { id: "se-2", label: "/my-family lists added family members" },
      { id: "se-3", label: "/caregiver-portal renders for delegated care" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance & audit",
    description: "ClinicalDisclaimer present, audit log writing, consent.",
    route: "/",
    required: true,
    steps: [
      { id: "comp-1", label: "ClinicalDisclaimer visible on every clinical page (spot-check 5)" },
      { id: "comp-2", label: "PHI access shows in audit log (Settings → Privacy)" },
      { id: "comp-3", label: "Consent toggles persist after refresh" },
      { id: "comp-4", label: "Sign-out from one device does not affect others (session isolation)" },
    ],
  },
];

const STORAGE_KEY = "smoke-test-results-v1";
const RUN_KEY = "smoke-test-run-v1";

interface PersistedState {
  statuses: Record<string, FlowStatus>;
  notes: Record<string, string>;
  startedAt: string | null;
}

const initialState = (): PersistedState => ({
  statuses: {},
  notes: {},
  startedAt: null,
});

type RunMode = "idle" | "running" | "paused" | "done";

interface RunState {
  mode: RunMode;
  sectionIndex: number;
  runStartedAt: number | null;     // epoch ms
  sectionStartedAt: number | null; // epoch ms (resets per section, paused-aware)
  pausedAt: number | null;         // epoch ms when pause began
  accumulatedMs: number;           // total elapsed across pauses
  sectionAccumulatedMs: number;    // section elapsed across pauses
  sectionDurations: number[];      // ms per completed section
}

const initialRun = (): RunState => ({
  mode: "idle",
  sectionIndex: 0,
  runStartedAt: null,
  sectionStartedAt: null,
  pausedAt: null,
  accumulatedMs: 0,
  sectionAccumulatedMs: 0,
  sectionDurations: [],
});

function fmtMs(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AdminSmokeTestPage() {
  const [state, setState] = useState<PersistedState>(initialState);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [run, setRun] = useState<RunState>(initialRun);
  const [tick, setTick] = useState(0); // forces 1Hz re-render while running

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw));
      const rawRun = localStorage.getItem(RUN_KEY);
      if (rawRun) setRun(JSON.parse(rawRun));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch {}
  }, [run]);

  // 1Hz tick while actively running
  useEffect(() => {
    if (run.mode !== "running") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [run.mode]);

  const startRun = () => {
    const now = Date.now();
    setRun({
      mode: "running",
      sectionIndex: 0,
      runStartedAt: now,
      sectionStartedAt: now,
      pausedAt: null,
      accumulatedMs: 0,
      sectionAccumulatedMs: 0,
      sectionDurations: [],
    });
    setState((p) => ({ ...p, startedAt: p.startedAt ?? new Date().toISOString() }));
    requestAnimationFrame(() => {
      const el = document.getElementById("smoke-run-banner");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const pauseRun = () => {
    if (run.mode !== "running") return;
    const now = Date.now();
    const totalElapsed = run.accumulatedMs + (run.runStartedAt ? now - run.runStartedAt : 0);
    const sectionElapsed = run.sectionAccumulatedMs + (run.sectionStartedAt ? now - run.sectionStartedAt : 0);
    setRun({
      ...run,
      mode: "paused",
      pausedAt: now,
      accumulatedMs: totalElapsed,
      sectionAccumulatedMs: sectionElapsed,
      runStartedAt: null,
      sectionStartedAt: null,
    });
  };

  const resumeRun = () => {
    if (run.mode !== "paused") return;
    const now = Date.now();
    setRun({ ...run, mode: "running", runStartedAt: now, sectionStartedAt: now, pausedAt: null });
  };

  const advanceSection = () => {
    if (run.mode === "idle" || run.mode === "done") return;
    const now = Date.now();
    const sectionElapsed =
      run.sectionAccumulatedMs + (run.sectionStartedAt ? now - run.sectionStartedAt : 0);
    const nextDurations = [...run.sectionDurations, sectionElapsed];
    const nextIndex = run.sectionIndex + 1;
    if (nextIndex >= SECTIONS.length) {
      const totalElapsed =
        run.accumulatedMs + (run.runStartedAt ? now - run.runStartedAt : 0);
      setRun({
        ...run,
        mode: "done",
        sectionDurations: nextDurations,
        accumulatedMs: totalElapsed,
        runStartedAt: null,
        sectionStartedAt: null,
        sectionAccumulatedMs: 0,
      });
      return;
    }
    setRun({
      ...run,
      sectionIndex: nextIndex,
      sectionDurations: nextDurations,
      sectionStartedAt: run.mode === "running" ? now : null,
      sectionAccumulatedMs: 0,
    });
    requestAnimationFrame(() => {
      const el = document.getElementById(`section-card-${SECTIONS[nextIndex].id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const stopRun = () => {
    if (!confirm("Stop the current run? Step results are kept; timer is reset.")) return;
    setRun(initialRun());
  };

  const liveTotalMs = (() => {
    if (run.mode === "running" && run.runStartedAt) {
      return run.accumulatedMs + (Date.now() - run.runStartedAt);
    }
    return run.accumulatedMs;
  })();

  const liveSectionMs = (() => {
    if (run.mode === "running" && run.sectionStartedAt) {
      return run.sectionAccumulatedMs + (Date.now() - run.sectionStartedAt);
    }
    return run.sectionAccumulatedMs;
  })();

  // Suppress lint warning that `tick` is unused. It is used as a render trigger.
  void tick;

  const allSteps = useMemo(() => SECTIONS.flatMap((s) => s.steps), []);
  const totalCount = allSteps.length;
  const requiredSteps = useMemo(
    () => SECTIONS.filter((s) => s.required).flatMap((s) => s.steps),
    [],
  );

  const counts = useMemo(() => {
    const pass = allSteps.filter((s) => state.statuses[s.id] === "pass").length;
    const fail = allSteps.filter((s) => state.statuses[s.id] === "fail").length;
    const requiredPass = requiredSteps.filter(
      (s) => state.statuses[s.id] === "pass",
    ).length;
    const requiredFail = requiredSteps.filter(
      (s) => state.statuses[s.id] === "fail",
    ).length;
    return { pass, fail, requiredPass, requiredFail };
  }, [state.statuses, allSteps, requiredSteps]);

  const requiredReady =
    counts.requiredPass === requiredSteps.length && counts.requiredFail === 0;

  const setStatus = (stepId: string, status: FlowStatus) => {
    setState((prev) => ({
      ...prev,
      startedAt: prev.startedAt ?? new Date().toISOString(),
      statuses: { ...prev.statuses, [stepId]: status },
    }));
  };

  const setNote = (stepId: string, value: string) => {
    setState((prev) => ({
      ...prev,
      notes: { ...prev.notes, [stepId]: value },
    }));
  };

  const reset = () => {
    if (confirm("Clear all smoke-test results?")) {
      setState(initialState());
    }
  };

  const exportReport = () => {
    const lines: string[] = [];
    lines.push(`# Tabula Medica — Smoke Test Report`);
    lines.push(``);
    lines.push(`**Run started:** ${state.startedAt ?? "—"}`);
    lines.push(`**Run exported:** ${new Date().toISOString()}`);
    lines.push(
      `**Required flows:** ${counts.requiredPass}/${requiredSteps.length} pass, ${counts.requiredFail} fail`,
    );
    lines.push(
      `**All flows:** ${counts.pass}/${totalCount} pass, ${counts.fail} fail`,
    );
    lines.push(``);
    for (const section of SECTIONS) {
      lines.push(`## ${section.title}${section.required ? "" : " (optional)"}`);
      lines.push(`Route: \`${section.route}\``);
      lines.push(``);
      for (const step of section.steps) {
        const status = state.statuses[step.id] ?? "untested";
        const mark =
          status === "pass" ? "[x]" : status === "fail" ? "[FAIL]" : "[ ]";
        lines.push(`- ${mark} ${step.label}`);
        const note = state.notes[step.id];
        if (note) lines.push(`      Note: ${note}`);
      }
      lines.push(``);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smoke-test-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-6 text-start">
        <div className="flex items-center gap-3 mb-2">
          <PlayCircle className="h-7 w-7 text-teal-700 dark:text-teal-300" />
          <h1
            className="text-2xl md:text-3xl font-semibold tracking-tight"
            data-testid="text-smoke-title"
          >
            Smoke Test
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Walk every critical flow before each release. Use this for
          investor/grant demos and as the App Store reviewer test script.
        </p>
      </header>

      {run.mode === "idle" && (
        <Card className="mb-4 border-teal-200 bg-teal-50/50 dark:bg-teal-950/20">
          <CardContent className="p-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-start">
              <p className="font-medium">Run full smoke test</p>
              <p className="text-xs text-muted-foreground">
                Walk all {SECTIONS.length} sections in sequence. Estimated 15
                minutes. State persists if you reload.
              </p>
            </div>
            <Button onClick={startRun} data-testid="button-run-all">
              <PlayCircle className="me-2 h-4 w-4" />
              Run full smoke test (≈15 min)
            </Button>
          </CardContent>
        </Card>
      )}

      {(run.mode === "running" || run.mode === "paused") && (
        <Card
          id="smoke-run-banner"
          className="mb-4 border-teal-300 bg-teal-50 dark:bg-teal-950/30 sticky top-2 z-10"
        >
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-start min-w-0">
                <p className="text-xs uppercase text-muted-foreground tracking-wide">
                  Section {run.sectionIndex + 1} of {SECTIONS.length}
                  {run.mode === "paused" && " — paused"}
                </p>
                <p
                  className="text-base font-semibold truncate"
                  data-testid="text-run-current-section"
                >
                  {SECTIONS[run.sectionIndex]?.title ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">Section</p>
                  <p className="font-mono font-semibold" data-testid="text-run-section-time">
                    {fmtMs(liveSectionMs)}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p
                    className={cn(
                      "font-mono font-semibold",
                      liveTotalMs > 15 * 60 * 1000 && "text-amber-600 dark:text-amber-400",
                    )}
                    data-testid="text-run-total-time"
                  >
                    {fmtMs(liveTotalMs)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {run.mode === "running" ? (
                <Button size="sm" variant="outline" onClick={pauseRun} data-testid="button-run-pause">
                  Pause
                </Button>
              ) : (
                <Button size="sm" onClick={resumeRun} data-testid="button-run-resume">
                  Resume
                </Button>
              )}
              <Button
                size="sm"
                onClick={advanceSection}
                data-testid="button-run-next"
              >
                {run.sectionIndex + 1 >= SECTIONS.length
                  ? "Finish run"
                  : "Section done — next"}
                <ExternalLink className="ms-2 h-3 w-3" />
              </Button>
              <Link href={SECTIONS[run.sectionIndex]?.route ?? "/"}>
                <Button size="sm" variant="outline" data-testid="button-run-open-section">
                  Open section
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={stopRun} data-testid="button-run-stop">
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {run.mode === "done" && (
        <Card className="mb-4 border-green-300 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div className="text-start">
                <p className="font-semibold" data-testid="text-run-summary-title">
                  Smoke run complete
                </p>
                <p className="text-xs text-muted-foreground">
                  Total time: <span className="font-mono">{fmtMs(run.accumulatedMs)}</span>
                  {" · "}Pass rate: {counts.pass}/{totalCount}
                  {counts.fail > 0 && ` · ${counts.fail} fail`}
                </p>
              </div>
            </div>
            <div className="text-xs grid grid-cols-2 sm:grid-cols-3 gap-2">
              {SECTIONS.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded border bg-card px-2 py-1"
                  data-testid={`text-run-summary-section-${s.id}`}
                >
                  <span className="truncate">{i + 1}. {s.title}</span>
                  <span className="font-mono text-muted-foreground">
                    {fmtMs(run.sectionDurations[i] ?? 0)}
                  </span>
                </div>
              ))}
            </div>
            {counts.fail > 0 && (
              <div className="text-xs text-start">
                <p className="font-medium text-destructive mb-1">Failures:</p>
                <ul className="space-y-1">
                  {SECTIONS.flatMap((s) =>
                    s.steps
                      .filter((st) => state.statuses[st.id] === "fail")
                      .map((st) => (
                        <li key={st.id} className="text-muted-foreground">
                          • <span className="font-medium">{s.title}:</span> {st.label}
                          {state.notes[st.id] && (
                            <span className="block ms-3 italic">↳ {state.notes[st.id]}</span>
                          )}
                        </li>
                      )),
                  )}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={exportReport} data-testid="button-run-export">
                <Download className="me-2 h-4 w-4" />
                Export markdown report
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRun(initialRun())} data-testid="button-run-dismiss">
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-start">
            <div>
              <p className="text-xs text-muted-foreground">Required pass</p>
              <p
                className="text-2xl font-semibold"
                data-testid="stat-required-pass"
              >
                {counts.requiredPass}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {requiredSteps.length}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Required fail</p>
              <p
                className={cn(
                  "text-2xl font-semibold",
                  counts.requiredFail > 0 && "text-destructive",
                )}
                data-testid="stat-required-fail"
              >
                {counts.requiredFail}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">All pass</p>
              <p className="text-2xl font-semibold" data-testid="stat-all-pass">
                {counts.pass}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  / {totalCount}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Release readiness</p>
              <Badge
                variant={requiredReady ? "default" : "secondary"}
                className={cn(
                  "mt-1",
                  requiredReady &&
                    "bg-green-600 hover:bg-green-600 text-white",
                )}
                data-testid="badge-release-ready"
              >
                {requiredReady ? "READY" : "NOT READY"}
              </Badge>
            </div>
          </div>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportReport}
              data-testid="button-export-report"
            >
              <Download className="me-2 h-4 w-4" />
              Export report
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              data-testid="button-reset"
            >
              <RotateCcw className="me-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const sectionPass = section.steps.filter(
            (s) => state.statuses[s.id] === "pass",
          ).length;
          const sectionFail = section.steps.filter(
            (s) => state.statuses[s.id] === "fail",
          ).length;
          return (
            <Card key={section.id} data-testid={`section-${section.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="text-start min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {section.title}
                      {!section.required && (
                        <Badge variant="secondary" className="text-xs">
                          optional
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {section.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {sectionPass}/{section.steps.length}
                      {sectionFail > 0 && ` · ${sectionFail} fail`}
                    </span>
                    <Link href={section.route}>
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`button-open-${section.id}`}
                      >
                        Open
                        <ExternalLink className="ms-2 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="space-y-2">
                  {section.steps.map((step) => {
                    const status = state.statuses[step.id] ?? "untested";
                    return (
                      <li
                        key={step.id}
                        className="flex items-start gap-3 p-2 rounded-md border bg-card"
                        data-testid={`step-${step.id}`}
                      >
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => setStatus(step.id, "pass")}
                            className={cn(
                              "p-1 rounded hover-elevate",
                              status === "pass" &&
                                "bg-green-100 dark:bg-green-950/40",
                            )}
                            aria-label="Mark pass"
                            data-testid={`button-pass-${step.id}`}
                          >
                            <CheckCircle2
                              className={cn(
                                "h-5 w-5",
                                status === "pass"
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-muted-foreground",
                              )}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(step.id, "fail")}
                            className={cn(
                              "p-1 rounded hover-elevate",
                              status === "fail" &&
                                "bg-red-100 dark:bg-red-950/40",
                            )}
                            aria-label="Mark fail"
                            data-testid={`button-fail-${step.id}`}
                          >
                            <XCircle
                              className={cn(
                                "h-5 w-5",
                                status === "fail"
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                              )}
                            />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0 text-start">
                          <div className="flex items-center gap-2 flex-wrap">
                            {status === "untested" && (
                              <Circle className="h-3 w-3 text-muted-foreground" />
                            )}
                            <p className="text-sm">{step.label}</p>
                          </div>
                          {step.hint && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {step.hint}
                            </p>
                          )}
                          {(activeNote === step.id ||
                            state.notes[step.id]) && (
                            <textarea
                              className="mt-2 w-full text-xs rounded border bg-background p-2 resize-y"
                              rows={2}
                              placeholder="Note (failure detail, console error, screenshot link…)"
                              value={state.notes[step.id] ?? ""}
                              onChange={(e) => setNote(step.id, e.target.value)}
                              onFocus={() => setActiveNote(step.id)}
                              onBlur={() => setActiveNote(null)}
                              data-testid={`textarea-note-${step.id}`}
                            />
                          )}
                          {activeNote !== step.id &&
                            !state.notes[step.id] && (
                              <button
                                type="button"
                                onClick={() => setActiveNote(step.id)}
                                className="text-xs text-muted-foreground underline mt-1"
                                data-testid={`button-add-note-${step.id}`}
                              >
                                Add note
                              </button>
                            )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6">
        <ClinicalDisclaimer variant="card" />
      </div>
    </div>
  );
}
