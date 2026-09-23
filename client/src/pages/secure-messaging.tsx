import { useState, useEffect, useRef } from "react";
import { PageGate } from "@/components/page-gate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getInitials } from "@/components/shared/ui-helpers";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { clickable } from "@/lib/a11y";
import {
  ArrowLeft,
  MessageSquare,
  Send,
  Shield,
  Lock,
  Users,
  Plus,
  Search,
  Pin,
  AlertTriangle,
  Clock,
  CheckCheck,
  Check,
  Mail,
  FileText,
  Calendar,
  Stethoscope,
  Download,
  MapPin,
  Phone,
  Globe,
  CircleDot,
  ClipboardList,
  Video,
  ChevronRight,
  Heart,
} from "lucide-react";

interface DocumentAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedBy: string;
  uploadedAt: string;
  description: string;
  isConfidential: boolean;
}

interface AppointmentProposal {
  id: string;
  providerId: string;
  providerName: string;
  appointmentType: string;
  proposedSlots: { date: string; time: string; duration: number }[];
  selectedSlot: { date: string; time: string; duration: number } | null;
  status: string;
  location: string;
  reason: string;
  notes: string;
  createdAt: string;
}

interface CareAdvice {
  id: string;
  category: string;
  urgency: string;
  summary: string;
  details: string;
  suggestedActions: string[];
  expiresAt: string | null;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  contentType: string;
  isEncrypted: boolean;
  readBy: string[];
  attachment?: DocumentAttachment;
  appointmentProposal?: AppointmentProposal;
  careAdvice?: CareAdvice;
  createdAt: string;
  updatedAt: string;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  isOnline: boolean;
  lastSeen: string;
}

interface Conversation {
  id: string;
  patientId: string;
  type: string;
  subject: string;
  participants: Participant[];
  lastMessage: Message | null;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  encryptionStatus: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

interface MessagingDashboard {
  totalConversations: number;
  unreadMessages: number;
  activeThreads: number;
  urgentMessages: number;
  careTeamMembers: number;
  averageResponseTime: string;
  sharedDocuments: number;
  upcomingAppointments: number;
  pendingAdvice: number;
}

interface CareTeamMemberProfile {
  id: string;
  name: string;
  role: string;
  specialty: string;
  department: string;
  phone: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
  availability: { day: string; hours: string }[];
  nextAvailable: string;
  bio: string;
  languages: string[];
  acceptingMessages: boolean;
  averageResponseTime: string;
  recentMessageCount: number;
  sharedDocuments: number;
  upcomingAppointments: number;
}

const PATIENT_ID = "patient-001";

function getRoleColor(role: string): string {
  switch (role) {
    case "provider": return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
    case "nurse": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "care_coordinator": return "bg-purple-500/15 text-purple-700 dark:text-purple-400";
    case "admin": return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    default: return "bg-muted text-muted-foreground";
  }
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "provider": return "Provider";
    case "nurse": return "Nurse";
    case "care_coordinator": return "Care Coordinator";
    case "admin": return "Admin";
    case "patient": return "You";
    default: return role;
  }
}


function formatTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffHrs = diffMs / 3600000;
  if (diffHrs < 1) return `${Math.max(1, Math.round(diffMs / 60000))}m ago`;
  if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
  if (diffHrs < 48) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function getFileTypeLabel(ft: string): string {
  const m: Record<string, string> = { lab_result: "Lab Result", referral_note: "Referral", prescription: "Rx", imaging: "Imaging", care_plan: "Care Plan", discharge_summary: "Discharge", insurance_eob: "Insurance EOB", other: "Document" };
  return m[ft] || "Document";
}

function getAdviceCategoryLabel(cat: string): string {
  const m: Record<string, string> = { medication: "Medication", lifestyle: "Lifestyle", follow_up: "Follow-up", symptom_management: "Symptoms", preventive: "Preventive", nutrition: "Nutrition", exercise: "Exercise" };
  return m[cat] || cat;
}

function getUrgencyColor(u: string): string {
  if (u === "time_sensitive") return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (u === "important") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

function ConversationItem({ conv, isSelected, onClick }: { conv: Conversation; isSelected: boolean; onClick: () => void }) {
  const otherParticipants = conv.participants.filter(p => p.role !== "patient");
  const mainParticipant = otherParticipants[0];
  const lastType = conv.lastMessage?.contentType;
  const typeIcon = lastType === "document" ? <FileText className="w-3 h-3 flex-shrink-0" /> : lastType === "appointment" ? <Calendar className="w-3 h-3 flex-shrink-0" /> : lastType === "advice" ? <Stethoscope className="w-3 h-3 flex-shrink-0" /> : null;

  return (
    <div
      className={`p-3 cursor-pointer transition-colors rounded-md ${isSelected ? "bg-accent" : "hover-elevate"}`}
      {...clickable(onClick)}
      data-testid={`conversation-item-${conv.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <Avatar>
            <AvatarFallback className={getRoleColor(mainParticipant?.role || "patient")}>
              {mainParticipant ? getInitials(mainParticipant.name) : "?"}
            </AvatarFallback>
          </Avatar>
          {mainParticipant?.isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {conv.isPinned && <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
              <span className="font-medium text-sm truncate" data-testid={`text-conv-subject-${conv.id}`}>
                {conv.subject}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            {conv.type === "care_team" && <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">Team</Badge>}
            {conv.priority === "urgent" && <Badge variant="outline" className="text-[10px] py-0 border-red-500/50 text-red-600 dark:text-red-400 no-default-active-elevate">Urgent</Badge>}
            <span className="text-xs text-muted-foreground truncate">
              {otherParticipants.map(p => p.name.split(" ")[0]).join(", ")}
            </span>
          </div>
          {conv.lastMessage && (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate flex-1 flex items-center gap-1">
                {typeIcon}
                {conv.lastMessage.senderRole === "patient" ? "You: " : `${conv.lastMessage.senderName.split(" ")[0]}: `}
                {conv.lastMessage.contentType === "document" ? `Shared ${conv.lastMessage.attachment?.fileName || "document"}` :
                 conv.lastMessage.contentType === "appointment" ? "Proposed appointment" :
                 conv.lastMessage.contentType === "advice" ? conv.lastMessage.careAdvice?.summary || "Care advice" :
                 conv.lastMessage.content.length > 50 ? conv.lastMessage.content.slice(0, 50) + "..." : conv.lastMessage.content}
              </p>
              {conv.unreadCount > 0 && (
                <Badge className="h-5 min-w-[20px] px-1.5 text-[10px]" data-testid={`badge-unread-${conv.id}`}>
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentCard({ attachment }: { attachment: DocumentAttachment }) {
  return (
    <Card className="mt-1" data-testid={`doc-card-${attachment.id}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-blue-500/15 flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{attachment.fileName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{getFileTypeLabel(attachment.fileType)}</Badge>
              <span className="text-[10px] text-muted-foreground">{attachment.fileSize}</span>
            </div>
            {attachment.description && (
              <p className="text-xs text-muted-foreground mt-1">{attachment.description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" data-testid={`button-download-${attachment.id}`}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AppointmentCard({ proposal, onConfirm }: { proposal: AppointmentProposal; onConfirm: (slot: { date: string; time: string; duration: number }) => void }) {
  const typeIcon = proposal.appointmentType === "telehealth" ? <Video className="w-4 h-4" /> : proposal.appointmentType === "phone" ? <Phone className="w-4 h-4" /> : <MapPin className="w-4 h-4" />;
  const typeLabel = proposal.appointmentType === "telehealth" ? "Telehealth" : proposal.appointmentType === "phone" ? "Phone Call" : "In Person";

  return (
    <Card className="mt-1" data-testid={`appt-card-${proposal.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Appointment Proposal</span>
          <Badge variant={proposal.status === "confirmed" ? "default" : "outline"} className="text-[10px] py-0 no-default-active-elevate" data-testid={`badge-appt-status-${proposal.id}`}>
            {proposal.status === "confirmed" ? "Confirmed" : proposal.status === "cancelled" ? "Cancelled" : "Pending"}
          </Badge>
        </div>
        <p className="text-sm mb-2">{proposal.reason}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
          {typeIcon}
          <span>{typeLabel}</span>
          <span>-</span>
          <span>{proposal.location}</span>
        </div>
        {proposal.notes && <p className="text-xs text-muted-foreground italic mb-2">{proposal.notes}</p>}
        {proposal.status === "proposed" && (
          <div className="space-y-1.5 mt-2">
            <p className="text-xs font-medium">Select a time slot:</p>
            {proposal.proposedSlots.map((slot, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{new Date(slot.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                  <span className="text-muted-foreground">at</span>
                  <span>{slot.time}</span>
                  <span className="text-xs text-muted-foreground">({slot.duration} min)</span>
                </div>
                <Button size="sm" onClick={() => onConfirm(slot)} data-testid={`button-confirm-slot-${proposal.id}-${i}`}>
                  Select
                </Button>
              </div>
            ))}
          </div>
        )}
        {proposal.status === "confirmed" && proposal.selectedSlot && (
          <div className="p-2 rounded-md bg-emerald-500/10 mt-2">
            <div className="flex items-center gap-2 text-sm">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-medium">
                {new Date(proposal.selectedSlot.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {proposal.selectedSlot.time}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CareAdviceCard({ advice }: { advice: CareAdvice }) {
  return (
    <Card className="mt-1" data-testid={`advice-card-${advice.id}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Stethoscope className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">{advice.summary}</span>
          <Badge variant="outline" className={`text-[10px] py-0 no-default-active-elevate ${getUrgencyColor(advice.urgency)}`}>
            {advice.urgency === "time_sensitive" ? "Time-Sensitive" : advice.urgency === "important" ? "Important" : "Routine"}
          </Badge>
          <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{getAdviceCategoryLabel(advice.category)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mb-2">{advice.details}</p>
        {advice.suggestedActions.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium">Recommended Actions:</p>
            <ul className="space-y-1">
              {advice.suggestedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CircleDot className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {advice.expiresAt && (
          <p className="text-[10px] text-muted-foreground mt-2 italic">
            Valid until {new Date(advice.expiresAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t text-[10px] text-muted-foreground">
          <Shield className="w-3 h-3" />
          <span>This is informational guidance only and does not replace in-person clinical assessment (NO-CDS).</span>
        </div>
      </CardContent>
    </Card>
  );
}

function MessageBubble({ message, isOwn, onConfirmAppt }: { message: Message; isOwn: boolean; onConfirmAppt: (apptId: string, slot: { date: string; time: string; duration: number }) => void }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3`} data-testid={`message-${message.id}`}>
      <div className={`max-w-[80%]`}>
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-medium">{message.senderName}</span>
            <Badge variant="outline" className={`text-[10px] py-0 no-default-active-elevate ${getRoleColor(message.senderRole)}`}>
              {getRoleLabel(message.senderRole)}
            </Badge>
          </div>
        )}
        {message.contentType === "text" && (
          <div className={`rounded-lg px-3 py-2 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        )}
        {message.contentType === "document" && (
          <div>
            <div className={`rounded-lg px-3 py-2 mb-1 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="text-sm">{message.content}</p>
            </div>
            {message.attachment && <DocumentCard attachment={message.attachment} />}
          </div>
        )}
        {message.contentType === "appointment" && (
          <div>
            <div className={`rounded-lg px-3 py-2 mb-1 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="text-sm">{message.content}</p>
            </div>
            {message.appointmentProposal && (
              <AppointmentCard
                proposal={message.appointmentProposal}
                onConfirm={(slot) => onConfirmAppt(message.appointmentProposal!.id, slot)}
              />
            )}
          </div>
        )}
        {message.contentType === "advice" && (
          <div>
            <div className={`rounded-lg px-3 py-2 mb-1 ${isOwn ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <p className="text-sm">{message.content}</p>
            </div>
            {message.careAdvice && <CareAdviceCard advice={message.careAdvice} />}
          </div>
        )}
        {message.contentType === "system" && (
          <div className="rounded-lg px-3 py-2 bg-muted/50 border border-dashed text-center">
            <p className="text-xs text-muted-foreground italic">{message.content}</p>
          </div>
        )}
        <div className={`flex items-center gap-1.5 mt-1 ${isOwn ? "justify-end" : ""}`}>
          <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.createdAt)}</span>
          {message.isEncrypted && <Lock className="w-2.5 h-2.5 text-muted-foreground" />}
          {isOwn && (
            message.readBy.length > 1
              ? <CheckCheck className="w-3 h-3 text-blue-500" />
              : <Check className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
      </div>
    </div>
  );
}

function CareTeamPanel({ profiles, onMessageMember }: { profiles: CareTeamMemberProfile[]; onMessageMember: (member: CareTeamMemberProfile) => void }) {
  const [selectedMember, setSelectedMember] = useState<CareTeamMemberProfile | null>(null);

  return (
    <div className="space-y-4" data-testid="panel-care-team">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-base">My Care Team</h3>
        <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{profiles.length} members</Badge>
      </div>

      <div className="space-y-2">
        {profiles.map(member => (
          <Card key={member.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedMember(selectedMember?.id === member.id ? null : member)} data-testid={`card-team-member-${member.id}`}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar>
                    <AvatarFallback className={getRoleColor(member.role)}>
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  {member.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm" data-testid={`text-member-name-${member.id}`}>{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.specialty}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] py-0 no-default-active-elevate ${getRoleColor(member.role)}`}>
                      {getRoleLabel(member.role)}
                    </Badge>
                    {member.acceptingMessages && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {member.averageResponseTime} avg
                      </span>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onMessageMember(member); }} data-testid={`button-message-member-${member.id}`}>
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </div>

              {selectedMember?.id === member.id && (
                <div className="mt-3 pt-3 border-t space-y-3" data-testid={`details-member-${member.id}`}>
                  <p className="text-xs text-muted-foreground">{member.bio}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-medium mb-1">Department</p>
                      <p className="text-xs text-muted-foreground">{member.department}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium mb-1">Languages</p>
                      <p className="text-xs text-muted-foreground">{member.languages.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium mb-1">Contact</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-2.5 h-2.5" /> {member.phone}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium mb-1">Next Available</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(member.nextAvailable).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium mb-1">Office Hours</p>
                    <div className="space-y-0.5">
                      {member.availability.map((a, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{a.day}</span>
                          <span>{a.hours}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{member.recentMessageCount}</p>
                      <p className="text-[10px] text-muted-foreground">Messages</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{member.sharedDocuments}</p>
                      <p className="text-[10px] text-muted-foreground">Documents</p>
                    </div>
                    <div className="p-2 rounded-md bg-muted/50">
                      <p className="text-lg font-bold">{member.upcomingAppointments}</p>
                      <p className="text-[10px] text-muted-foreground">Appts</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SecureMessaging() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [mainTab, setMainTab] = useState("messages");
  const [newConvOpen, setNewConvOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newRecipient, setNewRecipient] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: dashData, isLoading: dashLoading } = useQuery<{ success: boolean; dashboard: MessagingDashboard }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "dashboard"],
  });

  const { data: convsData, isLoading: convsLoading } = useQuery<{ success: boolean; conversations: Conversation[] }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "conversations"],
  });

  const { data: messagesData } = useQuery<{ success: boolean; messages: Message[] }>({
    queryKey: ["/api/infrastructure/messaging/conversation", selectedConvId, "messages"],
    enabled: !!selectedConvId,
  });

  const { data: teamData } = useQuery<{ success: boolean; team: Participant[] }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "care-team"],
  });

  const { data: profilesData } = useQuery<{ success: boolean; profiles: CareTeamMemberProfile[] }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "care-team-profiles"],
  });

  const { data: docsData } = useQuery<{ success: boolean; documents: DocumentAttachment[] }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "documents"],
  });

  const { data: apptsData } = useQuery<{ success: boolean; appointments: AppointmentProposal[] }>({
    queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "appointments"],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/infrastructure/messaging/conversation/${selectedConvId}/send`, {
        senderId: PATIENT_ID,
        senderName: "Alex Thompson",
        content: messageInput,
      });
      return res.json();
    },
    onSuccess: () => {
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging/conversation", selectedConvId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "dashboard"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to send message", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/infrastructure/messaging/conversation/create", {
        patientId: PATIENT_ID,
        subject: newSubject,
        participantIds: newRecipient ? [newRecipient] : [],
        type: "direct",
      });
      const data = await res.json();
      if (newMessage && data.conversation) {
        await apiRequest("POST", `/api/infrastructure/messaging/conversation/${data.conversation.id}/send`, {
          senderId: PATIENT_ID,
          senderName: "Alex Thompson",
          content: newMessage,
        });
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Conversation started", description: "Your message has been sent securely." });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging", PATIENT_ID] });
      setNewConvOpen(false);
      setNewSubject(""); setNewRecipient(""); setNewMessage("");
      if (data.conversation) {
        setSelectedConvId(data.conversation.id);
        setMainTab("messages");
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" }),
  });

  const confirmApptMutation = useMutation({
    mutationFn: async ({ appointmentId, selectedSlot }: { appointmentId: string; selectedSlot: { date: string; time: string; duration: number } }) => {
      const res = await apiRequest("POST", `/api/infrastructure/messaging/appointment/${appointmentId}/confirm`, { selectedSlot });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Appointment confirmed", description: "Your appointment has been scheduled." });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging/conversation", selectedConvId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/infrastructure/messaging", PATIENT_ID, "dashboard"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to confirm appointment", variant: "destructive" }),
  });

  const dashboard = dashData?.dashboard;
  const conversations = convsData?.conversations || [];
  const messages = messagesData?.messages || [];
  const careTeam = teamData?.team || [];
  const teamProfiles = profilesData?.profiles || [];
  const sharedDocs = docsData?.documents || [];
  const appointments = apptsData?.appointments || [];
  const isLoading = dashLoading || convsLoading;
  const selectedConv = selectedConvId ? conversations.find(c => c.id === selectedConvId) : null;

  const filteredConversations = conversations.filter(c => {
    if (filterType === "urgent" && c.priority !== "urgent") return false;
    if (filterType !== "all" && filterType !== "urgent" && c.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.subject.toLowerCase().includes(q) || c.participants.some(p => p.name.toLowerCase().includes(q));
    }
    return true;
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!messageInput.trim() || !selectedConvId) return;
    sendMutation.mutate();
  };

  const handleConfirmAppt = (apptId: string, slot: { date: string; time: string; duration: number }) => {
    confirmApptMutation.mutate({ appointmentId: apptId, selectedSlot: slot });
  };

  const handleMessageMember = (member: CareTeamMemberProfile) => {
    const existing = conversations.find(c =>
      c.type === "direct" && c.participants.some(p => p.id === member.id)
    );
    if (existing) {
      setSelectedConvId(existing.id);
      setMainTab("messages");
    } else {
      setNewRecipient(member.id);
      setNewSubject(`Message for ${member.name}`);
      setNewConvOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-secure-messaging">
      <PageGate feature="secure_messaging" />
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="page-title">
              <MessageSquare className="w-6 h-6 text-primary" />
              Secure Messages
            </h1>
            <p className="text-sm text-muted-foreground">
              HIPAA-compliant encrypted communication with your care team
            </p>
          </div>
        </div>
        <Dialog open={newConvOpen} onOpenChange={setNewConvOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-conversation">
              <Plus className="w-4 h-4 mr-2" />
              New Message
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                New Secure Message
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="secure-messaging-to">To</Label>
                <Select value={newRecipient} onValueChange={setNewRecipient}>
                  <SelectTrigger id="secure-messaging-to" data-testid="select-recipient"><SelectValue placeholder="Select care team member" /></SelectTrigger>
                  <SelectContent>
                    {(teamProfiles.length > 0 ? teamProfiles : careTeam).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({getRoleLabel(p.role)}{('specialty' in p) ? ` - ${(p as CareTeamMemberProfile).specialty}` : ''})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secure-messaging-subject">Subject</Label>
                <Input id="secure-messaging-subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g., Question about medication" data-testid="input-subject" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secure-messaging-message">Message</Label>
                <Textarea id="secure-messaging-message" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type your message..." className="min-h-[100px]" data-testid="input-message-content" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                <span>End-to-end encrypted. HIPAA-compliant messaging.</span>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewConvOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!newSubject || !newRecipient || createMutation.isPending} data-testid="button-send-new-message">
                {createMutation.isPending ? "Sending..." : "Send Message"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4" data-testid="section-messaging-stats">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-blue-500/15"><Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-unread">{dashboard?.unreadMessages || 0}</p>
                <p className="text-xs text-muted-foreground">Unread</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-emerald-500/15"><MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-active-threads">{dashboard?.activeThreads || 0}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-red-500/15"><AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-urgent">{dashboard?.urgentMessages || 0}</p>
                <p className="text-xs text-muted-foreground">Urgent</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-purple-500/15"><FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-documents">{dashboard?.sharedDocuments || 0}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-amber-500/15"><Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
              <div>
                <p className="text-2xl font-bold" data-testid="stat-appointments">{dashboard?.upcomingAppointments || 0}</p>
                <p className="text-xs text-muted-foreground">Appts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="w-4 h-4 mr-1.5" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="care-team" data-testid="tab-care-team">
            <Users className="w-4 h-4 mr-1.5" />
            My Care Team
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="w-4 h-4 mr-1.5" />
            Shared Documents
          </TabsTrigger>
          <TabsTrigger value="appointments" data-testid="tab-appointments">
            <Calendar className="w-4 h-4 mr-1.5" />
            Appointments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 500 }}>
            <Card className="lg:col-span-1 flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search conversations..." className="pl-8" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} data-testid="input-search-conversations" />
                  </div>
                  <Tabs value={filterType} onValueChange={setFilterType}>
                    <TabsList className="w-full">
                      <TabsTrigger value="all" className="flex-1 text-xs" data-testid="filter-all">All</TabsTrigger>
                      <TabsTrigger value="direct" className="flex-1 text-xs" data-testid="filter-direct">Direct</TabsTrigger>
                      <TabsTrigger value="care_team" className="flex-1 text-xs" data-testid="filter-care-team">Team</TabsTrigger>
                      <TabsTrigger value="urgent" className="flex-1 text-xs" data-testid="filter-urgent">Urgent</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full max-h-[450px]">
                  <div className="px-3 pb-3 space-y-1">
                    {filteredConversations.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No conversations found</p>
                      </div>
                    ) : (
                      filteredConversations.map(conv => (
                        <ConversationItem key={conv.id} conv={conv} isSelected={selectedConvId === conv.id} onClick={() => setSelectedConvId(conv.id)} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col">
              {selectedConv ? (
                <>
                  <CardHeader className="pb-3 flex-shrink-0 border-b">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <CardTitle className="text-base" data-testid="text-selected-subject">{selectedConv.subject}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Users className="w-3 h-3" />
                          {selectedConv.participants.filter(p => p.role !== "patient").map(p => p.name).join(", ")}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] no-default-active-elevate">
                          <Lock className="w-2.5 h-2.5 mr-1" />
                          Encrypted
                        </Badge>
                        {selectedConv.type === "care_team" && (
                          <Badge variant="outline" className="text-[10px] no-default-active-elevate">
                            <Users className="w-2.5 h-2.5 mr-1" /> Team
                          </Badge>
                        )}
                        {selectedConv.priority === "urgent" && (
                          <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-600 dark:text-red-400 no-default-active-elevate">
                            <AlertTriangle className="w-2.5 h-2.5 mr-1" /> Urgent
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full max-h-[350px] p-4">
                      {messages.map(msg => (
                        <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === PATIENT_ID} onConfirmAppt={handleConfirmAppt} />
                      ))}
                      <div ref={messagesEndRef} />
                    </ScrollArea>
                  </CardContent>
                  <div className="p-3 border-t flex-shrink-0">
                    <div className="flex items-end gap-2">
                      <Textarea
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                        }}
                        placeholder="Type a message... (Enter to send)"
                        className="min-h-[44px] max-h-[120px] resize-none flex-1"
                        data-testid="input-reply-message"
                      />
                      <Button size="icon" onClick={handleSend} disabled={!messageInput.trim() || sendMutation.isPending} data-testid="button-send-reply">
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                      <Shield className="w-3 h-3" />
                      <span>Messages are encrypted end-to-end and comply with HIPAA regulations</span>
                    </div>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <h3 className="font-semibold text-base mb-1" data-testid="text-select-prompt">Select a conversation</h3>
                    <p className="text-sm text-muted-foreground mb-4">Choose a thread from the left to view messages</p>
                    <Button variant="outline" onClick={() => setNewConvOpen(true)} data-testid="button-start-conversation">
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Conversation
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="care-team" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CareTeamPanel profiles={teamProfiles} onMessageMember={handleMessageMember} />
            </div>
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    Recent Communications
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[400px]">
                    <div className="px-4 pb-4 space-y-3">
                      {conversations.slice(0, 5).map(conv => {
                        const lastMsg = conv.lastMessage;
                        if (!lastMsg) return null;
                        const other = conv.participants.find(p => p.role !== "patient");
                        return (
                          <div key={conv.id} className="flex items-start gap-3 cursor-pointer hover-elevate p-2 rounded-md" {...clickable(() => { setSelectedConvId(conv.id); setMainTab("messages"); })} data-testid={`recent-comm-${conv.id}`}>
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarFallback className={`text-xs ${getRoleColor(other?.role || "provider")}`}>
                                {other ? getInitials(other.name) : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium truncate">{other?.name}</p>
                                <span className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(lastMsg.createdAt)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">{conv.subject}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                    <p>All communications are encrypted, HIPAA-compliant, and logged for security auditing.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Shared Documents
              </CardTitle>
              <CardDescription>Documents shared by your care team</CardDescription>
            </CardHeader>
            <CardContent>
              {sharedDocs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No shared documents yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sharedDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-md bg-muted/50" data-testid={`shared-doc-${doc.id}`}>
                      <div className="p-2 rounded-md bg-blue-500/15 flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.fileName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] py-0 no-default-active-elevate">{getFileTypeLabel(doc.fileType)}</Badge>
                          <span className="text-[10px] text-muted-foreground">{doc.fileSize}</span>
                          <span className="text-[10px] text-muted-foreground">{formatTime(doc.uploadedAt)}</span>
                        </div>
                        {doc.description && <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>}
                      </div>
                      <Button variant="ghost" size="icon" data-testid={`button-download-doc-${doc.id}`}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Appointments
              </CardTitle>
              <CardDescription>Scheduled and proposed appointments from your care team</CardDescription>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No appointments scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {appointments.map(appt => (
                    <Card key={appt.id} data-testid={`appointment-item-${appt.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs bg-blue-500/15 text-blue-700 dark:text-blue-400">
                                {getInitials(appt.providerName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{appt.providerName}</p>
                              <p className="text-xs text-muted-foreground">{appt.reason}</p>
                            </div>
                          </div>
                          <Badge variant={appt.status === "confirmed" ? "default" : appt.status === "cancelled" ? "outline" : "secondary"} className="no-default-active-elevate" data-testid={`badge-appt-status-list-${appt.id}`}>
                            {appt.status === "confirmed" ? "Confirmed" : appt.status === "cancelled" ? "Cancelled" : "Awaiting Selection"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 flex-wrap">
                          {appt.appointmentType === "telehealth" ? <Video className="w-3.5 h-3.5" /> : appt.appointmentType === "phone" ? <Phone className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          <span>{appt.appointmentType === "telehealth" ? "Telehealth" : appt.appointmentType === "phone" ? "Phone" : "In Person"}</span>
                          <span>-</span>
                          <span>{appt.location}</span>
                        </div>
                        {appt.notes && <p className="text-xs text-muted-foreground italic mb-3">{appt.notes}</p>}
                        {appt.status === "confirmed" && appt.selectedSlot && (
                          <div className="p-3 rounded-md bg-emerald-500/10 flex items-center gap-2">
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <span className="text-sm font-medium">
                              {new Date(appt.selectedSlot.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} at {appt.selectedSlot.time} ({appt.selectedSlot.duration} min)
                            </span>
                          </div>
                        )}
                        {appt.status === "proposed" && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium">Available time slots:</p>
                            {appt.proposedSlots.map((slot, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50">
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>{new Date(slot.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                                  <span className="text-muted-foreground">at</span>
                                  <span>{slot.time}</span>
                                  <span className="text-xs text-muted-foreground">({slot.duration} min)</span>
                                </div>
                                <Button size="sm" onClick={() => handleConfirmAppt(appt.id, slot)} data-testid={`button-confirm-appt-${appt.id}-${i}`}>
                                  Select
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
