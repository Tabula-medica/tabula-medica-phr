import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, Info, Cigarette, Wind, Wine, AlertTriangle } from "lucide-react";

interface HistoryBundle {
  conditions: any[];
  surgeries: any[];
  allergies: any[];
  socialHistory: any[];
  screenings: any[];
  vaccines: any[];
  painScale: any[];
}

const SDOH_DOMAINS = [
  "Housing Stability",
  "Food Security",
  "Transportation",
  "Utilities",
  "Personal Safety",
  "Financial Strain",
  "Employment",
  "Education",
  "Social Isolation",
];

const AUDIT_C_QUESTIONS: { question: string; options: { label: string; points: number }[] }[] = [
  {
    question: "How often do you have a drink containing alcohol?",
    options: [
      { label: "Never", points: 0 },
      { label: "Monthly or less", points: 1 },
      { label: "2-4 times a month", points: 2 },
      { label: "2-3 times a week", points: 3 },
      { label: "4 or more times a week", points: 4 },
    ],
  },
  {
    question: "How many standard drinks containing alcohol do you have on a typical day when drinking?",
    options: [
      { label: "1 or 2", points: 0 },
      { label: "3 or 4", points: 1 },
      { label: "5 or 6", points: 2 },
      { label: "7 to 9", points: 3 },
      { label: "10 or more", points: 4 },
    ],
  },
  {
    question: "How often do you have six or more drinks on one occasion?",
    options: [
      { label: "Never", points: 0 },
      { label: "Less than monthly", points: 1 },
      { label: "Monthly", points: 2 },
      { label: "Weekly", points: 3 },
      { label: "Daily or almost daily", points: 4 },
    ],
  },
];

const ORT_RISK_FACTORS = [
  "Family history of substance abuse (alcohol, illegal drugs, or prescription drugs)",
  "Personal history of substance abuse (alcohol, illegal drugs, or prescription drugs)",
  "Age 16–45",
  "History of preadolescent sexual abuse",
  "Psychological disease (ADD, OCD, bipolar disorder, schizophrenia, or depression)",
];

export default function ComprehensiveHistory() {
  const { patientId } = useParams<{ patientId: string }>();
  const { toast } = useToast();

  const { data: patient } = useQuery<{ id: string; fullName: string; dob: string }>({
    queryKey: ["/api/clinician/patients", patientId],
    queryFn: async () => (await apiRequest("GET", `/api/clinician/patients/${patientId}`)).json(),
    enabled: !!patientId,
  });

  const { data: bundle, isLoading } = useQuery<HistoryBundle>({
    queryKey: ["/api/clinician/patient-history", patientId],
    queryFn: async () => (await apiRequest("GET", `/api/clinician/patient-history/${patientId}`)).json(),
    enabled: !!patientId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/clinician/patient-history", patientId] });

  const post = useMutation({
    mutationFn: async ({ domain, body }: { domain: string; body: unknown }) => {
      const res = await apiRequest("POST", `/api/clinician/patient-history/${patientId}/${domain}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Saved" });
      invalidate();
    },
    onError: (e: any) => toast({ title: "Could not save", description: String(e?.message || e), variant: "destructive" }),
  });

  if (!patientId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>No patient selected</AlertTitle>
          <AlertDescription>Open this page from a patient's chart.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="icon" aria-label="Back to patient chart"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Comprehensive history</h1>
          <p className="text-sm text-muted-foreground">
            {patient ? `${patient.fullName} — DOB ${patient.dob}` : "Loading patient…"}
          </p>
        </div>
      </div>

      {isLoading || !bundle ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : (
        <Tabs defaultValue="conditions">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
            <TabsTrigger value="surgeries" data-testid="tab-surgeries">Surgical Hx</TabsTrigger>
            <TabsTrigger value="allergies" data-testid="tab-allergies">Allergies</TabsTrigger>
            <TabsTrigger value="social" data-testid="tab-social">Social / Habits</TabsTrigger>
            <TabsTrigger value="screenings" data-testid="tab-screenings">Screenings</TabsTrigger>
            <TabsTrigger value="pain" data-testid="tab-pain">Pain scale</TabsTrigger>
            <TabsTrigger value="preventive" data-testid="tab-preventive">Preventive / Vaccines</TabsTrigger>
          </TabsList>

          <TabsContent value="conditions" className="pt-4">
            <ListSection
              items={bundle.conditions}
              empty="No conditions recorded."
              render={(c) => (
                <>
                  <p className="font-medium">{c.condition}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status}{c.diagnosedDate ? ` · diagnosed ${c.diagnosedDate}` : ""}{c.treatedBy ? ` · ${c.treatedBy}` : ""}
                  </p>
                </>
              )}
              addLabel="Add condition"
              form={(close) => (
                <ConditionForm onSave={(body) => { post.mutate({ domain: "conditions", body }); close(); }} />
              )}
            />
          </TabsContent>

          <TabsContent value="surgeries" className="pt-4">
            <ListSection
              items={bundle.surgeries}
              empty="No surgical history recorded."
              render={(s) => (
                <>
                  <p className="font-medium">{s.procedureName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.surgeryDate ?? "Date unknown"}{s.surgeon ? ` · ${s.surgeon}` : ""}{s.facility ? ` · ${s.facility}` : ""}
                  </p>
                </>
              )}
              addLabel="Add surgery"
              form={(close) => (
                <SurgeryForm onSave={(body) => { post.mutate({ domain: "surgeries", body }); close(); }} />
              )}
            />
          </TabsContent>

          <TabsContent value="allergies" className="pt-4">
            <ListSection
              items={bundle.allergies}
              empty="No known allergies recorded."
              render={(a) => (
                <>
                  <p className="font-medium">{a.allergen}{a.severity ? <Badge variant="outline" className="ml-2 text-xs">{a.severity}</Badge> : null}</p>
                  <p className="text-xs text-muted-foreground">{a.reaction ?? "Reaction not specified"} · {a.status}</p>
                </>
              )}
              addLabel="Add allergy"
              form={(close) => (
                <AllergyForm onSave={(body) => { post.mutate({ domain: "allergies", body }); close(); }} />
              )}
            />
          </TabsContent>

          <TabsContent value="social" className="pt-4 space-y-4">
            <HabitRow
              icon={Cigarette}
              label="Tobacco use"
              rows={bundle.socialHistory.filter((s) => s.category === "Tobacco Use")}
              onSave={(status, description) => post.mutate({ domain: "social-history", body: { category: "Tobacco Use", status, description } })}
            />
            <HabitRow
              icon={Wind}
              label="Vaping / e-cigarette use"
              rows={bundle.socialHistory.filter((s) => s.category === "Vaping / E-cigarette Use")}
              onSave={(status, description) => post.mutate({ domain: "social-history", body: { category: "Vaping / E-cigarette Use", status, description } })}
            />
            <HabitRow
              icon={Wine}
              label="Alcohol use (status)"
              rows={bundle.socialHistory.filter((s) => s.category === "Alcohol Use")}
              onSave={(status, description) => post.mutate({ domain: "social-history", body: { category: "Alcohol Use", status, description } })}
            />

            <ListSection
              items={bundle.socialHistory.filter((s) => !["Tobacco Use", "Vaping / E-cigarette Use", "Alcohol Use"].includes(s.category))}
              empty="No other social history recorded."
              render={(s) => (
                <>
                  <p className="font-medium">{s.category}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </>
              )}
              addLabel="Add social history"
              form={(close) => (
                <SocialHistoryForm onSave={(body) => { post.mutate({ domain: "social-history", body }); close(); }} />
              )}
            />
          </TabsContent>

          <TabsContent value="screenings" className="pt-4 space-y-6">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Informational, not diagnostic</AlertTitle>
              <AlertDescription>
                These capture standardized screening responses for the chart. Scores shown are the arithmetic of the
                answers selected here — verify against your organization's current published instrument and
                thresholds before using a score clinically.
              </AlertDescription>
            </Alert>

            <AuditCPanel
              existing={bundle.screenings.filter((s) => s.domain === "Alcohol Use (AUDIT-C)")}
              onSave={(items) => post.mutate({ domain: "screenings", body: { items } })}
            />

            <OpioidRiskPanel
              existing={bundle.screenings.filter((s) => s.domain === "Opioid Risk Screening")}
              onSave={(items) => post.mutate({ domain: "screenings", body: { items } })}
            />

            <ListSection
              title="Social determinants of health"
              items={bundle.screenings.filter((s) => SDOH_DOMAINS.includes(s.domain))}
              empty="No SDOH screening recorded."
              render={(s) => (
                <>
                  <p className="font-medium">{s.domain}</p>
                  <p className="text-xs text-muted-foreground">{s.question ? `${s.question} — ` : ""}{s.response}</p>
                </>
              )}
              addLabel="Add SDOH response"
              form={(close) => (
                <SdohForm onSave={(body) => { post.mutate({ domain: "screenings", body }); close(); }} />
              )}
            />
          </TabsContent>

          <TabsContent value="pain" className="pt-4">
            <ListSection
              items={bundle.painScale}
              empty="No pain scores recorded."
              render={(p) => (
                <>
                  <p className="font-medium">{p.value} / 10</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.recordedAt).toLocaleString()}{p.notes ? ` · ${p.notes}` : ""}</p>
                </>
              )}
              addLabel="Record pain score"
              form={(close) => (
                <PainScaleForm
                  onSave={(body) => {
                    apiRequest("POST", `/api/clinician/patient-history/${patientId}/pain-scale`, body)
                      .then(() => { toast({ title: "Pain score recorded" }); invalidate(); })
                      .catch((e) => toast({ title: "Could not save", description: String(e?.message || e), variant: "destructive" }));
                    close();
                  }}
                />
              )}
            />
          </TabsContent>

          <TabsContent value="preventive" className="pt-4">
            <ListSection
              items={bundle.vaccines}
              empty="No immunizations recorded."
              render={(v) => (
                <>
                  <p className="font-medium">{v.vaccineName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.dateAdministered ?? "Date unknown"}{v.doseNumber ? ` · dose ${v.doseNumber}` : ""}{v.provider ? ` · ${v.provider}` : ""}
                  </p>
                </>
              )}
              addLabel="Add immunization"
              form={(close) => (
                <VaccineForm onSave={(body) => { post.mutate({ domain: "vaccines", body }); close(); }} />
              )}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─── Reusable list + add-dialog shell ────────────────────────────────────
function ListSection({
  title,
  items,
  empty,
  render,
  addLabel,
  form,
}: {
  title?: string;
  items: any[];
  empty: string;
  render: (item: any) => React.ReactNode;
  addLabel: string;
  form: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          {title && <CardTitle className="text-base">{title}</CardTitle>}
          <CardDescription>{items.length} entr{items.length === 1 ? "y" : "ies"}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />{addLabel}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader>
            {form(() => setOpen(false))}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{empty}</p>
        ) : (
          <div className="space-y-3 divide-y">
            {items.map((item) => (
              <div key={item.id} className="pt-3 first:pt-0">{render(item)}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Domain-specific forms ────────────────────────────────────────────────
function ConditionForm({ onSave }: { onSave: (body: any) => void }) {
  const [condition, setCondition] = useState("");
  const [status, setStatus] = useState("active");
  const [treatedBy, setTreatedBy] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label htmlFor="condition-name">Condition</Label><Input id="condition-name" value={condition} onChange={(e) => setCondition(e.target.value)} data-testid="input-condition-name" /></div>
      <div className="space-y-1">
        <Label htmlFor="condition-status">Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger id="condition-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["active", "chronic", "resolved", "inactive"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="condition-treated-by">Treated by (optional)</Label><Input id="condition-treated-by" value={treatedBy} onChange={(e) => setTreatedBy(e.target.value)} /></div>
      <DialogFooter><Button disabled={!condition.trim()} onClick={() => onSave({ condition, status, treatedBy: treatedBy || null })} data-testid="button-save-condition">Save</Button></DialogFooter>
    </div>
  );
}

function SurgeryForm({ onSave }: { onSave: (body: any) => void }) {
  const [procedureName, setProcedureName] = useState("");
  const [surgeryDate, setSurgeryDate] = useState("");
  const [surgeon, setSurgeon] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label htmlFor="surgery-name">Procedure</Label><Input id="surgery-name" value={procedureName} onChange={(e) => setProcedureName(e.target.value)} data-testid="input-surgery-name" /></div>
      <div className="space-y-1"><Label htmlFor="surgery-date">Date</Label><Input id="surgery-date" type="date" value={surgeryDate} onChange={(e) => setSurgeryDate(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="surgery-surgeon">Surgeon (optional)</Label><Input id="surgery-surgeon" value={surgeon} onChange={(e) => setSurgeon(e.target.value)} /></div>
      <DialogFooter><Button disabled={!procedureName.trim()} onClick={() => onSave({ procedureName, surgeryDate: surgeryDate || null, surgeon: surgeon || null })} data-testid="button-save-surgery">Save</Button></DialogFooter>
    </div>
  );
}

function AllergyForm({ onSave }: { onSave: (body: any) => void }) {
  const [allergen, setAllergen] = useState("");
  const [reaction, setReaction] = useState("");
  const [severity, setSeverity] = useState<string>("moderate");
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label htmlFor="allergy-allergen">Allergen</Label><Input id="allergy-allergen" value={allergen} onChange={(e) => setAllergen(e.target.value)} data-testid="input-allergen" /></div>
      <div className="space-y-1"><Label htmlFor="allergy-reaction">Reaction (optional)</Label><Input id="allergy-reaction" value={reaction} onChange={(e) => setReaction(e.target.value)} /></div>
      <div className="space-y-1">
        <Label htmlFor="allergy-severity">Severity</Label>
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger id="allergy-severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["mild", "moderate", "severe", "life_threatening"].map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter><Button disabled={!allergen.trim()} onClick={() => onSave({ allergen, reaction: reaction || null, severity })} data-testid="button-save-allergy">Save</Button></DialogFooter>
    </div>
  );
}

function SocialHistoryForm({ onSave }: { onSave: (body: any) => void }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label htmlFor="social-category">Category</Label><Input id="social-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Occupation, Living situation" /></div>
      <div className="space-y-1"><Label htmlFor="social-description">Details</Label><Textarea id="social-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
      <DialogFooter><Button disabled={!category.trim() || !description.trim()} onClick={() => onSave({ category, description })}>Save</Button></DialogFooter>
    </div>
  );
}

function SdohForm({ onSave }: { onSave: (body: any) => void }) {
  const [domain, setDomain] = useState(SDOH_DOMAINS[0]);
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="sdoh-domain">Domain</Label>
        <Select value={domain} onValueChange={setDomain}>
          <SelectTrigger id="sdoh-domain"><SelectValue /></SelectTrigger>
          <SelectContent>{SDOH_DOMAINS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="sdoh-question">Question asked (optional)</Label><Input id="sdoh-question" value={question} onChange={(e) => setQuestion(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="sdoh-response">Response</Label><Textarea id="sdoh-response" value={response} onChange={(e) => setResponse(e.target.value)} rows={2} /></div>
      <DialogFooter><Button disabled={!response.trim()} onClick={() => onSave({ domain, question: question || null, response })}>Save</Button></DialogFooter>
    </div>
  );
}

function VaccineForm({ onSave }: { onSave: (body: any) => void }) {
  const [vaccineName, setVaccineName] = useState("");
  const [dateAdministered, setDateAdministered] = useState("");
  const [provider, setProvider] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label htmlFor="vaccine-name">Vaccine</Label><Input id="vaccine-name" value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} data-testid="input-vaccine-name" /></div>
      <div className="space-y-1"><Label htmlFor="vaccine-date">Date administered</Label><Input id="vaccine-date" type="date" value={dateAdministered} onChange={(e) => setDateAdministered(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="vaccine-provider">Administered by (optional)</Label><Input id="vaccine-provider" value={provider} onChange={(e) => setProvider(e.target.value)} /></div>
      <DialogFooter><Button disabled={!vaccineName.trim()} onClick={() => onSave({ vaccineName, dateAdministered: dateAdministered || null, provider: provider || null })} data-testid="button-save-vaccine">Save</Button></DialogFooter>
    </div>
  );
}

function PainScaleForm({ onSave }: { onSave: (body: any) => void }) {
  const [value, setValue] = useState("0");
  const [notes, setNotes] = useState("");
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="pain-score">Pain score (0 = none, 10 = worst possible)</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger id="pain-score" data-testid="select-pain-score"><SelectValue /></SelectTrigger>
          <SelectContent>{Array.from({ length: 11 }, (_, i) => i).map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label htmlFor="pain-notes">Notes (optional)</Label><Textarea id="pain-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
      <DialogFooter><Button onClick={() => onSave({ value, notes: notes || null })} data-testid="button-save-pain-score">Save</Button></DialogFooter>
    </div>
  );
}

function HabitRow({
  icon: Icon,
  label,
  rows,
  onSave,
}: {
  icon: typeof Cigarette;
  label: string;
  rows: any[];
  onSave: (status: string, description: string) => void;
}) {
  const latest = rows[0];
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(latest?.status ?? "never");
  const [description, setDescription] = useState("");
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-3">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground">
            {latest ? `${latest.status}${latest.description ? ` — ${latest.description}` : ""}` : "Not documented"}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline">Update</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor={`${slug}-status`}>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id={`${slug}-status`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["never", "former", "current", "unknown"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label htmlFor={`${slug}-details`}>Details (optional)</Label><Input id={`${slug}-details`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 1 pack/day x 10 years" /></div>
              <DialogFooter>
                <Button onClick={() => { onSave(status, description || `${label} status: ${status}`); setOpen(false); }}>Save</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function AuditCPanel({ existing, onSave }: { existing: any[]; onSave: (items: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
  const total = answers.reduce((sum, a) => sum + (a >= 0 ? a : 0), 0);
  const complete = answers.every((a) => a >= 0);
  const lastDate = existing[0]?.screeningDate ?? existing[0]?.createdAt;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><Wine className="h-4 w-4" />Alcohol Use (AUDIT-C)</CardTitle>
          <CardDescription>{lastDate ? `Last screened ${new Date(lastDate).toLocaleDateString()}` : "Not yet screened"}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />New screening</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>AUDIT-C screening</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {AUDIT_C_QUESTIONS.map((q, qi) => (
                <div key={qi} className="space-y-1">
                  <Label htmlFor={`auditc-q${qi + 1}`} className="text-sm">{qi + 1}. {q.question}</Label>
                  <Select value={answers[qi] >= 0 ? String(answers[qi]) : undefined} onValueChange={(v) => setAnswers((a) => { const next = [...a]; next[qi] = Number(v); return next; })}>
                    <SelectTrigger id={`auditc-q${qi + 1}`} data-testid={`select-auditc-q${qi + 1}`}><SelectValue placeholder="Select an answer" /></SelectTrigger>
                    <SelectContent>
                      {q.options.map((opt) => <SelectItem key={opt.points} value={String(opt.points)}>{opt.label} ({opt.points} pt)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              {complete && <p className="text-sm font-medium">Total score: {total} / 12</p>}
              <DialogFooter>
                <Button
                  disabled={!complete}
                  data-testid="button-save-auditc"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    onSave(
                      AUDIT_C_QUESTIONS.map((q, qi) => ({
                        domain: "Alcohol Use (AUDIT-C)",
                        question: q.question,
                        response: `${q.options.find((o) => o.points === answers[qi])!.label} (${answers[qi]} pt)`,
                        screeningDate: today,
                      })),
                    );
                    setOpen(false);
                    setAnswers([-1, -1, -1]);
                  }}
                >
                  Save screening
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      {existing.length > 0 && (
        <CardContent className="space-y-1">
          {existing.slice(0, 3).map((s) => (
            <p key={s.id} className="text-xs text-muted-foreground">{s.question} — {s.response}</p>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

function OpioidRiskPanel({ existing, onSave }: { existing: any[]; onSave: (items: any[]) => void }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(ORT_RISK_FACTORS.map(() => false));
  const lastDate = existing[0]?.screeningDate ?? existing[0]?.createdAt;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Opioid Risk Screening</CardTitle>
          <CardDescription>{lastDate ? `Last screened ${new Date(lastDate).toLocaleDateString()}` : "Not yet screened"}</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />New screening</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Opioid risk factor screening</DialogTitle></DialogHeader>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Captures Opioid Risk Tool (ORT) risk-factor categories present. This does not compute a
                point-weighted score — verify current scoring against your organization's published ORT reference
                before using a numeric risk score clinically.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              {ORT_RISK_FACTORS.map((factor, i) => (
                <label key={i} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked[i]}
                    onChange={(e) => setChecked((c) => { const next = [...c]; next[i] = e.target.checked; return next; })}
                    data-testid={`checkbox-ort-${i}`}
                  />
                  <span>{factor}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button
                data-testid="button-save-ort"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  onSave(
                    ORT_RISK_FACTORS.map((factor, i) => ({
                      domain: "Opioid Risk Screening",
                      question: factor,
                      response: checked[i] ? "Present" : "Absent",
                      screeningDate: today,
                    })),
                  );
                  setOpen(false);
                  setChecked(ORT_RISK_FACTORS.map(() => false));
                }}
              >
                Save screening
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      {existing.length > 0 && (
        <CardContent className="space-y-1">
          {existing.filter((s) => s.response === "Present").map((s) => (
            <p key={s.id} className="text-xs text-amber-700 dark:text-amber-400">⚠ {s.question}</p>
          ))}
          {existing.every((s) => s.response !== "Present") && (
            <p className="text-xs text-muted-foreground">No risk factors present on last screening.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
