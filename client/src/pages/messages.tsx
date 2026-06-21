import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useMessagingWebSocket, type MessageEvent } from "@/hooks/use-messaging-websocket";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  Image,
  FileText,
  X,
  ChevronLeft,
  Clock,
  CheckCheck,
  AlertCircle,
  User,
  Stethoscope,
  Users,
  Archive,
  Lock,
  Upload,
  File,
  Download,
  Inbox,
  Mail,
  MailOpen,
  RefreshCw,
  Cloud,
  CloudOff,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bell, BellOff, Wifi, WifiOff } from "lucide-react";
import type { 
  MessageThread, 
  SecureMessage, 
  MessageAttachment,
  MessageParticipantRole,
  MessageThreadType,
  MessagePriority,
} from "@shared/schema";

const threadTypeLabels: Record<MessageThreadType, string> = {
  general: "General",
  prescription_request: "Prescription Request",
  appointment_follow_up: "Appointment Follow-Up",
  test_results: "Test Results",
  urgent: "Urgent",
  billing: "Billing",
};

const priorityColors: Record<MessagePriority, string> = {
  normal: "secondary",
  high: "default",
  urgent: "destructive",
};

const roleIcons: Record<MessageParticipantRole, typeof User> = {
  patient: User,
  provider: Stethoscope,
  nurse: Users,
  care_coordinator: Users,
  caregiver: Users,
  specialist: Stethoscope,
};

const newThreadSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  threadType: z.enum(["general", "prescription_request", "appointment_follow_up", "test_results", "urgent", "billing"]),
  priority: z.enum(["normal", "high", "urgent"]),
  recipientRole: z.enum(["provider", "nurse", "care_coordinator", "specialist"]),
  initialMessage: z.string().min(1, "Message is required"),
});

type NewThreadForm = z.infer<typeof newThreadSchema>;

function ThreadList({ 
  threads, 
  selectedThreadId, 
  onSelectThread,
  isLoading,
}: { 
  threads: MessageThread[];
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center p-4">
        <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No messages yet</p>
        <p className="text-sm text-muted-foreground">Start a new conversation with your care team</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-280px)] md:h-[calc(100vh-220px)]">
      <div className="space-y-1 p-2">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors hover-elevate ${
              selectedThreadId === thread.id 
                ? "bg-primary/10 border border-primary/20" 
                : ""
            }`}
            data-testid={`thread-item-${thread.id}`}
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {thread.participants[0]?.name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm truncate">{thread.subject}</span>
                  {thread.unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                      {thread.unreadCount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {thread.lastMessagePreview || "No messages yet"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {threadTypeLabels[thread.threadType]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
              {thread.priority !== "normal" && (
                <Badge variant={priorityColors[thread.priority] as "default" | "secondary" | "destructive"} className="text-[10px] h-5">
                  {thread.priority}
                </Badge>
              )}
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
}

function MessageBubble({ 
  message, 
  isOwnMessage 
}: { 
  message: SecureMessage;
  isOwnMessage: boolean;
}) {
  const RoleIcon = roleIcons[message.senderRole] || User;

  return (
    <div className={`flex gap-2 ${isOwnMessage ? "flex-row-reverse" : ""}`}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"}>
          <RoleIcon className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className={`max-w-[80%] ${isOwnMessage ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{message.senderName}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{message.senderRole.replace("_", " ")}</span>
        </div>
        <div 
          className={`rounded-lg p-3 ${
            isOwnMessage 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map((attachment) => (
                <AttachmentDisplay key={attachment.id} attachment={attachment} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(message.createdAt), "MMM d, h:mm a")}
          </span>
          {isOwnMessage && message.isRead && (
            <CheckCheck className="h-3 w-3 text-primary" />
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentDisplay({ attachment }: { attachment: MessageAttachment }) {
  const isImage = attachment.fileType.startsWith("image/");
  
  return (
    <div className="flex items-center gap-2 p-2 rounded bg-background/50">
      {isImage ? (
        <Image className="h-4 w-4 shrink-0" />
      ) : (
        <FileText className="h-4 w-4 shrink-0" />
      )}
      <span className="text-xs truncate flex-1">{attachment.fileName}</span>
      <a
        href={attachment.objectPath}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0"
        data-testid={`download-attachment-${attachment.id}`}
      >
        <Download className="h-4 w-4" />
      </a>
    </div>
  );
}

function MessageView({ 
  threadId,
  onBack,
}: { 
  threadId: string;
  onBack: () => void;
}) {
  const [messageText, setMessageText] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const { toast } = useToast();
  const currentUserId = "current-user";

  const { data, isLoading } = useQuery<{ thread: MessageThread; messages: SecureMessage[] }>({
    queryKey: ["/api/messages/threads", threadId],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const attachments: any[] = [];
      
      for (const file of pendingAttachments) {
        const urlResponse = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
        });
        
        if (!urlResponse.ok) throw new Error("Failed to get upload URL");
        
        const { uploadURL, objectPath } = await urlResponse.json();
        
        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        
        attachments.push({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          attachmentType: file.type.startsWith("image/") ? "image" : "document",
          objectPath,
        });
      }
      
      return apiRequest("POST", `/api/messages/threads/${threadId}/messages`, {
        content,
        attachments,
      });
    },
    onSuccess: () => {
      setMessageText("");
      setPendingAttachments([]);
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", threadId] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/messages/threads/${threadId}/read`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
  });

  const handleSend = () => {
    if (!messageText.trim() && pendingAttachments.length === 0) return;
    sendMessageMutation.mutate(messageText);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const thread = data?.thread;
  const messages = data?.messages || [];

  if (!thread) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4" data-testid="thread-not-found">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Thread not found</p>
        <Button variant="outline" onClick={onBack} className="mt-4" data-testid="button-go-back">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="md:hidden"
          data-testid="button-back-to-threads"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{thread.subject}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[10px] h-4">
              {threadTypeLabels[thread.threadType]}
            </Badge>
            {thread.priority !== "normal" && (
              <Badge variant={priorityColors[thread.priority] as "default" | "secondary" | "destructive"} className="text-[10px] h-4">
                {thread.priority}
              </Badge>
            )}
            {thread.isClosed && (
              <Badge variant="secondary" className="text-[10px] h-4">
                <Lock className="h-3 w-3 mr-1" />
                Closed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {thread.participants.slice(0, 3).map((p) => (
            <Avatar key={p.id} className="h-7 w-7">
              <AvatarImage src={p.avatarUrl} />
              <AvatarFallback className="text-[10px]">{p.name.charAt(0)}</AvatarFallback>
            </Avatar>
          ))}
          {thread.participants.length > 3 && (
            <span className="text-xs text-muted-foreground">+{thread.participants.length - 3}</span>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              isOwnMessage={message.senderId === currentUserId}
            />
          ))}
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8" data-testid="empty-messages-state">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {!thread.isClosed && (
        <div className="p-3 border-t bg-card">
          {pendingAttachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingAttachments.map((file, index) => (
                <div key={index} className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-sm">
                  <File className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="p-0.5"
                    onClick={() => removeAttachment(index)}
                    data-testid={`button-remove-attachment-${index}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message..."
                className="min-h-[60px] max-h-[120px] resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                data-testid="input-message-text"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  multiple
                  onChange={handleFileSelect}
                  accept="image/*,.pdf,.doc,.docx"
                  data-testid="input-file-attachment"
                />
                <Button variant="outline" size="icon" asChild>
                  <span>
                    <Paperclip className="h-4 w-4" />
                  </span>
                </Button>
              </label>
              <Button 
                size="icon" 
                onClick={handleSend}
                disabled={sendMessageMutation.isPending || (!messageText.trim() && pendingAttachments.length === 0)}
                data-testid="button-send-message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick message templates for common message types
const messageTemplates: Record<string, { subject: string; message: string }> = {
  prescription_request: {
    subject: "Prescription Refill Request",
    message: "I would like to request a refill for my prescription. Please let me know if you need any additional information.",
  },
  appointment_follow_up: {
    subject: "Follow-Up After Recent Appointment",
    message: "I have a question regarding my recent appointment. ",
  },
  test_results: {
    subject: "Question About Test Results",
    message: "I have a question about my recent test results. ",
  },
  urgent: {
    subject: "Urgent: Need Immediate Attention",
    message: "",
  },
  billing: {
    subject: "Billing Question",
    message: "I have a question about my recent bill. ",
  },
  general: {
    subject: "",
    message: "",
  },
};

function NewThreadDialog({ 
  onThreadCreated, 
  open,
  onOpenChange,
  messageType = "general" 
}: { 
  onThreadCreated: (threadId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageType?: string;
}) {
  const { toast } = useToast();
  
  // Validate message type against allowed values
  const validType = validMessageTypes.includes(messageType) ? messageType : "general";
  const template = messageTemplates[validType] || messageTemplates.general;

  const form = useForm<NewThreadForm>({
    resolver: zodResolver(newThreadSchema),
    defaultValues: {
      subject: template.subject,
      threadType: validType as any,
      priority: validType === "urgent" ? "urgent" : "normal",
      recipientRole: "provider",
      initialMessage: template.message,
    },
  });
  
  // Reset form with template when dialog opens or message type changes
  useEffect(() => {
    if (open) {
      const newTemplate = messageTemplates[validType] || messageTemplates.general;
      form.reset({
        subject: newTemplate.subject,
        threadType: validType as any,
        priority: validType === "urgent" ? "urgent" : "normal",
        recipientRole: "provider",
        initialMessage: newTemplate.message,
      });
    }
  }, [open, validType, form]);

  const createThreadMutation = useMutation({
    mutationFn: async (data: NewThreadForm) => {
      const threadRes = await apiRequest("POST", "/api/messages/threads", {
        subject: data.subject,
        threadType: data.threadType,
        priority: data.priority,
        participants: [
          { id: "current-user", name: "You", role: "patient" },
          { id: `${data.recipientRole}-1`, name: `Your ${data.recipientRole.replace("_", " ")}`, role: data.recipientRole },
        ],
      });
      
      const thread = await threadRes.json();
      
      await apiRequest("POST", `/api/messages/threads/${thread.id}/messages`, {
        content: data.initialMessage,
      });
      
      return thread;
    },
    onSuccess: (thread) => {
      onOpenChange(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      onThreadCreated(thread.id);
      toast({
        title: "Message sent",
        description: "Your message has been sent to your care team.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create message thread",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NewThreadForm) => {
    createThreadMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>
            Start a new conversation with your care team
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="recipientRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send to</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-recipient-role">
                        <SelectValue placeholder="Select recipient" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="provider">Primary Care Provider</SelectItem>
                      <SelectItem value="nurse">Nurse</SelectItem>
                      <SelectItem value="care_coordinator">Care Coordinator</SelectItem>
                      <SelectItem value="specialist">Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="threadType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-thread-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General Question</SelectItem>
                      <SelectItem value="prescription_request">Prescription Request</SelectItem>
                      <SelectItem value="appointment_follow_up">Appointment Follow-Up</SelectItem>
                      <SelectItem value="test_results">Test Results</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Brief description of your message" 
                      {...field}
                      data-testid="input-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="initialMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Type your message here..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="input-initial-message"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-new-thread"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createThreadMutation.isPending}
                data-testid="button-send-new-thread"
              >
                {createThreadMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type ThreadFilter = "all" | "unread" | "urgent" | "closed";

const validMessageTypes = ["general", "prescription_request", "appointment_follow_up", "test_results", "urgent", "billing"];

export default function Messages() {
  const [location, setLocation] = useLocation();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ThreadFilter>("all");
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [initialMessageType, setInitialMessageType] = useState<string>("general");
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, { userId: string; userName: string }>>(new Map());
  const processedQueryRef = useRef<string | null>(null);
  const processedThreadRef = useRef<string | null>(null);
  const { toast } = useToast();

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    if (event.type === "new_message" && event.conversationId) {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
      if (selectedThreadId === event.conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
      }
    } else if (event.type === "message_edited" || event.type === "message_deleted") {
      if (selectedThreadId && event.conversationId === selectedThreadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/messages/threads", selectedThreadId, "messages"] });
      }
    }
  }, [selectedThreadId]);

  const handleNotification = useCallback((event: MessageEvent) => {
    if (event.type === "notification" && event.title) {
      toast({
        title: event.title,
        description: event.body,
      });
      if (notificationsEnabled) {
        const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdHmBhYeFfXl2fH99h4eJgXt2eX2DhYeHgnt5e4CBhIWIhX58eX6BhIWHhYB9e3p/goSGh4aDfnt6foGDhYaGhH98e31/g4WGhoWBfXx7f4KDhoaFg398e31/goSFhYWDf3x7fX+Cg4WFhIN/fHt9f4KDhYWEg398e31/goOFhYSCf3x7fX+Cg4WFhIJ/fHt9f4KDhYWEgn98e31/goOFhYSCf3x7fX+Cg4WFhIJ/fHt9f4KDhYWEgn98e31/goOFhYSCf3x7fQ==");
        audio.volume = 0.3;
        audio.play().catch(() => {});
      }
    }
  }, [toast, notificationsEnabled]);

  const handleTyping = useCallback((conversationId: string, userId: string, userName: string) => {
    setTypingUsers(prev => {
      const next = new Map(prev);
      next.set(`${conversationId}-${userId}`, { userId, userName });
      setTimeout(() => {
        setTypingUsers(p => {
          const n = new Map(p);
          n.delete(`${conversationId}-${userId}`);
          return n;
        });
      }, 3000);
      return next;
    });
  }, []);

  const handleStoppedTyping = useCallback((conversationId: string, userId: string) => {
    setTypingUsers(prev => {
      const next = new Map(prev);
      next.delete(`${conversationId}-${userId}`);
      return next;
    });
  }, []);

  const {
    isConnected,
    subscribeToConversation,
    unsubscribeFromConversation,
    sendTyping,
    sendStoppedTyping,
    requestNotificationPermission,
  } = useMessagingWebSocket({
    userId: "current-user",
    userName: "You",
    onMessage: handleWebSocketMessage,
    onNotification: handleNotification,
    onTyping: handleTyping,
    onStoppedTyping: handleStoppedTyping,
  });

  useEffect(() => {
    if (selectedThreadId && isConnected) {
      subscribeToConversation(selectedThreadId);
      return () => {
        unsubscribeFromConversation(selectedThreadId);
      };
    }
  }, [selectedThreadId, isConnected, subscribeToConversation, unsubscribeFromConversation]);

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      await requestNotificationPermission();
    }
    setNotificationsEnabled(!notificationsEnabled);
  };
  
  // Handle URL query parameters for deep linking - reactive to location changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const typeFromUrl = urlParams.get("type");
    const threadFromUrl = urlParams.get("thread");
    
    // Handle thread selection from URL (e.g., from notification click)
    if (threadFromUrl && processedThreadRef.current !== threadFromUrl) {
      processedThreadRef.current = threadFromUrl;
      setSelectedThreadId(threadFromUrl);
      // Clear the URL params using wouter to stay in sync
      setLocation("/messages", { replace: true });
    }
    // Handle message type for new thread dialog
    else if (typeFromUrl && validMessageTypes.includes(typeFromUrl) && processedQueryRef.current !== typeFromUrl) {
      processedQueryRef.current = typeFromUrl;
      setInitialMessageType(typeFromUrl);
      setNewThreadOpen(true);
      // Clear the URL params using wouter to stay in sync
      setLocation("/messages", { replace: true });
    }
  }, [location, setLocation]);

  const { data: threads = [], isLoading } = useQuery<MessageThread[]>({
    queryKey: ["/api/messages/threads"],
  });

  const { data: ehrSyncStatus } = useQuery<Array<{
    ehrId: string;
    ehrName: string;
    lastSync: string | null;
    pendingInbound: number;
    pendingOutbound: number;
    status: "connected" | "syncing" | "error" | "disconnected";
  }>>({
    queryKey: ["/api/messages/ehr/sync-status"],
    refetchInterval: 60000,
  });

  const totalPendingInbound = ehrSyncStatus?.reduce((sum, s) => sum + s.pendingInbound, 0) || 0;
  const connectedEHRs = ehrSyncStatus?.filter(s => s.status === "connected").length || 0;

  const filteredThreads = useMemo(() => {
    switch (filter) {
      case "unread":
        return threads.filter(t => t.unreadCount > 0);
      case "urgent":
        return threads.filter(t => t.priority === "urgent" || t.priority === "high");
      case "closed":
        return threads.filter(t => t.isClosed);
      case "all":
      default:
        return threads.filter(t => !t.isClosed);
    }
  }, [threads, filter]);

  const unreadCount = threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const urgentCount = threads.filter(t => t.priority === "urgent" || t.priority === "high").length;

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleBackToList = () => {
    setSelectedThreadId(null);
  };

  return (
    <div className="container max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="h-6 w-6" />
            Message Center
          </h1>
          <p className="text-muted-foreground">Secure communication with your care team</p>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${isConnected ? "bg-green-500/10" : "bg-destructive/10"}`} data-testid="connection-status">
                {isConnected ? (
                  <Wifi className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5 text-destructive" />
                )}
                <span className="text-muted-foreground text-xs hidden sm:inline">
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isConnected ? "Real-time messaging active" : "Reconnecting..."}
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleNotifications}
                data-testid="button-toggle-notifications"
              >
                {notificationsEnabled ? (
                  <Bell className="h-4 w-4 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {notificationsEnabled ? "Notifications on" : "Enable notifications"}
            </TooltipContent>
          </Tooltip>

          {connectedEHRs > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-sm" data-testid="ehr-sync-status">
                  <Cloud className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-muted-foreground">{connectedEHRs} EHR{connectedEHRs > 1 ? "s" : ""}</span>
                  {totalPendingInbound > 0 && (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]" data-testid="badge-pending-ehr">
                      {totalPendingInbound} new
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                <p className="font-medium mb-1">Connected EHR Systems</p>
                {ehrSyncStatus?.map(ehr => (
                  <div key={ehr.ehrId} className="flex items-center justify-between gap-4 text-xs py-0.5">
                    <span>{ehr.ehrName}</span>
                    <span className={ehr.status === "connected" ? "text-green-600" : "text-muted-foreground"}>
                      {ehr.status === "connected" ? "Synced" : ehr.status}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground mt-1">
                  Messages sync automatically via FHIR
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          <Button onClick={() => setNewThreadOpen(true)} data-testid="button-new-message">
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>
        <NewThreadDialog 
          onThreadCreated={handleSelectThread}
          open={newThreadOpen}
          onOpenChange={setNewThreadOpen}
          messageType={initialMessageType}
        />
      </div>

      <div className="grid md:grid-cols-[350px_1fr] gap-4 h-[calc(100vh-200px)]">
        <Card className={`${selectedThreadId ? "hidden md:block" : ""}`}>
          <CardHeader className="pb-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as ThreadFilter)} className="w-full">
              <TabsList className="grid grid-cols-4 w-full" data-testid="tabs-message-filter">
                <TabsTrigger value="all" className="text-xs" data-testid="tab-all">
                  <Mail className="h-3.5 w-3.5 mr-1" />
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="text-xs relative" data-testid="tab-unread">
                  <MailOpen className="h-3.5 w-3.5 mr-1" />
                  Unread
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="urgent" className="text-xs" data-testid="tab-urgent">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  Priority
                </TabsTrigger>
                <TabsTrigger value="closed" className="text-xs" data-testid="tab-closed">
                  <Lock className="h-3.5 w-3.5 mr-1" />
                  Closed
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <ThreadList 
              threads={filteredThreads}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleSelectThread}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>

        <Card className={`${!selectedThreadId ? "hidden md:flex" : "flex"} flex-col`}>
          {selectedThreadId ? (
            <MessageView 
              threadId={selectedThreadId} 
              onBack={handleBackToList}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <MessageSquare className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
              <p className="text-muted-foreground mb-4">
                Choose a message thread from the list or start a new conversation
              </p>
              <Button onClick={() => setNewThreadOpen(true)} data-testid="button-new-message-empty">
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
