import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Shield,
  Clock,
  Database,
  Share2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Ban,
  Send,
  Loader2,
  Timer,
  Lock,
  Globe,
  Zap,
  ArrowRight
} from "lucide-react";

export default function InformationBlockingCompliance() {
  const { toast } = useToast();
  const [requestForm, setRequestForm] = useState({
    name: "",
    email: "",
    requestType: "",
    description: "",
  });

  const submitRequest = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance/data-access-request", requestForm);
      return await res.json();
    },
    onSuccess: (data: { requestId: string; slaDeadline: string; estimatedCompletion: string }) => {
      toast({
        title: "Request Submitted",
        description: `Your data access request ${data.requestId} has been received. SLA deadline: ${new Date(data.slaDeadline).toLocaleDateString()}.`,
      });
      setRequestForm({ name: "", email: "", requestType: "", description: "" });
    },
    onError: () => {
      toast({
        title: "Submission Failed",
        description: "Unable to submit your request. Please try again or contact privacy@tabulamedica.com.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = requestForm.name && requestForm.email && requestForm.requestType && requestForm.description;

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="text-center space-y-4">
          <Scale className="h-12 w-12 mx-auto text-primary" />
          <h1 className="text-3xl font-bold" data-testid="text-info-blocking-title">Information Blocking Compliance</h1>
          <p className="text-muted-foreground">ONC HTI-1 Final Rule &amp; 21st Century Cures Act</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="default" className="text-sm" data-testid="badge-hti1-compliant">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              ONC HTI-1 Compliant
            </Badge>
            <Badge variant="outline" className="text-sm">
              <Clock className="h-3 w-3 mr-1" />
              2026 Regulations
            </Badge>
          </div>
        </div>

        <Alert className="border-primary/50 bg-primary/5" data-testid="alert-info-blocking-summary">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Our Commitment:</strong> Tabula Medica is committed to ensuring patients have unrestricted, timely access to their electronic health information. We comply fully with the 21st Century Cures Act and ONC HTI-1 Final Rule information blocking provisions.
          </AlertDescription>
        </Alert>

        <Card data-testid="card-access-guarantee" className="border-2 border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              15-Day Access Guarantee
            </CardTitle>
            <CardDescription>
              Your right to timely access under 2026 information blocking rules
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-background rounded-lg border">
                <Zap className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold" data-testid="text-instant-access">Instant</p>
                <p className="text-sm text-muted-foreground">Self-service portal access to all your health records</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <Clock className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold" data-testid="text-15-day-max">15 Days</p>
                <p className="text-sm text-muted-foreground">Maximum response time for formal data access requests</p>
              </div>
              <div className="text-center p-4 bg-background rounded-lg border">
                <Ban className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold" data-testid="text-zero-fees">$0</p>
                <p className="text-sm text-muted-foreground">No fees for standard electronic access to your records</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-what-is-info-blocking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              What Is Information Blocking?
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              Information blocking is a practice by a health IT developer, health information exchange, health information network, or healthcare provider that is likely to interfere with the access, exchange, or use of electronic health information (EHI).
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Ban className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Prohibited Practices</p>
                  <p className="text-sm text-muted-foreground">Delaying access to records, charging excessive fees, imposing unnecessary technical barriers, restricting data formats, or requiring patients to use specific apps or portals to view their data.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Our Practice</p>
                  <p className="text-sm text-muted-foreground">We provide immediate self-service access via our platform, support standard FHIR R4 APIs for interoperability, and fulfill formal requests within 15 calendar days with no access fees for electronic records.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-details">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              How We Prevent Information Blocking
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Zap className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Real-Time Self-Service Access</p>
                  <p className="text-sm text-muted-foreground">All connected health records are available immediately through your Tabula Medica dashboard. No waiting periods, no gatekeeping. View, download, or share your complete health history at any time.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Globe className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Standard API Access (FHIR R4)</p>
                  <p className="text-sm text-muted-foreground">We support HL7 FHIR R4 standard APIs, enabling you to connect your data to any compliant third-party application. No proprietary formats or lock-in.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Database className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Full EHI Scope (USCDI v6)</p>
                  <p className="text-sm text-muted-foreground">Access covers all US Core Data for Interoperability (USCDI) v6 data classes (released July 2025), ensuring comprehensive record availability across all data types. USCDI v7 draft tracking in progress.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Share2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">TEFCA Network Participation</p>
                  <p className="text-sm text-muted-foreground">Connected to 6 Qualified Health Information Networks (QHINs) through the Trusted Exchange Framework and Common Agreement, enabling nationwide health data exchange.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <FileText className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Export in Multiple Formats</p>
                  <p className="text-sm text-muted-foreground">Download your records as FHIR Bundles, C-CDA documents, or PDF summaries. We never restrict your choice of format or destination.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <Lock className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Permitted Exceptions Only</p>
                  <p className="text-sm text-muted-foreground">We only limit access when required by law (e.g., privacy protections for SUD records under 42 CFR Part 2, reproductive health protections, or court-ordered restrictions). All limitations are documented and audited.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-recognized-exceptions">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Recognized Exceptions
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              The ONC rules recognize certain narrow exceptions where limiting access is not considered information blocking. Tabula Medica applies these only when strictly necessary:
            </p>

            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Privacy Exception</p>
                  <p className="text-sm text-muted-foreground">When state or federal privacy laws require restricting access (e.g., 42 CFR Part 2 for SUD records, reproductive health protections, minor consent laws).</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Security Exception</p>
                  <p className="text-sm text-muted-foreground">When a significant security risk is identified (e.g., compromised credentials, suspected unauthorized access). Access is restored once the risk is mitigated.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Harm Exception</p>
                  <p className="text-sm text-muted-foreground">Only applied when a licensed healthcare professional determines that access would endanger the life or physical safety of a patient or another person.</p>
                </div>
              </div>
            </div>

            <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                All applied exceptions are logged in our audit trail and reported to patients. If you believe an exception has been applied incorrectly, you may file a complaint with our Privacy Officer or with ONC directly.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card data-testid="card-data-access-request">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Submit a Data Access Request
            </CardTitle>
            <CardDescription>
              While most data is available instantly through our portal, you may submit a formal request for additional records or specific data formats.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dar-name">Full Name</Label>
                <Input
                  id="dar-name"
                  data-testid="input-dar-name"
                  placeholder="Your full legal name"
                  value={requestForm.name}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dar-email">Email Address</Label>
                <Input
                  id="dar-email"
                  type="email"
                  data-testid="input-dar-email"
                  placeholder="your.email@example.com"
                  value={requestForm.email}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dar-type">Request Type</Label>
                <Select
                  value={requestForm.requestType}
                  onValueChange={(val) => setRequestForm(prev => ({ ...prev, requestType: val }))}
                >
                  <SelectTrigger data-testid="select-dar-type">
                    <SelectValue placeholder="Select request type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-record-export">Full Record Export (FHIR Bundle)</SelectItem>
                    <SelectItem value="ccda-export">C-CDA Document Export</SelectItem>
                    <SelectItem value="pdf-summary">PDF Summary Export</SelectItem>
                    <SelectItem value="specific-records">Specific Record Categories</SelectItem>
                    <SelectItem value="third-party-transfer">Transfer to Third-Party App/Provider</SelectItem>
                    <SelectItem value="api-access">API Access Credentials</SelectItem>
                    <SelectItem value="other">Other Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dar-description">Request Details</Label>
                <Textarea
                  id="dar-description"
                  data-testid="input-dar-description"
                  placeholder="Please describe what data you need, the desired format, and where you'd like it sent..."
                  value={requestForm.description}
                  onChange={(e) => setRequestForm(prev => ({ ...prev, description: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>

              <Button
                data-testid="button-submit-dar"
                onClick={() => submitRequest.mutate()}
                disabled={!canSubmit || submitRequest.isPending}
              >
                {submitRequest.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Data Access Request
                  </>
                )}
              </Button>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Formal requests are processed within <strong>15 calendar days</strong> per ONC HTI-1 requirements. Most electronic exports are completed within 1-2 business days. You will receive email confirmation and a tracking number.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-report-blocking">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Report Suspected Information Blocking
            </CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">
              If you believe your access to electronic health information has been unreasonably delayed or restricted by Tabula Medica or any connected provider:
            </p>

            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">1</span>
                <p className="text-sm"><strong>Contact our Privacy Officer</strong> at <a href="mailto:privacy@tabulamedica.com" className="text-primary">privacy@tabulamedica.com</a> with details of the issue.</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">2</span>
                <p className="text-sm"><strong>We will investigate and respond</strong> within 5 business days.</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">3</span>
                <p className="text-sm"><strong>If unresolved, file a complaint with ONC:</strong> Visit <a href="https://www.healthit.gov/topic/information-blocking" className="text-primary" target="_blank" rel="noopener noreferrer">healthit.gov/topic/information-blocking</a> to submit a report directly to the Office of the National Coordinator for Health IT.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center space-y-2 py-4">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              21st Century Cures Act
            </Badge>
            <Badge variant="outline" className="text-xs">
              ONC HTI-1 Final Rule
            </Badge>
            <Badge variant="outline" className="text-xs">
              USCDI v6 Compliant
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Tabula Medica is committed to transparent, unrestricted access to your health data.
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
