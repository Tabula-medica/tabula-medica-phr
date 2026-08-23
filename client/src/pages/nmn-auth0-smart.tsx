import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PatientNameForm, type PatientNameData } from "@/components/PatientNameForm";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Shield, User, Activity, Database, Key, FileText,
  CheckCircle2, XCircle, AlertTriangle, Copy, RefreshCw, Unplug,
  Fingerprint, Building2, Lock, Clock, ShieldAlert, ShieldCheck
} from "lucide-react";

export default function NmnAuth0SmartPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("nmn");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                NMN Enforcement + Auth0 SMART on FHIR
              </h1>
              <p className="text-muted-foreground text-sm">
                Patient identity management and FHIR payer token broker
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 flex-wrap" data-testid="tabs-nmn-auth0">
            <TabsTrigger value="nmn" data-testid="tab-nmn">
              <User className="h-4 w-4 mr-1" /> NMN
            </TabsTrigger>
            <TabsTrigger value="lab-order" data-testid="tab-lab-order">
              <FileText className="h-4 w-4 mr-1" /> Lab Order
            </TabsTrigger>
            <TabsTrigger value="payer-tokens" data-testid="tab-payer-tokens">
              <Key className="h-4 w-4 mr-1" /> Payer Tokens
            </TabsTrigger>
            <TabsTrigger value="config" data-testid="tab-config">
              <Database className="h-4 w-4 mr-1" /> Auth0 Config
            </TabsTrigger>
            <TabsTrigger value="data-boundary" data-testid="tab-data-boundary">
              <Shield className="h-4 w-4 mr-1" /> Data Boundary
            </TabsTrigger>
            <TabsTrigger value="baa" data-testid="tab-baa">
              <ShieldCheck className="h-4 w-4 mr-1" /> BAA
            </TabsTrigger>
            <TabsTrigger value="mfa" data-testid="tab-mfa">
              <Fingerprint className="h-4 w-4 mr-1" /> MFA/WebAuthn
            </TabsTrigger>
            <TabsTrigger value="tenant-isolation" data-testid="tab-tenant-isolation">
              <Building2 className="h-4 w-4 mr-1" /> Tenant Isolation
            </TabsTrigger>
            <TabsTrigger value="jwt-verify" data-testid="tab-jwt-verify">
              <Lock className="h-4 w-4 mr-1" /> JWT Verify
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nmn"><NmnTab /></TabsContent>
          <TabsContent value="lab-order"><LabOrderTab /></TabsContent>
          <TabsContent value="payer-tokens"><PayerTokensTab /></TabsContent>
          <TabsContent value="config"><ConfigTab /></TabsContent>
          <TabsContent value="data-boundary"><DataBoundaryTab /></TabsContent>
          <TabsContent value="baa"><BaaTab /></TabsContent>
          <TabsContent value="mfa"><MfaTab /></TabsContent>
          <TabsContent value="tenant-isolation"><TenantIsolationTab /></TabsContent>
          <TabsContent value="jwt-verify"><JwtVerifyTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function NmnTab() {
  const { toast } = useToast();
  const [nameData, setNameData] = useState<PatientNameData>({
    nameFirst: "",
    nameMiddle: "",
    nameLast: "",
  });

  const normalizeMutation = useMutation({
    mutationFn: async (data: PatientNameData) => {
      const res = await apiRequest("POST", "/api/nmn/normalize", data);
      return res.json();
    },
  });

  const encryptMutation = useMutation({
    mutationFn: async (data: PatientNameData) => {
      const res = await apiRequest("POST", "/api/nmn/encrypt-name", data);
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm">Database Layer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <code className="text-xs">name_middle_enc TEXT NOT NULL</code> — cannot be null, ever.{" "}
              <code className="text-xs">has_no_middle_name BOOLEAN</code> is the plain-text flag so code can check NMN without decryption.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <CardTitle className="text-sm">Application Layer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              <code className="text-xs">normalizeName()</code> assigns NMN before encryption. Called on every INSERT and UPDATE.
              Throws if first or last name is missing.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-purple-500" />
              <CardTitle className="text-sm">UI Layer</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              On blur of the middle name field: if empty, auto-fills NMN and shows a live ARIA announcement.
              Patient sees full display name before submitting.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Name Registration</CardTitle>
          <CardDescription>
            Three-part legal name with NMN auto-assignment. Section 508 compliant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PatientNameForm value={nameData} onChange={setNameData} />

          <div className="flex gap-3 pt-2">
            <Button
              data-testid="button-normalize"
              onClick={() => normalizeMutation.mutate(nameData)}
              disabled={!nameData.nameFirst || !nameData.nameLast || normalizeMutation.isPending}
            >
              Normalize Name
            </Button>
            <Button
              data-testid="button-encrypt"
              variant="secondary"
              onClick={() => encryptMutation.mutate(nameData)}
              disabled={!nameData.nameFirst || !nameData.nameLast || encryptMutation.isPending}
            >
              Encrypt for Storage
            </Button>
          </div>

          {normalizeMutation.data && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-xs font-mono space-y-1">
                  <div><span className="text-muted-foreground">First:</span> {normalizeMutation.data.normalized.first}</div>
                  <div><span className="text-muted-foreground">Middle:</span> {normalizeMutation.data.normalized.middle}</div>
                  <div><span className="text-muted-foreground">Last:</span> {normalizeMutation.data.normalized.last}</div>
                  <div><span className="text-muted-foreground">Display:</span> {normalizeMutation.data.displayName}</div>
                  <div><span className="text-muted-foreground">NMN:</span>{" "}
                    <Badge variant={normalizeMutation.data.isNMN ? "default" : "secondary"}>
                      {normalizeMutation.data.isNMN ? "Yes — No Middle Name" : "No — Has Middle Name"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {encryptMutation.data && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-xs space-y-2">
                  <div className="font-semibold text-muted-foreground">Encrypted Fields (AES-256-GCM):</div>
                  <div className="font-mono text-[10px] break-all">
                    <div><span className="text-muted-foreground">nameFirstEnc:</span> {encryptMutation.data.encrypted.nameFirstEnc}</div>
                    <div><span className="text-muted-foreground">nameMiddleEnc:</span> {encryptMutation.data.encrypted.nameMiddleEnc}</div>
                    <div><span className="text-muted-foreground">nameLastEnc:</span> {encryptMutation.data.encrypted.nameLastEnc}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">hasNoMiddleName:</span>{" "}
                    <Badge variant={encryptMutation.data.encrypted.hasNoMiddleName ? "default" : "secondary"}>
                      {String(encryptMutation.data.encrypted.hasNoMiddleName)}
                    </Badge>
                  </div>
                  <div><span className="text-muted-foreground">Display preview:</span> {encryptMutation.data.displayPreview}</div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LabOrderTab() {
  const { toast } = useToast();
  const [nameData, setNameData] = useState<PatientNameData>({
    nameFirst: "",
    nameMiddle: "",
    nameLast: "",
  });

  const labOrderMutation = useMutation({
    mutationFn: async (data: PatientNameData) => {
      const encRes = await apiRequest("POST", "/api/nmn/encrypt-name", data);
      const encData = await encRes.json();
      const labRes = await apiRequest("POST", "/api/nmn/lab-order-name", encData.encrypted);
      return labRes.json();
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lab Order Name Format</CardTitle>
          <CardDescription>
            Generate HL7 v2 LAST^FIRST^MIDDLE format for Quest/LabCorp and FHIR HumanName resource
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PatientNameForm value={nameData} onChange={setNameData} />

          <Button
            data-testid="button-generate-lab-order"
            onClick={() => labOrderMutation.mutate(nameData)}
            disabled={!nameData.nameFirst || !nameData.nameLast || labOrderMutation.isPending}
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Lab Order Name
          </Button>

          {labOrderMutation.data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">HL7 v2 Format</CardTitle>
                  <CardDescription className="text-xs">Quest/LabCorp specimen matching</CardDescription>
                </CardHeader>
                <CardContent>
                  <code className="text-sm font-mono font-bold" data-testid="text-hl7-name">
                    {labOrderMutation.data.hl7}
                  </code>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Display Format</CardTitle>
                  <CardDescription className="text-xs">Human-readable</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm font-semibold" data-testid="text-display-name">
                    {labOrderMutation.data.display}
                  </span>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">FHIR HumanName</CardTitle>
                  <CardDescription className="text-xs">R4 compliant resource</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono" data-testid="text-fhir-name">
                    {JSON.stringify(labOrderMutation.data.fhir, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PayerTokensTab() {
  const { toast } = useToast();
  const [userId, setUserId] = useState("auth0|demo-patient-001");
  const [sourceType, setSourceType] = useState("cigna");
  const [fhirBaseUrl, setFhirBaseUrl] = useState("https://fhir.cigna.com/PatientAccess/v1-devportal");

  const sourcesQuery = useQuery<{ sources: string[] }>({
    queryKey: ["/api/auth0-smart/connected-sources", userId],
    enabled: false,
  });

  const storeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth0-smart/store-payer-token", {
        auth0UserId: userId,
        sourceType,
        tokens: {
          accessToken: `demo-access-${sourceType}-${Date.now()}`,
          refreshToken: `demo-refresh-${sourceType}-${Date.now()}`,
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          fhirBaseUrl,
          sourceType,
          connectedAt: new Date().toISOString(),
        },
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Payer token stored", description: `${sourceType} token stored successfully` });
      queryClient.invalidateQueries({ queryKey: ["/api/auth0-smart/connected-sources", userId] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async (src: string) => {
      const res = await apiRequest("POST", "/api/auth0-smart/refresh-payer-token", {
        auth0UserId: userId,
        sourceType: src,
      });
      return res.json();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (src: string) => {
      const res = await apiRequest("DELETE", "/api/auth0-smart/disconnect-payer", {
        auth0UserId: userId,
        sourceType: src,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth0-smart/connected-sources", userId] });
    },
  });

  const payerOptions = [
    { value: "cigna", label: "Cigna", url: "https://fhir.cigna.com/PatientAccess/v1-devportal" },
    { value: "united", label: "UnitedHealthcare", url: "https://fhir.uhc.com/v1" },
    { value: "aetna", label: "Aetna/CVS", url: "https://vteapif1.aetna.com/fhirdemo/v1/patientaccess" },
    { value: "humana", label: "Humana", url: "https://fhir.humana.com/api" },
    { value: "quest", label: "Quest Diagnostics", url: "https://fhir.questdiagnostics.com/r4" },
    { value: "labcorp", label: "LabCorp", url: "https://fhir.labcorp.com/r4" },
    { value: "epic", label: "Epic MyChart", url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>SMART on FHIR Payer Token Management</CardTitle>
          <CardDescription>
            Auth0 as identity broker — store, refresh, and manage payer access tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nmn-auth0-smart-auth0-user-id">Auth0 User ID</Label>
              <Input id="nmn-auth0-smart-auth0-user-id"
                data-testid="input-auth0-user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nmn-auth0-smart-payer-source">Payer Source</Label>
              <select id="nmn-auth0-smart-payer-source"
                data-testid="select-payer-source"
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                value={sourceType}
                onChange={(e) => {
                  setSourceType(e.target.value);
                  const payer = payerOptions.find((p) => p.value === e.target.value);
                  if (payer) setFhirBaseUrl(payer.url);
                }}
              >
                {payerOptions.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nmn-auth0-smart-fhir-base-url">FHIR Base URL</Label>
            <Input id="nmn-auth0-smart-fhir-base-url"
              data-testid="input-fhir-base-url"
              value={fhirBaseUrl}
              onChange={(e) => setFhirBaseUrl(e.target.value)}
            />
          </div>

          <div className="flex gap-3">
            <Button
              data-testid="button-store-token"
              onClick={() => storeMutation.mutate()}
              disabled={storeMutation.isPending}
            >
              <Key className="h-4 w-4 mr-2" />
              Store Payer Token
            </Button>
            <Button
              data-testid="button-check-sources"
              variant="outline"
              onClick={() => sourcesQuery.refetch()}
            >
              Check Connected Sources
            </Button>
          </div>

          {storeMutation.data && (
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="pt-4 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Token stored via {storeMutation.data.method}</span>
              </CardContent>
            </Card>
          )}

          {sourcesQuery.data && (
            <Card className="bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Connected Sources</CardTitle>
              </CardHeader>
              <CardContent>
                {sourcesQuery.data.sources.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payer connections found</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {sourcesQuery.data.sources.map((src) => (
                      <div key={src} className="flex items-center gap-1">
                        <Badge>{src}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1"
                          data-testid={`button-refresh-${src}`}
                          onClick={() => refreshMutation.mutate(src)}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1 text-destructive"
                          data-testid={`button-disconnect-${src}`}
                          onClick={() => disconnectMutation.mutate(src)}
                        >
                          <Unplug className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">SMART on FHIR Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { step: "1", label: "Patient logs in", sub: "Auth0 OIDC" },
              { step: "2", label: "Add payer", sub: "Fasten picker" },
              { step: "3", label: "SMART OAuth", sub: "Payer's OAuth" },
              { step: "4", label: "Token stored", sub: "Auth0 metadata" },
              { step: "5", label: "FHIR sync", sub: "Fasten fetches" },
              { step: "6", label: "GCP FHIR Store", sub: "Records land" },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                <div className="rounded-lg border bg-muted/50 p-2 text-center min-w-[100px]">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Step {s.step}</div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-muted-foreground text-[10px]">{s.sub}</div>
                </div>
                {i < 5 && <span className="text-primary font-bold">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigTab() {
  const configQuery = useQuery<{
    auth0Domain: string;
    auth0MgmtClientId: string;
    auth0MgmtClientSecret: string;
    applications: Record<string, { type: string; audience: string }>;
  }>({
    queryKey: ["/api/auth0-smart/config"],
  });

  const actionQuery = useQuery<{ code: string; instructions: string }>({
    queryKey: ["/api/auth0-smart/post-login-action"],
  });

  const fastenQuery = useQuery<{ yaml: string; instructions: string }>({
    queryKey: ["/api/auth0-smart/fasten-config"],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auth0 Applications</CardTitle>
          <CardDescription>Three Auth0 applications, one tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {configQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : configQuery.data ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground mb-2">
                Domain: <code>{configQuery.data.auth0Domain}</code>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-semibold">Application</th>
                      <th className="text-left py-2 pr-4 font-semibold">Type</th>
                      <th className="text-left py-2 font-semibold">Audience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(configQuery.data.applications).map(([name, app]) => (
                      <tr key={name} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono">{name}</td>
                        <td className="py-2 pr-4"><Badge variant="secondary">{app.type}</Badge></td>
                        <td className="py-2 font-mono text-muted-foreground">{app.audience}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {actionQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auth0 Post-Login Action</CardTitle>
            <CardDescription className="text-xs">{actionQuery.data.instructions}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-post-login-action">
              {actionQuery.data.code}
            </pre>
          </CardContent>
        </Card>
      )}

      {fastenQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Fasten Health config.yaml</CardTitle>
            <CardDescription className="text-xs">{fastenQuery.data.instructions}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-fasten-config">
              {fastenQuery.data.yaml}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataBoundaryTab() {
  const boundaryQuery = useQuery<{
    boundary: Array<{
      data: string;
      storedInAuth0: boolean;
      storageType: string;
      notes: string;
    }>;
  }>({
    queryKey: ["/api/auth0-smart/data-boundary"],
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What Auth0 Knows vs What It Never Sees</CardTitle>
          <CardDescription>
            Data boundary between Auth0 identity broker and GCP health data stores
          </CardDescription>
        </CardHeader>
        <CardContent>
          {boundaryQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : boundaryQuery.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold">Data</th>
                    <th className="text-left py-2 pr-4 font-semibold">In Auth0?</th>
                    <th className="text-left py-2 pr-4 font-semibold">Storage</th>
                    <th className="text-left py-2 font-semibold">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {boundaryQuery.data.boundary.map((row) => (
                    <tr key={row.data} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-semibold">{row.data}</td>
                      <td className="py-2 pr-4">
                        {row.storedInAuth0 ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {row.storageType}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20">
                            <XCircle className="h-3 w-3 mr-1" />
                            Never
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-muted-foreground">{row.storageType}</td>
                      <td className="py-2 text-muted-foreground">{row.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-red-600">Auth0 CANNOT replace the payer's OIDC server</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Epic's FHIR API requires Epic's OAuth, not Auth0. The payer IS the authorization server for their own FHIR data (HL7 FHIR R4, §6.6.3).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-semibold text-sm text-green-600">Auth0 CAN be the OIDC identity broker for YOUR services</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Auth0 authenticates patients to Tabula Medica and Uninsurance, then stores encrypted payer tokens in user_metadata.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BaaTab() {
  const baaQuery = useQuery<{
    id: string;
    status: string;
    auth0AccountTier: string;
    baaSignedDate: string | null;
    baaExpirationDate: string | null;
    coveredEntity: string;
    businessAssociate: string;
    hipaaVersion: string;
    hitechCompliant: boolean;
    lastAuditDate: string | null;
    complianceChecks: Array<{
      id: string;
      name: string;
      description: string;
      status: string;
      requirement: string;
      lastChecked: string;
      details: string;
    }>;
  }>({
    queryKey: ["/api/healthcare-hardening/baa-status"],
  });

  const checklistQuery = useQuery<{
    checklist: Array<{
      id: string;
      category: string;
      item: string;
      status: string;
      priority: string;
      regulation: string;
      details: string;
    }>;
  }>({
    queryKey: ["/api/healthcare-hardening/checklist"],
  });

  const statusColors: Record<string, string> = {
    pass: "bg-green-500/10 text-green-600 border-green-500/20",
    fail: "bg-red-500/10 text-red-600 border-red-500/20",
    warning: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    not_applicable: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const checklistStatusColors: Record<string, string> = {
    done: "bg-green-500/10 text-green-600 border-green-500/20",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blocked: "bg-red-500/10 text-red-600 border-red-500/20",
    in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  const priorityColors: Record<string, string> = {
    P0: "bg-red-500/10 text-red-600 border-red-500/20",
    P1: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    P2: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Business Associate Agreement (BAA)</CardTitle>
              <CardDescription>
                HIPAA/HITECH compliance requires an executed BAA with Auth0 (Okta) before storing any ePHI
              </CardDescription>
            </div>
            {baaQuery.data && (
              <Badge className={baaQuery.data.status === "executed"
                ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"} data-testid="badge-baa-status">
                {baaQuery.data.status === "executed" ? "BAA Executed" : "BAA Not Executed"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {baaQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : baaQuery.data ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Covered Entity</div>
                  <div className="text-sm font-semibold mt-1" data-testid="text-covered-entity">{baaQuery.data.coveredEntity}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Business Associate</div>
                  <div className="text-sm font-semibold mt-1">{baaQuery.data.businessAssociate}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Account Tier</div>
                  <div className="text-sm font-semibold mt-1">{baaQuery.data.auth0AccountTier}</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">HIPAA Version</div>
                  <div className="text-sm font-semibold mt-1 text-xs">{baaQuery.data.hipaaVersion}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3">Compliance Checks</h4>
                <div className="space-y-2">
                  {baaQuery.data.complianceChecks.map((check) => (
                    <div key={check.id} className="rounded-lg border p-3" data-testid={`compliance-check-${check.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={statusColors[check.status] || ""}>
                              {check.status}
                            </Badge>
                            <span className="text-sm font-semibold">{check.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{check.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] text-muted-foreground font-mono">{check.requirement}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {checklistQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Healthcare Hardening Checklist</CardTitle>
            <CardDescription>All items required before production with ePHI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checklistQuery.data.checklist.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 flex items-start gap-3" data-testid={`checklist-${item.id}`}>
                  <div className="mt-0.5">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : item.status === "blocked" ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : item.status === "in_progress" ? (
                      <Clock className="h-4 w-4 text-blue-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{item.item}</span>
                      <Badge className={priorityColors[item.priority] || ""} variant="outline">{item.priority}</Badge>
                      <Badge className={checklistStatusColors[item.status] || ""} variant="outline">{item.status}</Badge>
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1">{item.regulation}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MfaTab() {
  const mfaQuery = useQuery<{
    enforcementLevel: string;
    allowedMethods: string[];
    phishingResistantRequired: boolean;
    smsDeprecated: boolean;
    smsDeprecationDate: string;
    gracePeriodDays: number;
    rememberDeviceDays: number;
    adaptiveRiskThreshold: number;
    webauthnConfig: {
      enabled: boolean;
      rpName: string;
      rpId: string;
      attestation: string;
      authenticatorSelection: {
        authenticatorAttachment: string | null;
        residentKey: string;
        userVerification: string;
      };
      supportedAlgorithms: number[];
      allowedAuthenticatorTypes: string[];
      timeout: number;
    };
    enrollmentStats: {
      totalUsers: number;
      webauthnEnrolled: number;
      totpEnrolled: number;
      smsOnly: number;
      noMfa: number;
      phishingResistantPercent: number;
    };
  }>({
    queryKey: ["/api/healthcare-hardening/mfa-policy"],
  });

  const actionQuery = useQuery<{ code: string; instructions: string }>({
    queryKey: ["/api/healthcare-hardening/webauthn-action"],
  });

  const guardianQuery = useQuery<{ config: string; instructions: string }>({
    queryKey: ["/api/healthcare-hardening/guardian-config"],
  });

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-amber-600">2026 HHS Phishing-Resistant MFA Mandate</div>
              <p className="text-xs text-muted-foreground mt-1">
                Per 2026 HHS standards, SMS codes are no longer sufficient for healthcare applications.
                WebAuthn (FIDO2) is now required — Face ID, Touch ID, Windows Hello, or YubiKeys.
                NIST SP 800-63B §5.1.3.3 classifies SMS as a "restricted authenticator."
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {mfaQuery.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Enforcement</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="bg-red-500/10 text-red-600 mb-2" data-testid="badge-mfa-enforcement">
                  {mfaQuery.data.enforcementLevel.toUpperCase()}
                </Badge>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>Grace period: {mfaQuery.data.gracePeriodDays} days</div>
                  <div>Remember device: {mfaQuery.data.rememberDeviceDays} days</div>
                  <div>Adaptive threshold: {mfaQuery.data.adaptiveRiskThreshold}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Allowed Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {mfaQuery.data.allowedMethods.map((m) => (
                    <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                  ))}
                </div>
                {mfaQuery.data.smsDeprecated && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-red-500">
                    <XCircle className="h-3 w-3" />
                    SMS deprecated since {new Date(mfaQuery.data.smsDeprecationDate).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Phishing-Resistant</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={mfaQuery.data.phishingResistantRequired
                  ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}>
                  {mfaQuery.data.phishingResistantRequired ? "Required" : "Optional"}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  WebAuthn (FIDO2) binds authentication to the origin domain, preventing phishing and man-in-the-middle attacks.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">WebAuthn (FIDO2) Configuration</CardTitle>
              <CardDescription>Relying Party configuration for passkey and security key enrollment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Relying Party Name</span>
                    <span className="font-mono font-semibold" data-testid="text-rp-name">{mfaQuery.data.webauthnConfig.rpName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Relying Party ID</span>
                    <span className="font-mono font-semibold">{mfaQuery.data.webauthnConfig.rpId}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Attestation</span>
                    <span className="font-mono font-semibold">{mfaQuery.data.webauthnConfig.attestation}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">Resident Key</span>
                    <span className="font-mono font-semibold">{mfaQuery.data.webauthnConfig.authenticatorSelection.residentKey}</span>
                  </div>
                  <div className="flex justify-between border-b pb-1">
                    <span className="text-muted-foreground">User Verification</span>
                    <span className="font-mono font-semibold">{mfaQuery.data.webauthnConfig.authenticatorSelection.userVerification}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Timeout</span>
                    <span className="font-mono font-semibold">{mfaQuery.data.webauthnConfig.timeout / 1000}s</span>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold mb-2">Supported Authenticators</div>
                  <div className="space-y-1">
                    {mfaQuery.data.webauthnConfig.allowedAuthenticatorTypes.map((a) => (
                      <div key={a} className="flex items-center gap-2 text-xs">
                        <Fingerprint className="h-3 w-3 text-primary" />
                        <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {actionQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">WebAuthn Enrollment Enforcement Action</CardTitle>
            <CardDescription className="text-xs">{actionQuery.data.instructions}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-webauthn-action">
              {actionQuery.data.code}
            </pre>
          </CardContent>
        </Card>
      )}

      {guardianQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Auth0 Guardian MFA Configuration</CardTitle>
            <CardDescription className="text-xs">{guardianQuery.data.instructions}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-guardian-config">
              {guardianQuery.data.config}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TenantIsolationTab() {
  const isolationQuery = useQuery<{
    organizations: Array<{
      id: string;
      name: string;
      displayName: string;
      segment: string;
      branding: { logoUrl: string | null; primaryColor: string };
      metadata: Record<string, string>;
      memberCount: number;
      connections: Array<{
        connectionId: string;
        connectionName: string;
        connectionType: string;
        assignMembershipOnLogin: boolean;
        showAsButton: boolean;
      }>;
      mfaPolicy: string;
      createdAt: string;
    }>;
    segmentPolicies: Array<{
      segment: string;
      allowedRoles: string[];
      mfaEnforcement: string;
      sessionLifetimeMinutes: number;
      idleTimeoutMinutes: number;
      geoRestrictions: string[];
      dataAccessScope: string[];
    }>;
    crossSegmentRules: Array<{
      fromSegment: string;
      toSegment: string;
      allowed: boolean;
      requiresEscalation: boolean;
      auditRequired: boolean;
      description: string;
    }>;
  }>({
    queryKey: ["/api/healthcare-hardening/tenant-isolation"],
  });

  const orgActionQuery = useQuery<{ code: string; instructions: string }>({
    queryKey: ["/api/healthcare-hardening/org-action"],
  });

  const segmentColors: Record<string, string> = {
    standard_patient: "#0d9e8a",
    provider_admin: "#3b82f6",
    clinic_admin: "#8b5cf6",
    system_admin: "#ef4444",
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-blue-600">Auth0 Organizations — HIPAA Tenant Isolation</div>
              <p className="text-xs text-muted-foreground mt-1">
                Separate "Standard Uninsurance Users" from "Provider/Clinic Admins" using Auth0 Organizations.
                This prevents lateral movement if one segment is breached. Each organization has its own
                connection policies, MFA rules, and session lifetimes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isolationQuery.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isolationQuery.data.organizations.map((org) => (
              <Card key={org.id} data-testid={`org-card-${org.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: org.branding.primaryColor }} />
                    <CardTitle className="text-sm">{org.displayName}</CardTitle>
                  </div>
                  <CardDescription className="text-xs font-mono">{org.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">{org.segment}</Badge>
                    <Badge variant="outline" className="text-[10px]">MFA: {org.mfaPolicy}</Badge>
                    <Badge variant="outline" className="text-[10px]">{org.memberCount} members</Badge>
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Connections</div>
                    <div className="space-y-1">
                      {org.connections.map((conn) => (
                        <div key={conn.connectionId} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{conn.connectionName}</span>
                          <Badge variant="secondary" className="text-[10px]">{conn.connectionType}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Metadata</div>
                    <div className="space-y-0.5">
                      {Object.entries(org.metadata).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[11px]">
                          <span className="text-muted-foreground font-mono">{k}</span>
                          <span className="font-semibold">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Segment Access Policies</CardTitle>
              <CardDescription>Session limits, data scope, and geographic restrictions per segment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-3 font-semibold">Segment</th>
                      <th className="text-left py-2 pr-3 font-semibold">MFA</th>
                      <th className="text-left py-2 pr-3 font-semibold">Session</th>
                      <th className="text-left py-2 pr-3 font-semibold">Idle</th>
                      <th className="text-left py-2 pr-3 font-semibold">Roles</th>
                      <th className="text-left py-2 font-semibold">Data Scope</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolationQuery.data.segmentPolicies.map((policy) => (
                      <tr key={policy.segment} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segmentColors[policy.segment] || "#666" }} />
                            <span className="font-mono font-semibold">{policy.segment}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline" className="text-[10px]">{policy.mfaEnforcement}</Badge>
                        </td>
                        <td className="py-2 pr-3 font-mono">{policy.sessionLifetimeMinutes}m</td>
                        <td className="py-2 pr-3 font-mono">{policy.idleTimeoutMinutes}m</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {policy.allowedRoles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {policy.dataAccessScope.map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cross-Segment Access Rules</CardTitle>
              <CardDescription>Lateral movement prevention between tenant segments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {isolationQuery.data.crossSegmentRules.map((rule, i) => (
                  <div key={i} className={`rounded-lg border p-3 ${rule.allowed ? "border-green-500/20" : "border-red-500/20"}`}
                    data-testid={`cross-segment-rule-${i}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">{rule.fromSegment}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline" className="font-mono text-[10px]">{rule.toSegment}</Badge>
                      </div>
                      {rule.allowed ? (
                        <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Allowed
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-600 text-[10px]">
                          <Lock className="h-2.5 w-2.5 mr-0.5" /> Blocked
                        </Badge>
                      )}
                      {rule.requiresEscalation && (
                        <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">Escalation Required</Badge>
                      )}
                      {rule.auditRequired && (
                        <Badge variant="outline" className="text-[10px]">Audited</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {orgActionQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Organization Segment Enforcement Action</CardTitle>
            <CardDescription className="text-xs">{orgActionQuery.data.instructions}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-org-action">
              {orgActionQuery.data.code}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JwtVerifyTab() {
  const [testToken, setTestToken] = useState("");
  const { toast } = useToast();

  const configQuery = useQuery<{
    issuerBaseUrl: string;
    audience: string;
    issuer: string;
    jwksUri: string;
    claims: Record<string, string>;
    envVars: {
      required: string[];
      optional: string[];
      note: string;
    };
    cors: {
      uninsuranceOrigin: string;
      productionOrigins: string[];
      devPatterns: string[];
    };
    middleware: {
      requireAuth0Token: {
        description: string;
        usage: string;
        options: Record<string, string>;
      };
      convenienceMiddleware: Record<string, string>;
      standaloneVerifiers: Record<string, string>;
    };
    postLoginAction: {
      description: string;
      claims: Array<{ key: string; namespace: string; source: string }>;
    };
    integrationCode: { description: string; example: string };
  }>({
    queryKey: ["/api/auth0-jwt/config"],
  });

  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      const resp = await fetch("/api/auth0-jwt/verify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      if (!resp.ok) throw new Error(`Verification failed: ${resp.statusText}`);
      return resp.json();
    },
    onError: (err: any) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/20 bg-violet-500/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-violet-500 mt-0.5" />
            <div>
              <div className="font-semibold text-sm text-violet-600">Auth0 JWT Verification Middleware</div>
              <p className="text-xs text-muted-foreground mt-1">
                JWKS-backed token verification using <code className="text-[10px] bg-muted px-1 rounded">jose</code>.
                Verifies tokens from Auth0 using only <code className="text-[10px] bg-muted px-1 rounded">AUTH0_ISSUER_BASE_URL</code> and{" "}
                <code className="text-[10px] bg-muted px-1 rounded">AUTH0_AUDIENCE</code>. No client ID or secret needed — Tabula Medica only verifies, it does not initiate login.
                Extracts SAID™ Patient ID and HIPAA segment claims, enforces PHI access boundaries, and allows cross-origin requests from Uninsurance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {configQuery.data && (
        <>
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Required Environment Variables</CardTitle>
              <CardDescription className="text-xs">{configQuery.data.envVars.note}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configQuery.data.envVars.required.map((v) => (
                  <div key={v} className="flex items-center gap-2 text-xs">
                    <Badge className="bg-green-500/10 text-green-600 text-[10px]">required</Badge>
                    <span className="font-mono font-semibold">{v}</span>
                    <span className="text-muted-foreground">
                      {v === "AUTH0_ISSUER_BASE_URL" ? `= ${configQuery.data!.issuerBaseUrl}` : `= ${configQuery.data!.audience}`}
                    </span>
                  </div>
                ))}
                {configQuery.data.envVars.optional.map((v) => (
                  <div key={v} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">optional</Badge>
                    <span className="font-mono font-semibold">{v}</span>
                    <span className="text-muted-foreground text-[10px]">Uninsurance Replit URL for CORS</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Auth0 Issuer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Issuer Base URL</span>
                  <span className="font-mono font-semibold text-[10px]" data-testid="text-jwt-issuer">{configQuery.data.issuerBaseUrl}</span>
                </div>
                <div className="flex justify-between border-b pb-1">
                  <span className="text-muted-foreground">Issuer (trailing /)</span>
                  <span className="font-mono font-semibold text-[10px]">{configQuery.data.issuer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">JWKS URI</span>
                  <span className="font-mono text-[10px] max-w-[180px] truncate">{configQuery.data.jwksUri}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Audience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="font-mono text-[10px] font-semibold" data-testid="text-audience">
                  {configQuery.data.audience}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Single audience — both TM and Uninsurance tokens are issued for this audience by the same Auth0 tenant.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">CORS — Uninsurance</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Origin</div>
                  <div className="font-mono font-semibold text-[10px]" data-testid="text-cors-origin">{configQuery.data.cors.uninsuranceOrigin}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Production</div>
                  <div className="flex flex-wrap gap-1">
                    {configQuery.data.cors.productionOrigins.map((o) => (
                      <Badge key={o} variant="outline" className="text-[10px] font-mono">{o}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">JWT Custom Claims (Post-Login Action)</CardTitle>
              <CardDescription>{configQuery.data.postLoginAction.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configQuery.data.postLoginAction.claims.map((claim) => (
                  <div key={claim.key} className="rounded-lg border p-3 flex items-start gap-3" data-testid={`claim-${claim.key}`}>
                    <Key className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{claim.key}</span>
                        <Badge variant="outline" className="text-[10px] font-mono max-w-[300px] truncate">
                          {claim.namespace}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Source: <code className="text-[10px] bg-muted px-1 rounded">{claim.source}</code>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Convenience Middleware & Standalone Verifiers</CardTitle>
              <CardDescription>Pre-configured middleware for common access patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-semibold mb-2">Middleware</div>
                <div className="space-y-2">
                  {Object.entries(configQuery.data.middleware.convenienceMiddleware).map(([name, usage]) => (
                    <div key={name} className="flex items-center justify-between rounded-lg border p-2">
                      <span className="text-xs font-mono font-semibold">{name}()</span>
                      <span className="text-[10px] font-mono text-muted-foreground max-w-[400px] truncate">{usage}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold mb-2">Standalone Verifiers</div>
                <div className="space-y-2">
                  {Object.entries(configQuery.data.middleware.standaloneVerifiers).map(([name, desc]) => (
                    <div key={name} className="flex items-start gap-3 rounded-lg border p-2">
                      <span className="text-xs font-mono font-semibold shrink-0">{name}()</span>
                      <span className="text-[10px] text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Integration Example</CardTitle>
              <CardDescription>{configQuery.data.integrationCode.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap" data-testid="text-jwt-example">
                {configQuery.data.integrationCode.example}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Token Verification Tester</CardTitle>
          <CardDescription>Paste an Auth0 JWT to verify it against the JWKS endpoint and extract claims</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="test-token" className="text-xs">Bearer Token</Label>
            <textarea
              id="test-token"
              data-testid="input-test-token"
              className="w-full mt-1 rounded-lg border bg-muted/30 p-3 text-[11px] font-mono h-24 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii..."
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            data-testid="button-verify-token"
            disabled={!testToken.trim() || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate(testToken.trim())}
          >
            {verifyMutation.isPending ? (
              <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Verifying...</>
            ) : (
              <><Shield className="h-3.5 w-3.5 mr-1.5" /> Verify Token</>
            )}
          </Button>

          {verifyMutation.data && (
            <div className={`rounded-lg border p-4 mt-3 ${
              verifyMutation.data.valid
                ? "border-green-500/20 bg-green-500/5"
                : "border-red-500/20 bg-red-500/5"
            }`} data-testid="verify-result">
              <div className="flex items-center gap-2 mb-2">
                {verifyMutation.data.valid ? (
                  <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm font-semibold text-green-600">Valid Token</span></>
                ) : (
                  <><XCircle className="h-4 w-4 text-red-500" /><span className="text-sm font-semibold text-red-600">Invalid Token</span></>
                )}
                {verifyMutation.data.tokenType && (
                  <Badge variant="outline" className="text-[10px] font-mono">{verifyMutation.data.tokenType}</Badge>
                )}
              </div>
              <pre className="text-[11px] font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(verifyMutation.data, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
