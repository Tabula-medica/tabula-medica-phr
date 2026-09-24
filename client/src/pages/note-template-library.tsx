import { useMemo, useState } from "react";
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
import { Plus, Download, Star, Trash2, Copy, FileText, Search, Info } from "lucide-react";

const NOTE_TYPES = [
  { value: "soap", label: "SOAP" },
  { value: "hpi", label: "HPI" },
  { value: "full_note", label: "Full note" },
  { value: "procedure_note", label: "Procedure note" },
  { value: "discharge", label: "Discharge" },
];

interface LibraryTemplate {
  id: string;
  chiefComplaint: string;
  specialty: string | null;
  title: string;
  noteType: string;
  bodyTemplate: string;
  tags: string[];
  createdByName: string | null;
  importCount: number;
}

interface MyTemplate {
  id: string;
  chiefComplaint: string;
  title: string;
  noteType: string;
  bodyTemplate: string;
  placeholderHints: { token: string; label: string; example?: string }[];
  tags: string[];
  favorited: boolean;
  usageCount: number;
  lastUsedAt: string | null;
}

function extractTokens(body: string): string[] {
  const matches = body.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) || [];
  const tokens = matches.map((m) => m.replace(/[{}]/g, "").trim());
  return Array.from(new Set(tokens));
}

function fillTemplate(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, token) => values[token] || `{{${token}}}`);
}

export default function NoteTemplateLibrary() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [composeTemplate, setComposeTemplate] = useState<MyTemplate | null>(null);

  const { data: libraryData, isLoading: libraryLoading } = useQuery<{ templates: LibraryTemplate[] }>({
    queryKey: ["/api/note-templates/library", search],
    queryFn: async () => (await apiRequest("GET", `/api/note-templates/library${search ? `?q=${encodeURIComponent(search)}` : ""}`)).json(),
  });

  const { data: mineData, isLoading: mineLoading } = useQuery<{ templates: MyTemplate[] }>({
    queryKey: ["/api/note-templates/mine"],
    queryFn: async () => (await apiRequest("GET", "/api/note-templates/mine")).json(),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/note-templates/library"] });
    queryClient.invalidateQueries({ queryKey: ["/api/note-templates/mine"] });
  };

  const importTemplate = useMutation({
    mutationFn: async (id: string) => (await apiRequest("POST", `/api/note-templates/library/${id}/import`)).json(),
    onSuccess: () => { toast({ title: "Added to My Templates" }); invalidateAll(); },
    onError: (e: any) => toast({ title: "Import failed", description: String(e?.message || e), variant: "destructive" }),
  });

  const publishTemplate = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", "/api/note-templates/library", body)).json(),
    onSuccess: () => { toast({ title: "Published to the library" }); invalidateAll(); },
    onError: (e: any) => toast({ title: "Could not publish", description: String(e?.message || e), variant: "destructive" }),
  });

  const createMine = useMutation({
    mutationFn: async (body: unknown) => (await apiRequest("POST", "/api/note-templates/mine", body)).json(),
    onSuccess: () => { toast({ title: "Template created" }); invalidateAll(); },
    onError: (e: any) => toast({ title: "Could not save", description: String(e?.message || e), variant: "destructive" }),
  });

  const patchMine = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: unknown }) => (await apiRequest("PATCH", `/api/note-templates/mine/${id}`, body)).json(),
    onSuccess: () => invalidateAll(),
  });

  const deleteMine = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/note-templates/mine/${id}`),
    onSuccess: () => { toast({ title: "Template removed" }); invalidateAll(); },
  });

  const library = libraryData?.templates ?? [];
  const mine = mineData?.templates ?? [];

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Note template library</h1>
        <p className="text-sm text-muted-foreground">Complaint-specific templates for quick charting.</p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine" data-testid="tab-my-templates">My Templates ({mine.length})</TabsTrigger>
          <TabsTrigger value="library" data-testid="tab-library">Library ({library.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="pt-4 space-y-4">
          <div className="flex justify-end">
            <NewTemplateDialog onSave={(body) => createMine.mutate(body)} />
          </div>
          {mineLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : mine.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              No personal templates yet — import one from the Library or create one from scratch.
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {mine.map((t) => (
                <Card key={t.id} data-testid={`card-my-template-${t.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <CardDescription>{t.chiefComplaint} · {NOTE_TYPES.find((n) => n.value === t.noteType)?.label}</CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t.favorited ? "Unfavorite" : "Favorite"}
                        onClick={() => patchMine.mutate({ id: t.id, body: { favorited: !t.favorited } })}
                      >
                        <Star className={`h-4 w-4 ${t.favorited ? "fill-yellow-400 text-yellow-400" : ""}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Used {t.usageCount}×</p>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => setComposeTemplate(t)} data-testid={`button-use-template-${t.id}`}>
                        <FileText className="h-4 w-4 mr-1" />Use
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteMine.mutate(t.id)} aria-label="Delete template">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="pt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by chief complaint or title" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-library" />
            </div>
            <PublishTemplateDialog onSave={(body) => publishTemplate.mutate(body)} />
          </div>

          {libraryLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : library.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No templates match.</CardContent></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {library.map((t) => (
                <Card key={t.id} data-testid={`card-library-template-${t.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <CardDescription>{t.chiefComplaint}{t.specialty ? ` · ${t.specialty}` : ""}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {t.createdByName ? `By ${t.createdByName} · ` : ""}Imported {t.importCount}×
                    </p>
                    <Button size="sm" variant="outline" onClick={() => importTemplate.mutate(t.id)} data-testid={`button-import-${t.id}`}>
                      <Download className="h-4 w-4 mr-1" />Import
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ComposeDialog
        template={composeTemplate}
        onClose={() => setComposeTemplate(null)}
        onUsed={() => composeTemplate && patchMine.mutate({ id: composeTemplate.id, body: { markUsed: true } })}
      />
    </div>
  );
}

function NewTemplateDialog({ onSave }: { onSave: (body: any) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [noteType, setNoteType] = useState("soap");
  const [bodyTemplate, setBodyTemplate] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button data-testid="button-new-template"><Plus className="h-4 w-4 mr-2" />New template</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New template</DialogTitle></DialogHeader>
        <TemplateFields
          title={title} setTitle={setTitle}
          chiefComplaint={chiefComplaint} setChiefComplaint={setChiefComplaint}
          noteType={noteType} setNoteType={setNoteType}
          bodyTemplate={bodyTemplate} setBodyTemplate={setBodyTemplate}
        />
        <DialogFooter>
          <Button
            disabled={!title.trim() || !chiefComplaint.trim() || !bodyTemplate.trim()}
            data-testid="button-save-new-template"
            onClick={() => {
              onSave({ title, chiefComplaint, noteType, bodyTemplate, placeholderHints: extractTokens(bodyTemplate).map((t) => ({ token: t, label: t })) });
              setOpen(false);
              setTitle(""); setChiefComplaint(""); setBodyTemplate("");
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublishTemplateDialog({ onSave }: { onSave: (body: any) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [noteType, setNoteType] = useState("soap");
  const [bodyTemplate, setBodyTemplate] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" data-testid="button-publish-template">Publish to library</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Publish a template to the shared library</DialogTitle></DialogHeader>
        <TemplateFields
          title={title} setTitle={setTitle}
          chiefComplaint={chiefComplaint} setChiefComplaint={setChiefComplaint}
          noteType={noteType} setNoteType={setNoteType}
          bodyTemplate={bodyTemplate} setBodyTemplate={setBodyTemplate}
        />
        <div className="space-y-1"><Label htmlFor="template-specialty">Specialty (optional)</Label><Input id="template-specialty" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Family Medicine" /></div>
        <DialogFooter>
          <Button
            disabled={!title.trim() || !chiefComplaint.trim() || !bodyTemplate.trim()}
            onClick={() => {
              onSave({
                title,
                chiefComplaint,
                specialty: specialty || null,
                noteType,
                bodyTemplate,
                placeholderHints: extractTokens(bodyTemplate).map((t) => ({ token: t, label: t })),
              });
              setOpen(false);
              setTitle(""); setChiefComplaint(""); setSpecialty(""); setBodyTemplate("");
            }}
          >
            Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateFields({
  title, setTitle, chiefComplaint, setChiefComplaint, noteType, setNoteType, bodyTemplate, setBodyTemplate,
}: {
  title: string; setTitle: (v: string) => void;
  chiefComplaint: string; setChiefComplaint: (v: string) => void;
  noteType: string; setNoteType: (v: string) => void;
  bodyTemplate: string; setBodyTemplate: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label htmlFor="template-title">Title</Label><Input id="template-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. URI - Adult - Standard" data-testid="input-template-title" /></div>
        <div className="space-y-1"><Label htmlFor="template-cc">Chief complaint</Label><Input id="template-cc" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="e.g. Upper Respiratory Infection" data-testid="input-template-cc" /></div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="template-note-type">Note type</Label>
        <Select value={noteType} onValueChange={setNoteType}>
          <SelectTrigger id="template-note-type"><SelectValue /></SelectTrigger>
          <SelectContent>{NOTE_TYPES.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="template-body">Template body</Label>
        <Textarea
          id="template-body"
          value={bodyTemplate}
          onChange={(e) => setBodyTemplate(e.target.value)}
          rows={8}
          placeholder={"Subjective: {{duration}} of {{symptoms}}...\nUse {{token}} for anything you'll fill in at charting time."}
          data-testid="textarea-template-body"
        />
      </div>
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Wrap anything you'll fill in later in double braces, e.g. <code>{"{{duration}}"}</code>.</AlertDescription>
      </Alert>
    </div>
  );
}

function ComposeDialog({ template, onClose, onUsed }: { template: MyTemplate | null; onClose: () => void; onUsed: () => void }) {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});

  const tokens = useMemo(() => (template ? extractTokens(template.bodyTemplate) : []), [template]);
  const finalText = template ? fillTemplate(template.bodyTemplate, values) : "";

  return (
    <Dialog open={!!template} onOpenChange={(open) => { if (!open) { onClose(); setValues({}); } }}>
      <DialogContent className="max-w-2xl">
        {template && (
          <>
            <DialogHeader><DialogTitle>{template.title}</DialogTitle></DialogHeader>
            {tokens.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {tokens.map((token) => {
                  const hint = template.placeholderHints.find((h) => h.token === token);
                  return (
                    <div key={token} className="space-y-1">
                      <Label className="text-xs">{hint?.label ?? token}</Label>
                      <Input
                        value={values[token] ?? ""}
                        placeholder={hint?.example}
                        onChange={(e) => setValues((v) => ({ ...v, [token]: e.target.value }))}
                        data-testid={`input-placeholder-${token}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="compose-preview" className="text-xs">Preview</Label>
              <Textarea id="compose-preview" readOnly value={finalText} rows={10} className="font-mono text-sm" data-testid="textarea-compose-preview" />
            </div>
            <DialogFooter>
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(finalText);
                  toast({ title: "Copied to clipboard" });
                  onUsed();
                }}
                data-testid="button-copy-note"
              >
                <Copy className="h-4 w-4 mr-2" />Copy note
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
