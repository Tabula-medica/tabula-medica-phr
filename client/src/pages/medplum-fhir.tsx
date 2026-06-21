import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSEO, buildPageSchemas } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Search,
  RefreshCw,
  Database,
  User,
  FileText,
  Pill,
  TestTube2,
  Syringe,
  Stethoscope,
  Shield,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Server,
  Wifi,
  WifiOff,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface MedplumStatus {
  connected: boolean;
  baseUrl: string;
  authenticated: boolean;
  lastCheckedAt: string;
  error?: string;
}

interface FHIRBundle {
  resourceType: string;
  type: string;
  total?: number;
  entry?: Array<{
    resource: any;
    fullUrl?: string;
  }>;
  link?: Array<{
    relation: string;
    url: string;
  }>;
}

const RESOURCE_TYPES = [
  { value: "Patient", label: "Patients", icon: User },
  { value: "Observation", label: "Observations", icon: Activity },
  { value: "Condition", label: "Conditions", icon: Stethoscope },
  { value: "MedicationRequest", label: "Medications", icon: Pill },
  { value: "DiagnosticReport", label: "Diagnostic Reports", icon: TestTube2 },
  { value: "Immunization", label: "Immunizations", icon: Syringe },
  { value: "AllergyIntolerance", label: "Allergies", icon: AlertCircle },
  { value: "Encounter", label: "Encounters", icon: FileText },
  { value: "Procedure", label: "Procedures", icon: Activity },
  { value: "DocumentReference", label: "Documents", icon: FileText },
  { value: "CarePlan", label: "Care Plans", icon: Shield },
];

function getDisplayValue(resource: any, field: string): string {
  const val = resource?.[field];
  if (val === undefined || val === null) return "—";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    const first = val[0];
    if (typeof first === "string") return first;
    if (first?.text) return first.text;
    if (first?.display) return first.display;
    if (first?.coding?.[0]?.display) return first.coding[0].display;
    if (first?.value) return String(first.value);
    return JSON.stringify(first).slice(0, 60);
  }
  if (val?.text) return val.text;
  if (val?.display) return val.display;
  if (val?.coding?.[0]?.display) return val.coding[0].display;
  if (val?.value) return String(val.value);
  return JSON.stringify(val).slice(0, 60);
}

function getPatientName(resource: any): string {
  if (resource.resourceType !== "Patient") return "—";
  const name = resource.name?.[0];
  if (!name) return "Unknown";
  const given = name.given?.join(" ") || "";
  const family = name.family || "";
  return `${given} ${family}`.trim() || "Unknown";
}

function getResourceSummary(resource: any): string {
  switch (resource.resourceType) {
    case "Patient":
      return getPatientName(resource);
    case "Observation":
      return getDisplayValue(resource, "code");
    case "Condition":
      return getDisplayValue(resource, "code");
    case "MedicationRequest":
      return getDisplayValue(resource, "medicationCodeableConcept") ||
        getDisplayValue(resource, "medicationReference");
    case "DiagnosticReport":
      return getDisplayValue(resource, "code");
    case "Immunization":
      return getDisplayValue(resource, "vaccineCode");
    case "AllergyIntolerance":
      return getDisplayValue(resource, "code");
    case "Encounter":
      return getDisplayValue(resource, "type");
    case "Procedure":
      return getDisplayValue(resource, "code");
    case "DocumentReference":
      return getDisplayValue(resource, "type");
    case "CarePlan":
      return resource.title || getDisplayValue(resource, "category");
    default:
      return resource.id || "—";
  }
}

function getResourceDate(resource: any): string {
  const dateFields = [
    "effectiveDateTime", "issued", "recordedDate", "authoredOn",
    "occurrenceDateTime", "date", "period", "created", "meta",
  ];
  for (const field of dateFields) {
    const val = resource[field];
    if (!val) continue;
    if (typeof val === "string") {
      try { return new Date(val).toLocaleDateString(); } catch { continue; }
    }
    if (val?.start) {
      try { return new Date(val.start).toLocaleDateString(); } catch { continue; }
    }
    if (val?.lastUpdated) {
      try { return new Date(val.lastUpdated).toLocaleDateString(); } catch { continue; }
    }
  }
  return "—";
}

function StatusCard({ status, isLoading, onRefresh }: {
  status?: MedplumStatus;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Card data-testid="card-medplum-status">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Medplum FHIR Server</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            data-testid="button-refresh-status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {status.connected ? (
                <Badge variant="default" className="gap-1" data-testid="badge-connected">
                  <Wifi className="h-3 w-3" /> Connected
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1" data-testid="badge-disconnected">
                  <WifiOff className="h-3 w-3" /> Disconnected
                </Badge>
              )}
              {status.authenticated ? (
                <Badge variant="outline" className="gap-1" data-testid="badge-authenticated">
                  <Shield className="h-3 w-3" /> Authenticated
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1" data-testid="badge-unauthenticated">
                  Unauthenticated
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Base URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded" data-testid="text-base-url">{status.baseUrl}</code></p>
              <p>Last checked: {new Date(status.lastCheckedAt).toLocaleString()}</p>
            </div>
            {status.error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{status.error}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to fetch server status</p>
        )}
      </CardContent>
    </Card>
  );
}

function ResourceBrowser() {
  const [resourceType, setResourceType] = useState("Patient");
  const [searchTerm, setSearchTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const pageSize = 20;

  const buildQueryParams = () => {
    const params: Record<string, string> = {
      _count: String(pageSize),
      _offset: String(offset),
    };
    if (searchTerm.trim()) {
      if (resourceType === "Patient") {
        params["name"] = searchTerm;
      } else {
        params["_content"] = searchTerm;
      }
    }
    return params;
  };

  const queryParams = buildQueryParams();
  const queryString = new URLSearchParams(queryParams).toString();

  const { data: bundle, isLoading, isFetching } = useQuery<FHIRBundle>({
    queryKey: ["/api/medplum", resourceType, queryString],
    queryFn: async () => {
      const res = await fetch(`/api/medplum/${resourceType}?${queryString}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const entries = bundle?.entry || [];
  const total = bundle?.total ?? entries.length;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const ResourceIcon = RESOURCE_TYPES.find(r => r.value === resourceType)?.icon || Database;

  const handleSearch = () => {
    setOffset(0);
    queryClient.invalidateQueries({ queryKey: ["/api/medplum", resourceType] });
  };

  return (
    <div className="space-y-4">
      <Card data-testid="card-resource-browser">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">FHIR Resource Browser</CardTitle>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={resourceType}
                onValueChange={(val) => { setResourceType(val); setOffset(0); setSearchTerm(""); }}
              >
                <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-resource-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCE_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      <div className="flex items-center gap-2">
                        <rt.icon className="h-4 w-4" />
                        {rt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={resourceType === "Patient" ? "Search by name..." : "Search resources..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
                data-testid="input-resource-search"
              />
            </div>
            <Button onClick={handleSearch} disabled={isFetching} data-testid="button-search">
              {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="text-no-results">
              <ResourceIcon className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-medium">No {RESOURCE_TYPES.find(r => r.value === resourceType)?.label || "resources"} found</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {searchTerm ? "Try a different search term" : "This resource type has no entries yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="hidden sm:table-cell">ID</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry, idx) => {
                      const resource = entry.resource;
                      return (
                        <TableRow
                          key={resource.id || idx}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedResource(resource)}
                          data-testid={`row-resource-${resource.id || idx}`}
                        >
                          <TableCell>
                            <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {getResourceSummary(resource)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted-foreground font-mono max-w-[120px] truncate">
                            {resource.id || "—"}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                            {getResourceDate(resource)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {resource.status && (
                              <Badge variant={
                                resource.status === "active" || resource.status === "final" || resource.status === "completed"
                                  ? "default"
                                  : resource.status === "draft" || resource.status === "preliminary"
                                    ? "secondary"
                                    : resource.status === "cancelled" || resource.status === "entered-in-error"
                                      ? "destructive"
                                      : "outline"
                              } className="text-xs">
                                {resource.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" data-testid={`button-view-${resource.id || idx}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground" data-testid="text-result-count">
                  {total} result{total !== 1 ? "s" : ""} found
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - pageSize))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset + pageSize >= total}
                    onClick={() => setOffset(offset + pageSize)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedResource} onOpenChange={(open) => !open && setSelectedResource(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ResourceIcon className="h-5 w-5" />
              {selectedResource?.resourceType} {selectedResource?.id ? `/ ${selectedResource.id}` : ""}
            </DialogTitle>
            <DialogDescription>
              {selectedResource && getResourceSummary(selectedResource)}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2" data-testid="resource-detail-json">
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-words font-mono leading-relaxed">
              {selectedResource && JSON.stringify(selectedResource, null, 2)}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PatientSearch() {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const params = new URLSearchParams();
      if (name.trim()) params.set("name", name.trim());
      if (identifier.trim()) params.set("identifier", identifier.trim());
      params.set("_count", "25");
      const res = await fetch(`/api/medplum/Patient?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data: FHIRBundle) => {
      setResults(data.entry?.map(e => e.resource) || []);
    },
  });

  const everythingQuery = useQuery<FHIRBundle>({
    queryKey: ["/api/medplum", "Patient", selectedPatient?.id, "$everything"],
    queryFn: async () => {
      const res = await fetch(`/api/medplum/Patient/${selectedPatient.id}/$everything`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedPatient?.id,
  });

  const everythingEntries = everythingQuery.data?.entry || [];
  const resourceTypeCounts = everythingEntries.reduce((acc, entry) => {
    const type = entry.resource?.resourceType || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      <Card data-testid="card-patient-search">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Patient Lookup</CardTitle>
          </div>
          <CardDescription>Search for patients by name or identifier on your Medplum FHIR server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="patient-name">Patient Name</Label>
              <Input
                id="patient-name"
                placeholder="e.g. John Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate()}
                data-testid="input-patient-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patient-id">Identifier / MRN</Label>
              <Input
                id="patient-id"
                placeholder="e.g. MRN-12345"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMutation.mutate()}
                data-testid="input-patient-identifier"
              />
            </div>
          </div>
          <Button
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending || (!name.trim() && !identifier.trim())}
            className="w-full sm:w-auto"
            data-testid="button-patient-search"
          >
            {searchMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Search Patients
          </Button>
        </CardContent>
      </Card>

      {results !== null && (
        <Card data-testid="card-patient-results">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{results.length} Patient{results.length !== 1 ? "s" : ""} Found</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-no-patients">
                <User className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No patients match your search criteria</p>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((patient, idx) => (
                  <div
                    key={patient.id || idx}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedPatient?.id === patient.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedPatient(patient)}
                    data-testid={`card-patient-${patient.id || idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{getPatientName(patient)}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {patient.birthDate && <span>DOB: {patient.birthDate}</span>}
                          {patient.gender && <span className="capitalize">{patient.gender}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded hidden sm:inline">{patient.id}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-select-patient-${patient.id || idx}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedPatient && (
        <Card data-testid="card-patient-everything">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {getPatientName(selectedPatient)}
                </CardTitle>
                <CardDescription>
                  Complete record ($everything) — {everythingEntries.length} resources
                </CardDescription>
              </div>
              {everythingQuery.isFetching && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent>
            {everythingQuery.isLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2" data-testid="badges-resource-types">
                  {Object.entries(resourceTypeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Badge key={type} variant="outline" className="gap-1">
                        {type} <span className="font-mono text-xs bg-muted px-1 rounded">{count}</span>
                      </Badge>
                    ))}
                </div>

                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resource Type</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="hidden sm:table-cell">Date</TableHead>
                        <TableHead className="hidden md:table-cell">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {everythingEntries.slice(0, 50).map((entry, idx) => {
                        const r = entry.resource;
                        return (
                          <TableRow key={r.id || idx} data-testid={`row-everything-${r.id || idx}`}>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{r.resourceType}</Badge>
                            </TableCell>
                            <TableCell className="font-medium max-w-[250px] truncate">{getResourceSummary(r)}</TableCell>
                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{getResourceDate(r)}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {r.status && (
                                <Badge variant="outline" className="text-xs">{r.status}</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {everythingEntries.length > 50 && (
                  <p className="text-sm text-muted-foreground text-center">
                    Showing 50 of {everythingEntries.length} resources
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function MedplumFHIRPage() {
  useSEO({
    title: "Medplum FHIR Server",
    description: "Browse and search FHIR resources on your Medplum server. View patients, observations, conditions, medications, and more.",
    canonicalPath: "/medplum",
    structuredData: buildPageSchemas({
      pageName: "Medplum FHIR Server Browser",
      pageDescription: "Browse and search FHIR resources on your self-hosted Medplum server.",
      pagePath: "/medplum",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Connections", path: "/connections" },
        { name: "Medplum FHIR", path: "/medplum" },
      ],
    }),
  });

  const statusQuery = useQuery<MedplumStatus>({
    queryKey: ["/api/medplum/status"],
    refetchInterval: 60000,
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Medplum FHIR Server</h1>
        <p className="text-muted-foreground mt-1">
          Browse and manage FHIR resources on your self-hosted Medplum server
        </p>
      </div>

      <StatusCard
        status={statusQuery.data}
        isLoading={statusQuery.isLoading}
        onRefresh={() => statusQuery.refetch()}
      />

      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="browse" className="gap-1.5" data-testid="tab-browse">
            <Database className="h-4 w-4" /> Browse
          </TabsTrigger>
          <TabsTrigger value="patients" className="gap-1.5" data-testid="tab-patients">
            <User className="h-4 w-4" /> Patient Lookup
          </TabsTrigger>
        </TabsList>
        <TabsContent value="browse" className="mt-4">
          <ResourceBrowser />
        </TabsContent>
        <TabsContent value="patients" className="mt-4">
          <PatientSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
