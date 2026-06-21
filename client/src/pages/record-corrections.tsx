import { useState } from "react";
import { formatDateTime } from "@/components/shared/format-helpers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  User,
  Pill,
  FlaskConical,
  FileText,
  ClipboardList,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Send,
  MessageSquare,
  History,
  Shield,
  Flag,
  Edit,
  Eye,
  Trash2,
  ChevronRight,
} from "lucide-react";

interface CorrectionCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  examples: string[];
}

interface CorrectionRequest {
  id: string;
  category: string;
  summary: string;
  details: string;
  recordType: string;
  recordDetails: string;
  status: "pending" | "under_review" | "approved" | "rejected" | "resolved";
  submittedAt: string;
  updatedAt: string;
  adminNotes?: string;
  resolution?: string;
}

const correctionCategories: CorrectionCategory[] = [
  {
    id: "wrong_person",
    label: "Wrong Person",
    description: "Records belonging to someone else appear in my file",
    icon: <User className="h-5 w-5" />,
    examples: ["Someone else's lab results", "Wrong patient name on documents", "Records from another person mixed in"],
  },
  {
    id: "wrong_allergy",
    label: "Wrong Allergy",
    description: "Allergy information is incorrect or missing",
    icon: <AlertTriangle className="h-5 w-5" />,
    examples: ["Allergy listed that I don't have", "Missing allergy not recorded", "Incorrect severity level"],
  },
  {
    id: "wrong_medication",
    label: "Wrong Medication",
    description: "Medication list is inaccurate",
    icon: <Pill className="h-5 w-5" />,
    examples: ["Medication I stopped taking still listed", "Wrong dosage shown", "Missing current medication"],
  },
  {
    id: "duplicate_labs",
    label: "Duplicate Labs",
    description: "Lab results appear more than once",
    icon: <FlaskConical className="h-5 w-5" />,
    examples: ["Same test appearing twice", "Repeated results from same date", "Duplicate entries from different sources"],
  },
  {
    id: "outdated_problems",
    label: "Outdated Problem List",
    description: "Conditions or diagnoses need updating",
    icon: <ClipboardList className="h-5 w-5" />,
    examples: ["Resolved condition still listed", "Condition I was never diagnosed with", "Missing current diagnosis"],
  },
  {
    id: "other",
    label: "Other Data Issue",
    description: "Other inaccuracies in my health record",
    icon: <FileText className="h-5 w-5" />,
    examples: ["Incorrect contact information", "Wrong date of birth", "Insurance information outdated"],
  },
];

const mockRequests: CorrectionRequest[] = [
  {
    id: "req-1",
    category: "wrong_medication",
    summary: "Medication listed as active but is not current",
    details: "This medication is no longer on my current list. Please update the status in my records.",
    recordType: "Medication",
    recordDetails: "Lisinopril 10mg",
    status: "under_review",
    submittedAt: "2026-01-15T10:30:00Z",
    updatedAt: "2026-01-16T09:00:00Z",
    adminNotes: "Verification in progress",
  },
  {
    id: "req-2",
    category: "duplicate_labs",
    summary: "Lab results from Jan 10 appear twice",
    details: "Results from January 10, 2026 are showing up twice in my lab history. One entry should be removed.",
    recordType: "Lab Results",
    recordDetails: "CBC - Complete Blood Count",
    status: "resolved",
    submittedAt: "2026-01-12T14:20:00Z",
    updatedAt: "2026-01-14T11:00:00Z",
    resolution: "Duplicate entry removed. Thank you for reporting this data quality issue.",
  },
  {
    id: "req-3",
    category: "wrong_allergy",
    summary: "Allergy record appears to be incorrect",
    details: "This allergy entry does not match my records. Please verify and update.",
    recordType: "Allergy",
    recordDetails: "Penicillin - Severe",
    status: "pending",
    submittedAt: "2026-01-18T08:45:00Z",
    updatedAt: "2026-01-18T08:45:00Z",
  },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge variant="secondary">Pending Review</Badge>;
    case "under_review": return <Badge variant="outline">Under Review</Badge>;
    case "approved": return <Badge variant="default">Approved</Badge>;
    case "rejected": return <Badge variant="destructive">Rejected</Badge>;
    case "resolved": return <Badge variant="default">Resolved</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function getCategoryIcon(categoryId: string) {
  const category = correctionCategories.find(c => c.id === categoryId);
  return category?.icon || <FileText className="h-5 w-5" />;
}

function getCategoryLabel(categoryId: string) {
  const category = correctionCategories.find(c => c.id === categoryId);
  return category?.label || categoryId;
}

export default function RecordCorrections() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("submit");
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [requests, setRequests] = useState<CorrectionRequest[]>(mockRequests);
  const [viewingRequest, setViewingRequest] = useState<CorrectionRequest | null>(null);

  const [newRequest, setNewRequest] = useState({
    summary: "",
    details: "",
    recordType: "",
    recordDetails: "",
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const reviewCount = requests.filter(r => r.status === "under_review").length;
  const resolvedCount = requests.filter(r => r.status === "resolved" || r.status === "approved").length;

  const handleSubmitRequest = () => {
    if (!selectedCategory || !newRequest.summary.trim() || !newRequest.details.trim()) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const request: CorrectionRequest = {
      id: `req-${Date.now()}`,
      category: selectedCategory,
      summary: newRequest.summary,
      details: newRequest.details,
      recordType: newRequest.recordType || getCategoryLabel(selectedCategory),
      recordDetails: newRequest.recordDetails,
      status: "pending",
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setRequests([request, ...requests]);
    setNewRequest({ summary: "", details: "", recordType: "", recordDetails: "" });
    setSelectedCategory("");
    setShowNewRequest(false);
    setActiveTab("history");
    toast({ title: "Correction Request Submitted", description: "Your request has been submitted for review." });
  };

  const handleCancelRequest = (requestId: string) => {
    setRequests(requests.filter(r => r.id !== requestId));
    toast({ title: "Request Cancelled", description: "Your correction request has been cancelled." });
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-record-corrections">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" />
            Record Corrections
          </h1>
          <p className="text-muted-foreground">
            Flag inaccuracies in your health records for review and correction
          </p>
        </div>
        <Button onClick={() => setShowNewRequest(true)} data-testid="button-new-request">
          <Plus className="h-4 w-4 mr-2" />
          Report an Issue
        </Button>
      </div>

      <div className="grid lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{reviewCount}</div>
              <div className="text-sm text-muted-foreground">Under Review</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{resolvedCount}</div>
              <div className="text-sm text-muted-foreground">Resolved</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Shield className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{requests.length}</div>
              <div className="text-sm text-muted-foreground">Total Requests</div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="submit" data-testid="tab-submit">
            <Flag className="h-4 w-4 mr-2" />
            Report Issue
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            My Requests
            {pendingCount + reviewCount > 0 && (
              <Badge variant="secondary" className="ml-2">{pendingCount + reviewCount}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What type of issue would you like to report?</CardTitle>
              <CardDescription>Select the category that best describes the error in your record</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {correctionCategories.map((category) => (
                  <Card
                    key={category.id}
                    className={`cursor-pointer hover-elevate transition-all ${
                      selectedCategory === category.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setShowNewRequest(true);
                    }}
                    data-testid={`card-category-${category.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedCategory === category.id ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          {category.icon}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{category.label}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{category.description}</p>
                          <div className="mt-3 space-y-1">
                            {category.examples.slice(0, 2).map((example, idx) => (
                              <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                                <ChevronRight className="h-3 w-3" />
                                {example}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Your Rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Under HIPAA and state regulations, you have the right to request corrections to your health records if you believe they contain inaccurate or incomplete information.
              </p>
              <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Request to amend incorrect information</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Receive a response within 60 days</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Add a statement of disagreement if denied</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <p className="text-sm">Have corrections shared with relevant parties</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {requests.length === 0 ? (
            <Card className="p-8 text-center">
              <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Correction Requests</h3>
              <p className="text-muted-foreground mb-4">You haven't submitted any correction requests yet</p>
              <Button onClick={() => setActiveTab("submit")}>
                <Plus className="h-4 w-4 mr-2" />
                Report an Issue
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} className="hover-elevate" data-testid={`card-request-${request.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          {getCategoryIcon(request.category)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{request.summary}</h3>
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{request.details}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">{getCategoryLabel(request.category)}</Badge>
                            </span>
                            <span>Submitted {formatDateTime(request.submittedAt)}</span>
                            {request.updatedAt !== request.submittedAt && (
                              <span>Updated {formatDateTime(request.updatedAt)}</span>
                            )}
                          </div>
                          {request.recordDetails && (
                            <p className="text-sm mt-2">
                              <span className="text-muted-foreground">Record: </span>
                              {request.recordDetails}
                            </p>
                          )}
                          {request.adminNotes && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 text-sm">
                              <p className="font-medium text-blue-700 dark:text-blue-300">Staff Note:</p>
                              <p className="text-blue-600 dark:text-blue-400">{request.adminNotes}</p>
                            </div>
                          )}
                          {request.resolution && (
                            <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 text-sm">
                              <p className="font-medium text-green-700 dark:text-green-300">Resolution:</p>
                              <p className="text-green-600 dark:text-green-400">{request.resolution}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {request.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                            data-testid={`button-cancel-${request.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showNewRequest} onOpenChange={setShowNewRequest}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report a Record Issue</DialogTitle>
            <DialogDescription>
              Provide details about the error in your health record
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Issue Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {correctionCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">Brief Summary *</Label>
              <Input
                id="summary"
                placeholder="e.g., Medication listed that I no longer take"
                value={newRequest.summary}
                onChange={(e) => setNewRequest({ ...newRequest, summary: e.target.value })}
                data-testid="input-summary"
              />
            </div>
            <div className="space-y-2">
              <Label>Record Type</Label>
              <Select value={newRequest.recordType} onValueChange={(v) => setNewRequest({ ...newRequest, recordType: v })}>
                <SelectTrigger data-testid="select-record-type">
                  <SelectValue placeholder="Select record type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Medication">Medication</SelectItem>
                  <SelectItem value="Allergy">Allergy</SelectItem>
                  <SelectItem value="Lab Results">Lab Results</SelectItem>
                  <SelectItem value="Diagnosis">Diagnosis</SelectItem>
                  <SelectItem value="Demographics">Demographics</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="record-details">Specific Record (if known)</Label>
              <Input
                id="record-details"
                placeholder="e.g., Name of medication or lab test"
                value={newRequest.recordDetails}
                onChange={(e) => setNewRequest({ ...newRequest, recordDetails: e.target.value })}
                data-testid="input-record-details"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Detailed Description *</Label>
              <Textarea
                id="details"
                placeholder="Please describe what is incorrect and what the correct information should be..."
                value={newRequest.details}
                onChange={(e) => setNewRequest({ ...newRequest, details: e.target.value })}
                rows={4}
                data-testid="input-details"
              />
            </div>
            <div className="p-3 bg-muted text-sm">
              <p className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Your request will be reviewed by our records team. You will receive updates on the status of your request.</span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewRequest(false)}>Cancel</Button>
            <Button onClick={handleSubmitRequest} data-testid="button-submit-request">
              <Send className="h-4 w-4 mr-2" />
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
