import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  FileText, Upload, Search, Calendar, User, Building2,
  CheckCircle2, AlertCircle, Loader2, Plus, Eye, Trash2,
  FileCheck, ClipboardList, Stethoscope, Activity, FlaskConical,
  ScanLine, Pill, Heart, Clock
} from "lucide-react";
import ClinicalNoteSummary from "@/components/clinical-note-summary";

const PATIENT_ID = "patient-001";

interface ClinicalNote {
  id: string;
  patientId: string;
  title: string;
  noteType: string;
  content: string;
  summary?: string;
  author?: string;
  authorRole?: string;
  facility?: string;
  dateOfService: string;
  importedAt: string;
  sourceFormat: string;
  sourceFileName?: string;
  tags: string[];
  isVerified: boolean;
}

interface NoteType {
  id: string;
  name: string;
  description: string;
}

const NOTE_TYPE_ICONS: Record<string, React.ComponentType<any>> = {
  progress_note: ClipboardList,
  discharge_summary: FileCheck,
  consultation: Stethoscope,
  operative_report: Activity,
  history_physical: Heart,
  nursing_note: User,
  radiology_report: ScanLine,
  pathology_report: FlaskConical,
  lab_report: FlaskConical,
  other: FileText,
};

function getNoteTypeIcon(type: string) {
  return NOTE_TYPE_ICONS[type] || FileText;
}

export default function ClinicalNotesImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("notes");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<ClinicalNote | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importForm, setImportForm] = useState({
    title: "",
    noteType: "progress_note",
    content: "",
    author: "",
    facility: "",
    dateOfService: new Date().toISOString().split("T")[0],
    tags: "",
  });

  const { data: notesData, isLoading: notesLoading } = useQuery<{ success: boolean; data: ClinicalNote[] }>({
    queryKey: ["/api/clinical-notes", PATIENT_ID],
  });

  const { data: noteTypesData } = useQuery<{ success: boolean; data: NoteType[] }>({
    queryKey: ["/api/clinical-notes/types"],
  });

  const importNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/clinical-notes/import", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", PATIENT_ID] });
      toast({ title: "Note imported", description: "Clinical note has been saved successfully." });
      setImportDialogOpen(false);
      resetImportForm();
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not import the clinical note", variant: "destructive" });
    },
  });

  const parseDocumentMutation = useMutation({
    mutationFn: async (data: { patientId: string; fileContent: string; fileName: string }) => {
      const res = await apiRequest("POST", "/api/clinical-notes/parse", data);
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result.success) {
        setImportForm({
          ...importForm,
          title: result.data.suggestedTitle || "",
          noteType: result.data.suggestedNoteType || "other",
          content: result.data.extractedContent || "",
          author: result.data.suggestedAuthor || "",
          facility: result.data.suggestedFacility || "",
          dateOfService: result.data.suggestedDateOfService || new Date().toISOString().split("T")[0],
        });
        toast({ 
          title: "Document parsed", 
          description: `Detected ${result.data.suggestedNoteType?.replace("_", " ")} with ${Math.round(result.data.confidence * 100)}% confidence` 
        });
      }
    },
    onError: () => {
      toast({ title: "Parse failed", description: "Could not parse the document", variant: "destructive" });
    },
  });

  const verifyNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("PATCH", `/api/clinical-notes/${PATIENT_ID}/${noteId}/verify`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", PATIENT_ID] });
      toast({ title: "Note verified", description: "Clinical note has been marked as verified." });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("DELETE", `/api/clinical-notes/${PATIENT_ID}/${noteId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", PATIENT_ID] });
      toast({ title: "Note deleted", description: "Clinical note has been removed." });
      setViewDialogOpen(false);
    },
  });

  const resetImportForm = () => {
    setImportForm({
      title: "",
      noteType: "progress_note",
      content: "",
      author: "",
      facility: "",
      dateOfService: new Date().toISOString().split("T")[0],
      tags: "",
    });
    setSelectedFile(null);
  };

  const handleFileUpload = async (file: File) => {
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseDocumentMutation.mutate({
        patientId: PATIENT_ID,
        fileContent: content,
        fileName: file.name,
      });
    };
    reader.readAsText(file);
  };

  const getSourceFormat = (fileName?: string): "text" | "cda" | "fhir" | "hl7" => {
    if (!fileName) return "text";
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "xml" || ext === "cda") return "cda";
    if (ext === "json") return "fhir";
    if (ext === "hl7") return "hl7";
    return "text";
  };

  const handleImport = () => {
    importNoteMutation.mutate({
      patientId: PATIENT_ID,
      title: importForm.title,
      noteType: importForm.noteType,
      content: importForm.content,
      author: importForm.author || undefined,
      facility: importForm.facility || undefined,
      dateOfService: importForm.dateOfService,
      sourceFormat: getSourceFormat(selectedFile?.name),
      sourceFileName: selectedFile?.name,
      tags: importForm.tags ? importForm.tags.split(",").map(t => t.trim()) : [],
    });
  };

  const notes = notesData?.data || [];
  const noteTypes = noteTypesData?.data || [];

  const filteredNotes = notes.filter(note => {
    const matchesSearch = searchQuery === "" || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.author?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || note.noteType === filterType;
    return matchesSearch && matchesType;
  });

  if (notesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Clinical Notes</h1>
        <p className="text-muted-foreground">
          Import and manage clinical documentation from your healthcare providers.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-notes"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-48" data-testid="select-note-type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {noteTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setImportDialogOpen(true)} data-testid="button-import-note">
          <Plus className="w-4 h-4 mr-2" />
          Import Note
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-notes">{notes.length}</p>
                <p className="text-sm text-muted-foreground">Total Notes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-verified-notes">{notes.filter(n => n.isVerified).length}</p>
                <p className="text-sm text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900">
                <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-pending-notes">{notes.filter(n => !n.isVerified).length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-facility-count">
                  {new Set(notes.filter(n => n.facility).map(n => n.facility)).size}
                </p>
                <p className="text-sm text-muted-foreground">Facilities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {filteredNotes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No clinical notes found</h3>
            <p className="text-muted-foreground mb-4">
              Import your clinical documentation to get started.
            </p>
            <Button onClick={() => setImportDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Import Your First Note
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredNotes.map((note) => {
            const IconComponent = getNoteTypeIcon(note.noteType);
            return (
              <Card key={note.id} className="hover-elevate cursor-pointer" onClick={() => {
                setSelectedNote(note);
                setViewDialogOpen(true);
              }}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <IconComponent className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold" data-testid={`text-note-title-${note.id}`}>{note.title}</h3>
                        <Badge variant="outline" className="capitalize">
                          {note.noteType.replace(/_/g, " ")}
                        </Badge>
                        {note.isVerified ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {note.summary || note.content.substring(0, 150)}...
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {note.author && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {note.author}
                          </span>
                        )}
                        {note.facility && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {note.facility}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(note.dateOfService).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNote(note);
                      setViewDialogOpen(true);
                    }} data-testid={`button-view-note-${note.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Clinical Note
            </DialogTitle>
            <DialogDescription>
              Upload a document or manually enter clinical note details
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="upload" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload Document</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Drag and drop your clinical document, or click to browse
                </p>
                <Input
                  type="file"
                  accept=".txt,.xml,.json,.cda"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="max-w-xs mx-auto"
                  data-testid="input-upload-document"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Supported formats: TXT, XML, JSON, CDA
                </p>
                {selectedFile && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-green-600">
                    <FileCheck className="w-4 h-4" />
                    {selectedFile.name}
                  </div>
                )}
                {parseDocumentMutation.isPending && (
                  <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing document...
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fill in the note details below
              </p>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={importForm.title}
                  onChange={(e) => setImportForm({ ...importForm, title: e.target.value })}
                  placeholder="Note title"
                  data-testid="input-note-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noteType">Note Type</Label>
                <Select value={importForm.noteType} onValueChange={(v) => setImportForm({ ...importForm, noteType: v })}>
                  <SelectTrigger data-testid="select-import-note-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {noteTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="author">Author/Provider</Label>
                <Input
                  id="author"
                  value={importForm.author}
                  onChange={(e) => setImportForm({ ...importForm, author: e.target.value })}
                  placeholder="Dr. Smith, MD"
                  data-testid="input-note-author"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility">Facility</Label>
                <Input
                  id="facility"
                  value={importForm.facility}
                  onChange={(e) => setImportForm({ ...importForm, facility: e.target.value })}
                  placeholder="General Hospital"
                  data-testid="input-note-facility"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateOfService">Date of Service</Label>
              <Input
                id="dateOfService"
                type="date"
                value={importForm.dateOfService}
                onChange={(e) => setImportForm({ ...importForm, dateOfService: e.target.value })}
                data-testid="input-note-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Note Content</Label>
              <Textarea
                id="content"
                value={importForm.content}
                onChange={(e) => setImportForm({ ...importForm, content: e.target.value })}
                placeholder="Enter the clinical note content..."
                rows={8}
                data-testid="textarea-note-content"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={importForm.tags}
                onChange={(e) => setImportForm({ ...importForm, tags: e.target.value })}
                placeholder="cardiology, follow-up, urgent"
                data-testid="input-note-tags"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setImportDialogOpen(false);
              resetImportForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport}
              disabled={!importForm.title || !importForm.content || importNoteMutation.isPending}
              data-testid="button-save-note"
            >
              {importNoteMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <>
                  <FileCheck className="w-4 h-4 mr-2" />
                  Save Note
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedNote && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = getNoteTypeIcon(selectedNote.noteType);
                        return <IconComponent className="w-5 h-5" />;
                      })()}
                      {selectedNote.title}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedNote.noteType.replace(/_/g, " ")} from {new Date(selectedNote.dateOfService).toLocaleDateString()}
                    </DialogDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedNote.isVerified ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedNote.author && (
                    <div>
                      <p className="text-muted-foreground">Author</p>
                      <p className="font-medium">{selectedNote.author}</p>
                    </div>
                  )}
                  {selectedNote.facility && (
                    <div>
                      <p className="text-muted-foreground">Facility</p>
                      <p className="font-medium">{selectedNote.facility}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Imported</p>
                    <p className="font-medium">{new Date(selectedNote.importedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Source Format</p>
                    <p className="font-medium uppercase">{selectedNote.sourceFormat}</p>
                  </div>
                </div>

                {selectedNote.tags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-2 flex-wrap">
                      {selectedNote.tags.map(tag => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Content</p>
                  <div className="bg-muted/50 p-4 rounded-lg text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedNote.content}
                  </div>
                </div>
              </div>
                {/* AI Summary Section */}
                <ClinicalNoteSummary
                  noteId={selectedNote.id}
                  noteContent={selectedNote.content}
                  noteType={selectedNote.noteType}
                  author={selectedNote.author}
                  facility={selectedNote.facility}
                  dateOfService={selectedNote.dateOfService}
                />

              <DialogFooter>
                <Button 
                  variant="destructive" 
                  onClick={() => deleteNoteMutation.mutate(selectedNote.id)}
                  disabled={deleteNoteMutation.isPending}
                  data-testid="button-delete-note"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
                {!selectedNote.isVerified && (
                  <Button 
                    onClick={() => verifyNoteMutation.mutate(selectedNote.id)}
                    disabled={verifyNoteMutation.isPending}
                    data-testid="button-verify-note"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Verify Note
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
