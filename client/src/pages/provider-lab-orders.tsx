import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  TestTube,
  Search,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  FlaskConical,
  Building2,
  FileText,
  Activity,
  Zap,
  Timer,
  ClipboardList,
  RefreshCw,
  Info,
} from "lucide-react";

interface LabProvider {
  id: string;
  name: string;
  integrationPartner: string;
  status: "connected" | "disconnected" | "maintenance";
  supportedTestCategories: string[];
}

interface LabTest {
  id: string;
  name: string;
  loincCode: string;
  category: string;
  description: string;
  specimenType: string;
  turnaroundTime: string;
  providers: string[];
  cptCode?: string;
}

interface SelectedTest {
  testId: string;
  testName: string;
  loincCode: string;
  priority: "routine" | "urgent" | "stat";
  cptCode?: string;
}

interface LabOrder {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  tests: { testId: string; testName: string; loincCode: string; priority: string }[];
  status: string;
  orderingPhysician: string;
  clinicalNotes?: string;
  icdCodes?: string[];
  submittedAt: string;
  updatedAt: string;
  estimatedCompletionAt?: string;
  integrationPartner: string;
  externalOrderId?: string;
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "completed": return "default";
    case "in-progress": case "submitted": return "secondary";
    case "cancelled": return "destructive";
    default: return "outline";
  }
}

function getPriorityIcon(priority: string) {
  switch (priority) {
    case "stat": return <Zap className="h-3 w-3" />;
    case "urgent": return <AlertTriangle className="h-3 w-3" />;
    default: return <Clock className="h-3 w-3" />;
  }
}

function getPriorityVariant(priority: string): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "stat": return "destructive";
    case "urgent": return "secondary";
    default: return "outline";
  }
}

export default function ProviderLabOrders() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("new-order");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [patientId, setPatientId] = useState("patient-001");
  const [orderingPhysician, setOrderingPhysician] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [icdCodes, setIcdCodes] = useState("");
  const [orderStatusId, setOrderStatusId] = useState("");

  const providersQuery = useQuery<{ providers: LabProvider[] }>({
    queryKey: ["/api/lab-diagnostics/providers"],
  });

  const testSearchQuery = useQuery<{ tests: LabTest[]; totalCount: number }>({
    queryKey: ["/api/lab-diagnostics/tests/search", searchQuery, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery || "blood" });
      if (selectedProvider) params.set("provider", selectedProvider);
      const res = await fetch(`/api/lab-diagnostics/tests/search?${params}`);
      if (!res.ok) throw new Error("Failed to search tests");
      return res.json();
    },
    enabled: true,
  });

  const dashboardQuery = useQuery<{
    totalOrders: number;
    pendingOrders: number;
    completedOrders: number;
    totalResults: number;
    recentOrders: LabOrder[];
    providerStatus: { providerId: string; name: string; status: string; lastSync: string }[];
  }>({
    queryKey: ["/api/lab-diagnostics/dashboard"],
  });

  const orderStatusQuery = useQuery<{ order: LabOrder }>({
    queryKey: ["/api/lab-diagnostics/orders", orderStatusId, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/lab-diagnostics/orders/${orderStatusId}/status`);
      if (!res.ok) throw new Error("Order not found");
      return res.json();
    },
    enabled: !!orderStatusId,
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (orderData: {
      patientId: string;
      providerId: string;
      tests: { testId: string; priority: string }[];
      orderingPhysician: string;
      clinicalNotes?: string;
      icdCodes?: string[];
    }) => {
      const res = await apiRequest("POST", "/api/lab-diagnostics/orders", orderData);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Lab Order Submitted",
        description: `Order ${data.order.id} sent to ${data.order.providerName} via ${data.order.integrationPartner}`,
      });
      setSelectedTests([]);
      setClinicalNotes("");
      setIcdCodes("");
      queryClient.invalidateQueries({ queryKey: ["/api/lab-diagnostics/dashboard"] });
      setActiveTab("order-history");
    },
    onError: (error: Error) => {
      toast({
        title: "Order Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addTest = (test: LabTest) => {
    if (selectedTests.find((t) => t.testId === test.id)) return;
    setSelectedTests([
      ...selectedTests,
      {
        testId: test.id,
        testName: test.name,
        loincCode: test.loincCode,
        priority: "routine",
        cptCode: test.cptCode,
      },
    ]);
  };

  const removeTest = (testId: string) => {
    setSelectedTests(selectedTests.filter((t) => t.testId !== testId));
  };

  const updateTestPriority = (testId: string, priority: "routine" | "urgent" | "stat") => {
    setSelectedTests(selectedTests.map((t) => (t.testId === testId ? { ...t, priority } : t)));
  };

  const handleSubmitOrder = () => {
    if (!selectedProvider) {
      toast({ title: "Select a lab provider", variant: "destructive" });
      return;
    }
    if (selectedTests.length === 0) {
      toast({ title: "Select at least one test", variant: "destructive" });
      return;
    }
    if (!orderingPhysician.trim()) {
      toast({ title: "Enter ordering physician name", variant: "destructive" });
      return;
    }

    submitOrderMutation.mutate({
      patientId,
      providerId: selectedProvider,
      tests: selectedTests.map((t) => ({ testId: t.testId, priority: t.priority })),
      orderingPhysician: orderingPhysician.trim(),
      clinicalNotes: clinicalNotes.trim() || undefined,
      icdCodes: icdCodes.trim() ? icdCodes.split(",").map((c) => c.trim()) : undefined,
    });
  };

  const connectedProviders = providersQuery.data?.providers?.filter((p) => p.status === "connected") || [];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="provider-lab-orders-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <FlaskConical className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Lab Orders</h1>
          <Badge variant="secondary">
            <Building2 className="h-3 w-3 mr-1" />
            Quest & LabCorp
          </Badge>
          <Badge variant="outline">
            <Info className="h-3 w-3 mr-1" />
            NO-CDS
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Order lab tests electronically from Quest Diagnostics and LabCorp. Track orders and receive results directly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-orders">
              {dashboardQuery.isLoading ? <Skeleton className="h-8 w-12" /> : dashboardQuery.data?.totalOrders ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-orders">
              {dashboardQuery.isLoading ? <Skeleton className="h-8 w-12" /> : dashboardQuery.data?.pendingOrders ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed-orders">
              {dashboardQuery.isLoading ? <Skeleton className="h-8 w-12" /> : dashboardQuery.data?.completedOrders ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Results Available</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-results">
              {dashboardQuery.isLoading ? <Skeleton className="h-8 w-12" /> : dashboardQuery.data?.totalResults ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new-order" data-testid="tab-new-order">
            <Plus className="h-4 w-4 mr-1" />
            New Order
          </TabsTrigger>
          <TabsTrigger value="order-history" data-testid="tab-order-history">
            <ClipboardList className="h-4 w-4 mr-1" />
            Order History
          </TabsTrigger>
          <TabsTrigger value="track-order" data-testid="tab-track-order">
            <RefreshCw className="h-4 w-4 mr-1" />
            Track Order
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new-order" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TestTube className="h-5 w-5" />
                    Test Catalog
                  </CardTitle>
                  <CardDescription>Search and select laboratory tests to order</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search tests by name, LOINC code, or category..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                          data-testid="input-test-search"
                        />
                      </div>
                    </div>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger className="w-[200px]" data-testid="select-provider">
                        <SelectValue placeholder="All Providers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Providers</SelectItem>
                        {connectedProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <ScrollArea className="h-[300px]">
                    {testSearchQuery.isLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-16 w-full" />
                        ))}
                      </div>
                    ) : testSearchQuery.data?.tests?.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mb-2" />
                        <p>No tests found. Try a different search term.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {testSearchQuery.data?.tests?.map((test) => {
                          const isSelected = selectedTests.some((t) => t.testId === test.id);
                          return (
                            <div
                              key={test.id}
                              className={`flex items-center justify-between gap-2 p-3 rounded-md border ${
                                isSelected ? "border-primary bg-primary/5" : "hover-elevate"
                              }`}
                              data-testid={`test-item-${test.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm">{test.name}</span>
                                  <Badge variant="outline" className="text-xs">{test.loincCode}</Badge>
                                  {test.cptCode && (
                                    <Badge variant="outline" className="text-xs">CPT: {test.cptCode}</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">{test.description}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <TestTube className="h-3 w-3" />
                                    {test.specimenType}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    {test.turnaroundTime}
                                  </span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={isSelected ? "secondary" : "default"}
                                onClick={() => (isSelected ? removeTest(test.id) : addTest(test))}
                                data-testid={`button-add-test-${test.id}`}
                              >
                                {isSelected ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Order Details
                  </CardTitle>
                  <CardDescription>Clinical information for the lab order</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="patientId">Patient ID</Label>
                      <Input
                        id="patientId"
                        value={patientId}
                        onChange={(e) => setPatientId(e.target.value)}
                        placeholder="patient-001"
                        data-testid="input-patient-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="physician">Ordering Physician</Label>
                      <Input
                        id="physician"
                        value={orderingPhysician}
                        onChange={(e) => setOrderingPhysician(e.target.value)}
                        placeholder="Dr. Sarah Chen"
                        data-testid="input-ordering-physician"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="icdCodes">ICD-10 Diagnosis Codes (comma-separated)</Label>
                    <Input
                      id="icdCodes"
                      value={icdCodes}
                      onChange={(e) => setIcdCodes(e.target.value)}
                      placeholder="E11.65, Z00.00, E78.5"
                      data-testid="input-icd-codes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicalNotes">Clinical Notes</Label>
                    <Textarea
                      id="clinicalNotes"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Reason for ordering, relevant clinical history..."
                      className="resize-none"
                      rows={3}
                      data-testid="input-clinical-notes"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                  <CardDescription>
                    {selectedTests.length} test{selectedTests.length !== 1 ? "s" : ""} selected
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedTests.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <TestTube className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No tests selected yet.</p>
                      <p className="text-xs mt-1">Search and add tests from the catalog.</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-3">
                        {selectedTests.map((test) => (
                          <div key={test.testId} className="border rounded-md p-3 space-y-2" data-testid={`selected-test-${test.testId}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{test.testName}</p>
                                <p className="text-xs text-muted-foreground">LOINC: {test.loincCode}</p>
                              </div>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removeTest(test.testId)}
                                data-testid={`button-remove-test-${test.testId}`}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Priority</Label>
                              <Select
                                value={test.priority}
                                onValueChange={(v) => updateTestPriority(test.testId, v as "routine" | "urgent" | "stat")}
                              >
                                <SelectTrigger className="h-8" data-testid={`select-priority-${test.testId}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="routine">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" /> Routine
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="urgent">
                                    <span className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> Urgent
                                    </span>
                                  </SelectItem>
                                  <SelectItem value="stat">
                                    <span className="flex items-center gap-1">
                                      <Zap className="h-3 w-3" /> STAT
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-sm">Lab Provider</Label>
                    <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                      <SelectTrigger data-testid="select-order-provider">
                        <SelectValue placeholder="Select lab provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <Building2 className="h-3 w-3" />
                              {p.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedProvider && (
                      <p className="text-xs text-muted-foreground">
                        Via {connectedProviders.find((p) => p.id === selectedProvider)?.integrationPartner}
                      </p>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleSubmitOrder}
                    disabled={selectedTests.length === 0 || !selectedProvider || !orderingPhysician.trim() || submitOrderMutation.isPending}
                    data-testid="button-submit-order"
                  >
                    {submitOrderMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Order Electronically
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Orders are sent electronically via FHIR R4 integration.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-muted-foreground" data-testid="text-no-cds-disclaimer">
                      Lab results are informational only. This system does NOT provide clinical decision support.
                      All results must be interpreted by a qualified healthcare provider.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="order-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Recent Orders
              </CardTitle>
              <CardDescription>Track submitted lab orders and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardQuery.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : dashboardQuery.data?.recentOrders?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No orders yet. Create your first lab order.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <div className="space-y-3">
                    {dashboardQuery.data?.recentOrders?.map((order) => (
                      <div key={order.id} className="border rounded-md p-4 space-y-2" data-testid={`order-card-${order.id}`}>
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{order.providerName}</span>
                              <Badge variant={getStatusVariant(order.status)} className="text-xs">
                                {order.status === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {order.status === "in-progress" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {order.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Order: {order.id} | Via {order.integrationPartner}
                            </p>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            <p>Submitted: {new Date(order.submittedAt).toLocaleDateString()}</p>
                            {order.estimatedCompletionAt && (
                              <p>Est. complete: {new Date(order.estimatedCompletionAt).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {order.tests.map((test) => (
                            <Badge key={test.testId} variant="outline" className="text-xs">
                              {getPriorityIcon(test.priority)}
                              <span className="ml-1">{test.testName}</span>
                            </Badge>
                          ))}
                        </div>
                        {order.clinicalNotes && (
                          <p className="text-xs text-muted-foreground">{order.clinicalNotes}</p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <span>Physician: {order.orderingPhysician}</span>
                          {order.icdCodes?.length ? (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>ICD: {order.icdCodes.join(", ")}</span>
                            </>
                          ) : null}
                          {order.externalOrderId && (
                            <>
                              <Separator orientation="vertical" className="h-3" />
                              <span>Ext: {order.externalOrderId}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="track-order" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Track Order Status
              </CardTitle>
              <CardDescription>Look up an order by its ID to check real-time status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={orderStatusId}
                  onChange={(e) => setOrderStatusId(e.target.value)}
                  placeholder="Enter order ID (e.g., order-sample-001)"
                  data-testid="input-order-tracking-id"
                />
                <Button
                  variant="secondary"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/lab-diagnostics/orders", orderStatusId, "status"] })}
                  disabled={!orderStatusId}
                  data-testid="button-track-order"
                >
                  <Search className="h-4 w-4 mr-1" />
                  Track
                </Button>
              </div>

              {orderStatusQuery.isLoading && orderStatusId && (
                <Skeleton className="h-32 w-full" />
              )}
              {orderStatusQuery.isError && orderStatusId && (
                <div className="text-center py-6 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
                  <p className="text-sm">Order not found. Check the order ID and try again.</p>
                </div>
              )}
              {orderStatusQuery.data?.order && (
                <div className="border rounded-md p-4 space-y-3" data-testid="order-tracking-result">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-medium">{orderStatusQuery.data.order.providerName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {orderStatusQuery.data.order.integrationPartner} | {orderStatusQuery.data.order.externalOrderId}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(orderStatusQuery.data.order.status)} className="text-sm">
                      {orderStatusQuery.data.order.status}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Patient:</span>{" "}
                      <span className="font-medium">{orderStatusQuery.data.order.patientId}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Physician:</span>{" "}
                      <span className="font-medium">{orderStatusQuery.data.order.orderingPhysician}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Submitted:</span>{" "}
                      <span>{new Date(orderStatusQuery.data.order.submittedAt).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Updated:</span>{" "}
                      <span>{new Date(orderStatusQuery.data.order.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Tests Ordered:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {orderStatusQuery.data.order.tests.map((test) => (
                        <Badge key={test.testId} variant={getPriorityVariant(test.priority)}>
                          {getPriorityIcon(test.priority)}
                          <span className="ml-1">{test.testName}</span>
                          <span className="ml-1 opacity-70">({test.loincCode})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
