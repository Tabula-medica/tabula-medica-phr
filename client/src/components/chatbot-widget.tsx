import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  Bot,
  User,
  X,
  Loader2,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  Copy,
  Phone,
  Minimize2,
  Maximize2,
  AlertCircle,
} from "lucide-react";

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
  ],
  allergies: ["Penicillin"],
};

export function ChatbotWidget() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your 24/7 health assistant. I can help with:\n\n- Questions about the app\n- General health information\n- Finding your medications or appointments\n- Connecting you with your care team\n\nHow can I help?",
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

  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: ["/api/patient-chatbot/suggested-responses", "general"],
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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
              fullContent += `\n\n_${data.content}_`;
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
          ? { ...m, content: "I'm sorry, I encountered an error. Please try again." }
          : m
      ));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    sendMessage(suggestion);
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
    toast({
      title: "Copied",
      description: "Draft copied to clipboard",
    });
  };

  const handleEscalate = () => {
    setShowEscalationDialog(true);
  };

  const sendEscalation = async () => {
    if (!draftMessage) return;
    
    try {
      await fetch("/api/patient-chatbot/escalate-to-care-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: escalationConcern.slice(0, 100),
          message: draftMessage,
          urgency: "medium",
          category: "chatbot_escalation",
        }),
      });

      toast({
        title: "Message Sent",
        description: "Your message has been sent to your care team. They will respond soon.",
      });
      
      setShowEscalationDialog(false);
      setEscalationConcern("");
      setDraftMessage("");
      
      setMessages(prev => [...prev, {
        id: `assistant-sent-${Date.now()}`,
        role: "assistant",
        content: "I've sent your message to your care team. They typically respond within 24-48 hours for non-urgent matters. Is there anything else I can help you with in the meantime?",
        timestamp: new Date(),
      }]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showEscalationBanner = lastMessage?.escalation?.shouldEscalate && 
    (lastMessage.escalation.urgency === "high" || lastMessage.escalation.urgency === "emergency");

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
        data-testid="btn-open-chatbot"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <>
      <Card 
        className={`fixed z-50 shadow-xl flex flex-col ${
          isExpanded 
            ? "bottom-0 right-0 h-full w-full md:bottom-6 md:right-6 md:h-[600px] md:w-[450px] md:rounded-lg" 
            : "bottom-6 right-6 h-[500px] w-[380px] rounded-lg"
        }`}
        data-testid="chatbot-widget"
      >
        <CardHeader className="border-b px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 bg-primary">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-sm font-medium">Health Assistant</CardTitle>
                <p className="text-xs text-muted-foreground">24/7 Support</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
                data-testid="btn-toggle-expand"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => setIsOpen(false)}
                data-testid="btn-close-chatbot"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {showEscalationBanner && (
            <div className="bg-destructive/10 border-b border-destructive/20 p-3 flex-shrink-0">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-destructive">
                    {lastMessage.escalation?.urgency === "emergency" 
                      ? "If this is an emergency, please call 911 immediately."
                      : "This concern should be discussed with your healthcare provider."}
                  </p>
                  {lastMessage.escalation?.urgency !== "emergency" && (
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-xs text-destructive underline"
                      onClick={handleEscalate}
                      data-testid="btn-escalate-banner"
                    >
                      Send a message to your care team
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        <Bot className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg px-3 py-2 max-w-[85%] ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content || (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </span>
                    )}</p>
                  </div>
                  {message.role === "user" && (
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarFallback className="bg-secondary">
                        <User className="h-3.5 w-3.5" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {messages.length === 1 && suggestionsData?.suggestions && (
            <div className="border-t p-3 flex-shrink-0">
              <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestionsData.suggestions.slice(0, 3).map((suggestion, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="h-auto py-1 px-2 text-xs"
                    onClick={() => handleSuggestionClick(suggestion)}
                    data-testid={`btn-suggestion-${idx}`}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t p-3 flex-shrink-0">
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
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="text-sm"
                data-testid="input-chat-message"
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={isLoading || !input.trim()}
                data-testid="btn-send-message"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-muted-foreground">
                For emergencies, call 911
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={handleEscalate}
                data-testid="btn-talk-to-team"
              >
                Talk to care team
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEscalationDialog} onOpenChange={setShowEscalationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Your Care Team
            </DialogTitle>
            <DialogDescription>
              Describe your concern and I'll help you draft a message to send to your healthcare provider.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="chatbot-widget-what-would-you-like-to-discuss" className="text-sm font-medium mb-2 block">What would you like to discuss?</label>
              <Textarea id="chatbot-widget-what-would-you-like-to-discuss"
                value={escalationConcern}
                onChange={(e) => setEscalationConcern(e.target.value)}
                placeholder="Describe your health concern, question, or request..."
                className="min-h-[100px]"
                data-testid="input-escalation-concern"
              />
            </div>

            {!draftMessage && (
              <Button 
                onClick={handleDraftMessage} 
                disabled={!escalationConcern.trim() || isDrafting}
                className="w-full"
                data-testid="btn-draft-message"
              >
                {isDrafting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Drafting message...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Draft Message with AI
                  </>
                )}
              </Button>
            )}

            {draftMessage && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Draft Message</span>
                  <Button variant="ghost" size="sm" onClick={copyDraft}>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <Textarea
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  className="min-h-[150px] text-sm"
                  data-testid="textarea-draft-message"
                />
                <p className="text-xs text-muted-foreground">
                  You can edit this message before sending.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowEscalationDialog(false);
                setEscalationConcern("");
                setDraftMessage("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => setLocation("/messages")}
              variant="secondary"
            >
              Go to Messages
            </Button>
            {draftMessage && (
              <Button onClick={sendEscalation} data-testid="btn-send-escalation">
                Send to Care Team
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
