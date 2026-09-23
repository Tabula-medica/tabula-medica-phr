import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  Send,
  Stethoscope,
  ClipboardList,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Shield,
  Clock,
  Target,
  Syringe,
  FlaskConical,
  HeartPulse,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PatientData {
  demographics: {
    id: string;
    name: string;
    dateOfBirth: string;
    gender: string;
    age?: number;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
  conditions: Array<{
    name: string;
    code?: string;
    status: string;
    severity?: string;
    onsetDate?: string;
  }>;
  encounters: Array<{
    type: string;
    date: string;
    reason?: string;
  }>;
  allergies: Array<{
    substance: string;
    reaction?: string;
    severity?: string;
  }>;
  vitals: Array<{
    type: string;
    value: number;
    unit: string;
    date: string;
  }>;
  labResults: Array<{
    name: string;
    value: number;
    unit: string;
    date: string;
    abnormal?: boolean;
  }>;
}

interface ClinicalDocSnippet {
  id: string;
  type: string;
  title: string;
  content: string;
  sections: Array<{ header: string; text: string }>;
  suggestedIcdCodes: Array<{ code: string; description: string; confidence: number }>;
  suggestedCptCodes: Array<{ code: string; description: string }>;
  generatedAt: string;
  disclaimer: string;
}

interface ReferralNote {
  id: string;
  referralType: string;
  urgency: string;
  specialtyRecommendation: string;
  clinicalSummary: string;
  reasonForReferral: string;
  relevantHistory: string;
  currentMedications: string;
  relevantLabFindings: string;
  specificQuestions: string[];
  suggestedSpecialists: string[];
  generatedAt: string;
  disclaimer: string;
}

interface PreventiveCareOrder {
  id: string;
  orderType: string;
  name: string;
  description: string;
  guidelineSource: string;
  evidenceLevel: string;
  priority: string;
  dueStatus: string;
  lastPerformed?: string;
  nextDue?: string;
  patientAgeApplicability: string;
  contraindications: string[];
  disclaimer: string;
}

interface AIProviderAutomationPanelProps {
  patientId: string;
  patientData: PatientData;
}

export function AIProviderAutomationPanel({ patientId, patientData }: AIProviderAutomationPanelProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("documentation");
  const [docType, setDocType] = useState<string>("progress_note");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [visitReason, setVisitReason] = useState("");
  const [referralType, setReferralType] = useState<string>("specialist");
  const [targetCondition, setTargetCondition] = useState("");
  const [urgency, setUrgency] = useState<string>("routine");
  const [generatedDoc, setGeneratedDoc] = useState<ClinicalDocSnippet | null>(null);
  const [generatedReferral, setGeneratedReferral] = useState<ReferralNote | null>(null);
  const [preventiveOrders, setPreventiveOrders] = useState<PreventiveCareOrder[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "Content has been copied successfully.",
    });
  };

  const docMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-provider-automation/clinical-documentation/${patientId}`, {
        patientData,
        documentType: docType,
        encounterContext: {
          chiefComplaint: chiefComplaint || undefined,
          reason: visitReason || undefined,
        },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedDoc(data.data);
        toast({
          title: "Documentation Generated",
          description: "Clinical documentation snippet has been generated.",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate clinical documentation.",
      });
    },
  });

  const referralMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-provider-automation/referral-note/${patientId}`, {
        patientData,
        referralType,
        targetCondition,
        urgency,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setGeneratedReferral(data.data);
        toast({
          title: "Referral Note Generated",
          description: "Referral note has been drafted.",
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate referral note.",
      });
    },
  });

  const preventiveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/ai-provider-automation/preventive-care-orders/${patientId}`, {
        patientData,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPreventiveOrders(data.data);
        toast({
          title: "Preventive Care Recommendations",
          description: `${data.data.length} recommendations generated.`,
        });
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate preventive care orders.",
      });
    },
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive" data-testid="badge-priority-high">High Priority</Badge>;
      case "medium":
        return <Badge variant="secondary" data-testid="badge-priority-medium">Medium</Badge>;
      default:
        return <Badge variant="outline" data-testid="badge-priority-low">Low</Badge>;
    }
  };

  const getDueStatusBadge = (status: string) => {
    switch (status) {
      case "overdue":
        return <Badge variant="destructive" data-testid="badge-status-overdue">Overdue</Badge>;
      case "due_soon":
        return <Badge variant="secondary" data-testid="badge-status-due">Due Soon</Badge>;
      case "scheduled":
        return <Badge variant="outline" data-testid="badge-status-scheduled">Scheduled</Badge>;
      default:
        return <Badge variant="default" data-testid="badge-status-uptodate">Up to Date</Badge>;
    }
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "screening":
        return <Target className="h-4 w-4" />;
      case "vaccination":
        return <Syringe className="h-4 w-4" />;
      case "lab":
        return <FlaskConical className="h-4 w-4" />;
      case "counseling":
        return <HeartPulse className="h-4 w-4" />;
      default:
        return <Stethoscope className="h-4 w-4" />;
    }
  };

  return (
    <Card className="w-full" data-testid="ai-provider-automation-panel">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            <CardTitle>AI Provider Automation</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1" data-testid="badge-no-cds">
            <Shield className="h-3 w-3" />
            NO-CDS Compliant
          </Badge>
        </div>
        <CardDescription>
          Automate routine documentation tasks with AI assistance. All outputs require provider review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Informational Only</AlertTitle>
          <AlertDescription>
            AI-generated content is for documentation assistance only. All outputs must be reviewed and approved by a licensed provider.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="documentation" data-testid="tab-documentation">
              <FileText className="h-4 w-4 mr-2" />
              Documentation
            </TabsTrigger>
            <TabsTrigger value="referral" data-testid="tab-referral">
              <Send className="h-4 w-4 mr-2" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="preventive" data-testid="tab-preventive">
              <ClipboardList className="h-4 w-4 mr-2" />
              Preventive Care
            </TabsTrigger>
          </TabsList>

          <TabsContent value="documentation" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="ai-provider-automation-p-document-type" className="text-sm font-medium">Document Type</label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger id="ai-provider-automation-p-document-type" data-testid="select-doc-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="progress_note">Progress Note</SelectItem>
                    <SelectItem value="soap_note">SOAP Note</SelectItem>
                    <SelectItem value="assessment">Assessment</SelectItem>
                    <SelectItem value="plan">Plan</SelectItem>
                    <SelectItem value="hpi">History of Present Illness</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ai-provider-automation-p-visit-reason-optional" className="text-sm font-medium">Visit Reason (Optional)</label>
                <Input id="ai-provider-automation-p-visit-reason-optional"
                  placeholder="e.g., Follow-up visit"
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  data-testid="input-visit-reason"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="ai-provider-automation-p-chief-complaint-optional" className="text-sm font-medium">Chief Complaint (Optional)</label>
              <Textarea id="ai-provider-automation-p-chief-complaint-optional"
                placeholder="Enter chief complaint if applicable..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                rows={2}
                data-testid="input-chief-complaint"
              />
            </div>
            <Button
              onClick={() => docMutation.mutate()}
              disabled={docMutation.isPending}
              className="w-full"
              data-testid="button-generate-documentation"
            >
              {docMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Documentation
                </>
              )}
            </Button>

            {generatedDoc && (
              <Card className="mt-4" data-testid="card-generated-doc">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg" data-testid="text-doc-title">{generatedDoc.title}</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(generatedDoc.content)}
                        data-testid="button-copy-doc"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    Generated {new Date(generatedDoc.generatedAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ScrollArea className="h-48 rounded-md border p-4">
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-doc-content">{generatedDoc.content}</p>
                  </ScrollArea>

                  {generatedDoc.sections.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium hover-elevate p-2 rounded-md w-full justify-between">
                        Sections ({generatedDoc.sections.length})
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-2">
                        {generatedDoc.sections.map((section, idx) => (
                          <div key={idx} className="border rounded-md p-3">
                            <h4 className="font-medium text-sm">{section.header}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{section.text}</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {generatedDoc.suggestedIcdCodes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Suggested ICD-10 Codes</h4>
                      <div className="flex flex-wrap gap-2">
                        {generatedDoc.suggestedIcdCodes.map((code, idx) => (
                          <Badge key={idx} variant="secondary" data-testid={`badge-icd-${idx}`}>
                            {code.code}: {code.description}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {generatedDoc.suggestedCptCodes.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Suggested CPT Codes</h4>
                      <div className="flex flex-wrap gap-2">
                        {generatedDoc.suggestedCptCodes.map((code, idx) => (
                          <Badge key={idx} variant="outline" data-testid={`badge-cpt-${idx}`}>
                            {code.code}: {code.description}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-xs">{generatedDoc.disclaimer}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="referral" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label htmlFor="ai-provider-automation-p-referral-type" className="text-sm font-medium">Referral Type</label>
                <Select value={referralType} onValueChange={setReferralType}>
                  <SelectTrigger id="ai-provider-automation-p-referral-type" data-testid="select-referral-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="specialist">Specialist</SelectItem>
                    <SelectItem value="imaging">Imaging</SelectItem>
                    <SelectItem value="procedure">Procedure</SelectItem>
                    <SelectItem value="therapy">Therapy</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ai-provider-automation-p-urgency" className="text-sm font-medium">Urgency</label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger id="ai-provider-automation-p-urgency" data-testid="select-urgency">
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergent">Emergent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ai-provider-automation-p-target-condition" className="text-sm font-medium">Target Condition</label>
                <Select value={targetCondition} onValueChange={setTargetCondition}>
                  <SelectTrigger id="ai-provider-automation-p-target-condition" data-testid="select-condition">
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    {patientData.conditions.filter(c => c.status === "active").map((condition, idx) => (
                      <SelectItem key={idx} value={condition.name}>
                        {condition.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other (specify in notes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={() => referralMutation.mutate()}
              disabled={referralMutation.isPending || !targetCondition}
              className="w-full"
              data-testid="button-generate-referral"
            >
              {referralMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Generate Referral Note
                </>
              )}
            </Button>

            {generatedReferral && (
              <Card className="mt-4" data-testid="card-generated-referral">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg" data-testid="text-referral-title">
                      {generatedReferral.specialtyRecommendation} Referral
                    </CardTitle>
                    <div className="flex gap-2">
                      <Badge
                        variant={generatedReferral.urgency === "emergent" ? "destructive" : generatedReferral.urgency === "urgent" ? "secondary" : "outline"}
                        data-testid="badge-referral-urgency"
                      >
                        {generatedReferral.urgency}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(`${generatedReferral.clinicalSummary}\n\nReason: ${generatedReferral.reasonForReferral}\n\n${generatedReferral.relevantHistory}`)}
                        data-testid="button-copy-referral"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Clinical Summary</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-clinical-summary">
                      {generatedReferral.clinicalSummary}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium mb-1">Reason for Referral</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-referral-reason">
                      {generatedReferral.reasonForReferral}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Relevant History</h4>
                    <p className="text-sm text-muted-foreground">{generatedReferral.relevantHistory}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-1">Current Medications</h4>
                    <p className="text-sm text-muted-foreground">{generatedReferral.currentMedications}</p>
                  </div>
                  {generatedReferral.specificQuestions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Specific Questions for Specialist</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {generatedReferral.specificQuestions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="text-xs">{generatedReferral.disclaimer}</AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="preventive" className="space-y-4 mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-muted-foreground">
                Based on {patientData.demographics.name}'s age ({patientData.demographics.age} y/o {patientData.demographics.gender}), history, and current guidelines.
              </p>
              <Button
                onClick={() => preventiveMutation.mutate()}
                disabled={preventiveMutation.isPending}
                data-testid="button-generate-preventive"
              >
                {preventiveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    Generate Recommendations
                  </>
                )}
              </Button>
            </div>

            {preventiveMutation.isPending && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            )}

            {preventiveOrders.length > 0 && (
              <div className="space-y-3" data-testid="preventive-orders-list">
                {preventiveOrders.map((order, idx) => (
                  <Card key={order.id} className="hover-elevate" data-testid={`card-preventive-${idx}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-muted">
                            {getOrderTypeIcon(order.orderType)}
                          </div>
                          <div>
                            <h4 className="font-medium" data-testid={`text-order-name-${idx}`}>{order.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">{order.description}</p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {order.guidelineSource}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                Evidence: {order.evidenceLevel}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {order.patientAgeApplicability}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPriorityBadge(order.priority)}
                          {getDueStatusBadge(order.dueStatus)}
                        </div>
                      </div>
                      {order.contraindications.length > 0 && (
                        <Alert className="mt-3" variant="destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Contraindications: {order.contraindications.join(", ")}
                          </AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))}
                <Alert className="mt-4">
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {preventiveOrders[0]?.disclaimer || "All recommendations must be reviewed by a licensed provider before ordering."}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {!preventiveMutation.isPending && preventiveOrders.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mb-3" />
                  <h4 className="font-medium">No Recommendations Yet</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click "Generate Recommendations" to analyze preventive care opportunities.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
