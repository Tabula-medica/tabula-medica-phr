import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  CreditCard,
  FileText,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Download,
  Share2,
  Phone,
  Mail,
  Building,
  Calendar,
  User,
  Shield,
  ChevronRight,
  Copy,
  Check,
  Send,
  Pill,
  Stethoscope,
  FileCheck,
  ClipboardList,
  Inbox,
  PlusCircle,
  ExternalLink,
  Eye,
  Printer,
} from "lucide-react";

interface PriorAuth {
  id: string;
  requestType: string;
  serviceName: string;
  provider: string;
  dateSubmitted: string;
  status: "pending" | "approved" | "denied" | "more_info";
  estimatedDecision?: string;
  referenceNumber: string;
  notes?: string;
}

interface PlanDocument {
  id: string;
  name: string;
  type: "eoc" | "formulary" | "sbc" | "network" | "other";
  description: string;
  lastUpdated: string;
  fileSize: string;
}

interface SecureMessage {
  id: string;
  subject: string;
  department: string;
  status: "open" | "closed" | "awaiting_response";
  lastUpdated: string;
  preview: string;
}

const mockMemberInfo = {
  name: "Michael Johnson",
  memberId: "XYZ123456789",
  groupNumber: "GRP-987654",
  planName: "Premium Choice PPO",
  effectiveDate: "2026-01-01",
  rxBin: "610014",
  rxPcn: "MEDDPRIME",
  rxGroup: "RX8847",
  copays: {
    primaryCare: "$25",
    specialist: "$50",
    urgentCare: "$75",
    emergency: "$250",
  },
  deductible: {
    individual: "$1,500",
    family: "$3,000",
    met: "$847",
  },
  outOfPocketMax: {
    individual: "$6,500",
    family: "$13,000",
  },
};

const mockPriorAuths: PriorAuth[] = [
  {
    id: "pa-1",
    requestType: "Medication",
    serviceName: "Ozempic 1mg",
    provider: "Dr. Sarah Johnson",
    dateSubmitted: "2026-01-15",
    status: "pending",
    estimatedDecision: "2026-01-22",
    referenceNumber: "PA-2026-00123",
  },
  {
    id: "pa-2",
    requestType: "Imaging",
    serviceName: "MRI - Lumbar Spine",
    provider: "City Radiology",
    dateSubmitted: "2026-01-10",
    status: "approved",
    referenceNumber: "PA-2026-00098",
    notes: "Approved for 1 procedure within 60 days",
  },
  {
    id: "pa-3",
    requestType: "Procedure",
    serviceName: "Physical Therapy - 12 sessions",
    provider: "Active Recovery PT",
    dateSubmitted: "2026-01-05",
    status: "more_info",
    referenceNumber: "PA-2026-00076",
    notes: "Additional documentation requested from provider",
  },
  {
    id: "pa-4",
    requestType: "Medication",
    serviceName: "Humira Pen",
    provider: "Dr. Michael Chen",
    dateSubmitted: "2025-12-20",
    status: "denied",
    referenceNumber: "PA-2025-04521",
    notes: "Step therapy required - try Enbrel first",
  },
];

const mockDocuments: PlanDocument[] = [
  {
    id: "doc-1",
    name: "Evidence of Coverage 2026",
    type: "eoc",
    description: "Complete plan benefits, coverage details, and member rights",
    lastUpdated: "2025-12-15",
    fileSize: "4.2 MB",
  },
  {
    id: "doc-2",
    name: "Prescription Drug Formulary",
    type: "formulary",
    description: "List of covered medications and tier information",
    lastUpdated: "2026-01-01",
    fileSize: "1.8 MB",
  },
  {
    id: "doc-3",
    name: "Summary of Benefits and Coverage",
    type: "sbc",
    description: "Plain-language summary of your plan benefits",
    lastUpdated: "2025-12-15",
    fileSize: "856 KB",
  },
  {
    id: "doc-4",
    name: "Provider Network Directory",
    type: "network",
    description: "List of in-network doctors, hospitals, and facilities",
    lastUpdated: "2026-01-10",
    fileSize: "12.4 MB",
  },
  {
    id: "doc-5",
    name: "Prior Authorization Requirements",
    type: "other",
    description: "Services and medications requiring prior authorization",
    lastUpdated: "2026-01-01",
    fileSize: "432 KB",
  },
];

const mockMessages: SecureMessage[] = [
  {
    id: "msg-1",
    subject: "Claim inquiry - Visit on 1/10/2026",
    department: "Claims",
    status: "awaiting_response",
    lastUpdated: "2026-01-16",
    preview: "Thank you for your inquiry. We are reviewing the claim...",
  },
  {
    id: "msg-2",
    subject: "ID card replacement request",
    department: "Member Services",
    status: "closed",
    lastUpdated: "2026-01-12",
    preview: "Your replacement ID cards have been mailed...",
  },
  {
    id: "msg-3",
    subject: "Question about specialist referral",
    department: "Member Services",
    status: "open",
    lastUpdated: "2026-01-08",
    preview: "I have a question about whether I need a referral...",
  },
];

const messageDepartments = [
  { value: "member_services", label: "Member Services" },
  { value: "claims", label: "Claims & Billing" },
  { value: "prior_auth", label: "Prior Authorizations" },
  { value: "pharmacy", label: "Pharmacy Benefits" },
  { value: "appeals", label: "Appeals & Grievances" },
];

function getAuthStatusBadge(status: string) {
  switch (status) {
    case "approved": return <Badge variant="default" className="bg-green-600">Approved</Badge>;
    case "denied": return <Badge variant="destructive">Denied</Badge>;
    case "pending": return <Badge variant="secondary">Pending Review</Badge>;
    case "more_info": return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Info Needed</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function getAuthStatusIcon(status: string) {
  switch (status) {
    case "approved": return <CheckCircle className="h-5 w-5 text-green-600" />;
    case "denied": return <XCircle className="h-5 w-5 text-red-600" />;
    case "pending": return <Clock className="h-5 w-5 text-blue-600" />;
    case "more_info": return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    default: return <Clock className="h-5 w-5" />;
  }
}

function getDocTypeIcon(type: string) {
  switch (type) {
    case "eoc": return <FileCheck className="h-5 w-5" />;
    case "formulary": return <Pill className="h-5 w-5" />;
    case "sbc": return <ClipboardList className="h-5 w-5" />;
    case "network": return <Stethoscope className="h-5 w-5" />;
    default: return <FileText className="h-5 w-5" />;
  }
}

function DigitalIDCard() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showBack, setShowBack] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(mockMemberInfo.memberId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Member ID copied" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Digital ID Card</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBack(!showBack)} data-testid="button-toggle-card">
            {showBack ? "Show Front" : "Show Back"}
          </Button>
          <Button variant="outline" size="sm" data-testid="button-print-id">
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-blue-600 to-blue-800 text-white overflow-hidden">
        {!showBack ? (
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6" />
                <span className="font-bold text-lg">HealthFirst</span>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white">
                {mockMemberInfo.planName}
              </Badge>
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-blue-200">Member Name</div>
                <div className="text-lg font-medium">{mockMemberInfo.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-blue-200">Member ID</div>
                  <div className="font-mono flex items-center gap-2">
                    {mockMemberInfo.memberId}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-white"
                      onClick={handleCopyId}
                      data-testid="button-copy-member-id"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-blue-200">Group Number</div>
                  <div className="font-mono">{mockMemberInfo.groupNumber}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="text-xs text-blue-200">Effective Date</div>
                  <div>{mockMemberInfo.effectiveDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-blue-200">Copays</div>
                  <div className="text-sm">
                    PCP: {mockMemberInfo.copays.primaryCare} | Spec: {mockMemberInfo.copays.specialist}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-blue-200 mb-1">Pharmacy / Rx Information</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-blue-200">BIN</div>
                    <div className="font-mono">{mockMemberInfo.rxBin}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-200">PCN</div>
                    <div className="font-mono">{mockMemberInfo.rxPcn}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-200">Group</div>
                    <div className="font-mono">{mockMemberInfo.rxGroup}</div>
                  </div>
                </div>
              </div>
              <Separator className="bg-white/20" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-blue-200">Urgent Care</div>
                  <div>{mockMemberInfo.copays.urgentCare}</div>
                </div>
                <div>
                  <div className="text-xs text-blue-200">Emergency</div>
                  <div>{mockMemberInfo.copays.emergency}</div>
                </div>
              </div>
              <Separator className="bg-white/20" />
              <div className="text-xs text-blue-200">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="h-3 w-3" />
                  Member Services: 1-800-555-0123
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  24/7 Nurse Line: 1-800-555-0199
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Deductible Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span>Individual Deductible</span>
                <span className="font-medium">{mockMemberInfo.deductible.met} / {mockMemberInfo.deductible.individual}</span>
              </div>
              <Progress value={(847 / 1500) * 100} />
            </div>
            <div className="text-sm text-muted-foreground">
              Out-of-pocket max: {mockMemberInfo.outOfPocketMax.individual} (individual) / {mockMemberInfo.outOfPocketMax.family} (family)
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Benefits() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("id-card");
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [messageDept, setMessageDept] = useState("");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [selectedAuth, setSelectedAuth] = useState<PriorAuth | null>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const handleSendMessage = () => {
    if (!messageDept || !messageSubject.trim() || !messageBody.trim()) {
      toast({ title: "Please complete all fields", variant: "destructive" });
      return;
    }
    toast({ 
      title: "Message sent", 
      description: "You'll receive a response within 2 business days" 
    });
    setShowMessageDialog(false);
    setMessageDept("");
    setMessageSubject("");
    setMessageBody("");
  };

  const handleViewAuth = (auth: PriorAuth) => {
    setSelectedAuth(auth);
    setShowAuthDialog(true);
  };

  const handleDownloadDoc = (doc: PlanDocument) => {
    toast({ 
      title: "Download started", 
      description: `Downloading ${doc.name}` 
    });
  };

  const pendingAuths = mockPriorAuths.filter(a => a.status === "pending" || a.status === "more_info");
  const openMessages = mockMessages.filter(m => m.status !== "closed");

  return (
    <div className="p-6 space-y-6" data-testid="page-benefits">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Benefits Hub
          </h1>
          <p className="text-muted-foreground">
            Your plan information, documents, and member services
          </p>
        </div>
      </div>

      <Card className="p-4 bg-muted/50">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-medium">Administrative Services Only</h4>
            <p className="text-sm text-muted-foreground">
              This hub provides access to your plan documents, ID card, authorization status, and administrative inquiries.
              For medical questions or health concerns, please contact your healthcare provider directly.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{mockMemberInfo.planName}</div>
              <div className="text-sm text-muted-foreground">Your Plan</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{pendingAuths.length}</div>
              <div className="text-sm text-muted-foreground">Pending Auths</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{mockDocuments.length}</div>
              <div className="text-sm text-muted-foreground">Plan Documents</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{openMessages.length}</div>
              <div className="text-sm text-muted-foreground">Open Messages</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="id-card" data-testid="tab-id-card">
            <CreditCard className="h-4 w-4 mr-2" />
            ID Card
          </TabsTrigger>
          <TabsTrigger value="prior-auth" data-testid="tab-prior-auth">
            <Clock className="h-4 w-4 mr-2" />
            Prior Auth
            {pendingAuths.length > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingAuths.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
            {openMessages.length > 0 && (
              <Badge variant="secondary" className="ml-2">{openMessages.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="id-card">
          <div className="max-w-xl">
            <DigitalIDCard />
          </div>
        </TabsContent>

        <TabsContent value="prior-auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prior Authorization Status</CardTitle>
              <CardDescription>
                Track the status of your prior authorization requests
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockPriorAuths.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Prior Authorizations</h3>
                  <p className="text-muted-foreground">
                    You don't have any prior authorization requests at this time.
                  </p>
                </div>
              ) : (
                mockPriorAuths.map((auth) => (
                  <div 
                    key={auth.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => handleViewAuth(auth)}
                    data-testid={`card-auth-${auth.id}`}
                  >
                    <div className="flex items-center gap-4">
                      {getAuthStatusIcon(auth.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{auth.serviceName}</span>
                          {getAuthStatusBadge(auth.status)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {auth.requestType} | {auth.provider}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Submitted: {auth.dateSubmitted} | Ref: {auth.referenceNumber}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">About Prior Authorizations</h4>
                <p className="text-sm text-muted-foreground">
                  Prior authorizations are submitted by your healthcare provider. 
                  If you have questions about a pending request, please contact your provider's office.
                  This tracker shows status information only and does not constitute approval or denial.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Documents</CardTitle>
              <CardDescription>
                Important documents about your health plan coverage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockDocuments.map((doc) => (
                <div 
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover-elevate"
                  data-testid={`card-doc-${doc.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted">
                      {getDocTypeIcon(doc.type)}
                    </div>
                    <div>
                      <div className="font-medium">{doc.name}</div>
                      <p className="text-sm text-muted-foreground">{doc.description}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        Updated: {doc.lastUpdated} | {doc.fileSize}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" data-testid={`button-view-${doc.id}`} aria-label="View document">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleDownloadDoc(doc)}
                      data-testid={`button-download-${doc.id}`}
                      aria-label="Download document"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Secure Messages</h3>
              <p className="text-sm text-muted-foreground">
                Non-clinical inquiries about your plan, claims, and benefits
              </p>
            </div>
            <Button onClick={() => setShowMessageDialog(true)} data-testid="button-new-message">
              <PlusCircle className="h-4 w-4 mr-2" />
              New Message
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {mockMessages.length === 0 ? (
                <div className="text-center py-8">
                  <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Messages</h3>
                  <p className="text-muted-foreground">
                    Start a conversation with member services.
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {mockMessages.map((msg) => (
                    <div 
                      key={msg.id}
                      className="flex items-center justify-between p-4 hover-elevate cursor-pointer"
                      data-testid={`card-message-${msg.id}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${
                          msg.status === "awaiting_response" ? "bg-blue-100 dark:bg-blue-900/30" :
                          msg.status === "open" ? "bg-yellow-100 dark:bg-yellow-900/30" :
                          "bg-muted"
                        }`}>
                          <MessageSquare className={`h-5 w-5 ${
                            msg.status === "awaiting_response" ? "text-blue-600" :
                            msg.status === "open" ? "text-yellow-600" :
                            "text-muted-foreground"
                          }`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{msg.subject}</span>
                            {msg.status === "awaiting_response" && (
                              <Badge variant="default" className="bg-blue-600">Response Sent</Badge>
                            )}
                            {msg.status === "open" && (
                              <Badge variant="secondary">Open</Badge>
                            )}
                            {msg.status === "closed" && (
                              <Badge variant="outline">Closed</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate max-w-md">
                            {msg.preview}
                          </p>
                          <div className="text-xs text-muted-foreground mt-1">
                            {msg.department} | Last updated: {msg.lastUpdated}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="p-4 bg-muted/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Non-Clinical Messaging Only</h4>
                <p className="text-sm text-muted-foreground">
                  This secure messaging system is for administrative and benefits questions only.
                  For medical concerns, please contact your healthcare provider directly.
                  Messages are typically answered within 2 business days.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              New Secure Message
            </DialogTitle>
            <DialogDescription>
              Send a non-clinical inquiry to member services
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={messageDept} onValueChange={setMessageDept}>
                <SelectTrigger data-testid="select-message-dept">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {messageDepartments.map(dept => (
                    <SelectItem key={dept.value} value={dept.value}>{dept.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-subject">Subject</Label>
              <Input
                id="msg-subject"
                placeholder="Brief description of your inquiry"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                data-testid="input-message-subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-body">Message</Label>
              <Textarea
                id="msg-body"
                placeholder="Please describe your question or concern..."
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={5}
                data-testid="input-message-body"
              />
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Administrative Questions Only</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    This is for benefits, claims, and member services questions.
                    For medical questions, contact your healthcare provider.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMessageDialog(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} data-testid="button-send-message">
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Prior Authorization Details</DialogTitle>
          </DialogHeader>
          {selectedAuth && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{selectedAuth.serviceName}</h3>
                {getAuthStatusBadge(selectedAuth.status)}
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Request Type</div>
                  <div className="font-medium">{selectedAuth.requestType}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Provider</div>
                  <div className="font-medium">{selectedAuth.provider}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Date Submitted</div>
                  <div className="font-medium">{selectedAuth.dateSubmitted}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Reference Number</div>
                  <div className="font-mono">{selectedAuth.referenceNumber}</div>
                </div>
                {selectedAuth.estimatedDecision && (
                  <div className="col-span-2">
                    <div className="text-muted-foreground">Estimated Decision</div>
                    <div className="font-medium">{selectedAuth.estimatedDecision}</div>
                  </div>
                )}
              </div>

              {selectedAuth.notes && (
                <>
                  <Separator />
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Notes</div>
                    <div className={`p-3 rounded-lg text-sm ${
                      selectedAuth.status === "approved" ? "bg-green-50 dark:bg-green-900/20" :
                      selectedAuth.status === "denied" ? "bg-red-50 dark:bg-red-900/20" :
                      selectedAuth.status === "more_info" ? "bg-yellow-50 dark:bg-yellow-900/20" :
                      "bg-muted"
                    }`}>
                      {selectedAuth.notes}
                    </div>
                  </div>
                </>
              )}

              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <p>
                  For questions about this authorization, please contact your provider's office 
                  or call Member Services at 1-800-555-0123.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
