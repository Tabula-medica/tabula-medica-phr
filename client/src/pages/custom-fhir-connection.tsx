import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Server,
  CheckCircle2,
  XCircle,
  Loader2,
  Shield,
  Key,
  Link2,
  ArrowLeft,
  RefreshCw,
  Database,
  FileText,
  AlertTriangle,
  Info,
  Lock,
  Unlock,
  Globe,
  Settings,
  Zap
} from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const PATIENT_ID = "patient-1";

type AuthType = "none" | "api_key" | "basic" | "oauth2" | "smart_on_fhir";
type FhirVersion = "R4" | "STU3" | "DSTU2";

interface CustomFhirConfig {
  serverUrl: string;
  serverName: string;
  authType: AuthType;
  apiKey?: string;
  apiKeyHeader?: string;
  basicUsername?: string;
  basicPassword?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  oauthScopes?: string[];
  smartOnFhirLaunchUrl?: string;
  fhirVersion?: FhirVersion;
  supportedResources?: string[];
  customHeaders?: Record<string, string>;
  verifySsl?: boolean;
}

interface TestResult {
  connected: boolean;
  serverName: string;
  serverVersion: string;
  fhirVersion: string;
  supportedResources: string[];
  resourceCount: number;
  securityInfo: string[];
}

export default function CustomFhirConnection() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<CustomFhirConfig>({
    serverUrl: "",
    serverName: "",
    authType: "none",
    fhirVersion: "R4",
    verifySsl: true,
  });
  
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [selectedResources, setSelectedResources] = useState<string[]>([
    "Patient", "Observation", "Condition", "MedicationRequest", "AllergyIntolerance"
  ]);

  const { data: resourceTypesData } = useQuery({
    queryKey: ["/api/custom-fhir/resource-types"],
  });

  const resourceTypes = (resourceTypesData as any)?.data || [];

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/custom-fhir/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data as TestResult;
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({ title: "Connection successful", description: `Connected to ${data.serverName}` });
    },
    onError: (error: Error) => {
      setTestResult(null);
      toast({ title: "Connection failed", description: error.message, variant: "destructive" });
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/custom-fhir/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: PATIENT_ID, config }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-data-sources/connections"] });
      toast({ title: "Connection created", description: "Custom FHIR server connection has been saved" });
      navigate("/connections");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof CustomFhirConfig>(field: K, value: CustomFhirConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const getAuthIcon = (authType: AuthType) => {
    switch (authType) {
      case "none": return <Unlock className="w-4 h-4" />;
      case "api_key": return <Key className="w-4 h-4" />;
      case "basic": return <Lock className="w-4 h-4" />;
      case "oauth2": return <Shield className="w-4 h-4" />;
      case "smart_on_fhir": return <Zap className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/connections")} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Connect Custom FHIR Server</h1>
          <p className="text-muted-foreground">Configure a connection to any FHIR R4-compliant server</p>
        </div>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertTitle>FHIR Server Requirements</AlertTitle>
        <AlertDescription>
          Your server must support FHIR R4 (or STU3/DSTU2) and expose a /metadata endpoint. 
          Credentials are securely encrypted and never shared.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" data-testid="tab-basic">
            <Globe className="w-4 h-4 mr-2" />
            Server Details
          </TabsTrigger>
          <TabsTrigger value="auth" data-testid="tab-auth">
            <Shield className="w-4 h-4 mr-2" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="advanced" data-testid="tab-advanced">
            <Settings className="w-4 h-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Server Information</CardTitle>
              <CardDescription>Enter the FHIR server URL and display name</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">FHIR Server URL *</Label>
                <Input
                  id="serverUrl"
                  placeholder="https://fhir.example.com/r4"
                  value={config.serverUrl}
                  onChange={(e) => updateField("serverUrl", e.target.value)}
                  data-testid="input-server-url"
                />
                <p className="text-xs text-muted-foreground">
                  The base URL of the FHIR server (e.g., https://hapi.fhir.org/baseR4)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serverName">Display Name *</Label>
                <Input
                  id="serverName"
                  placeholder="My Healthcare Provider"
                  value={config.serverName}
                  onChange={(e) => updateField("serverName", e.target.value)}
                  data-testid="input-server-name"
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this connection
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fhirVersion">FHIR Version</Label>
                <Select
                  value={config.fhirVersion}
                  onValueChange={(v) => updateField("fhirVersion", v as FhirVersion)}
                >
                  <SelectTrigger data-testid="select-fhir-version">
                    <SelectValue placeholder="Select FHIR version" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="R4">FHIR R4 (Recommended)</SelectItem>
                    <SelectItem value="STU3">FHIR STU3</SelectItem>
                    <SelectItem value="DSTU2">FHIR DSTU2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Authentication Method</CardTitle>
              <CardDescription>Configure how to authenticate with the FHIR server</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Authentication Type</Label>
                <Select
                  value={config.authType}
                  onValueChange={(v) => updateField("authType", v as AuthType)}
                >
                  <SelectTrigger data-testid="select-auth-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Unlock className="w-4 h-4" />
                        No Authentication (Public Server)
                      </div>
                    </SelectItem>
                    <SelectItem value="api_key">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        API Key
                      </div>
                    </SelectItem>
                    <SelectItem value="basic">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        Basic Authentication
                      </div>
                    </SelectItem>
                    <SelectItem value="oauth2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        OAuth 2.0
                      </div>
                    </SelectItem>
                    <SelectItem value="smart_on_fhir">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        SMART on FHIR
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {config.authType === "api_key" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your API key"
                      value={config.apiKey || ""}
                      onChange={(e) => updateField("apiKey", e.target.value)}
                      data-testid="input-api-key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKeyHeader">Header Name</Label>
                    <Input
                      id="apiKeyHeader"
                      placeholder="Authorization (default) or X-API-Key"
                      value={config.apiKeyHeader || ""}
                      onChange={(e) => updateField("apiKeyHeader", e.target.value)}
                      data-testid="input-api-key-header"
                    />
                    <p className="text-xs text-muted-foreground">
                      The HTTP header to send the API key in (defaults to Authorization)
                    </p>
                  </div>
                </div>
              )}

              {config.authType === "basic" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username *</Label>
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={config.basicUsername || ""}
                      onChange={(e) => updateField("basicUsername", e.target.value)}
                      data-testid="input-username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={config.basicPassword || ""}
                      onChange={(e) => updateField("basicPassword", e.target.value)}
                      data-testid="input-password"
                    />
                  </div>
                </div>
              )}

              {config.authType === "oauth2" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID *</Label>
                    <Input
                      id="clientId"
                      placeholder="Enter OAuth client ID"
                      value={config.oauthClientId || ""}
                      onChange={(e) => updateField("oauthClientId", e.target.value)}
                      data-testid="input-client-id"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clientSecret">Client Secret *</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Enter OAuth client secret"
                      value={config.oauthClientSecret || ""}
                      onChange={(e) => updateField("oauthClientSecret", e.target.value)}
                      data-testid="input-client-secret"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tokenUrl">Token URL *</Label>
                    <Input
                      id="tokenUrl"
                      placeholder="https://auth.example.com/oauth/token"
                      value={config.oauthTokenUrl || ""}
                      onChange={(e) => updateField("oauthTokenUrl", e.target.value)}
                      data-testid="input-token-url"
                    />
                  </div>
                </div>
              )}

              {config.authType === "smart_on_fhir" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <Alert>
                    <Zap className="w-4 h-4" />
                    <AlertDescription>
                      SMART on FHIR uses the server's well-known configuration for authentication. 
                      The launch URL will be discovered automatically from the capability statement.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="smartClientId">Client ID (if registered)</Label>
                    <Input
                      id="smartClientId"
                      placeholder="Enter SMART client ID if you have one"
                      value={config.oauthClientId || ""}
                      onChange={(e) => updateField("oauthClientId", e.target.value)}
                      data-testid="input-smart-client-id"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>Additional configuration options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verifySsl"
                  checked={config.verifySsl}
                  onCheckedChange={(checked) => updateField("verifySsl", checked as boolean)}
                  data-testid="checkbox-verify-ssl"
                />
                <Label htmlFor="verifySsl" className="text-sm">
                  Verify SSL Certificate (recommended for production)
                </Label>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Resources to Sync</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {resourceTypes.map((resource: { type: string; description: string }) => (
                    <div key={resource.type} className="flex items-start space-x-2">
                      <Checkbox
                        id={`resource-${resource.type}`}
                        checked={selectedResources.includes(resource.type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedResources([...selectedResources, resource.type]);
                          } else {
                            setSelectedResources(selectedResources.filter(r => r !== resource.type));
                          }
                        }}
                        data-testid={`checkbox-resource-${resource.type}`}
                      />
                      <div className="grid gap-1 leading-none">
                        <Label htmlFor={`resource-${resource.type}`} className="text-sm font-medium">
                          {resource.type}
                        </Label>
                        <p className="text-xs text-muted-foreground">{resource.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Test Connection</CardTitle>
          <CardDescription>Verify connectivity before saving</CardDescription>
        </CardHeader>
        <CardContent>
          {testResult ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Connection Successful</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Server Name</p>
                  <p className="font-medium text-sm">{testResult.serverName}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Version</p>
                  <p className="font-medium text-sm">{testResult.serverVersion}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">FHIR Version</p>
                  <p className="font-medium text-sm">{testResult.fhirVersion}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Resources</p>
                  <p className="font-medium text-sm">{testResult.resourceCount} types</p>
                </div>
              </div>
              {testResult.supportedResources.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="resources">
                    <AccordionTrigger className="text-sm">
                      View Supported Resources ({testResult.supportedResources.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="flex flex-wrap gap-2">
                        {testResult.supportedResources.map((r) => (
                          <Badge key={r} variant="outline">{r}</Badge>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Server className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">
                  Enter your server details and click "Test Connection" to verify connectivity
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={() => testConnectionMutation.mutate()}
            disabled={!config.serverUrl || !config.serverName || testConnectionMutation.isPending}
            data-testid="button-test-connection"
          >
            {testConnectionMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button
            onClick={() => createConnectionMutation.mutate()}
            disabled={!testResult || createConnectionMutation.isPending}
            data-testid="button-save-connection"
          >
            {createConnectionMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            Save Connection
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
