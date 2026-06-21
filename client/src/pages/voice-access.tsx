import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Languages, 
  Globe,
  Play,
  Square,
  RefreshCw,
  MessageSquare,
  Navigation,
  HelpCircle,
  Loader2,
  Check,
  ArrowRight,
} from "lucide-react";

interface Language {
  code: string;
  name: string;
  locale: string;
}

interface VoiceResponse {
  inputTranscript: string;
  detectedLanguage: string;
  outputText: string;
  outputLanguage: string;
  audioResponse?: string;
  navigationRoute?: string;
  commandType: string;
}

interface ConversationEntry {
  id: string;
  type: "user" | "assistant";
  text: string;
  language: string;
  timestamp: Date;
  audioUrl?: string;
}

export default function VoiceAccessPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [inputLanguage, setInputLanguage] = useState<string>("auto");
  const [outputLanguage, setOutputLanguage] = useState<string>("en");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [textInput, setTextInput] = useState("");
  const [activeTab, setActiveTab] = useState("voice");
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const { data: languagesData } = useQuery<{ languages: Language[]; total: number }>({
    queryKey: ["/api/voice/languages"],
  });

  const languages = languagesData?.languages || [];

  const synthesizeMutation = useMutation({
    mutationFn: async ({ text, language }: { text: string; language: string }) => {
      const response = await apiRequest("POST", "/api/voice/synthesize", { text, language, voice: "alloy" });
      return await response.json() as { audio: string; format: string };
    },
  });

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice commands.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(",")[1];
        
        const res = await apiRequest("POST", "/api/voice/multilingual", {
          audio: base64Audio,
          format: "webm",
          inputLanguage: inputLanguage === "auto" ? undefined : inputLanguage,
          outputLanguage,
        });
        const response = await res.json() as VoiceResponse;

        const userEntry: ConversationEntry = {
          id: `user-${Date.now()}`,
          type: "user",
          text: response.inputTranscript,
          language: response.detectedLanguage,
          timestamp: new Date(),
        };

        let audioUrl: string | undefined;
        if (response.audioResponse) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(response.audioResponse), (c) => c.charCodeAt(0))],
            { type: "audio/mp3" }
          );
          audioUrl = URL.createObjectURL(audioBlob);
        }

        const assistantEntry: ConversationEntry = {
          id: `assistant-${Date.now()}`,
          type: "assistant",
          text: response.outputText,
          language: response.outputLanguage,
          timestamp: new Date(),
          audioUrl,
        };

        setConversation((prev) => [...prev, userEntry, assistantEntry]);

        if (audioUrl) {
          playAudio(audioUrl);
        }

        if (response.navigationRoute) {
          setTimeout(() => {
            setLocation(response.navigationRoute!);
          }, 2000);
        }

        setIsProcessing(false);
      };
    } catch (error) {
      console.error("Failed to process audio:", error);
      toast({
        title: "Processing Failed",
        description: "Failed to process your voice command. Please try again.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;

    setIsProcessing(true);
    try {
      const result = await synthesizeMutation.mutateAsync({
        text: textInput,
        language: outputLanguage,
      });

      const userEntry: ConversationEntry = {
        id: `user-${Date.now()}`,
        type: "user",
        text: textInput,
        language: outputLanguage,
        timestamp: new Date(),
      };

      let audioUrl: string | undefined;
      if (result.audio) {
        const audioBlob = new Blob(
          [Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0))],
          { type: "audio/mp3" }
        );
        audioUrl = URL.createObjectURL(audioBlob);
      }

      const assistantEntry: ConversationEntry = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        text: `Speaking: "${textInput}"`,
        language: outputLanguage,
        timestamp: new Date(),
        audioUrl,
      };

      setConversation((prev) => [...prev, userEntry, assistantEntry]);
      setTextInput("");

      if (audioUrl) {
        playAudio(audioUrl);
      }
    } catch (error) {
      console.error("Failed to synthesize:", error);
      toast({
        title: "Synthesis Failed",
        description: "Failed to convert text to speech.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(console.error);
  };

  const getLanguageName = (code: string): string => {
    const lang = languages.find((l) => l.code === code);
    return lang?.name || code;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <Globe className="h-7 w-7 text-primary" />
          Multilingual Voice Access
        </h1>
        <p className="text-muted-foreground">
          Speak to your health records in over 50 languages. Navigate, ask questions, and get explanations using your voice.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Input Language
            </CardTitle>
            <CardDescription>Select your speaking language or use auto-detect</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={inputLanguage} onValueChange={setInputLanguage}>
              <SelectTrigger data-testid="select-input-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Response Language
            </CardTitle>
            <CardDescription>Choose the language for responses</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={outputLanguage} onValueChange={setOutputLanguage}>
              <SelectTrigger data-testid="select-output-language">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Voice Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="voice" className="flex items-center gap-2" data-testid="tab-voice">
                <Mic className="h-4 w-4" />
                Voice Input
              </TabsTrigger>
              <TabsTrigger value="text" className="flex items-center gap-2" data-testid="tab-text">
                <MessageSquare className="h-4 w-4" />
                Text to Speech
              </TabsTrigger>
            </TabsList>

            <TabsContent value="voice" className="space-y-4">
              <div className="flex flex-col items-center gap-4 py-6">
                <Button
                  size="lg"
                  variant={isRecording ? "destructive" : "default"}
                  className="h-24 w-24 rounded-full"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  data-testid="button-record"
                >
                  {isProcessing ? (
                    <Loader2 className="h-10 w-10 animate-spin" />
                  ) : isRecording ? (
                    <Square className="h-10 w-10" />
                  ) : (
                    <Mic className="h-10 w-10" />
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {isProcessing
                    ? "Processing your voice..."
                    : isRecording
                    ? "Recording... Tap to stop"
                    : "Tap to start speaking"}
                </p>
              </div>

              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Try saying:</strong> "Show my medications", "Explain blood pressure", 
                  "Go to timeline", or ask any health question in your language.
                </AlertDescription>
              </Alert>
            </TabsContent>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-3">
                <Textarea
                  placeholder="Type text to convert to speech..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={3}
                  data-testid="textarea-text-input"
                />
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isProcessing}
                  className="w-full"
                  data-testid="button-synthesize"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4 mr-2" />
                      Convert to Speech
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Conversation</h4>
              {conversation.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConversation([])}
                  data-testid="button-clear-conversation"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>

            <ScrollArea className="h-64 rounded-md border p-4">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Mic className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Start speaking to begin</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversation.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex gap-3 ${entry.type === "user" ? "justify-end" : ""}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          entry.type === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{entry.text}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {getLanguageName(entry.language)}
                          </Badge>
                          {entry.audioUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              onClick={() => playAudio(entry.audioUrl!)}
                              data-testid={`button-play-${entry.id}`}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={conversationEndRef} />
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="h-5 w-5" />
            Voice Commands
          </CardTitle>
          <CardDescription>Available commands you can speak</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { command: "Show my medications", description: "View medication list" },
              { command: "Go to timeline", description: "See health events" },
              { command: "Open documents", description: "View medical documents" },
              { command: "What is [term]?", description: "Get medical explanations" },
              { command: "Read my allergies", description: "List recorded allergies" },
              { command: "Translate document", description: "Go to translation" },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
              >
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-medium text-sm">{item.command}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Supported Languages ({languages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {languages.slice(0, 20).map((lang) => (
              <Badge key={lang.code} variant="secondary">
                {lang.name}
              </Badge>
            ))}
            {languages.length > 20 && (
              <Badge variant="outline">+{languages.length - 20} more</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
