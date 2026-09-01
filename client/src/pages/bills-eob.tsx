import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO } from "@/hooks/use-seo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Receipt,
  Camera,
  Upload,
  FileText,
  Loader2,
  Plus,
  Search,
  DollarSign,
  ShieldCheck,
  TrendingDown,
  CheckCircle,
  Info,
  Mail,
  ArrowRight,
  Building2,
  Stethoscope,
  Calculator,
  ExternalLink,
  Trash2,
  HelpCircle,
  CreditCard,
  Layers,
  Percent,
  ShieldAlert,
  CircleDollarSign,
  ClipboardList,
} from "lucide-react";
import { Link } from "wouter";

interface Bill {
  id: string;
  type: string;
  provider: string;
  amount: number;
  date: string;
  status: string;
  imageUrl: string;
  notes: string;
  createdAt: string;
}

interface PlanDetails {
  enrolled: boolean;
  planName: string;
  monthlyFee: number;
  description: string;
  enrollmentDate?: string;
}

interface MedicareRate {
  cptCode: string;
  description: string;
  category: string;
  medicareRate: number;
  typicalUninsuredRate: number;
  insuranceNegotiatedRate: number;
  savings: string;
}

interface ElectronicEOBStatus {
  enrolled: boolean;
  enrollmentDate?: string;
  beneficiaryId?: string;
}

const billTypeLabels: Record<string, string> = {
  "medical-bill": "Medical Bill",
  eob: "EOB",
  pharmacy: "Pharmacy",
  lab: "Lab",
  imaging: "Imaging",
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "pending-review": "outline",
  processed: "secondary",
  disputed: "destructive",
  paid: "default",
};

const statusLabels: Record<string, string> = {
  "pending-review": "Pending Review",
  processed: "Processed",
  disputed: "Disputed",
  paid: "Paid",
};

function AddBillDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("medical-bill");
  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/bills-eob/bills", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/bills"] });
      toast({ title: "Bill added", description: "Your bill has been uploaded successfully." });
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add bill.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setType("medical-bill");
    setProvider("");
    setAmount("");
    setDate("");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-bill">
          <Plus className="h-4 w-4 mr-2" />
          Add Bill / EOB
        </Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-add-bill">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Upload Bill or EOB
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="bills-eob-document-type">Document Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="bills-eob-document-type" data-testid="select-bill-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="medical-bill">Medical Bill</SelectItem>
                <SelectItem value="eob">EOB (Explanation of Benefits)</SelectItem>
                <SelectItem value="pharmacy">Pharmacy</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="imaging">Imaging</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-provider">Provider Name</Label>
            <Input id="bill-provider" placeholder="e.g., City General Hospital" value={provider} onChange={(e) => setProvider(e.target.value)} data-testid="input-bill-provider" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bill-amount">Amount ($)</Label>
              <Input id="bill-amount" type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} data-testid="input-bill-amount" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-date">Date</Label>
              <Input id="bill-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-bill-date" />
            </div>
          </div>
          <div className="border-2 border-dashed rounded-md p-6 text-center space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drag & drop or click to upload a photo of your bill</p>
            <Button variant="outline" size="sm" data-testid="button-upload-photo">
              <Camera className="h-4 w-4 mr-2" />
              Take Photo / Upload File
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-notes">Notes</Label>
            <Textarea id="bill-notes" placeholder="Additional notes about this bill..." value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-bill-notes" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-cancel-bill">Cancel</Button>
          </DialogClose>
          <Button
            onClick={() => addMutation.mutate({ type, provider, amount: parseFloat(amount) || 0, date, notes, status: "pending-review", imageUrl: "" })}
            disabled={!provider.trim() || !amount || addMutation.isPending}
            data-testid="button-save-bill"
          >
            {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillCard({ bill }: { bill: Bill }) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/bills-eob/bills/${bill.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/bills"] });
      toast({ title: "Bill deleted" });
    },
  });

  return (
    <Card data-testid={`card-bill-${bill.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
              <Receipt className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate" data-testid={`text-bill-provider-${bill.id}`}>{bill.provider}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs" data-testid={`badge-bill-type-${bill.id}`}>
                  {billTypeLabels[bill.type] || bill.type}
                </Badge>
                <Badge variant={statusVariants[bill.status] || "outline"} className="text-xs" data-testid={`badge-bill-status-${bill.id}`}>
                  {statusLabels[bill.status] || bill.status}
                </Badge>
              </div>
              {bill.notes && <p className="text-sm text-muted-foreground mt-1 truncate">{bill.notes}</p>}
            </div>
          </div>
          <div className="text-right shrink-0 space-y-1">
            <p className="text-lg font-bold" data-testid={`text-bill-amount-${bill.id}`}>${bill.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            {bill.date && <p className="text-xs text-muted-foreground">{new Date(bill.date).toLocaleDateString()}</p>}
            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid={`button-delete-bill-${bill.id}`}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MyBillsTab() {
  const { data, isLoading } = useQuery<{ bills: Bill[] }>({
    queryKey: ["/api/bills-eob/bills"],
  });

  const bills = data?.bills || [];

  return (
    <div className="space-y-4" data-testid="tab-content-bills">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          My Bills & EOBs
          {bills.length > 0 && <Badge variant="secondary" className="text-xs">{bills.length}</Badge>}
        </h3>
        <AddBillDialog onSuccess={() => {}} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 space-y-3" data-testid="empty-bills">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
          <p className="text-muted-foreground">No bills or EOBs uploaded yet.</p>
          <p className="text-sm text-muted-foreground/70">Upload your first bill to get started tracking your medical expenses.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => (
            <BillCard key={bill.id} bill={bill} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoPaperlessTab() {
  const { toast } = useToast();
  const [beneficiaryId, setBeneficiaryId] = useState("");

  const { data: statusData, isLoading: statusLoading } = useQuery<ElectronicEOBStatus>({
    queryKey: ["/api/bills-eob/electronic-eob/status"],
  });

  const enrollMutation = useMutation({
    mutationFn: async (data: { beneficiaryId: string }) => {
      const res = await apiRequest("POST", "/api/bills-eob/electronic-eob/enroll", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/electronic-eob/status"] });
      toast({ title: "Enrolled", description: "You've signed up for electronic Medicare EOBs." });
      setBeneficiaryId("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to enroll.", variant: "destructive" });
    },
  });

  const isEnrolled = statusData?.enrolled;

  return (
    <div className="space-y-6" data-testid="tab-content-paperless">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Mail className="h-5 w-5 text-primary" />
            Go Paperless with Electronic EOBs
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Sign up to receive your Medicare Explanation of Benefits electronically instead of by mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingDown className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-sm">Save Paper</p>
                <p className="text-xs text-muted-foreground mt-1">Reduce waste and clutter</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <ArrowRight className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-sm">Instant Access</p>
                <p className="text-xs text-muted-foreground mt-1">View EOBs as soon as they're ready</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <Search className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="font-medium text-sm">Searchable</p>
                <p className="text-xs text-muted-foreground mt-1">Find past EOBs quickly</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <ShieldCheck className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium text-sm">Never Lose a Document</p>
                <p className="text-xs text-muted-foreground mt-1">Securely stored online</p>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : isEnrolled ? (
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-600" data-testid="text-eob-enrolled-status">You're enrolled in electronic EOBs</p>
                  <p className="text-sm text-muted-foreground">
                    Beneficiary ID: {statusData?.beneficiaryId} | Enrolled: {statusData?.enrollmentDate ? new Date(statusData.enrollmentDate).toLocaleDateString() : "N/A"}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Enroll Now</h3>
              <div className="space-y-2 max-w-md">
                <Label htmlFor="beneficiary-id">Medicare Beneficiary ID</Label>
                <Input
                  id="beneficiary-id"
                  placeholder="e.g., 1EG4-TE5-MK72"
                  value={beneficiaryId}
                  onChange={(e) => setBeneficiaryId(e.target.value)}
                  data-testid="input-beneficiary-id"
                />
              </div>
              <Button
                onClick={() => enrollMutation.mutate({ beneficiaryId })}
                disabled={!beneficiaryId.trim() || enrollMutation.isPending}
                data-testid="button-enroll-eob"
              >
                {enrollMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Sign Up for Electronic EOBs
              </Button>
            </div>
          )}

          <Separator />

          <div className="flex items-start gap-3">
            <ExternalLink className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Medicare.gov Electronic EOB Signup</p>
              <p className="text-xs text-muted-foreground mb-2">You can also sign up directly through the official Medicare website.</p>
              <Button variant="outline" size="sm" asChild data-testid="link-medicare-eob">
                <a href="https://www.medicare.gov/your-medicare-costs/manage-your-costs/set-up-electronic-medicare-summary-notice" target="_blank" rel="noopener noreferrer">
                  Visit Medicare.gov
                  <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UninsuredPlanTab() {
  const { toast } = useToast();

  const { data: planData, isLoading: planLoading } = useQuery<PlanDetails>({
    queryKey: ["/api/bills-eob/plan"],
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bills-eob/plan/enroll", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills-eob/plan"] });
      toast({ title: "Enrolled", description: "You've enrolled in the Tabula Medica Uninsured Plan." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to enroll.", variant: "destructive" });
    },
  });

  const isEnrolled = planData?.enrolled;

  const savingsExamples = [
    { procedure: "Office Visit (99213)", typical: 250, medicare: 92, savings: "63%" },
    { procedure: "Chest X-Ray (71046)", typical: 370, medicare: 26, savings: "93%" },
    { procedure: "Basic Metabolic Panel (80048)", typical: 235, medicare: 11, savings: "95%" },
    { procedure: "MRI Brain (70553)", typical: 3500, medicare: 450, savings: "87%" },
    { procedure: "Colonoscopy (45378)", typical: 4200, medicare: 450, savings: "89%" },
    { procedure: "Emergency Room Visit (99284)", typical: 2200, medicare: 350, savings: "84%" },
  ];

  return (
    <div className="space-y-6" data-testid="tab-content-plan">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Stethoscope className="h-5 w-5 text-primary" />
            Tabula Medica Uninsured Plan
          </CardTitle>
          <CardDescription className="max-w-2xl">
            $100/month plan fee. Pay Medicare rates for CPT codes at time of service. No middlemen, no actuaries, no adjusters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {planLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <span className="text-lg font-bold text-primary">1</span>
                    </div>
                    <p className="font-medium text-sm">Join the Plan</p>
                    <p className="text-xs text-muted-foreground mt-1">Pay $100/month flat fee</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <span className="text-lg font-bold text-primary">2</span>
                    </div>
                    <p className="font-medium text-sm">Look Up Your Procedure</p>
                    <p className="text-xs text-muted-foreground mt-1">Find the CPT code and Medicare rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mx-auto mb-2">
                      <span className="text-lg font-bold text-primary">3</span>
                    </div>
                    <p className="font-medium text-sm">Visit a Provider</p>
                    <p className="text-xs text-muted-foreground mt-1">Go to any participating provider</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 mx-auto mb-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <p className="font-medium text-sm">Pay Medicare Rate</p>
                    <p className="text-xs text-muted-foreground mt-1">At time of service, no surprise bills</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">Example Savings</h3>
                <div className="space-y-2">
                  {savingsExamples.map((example) => (
                    <Card key={example.procedure} data-testid={`card-savings-example-${example.procedure.split("(")[0].trim().toLowerCase().replace(/\s+/g, "-")}`}>
                      <CardContent className="flex items-center justify-between gap-4 py-4 flex-wrap">
                        <p className="font-medium text-sm">{example.procedure}</p>
                        <div className="flex items-center gap-4 flex-wrap flex-shrink-0">
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Typical Price</p>
                            <p className="text-sm line-through text-muted-foreground">${example.typical.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-green-600 font-medium">Medicare Rate</p>
                            <p className="text-lg font-bold text-green-600">${example.medicare.toLocaleString()}</p>
                          </div>
                          <Badge variant="secondary">{example.savings} off</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              {isEnrolled ? (
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-green-600" data-testid="text-plan-enrolled-status">You're enrolled in the Tabula Medica Uninsured Plan</p>
                      <p className="text-sm text-muted-foreground">
                        Enrolled: {planData?.enrollmentDate ? new Date(planData.enrollmentDate).toLocaleDateString() : "N/A"} | Monthly fee: $100/month
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-medium">Ready to start saving?</p>
                    <p className="text-sm text-muted-foreground">$100/month flat fee. Cancel anytime.</p>
                  </div>
                  <Button
                    onClick={() => enrollMutation.mutate()}
                    disabled={enrollMutation.isPending}
                    data-testid="button-enroll-plan"
                  >
                    {enrollMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Enroll Now - $100/month
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SavingsCalculatorTab() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: ratesData, isLoading } = useQuery<{ rates: MedicareRate[] }>({
    queryKey: ["/api/bills-eob/plan/rates", searchQuery],
    queryFn: async () => {
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : "";
      const res = await fetch(`/api/bills-eob/plan/rates${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const rates = ratesData?.rates || [];

  const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

  return (
    <div className="space-y-6" data-testid="tab-content-calculator">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Calculator className="h-5 w-5 text-primary" />
            Savings Calculator
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Enter a CPT code or procedure name to see what you'd pay under the Tabula Medica plan compared to typical prices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by CPT code or procedure name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-calculator-search"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rates.length === 0 ? (
            <div className="text-center py-12 space-y-3" data-testid="empty-calculator-results">
              <Calculator className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery ? `No results found for "${searchQuery}". Try a different search term.` : "Enter a CPT code or procedure name above to see pricing."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rates.map((rate) => (
                <Card key={rate.cptCode} data-testid={`card-calculator-rate-${rate.cptCode}`}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant="outline" className="font-mono flex-shrink-0" data-testid={`badge-calc-cpt-${rate.cptCode}`}>
                          {rate.cptCode}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-calc-description-${rate.cptCode}`}>{rate.description}</p>
                          <p className="text-xs text-muted-foreground">{rate.category}</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="text-center p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Typical Uninsured</p>
                        <p className="text-lg font-bold line-through text-muted-foreground" data-testid={`text-calc-typical-${rate.cptCode}`}>
                          {formatCurrency(rate.typicalUninsuredRate)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground mb-1">Insurance Negotiated</p>
                        <p className="text-lg font-bold text-muted-foreground" data-testid={`text-calc-insurance-${rate.cptCode}`}>
                          {formatCurrency(rate.insuranceNegotiatedRate)}
                        </p>
                      </div>
                      <div className="text-center p-3 rounded-md bg-green-50 dark:bg-green-950/20">
                        <p className="text-xs text-green-600 font-medium mb-1">Tabula Medica Rate</p>
                        <p className="text-lg font-bold text-green-600" data-testid={`text-calc-medicare-${rate.cptCode}`}>
                          {formatCurrency(rate.medicareRate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <Badge variant="secondary">{rate.savings} savings vs uninsured</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UnderstandingCostsTab() {
  const costConcepts = [
    {
      icon: CreditCard,
      term: "Copay (Copayment)",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      definition: "A fixed amount you pay at the time of service. For example, $25 for a doctor visit or $50 for a specialist.",
      example: "You visit your primary care doctor. Your copay is $25. You pay $25 at the front desk, and your insurance covers the rest of the visit cost.",
      tip: "Copays do NOT count toward your deductible, but they usually count toward your out-of-pocket maximum.",
    },
    {
      icon: Layers,
      term: "Deductible",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      definition: "The amount you must pay out of your own pocket before your insurance starts paying. Resets every plan year (usually January 1).",
      example: "Your deductible is $1,500. You have a lab test that costs $300. Since you haven't met your deductible yet, you pay the full $300. After paying $1,500 total in the year, insurance starts covering most costs.",
      tip: "Preventive care (annual checkups, screenings) is usually covered BEFORE you meet your deductible.",
    },
    {
      icon: Percent,
      term: "Coinsurance",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/30",
      definition: "After you meet your deductible, you and your insurance share costs. Your share is coinsurance — usually expressed as a percentage (e.g., 20%).",
      example: "After meeting your $1,500 deductible, you need an MRI that costs $2,000. With 20% coinsurance, you pay $400 and insurance pays $1,600.",
      tip: "Lower coinsurance = lower costs for you. PPO plans often have 80/20 splits (you pay 20%).",
    },
    {
      icon: ShieldAlert,
      term: "Out-of-Pocket Maximum",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/30",
      definition: "The absolute most you'll pay in a plan year. After reaching this limit, your insurance pays 100% of covered services.",
      example: "Your out-of-pocket max is $6,000. After paying $6,000 total (copays + deductible + coinsurance), your insurance covers everything else for the rest of the year.",
      tip: "This is your safety net. Even if you have a major surgery or hospital stay, once you hit this number, you're fully covered.",
    },
    {
      icon: CircleDollarSign,
      term: "Premium",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/30",
      definition: "The monthly amount you (or your employer) pay to have insurance coverage. This is separate from what you pay when you use services.",
      example: "Your premium is $350/month. You pay this whether or not you see a doctor. It's like a membership fee to keep your insurance active.",
      tip: "Lower premiums usually mean higher deductibles and copays (and vice versa). Choose based on how often you use healthcare.",
    },
  ];

  const claimFlowSteps = [
    { step: 1, title: "You visit the doctor", desc: "You receive care and may pay a copay at the office." },
    { step: 2, title: "Provider submits a claim", desc: "Your doctor sends a bill (claim) to your insurance company." },
    { step: 3, title: "Insurance processes the claim", desc: "Your insurer reviews the claim, applies your plan's negotiated rates, and determines what's covered." },
    { step: 4, title: "You receive an EOB", desc: "An Explanation of Benefits (EOB) is sent to you. This is NOT a bill — it shows what was charged, what insurance paid, and what you may owe." },
    { step: 5, title: "Provider sends you a bill", desc: "If you owe a remaining balance (deductible, coinsurance), the provider sends a bill for that amount." },
    { step: 6, title: "You pay the bill", desc: "Pay the amount shown on the provider's bill — not the EOB. Always compare the two before paying." },
  ];

  const commonQuestions = [
    {
      q: "Why do I owe money if I have insurance?",
      a: "Insurance doesn't cover 100% of costs (unless you've met your out-of-pocket max). You may owe a copay at the visit, and/or a portion of the bill through your deductible and coinsurance.",
    },
    {
      q: "What's the difference between an EOB and a bill?",
      a: "An EOB (Explanation of Benefits) is a statement from your INSURANCE showing what was charged and what they paid. A BILL is from your PROVIDER showing what YOU owe. Never pay from an EOB alone — wait for the actual bill.",
    },
    {
      q: "Why is my bill more than my copay?",
      a: "Your copay covers the office visit fee. But if additional services were performed (lab tests, imaging, procedures), those go through your deductible and coinsurance. You'll get a separate bill for those.",
    },
    {
      q: "I haven't met my deductible — what does that mean?",
      a: "Until you've paid your full deductible amount out of pocket (e.g., $1,500), you're responsible for the full negotiated cost of most services (except preventive care, which is usually covered at 100%).",
    },
    {
      q: "Why does the same service cost different amounts?",
      a: "Prices vary based on: (1) your insurance's negotiated rate with that specific provider, (2) whether the provider is in-network vs out-of-network, and (3) where the service is performed (hospital vs clinic).",
    },
    {
      q: "What's the difference between in-network and out-of-network?",
      a: "In-network providers have agreed to lower rates with your insurance. Out-of-network providers haven't, so you'll pay much more — and those costs may not count toward your deductible.",
    },
  ];

  return (
    <div className="space-y-6" data-testid="tab-content-costs">
      <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <HelpCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
          Understanding your healthcare costs helps you make informed decisions and avoid surprise bills.
          This guide explains common insurance terms in plain language.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="heading-key-terms">
          <DollarSign className="h-5 w-5 text-primary" />
          Key Insurance Terms Explained
        </h3>
        {costConcepts.map((concept) => (
          <Card key={concept.term} data-testid={`card-concept-${concept.term.toLowerCase().replace(/[^a-z]/g, "-")}`}>
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${concept.bg} shrink-0`}>
                  <concept.icon className={`h-5 w-5 ${concept.color}`} />
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-base">{concept.term}</h4>
                  <p className="text-sm">{concept.definition}</p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="font-medium text-xs text-muted-foreground mb-1">EXAMPLE:</p>
                    <p>{concept.example}</p>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <p className="text-muted-foreground"><span className="font-medium text-foreground">Tip:</span> {concept.tip}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="heading-claim-flow">
          <ArrowRight className="h-5 w-5 text-primary" />
          How a Medical Claim Works
        </h3>
        <Card>
          <CardContent className="pt-5">
            <div className="space-y-0">
              {claimFlowSteps.map((step, i) => (
                <div key={step.step} className="flex gap-3" data-testid={`claim-step-${step.step}`}>
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                      {step.step}
                    </div>
                    {i < claimFlowSteps.length - 1 && (
                      <div className="w-0.5 h-full bg-border min-h-[24px]" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="font-medium">{step.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" data-testid="heading-common-questions">
          <HelpCircle className="h-5 w-5 text-primary" />
          Common Questions
        </h3>
        <div className="grid gap-3">
          {commonQuestions.map((item, i) => (
            <Card key={i} data-testid={`faq-${i}`}>
              <CardContent className="pt-4 pb-3">
                <p className="font-medium text-sm mb-1.5">{item.q}</p>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="border-primary/30">
        <CardContent className="pt-5 text-center">
          <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
          <h4 className="font-semibold">Have your insurance card handy?</h4>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Upload a photo of your insurance card to auto-fill your coverage details, so you always know what you'll owe.
          </p>
          <Button variant="outline" onClick={() => window.location.href = "/insurance-card-upload"} data-testid="button-go-card-upload">
            <Camera className="h-4 w-4 mr-2" />
            Upload Insurance Card
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillsEOB() {
  useSEO({
    title: "Bills & EOB Management | Tabula Medica",
    description: "Upload and manage your medical bills and EOBs, go paperless with electronic Medicare EOBs, and enroll in the Tabula Medica Uninsured Plan.",
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Receipt className="h-6 w-6 text-primary" />
            Bills & EOB Management
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Upload medical bills, manage EOBs, go paperless, and save with the Tabula Medica Uninsured Plan.
          </p>
        </div>

        <Link href="/cms-1500">
          <Button variant="outline" size="sm" data-testid="link-cms-1500">
            <ClipboardList className="h-4 w-4 mr-1" />
            CMS-1500 Claim Forms
          </Button>
        </Link>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription data-testid="text-disclaimer">
            Tabula Medica does not provide insurance. The Tabula Medica Uninsured Plan connects patients directly with
            providers who accept Medicare rates. No middlemen, no actuaries, no adjusters.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="bills">
          <TabsList className="flex flex-wrap gap-1" data-testid="tabs-bills-eob">
            <TabsTrigger value="bills" data-testid="tab-bills">
              <Receipt className="h-4 w-4 mr-1.5" />
              My Bills & EOBs
            </TabsTrigger>
            <TabsTrigger value="paperless" data-testid="tab-paperless">
              <Mail className="h-4 w-4 mr-1.5" />
              Go Paperless
            </TabsTrigger>
            <TabsTrigger value="plan" data-testid="tab-plan">
              <Stethoscope className="h-4 w-4 mr-1.5" />
              Uninsured Plan
            </TabsTrigger>
            <TabsTrigger value="calculator" data-testid="tab-calculator">
              <Calculator className="h-4 w-4 mr-1.5" />
              Savings Calculator
            </TabsTrigger>
            <TabsTrigger value="understand-costs" data-testid="tab-understand-costs">
              <HelpCircle className="h-4 w-4 mr-1.5" />
              Understanding Your Costs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="mt-4">
            <MyBillsTab />
          </TabsContent>

          <TabsContent value="paperless" className="mt-4">
            <GoPaperlessTab />
          </TabsContent>

          <TabsContent value="plan" className="mt-4">
            <UninsuredPlanTab />
          </TabsContent>

          <TabsContent value="calculator" className="mt-4">
            <SavingsCalculatorTab />
          </TabsContent>

          <TabsContent value="understand-costs" className="mt-4">
            <UnderstandingCostsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
