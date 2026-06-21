import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
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
  FileText,
  Pill,
  MessageSquare,
  Loader2,
  Send,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  User,
  FileEdit,
  Sparkles,
  ArrowRight,
  Info,
  Download,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// ============== Referral Letter Generator ==============
interface ReferralLetterCardProps {
  patientId: string;
  patientName: string;
  patientData: {
    dateOfBirth: string;
    age: number;
    gender: string;
    conditions: string[];
    medications: string[];
    allergies: string[];
  };
  differentials?: Array<{
    condition: string;
    probability: "high" | "medium" | "low";
    supportingEvidence: string[];
  }>;
}

export function ReferralLetterCard({ patientId, patientName, patientData, differentials }: ReferralLetterCardProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [specialty, setSpecialty] = useState("");
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState<"routine" | "urgent" | "emergent">("routine");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [generatedLetter, setGeneratedLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: specialties } = useQuery<string[]>({
    queryKey: ["/api/referral-letters/specialties"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", `/api/referral-letters/${patientId}`, {
        patientData: {
          name: patientName,
          ...patientData,
        },
        differentials,
        referralReason: reason,
        specialtyType: specialty,
        urgency,
        additionalNotes,
        referringPhysician: "Dr. Smith",
        referringClinic: "Tabula Medica Clinic",
      });
      return result.json();
    },
    onSuccess: (data) => {
      setGeneratedLetter(data.letterContent);
      toast({ title: "Letter Generated", description: "Referral letter has been created as a draft." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate referral letter.", variant: "destructive" });
    },
  });

  const handleCopy = () => {
    if (generatedLetter) {
      navigator.clipboard.writeText(generatedLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setSpecialty("");
    setReason("");
    setUrgency("routine");
    setAdditionalNotes("");
    setGeneratedLetter(null);
  };

  return (
    <Card data-testid="card-referral-letter">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Send className="h-5 w-5 text-primary" />
          Referral Letter Generator
        </CardTitle>
        <CardDescription>
          Auto-generate referral letters based on patient data and differential diagnosis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-generate-referral">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Referral Letter
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Generate Referral Letter</DialogTitle>
              <DialogDescription>
                Create a referral letter for {patientName}
              </DialogDescription>
            </DialogHeader>

            {!generatedLetter ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Specialty Type</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger data-testid="select-specialty">
                      <SelectValue placeholder="Select specialty" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {specialties?.map((spec) => (
                        <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Reason for Referral</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe the reason for this referral..."
                    rows={3}
                    data-testid="textarea-referral-reason"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <Select value={urgency} onValueChange={(v: "routine" | "urgent" | "emergent") => setUrgency(v)}>
                    <SelectTrigger data-testid="select-urgency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      <SelectItem value="routine">Routine</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="emergent">Emergent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Additional Notes (Optional)</Label>
                  <Textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Any additional context..."
                    rows={2}
                    data-testid="textarea-additional-notes"
                  />
                </div>

                {differentials && differentials.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Differential diagnoses will be included</AlertTitle>
                    <AlertDescription>
                      {differentials.length} differential(s) will be referenced in the letter
                    </AlertDescription>
                  </Alert>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={!specialty || !reason || generateMutation.isPending}
                    data-testid="button-create-referral"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Letter
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Draft</Badge>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                
                <ScrollArea className="h-[400px] border rounded-lg p-4 bg-muted/30">
                  <pre className="text-sm whitespace-pre-wrap font-mono">{generatedLetter}</pre>
                </ScrollArea>

                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Auto-generated draft. Review and verify all content before sending.
                  </AlertDescription>
                </Alert>

                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Generate Another
                  </Button>
                  <Button onClick={() => setIsOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============== Prescription Draft Generator ==============
interface PrescriptionDraftCardProps {
  patientId: string;
  patientAllergies?: string[];
  currentMedications?: string[];
  conditions?: string[];
}

interface CommonMedication {
  name: string;
  genericName: string;
  category: string;
  defaultDosage: string;
  defaultFrequency: string;
  defaultRoute: string;
  defaultDuration: string;
  defaultQuantity: number;
  commonWarnings: string[];
}

interface PrescriptionDraft {
  id: string;
  medication: string;
  genericName: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
  warnings: string[];
  interactions: string[];
  status: string;
  disclaimer: string;
}

export function PrescriptionDraftCard({ patientId, patientAllergies = [], currentMedications = [], conditions = [] }: PrescriptionDraftCardProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState("");
  const [customDosage, setCustomDosage] = useState("");
  const [customFrequency, setCustomFrequency] = useState("");
  const [customDuration, setCustomDuration] = useState("");
  const [customQuantity, setCustomQuantity] = useState("");
  const [refills, setRefills] = useState("0");
  const [generatedDraft, setGeneratedDraft] = useState<PrescriptionDraft | null>(null);

  const { data: medData } = useQuery<{ medications: CommonMedication[]; categories: string[] }>({
    queryKey: ["/api/prescription-drafts/medications"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const customizations: Record<string, any> = {};
      if (customDosage) customizations.dosage = customDosage;
      if (customFrequency) customizations.frequency = customFrequency;
      if (customDuration) customizations.duration = customDuration;
      if (customQuantity) customizations.quantity = parseInt(customQuantity);
      if (refills) customizations.refills = parseInt(refills);

      const result = await apiRequest("POST", `/api/prescription-drafts/${patientId}`, {
        medicationName: selectedMed,
        customizations,
        allergies: patientAllergies,
        currentMedications,
        conditions,
      });
      return result.json();
    },
    onSuccess: (data) => {
      setGeneratedDraft(data);
      toast({ title: "Draft Created", description: "Prescription draft has been generated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate prescription draft.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedMed("");
    setCustomDosage("");
    setCustomFrequency("");
    setCustomDuration("");
    setCustomQuantity("");
    setRefills("0");
    setGeneratedDraft(null);
  };

  const selectedMedData = medData?.medications.find(m => m.name === selectedMed);

  return (
    <Card data-testid="card-prescription-draft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Pill className="h-5 w-5 text-primary" />
          Prescription Draft
        </CardTitle>
        <CardDescription>
          Create pre-filled prescription drafts for common medications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-generate-prescription">
              <Sparkles className="h-4 w-4 mr-2" />
              Create Prescription Draft
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Prescription Draft</DialogTitle>
              <DialogDescription>
                Select a medication and customize dosing
              </DialogDescription>
            </DialogHeader>

            {!generatedDraft ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Medication</Label>
                  <Select value={selectedMed} onValueChange={setSelectedMed}>
                    <SelectTrigger data-testid="select-medication">
                      <SelectValue placeholder="Select medication" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {medData?.medications.map((med) => (
                        <SelectItem key={med.name} value={med.name}>
                          <div className="flex items-center gap-2">
                            <span>{med.name}</span>
                            <Badge variant="outline" className="text-xs">{med.category}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedMedData && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                    <div><strong>Default:</strong> {selectedMedData.defaultDosage} {selectedMedData.defaultFrequency}</div>
                    <div><strong>Route:</strong> {selectedMedData.defaultRoute}</div>
                    <div><strong>Duration:</strong> {selectedMedData.defaultDuration}</div>
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Custom Dosage</Label>
                    <Input
                      value={customDosage}
                      onChange={(e) => setCustomDosage(e.target.value)}
                      placeholder={selectedMedData?.defaultDosage || "e.g., 10mg"}
                      data-testid="input-dosage"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Frequency</Label>
                    <Input
                      value={customFrequency}
                      onChange={(e) => setCustomFrequency(e.target.value)}
                      placeholder={selectedMedData?.defaultFrequency || "e.g., once daily"}
                      data-testid="input-frequency"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      value={customDuration}
                      onChange={(e) => setCustomDuration(e.target.value)}
                      placeholder={selectedMedData?.defaultDuration || "e.g., 30 days"}
                      data-testid="input-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder={String(selectedMedData?.defaultQuantity || 30)}
                      data-testid="input-quantity"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Refills</Label>
                  <Select value={refills} onValueChange={setRefills}>
                    <SelectTrigger data-testid="select-refills">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {[0, 1, 2, 3, 4, 5, 6, 11].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} refill{n !== 1 ? "s" : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={!selectedMed || generateMutation.isPending}
                    data-testid="button-create-prescription"
                  >
                    {generateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Generate Draft
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{generatedDraft.medication}</h4>
                    <Badge variant="outline">Draft</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div><strong>Dosage:</strong> {generatedDraft.dosage}</div>
                    <div><strong>Frequency:</strong> {generatedDraft.frequency}</div>
                    <div><strong>Route:</strong> {generatedDraft.route}</div>
                    <div><strong>Duration:</strong> {generatedDraft.duration}</div>
                    <div><strong>Quantity:</strong> {generatedDraft.quantity}</div>
                    <div><strong>Refills:</strong> {generatedDraft.refills}</div>
                  </div>
                  <Separator />
                  <div className="text-sm">
                    <strong>Instructions:</strong> {generatedDraft.instructions}
                  </div>
                </div>

                {generatedDraft.warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc ml-4 mt-1">
                        {generatedDraft.warnings.map((w, i) => (
                          <li key={i} className="text-sm">{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {generatedDraft.interactions.length > 0 && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Potential Interactions</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc ml-4 mt-1">
                        {generatedDraft.interactions.map((int, i) => (
                          <li key={i} className="text-sm">{int}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-xs text-muted-foreground text-center">
                  {generatedDraft.disclaimer}
                </p>

                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>
                    Create Another
                  </Button>
                  <Button onClick={() => setIsOpen(false)}>
                    Done
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============== Communication Summary Card ==============
interface CommunicationSummaryCardProps {
  patientId: string;
  patientName: string;
}

interface CommunicationSummary {
  id: string;
  summaryText: string;
  keyTopics: string[];
  actionItems: string[];
  pendingResponses: number;
  urgentItems: string[];
  totalMessages: number;
  dateRange: { start: string; end: string };
  disclaimer: string;
}

export function CommunicationSummaryCard({ patientId, patientName }: CommunicationSummaryCardProps) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<CommunicationSummary | null>(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("POST", `/api/communication-summaries/${patientId}`, {
        patientName,
      });
      return result.json();
    },
    onSuccess: (data) => {
      setSummary(data);
      toast({ title: "Summary Generated", description: "Communication summary has been created." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate summary.", variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-communication-summary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5 text-primary" />
          Communication Summary
        </CardTitle>
        <CardDescription>
          Summarize patient-clinician communication logs
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <Button
            className="w-full"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-summary"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Generate Summary
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{summary.totalMessages} messages</span>
              <span>
                {format(new Date(summary.dateRange.start), "MMM d")} - {format(new Date(summary.dateRange.end), "MMM d, yyyy")}
              </span>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm">{summary.summaryText}</p>
            </div>

            {summary.keyTopics.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2">Key Topics</h5>
                <div className="flex flex-wrap gap-1">
                  {summary.keyTopics.map((topic, i) => (
                    <Badge key={i} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}

            {summary.actionItems.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" />
                  Action Items
                </h5>
                <ul className="space-y-1">
                  {summary.actionItems.map((item, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.urgentItems.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Urgent Items ({summary.urgentItems.length})</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc ml-4">
                    {summary.urgentItems.map((item, i) => (
                      <li key={i} className="text-sm">{item}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {summary.pendingResponses > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-yellow-500" />
                <span>{summary.pendingResponses} pending response(s)</span>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setSummary(null)}
              data-testid="button-refresh-summary"
            >
              Refresh Summary
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {summary.disclaimer}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
