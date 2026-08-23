import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Monitor, Users, MessageSquare, Settings,
  ArrowLeft, Send, Loader2, CameraOff,
  FileText, Save, CheckCircle, Plus, Trash2,
  AlertTriangle, Lock, Circle, Square, Shield
} from "lucide-react";
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage
} from "@/lib/chat-encryption";
import type { TelehealthSession, ConsultationNote, Diagnosis, TelehealthPrescription } from "@shared/schema";

interface DecryptedChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  encrypted: boolean;
  timestamp: string;
}

export default function ClinicianVideoRoomPage() {
  const params = useParams<{ roomId: string; patientId?: string }>();
  const roomId = params.roomId;
  const patientId = params.patientId || "default-patient";
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<DecryptedChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [showNotes, setShowNotes] = useState(true);
  const [participants, setParticipants] = useState<string[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [encryptionReady, setEncryptionReady] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [consentReceived, setConsentReceived] = useState(false);
  const [awaitingConsent, setAwaitingConsent] = useState(false);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);

  const [noteData, setNoteData] = useState({
    chiefComplaint: "",
    historyOfPresentIllness: "",
    physicalExamFindings: "",
    assessment: "",
    plan: "",
    followUpInstructions: "",
    followUpDate: "",
  });

  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [prescriptions, setPrescriptions] = useState<TelehealthPrescription[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery<TelehealthSession>({
    queryKey: ["/api/telehealth/rooms", roomId],
  });

  const { data: existingNote } = useQuery<ConsultationNote>({
    queryKey: ["/api/telehealth/sessions", session?.id, "note"],
    enabled: !!session?.id,
  });

  useEffect(() => {
    if (existingNote) {
      setNoteData({
        chiefComplaint: existingNote.chiefComplaint || "",
        historyOfPresentIllness: existingNote.historyOfPresentIllness || "",
        physicalExamFindings: existingNote.physicalExamFindings || "",
        assessment: existingNote.assessment || "",
        plan: existingNote.plan || "",
        followUpInstructions: existingNote.followUpInstructions || "",
        followUpDate: existingNote.followUpDate || "",
      });
      setDiagnoses(existingNote.diagnoses || []);
      setPrescriptions(existingNote.prescriptions || []);
    }
  }, [existingNote]);

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: Partial<TelehealthSession>) => {
      if (!session) return;
      const response = await apiRequest("PATCH", `/api/telehealth/sessions/${session.id}`, updates);
      if (!response.ok) throw new Error("Failed to update session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/rooms", roomId] });
    },
  });

  const saveNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!session) throw new Error("No session");
      const endpoint = existingNote
        ? `/api/telehealth/notes/${existingNote.id}`
        : `/api/telehealth/sessions/${session.id}/note`;
      const method = existingNote ? "PATCH" : "POST";
      const response = await apiRequest(method, endpoint, {
        ...data,
        patientId: session.patientId,
        providerId: "clinician-1",
        providerName: session.providerName || "Dr. Provider",
        diagnoses,
        prescriptions,
      });
      if (!response.ok) throw new Error("Failed to save note");
      return response.json();
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/sessions", session?.id, "note"] });
      toast({ title: "Note Saved", description: "Consultation note has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save note.", variant: "destructive" });
    },
  });

  const signNoteMutation = useMutation({
    mutationFn: async () => {
      if (!existingNote) throw new Error("Save note first");
      const response = await apiRequest("POST", `/api/telehealth/notes/${existingNote.id}/sign`, {
        signedBy: "Dr. Provider",
      });
      if (!response.ok) throw new Error("Failed to sign note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/sessions", session?.id, "note"] });
      toast({ title: "Note Signed", description: "Consultation note has been signed and finalized." });
    },
  });

  const userId = useRef(`clinician-${roomId?.slice(0, 8)}`).current;
  const userName = "Clinician";

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast({
        title: "Camera/Microphone Access",
        description: "Please allow access to your camera and microphone.",
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  const createPeerConnection = useCallback(() => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "ice-candidate",
          candidate: event.candidate,
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setIsConnected(true);
        updateSessionMutation.mutate({ status: "in_progress" });
      }
    };

    return pc;
  }, [updateSessionMutation]);

  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      const kp = await generateKeyPair();
      keyPairRef.current = kp;

      const stream = await initializeMedia();
      if (!stream || !mounted) return;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(JSON.stringify({ type: "join", roomId, userId }));
        const pubKey = await exportPublicKey(kp.publicKey);
        ws.send(JSON.stringify({ type: "key-exchange", publicKey: pubKey }));
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "room-joined":
            setIsRoomJoined(true);
            break;

          case "key-exchange":
            try {
              const remotePub = await importPublicKey(data.publicKey);
              const shared = await deriveSharedKey(kp.privateKey, remotePub, roomId || "default");
              sharedKeyRef.current = shared;
              setEncryptionReady(true);
            } catch (err) {
              console.error("Key exchange failed:", err);
            }
            break;

          case "user-joined":
            setParticipants((prev) => [...prev, data.userId]);
            if (!peerConnectionRef.current) {
              const pc = createPeerConnection();
              peerConnectionRef.current = pc;
              stream.getTracks().forEach((track) => pc.addTrack(track, stream));
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.send(JSON.stringify({ type: "offer", offer }));
            }
            const pubKey = await exportPublicKey(kp.publicKey);
            ws.send(JSON.stringify({ type: "key-exchange", publicKey: pubKey }));
            break;

          case "offer":
            if (!peerConnectionRef.current) {
              const pc = createPeerConnection();
              peerConnectionRef.current = pc;
              stream.getTracks().forEach((track) => pc.addTrack(track, stream));
            }
            await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await peerConnectionRef.current!.createAnswer();
            await peerConnectionRef.current!.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer }));
            break;

          case "answer":
            await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
            break;

          case "ice-candidate":
            await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
            break;

          case "user-left":
            setParticipants((prev) => prev.filter((p) => p !== data.userId));
            break;

          case "encrypted-chat":
            if (data.userId === userId) {
              break;
            }
            if (sharedKeyRef.current) {
              try {
                const plaintext = await decryptMessage(sharedKeyRef.current, data.ciphertext, data.iv);
                setChatMessages((prev) => [...prev, {
                  id: data.id,
                  userId: data.userId,
                  userName: data.userName,
                  content: plaintext,
                  encrypted: true,
                  timestamp: data.timestamp,
                }]);
              } catch (err) {
                console.error("Decryption failed:", err);
              }
            }
            break;

          case "chat":
            if (data.userId !== userId) {
              setChatMessages((prev) => [...prev, {
                id: Date.now().toString(),
                userId: data.userId,
                userName: data.userName,
                content: data.content,
                encrypted: false,
                timestamp: new Date().toISOString(),
              }]);
            }
            break;

          case "screen-share-start":
            setRemoteScreenSharing(true);
            break;

          case "screen-share-stop":
            setRemoteScreenSharing(false);
            break;

          case "recording-consent-response":
            if (data.consent) {
              setConsentReceived(true);
              setAwaitingConsent(false);
              toast({ title: "Consent Received", description: "Patient has consented to recording." });
            } else {
              setAwaitingConsent(false);
              toast({ title: "Consent Denied", description: "Patient declined recording.", variant: "destructive" });
            }
            break;
        }
      };
    };

    setup();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
      wsRef.current?.close();
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [roomId, userId, initializeMedia, createPeerConnection]);

  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (noteData.chiefComplaint || noteData.assessment) {
        saveNoteMutation.mutate(noteData);
      }
    }, 60000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [noteData]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioOn(!isAudioOn);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current && peerConnectionRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video");
        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }
      setIsScreenSharing(false);
      wsRef.current?.send(JSON.stringify({ type: "screen-share-stop" }));
      toast({ title: "Screen Sharing", description: "Screen sharing stopped" });
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: "always" } as MediaTrackConstraints,
          audio: false,
        });
        screenStreamRef.current = screenStream;

        if (peerConnectionRef.current) {
          const screenTrack = screenStream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video");
          if (sender && screenTrack) {
            await sender.replaceTrack(screenTrack);
          }
          screenTrack.onended = async () => {
            if (screenStreamRef.current) {
              screenStreamRef.current.getTracks().forEach((track) => track.stop());
              screenStreamRef.current = null;
            }
            if (localStreamRef.current && peerConnectionRef.current) {
              const videoTrack = localStreamRef.current.getVideoTracks()[0];
              const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === "video");
              if (sender && videoTrack) {
                await sender.replaceTrack(videoTrack);
              }
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = localStreamRef.current;
              }
            }
            setIsScreenSharing(false);
            wsRef.current?.send(JSON.stringify({ type: "screen-share-stop" }));
            toast({ title: "Screen Sharing", description: "Screen sharing stopped" });
          };
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        setIsScreenSharing(true);
        wsRef.current?.send(JSON.stringify({ type: "screen-share-start" }));
        toast({ title: "Screen Sharing", description: "You are now sharing your screen" });
      } catch (error: any) {
        if (error.name !== "NotAllowedError") {
          console.error("Screen sharing error:", error);
          toast({
            title: "Screen Sharing Failed",
            description: "Could not start screen sharing.",
            variant: "destructive"
          });
        }
      }
    }
  };

  const requestRecordingConsent = () => {
    setShowConsentDialog(true);
  };

  const startRecordingFlow = () => {
    setShowConsentDialog(false);
    setAwaitingConsent(true);
    wsRef.current?.send(JSON.stringify({
      type: "recording-consent-request",
      requestedBy: userName,
    }));
    toast({ title: "Consent Requested", description: "Waiting for patient to approve recording..." });
  };

  useEffect(() => {
    if (consentReceived && !isRecording) {
      startRecording();
    }
  }, [consentReceived]);

  const startRecording = async () => {
    try {
      const combinedStream = new MediaStream();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => combinedStream.addTrack(t));
      }
      const remoteStream = remoteVideoRef.current?.srcObject as MediaStream | null;
      if (remoteStream) {
        remoteStream.getTracks().forEach(t => combinedStream.addTrack(t));
      }

      if (combinedStream.getTracks().length === 0) {
        toast({ title: "Error", description: "No media streams available for recording.", variant: "destructive" });
        return;
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
          ? "video/webm;codecs=vp9,opus"
          : "video/webm",
      });

      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        await uploadRecording(blob);
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      const response = await apiRequest("POST", `/api/telehealth/sessions/${session?.id || "unknown"}/recordings`, {
        sessionId: session?.id || "unknown",
        roomId: roomId || "unknown",
        recordedBy: userId,
        consentedBy: [userId, "patient"],
        consentTimestamp: new Date().toISOString(),
        durationSeconds: 0,
        fileSizeBytes: 0,
      });
      if (response.ok) {
        const rec = await response.json();
        setCurrentRecordingId(rec.id);
      }

      wsRef.current?.send(JSON.stringify({ type: "recording-started" }));
      toast({ title: "Recording Started", description: "Session is now being recorded." });
    } catch (error) {
      console.error("Recording error:", error);
      toast({ title: "Recording Failed", description: "Could not start recording.", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setConsentReceived(false);
    wsRef.current?.send(JSON.stringify({ type: "recording-stopped" }));
    toast({ title: "Recording Stopped", description: "Recording has been stopped and is being saved." });
  };

  const uploadRecording = async (blob: Blob) => {
    if (!currentRecordingId) return;
    try {
      const response = await fetch(`/api/telehealth/recordings/${currentRecordingId}/upload`, {
        method: "POST",
        body: blob,
        headers: { "Content-Type": "application/octet-stream" },
      });
      if (response.ok) {
        await apiRequest("PATCH", `/api/telehealth/recordings/${currentRecordingId}`, {
          status: "completed",
          durationSeconds: recordingDuration,
        });
        toast({ title: "Recording Saved", description: "Session recording has been securely stored." });
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Upload Failed", description: "Failed to save recording.", variant: "destructive" });
    }
  };

  const endCall = () => {
    if (isRecording) stopRecording();
    saveNoteMutation.mutate(noteData);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    wsRef.current?.send(JSON.stringify({ type: "leave", userId }));
    wsRef.current?.close();
    updateSessionMutation.mutate({ status: "completed" });
    navigate(`/clinician-dashboard`);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !wsRef.current) return;

    if (!encryptionReady || !sharedKeyRef.current) {
      toast({ title: "Encryption Not Ready", description: "Waiting for secure connection. Please try again in a moment.", variant: "destructive" });
      return;
    }

    const { ciphertext, iv } = await encryptMessage(sharedKeyRef.current, newMessage);
    wsRef.current.send(JSON.stringify({
      type: "encrypted-chat",
      userName,
      senderRole: "provider",
      ciphertext,
      iv,
    }));
    setChatMessages((prev) => [...prev, {
      id: Date.now().toString(),
      userId,
      userName,
      content: newMessage,
      encrypted: true,
      timestamp: new Date().toISOString(),
    }]);
    setNewMessage("");
  };

  const addDiagnosis = () => {
    setDiagnoses([...diagnoses, { code: "", description: "", type: "primary" }]);
  };
  const updateDiagnosis = (index: number, field: keyof Diagnosis, value: string) => {
    const updated = [...diagnoses];
    updated[index] = { ...updated[index], [field]: value };
    setDiagnoses(updated);
  };
  const removeDiagnosis = (index: number) => {
    setDiagnoses(diagnoses.filter((_, i) => i !== index));
  };
  const addPrescription = () => {
    setPrescriptions([...prescriptions, {
      id: `rx-${Date.now()}`,
      medicationName: "",
      dosage: "",
      frequency: "",
      duration: "",
      quantity: 0,
      refills: 0,
      instructions: "",
      prescribedAt: new Date().toISOString(),
    }]);
  };
  const updatePrescription = (index: number, field: keyof TelehealthPrescription, value: any) => {
    const updated = [...prescriptions];
    updated[index] = { ...updated[index], [field]: value };
    setPrescriptions(updated);
  };
  const removePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="h-screen flex bg-gray-900">
      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-3 bg-gray-800 text-white">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/clinician-dashboard`)} data-testid="button-back-clinician">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold" data-testid="text-session-title">
                {session?.providerName || "Video Consultation"}
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Badge variant={isConnected ? "default" : "secondary"} data-testid="badge-clinician-connection">
                  {isConnected ? "Connected" : "Connecting..."}
                </Badge>
                {encryptionReady && (
                  <Badge variant="outline" className="text-green-400 border-green-400" data-testid="badge-encryption">
                    <Lock className="h-3 w-3 mr-1" />
                    E2E Encrypted
                  </Badge>
                )}
                {isRecording && (
                  <Badge variant="destructive" data-testid="badge-recording">
                    <Circle className="h-2 w-2 mr-1 fill-current animate-pulse" />
                    REC {formatDuration(recordingDuration)}
                  </Badge>
                )}
                {remoteScreenSharing && (
                  <Badge variant="outline" className="text-blue-400 border-blue-400" data-testid="badge-remote-screen-share">
                    <Monitor className="h-3 w-3 mr-1" />
                    Patient Sharing
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {participants.length + 1}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowChat(!showChat); if (showNotes && !showChat) setShowNotes(false); }}
              data-testid="button-toggle-chat"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowNotes(!showNotes); if (showChat && !showNotes) setShowChat(false); }}
              data-testid="button-toggle-notes"
            >
              <FileText className="h-4 w-4 mr-2" />
              Notes
            </Button>
          </div>
        </div>

        <div className="flex-1 relative">
          {/* Live peer video. WCAG 2.2 AA 1.2.4 (Captions, Live) applies
              and is not yet met: real-time captioning needs a transcription
              service on the media pipeline. Tracked in the accessibility
              conformance report as a known gap. */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover bg-gray-800"
            data-testid="video-remote-clinician"
          />

          <div className="absolute bottom-4 right-4 w-40 aspect-video rounded-lg overflow-hidden border-2 border-white shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-gray-700"
              data-testid="video-local-clinician"
            />
            {!isVideoOn && !isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <CameraOff className="h-6 w-6 text-gray-400" />
              </div>
            )}
            {isScreenSharing && (
              <div className="absolute top-1 left-1">
                <Badge variant="secondary" className="text-xs">
                  <Monitor className="h-3 w-3 mr-1" />
                  Sharing
                </Badge>
              </div>
            )}
          </div>

          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
              <div className="text-center text-white">
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
                <p className="text-lg">Waiting for patient to join...</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 p-3 bg-gray-800">
          <Button
            variant={isAudioOn ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleAudio}
            data-testid="button-clinician-toggle-audio"
          >
            {isAudioOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          <Button
            variant={isVideoOn ? "secondary" : "destructive"}
            size="icon"
            onClick={toggleVideo}
            data-testid="button-clinician-toggle-video"
          >
            {isVideoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="destructive"
            size="icon"
            onClick={endCall}
            data-testid="button-clinician-end-call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
          <Button
            variant={isScreenSharing ? "default" : "secondary"}
            size="icon"
            onClick={toggleScreenShare}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
            data-testid="button-clinician-screen-share"
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            variant={isRecording ? "destructive" : "secondary"}
            size="icon"
            onClick={isRecording ? stopRecording : requestRecordingConsent}
            title={isRecording ? "Stop Recording" : "Record Session"}
            disabled={awaitingConsent}
            data-testid="button-clinician-record"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {showChat && (
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
          <div className="p-3 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-white">Secure Chat</h2>
              {encryptionReady ? (
                <Badge variant="outline" className="text-green-400 border-green-400 text-xs" data-testid="badge-chat-encrypted">
                  <Lock className="h-3 w-3 mr-1" />
                  Encrypted
                </Badge>
              ) : (
                <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs" data-testid="badge-chat-unencrypted">
                  <Shield className="h-3 w-3 mr-1" />
                  Waiting...
                </Badge>
              )}
            </div>
          </div>
          <ScrollArea className="flex-1 p-3">
            <div className="space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${msg.userId === userId ? "text-right" : ""}`}
                  data-testid={`chat-message-${msg.id}`}
                >
                  <p className="text-xs text-gray-400">{msg.userName}</p>
                  <p className={`text-sm p-2 rounded-lg inline-block ${
                    msg.userId === userId
                      ? "bg-primary text-primary-foreground"
                      : "bg-gray-700 text-white"
                  }`}>
                    {msg.content}
                  </p>
                  {msg.encrypted && (
                    <p className="text-xs text-green-500 mt-0.5">
                      <Lock className="h-2 w-2 inline mr-0.5" />
                      encrypted
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-3 border-t border-gray-700">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={encryptionReady ? "Encrypted message..." : "Message..."}
                className="bg-gray-700 border-gray-600 text-white"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                data-testid="input-clinician-chat"
              />
              <Button size="icon" onClick={sendMessage} data-testid="button-clinician-send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {showNotes && (
        <div className="w-[450px] bg-background border-l flex flex-col">
          <div className="p-3 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Consultation Notes</h2>
              {lastSaved && (
                <p className="text-xs text-muted-foreground">
                  Last saved: {lastSaved.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveNoteMutation.mutate(noteData)}
                disabled={saveNoteMutation.isPending}
                data-testid="button-save-note"
              >
                {saveNoteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
              </Button>
              {existingNote && !existingNote.signedAt && (
                <Button
                  size="sm"
                  onClick={() => signNoteMutation.mutate()}
                  disabled={signNoteMutation.isPending}
                  data-testid="button-sign-note"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Sign
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  NO-CDS: These notes are for documentation only. Not clinical decision support.
                </AlertDescription>
              </Alert>

              <Tabs defaultValue="soap" className="w-full">
                <TabsList className="grid w-full grid-cols-3" data-testid="tabs-note-sections">
                  <TabsTrigger value="soap" data-testid="tab-soap">SOAP</TabsTrigger>
                  <TabsTrigger value="diagnoses" data-testid="tab-diagnoses">Dx</TabsTrigger>
                  <TabsTrigger value="prescriptions" data-testid="tab-prescriptions">Rx</TabsTrigger>
                </TabsList>

                <TabsContent value="soap" className="space-y-3 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-chief-complaint" className="text-xs">Chief Complaint</Label>
                    <Input id="clinician-video-room-chief-complaint"
                      value={noteData.chiefComplaint}
                      onChange={(e) => setNoteData({ ...noteData, chiefComplaint: e.target.value })}
                      placeholder="Patient's main concern..."
                      data-testid="input-chief-complaint"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-history-of-present-illness" className="text-xs">History of Present Illness</Label>
                    <Textarea id="clinician-video-room-history-of-present-illness"
                      value={noteData.historyOfPresentIllness}
                      onChange={(e) => setNoteData({ ...noteData, historyOfPresentIllness: e.target.value })}
                      placeholder="Describe the history..."
                      className="min-h-[80px]"
                      data-testid="textarea-hpi"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-physical-exam-findings-if-applicable" className="text-xs">Physical Exam Findings (if applicable)</Label>
                    <Textarea id="clinician-video-room-physical-exam-findings-if-applicable"
                      value={noteData.physicalExamFindings}
                      onChange={(e) => setNoteData({ ...noteData, physicalExamFindings: e.target.value })}
                      placeholder="Visual observations..."
                      className="min-h-[60px]"
                      data-testid="textarea-exam"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-assessment" className="text-xs">Assessment</Label>
                    <Textarea id="clinician-video-room-assessment"
                      value={noteData.assessment}
                      onChange={(e) => setNoteData({ ...noteData, assessment: e.target.value })}
                      placeholder="Clinical assessment..."
                      className="min-h-[80px]"
                      data-testid="textarea-assessment"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-plan" className="text-xs">Plan</Label>
                    <Textarea id="clinician-video-room-plan"
                      value={noteData.plan}
                      onChange={(e) => setNoteData({ ...noteData, plan: e.target.value })}
                      placeholder="Treatment plan..."
                      className="min-h-[80px]"
                      data-testid="textarea-plan"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-follow-up-instructions" className="text-xs">Follow-Up Instructions</Label>
                    <Textarea id="clinician-video-room-follow-up-instructions"
                      value={noteData.followUpInstructions}
                      onChange={(e) => setNoteData({ ...noteData, followUpInstructions: e.target.value })}
                      placeholder="Patient instructions..."
                      className="min-h-[60px]"
                      data-testid="textarea-followup"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clinician-video-room-follow-up-date" className="text-xs">Follow-Up Date</Label>
                    <Input id="clinician-video-room-follow-up-date"
                      type="date"
                      value={noteData.followUpDate}
                      onChange={(e) => setNoteData({ ...noteData, followUpDate: e.target.value })}
                      data-testid="input-followup-date"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="diagnoses" className="space-y-3 mt-3">
                  <div className="flex justify-between items-center">
                    <FieldCaption className="text-sm font-medium">Diagnoses</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addDiagnosis} data-testid="button-add-diagnosis">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {diagnoses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No diagnoses added</p>
                  ) : (
                    <div className="space-y-3">
                      {diagnoses.map((dx, index) => (
                        <Card key={index} className="p-3" data-testid={`card-diagnosis-${index}`}>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                placeholder="ICD-10 Code"
                                value={dx.code}
                                onChange={(e) => updateDiagnosis(index, "code", e.target.value)}
                                className="w-28"
                                data-testid={`input-dx-code-${index}`}
                              />
                              <Select value={dx.type} onValueChange={(v) => updateDiagnosis(index, "type", v)}>
                                <SelectTrigger className="w-28" data-testid={`select-dx-type-${index}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="primary">Primary</SelectItem>
                                  <SelectItem value="secondary">Secondary</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="icon" variant="ghost" onClick={() => removeDiagnosis(index)} data-testid={`button-remove-dx-${index}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              placeholder="Diagnosis description"
                              value={dx.description}
                              onChange={(e) => updateDiagnosis(index, "description", e.target.value)}
                              data-testid={`input-dx-description-${index}`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="prescriptions" className="space-y-3 mt-3">
                  <div className="flex justify-between items-center">
                    <FieldCaption className="text-sm font-medium">Prescriptions</FieldCaption>
                    <Button size="sm" variant="outline" onClick={addPrescription} data-testid="button-add-prescription">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  {prescriptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No prescriptions added</p>
                  ) : (
                    <div className="space-y-3">
                      {prescriptions.map((rx, index) => (
                        <Card key={rx.id} className="p-3" data-testid={`card-prescription-${index}`}>
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <Input
                                placeholder="Medication name"
                                value={rx.medicationName}
                                onChange={(e) => updatePrescription(index, "medicationName", e.target.value)}
                                className="flex-1"
                                data-testid={`input-rx-name-${index}`}
                              />
                              <Button size="icon" variant="ghost" onClick={() => removePrescription(index)} data-testid={`button-remove-rx-${index}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Dosage" value={rx.dosage} onChange={(e) => updatePrescription(index, "dosage", e.target.value)} data-testid={`input-rx-dosage-${index}`} />
                              <Input placeholder="Frequency" value={rx.frequency} onChange={(e) => updatePrescription(index, "frequency", e.target.value)} data-testid={`input-rx-frequency-${index}`} />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Input placeholder="Duration" value={rx.duration} onChange={(e) => updatePrescription(index, "duration", e.target.value)} data-testid={`input-rx-duration-${index}`} />
                              <Input type="number" placeholder="Qty" value={rx.quantity || ""} onChange={(e) => updatePrescription(index, "quantity", parseInt(e.target.value) || 0)} data-testid={`input-rx-qty-${index}`} />
                              <Input type="number" placeholder="Refills" value={rx.refills || ""} onChange={(e) => updatePrescription(index, "refills", parseInt(e.target.value) || 0)} data-testid={`input-rx-refills-${index}`} />
                            </div>
                            <Textarea
                              placeholder="Instructions"
                              value={rx.instructions}
                              onChange={(e) => updatePrescription(index, "instructions", e.target.value)}
                              className="min-h-[40px]"
                              data-testid={`textarea-rx-instructions-${index}`}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        </div>
      )}

      <Dialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <DialogContent data-testid="dialog-recording-consent">
          <DialogHeader>
            <DialogTitle>Record Session</DialogTitle>
            <DialogDescription>
              Session recording requires patient consent. The recording will be encrypted and stored securely in compliance with HIPAA regulations. Both parties will be notified that recording is active.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Recordings are encrypted at rest and stored in HIPAA-compliant object storage. Only authorized personnel can access recordings.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConsentDialog(false)} data-testid="button-cancel-recording">
              Cancel
            </Button>
            <Button onClick={startRecordingFlow} data-testid="button-request-consent">
              Request Patient Consent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
