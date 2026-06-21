import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ShieldCheck,
  Ban,
  EyeOff,
  Download,
  UserX,
  Users,
  ScrollText,
  History,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  MapPin,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoticeCategory {
  category: string;
  examples: string[];
  sources: string[];
  businessPurpose: string;
  sharedWith: string[];
  sold: boolean;
  sharedForAds: boolean;
  limitable?: boolean;
}
interface Notice {
  generatedAt: string;
  controller: string;
  scope: string;
  doWeSell: boolean;
  doWeShareForAds: boolean;
  retentionPolicy: string;
  categories: NoticeCategory[];
  nonDiscriminationNotice: string;
}
interface PrivacyContact {
  jurisdiction: string;
  controller: string;
  privacyOfficerEmail: string;
  californiaTollFree: string;
  postal: string;
  responseSlaDays: number;
  agentInstructions: string;
  appealPath: string;
}
interface CcpaPrefs {
  doNotSell: boolean;
  limitSensitivePi: boolean;
  optOutAutomatedDecisions: boolean;
  analyticsOptOut: boolean;
  marketingEmailsOptOut: boolean;
}
interface CcpaRequest {
  id: string;
  type: string;
  status: string;
  framework: string;
  notes: string | null;
  fulfillmentRef: string | null;
  scheduledFor: string | null;
  requestedAt: string;
  completedAt: string | null;
}
interface Disclosure12mo {
  window: { from: string; to: string };
  categoriesCollected: string[];
  categoriesDisclosedForBusinessPurpose: { category: string; recipients: string[] }[];
  categoriesSold: string[];
  categoriesSharedForAds: string[];
  categoriesDisclosedToThirdParties: {
    category: string;
    recipient: string;
    requestId: string;
    disclosedAt: string;
  }[];
}

const REQUEST_LABEL: Record<string, string> = {
  access: "Right to know",
  portability: "Right to portability",
  erasure: "Right to delete",
  rectification: "Right to correct",
  do_not_sell: "Do not sell or share",
  limit_sensitive: "Limit sensitive PI",
  opt_out_automated_decisions: "Opt-out of automated decisions",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <Badge variant="outline" className="gap-1 border-green-500/40 text-green-700 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </Badge>
    );
  }
  if (status === "in_progress") {
    return (
      <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300">
        <Clock className="h-3 w-3" /> In progress
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge variant="outline" className="gap-1 border-muted-foreground/40 text-muted-foreground">
        <XCircle className="h-3 w-3" /> Cancelled
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CcpaDashboard() {
  const { toast } = useToast();
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [agentForm, setAgentForm] = useState({
    requestType: "access",
    agentName: "",
    agentEmail: "",
    authorizationRef: "",
    consumerStatement: "",
  });

  const noticeQ = useQuery<{ notice: Notice }>({
    queryKey: ["/api/ccpa/notice-at-collection"],
  });
  const contactQ = useQuery<{ contact: PrivacyContact }>({
    queryKey: ["/api/ccpa/privacy-contact"],
  });
  const prefsQ = useQuery<{ preferences: CcpaPrefs }>({
    queryKey: ["/api/ccpa/preferences"],
  });
  const requestsQ = useQuery<{ requests: CcpaRequest[] }>({
    queryKey: ["/api/ccpa/requests"],
  });
  const disclosureQ = useQuery<Disclosure12mo>({
    queryKey: ["/api/ccpa/disclosure-12mo"],
  });

  const optOutMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ccpa/confirm-opt-out", {});
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "Do Not Sell or Share confirmed",
        description: "We never sold your information. Your preference is on the record.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/requests"] });
    },
  });

  const limitSpiMut = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await apiRequest("POST", "/api/ccpa/limit-spi", { enabled });
      return r.json();
    },
    onSuccess: (_data, enabled) => {
      toast({
        title: enabled ? "Sensitive PI use limited" : "Sensitive PI use restored",
        description: enabled
          ? "We will only use your sensitive PI for purposes permitted under CCPA §1798.121(a)."
          : "Full use of your sensitive PI restored.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/preferences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/requests"] });
    },
  });

  const dataRequestMut = useMutation({
    mutationFn: async (vars: { url: string; body?: unknown }) => {
      const r = await apiRequest("POST", vars.url, { ...(vars.body as object), framework: "ccpa" });
      return r.json();
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Request received", description: data.message ?? "We will follow up by email." });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/requests"] });
    },
  });

  const agentMut = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/ccpa/authorized-agent-request", agentForm);
      return r.json();
    },
    onSuccess: (data: { message?: string }) => {
      toast({ title: "Agent request received", description: data.message ?? "" });
      queryClient.invalidateQueries({ queryKey: ["/api/ccpa/requests"] });
      setAgentDialogOpen(false);
      setAgentForm({
        requestType: "access",
        agentName: "",
        agentEmail: "",
        authorizationRef: "",
        consumerStatement: "",
      });
    },
  });

  const notice = noticeQ.data?.notice;
  const prefs = prefsQ.data?.preferences;

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 py-8" data-testid="page-ccpa-dashboard">
      {/* Hero */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300">
            <MapPin className="h-3 w-3" /> California
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight" data-testid="text-page-title">
            Your California Privacy Rights
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Under the California Consumer Privacy Act (CCPA) and California Privacy Rights Act
            (CPRA), you have the rights below. Tabula Medica honors them for every California
            resident, free or paid.
          </p>
        </div>
        <Link href="/gdpr">
          <Button variant="outline" data-testid="link-gdpr-dashboard">
            EU/UK rights (GDPR) <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Top-of-page guarantee */}
      <Alert className="border-green-500/40 bg-green-500/5">
        <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
        <AlertTitle>We do not sell or share your information</AlertTitle>
        <AlertDescription>
          Tabula Medica has never sold personal information and does not share personal information
          for cross-context behavioral advertising. There are no advertising trackers, no data
          brokers, no marketing-attribution partners. This is a hard-coded product guarantee, not a
          configurable setting.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="rights" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rights" data-testid="tab-rights">Your rights</TabsTrigger>
          <TabsTrigger value="notice" data-testid="tab-notice">Notice at collection</TabsTrigger>
          <TabsTrigger value="disclosure" data-testid="tab-disclosure">12-month disclosure</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Request history</TabsTrigger>
        </TabsList>

        {/* ----- Tab: Your rights ----- */}
        <TabsContent value="rights" className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Right to know */}
            <Card id="access" data-testid="card-right-access">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Download className="h-4 w-4" /> Right to know</CardTitle>
                <CardDescription>§1798.100 / §1798.110</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Receive a copy of all personal information we hold about you, including categories,
                  sources, business purpose, and third parties shared with.
                </p>
              </CardContent>
              <div className="px-6 pb-6">
                <Button
                  data-testid="button-request-access"
                  onClick={() => dataRequestMut.mutate({ url: "/api/gdpr/access-request" })}
                  disabled={dataRequestMut.isPending}
                >
                  Request a copy of my data
                </Button>
              </div>
            </Card>

            {/* Right to delete */}
            <Card id="delete" data-testid="card-right-delete">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><UserX className="h-4 w-4" /> Right to delete</CardTitle>
                <CardDescription>§1798.105 — 30-day grace period</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and personal information. You can cancel any time
                  during the 30-day grace period.
                </p>
              </CardContent>
              <div className="px-6 pb-6">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="destructive" data-testid="button-request-delete">
                      Delete my account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete your account?</DialogTitle>
                      <DialogDescription>
                        Your account is scheduled for permanent deletion 30 days from today. You
                        can cancel any time before then. Records that providers are required to
                        keep under separate medical-records retention laws are not affected.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        data-testid="button-confirm-delete"
                        onClick={() => dataRequestMut.mutate({ url: "/api/gdpr/erasure-request" })}
                      >
                        Yes, schedule deletion
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>

            {/* Right to portability */}
            <Card data-testid="card-right-portability">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ScrollText className="h-4 w-4" /> Right to portability</CardTitle>
                <CardDescription>FHIR R4 JSON bundle</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Receive your health record in a portable, machine-readable FHIR R4 bundle.
                </p>
              </CardContent>
              <div className="px-6 pb-6">
                <Button
                  variant="outline"
                  data-testid="button-request-portability"
                  onClick={() => dataRequestMut.mutate({ url: "/api/gdpr/portability-request" })}
                >
                  Export my health record
                </Button>
              </div>
            </Card>

            {/* Do not sell */}
            <Card id="opt-out" data-testid="card-right-opt-out">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Ban className="h-4 w-4" /> Do not sell or share</CardTitle>
                <CardDescription>§1798.120 / §1798.135</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Confirm your "Do Not Sell or Share My Personal Information" preference for the
                  record. Honored immediately and recorded as a CCPA request.
                </p>
                {prefs && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Currently:</span>
                    {prefs.doNotSell ? (
                      <Badge className="bg-green-600">On (do not sell or share)</Badge>
                    ) : (
                      <Badge variant="outline">Off</Badge>
                    )}
                  </div>
                )}
              </CardContent>
              <div className="px-6 pb-6">
                <Button
                  data-testid="button-confirm-opt-out"
                  onClick={() => optOutMut.mutate()}
                  disabled={optOutMut.isPending || prefs?.doNotSell === true}
                >
                  {prefs?.doNotSell ? "Already confirmed" : "Confirm opt-out"}
                </Button>
              </div>
            </Card>

            {/* Limit Sensitive PI */}
            <Card id="limit-spi" data-testid="card-right-limit-spi">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><EyeOff className="h-4 w-4" /> Limit sensitive PI use</CardTitle>
                <CardDescription>§1798.121</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Restrict our use of your sensitive personal information (health data, exact
                  location, government IDs) to the limited purposes permitted by §1798.121(a).
                </p>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label htmlFor="limit-spi-switch" className="text-sm">
                    Limit sensitive PI
                  </Label>
                  <Switch
                    id="limit-spi-switch"
                    data-testid="switch-limit-spi"
                    checked={prefs?.limitSensitivePi ?? false}
                    onCheckedChange={(v) => limitSpiMut.mutate(v)}
                    disabled={limitSpiMut.isPending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Authorized agent */}
            <Card data-testid="card-right-agent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" /> Authorized agent</CardTitle>
                <CardDescription>§1798.105 / §1798.130 — Submit on behalf</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  An authorized agent may submit a CCPA request on your behalf with proof of
                  authorization. We will verify with you directly within 10 business days.
                </p>
              </CardContent>
              <div className="px-6 pb-6">
                <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" data-testid="button-open-agent-form">
                      Submit agent request
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Authorized agent CCPA request</DialogTitle>
                      <DialogDescription>
                        Provide the agent's contact and a reference to the signed authorization.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="agent-name">Agent name</Label>
                        <Input
                          id="agent-name"
                          data-testid="input-agent-name"
                          value={agentForm.agentName}
                          onChange={(e) => setAgentForm({ ...agentForm, agentName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="agent-email">Agent email</Label>
                        <Input
                          id="agent-email"
                          type="email"
                          data-testid="input-agent-email"
                          value={agentForm.agentEmail}
                          onChange={(e) => setAgentForm({ ...agentForm, agentEmail: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="agent-auth">Authorization reference</Label>
                        <Input
                          id="agent-auth"
                          data-testid="input-agent-auth"
                          placeholder="Notarization # or document ID"
                          value={agentForm.authorizationRef}
                          onChange={(e) => setAgentForm({ ...agentForm, authorizationRef: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="agent-statement">Your statement (optional)</Label>
                        <Textarea
                          id="agent-statement"
                          data-testid="input-agent-statement"
                          value={agentForm.consumerStatement}
                          onChange={(e) => setAgentForm({ ...agentForm, consumerStatement: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        data-testid="button-submit-agent"
                        onClick={() => agentMut.mutate()}
                        disabled={
                          agentMut.isPending ||
                          !agentForm.agentName ||
                          !agentForm.agentEmail ||
                          !agentForm.authorizationRef
                        }
                      >
                        Submit
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>
          </div>

          {/* Non-discrimination notice */}
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Non-discrimination notice</AlertTitle>
            <AlertDescription>{notice?.nonDiscriminationNotice ?? "Loading…"}</AlertDescription>
          </Alert>

          {/* Contact */}
          {contactQ.data?.contact && (
            <Card data-testid="card-privacy-contact">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4" /> California privacy contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><strong>Email:</strong> {contactQ.data.contact.privacyOfficerEmail}</div>
                <div><strong>Toll-free:</strong> {contactQ.data.contact.californiaTollFree}</div>
                <div><strong>Postal:</strong> {contactQ.data.contact.postal}</div>
                <div><strong>Response SLA:</strong> {contactQ.data.contact.responseSlaDays} days</div>
                <Separator />
                <div className="text-muted-foreground">{contactQ.data.contact.appealPath}</div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ----- Tab: Notice at collection ----- */}
        <TabsContent value="notice" className="space-y-4 pt-6">
          {noticeQ.isLoading || !notice ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <Card data-testid="card-notice">
              <CardHeader>
                <CardTitle>Notice at collection</CardTitle>
                <CardDescription>
                  CCPA §1798.100(b). Generated {notice.generatedAt}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{notice.scope}</p>
                <Alert>
                  <AlertDescription>{notice.retentionPolicy}</AlertDescription>
                </Alert>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Examples</TableHead>
                      <TableHead>Sources</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Shared with</TableHead>
                      <TableHead className="text-center">Sold</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notice.categories.map((c) => (
                      <TableRow key={c.category} data-testid={`row-category-${c.category.split(" ")[0]}`}>
                        <TableCell className="font-medium align-top">{c.category}</TableCell>
                        <TableCell className="text-xs align-top">{c.examples.join(", ")}</TableCell>
                        <TableCell className="text-xs align-top">{c.sources.join("; ")}</TableCell>
                        <TableCell className="text-xs align-top">{c.businessPurpose}</TableCell>
                        <TableCell className="text-xs align-top">{c.sharedWith.join("; ")}</TableCell>
                        <TableCell className="text-center align-top">
                          <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-300">
                            No
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ----- Tab: 12-month disclosure ----- */}
        <TabsContent value="disclosure" className="space-y-4 pt-6">
          {disclosureQ.isLoading || !disclosureQ.data ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <Card data-testid="card-disclosure">
              <CardHeader>
                <CardTitle>12-month disclosure</CardTitle>
                <CardDescription>
                  CCPA §1798.130(a)(5). Window:&nbsp;
                  {new Date(disclosureQ.data.window.from).toLocaleDateString()} —{" "}
                  {new Date(disclosureQ.data.window.to).toLocaleDateString()}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <strong>Categories of PI collected:</strong>
                  <ul className="ml-6 list-disc">
                    {disclosureQ.data.categoriesCollected.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                </div>
                <div>
                  <strong>Disclosed for a business purpose to:</strong>
                  <ul className="ml-6 list-disc">
                    {disclosureQ.data.categoriesDisclosedForBusinessPurpose.map((d) => (
                      <li key={d.category}>
                        {d.category} → {d.recipients.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
                <Alert className="border-green-500/40 bg-green-500/5">
                  <AlertTitle>Sold or shared for ads in the last 12 months: none</AlertTitle>
                  <AlertDescription>
                    No personal information was sold or shared for cross-context behavioral
                    advertising. This is a permanent product guarantee.
                  </AlertDescription>
                </Alert>
                {disclosureQ.data.categoriesDisclosedToThirdParties.length > 0 && (
                  <div>
                    <strong>Disclosed to third parties at your direction:</strong>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disclosureQ.data.categoriesDisclosedToThirdParties.map((d) => (
                          <TableRow key={d.requestId}>
                            <TableCell>{d.category}</TableCell>
                            <TableCell>{d.recipient}</TableCell>
                            <TableCell>{new Date(d.disclosedAt).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ----- Tab: Request history ----- */}
        <TabsContent value="history" className="space-y-4 pt-6">
          {requestsQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (requestsQ.data?.requests.length ?? 0) === 0 ? (
            <Alert>
              <History className="h-4 w-4" />
              <AlertDescription>No CCPA requests in the last 12 months.</AlertDescription>
            </Alert>
          ) : (
            <Card data-testid="card-request-history">
              <CardHeader>
                <CardTitle>Recent CCPA requests</CardTitle>
                <CardDescription>Last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsQ.data!.requests.map((r) => (
                      <TableRow key={r.id} data-testid={`row-request-${r.id}`}>
                        <TableCell className="font-medium">{REQUEST_LABEL[r.type] ?? r.type}</TableCell>
                        <TableCell><StatusBadge status={r.status} /></TableCell>
                        <TableCell className="text-xs">{new Date(r.requestedAt).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">
                          {r.completedAt ? new Date(r.completedAt).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {r.notes}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
