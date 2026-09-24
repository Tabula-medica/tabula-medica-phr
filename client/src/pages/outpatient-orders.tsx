import { useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FlaskConical,
  ScanLine,
  UserPlus,
  Pill,
  Accessibility,
  Plus,
  Send,
  PenLine,
  Ban,
  Clock,
  Info,
  ArrowLeft,
} from "lucide-react";

type OrderType = "lab" | "imaging" | "referral" | "medication" | "dme";
type OrderStatus = "draft" | "signed" | "transmitted" | "acknowledged" | "in_progress" | "resulted" | "completed" | "cancelled";
type Priority = "routine" | "urgent" | "stat";

interface OutpatientOrder {
  id: string;
  orderType: OrderType;
  status: OrderStatus;
  priority: Priority;
  description: string;
  details: Record<string, unknown>;
  diagnosisCodes: string[];
  clinicalNotes: string | null;
  recipientName: string | null;
  transmissionMethod: string;
  orderedByName: string | null;
  signedAt: string | null;
  transmittedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
}

interface OrderEvent {
  id: string;
  eventType: string;
  eventDetail: string | null;
  actorName: string | null;
  createdAt: string;
}

const ORDER_TYPES: { value: OrderType; label: string; icon: typeof FlaskConical }[] = [
  { value: "lab", label: "Lab", icon: FlaskConical },
  { value: "imaging", label: "Imaging", icon: ScanLine },
  { value: "referral", label: "Referral", icon: UserPlus },
  { value: "medication", label: "Medication", icon: Pill },
  { value: "dme", label: "DME", icon: Accessibility },
];

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  signed: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  transmitted: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  acknowledged: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  resulted: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  stat: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function emptyDetailsFor(type: OrderType): Record<string, string> {
  switch (type) {
    case "lab":
      return { panel: "", specimenType: "", fasting: "" };
    case "imaging":
      return { modality: "", bodyPart: "", contrast: "" };
    case "referral":
      return { specialty: "", reason: "" };
    case "medication":
      return { drugName: "", dose: "", route: "", frequency: "", quantity: "", refills: "0", pharmacy: "" };
    case "dme":
      return { equipment: "", hcpcsCode: "", quantity: "1", duration: "" };
  }
}

export default function OutpatientOrders() {
  const { patientId } = useParams<{ patientId: string }>();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeType, setActiveType] = useState<OrderType>("lab");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("routine");
  const [diagnosisCodes, setDiagnosisCodes] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [details, setDetails] = useState<Record<string, string>>(emptyDetailsFor("lab"));
  const [selectedOrder, setSelectedOrder] = useState<OutpatientOrder | null>(null);
  const [transmitMethod, setTransmitMethod] = useState("electronic_portal");
  const [transmitRecipient, setTransmitRecipient] = useState("");

  const { data: patient } = useQuery<{ id: string; fullName: string; dob: string }>({
    queryKey: ["/api/clinician/patients", patientId],
    queryFn: async () => (await apiRequest("GET", `/api/clinician/patients/${patientId}`)).json(),
    enabled: !!patientId,
  });

  const { data, isLoading } = useQuery<{ orders: OutpatientOrder[] }>({
    queryKey: ["/api/outpatient-orders", patientId],
    queryFn: async () => (await apiRequest("GET", `/api/outpatient-orders/${patientId}`)).json(),
    enabled: !!patientId,
  });

  const { data: eventsData } = useQuery<{ events: OrderEvent[] }>({
    queryKey: ["/api/outpatient-orders", patientId, selectedOrder?.id, "events"],
    queryFn: async () => (await apiRequest("GET", `/api/outpatient-orders/${patientId}/${selectedOrder!.id}/events`)).json(),
    enabled: !!selectedOrder,
  });

  const orders = data?.orders ?? [];
  const grouped = useMemo(() => {
    const active = orders.filter((o) => !["completed", "cancelled"].includes(o.status));
    const closed = orders.filter((o) => ["completed", "cancelled"].includes(o.status));
    return { active, closed };
  }, [orders]);

  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ["/api/outpatient-orders", patientId] });

  const createOrder = useMutation({
    mutationFn: async () => {
      const cleanedDetails = Object.fromEntries(Object.entries(details).filter(([, v]) => v.trim().length > 0));
      const res = await apiRequest("POST", `/api/outpatient-orders/${patientId}`, {
        orderType: activeType,
        priority,
        description,
        details: cleanedDetails,
        diagnosisCodes: diagnosisCodes.split(",").map((c) => c.trim()).filter(Boolean),
        clinicalNotes: clinicalNotes || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Order created", description: "Saved as a draft — sign it to move it forward." });
      setDialogOpen(false);
      setDescription("");
      setClinicalNotes("");
      setDiagnosisCodes("");
      setDetails(emptyDetailsFor(activeType));
      invalidateOrders();
    },
    onError: (e: any) => toast({ title: "Could not create order", description: String(e?.message || e), variant: "destructive" }),
  });

  const doAction = useMutation({
    mutationFn: async ({ orderId, body }: { orderId: string; body: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/outpatient-orders/${patientId}/${orderId}`, body);
      return res.json();
    },
    onSuccess: (result) => {
      invalidateOrders();
      queryClient.invalidateQueries({ queryKey: ["/api/outpatient-orders", patientId, result.order?.id, "events"] });
      toast({ title: "Order updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: String(e?.message || e), variant: "destructive" }),
  });

  if (!patientId) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>No patient selected</AlertTitle>
          <AlertDescription>Open this page from a patient's chart.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={`/patients/${patientId}`}>
          <Button variant="ghost" size="icon" aria-label="Back to patient chart"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {patient ? `${patient.fullName} — DOB ${patient.dob}` : "Loading patient…"}
          </p>
        </div>
        <div className="ml-auto">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-order"><Plus className="h-4 w-4 mr-2" />New order</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New order</DialogTitle>
                <DialogDescription>
                  Saved as a draft first — sign it, then transmit it once it's ready to go out.
                </DialogDescription>
              </DialogHeader>

              <Tabs
                value={activeType}
                onValueChange={(v) => {
                  setActiveType(v as OrderType);
                  setDetails(emptyDetailsFor(v as OrderType));
                }}
              >
                <TabsList className="grid grid-cols-5 w-full">
                  {ORDER_TYPES.map(({ value, label, icon: Icon }) => (
                    <TabsTrigger key={value} value={value} data-testid={`tab-order-type-${value}`}>
                      <Icon className="h-4 w-4 mr-1 hidden sm:inline" />
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {ORDER_TYPES.map(({ value }) => (
                  <TabsContent key={value} value={value} className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="order-description">Order</Label>
                      <Input
                        id="order-description"
                        placeholder={
                          value === "lab" ? "e.g. CBC with differential"
                          : value === "imaging" ? "e.g. MRI brain without contrast"
                          : value === "referral" ? "e.g. Cardiology consult"
                          : value === "medication" ? "e.g. Amoxicillin 500mg PO TID x10 days"
                          : "e.g. Standard manual wheelchair"
                        }
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        data-testid="input-order-description"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {Object.keys(emptyDetailsFor(value)).map((field) => (
                        <div className="space-y-1" key={field}>
                          <Label htmlFor={`detail-${field}`} className="text-xs capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                          <Input
                            id={`detail-${field}`}
                            value={details[field] ?? ""}
                            onChange={(e) => setDetails((d) => ({ ...d, [field]: e.target.value }))}
                            data-testid={`input-detail-${field}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="order-priority" className="text-xs">Priority</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                          <SelectTrigger id="order-priority" data-testid="select-priority"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="routine">Routine</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="stat">STAT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="order-diagnosis-codes" className="text-xs">Diagnosis code(s), comma-separated</Label>
                        <Input id="order-diagnosis-codes" value={diagnosisCodes} onChange={(e) => setDiagnosisCodes(e.target.value)} placeholder="e.g. J06.9" data-testid="input-diagnosis-codes" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="order-clinical-notes" className="text-xs">Clinical notes (optional)</Label>
                      <Textarea id="order-clinical-notes" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} rows={2} data-testid="textarea-clinical-notes" />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  disabled={!description.trim() || createOrder.isPending}
                  onClick={() => createOrder.mutate()}
                  data-testid="button-save-order"
                >
                  Save as draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>What "transmitted" means here</AlertTitle>
        <AlertDescription>
          Marking an order transmitted records and timestamps the hand-off — it does not submit to a live lab
          interface, e-prescribing network, or DME supplier system. Until that's built, get transmitted orders to
          their recipient the same way you would today (fax, portal, phone).
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <>
          <OrderTable title="Active" orders={grouped.active} onSelect={setSelectedOrder} onAction={doAction.mutate} />
          {grouped.closed.length > 0 && (
            <OrderTable title="Completed / cancelled" orders={grouped.closed} onSelect={setSelectedOrder} onAction={doAction.mutate} muted />
          )}
        </>
      )}

      <Sheet open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedOrder.description}</SheetTitle>
                <SheetDescription>
                  {ORDER_TYPES.find((t) => t.value === selectedOrder.orderType)?.label} order
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 mt-4">
                <div className="flex gap-2">
                  <Badge className={STATUS_STYLES[selectedOrder.status]}>{selectedOrder.status.replace("_", " ")}</Badge>
                  <Badge className={PRIORITY_STYLES[selectedOrder.priority]}>{selectedOrder.priority}</Badge>
                </div>

                {selectedOrder.diagnosisCodes.length > 0 && (
                  <p className="text-sm"><span className="text-muted-foreground">Dx: </span>{selectedOrder.diagnosisCodes.join(", ")}</p>
                )}
                {selectedOrder.clinicalNotes && <p className="text-sm whitespace-pre-wrap">{selectedOrder.clinicalNotes}</p>}
                {selectedOrder.recipientName && (
                  <p className="text-sm"><span className="text-muted-foreground">Recipient: </span>{selectedOrder.recipientName}</p>
                )}
                {selectedOrder.cancelReason && (
                  <p className="text-sm text-destructive"><span className="text-muted-foreground">Cancelled: </span>{selectedOrder.cancelReason}</p>
                )}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => doAction.mutate({ orderId: selectedOrder.id, body: { action: "sign" } })}
                      data-testid="button-sign-order"
                    >
                      <PenLine className="h-4 w-4 mr-1" />Sign
                    </Button>
                  )}
                  {(selectedOrder.status === "signed" || selectedOrder.status === "draft") && (
                    <div className="flex flex-wrap items-end gap-2 border rounded-md p-3 w-full">
                      <div className="space-y-1 flex-1 min-w-[140px]">
                        <Label htmlFor="transmit-method" className="text-xs">Transmit via</Label>
                        <Select value={transmitMethod} onValueChange={setTransmitMethod}>
                          <SelectTrigger id="transmit-method" data-testid="select-transmit-method"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="electronic_portal">Electronic portal</SelectItem>
                            <SelectItem value="fax">Fax</SelectItem>
                            <SelectItem value="secure_message">Secure message</SelectItem>
                            <SelectItem value="print">Print</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1 flex-1 min-w-[140px]">
                        <Label htmlFor="transmit-recipient" className="text-xs">Recipient</Label>
                        <Input id="transmit-recipient" value={transmitRecipient} onChange={(e) => setTransmitRecipient(e.target.value)} placeholder="Facility / pharmacy / specialist" data-testid="input-transmit-recipient" />
                      </div>
                      <Button
                        size="sm"
                        onClick={() =>
                          doAction.mutate({
                            orderId: selectedOrder.id,
                            body: { action: "transmit", transmissionMethod: transmitMethod, recipientName: transmitRecipient || null },
                          })
                        }
                        data-testid="button-transmit-order"
                      >
                        <Send className="h-4 w-4 mr-1" />Transmit
                      </Button>
                    </div>
                  )}
                  {!["completed", "cancelled"].includes(selectedOrder.status) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const reason = window.prompt("Reason for cancelling this order:");
                        if (reason) doAction.mutate({ orderId: selectedOrder.id, body: { action: "cancel", cancelReason: reason } });
                      }}
                      data-testid="button-cancel-order"
                    >
                      <Ban className="h-4 w-4 mr-1" />Cancel
                    </Button>
                  )}
                </div>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-1"><Clock className="h-4 w-4" />Activity</h3>
                  <div className="space-y-2">
                    {(eventsData?.events ?? []).map((event) => (
                      <div key={event.id} className="text-sm border-l-2 pl-3 py-0.5">
                        <p className="font-medium capitalize">{event.eventType.replace("_", " ")}</p>
                        {event.eventDetail && <p className="text-muted-foreground">{event.eventDetail}</p>}
                        <p className="text-xs text-muted-foreground">
                          {new Date(event.createdAt).toLocaleString()}{event.actorName ? ` · ${event.actorName}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function OrderTable({
  title,
  orders,
  onSelect,
  onAction,
  muted,
}: {
  title: string;
  orders: OutpatientOrder[];
  onSelect: (o: OutpatientOrder) => void;
  onAction: (args: { orderId: string; body: Record<string, unknown> }) => void;
  muted?: boolean;
}) {
  if (orders.length === 0 && !muted) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">No orders yet.</CardContent>
      </Card>
    );
  }
  if (orders.length === 0) return null;

  return (
    <Card className={muted ? "opacity-80" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{orders.length} order{orders.length === 1 ? "" : "s"}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {orders.map((order) => {
            const Icon = ORDER_TYPES.find((t) => t.value === order.orderType)?.icon ?? FlaskConical;
            return (
              <button
                key={order.id}
                onClick={() => onSelect(order)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                data-testid={`row-order-${order.id}`}
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{order.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                    {order.orderedByName ? ` · ${order.orderedByName}` : ""}
                  </p>
                </div>
                <Badge className={PRIORITY_STYLES[order.priority]} variant="outline">{order.priority}</Badge>
                <Badge className={STATUS_STYLES[order.status]}>{order.status.replace("_", " ")}</Badge>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
