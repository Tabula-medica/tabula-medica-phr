import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ClipboardList,
  Heart,
  Pill,
  AlertTriangle,
  Shield,
  Syringe,
  Users,
  Activity,
  Brain,
  Home,
  Search,
  Plus,
  X,
  Check,
  Clock,
  CircleAlert,
  Sparkles,
  ChevronRight,
  FileText,
  Stethoscope,
  CheckCircle2,
  CircleDot,
} from "lucide-react";

const PATIENT_ID = "patient-001";

const PHQ9_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
];

function severityColor(sev: string): string {
  switch (sev) {
    case "mild": return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "moderate": return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    case "severe": return "bg-red-500/15 text-red-700 dark:text-red-400";
    case "life-threatening": return "bg-red-600/20 text-red-800 dark:text-red-300";
    default: return "bg-muted text-muted-foreground";
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "current": return <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] no-default-active-elevate"><CheckCircle2 className="w-3 h-3 mr-1" />Current</Badge>;
    case "overdue": return <Badge variant="outline" className="bg-red-500/15 text-red-700 dark:text-red-400 text-[10px] no-default-active-elevate"><CircleAlert className="w-3 h-3 mr-1" />Overdue</Badge>;
    case "due_soon": return <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[10px] no-default-active-elevate"><Clock className="w-3 h-3 mr-1" />Due Soon</Badge>;
    case "not_applicable": return <Badge variant="outline" className="text-[10px] no-default-active-elevate">N/A</Badge>;
    default: return null;
  }
}

function MedicalHistoryTab({ record, refData }: { record: any; refData: any }) {
  const [diagSearch, setDiagSearch] = useState("");
  const [surgSearch, setSurgSearch] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("diagnoses");

  const filteredDiag = useMemo(() => {
    if (!diagSearch) return refData.diagnoses.slice(0, 20);
    const q = diagSearch.toLowerCase();
    return refData.diagnoses.filter((d: any) => d.display.toLowerCase().includes(q) || d.code.toLowerCase().includes(q));
  }, [diagSearch, refData.diagnoses]);

  const filteredSurg = useMemo(() => {
    if (!surgSearch) return refData.surgeries;
    const q = surgSearch.toLowerCase();
    return refData.surgeries.filter((s: any) => s.display.toLowerCase().includes(q));
  }, [surgSearch, refData.surgeries]);

  const filteredMeds = useMemo(() => {
    if (!medSearch) return refData.medications.slice(0, 20);
    const q = medSearch.toLowerCase();
    return refData.medications.filter((m: any) => m.display.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [medSearch, refData.medications]);

  const selectedDiagCodes = new Set(record?.diagnoses?.map((d: any) => d.code) || []);
  const selectedSurgCodes = new Set(record?.surgeries?.map((s: any) => s.code) || []);
  const selectedMedCuis = new Set(record?.medications?.map((m: any) => m.rxcui) || []);

  return (
    <div className="space-y-6" data-testid="tab-content-medical-history">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="diagnoses" data-testid="subtab-diagnoses">
            <Stethoscope className="w-3.5 h-3.5 mr-1.5" />Diagnoses ({record?.diagnoses?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="surgeries" data-testid="subtab-surgeries">
            <Activity className="w-3.5 h-3.5 mr-1.5" />Surgeries ({record?.surgeries?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="subtab-medications">
            <Pill className="w-3.5 h-3.5 mr-1.5" />Medications ({record?.medications?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="diagnoses" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current Diagnoses</CardTitle>
              <CardDescription>Select from top 50 diagnoses or search by ICD-10 code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {record?.diagnoses?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {record.diagnoses.map((d: any) => (
                    <Badge key={d.code} variant="outline" className="no-default-active-elevate gap-1">
                      <span className="text-[10px] text-muted-foreground">{d.code}</span>
                      <span>{d.display.length > 40 ? d.display.slice(0, 40) + "..." : d.display}</span>
                      {d.year && <span className="text-[10px] text-muted-foreground">({d.year})</span>}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search diagnoses by name or ICD-10 code..." className="pl-8" value={diagSearch} onChange={(e) => setDiagSearch(e.target.value)} data-testid="input-search-diagnoses" />
              </div>
              <ScrollArea className="h-[280px]">
                <div className="space-y-1">
                  {filteredDiag.map((d: any) => (
                    <div key={d.code} className={`flex items-center gap-3 p-2 rounded-md ${selectedDiagCodes.has(d.code) ? "bg-accent" : "hover-elevate"}`} data-testid={`diagnosis-item-${d.code}`}>
                      <Checkbox checked={selectedDiagCodes.has(d.code)} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.display}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">{d.code}</span>
                          <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{d.category}</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">{diagSearch ? `${filteredDiag.length} results` : "Showing top 20 of 50 diagnoses. Search to find more."}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="surgeries" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Surgical History</CardTitle>
              <CardDescription>Select from top 10 surgical procedures</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {record?.surgeries?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {record.surgeries.map((s: any) => (
                    <Badge key={s.code} variant="outline" className="no-default-active-elevate gap-1">
                      <span>{s.display}</span>
                      {s.year && <span className="text-[10px] text-muted-foreground">({s.year})</span>}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search surgeries..." className="pl-8" value={surgSearch} onChange={(e) => setSurgSearch(e.target.value)} data-testid="input-search-surgeries" />
              </div>
              <div className="space-y-1">
                {filteredSurg.map((s: any) => (
                  <div key={s.code} className={`flex items-center gap-3 p-2 rounded-md ${selectedSurgCodes.has(s.code) ? "bg-accent" : "hover-elevate"}`} data-testid={`surgery-item-${s.code}`}>
                    <Checkbox checked={selectedSurgCodes.has(s.code)} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{s.display}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">CPT: {s.code}</span>
                        <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{s.category}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Current & Past Medications</CardTitle>
              <CardDescription>Select from top 75 prescribed medications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {record?.medications?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {record.medications.map((m: any) => (
                    <Badge key={m.rxcui} variant="outline" className="no-default-active-elevate gap-1">
                      <Pill className="w-3 h-3" />
                      <span>{m.display}</span>
                      {m.dosage && <span className="text-[10px] text-muted-foreground">({m.dosage})</span>}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Search medications by name or category..." className="pl-8" value={medSearch} onChange={(e) => setMedSearch(e.target.value)} data-testid="input-search-medications" />
              </div>
              <ScrollArea className="h-[280px]">
                <div className="space-y-1">
                  {filteredMeds.map((m: any) => (
                    <div key={m.rxcui} className={`flex items-center gap-3 p-2 rounded-md ${selectedMedCuis.has(m.rxcui) ? "bg-accent" : "hover-elevate"}`} data-testid={`medication-item-${m.rxcui}`}>
                      <Checkbox checked={selectedMedCuis.has(m.rxcui)} className="flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{m.display}</p>
                        <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{m.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-xs text-muted-foreground">{medSearch ? `${filteredMeds.length} results` : "Showing top 20 of 75 medications. Search to find more."}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllergiesTab({ record, refData }: { record: any; refData: any }) {
  const medAllergies = record?.allergies?.filter((a: any) => a.type === "medication") || [];
  const foodAllergies = record?.allergies?.filter((a: any) => a.type === "food") || [];
  const envAllergies = record?.allergies?.filter((a: any) => a.type === "environmental") || [];

  function AllergySection({ title, items, type, allergens }: { title: string; items: any[]; type: string; allergens: string[] }) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>{items.length} recorded {type} allergies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`allergy-item-${a.id}`}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">Reaction: {a.reaction}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] no-default-active-elevate ${severityColor(a.severity)}`}>
                    {a.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
          <Separator />
          <div>
            <p className="text-xs font-medium mb-2 text-muted-foreground">Common {type} allergens:</p>
            <div className="flex flex-wrap gap-1.5">
              {allergens.map(name => {
                const isSelected = items.some((a: any) => a.name === name);
                return (
                  <Badge key={name} variant={isSelected ? "default" : "outline"} className={`text-[10px] cursor-pointer ${isSelected ? "" : "no-default-active-elevate"}`}>
                    {isSelected && <Check className="w-3 h-3 mr-0.5" />}
                    {name}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="tab-content-allergies">
      {medAllergies.length === 0 && foodAllergies.length === 0 && envAllergies.length === 0 && (
        <Card className="border-emerald-500/50">
          <CardContent className="py-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <p className="text-sm">No known allergies (NKDA) reported</p>
          </CardContent>
        </Card>
      )}
      <AllergySection title="Medication Allergies" items={medAllergies} type="medication" allergens={refData.allergens.medication} />
      <AllergySection title="Food Allergies" items={foodAllergies} type="food" allergens={refData.allergens.food} />
      <AllergySection title="Environmental Allergies" items={envAllergies} type="environmental" allergens={refData.allergens.environmental} />
    </div>
  );
}

function PreventiveCareTab({ record, recommendations }: { record: any; recommendations: any[] }) {
  const preventive = record?.preventiveHistory || [];
  const overdue = preventive.filter((p: any) => p.status === "overdue");
  const dueSoon = preventive.filter((p: any) => p.status === "due_soon");
  const current = preventive.filter((p: any) => p.status === "current");

  return (
    <div className="space-y-4" data-testid="tab-content-preventive">
      {overdue.length > 0 && (
        <Card className="border-red-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
              <CircleAlert className="w-4 h-4" /> Overdue Screenings ({overdue.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdue.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-red-500/30" data-testid={`preventive-item-${p.id}`}>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.frequency} | Last: {p.lastDate || "Never"}</p>
                    {p.aiRecommended && p.notes && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1"><Sparkles className="w-3 h-3 inline mr-1" />{p.notes}</p>}
                  </div>
                  {statusBadge(p.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dueSoon.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" /> Due Soon ({dueSoon.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dueSoon.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`preventive-item-${p.id}`}>
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.frequency} | Due: {p.nextDue || "Discuss with provider"}</p>
                    {p.aiRecommended && p.notes && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1"><Sparkles className="w-3 h-3 inline mr-1" />{p.notes}</p>}
                  </div>
                  {statusBadge(p.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Current ({current.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {current.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`preventive-item-${p.id}`}>
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.frequency} | Last: {p.lastDate} | Next: {p.nextDue}</p>
                </div>
                {statusBadge(p.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {recommendations.length > 0 && (
        <Card className="border-blue-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" /> AI Recommendations ({recommendations.length})
            </CardTitle>
            <CardDescription>Based on your health conditions and history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recommendations.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-md border border-blue-500/30" data-testid={`ai-recommendation-${r.id}`}>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.frequency}</p>
                    {r.notes && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{r.notes}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 no-default-active-elevate">
                    <Sparkles className="w-3 h-3 mr-1" />AI
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function VaccinesTab({ vaccines }: { vaccines: any }) {
  if (!vaccines) return <p className="text-sm text-muted-foreground">No vaccine data available</p>;

  return (
    <div className="space-y-4" data-testid="tab-content-vaccines">
      <Card className={vaccines.connected ? "border-emerald-500/50" : "border-amber-500/50"}>
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${vaccines.connected ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
              <Shield className={`w-5 h-5 ${vaccines.connected ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
            </div>
            <div>
              <p className="text-sm font-medium" data-testid="text-registry-name">{vaccines.registryName}</p>
              <p className="text-xs text-muted-foreground">
                {vaccines.connected ? `Connected | Last sync: ${new Date(vaccines.lastSync).toLocaleDateString()} | Patient match: ${vaccines.patientMatch ? "Confirmed" : "Pending"}` : "Not connected to state registry"}
              </p>
            </div>
          </div>
          <Badge variant={vaccines.connected ? "default" : "outline"} className={vaccines.connected ? "" : "no-default-active-elevate"}>
            {vaccines.connected ? "Connected" : "Connect"}
          </Badge>
        </CardContent>
      </Card>

      {vaccines.dueVaccines?.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Syringe className="w-4 h-4" /> Vaccines Due ({vaccines.dueVaccines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {vaccines.dueVaccines.map((v: any, i: number) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`vaccine-due-${i}`}>
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">Due: {v.dueDate}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] no-default-active-elevate ${v.priority === "recommended" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-blue-500/15 text-blue-700 dark:text-blue-400"}`}>
                    {v.priority === "recommended" ? "Recommended" : "Discuss"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Syringe className="w-4 h-4" /> Immunization Records ({vaccines.records?.length || 0})
          </CardTitle>
          <CardDescription>Retrieved from state immunization registry</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {vaccines.records?.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between gap-3 p-2 rounded-md border" data-testid={`vaccine-record-${v.id}`}>
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-md bg-blue-500/15">
                    <Syringe className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{v.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(v.date).toLocaleDateString()}</span>
                      {v.manufacturer && <span>| {v.manufacturer}</span>}
                      {v.lot && <span>| Lot: {v.lot}</span>}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] no-default-active-elevate">{v.source}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SocialHistoryTab({ socialHistory }: { socialHistory: any }) {
  if (!socialHistory) return <p className="text-sm text-muted-foreground">No social history data available</p>;

  function Field({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-start justify-between gap-3 py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right">{value || "Not specified"}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="tab-content-social-history">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Substance Use</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Field label="Tobacco" value={`${socialHistory.tobacco.status}${socialHistory.tobacco.type ? ` (${socialHistory.tobacco.type})` : ""}`} />
          {socialHistory.tobacco.amount && <Field label="Amount" value={socialHistory.tobacco.amount} />}
          {socialHistory.tobacco.yearsUsed && <Field label="Years Used" value={`${socialHistory.tobacco.yearsUsed} years`} />}
          {socialHistory.tobacco.quitDate && <Field label="Quit Date" value={new Date(socialHistory.tobacco.quitDate).toLocaleDateString()} />}
          <Separator className="my-2" />
          <Field label="Alcohol" value={socialHistory.alcohol.status} />
          {socialHistory.alcohol.frequency && <Field label="Frequency" value={socialHistory.alcohol.frequency} />}
          <Separator className="my-2" />
          <Field label="Recreational Drugs" value={socialHistory.drugs.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Lifestyle</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Field label="Exercise" value={`${socialHistory.exercise.frequency}${socialHistory.exercise.type ? ` - ${socialHistory.exercise.type}` : ""}`} />
          {socialHistory.exercise.duration && <Field label="Duration" value={socialHistory.exercise.duration} />}
          <Separator className="my-2" />
          <Field label="Diet" value={socialHistory.diet.type} />
          {socialHistory.diet.restrictions?.length > 0 && <Field label="Restrictions" value={socialHistory.diet.restrictions.join(", ")} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Demographics</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          <Field label="Occupation" value={socialHistory.occupation.current} />
          <Field label="Marital Status" value={socialHistory.maritalStatus} />
          <Field label="Living Situation" value={socialHistory.livingSituation} />
          <Field label="Education" value={socialHistory.education} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Exposures & Other</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {socialHistory.occupation.exposures?.length > 0 && <Field label="Occupational Exposures" value={socialHistory.occupation.exposures.join(", ")} />}
          <Field label="Sexual History" value={socialHistory.sexualHistory.active ? "Active" : "Not currently active"} />
        </CardContent>
      </Card>
    </div>
  );
}

function PEGScaleTab({ pegScore }: { pegScore: any }) {
  const PEG_ITEMS = [
    { key: "pain", label: "Pain on average in the past week", low: "No pain", high: "Pain as bad as you can imagine" },
    { key: "enjoyment", label: "How pain has interfered with your enjoyment of life", low: "Does not interfere", high: "Completely interferes" },
    { key: "generalActivity", label: "How pain has interfered with your general activity", low: "Does not interfere", high: "Completely interferes" },
  ];

  return (
    <div className="space-y-4" data-testid="tab-content-peg">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" /> PEG Pain Assessment Scale
          </CardTitle>
          <CardDescription>Pain intensity and interference assessment (0-10 scale)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {PEG_ITEMS.map(item => {
            const val = pegScore?.[item.key] ?? 0;
            return (
              <div key={item.key} className="space-y-2">
                <Label className="text-sm">{item.label}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-16">{item.low}</span>
                  <div className="flex-1 flex items-center gap-1">
                    {Array.from({ length: 11 }, (_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-8 rounded-md flex items-center justify-center text-xs font-medium border cursor-pointer transition-colors ${
                          i === val
                            ? i <= 3 ? "bg-emerald-500/20 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                            : i <= 6 ? "bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-400"
                            : "bg-red-500/20 border-red-500 text-red-700 dark:text-red-400"
                            : "hover-elevate"
                        }`}
                        data-testid={`peg-${item.key}-${i}`}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground w-16 text-right">{item.high}</span>
                </div>
              </div>
            );
          })}
          {pegScore && (
            <Card className="bg-muted/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">PEG Score: {pegScore.totalScore}/10</p>
                    <p className="text-xs text-muted-foreground">{pegScore.interpretation}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      pegScore.totalScore <= 3 ? "bg-emerald-500"
                      : pegScore.totalScore <= 5 ? "bg-amber-500"
                      : pegScore.totalScore <= 7 ? "bg-orange-500"
                      : "bg-red-500"
                    }`} />
                    <span className="text-sm font-medium" data-testid="text-peg-score">{pegScore.interpretation}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Assessed: {new Date(pegScore.assessedAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PHQ9Tab({ phq9, questions }: { phq9: any; questions: string[] }) {
  return (
    <div className="space-y-4" data-testid="tab-content-phq9">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="w-4 h-4" /> PHQ-9 Depression Screening
          </CardTitle>
          <CardDescription>Over the last 2 weeks, how often have you been bothered by any of the following problems?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.map((q, idx) => {
            const response = phq9?.responses?.find((r: any) => r.questionIndex === idx);
            const selectedScore = response?.score ?? -1;
            return (
              <div key={idx} className="space-y-2 pb-3 border-b last:border-0">
                <p className="text-sm">{idx + 1}. {q}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {PHQ9_OPTIONS.map(opt => (
                    <div
                      key={opt.value}
                      className={`p-2 rounded-md border text-center text-xs cursor-pointer transition-colors ${
                        selectedScore === opt.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover-elevate"
                      }`}
                      data-testid={`phq9-q${idx}-opt${opt.value}`}
                    >
                      <p className="font-medium">{opt.value}</p>
                      <p className={selectedScore === opt.value ? "text-primary-foreground/80" : "text-muted-foreground"}>{opt.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {phq9 && (
            <Card className={`${
              phq9.totalScore <= 4 ? "border-emerald-500/50"
              : phq9.totalScore <= 9 ? "border-yellow-500/50"
              : phq9.totalScore <= 14 ? "border-amber-500/50"
              : phq9.totalScore <= 19 ? "border-orange-500/50"
              : "border-red-500/50"
            }`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium" data-testid="text-phq9-score">PHQ-9 Score: {phq9.totalScore}/27</p>
                    <p className="text-sm font-medium" data-testid="text-phq9-severity">{phq9.severity}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {phq9.totalScore <= 4 && <div className="w-3 h-3 rounded-full bg-emerald-500" />}
                    {phq9.totalScore > 4 && phq9.totalScore <= 9 && <div className="w-3 h-3 rounded-full bg-yellow-500" />}
                    {phq9.totalScore > 9 && phq9.totalScore <= 14 && <div className="w-3 h-3 rounded-full bg-amber-500" />}
                    {phq9.totalScore > 14 && phq9.totalScore <= 19 && <div className="w-3 h-3 rounded-full bg-orange-500" />}
                    {phq9.totalScore > 19 && <div className="w-3 h-3 rounded-full bg-red-500" />}
                    <span className="text-sm">{phq9.totalScore}/27</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">{phq9.recommendation}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Assessed: {new Date(phq9.assessedAt).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          )}
          <div className="text-xs text-muted-foreground space-y-1 mt-2">
            <p className="font-medium">Scoring Guide:</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /> 0-4: Minimal</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> 5-9: Mild</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> 10-14: Moderate</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> 15-19: Mod. Severe</div>
              <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> 20-27: Severe</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SDOHTab({ sdoh, domains }: { sdoh: any; domains: any[] }) {
  return (
    <div className="space-y-4" data-testid="tab-content-sdoh">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4" /> Social Determinants of Health (SDOH)
          </CardTitle>
          <CardDescription>Screening for social risk factors that affect health outcomes</CardDescription>
        </CardHeader>
        <CardContent>
          {sdoh && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-md border">
              <div className={`p-2 rounded-md ${
                sdoh.overallRisk === "Low" ? "bg-emerald-500/15" : sdoh.overallRisk === "Moderate" ? "bg-amber-500/15" : "bg-red-500/15"
              }`}>
                <Shield className={`w-5 h-5 ${
                  sdoh.overallRisk === "Low" ? "text-emerald-600 dark:text-emerald-400" : sdoh.overallRisk === "Moderate" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                }`} />
              </div>
              <div>
                <p className="text-sm font-medium" data-testid="text-sdoh-risk">Overall Risk: {sdoh.overallRisk}</p>
                <p className="text-xs text-muted-foreground">
                  {sdoh.referrals?.length > 0 ? `Referrals: ${sdoh.referrals.join(", ")}` : "No referrals needed"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {domains.map((domain: any, di: number) => {
        const answered = sdoh?.domains?.find((d: any) => d.domain === domain.domain);
        return (
          <Card key={di}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{domain.domain}</CardTitle>
                {answered && (
                  <Badge variant="outline" className={`text-[10px] no-default-active-elevate ${
                    answered.riskLevel === "low" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : answered.riskLevel === "moderate" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400"
                  }`}>
                    {answered.riskLevel} risk
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {domain.questions.map((q: any) => {
                const existingAnswer = answered?.questions?.find((aq: any) => aq.id === q.id);
                return (
                  <div key={q.id} className="space-y-1.5" data-testid={`sdoh-question-${q.id}`}>
                    <p className="text-sm">{q.question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {q.options.map((opt: string) => (
                        <Badge
                          key={opt}
                          variant={existingAnswer?.answer === opt ? "default" : "outline"}
                          className={`text-xs cursor-pointer ${existingAnswer?.answer !== opt ? "no-default-active-elevate" : ""}`}
                        >
                          {existingAnswer?.answer === opt && <Check className="w-3 h-3 mr-0.5" />}
                          {opt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function IntakeHistory() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("medical");

  const { data: refDataRes, isLoading: refLoading } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/infrastructure/intake/reference-data"],
  });

  const { data: recordRes, isLoading: recordLoading } = useQuery<{ success: boolean; record: any }>({
    queryKey: ["/api/infrastructure/intake", PATIENT_ID, "record"],
  });

  const { data: recsRes } = useQuery<{ success: boolean; recommendations: any[] }>({
    queryKey: ["/api/infrastructure/intake", PATIENT_ID, "preventive-recommendations"],
  });

  const refData = refDataRes?.data;
  const record = recordRes?.record;
  const recommendations = recsRes?.recommendations || [];
  const isLoading = refLoading || recordLoading;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const diagCount = record?.diagnoses?.length || 0;
  const medCount = record?.medications?.length || 0;
  const allergyCount = record?.allergies?.length || 0;
  const vaccineCount = record?.vaccines?.records?.length || 0;

  return (
    <div className="p-6 space-y-6" data-testid="page-intake-history">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="page-title">
            <ClipboardList className="w-6 h-6 text-primary" />
            Comprehensive Intake History
          </h1>
          <p className="text-sm text-muted-foreground">
            Complete medical, social, and screening history
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-intake-stats">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/15"><Stethoscope className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-diagnoses">{diagCount}</p>
                <p className="text-xs text-muted-foreground">Diagnoses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-500/15"><Pill className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-medications">{medCount}</p>
                <p className="text-xs text-muted-foreground">Medications</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/15"><AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-allergies">{allergyCount}</p>
                <p className="text-xs text-muted-foreground">Allergies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/15"><Syringe className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-vaccines">{vaccineCount}</p>
                <p className="text-xs text-muted-foreground">Vaccines</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="medical" data-testid="tab-medical"><Stethoscope className="w-3.5 h-3.5 mr-1.5" />Medical History</TabsTrigger>
          <TabsTrigger value="allergies" data-testid="tab-allergies"><AlertTriangle className="w-3.5 h-3.5 mr-1.5" />Allergies</TabsTrigger>
          <TabsTrigger value="preventive" data-testid="tab-preventive"><Shield className="w-3.5 h-3.5 mr-1.5" />Preventive</TabsTrigger>
          <TabsTrigger value="vaccines" data-testid="tab-vaccines"><Syringe className="w-3.5 h-3.5 mr-1.5" />Vaccines</TabsTrigger>
          <TabsTrigger value="social" data-testid="tab-social"><Users className="w-3.5 h-3.5 mr-1.5" />Social History</TabsTrigger>
          <TabsTrigger value="peg" data-testid="tab-peg"><Activity className="w-3.5 h-3.5 mr-1.5" />PEG Scale</TabsTrigger>
          <TabsTrigger value="phq9" data-testid="tab-phq9"><Brain className="w-3.5 h-3.5 mr-1.5" />PHQ-9</TabsTrigger>
          <TabsTrigger value="sdoh" data-testid="tab-sdoh"><Home className="w-3.5 h-3.5 mr-1.5" />SDOH</TabsTrigger>
        </TabsList>

        <TabsContent value="medical">
          {refData && <MedicalHistoryTab record={record} refData={refData} />}
        </TabsContent>
        <TabsContent value="allergies">
          {refData && <AllergiesTab record={record} refData={refData} />}
        </TabsContent>
        <TabsContent value="preventive">
          <PreventiveCareTab record={record} recommendations={recommendations} />
        </TabsContent>
        <TabsContent value="vaccines">
          <VaccinesTab vaccines={record?.vaccines} />
        </TabsContent>
        <TabsContent value="social">
          <SocialHistoryTab socialHistory={record?.socialHistory} />
        </TabsContent>
        <TabsContent value="peg">
          <PEGScaleTab pegScore={record?.pegScore} />
        </TabsContent>
        <TabsContent value="phq9">
          {refData && <PHQ9Tab phq9={record?.phq9} questions={refData.phq9Questions} />}
        </TabsContent>
        <TabsContent value="sdoh">
          {refData && <SDOHTab sdoh={record?.sdoh} domains={refData.sdohDomains} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
