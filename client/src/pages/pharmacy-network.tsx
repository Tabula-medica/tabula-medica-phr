import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Pharmacy } from "@shared/schema";
import { PageHeader, StatCardGrid, type StatCardItem } from "@/components/shared";
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Key,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Shield,
  Truck,
  CreditCard,
  FileText
} from "lucide-react";

const pharmacyFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "Zip code is required"),
  phone: z.string().min(10, "Phone is required"),
  fax: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  hours: z.string().optional(),
  npiNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  chainAffiliation: z.string().optional(),
  networkStatus: z.enum(["active", "inactive", "suspended", "pending"]),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  deliveryAvailable: z.boolean(),
  is24Hour: z.boolean(),
  acceptsMedicare: z.boolean(),
  acceptsMedicaid: z.boolean(),
  supportsElectronicPrescribing: z.boolean(),
  isPreferred: z.boolean(),
  specialties: z.string(),
  notes: z.string().optional(),
});

type PharmacyFormData = z.infer<typeof pharmacyFormSchema>;

function getStatusBadge(status: string) {
  switch (status) {
    case "active":
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20" data-testid="badge-status-active"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>;
    case "inactive":
      return <Badge variant="secondary" data-testid="badge-status-inactive"><XCircle className="h-3 w-3 mr-1" /> Inactive</Badge>;
    case "suspended":
      return <Badge variant="destructive" data-testid="badge-status-suspended"><AlertCircle className="h-3 w-3 mr-1" /> Suspended</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20" data-testid="badge-status-pending"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function PharmacyForm({ 
  pharmacy, 
  onSubmit, 
  onCancel, 
  isSubmitting 
}: { 
  pharmacy?: Pharmacy; 
  onSubmit: (data: PharmacyFormData) => void; 
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const form = useForm<PharmacyFormData>({
    resolver: zodResolver(pharmacyFormSchema),
    defaultValues: {
      name: pharmacy?.name || "",
      address: pharmacy?.address || "",
      city: pharmacy?.city || "",
      state: pharmacy?.state || "",
      zipCode: pharmacy?.zipCode || "",
      phone: pharmacy?.phone || "",
      fax: pharmacy?.fax || "",
      email: pharmacy?.email || "",
      hours: pharmacy?.hours || "",
      npiNumber: pharmacy?.npiNumber || "",
      licenseNumber: pharmacy?.licenseNumber || "",
      chainAffiliation: pharmacy?.chainAffiliation || "",
      networkStatus: pharmacy?.networkStatus || "pending",
      contactPerson: pharmacy?.contactPerson || "",
      contactPhone: pharmacy?.contactPhone || "",
      deliveryAvailable: pharmacy?.deliveryAvailable || false,
      is24Hour: pharmacy?.is24Hour || false,
      acceptsMedicare: pharmacy?.acceptsMedicare || false,
      acceptsMedicaid: pharmacy?.acceptsMedicaid || false,
      supportsElectronicPrescribing: pharmacy?.supportsElectronicPrescribing || true,
      isPreferred: pharmacy?.isPreferred || false,
      specialties: pharmacy?.specialties?.join(", ") || "",
      notes: pharmacy?.notes || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="basic" data-testid="tab-basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact" data-testid="tab-contact">Contact</TabsTrigger>
            <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
            <TabsTrigger value="network" data-testid="tab-network">Network</TabsTrigger>
          </TabsList>
          
          <TabsContent value="basic" className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pharmacy Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Metro Pharmacy" data-testid="input-pharmacy-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="npiNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>NPI Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="1234567890" data-testid="input-npi" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="licenseNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>License Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="IL-RX-12345" data-testid="input-license" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="chainAffiliation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chain Affiliation</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Independent, CVS, Walgreens, etc." data-testid="input-chain" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="123 Main St" data-testid="input-address" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Springfield" data-testid="input-city" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="IL" maxLength={2} data-testid="input-state" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="zipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zip Code</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="62701" data-testid="input-zip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hours</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Mon-Fri: 8AM-9PM, Sat-Sun: 9AM-6PM" data-testid="input-hours" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4567" data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fax</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4568" data-testid="input-fax" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} type="email" placeholder="pharmacy@example.com" data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium mb-4">Primary Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Jane Smith" data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="(555) 123-4569" data-testid="input-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="services" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supportsElectronicPrescribing"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>E-Prescribing</FormLabel>
                      <FormDescription className="text-xs">Accepts electronic prescriptions</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-eprescribe" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryAvailable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Delivery</FormLabel>
                      <FormDescription className="text-xs">Offers prescription delivery</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-delivery" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is24Hour"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>24 Hour</FormLabel>
                      <FormDescription className="text-xs">Open 24 hours</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-24hour" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isPreferred"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Preferred</FormLabel>
                      <FormDescription className="text-xs">Mark as preferred partner</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-preferred" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="acceptsMedicare"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Medicare</FormLabel>
                      <FormDescription className="text-xs">Accepts Medicare</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-medicare" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acceptsMedicaid"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Medicaid</FormLabel>
                      <FormDescription className="text-xs">Accepts Medicaid</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-medicaid" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="specialties"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specialties</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Compounding, Specialty Medications, Oncology" data-testid="input-specialties" />
                  </FormControl>
                  <FormDescription>Comma-separated list of specialties</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
          
          <TabsContent value="network" className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="networkStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Network Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-network-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active" data-testid="option-active">Active</SelectItem>
                      <SelectItem value="inactive" data-testid="option-inactive">Inactive</SelectItem>
                      <SelectItem value="suspended" data-testid="option-suspended">Suspended</SelectItem>
                      <SelectItem value="pending" data-testid="option-pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Only active pharmacies are available for patient selection
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Internal notes about this pharmacy..." className="min-h-[100px]" data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} data-testid="button-save">
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {pharmacy ? "Update Pharmacy" : "Add Pharmacy"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ApiKeyDialog({ pharmacy, onClose }: { pharmacy: Pharmacy; onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const { toast } = useToast();

  const setApiKeyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/pharmacies/${pharmacy.id}/api-key`, { apiKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies"] });
      toast({
        title: "API Key Configured",
        description: `API key has been set for ${pharmacy.name}.`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set API key.",
        variant: "destructive",
      });
    },
  });

  const clearApiKeyMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/pharmacies/${pharmacy.id}/api-key`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies"] });
      toast({
        title: "API Key Cleared",
        description: `API key has been removed for ${pharmacy.name}.`,
      });
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear API key.",
        variant: "destructive",
      });
    },
  });

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Key Management
        </DialogTitle>
        <DialogDescription>
          Manage the API key for {pharmacy.name}. API keys are stored securely and never displayed after configuration.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        {pharmacy.apiKeyConfigured ? (
          <div className="flex items-center gap-2 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium text-green-500">API Key Configured</p>
              <p className="text-sm text-muted-foreground">
                Last updated: {pharmacy.apiKeyLastUpdated ? new Date(pharmacy.apiKeyLastUpdated).toLocaleDateString() : "Unknown"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            <div>
              <p className="font-medium text-yellow-500">No API Key</p>
              <p className="text-sm text-muted-foreground">
                Configure an API key to enable e-prescribing integration.
              </p>
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="apiKey">New API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API key..."
            data-testid="input-api-key"
          />
          <p className="text-xs text-muted-foreground">
            API keys are encrypted at rest and never displayed after saving.
          </p>
        </div>
      </div>
      
      <DialogFooter className="gap-2">
        {pharmacy.apiKeyConfigured && (
          <Button 
            variant="destructive" 
            onClick={() => clearApiKeyMutation.mutate()}
            disabled={clearApiKeyMutation.isPending}
            data-testid="button-clear-api-key"
          >
            {clearApiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Clear API Key
          </Button>
        )}
        <Button
          onClick={() => setApiKeyMutation.mutate()}
          disabled={!apiKey || setApiKeyMutation.isPending}
          data-testid="button-save-api-key"
        >
          {setApiKeyMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save API Key
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function PharmacyNetworkPage() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
  const [apiKeyPharmacy, setApiKeyPharmacy] = useState<Pharmacy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Pharmacy | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: pharmacies = [], isLoading } = useQuery<Pharmacy[]>({
    queryKey: ["/api/pharmacies"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PharmacyFormData) => {
      const payload = {
        ...data,
        specialties: data.specialties.split(",").map(s => s.trim()).filter(Boolean),
      };
      return apiRequest("POST", "/api/pharmacies", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies"] });
      setIsAddOpen(false);
      toast({
        title: "Pharmacy Added",
        description: "The pharmacy has been added to the network.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add pharmacy.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PharmacyFormData }) => {
      const payload = {
        ...data,
        specialties: data.specialties.split(",").map(s => s.trim()).filter(Boolean),
      };
      return apiRequest("PUT", `/api/pharmacies/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies"] });
      setEditingPharmacy(null);
      toast({
        title: "Pharmacy Updated",
        description: "The pharmacy has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update pharmacy.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pharmacies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pharmacies"] });
      setDeleteConfirm(null);
      toast({
        title: "Pharmacy Removed",
        description: "The pharmacy has been removed from the network.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove pharmacy.",
        variant: "destructive",
      });
    },
  });

  const filteredPharmacies = pharmacies.filter(p => 
    statusFilter === "all" || p.networkStatus === statusFilter
  );

  const statusCounts = {
    all: pharmacies.length,
    active: pharmacies.filter(p => p.networkStatus === "active").length,
    inactive: pharmacies.filter(p => p.networkStatus === "inactive").length,
    pending: pharmacies.filter(p => p.networkStatus === "pending").length,
    suspended: pharmacies.filter(p => p.networkStatus === "suspended").length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        title="Pharmacy Network"
        subtitle="Manage pharmacy partners and API integrations"
        icon={<Building2 className="h-6 w-6" />}
        actions={
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-pharmacy">
                <Plus className="h-4 w-4 mr-2" />
                Add Pharmacy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Pharmacy</DialogTitle>
                <DialogDescription>
                  Add a new pharmacy to the network. Configure details, services, and integration settings.
                </DialogDescription>
              </DialogHeader>
              <PharmacyForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsAddOpen(false)}
                isSubmitting={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <StatCardGrid
        columns={5}
        layout="center"
        stats={[
          { label: "Total", value: statusCounts.all, icon: Building2, testId: "card-filter-all", onClick: () => setStatusFilter("all"), selected: statusFilter === "all", selectedRing: "ring-primary" },
          { label: "Active", value: statusCounts.active, icon: Building2, color: "text-green-500", testId: "card-filter-active", onClick: () => setStatusFilter("active"), selected: statusFilter === "active", selectedRing: "ring-green-500" },
          { label: "Pending", value: statusCounts.pending, icon: Building2, color: "text-yellow-500", testId: "card-filter-pending", onClick: () => setStatusFilter("pending"), selected: statusFilter === "pending", selectedRing: "ring-yellow-500" },
          { label: "Inactive", value: statusCounts.inactive, icon: Building2, color: "text-gray-500", testId: "card-filter-inactive", onClick: () => setStatusFilter("inactive"), selected: statusFilter === "inactive", selectedRing: "ring-gray-500" },
          { label: "Suspended", value: statusCounts.suspended, icon: Building2, color: "text-red-500", testId: "card-filter-suspended", onClick: () => setStatusFilter("suspended"), selected: statusFilter === "suspended", selectedRing: "ring-red-500" },
        ] satisfies StatCardItem[]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Network Pharmacies</CardTitle>
          <CardDescription>
            {filteredPharmacies.length} {statusFilter === "all" ? "total" : statusFilter} pharmacies
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pharmacy</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>API</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPharmacies.map((pharmacy) => (
                <TableRow key={pharmacy.id} data-testid={`row-pharmacy-${pharmacy.id}`}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{pharmacy.name}</p>
                      <p className="text-sm text-muted-foreground">{pharmacy.chainAffiliation || "Independent"}</p>
                      {pharmacy.npiNumber && (
                        <p className="text-xs text-muted-foreground">NPI: {pharmacy.npiNumber}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p className="text-sm">{pharmacy.address}</p>
                        <p className="text-sm text-muted-foreground">
                          {pharmacy.city}, {pharmacy.state} {pharmacy.zipCode}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" />
                        {pharmacy.phone}
                      </div>
                      {pharmacy.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {pharmacy.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {pharmacy.supportsElectronicPrescribing && (
                        <Badge variant="outline" className="text-xs"><FileText className="h-3 w-3 mr-1" />E-Rx</Badge>
                      )}
                      {pharmacy.deliveryAvailable && (
                        <Badge variant="outline" className="text-xs"><Truck className="h-3 w-3 mr-1" />Delivery</Badge>
                      )}
                      {pharmacy.is24Hour && (
                        <Badge variant="outline" className="text-xs"><Clock className="h-3 w-3 mr-1" />24hr</Badge>
                      )}
                      {pharmacy.acceptsMedicare && (
                        <Badge variant="outline" className="text-xs"><CreditCard className="h-3 w-3 mr-1" />Medicare</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(pharmacy.networkStatus || "pending")}
                  </TableCell>
                  <TableCell>
                    {pharmacy.apiKeyConfigured ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        <Key className="h-3 w-3 mr-1" />
                        Configured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Key className="h-3 w-3 mr-1" />
                        Not Set
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => setApiKeyPharmacy(pharmacy)}
                        data-testid={`button-api-key-${pharmacy.id}`}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => setEditingPharmacy(pharmacy)}
                        data-testid={`button-edit-${pharmacy.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost"
                        onClick={() => setDeleteConfirm(pharmacy)}
                        data-testid={`button-delete-${pharmacy.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPharmacies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No pharmacies found with the selected filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingPharmacy} onOpenChange={() => setEditingPharmacy(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pharmacy</DialogTitle>
            <DialogDescription>
              Update pharmacy details and settings.
            </DialogDescription>
          </DialogHeader>
          {editingPharmacy && (
            <PharmacyForm
              pharmacy={editingPharmacy}
              onSubmit={(data) => updateMutation.mutate({ id: editingPharmacy.id, data })}
              onCancel={() => setEditingPharmacy(null)}
              isSubmitting={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!apiKeyPharmacy} onOpenChange={() => setApiKeyPharmacy(null)}>
        {apiKeyPharmacy && (
          <ApiKeyDialog 
            pharmacy={apiKeyPharmacy} 
            onClose={() => setApiKeyPharmacy(null)} 
          />
        )}
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pharmacy</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {deleteConfirm?.name} from the network? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
