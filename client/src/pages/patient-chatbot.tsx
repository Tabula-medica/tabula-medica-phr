import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Phone,
  Navigation,
  Pill,
  FileText,
  Calendar,
  Mail,
  Sparkles,
  HelpCircle,
  ChevronRight,
  Copy,
  ExternalLink,
  AlertCircle,
  Heart,
} from "lucide-react";
import { GuardrailsDisclaimer } from "@/components/guardrails-disclaimer";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  escalation?: {
    shouldEscalate: boolean;
    urgency: "low" | "medium" | "high" | "emergency";
    reason?: string;
  };
}

interface QuickAction {
  id: string;
  label: string;
  type: "navigation" | "prompt" | "escalation";
  path?: string;
  prompt?: string;
}

interface PatientContext {
  medications: Array<{ name: string; dosage: string; frequency: string; purpose?: string }>;
  conditions: Array<{ name: string; status: string }>;
  allergies: string[];
}

const SAMPLE_PATIENT_CONTEXT: PatientContext = {
  medications: [
    { name: "Metformin", dosage: "500mg", frequency: "twice daily", purpose: "blood sugar control" },
    { name: "Lisinopril", dosage: "10mg", frequency: "once daily", purpose: "blood pressure" },
    { name: "Atorvastatin", dosage: "20mg", frequency: "once daily", purpose: "cholesterol" },
  ],
  conditions: [
    { name: "Type 2 Diabetes", status: "managed" },
    { name: "Hypertension", status: "controlled" },
    { name: "High Cholesterol", status: "managed" },
  ],
  allergies: ["Penicillin", "Sulfa drugs"],
};

export default function PatientChatbot() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your Tabula Medica health assistant. I can help you:\n\n- Answer general health questions (educational only)\n- Explain your medications and conditions\n- Navigate the app to find what you need\n- Help you draft messages to your healthcare provider\n\nHow can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEscalationDialog, setShowEscalationDialog] = useState(false);
  const [escalationConcern, setEscalationConcern] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: quickActions } = useQuery<{ actions: QuickAction[] }>({
    queryKey: ["/api/patient-chatbot/quick-actions"],
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessageId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    try {
      const response = await fetch("/api/patient-chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: messages.filter(m => m.id !== "welcome").map(m => ({
            role: m.role,
            content: m.content,
          })),
          patientContext: SAMPLE_PATIENT_CONTEXT,
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let fullContent = "";
      let escalationData: ChatMessage["escalation"] | undefined;
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "escalation") {
              escalationData = data.data;
            } else if (data.type === "content") {
              fullContent += data.content;
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: fullContent, escalation: escalationData }
                  : m
              ));
            } else if (data.type === "disclaimer") {
              fullContent += `\n\n---\n_${data.content}_`;
              setMessages(prev => prev.map(m => 
                m.id === assistantMessageId 
                  ? { ...m, content: fullContent, escalation: escalationData }
                  : m
              ));
            }
          } catch (e) {
          }
        }
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? { ...m, content: "I'm sorry, I encountered an error. Please try again or contact support if the issue persists." }
          : m
      ));
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.type === "navigation" && action.path) {
      setLocation(action.path);
    } else if (action.type === "prompt" && action.prompt) {
      setInput(action.prompt);
      inputRef.current?.focus();
    } else if (action.type === "escalation") {
      setShowEscalationDialog(true);
    }
  };

  const handleDraftMessage = async () => {
    if (!escalationConcern.trim()) return;
    
    setIsDrafting(true);
    try {
      const response = await fetch("/api/patient-chatbot/draft-provider-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concern: escalationConcern,
          patientContext: SAMPLE_PATIENT_CONTEXT,
        }),
      });

      if (!response.ok) throw new Error("Failed to draft message");

      const data = await response.json();
      setDraftMessage(data.draft);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to draft message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDrafting(false);
    }
  };

  const copyDraft = () => {
    navigator.clipboard.writeText(draftMessage);
    toast({ title: "Copied", description: "Message copied to clipboard" });
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "emergency": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300";
      case "high": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300";
      case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300";
      default: return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-blue-300";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center px-4 gap-4">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" asChild data-testid="button-back">
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Health Assistant
            </h1>
            <p className="text-sm text-muted-foreground">Ask questions about your health</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowEscalationDialog(true)} className="min-h-[44px]" data-testid="button-contact-provider">
            <Phone className="h-4 w-4 mr-2" />
            Contact Provider
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col container max-w-3xl mx-auto">
        <GuardrailsDisclaimer variant="inline" className="m-4 mb-0" />

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className={message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}>
                    {message.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : ""}`}>
                  {message.escalation?.shouldEscalate && message.escalation.urgency !== "low" && (
                    <Alert className={`mb-2 ${getUrgencyColor(message.escalation.urgency)}`}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {message.escalation.urgency === "emergency" ? (
                          <strong>If this is a medical emergency, please call 911 immediately.</strong>
                        ) : (
                          `This question may require guidance from your healthcare provider.`
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                  <div
                    className={`inline-block p-3 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content || <Loader2 className="h-4 w-4 animate-spin" />}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {quickActions && messages.length <= 2 && (
          <div className="px-4 pb-2">
            <p className="text-sm text-muted-foreground mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.actions.slice(0, 6).map((action) => (
                <Button
                  key={action.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="min-h-[44px]"
                  data-testid={`button-quick-${action.id}`}
                >
                  {action.type === "navigation" && <Navigation className="h-4 w-4 mr-1" />}
                  {action.type === "prompt" && <HelpCircle className="h-4 w-4 mr-1" />}
                  {action.type === "escalation" && <Phone className="h-4 w-4 mr-1" />}
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question..."
              disabled={isLoading}
              className="flex-1 min-h-[44px]"
              data-testid="input-chat"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="min-h-[44px] min-w-[44px]" data-testid="button-send">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send message</span>
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-2">
            For educational purposes only. Always consult your healthcare provider for medical advice.
          </p>
        </div>
      </div>

      <Dialog open={showEscalationDialog} onOpenChange={setShowEscalationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Your Provider
            </DialogTitle>
            <DialogDescription>
              I can help you draft a message to your healthcare provider about your concern.
            </DialogDescription>
          </DialogHeader>

          {!draftMessage ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="patient-chatbot-what-would-you-like-to-discuss" className="text-sm font-medium mb-2 block">What would you like to discuss?</label>
                <Textarea id="patient-chatbot-what-would-you-like-to-discuss"
                  value={escalationConcern}
                  onChange={(e) => setEscalationConcern(e.target.value)}
                  placeholder="Describe your concern or question..."
                  className="min-h-[100px]"
                  data-testid="textarea-concern"
                />
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  If this is a medical emergency, please call 911 or go to the nearest emergency room immediately.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{draftMessage}</p>
              </div>
              <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                  This is educational information only, NOT medical advice. Always consult your healthcare provider for medical decisions.
                </AlertDescription>
              </Alert>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyDraft} className="flex-1 min-h-[44px]" data-testid="button-copy-draft">
                  <Copy className="h-4 w-4 mr-2" aria-hidden="true" />
                  Copy
                </Button>
                <Button asChild className="flex-1 min-h-[44px]" data-testid="button-go-messages">
                  <Link href="/messages">
                    <Mail className="h-4 w-4 mr-2" aria-hidden="true" />
                    Go to Messages
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {!draftMessage ? (
              <Button onClick={handleDraftMessage} disabled={!escalationConcern.trim() || isDrafting} className="min-h-[44px]" data-testid="button-draft-message">
                {isDrafting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4 mr-2" aria-hidden="true" />}
                Draft Message
              </Button>
            ) : (
              <Button variant="outline" onClick={() => { setDraftMessage(""); setEscalationConcern(""); }} className="min-h-[44px]" data-testid="button-start-over">
                Start Over
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
