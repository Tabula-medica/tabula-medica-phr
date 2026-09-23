import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Video, VideoOff, Mic, MicOff, PhoneOff,
  Monitor, Users, MessageSquare,
  ArrowLeft, Send, Loader2, CameraOff,
  Lock, Shield, Circle, Square
} from "lucide-react";
import {
  generateKeyPair, exportPublicKey, importPublicKey,
  deriveSharedKey, encryptMessage, decryptMessage
} from "@/lib/chat-encryption";
import type { TelehealthSession } from "@shared/schema";

interface DecryptedChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  encrypted: boolean;
  timestamp: string;
}

export default function VideoRoomPage() {
  const params = useParams<{ patientId?: string; roomId: string }>();
  const patientId = params.patientId || "default-patient";
  const roomId = params.roomId;
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [isConnected, setIsConnected] = useState(false);
  const [isRoomJoined, setIsRoomJoined] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isAudioOn, setIsAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [chatMessages, setChatMessages] = useState<DecryptedChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [encryptionReady, setEncryptionReady] = useState(false);

  const [isRecording, setIsRecording] = useState(false);
  const [showConsentRequest, setShowConsentRequest] = useState(false);
  const [consentRequester, setConsentRequester] = useState("");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const keyPairRef = useRef<CryptoKeyPair | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);

  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery<TelehealthSession>({
    queryKey: ["/api/telehealth/rooms", roomId],
  });

  const updateSessionMutation = useMutation({
    mutationFn: async (updates: Partial<TelehealthSession>) => {
      if (!session) return;
      const response = await apiRequest("PATCH", `/api/telehealth/sessions/${session.id}`, updates);
      if (!response.ok) throw new Error("Failed to update session");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telehealth/rooms", roomId] });
      queryClient.invalidateQueries({ queryKey: [`/api/patients/${patientId}/telehealth/sessions`] });
    },
  });

  const userId = useRef(`patient-${patientId}-${roomId?.slice(0, 8)}`).current;
  const userName = "Patient";

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
            setRoomError(null);
            break;

          case "error":
            setRoomError(data.message);
            toast({
              title: "Room Error",
              description: data.message,
              variant: "destructive",
            });
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
            if (data.userId === userId) break;
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
            toast({ title: "Screen Sharing", description: "Provider is sharing their screen" });
            break;

          case "screen-share-stop":
            setRemoteScreenSharing(false);
            break;

          case "recording-consent-request":
            setConsentRequester(data.requestedBy || "Provider");
            setShowConsentRequest(true);
            break;

          case "recording-started":
            setIsRecording(true);
            toast({ title: "Recording Active", description: "This session is now being recorded." });
            break;

          case "recording-stopped":
            setIsRecording(false);
            toast({ title: "Recording Stopped", description: "Session recording has ended." });
            break;
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    };

    setup();

    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      peerConnectionRef.current?.close();
      wsRef.current?.close();
    };
  }, [roomId, userId, initializeMedia, createPeerConnection]);

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
            description: "Could not start screen sharing. Please try again.",
            variant: "destructive"
          });
        }
      }
    }
  };

  const respondToConsent = (consent: boolean) => {
    setShowConsentRequest(false);
    wsRef.current?.send(JSON.stringify({
      type: "recording-consent-response",
      consent,
    }));
    if (consent) {
      toast({ title: "Consent Given", description: "You have consented to session recording." });
    } else {
      toast({ title: "Consent Declined", description: "You have declined session recording." });
    }
  };

  const endCall = () => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    screenStreamRef.current?.getTracks().forEach((track) => track.stop());
    peerConnectionRef.current?.close();
    wsRef.current?.send(JSON.stringify({ type: "leave", userId }));
    wsRef.current?.close();
    updateSessionMutation.mutate({ status: "completed" });
    navigate(`/telehealth`);
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
      senderRole: "patient",
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

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      <div className="flex items-center justify-between p-4 bg-gray-800 text-white">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/telehealth`)} data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-semibold" data-testid="text-session-title">
              {session?.providerName || "Video Consultation"}
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
              <Badge variant={isConnected ? "default" : "secondary"} data-testid="badge-connection-status">
                {isConnected ? "Connected" : "Connecting..."}
              </Badge>
              {encryptionReady && (
                <Badge variant="outline" className="text-green-400 border-green-400" data-testid="badge-encryption-patient">
                  <Lock className="h-3 w-3 mr-1" />
                  E2E Encrypted
                </Badge>
              )}
              {isRecording && (
                <Badge variant="destructive" data-testid="badge-recording-patient">
                  <Circle className="h-2 w-2 mr-1 fill-current animate-pulse" />
                  Recording
                </Badge>
              )}
              {remoteScreenSharing && (
                <Badge variant="outline" className="text-blue-400 border-blue-400" data-testid="badge-remote-screen-share-patient">
                  <Monitor className="h-3 w-3 mr-1" />
                  Provider Sharing
                </Badge>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {participants.length + 1} participant{participants.length !== 0 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowChat(!showChat)}
          data-testid="button-toggle-chat"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex">
        <div className={`flex-1 relative ${showChat ? "pr-80" : ""}`}>
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
            data-testid="video-remote"
          />

          <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-white shadow-lg">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover bg-gray-700"
              data-testid="video-local"
            />
            {!isVideoOn && !isScreenSharing && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-700">
                <CameraOff className="h-8 w-8 text-gray-400" />
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
                <p className="text-lg">Waiting for provider to join...</p>
                <p className="text-sm text-gray-400 mt-2">
                  Room ID: {roomId?.slice(0, 8)}...
                </p>
              </div>
            </div>
          )}
        </div>

        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-3 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-white">Secure Chat</h2>
                {encryptionReady ? (
                  <Badge variant="outline" className="text-green-400 border-green-400 text-xs" data-testid="badge-chat-encrypted-patient">
                    <Lock className="h-3 w-3 mr-1" />
                    Encrypted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-yellow-400 border-yellow-400 text-xs" data-testid="badge-chat-unencrypted-patient">
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
                  placeholder={encryptionReady ? "Encrypted message..." : "Type a message..."}
                  className="bg-gray-700 border-gray-600 text-white"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  data-testid="input-chat-message"
                />
                <Button size="icon" onClick={sendMessage} data-testid="button-send-message">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 p-4 bg-gray-800">
        <Button
          variant={isAudioOn ? "secondary" : "destructive"}
          size="icon"
          onClick={toggleAudio}
          data-testid="button-toggle-audio"
        >
          {isAudioOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Button
          variant={isVideoOn ? "secondary" : "destructive"}
          size="icon"
          onClick={toggleVideo}
          data-testid="button-toggle-video"
        >
          {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          onClick={endCall}
          data-testid="button-end-call"
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
        <Button
          variant={isScreenSharing ? "default" : "secondary"}
          size="icon"
          onClick={toggleScreenShare}
          data-testid="button-screen-share"
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          <Monitor className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={showConsentRequest} onOpenChange={setShowConsentRequest}>
        <DialogContent data-testid="dialog-consent-request">
          <DialogHeader>
            <DialogTitle>Recording Consent Request</DialogTitle>
            <DialogDescription>
              {consentRequester} is requesting permission to record this consultation session. The recording will be encrypted and stored securely.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Your consent is required before any recording can begin. Recordings are encrypted at rest and protected under HIPAA regulations. You may decline without affecting your consultation.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => respondToConsent(false)} data-testid="button-decline-consent">
              Decline
            </Button>
            <Button onClick={() => respondToConsent(true)} data-testid="button-accept-consent">
              Allow Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
