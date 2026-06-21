import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Loader2,
  Clock,
  User,
  Tag,
  Lock,
  Edit,
  Trash2,
  FileEdit,
  Clipboard,
  Phone,
  Pill,
  Users,
  BookOpen,
  Stethoscope,
  ClipboardList,
  Target,
  MessageSquare,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type NoteType = 
  | "progress_note"
  | "assessment"
  | "plan"
  | "subjective"
  | "objective"
  | "follow_up"
  | "phone_call"
  | "medication_review"
  | "care_coordination"
  | "patient_education";

interface ClinicalNote {
  id: number;
  patientId: string;
  clinicianId: string;
  clinicianName: string;
  noteType: NoteType;
  content: string;
  tags: string[];
  isPrivate: boolean;
  appointmentId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface NoteTemplate {
  label: string;
  template: string;
}

const NOTE_TYPE_CONFIG: Record<NoteType, { icon: typeof FileText; label: string; color: string }> = {
  progress_note: { icon: FileEdit, label: "Progress Note", color: "text-blue-500" },
  assessment: { icon: Stethoscope, label: "Assessment", color: "text-purple-500" },
  plan: { icon: Target, label: "Plan", color: "text-green-500" },
  subjective: { icon: MessageSquare, label: "Subjective", color: "text-orange-500" },
  objective: { icon: ClipboardList, label: "Objective", color: "text-cyan-500" },
  follow_up: { icon: Clock, label: "Follow-up", color: "text-yellow-500" },
  phone_call: { icon: Phone, label: "Phone Call", color: "text-pink-500" },
  medication_review: { icon: Pill, label: "Med Review", color: "text-red-500" },
  care_coordination: { icon: Users, label: "Care Coordination", color: "text-indigo-500" },
  patient_education: { icon: BookOpen, label: "Education", color: "text-teal-500" },
};

interface NoteItemProps {
  note: ClinicalNote;
  onEdit: (note: ClinicalNote) => void;
  onDelete: (noteId: number) => void;
}

function NoteItem({ note, onEdit, onDelete }: NoteItemProps) {
  const config = NOTE_TYPE_CONFIG[note.noteType];
  const NoteIcon = config.icon;

  return (
    <div className="border rounded-lg p-4 space-y-3 hover-elevate" data-testid={`note-item-${note.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
            <NoteIcon className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {config.label}
              {note.isPrivate && (
                <Badge variant="outline" className="text-xs">
                  <Lock className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <User className="h-3 w-3" />
              {note.clinicianName}
              <span>•</span>
              <Clock className="h-3 w-3" />
              {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(note)}
            data-testid={`button-edit-note-${note.id}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(note.id)}
            data-testid={`button-delete-note-${note.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
        {note.content.length > 200 ? `${note.content.substring(0, 200)}...` : note.content}
      </p>

      {note.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {note.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              <Tag className="h-3 w-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

interface ClinicalNotesCardProps {
  patientId: string;
}

export function ClinicalNotesCard({ patientId }: ClinicalNotesCardProps) {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ClinicalNote | null>(null);
  const [noteType, setNoteType] = useState<NoteType>("progress_note");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [activeFilter, setActiveFilter] = useState<NoteType | "all">("all");

  const { data: notes, isLoading } = useQuery<ClinicalNote[]>({
    queryKey: ["/api/clinical-notes", patientId],
    enabled: !!patientId,
  });

  const { data: templates } = useQuery<Record<NoteType, NoteTemplate>>({
    queryKey: ["/api/clinical-notes/templates"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { patientId: string; noteType: NoteType; content: string; tags: string[]; isPrivate: boolean }) => {
      const result = await apiRequest("POST", "/api/clinical-notes", data);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", patientId] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Note created", description: "Clinical note has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create note.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ noteId, data }: { noteId: number; data: { content?: string; tags?: string[]; isPrivate?: boolean } }) => {
      const result = await apiRequest("PATCH", `/api/clinical-notes/${noteId}`, data);
      return result.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", patientId] });
      setEditingNote(null);
      resetForm();
      toast({ title: "Note updated", description: "Clinical note has been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update note.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      await apiRequest("DELETE", `/api/clinical-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinical-notes", patientId] });
      toast({ title: "Note deleted", description: "Clinical note has been removed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setNoteType("progress_note");
    setContent("");
    setTags("");
    setIsPrivate(false);
  };

  const handleCreate = () => {
    createMutation.mutate({
      patientId,
      noteType,
      content,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      isPrivate,
    });
  };

  const handleUpdate = () => {
    if (!editingNote) return;
    updateMutation.mutate({
      noteId: editingNote.id,
      data: {
        content,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        isPrivate,
      },
    });
  };

  const handleEdit = (note: ClinicalNote) => {
    setEditingNote(note);
    setNoteType(note.noteType);
    setContent(note.content);
    setTags(note.tags.join(", "));
    setIsPrivate(note.isPrivate);
  };

  const handleUseTemplate = () => {
    if (templates && templates[noteType]) {
      setContent(templates[noteType].template);
    }
  };

  const filteredNotes = notes?.filter(n => 
    activeFilter === "all" || n.noteType === activeFilter
  ) || [];

  if (isLoading) {
    return (
      <Card data-testid="card-clinical-notes">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-clinical-notes">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clipboard className="h-5 w-5 text-primary" />
              Clinical Notes
            </CardTitle>
            <CardDescription>
              Quick note logging for patient summary
            </CardDescription>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-note">
                <Plus className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Clinical Note</DialogTitle>
                <DialogDescription>
                  Create a new clinical note for this patient
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Note Type</Label>
                  <Select value={noteType} onValueChange={(v) => setNoteType(v as NoteType)}>
                    <SelectTrigger data-testid="select-note-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NOTE_TYPE_CONFIG).map(([type, config]) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <config.icon className={`h-4 w-4 ${config.color}`} />
                            {config.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Content</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleUseTemplate}
                      data-testid="button-use-template"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter clinical note content..."
                    rows={8}
                    data-testid="textarea-note-content"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g., follow-up, urgent, labs"
                    data-testid="input-note-tags"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="private-toggle">Private Note</Label>
                  <Switch
                    id="private-toggle"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                    data-testid="switch-note-private"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!content.trim() || createMutation.isPending}
                  data-testid="button-save-note"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Save Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filter Tabs */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <Button
              variant={activeFilter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveFilter("all")}
              data-testid="filter-all"
            >
              All ({notes?.length || 0})
            </Button>
            {Object.entries(NOTE_TYPE_CONFIG).slice(0, 5).map(([type, config]) => {
              const count = notes?.filter(n => n.noteType === type).length || 0;
              if (count === 0) return null;
              return (
                <Button
                  key={type}
                  variant={activeFilter === type ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setActiveFilter(type as NoteType)}
                  data-testid={`filter-${type}`}
                >
                  <config.icon className={`h-3 w-3 mr-1 ${config.color}`} />
                  {count}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Notes List */}
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clipboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No clinical notes yet.</p>
            <p className="text-sm">Add your first note to get started.</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {filteredNotes.map((note) => (
                <NoteItem
                  key={note.id}
                  note={note}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Clinical Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                data-testid="textarea-edit-content"
              />
            </div>

            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                data-testid="input-edit-tags"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="edit-private-toggle">Private Note</Label>
              <Switch
                id="edit-private-toggle"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
                data-testid="switch-edit-private"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingNote(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!content.trim() || updateMutation.isPending}
              data-testid="button-update-note"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Update Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
