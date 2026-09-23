import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  Shield,
  ShieldCheck,
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  User,
  Users,
  Scale,
  Heart,
  Baby,
  Gavel,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FamilyVerification {
  id: string;
  userId: string;
  verificationType: string;
  relationshipType: string;
  patientName: string;
  requesterName: string;
  requesterEmail: string;
  documentFileName: string;
  documentUploadDate: string;
  attestationText: string;
  digitalSignature: string;
  status: "pending" | "verified" | "expired" | "revoked";
  submittedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  notes: string;
}

const VERIFICATION_TYPES = [
  {
    id: "hpoa",
    title: "Healthcare Power of Attorney (HPOA)",
    description: "Upload your Healthcare Power of Attorney document granting you authority to make healthcare decisions.",
    icon: Scale,
    requiredDocs: "Notarized HPOA document, valid government-issued ID",
    relationship: "Healthcare Proxy",
  },
  {
    id: "legal_guardian",
    title: "Legal Guardian Documentation",
    description: "Upload court-issued legal guardianship documentation.",
    icon: Gavel,
    requiredDocs: "Court order of guardianship, valid government-issued ID",
    relationship: "Legal Guardian",
  },
  {
    id: "parent_minor",
    title: "Parent/Minor Verification",
    description: "Verify parental rights for a child under 18 years of age.",
    icon: Baby,
    requiredDocs: "Birth certificate or adoption decree, parent's government-issued ID",
    relationship: "Parent",
  },
  {
    id: "spouse_partner",
    title: "Spouse/Domestic Partner Authorization",
    description: "Authorize access as a spouse or registered domestic partner.",
    icon: Heart,
    requiredDocs: "Marriage certificate or domestic partnership registration, valid government-issued ID",
    relationship: "Spouse/Domestic Partner",
  },
  {
    id: "court_appointed",
    title: "Court-Appointed Guardian",
    description: "Upload court documentation appointing you as guardian for healthcare decisions.",
    icon: Gavel,
    requiredDocs: "Court appointment order, valid government-issued ID",
    relationship: "Court-Appointed Guardian",
  },
];

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending: { label: "Pending Review", variant: "secondary", icon: Clock },
  verified: { label: "Verified", variant: "default", icon: CheckCircle2 },
  expired: { label: "Expired", variant: "outline", icon: AlertTriangle },
  revoked: { label: "Revoked", variant: "destructive", icon: XCircle },
};

function VerificationStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;
  return (
    <Badge variant={config.variant} data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

function NewVerificationDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "form">("select");
  const [selectedType, setSelectedType] = useState<string>("");
  const [patientName, setPatientName] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState("");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const verType = VERIFICATION_TYPES.find((v) => v.id === selectedType);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/family-verification", {
        userId: "default-user",
        verificationType: selectedType,
        relationshipType: verType?.relationship || "",
        patientName,
        requesterName,
        requesterEmail,
        documentFileName: documentFile?.name || "",
        attestationText: "I certify under penalty of perjury that the information provided is true and correct, and that I have legal authority to access the patient's health information as described.",
        digitalSignature,
        notes,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Verification Submitted", description: "Your verification request has been submitted for review." });
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit verification.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setStep("select");
    setSelectedType("");
    setPatientName("");
    setRequesterName("");
    setRequesterEmail("");
    setDocumentFile(null);
    setAttestationChecked(false);
    setDigitalSignature("");
    setNotes("");
  };

  const canSubmit = requesterName && digitalSignature && attestationChecked && documentFile && patientName;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-verification">
          <Plus className="h-4 w-4 mr-2" />
          New Verification Request
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{step === "select" ? "Select Verification Type" : verType?.title}</DialogTitle>
          <DialogDescription>
            {step === "select"
              ? "Choose the type of family member verification to begin the process."
              : verType?.description}
          </DialogDescription>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-3">
            {VERIFICATION_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <Card
                  key={type.id}
                  className="cursor-pointer hover-elevate"
                  onClick={() => { setSelectedType(type.id); setStep("form"); }}
                  data-testid={`card-verification-type-${type.id}`}
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{type.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{type.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Required:</span> {type.requiredDocs}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="patientName">Patient Name (the person whose records you are requesting access to)</Label>
              <Input
                id="patientName"
                placeholder="Enter patient's full legal name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                data-testid="input-patient-name"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requesterName">Your Full Legal Name</Label>
                <Input
                  id="requesterName"
                  placeholder="Enter your full legal name"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  data-testid="input-requester-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterEmail">Your Email</Label>
                <Input
                  id="requesterEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={requesterEmail}
                  onChange={(e) => setRequesterEmail(e.target.value)}
                  data-testid="input-requester-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="family-verification-relationship-type">Relationship Type</Label>
              <Input id="family-verification-relationship-type" value={verType?.relationship || ""} disabled data-testid="input-relationship-type" />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="documentUpload">Upload Supporting Documentation</Label>
              <p className="text-xs text-muted-foreground">
                Required: {verType?.requiredDocs}
              </p>
              <div className="flex items-center gap-3">
                <label
                  htmlFor="documentUpload"
                  className="flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer hover-elevate text-sm"
                >
                  <Upload className="h-4 w-4" />
                  {documentFile ? documentFile.name : "Choose File"}
                </label>
                <input
                  id="documentUpload"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
                  data-testid="input-document-upload"
                />
              </div>
            </div>

            <Separator />

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>HIPAA Notice</AlertTitle>
              <AlertDescription className="text-xs">
                Under HIPAA (45 CFR 164.510), access to a patient's Protected Health Information (PHI) requires proper legal authorization.
                By submitting this verification, you acknowledge that unauthorized access to PHI is a federal offense subject to civil and criminal penalties,
                including fines up to $250,000 and imprisonment up to 10 years. You agree to use any granted access solely for the patient's care and benefit,
                and to maintain the confidentiality of all accessed health information.
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
              <Checkbox
                id="attestation"
                checked={attestationChecked}
                onCheckedChange={(checked) => setAttestationChecked(checked === true)}
                data-testid="checkbox-attestation"
              />
              <Label htmlFor="attestation" className="text-xs leading-relaxed cursor-pointer">
                I certify under penalty of perjury that the information provided above is true, correct, and complete. I have legal authority
                to access the patient's health information as described, and I understand that providing false information may result in legal action
                and criminal prosecution under federal and state law.
              </Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="digitalSignature">Digital Signature (type your full legal name)</Label>
              <Input
                id="digitalSignature"
                placeholder="Type your full legal name as your digital signature"
                value={digitalSignature}
                onChange={(e) => setDigitalSignature(e.target.value)}
                className="font-serif italic"
                data-testid="input-digital-signature"
              />
              <p className="text-xs text-muted-foreground">
                By typing your name, you are electronically signing this verification request.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional information..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                data-testid="textarea-notes"
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === "form" && (
            <Button variant="outline" onClick={() => setStep("select")} data-testid="button-back-to-types">
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }} data-testid="button-cancel-verification">
            Cancel
          </Button>
          {step === "form" && (
            <Button
              onClick={() => mutation.mutate()}
              disabled={!canSubmit || mutation.isPending}
              data-testid="button-submit-verification"
            >
              {mutation.isPending ? "Submitting..." : "Submit Verification"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerificationCard({ verification }: { verification: FamilyVerification }) {
  const verType = VERIFICATION_TYPES.find((v) => v.id === verification.verificationType);
  const Icon = verType?.icon || FileText;
  const { toast } = useToast();

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/family-verification/${verification.id}/status`, { status: "revoked" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Access Revoked", description: "Caregiver access has been revoked." });
      queryClient.invalidateQueries({ queryKey: ["/api/family-verification"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke access.", variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`card-verification-${verification.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{verType?.title || verification.verificationType}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {verification.relationshipType} &middot; Submitted {new Date(verification.submittedAt).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
          <VerificationStatusBadge status={verification.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Patient</span>
            <p className="font-medium" data-testid={`text-patient-${verification.id}`}>{verification.patientName || "N/A"}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Requester</span>
            <p className="font-medium" data-testid={`text-requester-${verification.id}`}>{verification.requesterName}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Document</span>
            <p className="font-medium truncate" data-testid={`text-document-${verification.id}`}>
              {verification.documentFileName || "No document uploaded"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Digital Signature</span>
            <p className="font-serif italic" data-testid={`text-signature-${verification.id}`}>{verification.digitalSignature}</p>
          </div>
          {verification.verifiedAt && (
            <div>
              <span className="text-muted-foreground text-xs">Verified On</span>
              <p className="font-medium">{new Date(verification.verifiedAt).toLocaleDateString()}</p>
            </div>
          )}
          {verification.expiresAt && (
            <div>
              <span className="text-muted-foreground text-xs">Expires</span>
              <p className="font-medium">{new Date(verification.expiresAt).toLocaleDateString()}</p>
            </div>
          )}
        </div>
        {verification.notes && (
          <div className="mt-3 text-sm">
            <span className="text-muted-foreground text-xs">Notes</span>
            <p>{verification.notes}</p>
          </div>
        )}
        {(verification.status === "verified" || verification.status === "pending") && (
          <div className="mt-4 flex gap-2 flex-wrap">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
              data-testid={`button-revoke-${verification.id}`}
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              {revokeMutation.isPending ? "Revoking..." : "Revoke Access"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function FamilyVerificationPage() {
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery<{ verifications: FamilyVerification[] }>({
    queryKey: ["/api/family-verification"],
  });

  const verifications = data?.verifications || [];

  const filteredVerifications =
    activeTab === "all"
      ? verifications
      : verifications.filter((v) => v.status === activeTab);

  const counts = {
    all: verifications.length,
    pending: verifications.filter((v) => v.status === "pending").length,
    verified: verifications.filter((v) => v.status === "verified").length,
    expired: verifications.filter((v) => v.status === "expired").length,
    revoked: verifications.filter((v) => v.status === "revoked").length,
  };

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-family-verification">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Family Member Verification
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Verify your legal relationship to grant caregiver access to health records.
            </p>
          </div>
          <NewVerificationDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/family-verification"] })} />
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>About Family Verification</AlertTitle>
          <AlertDescription className="text-xs">
            Federal law (HIPAA) requires proper legal documentation before granting access to another person's health records.
            Once your verification is approved, you will gain caregiver-level access to the patient's health information
            through the existing Caregiver Portal. You may revoke access at any time.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card data-testid="stat-total">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{counts.all}</p>
              <p className="text-xs text-muted-foreground">Total Requests</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-pending">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{counts.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-verified">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{counts.verified}</p>
              <p className="text-xs text-muted-foreground">Verified</p>
            </CardContent>
          </Card>
          <Card data-testid="stat-revoked">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{counts.revoked + counts.expired}</p>
              <p className="text-xs text-muted-foreground">Revoked/Expired</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-verification-status">
            <TabsTrigger value="all" data-testid="tab-all">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending">Pending ({counts.pending})</TabsTrigger>
            <TabsTrigger value="verified" data-testid="tab-verified">Verified ({counts.verified})</TabsTrigger>
            <TabsTrigger value="expired" data-testid="tab-expired">Expired ({counts.expired})</TabsTrigger>
            <TabsTrigger value="revoked" data-testid="tab-revoked">Revoked ({counts.revoked})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : filteredVerifications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
                  <h3 className="font-medium text-lg" data-testid="text-empty-state">No Verification Requests</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {activeTab === "all"
                      ? "Submit a new verification request to grant caregiver access."
                      : `No ${activeTab} verification requests found.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredVerifications.map((v) => (
                  <VerificationCard key={v.id} verification={v} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Supported Verification Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VERIFICATION_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.id} className="flex items-start gap-3" data-testid={`info-verification-${type.id}`}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted flex-shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{type.title}</p>
                      <p className="text-xs text-muted-foreground">{type.requiredDocs}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border p-4 bg-muted/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Important Legal Notice</p>
              <p>
                Access to Protected Health Information (PHI) is governed by the Health Insurance Portability and Accountability Act (HIPAA).
                Unauthorized access, use, or disclosure of PHI may result in civil penalties of up to $50,000 per violation
                (with an annual maximum of $1.5 million) and criminal penalties including fines up to $250,000 and imprisonment up to 10 years.
              </p>
              <p>
                Tabula Medica verifies all submitted documentation before granting access. Submitting fraudulent documents is a federal offense.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
