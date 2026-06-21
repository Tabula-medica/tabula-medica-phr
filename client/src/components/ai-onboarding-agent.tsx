import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Send,
  Bot,
  User,
  Sparkles,
  X,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Download,
  Shield,
  HelpCircle,
  Link2,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface InteractionWarning {
  medication: string;
  allergy: string;
  severity: "low" | "moderate" | "high" | "critical";
  description: string;
}

interface AutoFillData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: { street?: string; city?: string; state?: string; zipCode?: string };
}

interface QuickAction {
  id: string;
  label: string;
  icon: typeof HelpCircle;
  message: string;
}

const STEP_QUICK_ACTIONS: Record<string, QuickAction[]> = {
  welcome: [
    { id: "what-is-tm", label: "What is Tabula Medica?", icon: HelpCircle, message: "What is Tabula Medica and how can it help me?" },
    { id: "how-long", label: "How long does setup take?", icon: HelpCircle, message: "How long does the onboarding process take?" },
  ],
  profile: [
    { id: "autofill-fhir", label: "Auto-fill from my health records", icon: Download, message: "__AUTOFILL_FHIR__" },
    { id: "what-is-nmn", label: "What is NMN?", icon: HelpCircle, message: "What does NMN mean for the middle name field?" },
    { id: "why-ssn", label: "Why do you need my SSN last 4?", icon: Shield, message: "Why do you need the last 4 digits of my SSN?" },
    { id: "check-interactions", label: "Check medication interactions", icon: Pill, message: "__CHECK_INTERACTIONS__" },
  ],
  consent: [
    { id: "explain-sharing", label: "Explain health data sharing", icon: Shield, message: "Can you explain what health data sharing means and how my data is protected?" },
    { id: "what-is-hipaa", label: "What is HIPAA?", icon: Shield, message: "What is HIPAA and how does it protect my health information?" },
    { id: "ai-analysis", label: "How does AI analysis work?", icon: Sparkles, message: "How does the AI-powered analysis work? Is my data safe?" },
  ],
  connect: [
    { id: "what-is-fasten", label: "What is Fasten Health?", icon: Link2, message: "What is Fasten Health and how does it connect my records?" },
    { id: "what-is-idme", label: "How does Clear/ID.me work?", icon: Shield, message: "How does Clear/ID.me identity verification work?" },
    { id: "which-ehrs", label: "Which EHRs are supported?", icon: HelpCircle, message: "Which electronic health record systems can I connect?" },
  ],
  tutorial: [
    { id: "skip-tour", label: "Can I skip the tour?", icon: HelpCircle, message: "Can I skip the portal tour and come back to it later?" },
    { id: "key-features", label: "What are key features?", icon: Sparkles, message: "What are the most important features I should know about?" },
  ],
};

const NO_CDS_BANNER = "This assistant provides general onboarding guidance only. It does not provide medical advice.";

interface AIOnboardingAgentProps {
  currentStep: string;
  profileData?: Record<string, unknown>;
  onAutoFill?: (data: AutoFillData) => void;
}

export function AIOnboardingAgent({
  currentStep,
  profileData,
  onAutoFill,
}: AIOnboardingAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm your onboarding assistant. I can help you fill out your profile, explain what each field means, and answer questions about how your data is protected.\n\nTry one of the quick actions below, or ask me anything!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [interactionWarnings, setInteractionWarnings] = useState<InteractionWarning[]>([]);
  const [showInteractionChecker, setShowInteractionChecker] = useState(false);
  const [medicationsInput, setMedicationsInput] = useState("");
  const [allergiesInput, setAllergiesInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await apiRequest("POST", "/api/ai-onboarding-agent/chat", {
        message: userMessage,
        currentStep,
        profileData,
      });
      return res.json() as Promise<{ response: string; suggestions?: string[] }>;
    },
    onSuccess: (data) => {
      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    },
    onError: () => {
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsLoading(false);
    },
  });

  const autoFillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-onboarding-agent/autofill-from-fhir", {});
      return res.json() as Promise<{ success: boolean; data: AutoFillData; fieldsFound: string[] }>;
    },
    onSuccess: (data) => {
      if (data.success && data.data && onAutoFill) {
        onAutoFill(data.data);
        const fieldsStr = data.fieldsFound?.join(", ") || "profile fields";
        const assistantMsg: Message = {
          id: `autofill-${Date.now()}`,
          role: "assistant",
          content: `I found data from your connected health records and auto-filled the following fields: ${fieldsStr}.\n\nPlease review the filled fields and make any corrections needed. Your manually entered data won't be overwritten.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        toast({
          title: "Auto-fill complete",
          description: `${data.fieldsFound?.length || 0} fields populated from your health records.`,
        });
      } else {
        const assistantMsg: Message = {
          id: `autofill-none-${Date.now()}`,
          role: "assistant",
          content: "I wasn't able to find connected health records to auto-fill from. You can connect your EHR in the 'Connect Records' step, then come back to auto-fill your profile.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    },
    onError: () => {
      const errorMsg: Message = {
        id: `autofill-error-${Date.now()}`,
        role: "assistant",
        content: "I couldn't retrieve your health records right now. Please try again later or fill in your profile manually.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const interactionMutation = useMutation({
    mutationFn: async (params: { medications: string[]; allergies: string[] }) => {
      const res = await apiRequest("POST", "/api/ai-onboarding-agent/check-interactions", params);
      return res.json() as Promise<{ warnings: InteractionWarning[] }>;
    },
    onSuccess: (data) => {
      setInteractionWarnings(data.warnings || []);
      const warningCount = data.warnings?.length || 0;
      const assistantMsg: Message = {
        id: `interaction-${Date.now()}`,
        role: "assistant",
        content: warningCount > 0
          ? `I found ${warningCount} potential interaction${warningCount > 1 ? "s" : ""} between your medications and allergies. Please review the warnings below and discuss them with your healthcare provider.`
          : "No interactions found between the medications and allergies you listed. However, always confirm with your healthcare provider.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setShowInteractionChecker(false);
    },
    onError: () => {
      const errorMsg: Message = {
        id: `interaction-error-${Date.now()}`,
        role: "assistant",
        content: "I couldn't check interactions right now. Please try again later.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const sendMessage = (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    chatMutation.mutate(messageText.trim());
  };

  const handleQuickAction = (action: QuickAction) => {
    if (action.message === "__AUTOFILL_FHIR__") {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: "Auto-fill my profile from connected health records",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      autoFillMutation.mutate();
      return;
    }
    if (action.message === "__CHECK_INTERACTIONS__") {
      setShowInteractionChecker(true);
      return;
    }
    sendMessage(action.message);
  };

  const handleCheckInteractions = () => {
    const meds = medicationsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const allergies = allergiesInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (meds.length === 0 || allergies.length === 0) {
      toast({
        title: "Missing information",
        description: "Please enter at least one medication and one allergy.",
        variant: "destructive",
      });
      return;
    }
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: `Check interactions between medications (${meds.join(", ")}) and allergies (${allergies.join(", ")})`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    interactionMutation.mutate({ medications: meds, allergies });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const quickActions = STEP_QUICK_ACTIONS[currentStep] || STEP_QUICK_ACTIONS["welcome"];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
      case "high": return "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800";
      case "moderate": return "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800";
      default: return "text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800";
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 rounded-full w-14 h-14 shadow-lg z-50"
        size="icon"
        data-testid="button-open-onboarding-agent"
      >
        <Sparkles className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Card
      className="fixed bottom-4 right-4 w-96 max-h-[600px] shadow-xl flex flex-col z-50"
      data-testid="card-onboarding-agent"
    >
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">Onboarding Assistant</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(false)}
          data-testid="button-close-onboarding-agent"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden flex flex-col p-4 pt-0 gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 dark:bg-amber-950/30 p-2 rounded-md">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span data-testid="text-no-cds-banner">{NO_CDS_BANNER}</span>
        </div>

        <div className="flex flex-wrap gap-1">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-2"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading || autoFillMutation.isPending || interactionMutation.isPending}
                data-testid={`button-quick-${action.id}`}
              >
                <Icon className="w-3 h-3 mr-1" />
                {action.label}
              </Button>
            );
          })}
        </div>

        {showInteractionChecker && (
          <div className="border rounded-md p-3 space-y-2 bg-muted/30" data-testid="interaction-checker-panel">
            <p className="text-xs font-medium">Check Medication-Allergy Interactions</p>
            <div>
              <label className="text-xs text-muted-foreground">Medications (comma-separated)</label>
              <Input
                value={medicationsInput}
                onChange={(e) => setMedicationsInput(e.target.value)}
                placeholder="e.g. Amoxicillin, Ibuprofen"
                className="text-xs"
                data-testid="input-medications"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Allergies (comma-separated)</label>
              <Input
                value={allergiesInput}
                onChange={(e) => setAllergiesInput(e.target.value)}
                placeholder="e.g. Penicillin, Sulfa"
                className="text-xs"
                data-testid="input-allergies"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="text-xs flex-1"
                onClick={handleCheckInteractions}
                disabled={interactionMutation.isPending}
                data-testid="button-check-interactions"
              >
                {interactionMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Pill className="w-3 h-3 mr-1" />
                )}
                Check Interactions
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setShowInteractionChecker(false)}
                data-testid="button-close-interaction-checker"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {interactionWarnings.length > 0 && (
          <div className="space-y-1.5" data-testid="interaction-warnings">
            {interactionWarnings.map((warning, idx) => (
              <div
                key={idx}
                className={cn("rounded-md p-2 text-xs border", getSeverityColor(warning.severity))}
                data-testid={`warning-interaction-${idx}`}
              >
                <div className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="w-3 h-3" />
                  {warning.medication} + {warning.allergy}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {warning.severity}
                  </Badge>
                </div>
                <p className="mt-0.5">{warning.description}</p>
              </div>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1 pr-2" ref={scrollRef} data-testid="chat-messages-container">
          <div className="space-y-3">
            {messages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={message.id}
                  className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
                  data-testid={`message-${message.role}-${message.id}`}
                >
                  <Avatar className="w-7 h-7 flex-shrink-0">
                    <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-accent"}>
                      {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm max-w-[80%]",
                      isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              );
            })}
            {(isLoading || autoFillMutation.isPending) && (
              <div className="flex gap-2">
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="bg-accent">
                    <Bot className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <Skeleton className="h-12 w-48 rounded-lg" />
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="flex gap-2 pt-2 border-t">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about onboarding..."
            disabled={isLoading || autoFillMutation.isPending}
            className="flex-1 text-sm"
            data-testid="input-agent-message"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading || autoFillMutation.isPending}
            data-testid="button-send-agent-message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
