import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Activity, AlertTriangle, Bot, CheckCircle2, DollarSign, FileWarning, Mic, Play, RefreshCw, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";

interface Kpi { key: string; name: string; value: number; unit: "days" | "pct" | "usd" | "count"; target: number; status: "good" | "warning" | "critical"; definition: string }
interface WorkItem { id: string; queue: string; title: string; amount?: number; priority: number; dueAt?: string; status: string; source: string; context?: Record<string, unknown> }
interface Denial { id: string; claimId: string; carc: string; rarc?: string; category: string; amount: number; rootCause: string; remediation: string; status: string; priorityScore: number; appealDeadline?: string }
interface Approval { id: string; agent: string; action: string; reason: string; status: string; payload: Record<string, unknown>; createdAt: string }
interface AgentInfo { name: string; description: string; tools: Array<{ name: string; requiresApproval: boolean }> }
interface AgentRun { agent: string; summary: string; approvalsRequested: number; steps: Array<{ tool: string; why: string; outcome: string }> }

// Minimal browser SpeechRecognition typing (not in lib.dom for all TS targets). Used only for
// short command phrases on this page; encounter audio goes through server-side GCP medical STT.
interface MinimalSpeechRecognition { lang: string; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; start(): void }
type SpeechRecognitionCtor = new () => MinimalSpeechRecognition;

function fmt(k: Kpi): string {
  if (k.unit === "usd") return `$${k.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (k.unit === "pct") return `${k.value}%`;
  return `${k.value} ${k.unit}`;
}
const statusColor: Record<Kpi["status"], string> = { good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200", warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200", critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" };

export default function RcmCommandCenter() {
  const { toast } = useToast();
  const [voice, setVoice] = useState("");
  const [voiceReply, setVoiceReply] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<AgentRun | null>(null);
  const [queue, setQueue] = useState<string>("");

  const kpis = useQuery<{ kpis: Kpi[]; agingByPayer: Array<{ payerName: string; total: number; count: number; buckets: Record<string, number> }>; denialTrends: { preventable: { count: number; amount: number }; byCategory: Record<string, { count: number; amount: number }> } }>({ queryKey: ["/api/rcm/analytics/kpis"] });
  const worklist = useQuery<{ items: WorkItem[]; summary: Record<string, { open: number; overdue: number; amount: number }> }>({ queryKey: ["/api/rcm/worklist", queue], queryFn: async () => (await apiRequest("GET", `/api/rcm/worklist${queue ? `?queue=${queue}` : ""}`)).json() });
  const denials = useQuery<{ denials: Denial[] }>({ queryKey: ["/api/rcm/denials"] });
  const approvals = useQuery<{ approvals: Approval[] }>({ queryKey: ["/api/rcm/approvals", "pending"], queryFn: async () => (await apiRequest("GET", "/api/rcm/approvals?status=pending")).json() });
  const agents = useQuery<{ agents: AgentInfo[] }>({ queryKey: ["/api/rcm/agents"] });

  const invalidateAll = () => ["/api/rcm/analytics/kpis", "/api/rcm/worklist", "/api/rcm/denials", "/api/rcm/approvals", "/api/rcm/claims"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  const seed = useMutation({ mutationFn: async () => (await apiRequest("POST", "/api/rcm/demo/seed")).json(), onSuccess: () => { invalidateAll(); toast({ title: "Demo data loaded", description: "Synthetic patients, claims, denials and ledger seeded for this tenant." }); } });
  const runAgent = useMutation({ mutationFn: async (name: string) => (await apiRequest("POST", `/api/rcm/agents/${name}/run`, { dryRun: false })).json() as Promise<{ result: AgentRun }>, onSuccess: (d) => { setLastRun(d.result); invalidateAll(); toast({ title: `${d.result.agent} finished`, description: d.result.summary }); } });
  const decide = useMutation({ mutationFn: async ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => (await apiRequest("POST", `/api/rcm/approvals/${id}`, { decision })).json(), onSuccess: () => { invalidateAll(); toast({ title: "Decision recorded" }); } });
  const voiceCmd = useMutation({ mutationFn: async (transcript: string) => (await apiRequest("POST", "/api/rcm/voice/command", { transcript })).json() as Promise<{ intent: { type: string; queue?: string }; speak: string }>, onSuccess: (d) => { setVoiceReply(d.speak); if (d.intent.type === "open-queue" && d.intent.queue) setQueue(d.intent.queue); if ("speechSynthesis" in window) { try { window.speechSynthesis.speak(new SpeechSynthesisUtterance(d.speak)); } catch { /* TTS optional */ } } } });
  const workItem = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => (await apiRequest("POST", `/api/rcm/worklist/${id}`, { status })).json(), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/rcm/worklist"] }) });

  const headline = useMemo(() => (kpis.data?.kpis ?? []).filter((k) => ["days_in_ar", "clean_claim_rate", "denial_rate", "net_collection_rate", "ar_over_90", "total_ar"].includes(k.key)), [kpis.data]);
  const queues = Object.entries(worklist.data?.summary ?? {});

  const startDictation = () => {
    const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not available", description: "Type the command instead; server-side GCP medical STT is used for encounter audio.", variant: "destructive" }); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setVoice(t); voiceCmd.mutate(t); };
    rec.start();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto" data-testid="rcm-command-center">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><DollarSign className="h-6 w-6" /> RCM Command Center</h1>
          <p className="text-sm text-muted-foreground">World EHR outpatient revenue cycle: eligibility → auth → charges → coding → scrub → claim → ERA → denials → patient A/R. Voice + agents, human approval on anything that moves money.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending} data-testid="button-seed-demo"><RefreshCw className="h-4 w-4 mr-1" /> Load demo data</Button>
          <Button size="sm" onClick={() => runAgent.mutate("rcm-orchestrator")} disabled={runAgent.isPending} data-testid="button-run-orchestrator"><Play className="h-4 w-4 mr-1" /> Run nightly cycle now</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-col md:flex-row gap-2 md:items-center">
          <Button variant="secondary" onClick={startDictation} data-testid="button-voice"><Mic className="h-4 w-4 mr-1" /> Speak</Button>
          <Input value={voice} onChange={(e) => setVoice(e.target.value)} placeholder='Try: "add 99214 with modifier 25, diagnosis E11 point 9" · "open the denials queue" · "what are our days in AR" · "run the denials agent"' onKeyDown={(e) => { if (e.key === "Enter" && voice.trim()) voiceCmd.mutate(voice); }} data-testid="input-voice" />
          <Button onClick={() => voice.trim() && voiceCmd.mutate(voice)} disabled={voiceCmd.isPending} data-testid="button-voice-send">Send</Button>
        </CardContent>
        {voiceReply && <CardContent className="pt-0 text-sm flex items-start gap-2"><Sparkles className="h-4 w-4 mt-0.5 text-primary" /><span data-testid="text-voice-reply">{voiceReply}</span></CardContent>}
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {headline.map((k) => (
          <Card key={k.key} data-testid={`kpi-${k.key}`}>
            <CardHeader className="pb-1"><CardDescription className="text-xs">{k.name}</CardDescription></CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{fmt(k)}</div>
              <div className="flex items-center justify-between mt-1"><span className="text-[11px] text-muted-foreground">target {k.unit === "pct" ? `${k.target}%` : k.unit === "usd" ? "—" : `${k.target} ${k.unit}`}</span><Badge className={statusColor[k.status]} variant="secondary">{k.status}</Badge></div>
            </CardContent>
          </Card>
        ))}
        {!headline.length && <Card className="col-span-full"><CardContent className="py-6 text-sm text-muted-foreground">No data yet. Load demo data or post charges, claims and remittances via /api/rcm.</CardContent></Card>}
      </div>

      <Tabs defaultValue="queues">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="queues"><Activity className="h-4 w-4 mr-1" /> Work queues</TabsTrigger>
          <TabsTrigger value="denials"><FileWarning className="h-4 w-4 mr-1" /> Denials</TabsTrigger>
          <TabsTrigger value="approvals"><ShieldCheck className="h-4 w-4 mr-1" /> Approvals {approvals.data?.approvals?.length ? <Badge className="ml-1" variant="destructive">{approvals.data.approvals.length}</Badge> : null}</TabsTrigger>
          <TabsTrigger value="agents"><Bot className="h-4 w-4 mr-1" /> Agents</TabsTrigger>
          <TabsTrigger value="payers"><Stethoscope className="h-4 w-4 mr-1" /> Payers & KPIs</TabsTrigger>
        </TabsList>

        <TabsContent value="queues" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={queue === "" ? "default" : "outline"} onClick={() => setQueue("")}>All</Button>
            {queues.map(([q, s]) => (
              <Button key={q} size="sm" variant={queue === q ? "default" : "outline"} onClick={() => setQueue(q)} data-testid={`button-queue-${q}`}>{q.replace(/-/g, " ")} <Badge variant="secondary" className="ml-1">{s.open}</Badge>{s.overdue ? <Badge variant="destructive" className="ml-1">{s.overdue} late</Badge> : null}</Button>
            ))}
          </div>
          <Card>
            <CardContent className="pt-4 divide-y">
              {(worklist.data?.items ?? []).map((w) => (
                <div key={w.id} className="py-2 flex flex-wrap items-center justify-between gap-2" data-testid={`workitem-${w.id}`}>
                  <div>
                    <div className="text-sm font-medium">{w.title}</div>
                    <div className="text-xs text-muted-foreground">{w.queue} · priority {w.priority} · {w.source}{w.dueAt ? ` · due ${new Date(w.dueAt).toLocaleDateString()}` : ""}{w.amount ? ` · $${w.amount.toFixed(2)}` : ""}</div>
                  </div>
                  <div className="flex gap-1">
                    {w.status !== "in-progress" && <Button size="sm" variant="outline" onClick={() => workItem.mutate({ id: w.id, status: "in-progress" })}>Start</Button>}
                    <Button size="sm" variant="outline" onClick={() => workItem.mutate({ id: w.id, status: "done" })}><CheckCircle2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {!worklist.data?.items?.length && <div className="py-6 text-sm text-muted-foreground">Queue is empty.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="denials">
          <Card>
            <CardHeader><CardTitle className="text-base">Denials by priority (dollars × remediability × deadline)</CardTitle>{kpis.data?.denialTrends && <CardDescription>Preventable at scrub: {kpis.data.denialTrends.preventable.count} denials / ${kpis.data.denialTrends.preventable.amount.toFixed(2)}</CardDescription>}</CardHeader>
            <CardContent className="divide-y">
              {(denials.data?.denials ?? []).map((d) => (
                <div key={d.id} className="py-2 flex flex-wrap justify-between gap-2" data-testid={`denial-${d.id}`}>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">CARC {d.carc}{d.rarc ? ` / ${d.rarc}` : ""} · {d.category} · ${d.amount.toFixed(2)} <Badge variant="outline">{d.status}</Badge></div>
                    <div className="text-xs text-muted-foreground">{d.rootCause} → {d.remediation}{d.appealDeadline ? ` · appeal by ${d.appealDeadline}` : ""}</div>
                  </div>
                  <Badge variant="secondary">P{d.priorityScore}</Badge>
                </div>
              ))}
              {!denials.data?.denials?.length && <div className="py-6 text-sm text-muted-foreground">No denials on file.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader><CardTitle className="text-base">Agent actions waiting for a human</CardTitle><CardDescription>Claim submissions, appeals, corrected claims, write-offs, refunds and agency referrals never execute without approval.</CardDescription></CardHeader>
            <CardContent className="divide-y">
              {(approvals.data?.approvals ?? []).map((a) => (
                <div key={a.id} className="py-2 flex flex-wrap justify-between gap-2" data-testid={`approval-${a.id}`}>
                  <div>
                    <div className="text-sm font-medium">{a.agent} → {a.action}{typeof a.payload.amount === "number" ? ` · $${(a.payload.amount as number).toFixed(2)}` : ""}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => decide.mutate({ id: a.id, decision: "approved" })} data-testid={`button-approve-${a.id}`}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ id: a.id, decision: "rejected" })}>Reject</Button>
                  </div>
                </div>
              ))}
              {!approvals.data?.approvals?.length && <div className="py-6 text-sm text-muted-foreground">Nothing pending.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {(agents.data?.agents ?? []).map((a) => (
              <Card key={a.name} data-testid={`agent-${a.name}`}>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center justify-between">{a.name}<Button size="sm" onClick={() => runAgent.mutate(a.name)} disabled={runAgent.isPending}><Play className="h-4 w-4 mr-1" /> Run</Button></CardTitle><CardDescription>{a.description}</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-1">{a.tools.map((t) => <Badge key={t.name} variant={t.requiresApproval ? "destructive" : "secondary"}>{t.name}{t.requiresApproval ? " · approval" : ""}</Badge>)}</CardContent>
              </Card>
            ))}
          </div>
          {lastRun && (
            <Card>
              <CardHeader><CardTitle className="text-base">Last run: {lastRun.agent}</CardTitle><CardDescription>{lastRun.summary}</CardDescription></CardHeader>
              <CardContent className="text-xs space-y-1">{lastRun.steps.map((s, i) => <div key={i} className="flex gap-2"><Badge variant={s.outcome === "ok" ? "secondary" : s.outcome === "needs-approval" ? "destructive" : "outline"}>{s.outcome}</Badge><span className="font-mono">{s.tool}</span><span className="text-muted-foreground">{s.why}</span></div>)}</CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="payers" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Open A/R by payer</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Payer</th><th>Claims</th><th>0-30</th><th>31-60</th><th>61-90</th><th>90+</th><th>Total</th></tr></thead>
                <tbody>{(kpis.data?.agingByPayer ?? []).map((r) => <tr key={r.payerName} className="border-t"><td className="py-1">{r.payerName}</td><td>{r.count}</td><td>${r.buckets.current}</td><td>${r.buckets.d31_60}</td><td>${r.buckets.d61_90}</td><td className={r.buckets.over90 ? "text-red-600" : ""}>${r.buckets.over90}</td><td className="font-medium">${r.total}</td></tr>)}</tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">All KPIs</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-2">
              {(kpis.data?.kpis ?? []).map((k) => <div key={k.key} className="flex items-center justify-between border rounded px-3 py-2"><div><div className="text-sm font-medium">{k.name}</div><div className="text-xs text-muted-foreground">{k.definition}</div></div><div className="text-right"><div className="font-semibold">{fmt(k)}</div><Badge className={statusColor[k.status]} variant="secondary">{k.status === "good" ? "on target" : k.status}</Badge></div></div>)}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Vendors (eligibility, clearinghouse) run in stub mode until credentials and BAAs are configured; AI polish is off unless RCM_AI_ENABLED=true (Vertex only).</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
