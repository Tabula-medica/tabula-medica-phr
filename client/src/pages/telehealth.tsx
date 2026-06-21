import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Video, VideoOff, Mic, MicOff, PhoneOff, 
  Calendar, Clock, FileText, 
  Plus, Loader2, Sparkles,
  Settings, Users, Activity, Pill, AlertTriangle, ChevronRight,
  CalendarDays, Share2, MessageSquare, Send, Eye, Paperclip, ChevronLeft, ChevronDown,
  ClipboardList, CheckCircle, Mail, Bell
} from "lucide-react";
import type { VideoAppointment, VideoSession, VideoPatientContext, VideoCallStatus } from "@shared/schema";

interface SessionNote {
  id: string;
  sessionId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  noteType: "observation" | "question" | "action_item" | "follow_up" | "general";
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharedDocument {
  id: string;
  sessionId: string;
  sharedById: string;
  sharedByName: string;
  documentId: string;
  documentName: string;
  documentType: string;
  documentUrl?: string;
  description?: string;
  accessibleToPatient: boolean;
  viewedByPatient: boolean;
  viewedAt?: string;
  createdAt: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  status: string;
  clinicianName: string;
  reason: string;
  duration: number;
  roomId: string;
}

interface SessionSummary {
  id: string;
  sessionId: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  visitDate: string;
  duration: number;
  chiefComplaint: string;
  diagnosisDiscussed: string[];
  treatmentPlan: string;
  medicationChanges: string[];
  followUpInstructions: string[];
  nextSteps: string[];
  patientQuestions: string[];
  additionalNotes: string;
  sentToPatient: boolean;
  sentAt?: string;
  patientViewed: boolean;
  patientViewedAt?: string;
  noCdsDisclaimer: string;
  createdAt: string;
  updatedAt: string;
}

export default function TelehealthPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("appointments");
  const [selectedAppointment, setSelectedAppointment] = useState<VideoAppointment | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [activeSession, setActiveSession] = useState<VideoSession | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<"week" | "month">("week");

  // In-call collaboration state
  const [activeSidePanel, setActiveSidePanel] = useState<"context" | "notes" | "documents">("context");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState<SessionNote["noteType"]>("general");
  const [isNoteShared, setIsNoteShared] = useState(false);
  const [shareDocumentOpen, setShareDocumentOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [newDocType, setNewDocType] = useState("lab_result");
  const [newDocDescription, setNewDocDescription] = useState("");

  // Summaries state
  const [selectedSummarySession, setSelectedSummarySession] = useState<string | null>(null);

  const [scheduleForm, setScheduleForm] = useState({
    patientName: "",
    clinicianName: "Dr. Sarah Johnson",
    scheduledStartTime: "",
    duration: 30,
    reason: "",
    notes: "",
  });

  const { data: appointments = [], isLoading: appointmentsLoading } = useQuery<VideoAppointment[]>({
    queryKey: ["/api/telehealth/appointments"],
  });

  const { data: patientContext } = useQuery<VideoPatientContext>({
    queryKey: ["/api/telehealth/patient-context", selectedAppointment?.patientId],
    enabled: !!selectedAppointment?.patientId,
  });

  // Calendar query
  const getCalendarDates = () => {
    const start = new Date(calendarDate);
    if (calendarView === "week") {
      start.setDate(start.getDate() - start.getDay());
    } else {
      start.setDate(1);
    }
    const end = new Date(start);
    if (calendarView === "week") {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const { data: calendarData } = useQuery<{ events: CalendarEvent[]; startDate: string; endDate: string }>({
    queryKey: ["/api/telehealth/calendar", calendarDate.toISOString(), calendarView],
    queryFn: async () => {
      const { startDate, endDate } = getCalendarDates();
      const res = await fetch(`/api/telehealth/calendar?startDate=${startDate}&endDate=${endDate}&view=${calendarView}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch calendar: ${res.statusText}`);
      }
      return res.json();
    },
  });

  // Session notes query
  const { data: sessionNotes = [], refetch: refetchNotes } = useQuery<SessionNote[]>({
    queryKey: ["/api/telehealth/sessions", activeSession?.id, "notes"],
    queryFn: async () => {
      if (!activeSession?.id) return [];
      const res = await fetch(`/api/telehealth/sessions/${activeSession.id}/notes`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch notes: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!activeSession?.id,
    refetchInterval: 5000,
  });

  // Shared documents query
  const { data: sharedDocuments = [], refetch: refetchDocs } = useQuery<SharedDocument[]>({
    queryKey: ["/api/telehealth/sessions", activeSession?.id, "documents"],
    queryFn: async () => {
      if (!activeSession?.id) return [];
      const res = await fetch(`/api/telehealth/sessions/${activeSession.id}/documents`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch documents: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!activeSession?.id,
    refetchInterval: 5000,
  });

  // Session summary query
  const { data: sessionSummary, refetch: refetchSummary, isLoading: summaryLoading } = useQuery<SessionSummary | null>({
    queryKey: ["/api/telehealth/sessions", selectedSummarySession, "summary"],
    queryFn: async () => {
      if (!selectedSummarySession) return null;
      const res = await fetch(`/api/telehealth/sessions/${selectedSummarySession}/summary`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Failed to fetch summary: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!selectedSummarySession,
  });

  const generateAISummaryMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("POST", `/api/telehealth/sessions/${sessionId}/summary/generate`, {});
      return res.json();
    },
    onSuccess: () => {
      refetchSummary();
      toast({ title: "AI Summary Generated", description: "The post-visit summary has been generated using AI with NO-CDS compliance." });
    },
    onError: () => {
      toast({ title: "Generation Failed", description: "Could not generate AI summary. Please try again.", variant: "destructive" });
    },
  });

  const sendSummaryMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/telehealth/sessions/${sessionId}/summary/send`, {});
    },
    onSuccess: () => {
      refetchSummary();
      toast({ title: "Summary Sent", description: "The post-visit summary has been sent to the patient." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send summary to patient", variant: "destructive" });
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: typeof scheduleForm) => {
      const startTime = new Date(data.scheduledStartTime);
      const endTime = new Date(startTime.getTime() + data.duration * 60000);
      return apiRequest("POST", "/api/telehealth/appointments", {
        patientId: `patient-${Date.now()}`,
        clinicianId: "clinician-001",
        patientName: data.patientName,
        clinicianName: data.clinicianName,
        scheduledStartTime: startTime.toISOString(),
        scheduledEndTime: endTime.toISOString(),
        duration: data.duration,
        reason: data.reason,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/appointments"] });
      setIsScheduleOpen(false);
      setScheduleForm({ patientName: "", clinicianName: "Dr. Sarah Johnson", scheduledStartTime: "", duration: 30, reason: "", notes: "" });
      toast({ title: "Appointment scheduled", description: "Video consultation has been scheduled successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to schedule appointment", variant: "destructive" });
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      return apiRequest("POST", "/api/telehealth/sessions/start", { appointmentId });
    },
    onSuccess: async (response) => {
      const session = await response.json();
      setActiveSession(session);
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/appointments"] });
      toast({ title: "Call started", description: "Joining the video consultation room..." });
      setLocation(`/telehealth/clinician/${session.roomId}`);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to start call", variant: "destructive" });
    },
  });

  const endSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/telehealth/sessions/${sessionId}/end`, {});
    },
    onSuccess: () => {
      stopLocalVideo();
      setIsInCall(false);
      setActiveSession(null);
      setSelectedAppointment(null);
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/appointments"] });
      toast({ title: "Call ended", description: "Video consultation has ended." });
    },
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (data: { content: string; noteType: string; isShared: boolean }) => {
      if (!activeSession?.id) throw new Error("No active session");
      return apiRequest("POST", `/api/telehealth/sessions/${activeSession.id}/notes`, {
        authorId: "current-user",
        authorName: "Provider",
        authorRole: "provider",
        ...data,
      });
    },
    onSuccess: () => {
      refetchNotes();
      setNewNoteContent("");
      toast({ title: "Note added", description: "Your note has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add note", variant: "destructive" });
    },
  });

  // Share document mutation
  const shareDocumentMutation = useMutation({
    mutationFn: async (data: { documentName: string; documentType: string; description?: string }) => {
      if (!activeSession?.id) throw new Error("No active session");
      return apiRequest("POST", `/api/telehealth/sessions/${activeSession.id}/documents`, {
        sharedById: "current-user",
        sharedByName: "Provider",
        ...data,
        accessibleToPatient: true,
      });
    },
    onSuccess: () => {
      refetchDocs();
      setShareDocumentOpen(false);
      setNewDocName("");
      setNewDocDescription("");
      toast({ title: "Document shared", description: "The document is now visible to the patient." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to share document", variant: "destructive" });
    },
  });

  const handleAddNote = () => {
    if (newNoteContent.trim()) {
      createNoteMutation.mutate({
        content: newNoteContent.trim(),
        noteType: newNoteType,
        isShared: isNoteShared,
      });
    }
  };

  const handleShareDocument = () => {
    if (newDocName.trim()) {
      shareDocumentMutation.mutate({
        documentName: newDocName.trim(),
        documentType: newDocType,
        description: newDocDescription.trim() || undefined,
      });
    }
  };

  const startLocalVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Failed to access camera/microphone:", error);
      toast({ title: "Camera access denied", description: "Please allow camera and microphone access.", variant: "destructive" });
    }
  };

  const stopLocalVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopLocalVideo();
    };
  }, []);

  const getStatusBadge = (status: VideoCallStatus) => {
    const variants: Record<VideoCallStatus, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      scheduled: { variant: "secondary", label: "Scheduled" },
      waiting: { variant: "outline", label: "Waiting" },
      in_progress: { variant: "default", label: "In Progress" },
      completed: { variant: "secondary", label: "Completed" },
      cancelled: { variant: "destructive", label: "Cancelled" },
      no_show: { variant: "destructive", label: "No Show" },
    };
    const config = variants[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", { 
      weekday: "short", 
      month: "short", 
      day: "numeric", 
      hour: "numeric", 
      minute: "2-digit" 
    });
  };

  if (isInCall && activeSession) {
    return (
      <div className="h-screen flex flex-col bg-black" data-testid="container-video-call">
        <div className="flex-1 flex">
          <div className="flex-1 relative">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover bg-gray-900"
              data-testid="video-remote"
            />
            <div className="absolute top-4 left-4 text-white bg-black/50 px-3 py-1 rounded-lg">
              {selectedAppointment?.clinicianName || "Clinician"}
            </div>

            <div className="absolute bottom-4 right-4 w-48 h-36 rounded-lg overflow-hidden border-2 border-white shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover bg-gray-800"
                data-testid="video-local"
              />
            </div>
          </div>

          <div className="w-96 bg-background border-l flex flex-col">
            <div className="flex border-b">
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 ${activeSidePanel === "context" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setActiveSidePanel("context")}
                data-testid="tab-context"
              >
                <Users className="w-4 h-4" />
                Context
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 ${activeSidePanel === "notes" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setActiveSidePanel("notes")}
                data-testid="tab-notes"
              >
                <MessageSquare className="w-4 h-4" />
                Notes
              </button>
              <button
                className={`flex-1 px-3 py-2 text-sm font-medium flex items-center justify-center gap-1 ${activeSidePanel === "documents" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}
                onClick={() => setActiveSidePanel("documents")}
                data-testid="tab-documents"
              >
                <Share2 className="w-4 h-4" />
                Docs
              </button>
            </div>
            
            <ScrollArea className="flex-1">
              {activeSidePanel === "context" && (
                <>
                  {patientContext ? (
                    <div className="p-4 space-y-4">
                      <div>
                        <h4 className="font-medium text-sm">{patientContext.patientName}</h4>
                        {patientContext.dateOfBirth && (
                          <p className="text-xs text-muted-foreground">DOB: {patientContext.dateOfBirth}</p>
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Activity className="w-3 h-3" /> Conditions
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patientContext.conditions.map((condition, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{condition}</Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <Pill className="w-3 h-3" /> Medications
                        </h4>
                        <ul className="text-sm mt-1 space-y-1">
                          {patientContext.medications.map((med, i) => (
                            <li key={i} className="text-muted-foreground">{med}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Allergies
                        </h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patientContext.allergies.map((allergy, i) => (
                            <Badge key={i} variant="outline" className="text-xs border-destructive text-destructive">{allergy}</Badge>
                          ))}
                        </div>
                      </div>

                      {patientContext.vitalSigns && patientContext.vitalSigns.length > 0 && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent Vitals</h4>
                          <div className="mt-1 space-y-1">
                            {patientContext.vitalSigns.map((vital, i) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{vital.type}</span>
                                <span className="font-medium">{vital.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Recent Visits
                        </h4>
                        <div className="mt-1 space-y-2">
                          {patientContext.recentVisits.slice(0, 3).map((visit, i) => (
                            <div key={i} className="text-sm">
                              <p className="font-medium">{visit.reason}</p>
                              <p className="text-xs text-muted-foreground">{visit.date} - {visit.provider}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading patient context...
                    </div>
                  )}
                </>
              )}

              {activeSidePanel === "notes" && (
                <div className="p-4 space-y-4">
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a note during this consultation..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="min-h-[80px]"
                      data-testid="input-note-content"
                    />
                    <div className="flex flex-wrap gap-2 items-center">
                      <Select value={newNoteType} onValueChange={(v) => setNewNoteType(v as SessionNote["noteType"])}>
                        <SelectTrigger className="w-32" data-testid="select-note-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="observation">Observation</SelectItem>
                          <SelectItem value="question">Question</SelectItem>
                          <SelectItem value="action_item">Action Item</SelectItem>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          checked={isNoteShared}
                          onChange={(e) => setIsNoteShared(e.target.checked)}
                          className="rounded"
                          data-testid="checkbox-share-note"
                        />
                        Share with patient
                      </label>
                      <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!newNoteContent.trim() || createNoteMutation.isPending}
                        data-testid="button-add-note"
                      >
                        {createNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    {sessionNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No notes yet. Add your first note above.
                      </p>
                    ) : (
                      sessionNotes.map((note) => (
                        <div key={note.id} className="p-3 rounded-lg border bg-card" data-testid={`note-${note.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs capitalize">
                                {note.noteType.replace("_", " ")}
                              </Badge>
                              {note.isShared && (
                                <Badge variant="secondary" className="text-xs">
                                  <Eye className="w-3 h-3 mr-1" /> Shared
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {note.authorName} ({note.authorRole})
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeSidePanel === "documents" && (
                <div className="p-4 space-y-4">
                  <Dialog open={shareDocumentOpen} onOpenChange={setShareDocumentOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" data-testid="button-share-document">
                        <Paperclip className="w-4 h-4 mr-2" />
                        Share Document
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Share Document with Patient</DialogTitle>
                        <DialogDescription>
                          Share a document during this consultation. The patient will be able to view it in real-time.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Document Name</Label>
                          <Input
                            placeholder="e.g., Lab Results - CBC"
                            value={newDocName}
                            onChange={(e) => setNewDocName(e.target.value)}
                            data-testid="input-doc-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Document Type</Label>
                          <Select value={newDocType} onValueChange={setNewDocType}>
                            <SelectTrigger data-testid="select-doc-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="lab_result">Lab Result</SelectItem>
                              <SelectItem value="imaging">Imaging Report</SelectItem>
                              <SelectItem value="prescription">Prescription</SelectItem>
                              <SelectItem value="referral">Referral</SelectItem>
                              <SelectItem value="care_plan">Care Plan</SelectItem>
                              <SelectItem value="education">Patient Education</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Description (Optional)</Label>
                          <Textarea
                            placeholder="Brief description of the document..."
                            value={newDocDescription}
                            onChange={(e) => setNewDocDescription(e.target.value)}
                            data-testid="input-doc-description"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShareDocumentOpen(false)}>Cancel</Button>
                        <Button
                          onClick={handleShareDocument}
                          disabled={!newDocName.trim() || shareDocumentMutation.isPending}
                          data-testid="button-confirm-share"
                        >
                          {shareDocumentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Share Document
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Separator />

                  <div className="space-y-3">
                    {sharedDocuments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No documents shared yet. Share a document above.
                      </p>
                    ) : (
                      sharedDocuments.map((doc) => (
                        <div key={doc.id} className="p-3 rounded-lg border bg-card" data-testid={`doc-${doc.id}`}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary" />
                              <span className="font-medium text-sm">{doc.documentName}</span>
                            </div>
                            {doc.viewedByPatient ? (
                              <Badge variant="secondary" className="text-xs">
                                <Eye className="w-3 h-3 mr-1" /> Viewed
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">Pending</Badge>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs capitalize mb-1">
                            {doc.documentType.replace("_", " ")}
                          </Badge>
                          {doc.description && (
                            <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Shared by {doc.sharedByName} at {new Date(doc.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <div className="h-20 bg-gray-900 flex items-center justify-center gap-4">
          <Button
            variant={audioEnabled ? "secondary" : "destructive"}
            size="lg"
            className="rounded-full aspect-square p-0 min-w-12"
            onClick={toggleAudio}
            data-testid="button-toggle-audio"
          >
            {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>

          <Button
            variant={videoEnabled ? "secondary" : "destructive"}
            size="lg"
            className="rounded-full aspect-square p-0 min-w-12"
            onClick={toggleVideo}
            data-testid="button-toggle-video"
          >
            {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </Button>

          <Button
            variant="destructive"
            size="lg"
            className="rounded-full aspect-square p-0 min-w-14"
            onClick={() => activeSession && endSessionMutation.mutate(activeSession.id)}
            data-testid="button-end-call"
          >
            <PhoneOff className="w-6 h-6" />
          </Button>

          <Button
            variant="secondary"
            size="lg"
            className="rounded-full aspect-square p-0 min-w-12"
            data-testid="button-call-settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Video className="w-6 h-6" />
            Telehealth
          </h1>
          <p className="text-muted-foreground">Secure video consultations with your healthcare providers</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setLocation("/telehealth/reminders")} data-testid="button-reminders-settings">
            <Bell className="w-4 h-4 mr-2" />
            Reminders
          </Button>
          <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-schedule-appointment">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Consultation
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Video Consultation</DialogTitle>
              <DialogDescription>Book a telehealth appointment with your provider</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Patient Name</Label>
                <Input
                  value={scheduleForm.patientName}
                  onChange={(e) => setScheduleForm(p => ({ ...p, patientName: e.target.value }))}
                  placeholder="Enter patient name"
                  data-testid="input-patient-name"
                />
              </div>
              <div>
                <Label>Provider</Label>
                <Select
                  value={scheduleForm.clinicianName}
                  onValueChange={(v) => setScheduleForm(p => ({ ...p, clinicianName: v }))}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr. Sarah Johnson">Dr. Sarah Johnson</SelectItem>
                    <SelectItem value="Dr. Michael Chen">Dr. Michael Chen</SelectItem>
                    <SelectItem value="Dr. Emily Williams">Dr. Emily Williams</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date & Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduleForm.scheduledStartTime}
                  onChange={(e) => setScheduleForm(p => ({ ...p, scheduledStartTime: e.target.value }))}
                  data-testid="input-datetime"
                />
              </div>
              <div>
                <Label>Duration</Label>
                <Select
                  value={String(scheduleForm.duration)}
                  onValueChange={(v) => setScheduleForm(p => ({ ...p, duration: Number(v) }))}
                >
                  <SelectTrigger data-testid="select-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reason for Visit</Label>
                <Input
                  value={scheduleForm.reason}
                  onChange={(e) => setScheduleForm(p => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g., Follow-up, New symptoms"
                  data-testid="input-reason"
                />
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any additional information"
                  data-testid="input-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createAppointmentMutation.mutate(scheduleForm)}
                disabled={createAppointmentMutation.isPending || !scheduleForm.patientName || !scheduleForm.scheduledStartTime || !scheduleForm.reason}
                data-testid="button-confirm-schedule"
              >
                {createAppointmentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="w-4 h-4 mr-2" />
            Appointments
          </TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarDays className="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Clock className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="summaries" data-testid="tab-summaries">
            <ClipboardList className="w-4 h-4 mr-2" />
            Summaries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">
          {appointmentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : appointments.filter(a => a.status === "scheduled" || a.status === "waiting").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Video className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No upcoming appointments</h3>
                <p className="text-muted-foreground mb-4">Schedule a video consultation to get started</p>
                <Button onClick={() => setIsScheduleOpen(true)} data-testid="button-schedule-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Consultation
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {appointments
                .filter(a => a.status === "scheduled" || a.status === "waiting")
                .map((appointment) => (
                  <Card key={appointment.id} className="hover-elevate" data-testid={`card-appointment-${appointment.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg">{appointment.patientName}</CardTitle>
                          <CardDescription>{appointment.reason}</CardDescription>
                        </div>
                        {getStatusBadge(appointment.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {formatDateTime(appointment.scheduledStartTime)}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          {appointment.duration} minutes
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Users className="w-4 h-4" />
                          {appointment.clinicianName}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          setSelectedAppointment(appointment);
                          startSessionMutation.mutate(appointment.id);
                        }}
                        disabled={startSessionMutation.isPending}
                        data-testid={`button-join-${appointment.id}`}
                      >
                        {startSessionMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Video className="w-4 h-4 mr-2" />
                        )}
                        Join Call
                      </Button>
                      <Button variant="outline" size="icon" data-testid={`button-details-${appointment.id}`}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5" />
                  Appointment Calendar
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select value={calendarView} onValueChange={(v) => setCalendarView(v as "week" | "month")}>
                    <SelectTrigger className="w-28" data-testid="select-calendar-view">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      if (calendarView === "week") {
                        newDate.setDate(newDate.getDate() - 7);
                      } else {
                        newDate.setMonth(newDate.getMonth() - 1);
                      }
                      setCalendarDate(newDate);
                    }}
                    data-testid="button-calendar-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCalendarDate(new Date())}
                    data-testid="button-calendar-today"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const newDate = new Date(calendarDate);
                      if (calendarView === "week") {
                        newDate.setDate(newDate.getDate() + 7);
                      } else {
                        newDate.setMonth(newDate.getMonth() + 1);
                      }
                      setCalendarDate(newDate);
                    }}
                    data-testid="button-calendar-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                {calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {calendarView === "week" ? (
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 7 }).map((_, dayIndex) => {
                    const weekStart = new Date(calendarDate);
                    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + dayIndex);
                    const dayEvents = (calendarData?.events || []).filter((event) => {
                      const eventDate = new Date(event.start);
                      return eventDate.toDateString() === weekStart.toDateString();
                    });
                    const isToday = weekStart.toDateString() === new Date().toDateString();

                    return (
                      <div key={dayIndex} className="min-h-[150px]">
                        <div
                          className={`text-center py-2 rounded-t-lg font-medium text-sm ${
                            isToday ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p>{weekStart.toLocaleDateString("en-US", { weekday: "short" })}</p>
                          <p className="text-lg">{weekStart.getDate()}</p>
                        </div>
                        <div className="border border-t-0 rounded-b-lg p-1 space-y-1 min-h-[100px]">
                          {dayEvents.map((event) => (
                            <div
                              key={event.id}
                              className={`p-1 rounded text-xs cursor-pointer hover-elevate ${
                                event.status === "completed"
                                  ? "bg-secondary text-secondary-foreground"
                                  : event.status === "in_progress"
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-accent text-accent-foreground"
                              }`}
                              onClick={() => {
                                const apt = appointments.find((a) => a.id === event.id);
                                if (apt) setSelectedAppointment(apt);
                              }}
                              data-testid={`calendar-event-${event.id}`}
                            >
                              <p className="font-medium truncate">{event.title}</p>
                              <p className="truncate">
                                {new Date(event.start).toLocaleTimeString("en-US", {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const monthStart = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
                      const monthEnd = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
                      const startDay = monthStart.getDay();
                      const totalDays = monthEnd.getDate();
                      const cells = [];

                      for (let i = 0; i < startDay; i++) {
                        cells.push(<div key={`empty-${i}`} className="min-h-[80px]" />);
                      }

                      for (let day = 1; day <= totalDays; day++) {
                        const cellDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
                        const dayEvents = (calendarData?.events || []).filter((event) => {
                          const eventDate = new Date(event.start);
                          return eventDate.toDateString() === cellDate.toDateString();
                        });
                        const isToday = cellDate.toDateString() === new Date().toDateString();

                        cells.push(
                          <div
                            key={day}
                            className={`min-h-[80px] border rounded-lg p-1 ${isToday ? "border-primary" : ""}`}
                          >
                            <p
                              className={`text-sm font-medium text-center mb-1 ${
                                isToday ? "text-primary" : ""
                              }`}
                            >
                              {day}
                            </p>
                            <div className="space-y-1">
                              {dayEvents.slice(0, 2).map((event) => (
                                <div
                                  key={event.id}
                                  className="text-xs p-1 rounded bg-accent truncate cursor-pointer hover-elevate"
                                  onClick={() => {
                                    const apt = appointments.find((a) => a.id === event.id);
                                    if (apt) setSelectedAppointment(apt);
                                  }}
                                  data-testid={`calendar-event-${event.id}`}
                                >
                                  {event.title}
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <p className="text-xs text-muted-foreground text-center">
                                  +{dayEvents.length - 2} more
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return cells;
                    })()}
                  </div>
                </div>
              )}

              {(calendarData?.events || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No appointments scheduled for this period</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          {appointments.filter(a => a.status === "completed" || a.status === "cancelled" || a.status === "no_show").length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="font-medium mb-2">No past appointments</h3>
                <p className="text-muted-foreground">Your consultation history will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {appointments
                .filter(a => a.status === "completed" || a.status === "cancelled" || a.status === "no_show")
                .map((appointment) => (
                  <Card key={appointment.id} data-testid={`card-history-${appointment.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{appointment.patientName}</h4>
                          <p className="text-sm text-muted-foreground">{appointment.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDateTime(appointment.scheduledStartTime)} - {appointment.duration} min
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(appointment.status)}
                          <Button variant="outline" size="sm" data-testid={`button-view-${appointment.id}`}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summaries">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Completed Sessions
                </CardTitle>
                <CardDescription>Select a session to view or send its summary</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {appointments.filter(a => a.status === "completed").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No completed sessions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {appointments
                        .filter(a => a.status === "completed")
                        .map((apt) => (
                          <div
                            key={apt.id}
                            className={`w-full p-3 rounded-md cursor-pointer text-left hover-elevate ${
                              selectedSummarySession === apt.id 
                                ? "bg-primary text-primary-foreground" 
                                : "border"
                            }`}
                            onClick={() => setSelectedSummarySession(apt.id)}
                            data-testid={`button-summary-${apt.id}`}
                          >
                            <p className="font-medium">{apt.patientName}</p>
                            <p className="text-xs opacity-70">{formatDateTime(apt.scheduledStartTime)}</p>
                            <p className="text-xs opacity-70">{apt.reason}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Post-Visit Summary
                    </CardTitle>
                    <CardDescription>
                      {sessionSummary ? `Visit on ${formatDateTime(sessionSummary.visitDate)}` : "Select a completed session to view summary"}
                    </CardDescription>
                  </div>
                  {selectedSummarySession && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => generateAISummaryMutation.mutate(selectedSummarySession)}
                        disabled={generateAISummaryMutation.isPending}
                        data-testid="button-generate-ai-summary"
                      >
                        {generateAISummaryMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        {generateAISummaryMutation.isPending ? "Generating..." : sessionSummary ? "Regenerate AI Summary" : "Generate AI Summary"}
                      </Button>
                      {sessionSummary && (
                        <>
                          {sessionSummary.sentToPatient ? (
                            <Badge variant="default" className="flex items-center gap-1" data-testid="badge-sent">
                              <CheckCircle className="w-3 h-3" />
                              Sent to Patient
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => sendSummaryMutation.mutate(selectedSummarySession)}
                              disabled={sendSummaryMutation.isPending}
                              data-testid="button-send-summary"
                            >
                              {sendSummaryMutation.isPending ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <Mail className="w-4 h-4 mr-2" />
                              )}
                              Send to Patient
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!selectedSummarySession ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="font-medium mb-2">No Session Selected</h3>
                    <p>Select a completed session from the list to view its summary</p>
                  </div>
                ) : summaryLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : !sessionSummary ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="font-medium mb-2">No Summary Yet</h3>
                    <p className="mb-4">Generate an AI-powered post-visit summary for this session</p>
                    <Button
                      onClick={() => generateAISummaryMutation.mutate(selectedSummarySession!)}
                      disabled={generateAISummaryMutation.isPending}
                      data-testid="button-generate-ai-summary-empty"
                    >
                      {generateAISummaryMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {generateAISummaryMutation.isPending ? "Generating AI Summary..." : "Generate AI Summary"}
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-medium text-sm text-muted-foreground">Patient</h4>
                          {(sessionSummary as any).aiGenerated && (
                            <Badge variant="secondary" className="text-xs" data-testid="badge-ai-generated">
                              <Sparkles className="w-3 h-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium">{sessionSummary.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          Provider: {sessionSummary.providerName} | Duration: {Math.round(sessionSummary.duration / 60)} min
                        </p>
                      </div>

                      <Separator />

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Chief Complaint</h4>
                        <p>{sessionSummary.chiefComplaint}</p>
                      </div>

                      {sessionSummary.diagnosisDiscussed.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Diagnoses Discussed</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {sessionSummary.diagnosisDiscussed.map((d, i) => (
                              <li key={i}>{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sessionSummary.treatmentPlan && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Treatment Plan</h4>
                          <p>{sessionSummary.treatmentPlan}</p>
                        </div>
                      )}

                      {sessionSummary.medicationChanges.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Medication Changes</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {sessionSummary.medicationChanges.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Follow-Up Instructions</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {sessionSummary.followUpInstructions.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-medium text-sm text-muted-foreground mb-1">Next Steps</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {sessionSummary.nextSteps.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      </div>

                      {sessionSummary.patientQuestions.length > 0 && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Patient Questions</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {sessionSummary.patientQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sessionSummary.additionalNotes && (
                        <div>
                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Additional Notes</h4>
                          <p className="whitespace-pre-wrap">{sessionSummary.additionalNotes}</p>
                        </div>
                      )}

                      <Separator />

                      <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Important Notice</p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              {sessionSummary.noCdsDisclaimer}
                            </p>
                          </div>
                        </div>
                      </div>

                      {sessionSummary.sentToPatient && sessionSummary.patientViewed && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Eye className="w-4 h-4" />
                          Patient viewed on {formatDateTime(sessionSummary.patientViewedAt!)}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
