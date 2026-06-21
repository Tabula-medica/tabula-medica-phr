import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  Users,
  Eye,
  Lock,
  UserPlus,
  Building2,
  Stethoscope,
  Heart,
  CreditCard,
  FlaskConical,
  FileText,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  History,
  Settings,
  MoreVertical,
  Trash2,
  Edit,
  ChevronRight,
  X,
  Database,
  Download,
  Link2Off,
  RefreshCw,
  Server,
  Loader2,
  Bot,
  Sparkles,
  MessageSquare,
  FileSearch,
  Power
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { 
  SharingRecipient, 
  DataSharingConsent, 
  ConsentSummary, 
  PrivacyDashboardStats,
  DataCategory,
  RecipientType,
  AccessLevel
} from "@shared/schema";
import { 
  dataCategories, 
  dataCategoryLabels, 
  recipientTypes, 
  recipientTypeLabels,
  accessLevels,
  accessLevelLabels
} from "@shared/schema";

const recipientFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  recipientType: z.enum(["doctor", "caregiver", "payer", "facility", "researcher", "other"]),
  organization: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  npi: z.string().optional(),
  notes: z.string().optional(),
});

type RecipientFormData = z.infer<typeof recipientFormSchema>;

const categoryIcons: Record<DataCategory, typeof Stethoscope> = {
  medications: FlaskConical,
  conditions: Activity,
  allergies: AlertTriangle,
  lab_results: FlaskConical,
  vital_signs: Activity,
  documents: FileText,
  appointments: Calendar,
  immunizations: Shield,
  procedures: Stethoscope,
  imaging: Eye,
  notes: FileText,
  demographics: Users,
  insurance: CreditCard,
};

const recipientTypeIcons: Record<RecipientType, typeof Stethoscope> = {
  doctor: Stethoscope,
  caregiver: Heart,
  payer: CreditCard,
  facility: Building2,
  researcher: FlaskConical,
  other: Users,
};

export default function Privacy() {
  return (
    <ScrollArea className="h-full">
      <div className="container max-w-6xl py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-privacy-title">
            <Shield className="h-6 w-6 text-primary" />
            Privacy Settings
          </h1>
          <p className="text-muted-foreground">
            Control who can access your health information with granular consent settings.
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList>
            <TabsTrigger value="dashboard" data-testid="tab-privacy-dashboard">
              <Shield className="h-4 w-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="data-control" data-testid="tab-privacy-data-control">
              <Database className="h-4 w-4 mr-2" />
              Data Control
            </TabsTrigger>
            <TabsTrigger value="recipients" data-testid="tab-privacy-recipients">
              <Users className="h-4 w-4 mr-2" />
              Recipients
            </TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-privacy-audit">
              <History className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="ai-settings" data-testid="tab-privacy-ai-settings">
              <Bot className="h-4 w-4 mr-2" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <PrivacyDashboard />
          </TabsContent>

          <TabsContent value="data-control" className="space-y-6">
            <DataControlSection />
          </TabsContent>

          <TabsContent value="recipients" className="space-y-6">
            <RecipientsManagement />
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <AuditLog />
          </TabsContent>

          <TabsContent value="ai-settings" className="space-y-6">
            <AISettingsSection />
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  );
}

function PrivacyDashboard() {
  const { data, isLoading, error } = useQuery<{ stats: PrivacyDashboardStats; summaries: ConsentSummary[] }>({
    queryKey: ['/api/privacy/dashboard'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Unable to load privacy dashboard</p>
        </CardContent>
      </Card>
    );
  }

  const { stats, summaries } = data;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold" data-testid="stat-total-recipients">{stats.totalRecipients}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Total Recipients</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold" data-testid="stat-active-recipients">{stats.activeRecipients}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Active Recipients</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold" data-testid="stat-consents-granted">{stats.totalConsentsGranted}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Consents Granted</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold" data-testid="stat-expiring-consents">{stats.expiringConsents}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Expiring Soon</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sharing Summary</CardTitle>
          <CardDescription>Overview of who has access to your health information</CardDescription>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <div className="text-center py-8">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Sharing Configured</h3>
              <p className="text-muted-foreground mb-4">
                Your health data is private. Add recipients to share specific information.
              </p>
              <Button variant="outline" asChild>
                <a href="#recipients">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Recipient
                </a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {summaries.map((summary) => {
                const Icon = recipientTypeIcons[summary.recipientType];
                return (
                  <div 
                    key={summary.recipientId} 
                    className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                    data-testid={`summary-recipient-${summary.recipientId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{summary.recipientName}</h4>
                        <p className="text-sm text-muted-foreground">
                          {recipientTypeLabels[summary.recipientType]}
                          {summary.organization && ` • ${summary.organization}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {summary.categoriesShared} of {summary.totalCategories}
                        </p>
                        <p className="text-xs text-muted-foreground">categories shared</p>
                      </div>
                      <Badge variant={summary.isActive ? "default" : "secondary"}>
                        {summary.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Categories</CardTitle>
          <CardDescription>Types of health information you can share</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dataCategories.map((category) => {
              const Icon = categoryIcons[category];
              const info = dataCategoryLabels[category];
              return (
                <div key={category} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{info.label}</h4>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RecipientsManagement() {
  const [selectedRecipient, setSelectedRecipient] = useState<SharingRecipient | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: recipients, isLoading } = useQuery<SharingRecipient[]>({
    queryKey: ['/api/privacy/recipients'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/privacy/recipients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/recipients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/dashboard'] });
      toast({ title: "Recipient removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove recipient", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div>
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Sharing Recipients</h2>
          <p className="text-sm text-muted-foreground">People and organizations who can access your health data</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-recipient">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Recipient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Sharing Recipient</DialogTitle>
              <DialogDescription>
                Add a person or organization to share your health information with.
              </DialogDescription>
            </DialogHeader>
            <AddRecipientForm onSuccess={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {recipients?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">Your Data Is Private</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You haven't shared your health information with anyone yet. Add recipients to grant specific access to your health data.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-recipient">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Your First Recipient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {recipients?.map((recipient) => (
            <RecipientCard
              key={recipient.id}
              recipient={recipient}
              onSelect={() => setSelectedRecipient(recipient)}
              onDelete={() => deleteMutation.mutate(recipient.id)}
            />
          ))}
        </div>
      )}

      {selectedRecipient && (
        <Dialog open={!!selectedRecipient} onOpenChange={() => setSelectedRecipient(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Manage Access for {selectedRecipient.name}
              </DialogTitle>
              <DialogDescription>
                Configure which categories of health data this recipient can access.
              </DialogDescription>
            </DialogHeader>
            <ConsentManager recipient={selectedRecipient} onClose={() => setSelectedRecipient(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function RecipientCard({ 
  recipient, 
  onSelect, 
  onDelete 
}: { 
  recipient: SharingRecipient; 
  onSelect: () => void;
  onDelete: () => void;
}) {
  const Icon = recipientTypeIcons[recipient.recipientType];
  
  return (
    <Card className="hover-elevate" data-testid={`card-recipient-${recipient.id}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{recipient.name}</h3>
              <p className="text-sm text-muted-foreground">
                {recipientTypeLabels[recipient.recipientType]}
              </p>
              {recipient.organization && (
                <p className="text-sm text-muted-foreground">{recipient.organization}</p>
              )}
              {recipient.email && (
                <p className="text-xs text-muted-foreground mt-1">{recipient.email}</p>
              )}
            </div>
          </div>
          <Badge variant={recipient.isActive ? "default" : "secondary"}>
            {recipient.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="ghost" size="sm" onClick={onDelete} data-testid={`button-delete-recipient-${recipient.id}`}>
            <Trash2 className="h-4 w-4 mr-1" />
            Remove
          </Button>
          <Button size="sm" onClick={onSelect} data-testid={`button-manage-recipient-${recipient.id}`}>
            <Settings className="h-4 w-4 mr-1" />
            Manage Access
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddRecipientForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  
  const form = useForm<RecipientFormData>({
    resolver: zodResolver(recipientFormSchema),
    defaultValues: {
      name: "",
      recipientType: "doctor",
      organization: "",
      email: "",
      phone: "",
      npi: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: RecipientFormData) => {
      const res = await apiRequest("POST", "/api/privacy/recipients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/recipients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/dashboard'] });
      toast({ title: "Recipient added successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add recipient", variant: "destructive" });
    },
  });

  const onSubmit = (data: RecipientFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="recipientType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-recipient-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {recipientTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {recipientTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Dr. Jane Smith" data-testid="input-recipient-name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Metro General Hospital" data-testid="input-recipient-org" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (Optional)</FormLabel>
              <FormControl>
                <Input type="email" placeholder="doctor@hospital.com" data-testid="input-recipient-email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Primary care physician" data-testid="input-recipient-notes" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-recipient">
            {createMutation.isPending ? "Adding..." : "Add Recipient"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ConsentManager({ recipient, onClose }: { recipient: SharingRecipient; onClose: () => void }) {
  const { toast } = useToast();
  const [consents, setConsents] = useState<Record<DataCategory, AccessLevel>>(() => {
    const initial: Record<DataCategory, AccessLevel> = {} as Record<DataCategory, AccessLevel>;
    dataCategories.forEach((cat) => {
      initial[cat] = "none";
    });
    return initial;
  });

  const { data: existingConsents, isLoading } = useQuery<DataSharingConsent[]>({
    queryKey: ['/api/privacy/recipients', recipient.id, 'consents'],
  });

  useState(() => {
    if (existingConsents) {
      const updated = { ...consents };
      existingConsents.forEach((consent) => {
        updated[consent.dataCategory] = consent.accessLevel;
      });
      setConsents(updated);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (consentData: { category: DataCategory; accessLevel: AccessLevel }[]) => {
      const res = await apiRequest("PUT", `/api/privacy/recipients/${recipient.id}/consents`, { consents: consentData });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/recipients', recipient.id, 'consents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/privacy/dashboard'] });
      toast({ title: "Consent settings saved" });
      onClose();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save consent settings", variant: "destructive" });
    },
  });

  const handleToggle = (category: DataCategory) => {
    setConsents((prev) => ({
      ...prev,
      [category]: prev[category] === "none" ? "read" : "none",
    }));
  };

  const handleAccessChange = (category: DataCategory, level: AccessLevel) => {
    setConsents((prev) => ({
      ...prev,
      [category]: level,
    }));
  };

  const handleSave = () => {
    const consentData = Object.entries(consents).map(([category, accessLevel]) => ({
      category: category as DataCategory,
      accessLevel,
    }));
    updateMutation.mutate(consentData);
  };

  const grantedCount = Object.values(consents).filter((level) => level !== "none").length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <div>
          <h4 className="font-medium">Sharing Summary</h4>
          <p className="text-sm text-muted-foreground">
            {grantedCount} of {dataCategories.length} categories shared
          </p>
        </div>
        <Badge variant={grantedCount > 0 ? "default" : "secondary"}>
          {grantedCount > 0 ? "Sharing Enabled" : "No Sharing"}
        </Badge>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium">Data Categories</h4>
        <div className="space-y-3">
          {dataCategories.map((category) => {
            const Icon = categoryIcons[category];
            const info = dataCategoryLabels[category];
            const currentLevel = consents[category];
            const isEnabled = currentLevel !== "none";

            return (
              <div 
                key={category} 
                className="flex items-center justify-between p-4 border rounded-lg"
                data-testid={`consent-row-${category}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
                    <Icon className={`h-4 w-4 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h5 className="font-medium">{info.label}</h5>
                    <p className="text-xs text-muted-foreground">{info.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isEnabled && (
                    <Select 
                      value={currentLevel} 
                      onValueChange={(value) => handleAccessChange(category, value as AccessLevel)}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-access-${category}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {accessLevels.filter((l) => l !== "none").map((level) => (
                          <SelectItem key={level} value={level}>
                            {accessLevelLabels[level].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleToggle(category)}
                    data-testid={`switch-consent-${category}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-consents">
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

interface ConsentAuditLogEntry {
  id: string;
  patientUserId: string;
  recipientId?: string;
  action: "grant" | "revoke" | "modify" | "access" | "export" | "policy_update";
  dataCategory?: DataCategory;
  previousAccessLevel?: AccessLevel;
  newAccessLevel?: AccessLevel;
  reason?: string;
  timestamp: string;
}

function AuditLog() {
  const { data: logs, isLoading } = useQuery<ConsentAuditLogEntry[]>({
    queryKey: ['/api/privacy/audit-log'],
  });

  const actionLabels: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
    grant: { label: "Access Granted", icon: CheckCircle, color: "text-green-500" },
    revoke: { label: "Access Revoked", icon: X, color: "text-red-500" },
    modify: { label: "Access Modified", icon: Edit, color: "text-blue-500" },
    access: { label: "Data Accessed", icon: Eye, color: "text-purple-500" },
    export: { label: "Data Exported", icon: FileText, color: "text-orange-500" },
    policy_update: { label: "Policy Updated", icon: Settings, color: "text-gray-500" },
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Consent Audit Log
        </CardTitle>
        <CardDescription>
          Complete history of changes to your privacy settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs?.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Activity Yet</h3>
            <p className="text-muted-foreground">
              Changes to your privacy settings will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {logs?.map((log) => {
              const actionInfo = actionLabels[log.action] || { label: log.action, icon: Settings, color: "text-gray-500" };
              const Icon = actionInfo.icon;
              
              return (
                <div 
                  key={log.id} 
                  className="flex items-start gap-4 p-4 border rounded-lg"
                  data-testid={`audit-log-${log.id}`}
                >
                  <div className={`p-2 rounded-full bg-muted ${actionInfo.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-medium">{actionInfo.label}</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {log.dataCategory && (
                      <p className="text-sm text-muted-foreground">
                        Category: {dataCategoryLabels[log.dataCategory]?.label || log.dataCategory}
                      </p>
                    )}
                    {log.reason && (
                      <p className="text-sm text-muted-foreground">{log.reason}</p>
                    )}
                    {log.previousAccessLevel && log.newAccessLevel && (
                      <p className="text-sm text-muted-foreground">
                        Changed from {accessLevelLabels[log.previousAccessLevel]?.label} to {accessLevelLabels[log.newAccessLevel]?.label}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ConnectedSource {
  id: string;
  name: string;
  type: string;
  status: "connected" | "disconnected" | "error" | "syncing";
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  recordsImported: number;
  connectedAt: string;
  permissions: string[];
}

interface DataExportRequest {
  id: string;
  format: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
}

interface PrivacyStats {
  connectedSources: number;
  totalRecords: number;
  lastActivity: string | null;
  pendingExports: number;
  dataCategories: Array<{ name: string; count: number }>;
}

interface DataSummaryCategory {
  name: string;
  description: string;
  itemCount: number;
  lastUpdated: string | null;
}

const sourceStatusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  connected: { icon: CheckCircle, color: "text-green-600", label: "Connected" },
  disconnected: { icon: Link2Off, color: "text-gray-500", label: "Disconnected" },
  error: { icon: AlertTriangle, color: "text-red-600", label: "Error" },
  syncing: { icon: Loader2, color: "text-blue-600", label: "Syncing" },
};

const sourceTypeIcons: Record<string, typeof Server> = {
  ehr: Server,
  pharmacy: FileText,
  lab: Activity,
  insurance: Shield,
  wearable: Activity,
  manual: FileText,
};

function DataControlSection() {
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<string>("pdf");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<PrivacyStats>({
    queryKey: ["/api/privacy/stats"],
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery<ConnectedSource[]>({
    queryKey: ["/api/privacy/sources"],
  });

  const { data: exports, isLoading: exportsLoading } = useQuery<DataExportRequest[]>({
    queryKey: ["/api/privacy/exports"],
  });

  const { data: dataSummary } = useQuery<{ categories: DataSummaryCategory[] }>({
    queryKey: ["/api/privacy/data-summary"],
  });

  const revokeMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await apiRequest("DELETE", `/api/privacy/sources/${sourceId}`, {});
      if (!response.ok) throw new Error("Failed to revoke access");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
      toast({ title: "Access Revoked", description: "Connection has been removed" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke access", variant: "destructive" });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async (sourceId: string) => {
      const response = await apiRequest("POST", `/api/privacy/sources/${sourceId}/reconnect`, {});
      if (!response.ok) throw new Error("Failed to reconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/sources"] });
      toast({ title: "Reconnecting", description: "Sync will begin shortly" });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/privacy/exports", {
        format: exportFormat,
        categories: ["all"],
      });
      if (!response.ok) throw new Error("Failed to request export");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/exports"] });
      toast({ title: "Export Requested", description: "Your data export is being prepared" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/privacy/delete-account", {});
      if (!response.ok) throw new Error("Failed to request deletion");
      return response.json();
    },
    onSuccess: () => {
      setShowDeleteConfirm(false);
      toast({ title: "Deletion Requested", description: "Check your email for confirmation. You have 24 hours to cancel." });
    },
  });

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold" data-testid="stat-connected-sources">{stats.connectedSources}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Connected Sources</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold" data-testid="stat-total-records">{stats.totalRecords.toLocaleString()}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total Records</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold" data-testid="stat-data-categories">{stats.dataCategories.length}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Data Categories</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-orange-500" />
                <span className="text-2xl font-bold" data-testid="stat-pending-exports">{stats.pendingExports}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Pending Exports</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Connected Data Sources
          </CardTitle>
          <CardDescription>Manage connections to your health record providers</CardDescription>
        </CardHeader>
        <CardContent>
          {sourcesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : sources && sources.length > 0 ? (
            <div className="space-y-3">
              {sources.map((source) => {
                const config = sourceStatusConfig[source.status] || sourceStatusConfig.disconnected;
                const StatusIcon = config.icon;
                const TypeIcon = sourceTypeIcons[source.type] || Server;

                return (
                  <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`source-${source.id}`}>
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{source.name}</p>
                          <div className={`flex items-center gap-1 ${config.color}`}>
                            <StatusIcon className={`h-4 w-4 ${source.status === "syncing" ? "animate-spin" : ""}`} />
                            <span className="text-xs">{config.label}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {source.permissions.slice(0, 3).map((p, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
                          ))}
                          {source.permissions.length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{source.permissions.length - 3}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {source.recordsImported} records
                          {source.lastSyncAt && ` • Last sync: ${new Date(source.lastSyncAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {source.status === "disconnected" ? (
                        <Button size="sm" variant="outline" onClick={() => reconnectMutation.mutate(source.id)} data-testid={`button-reconnect-${source.id}`}>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reconnect
                        </Button>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-red-600" data-testid={`button-revoke-${source.id}`}>
                              <Link2Off className="h-4 w-4 mr-1" />
                              Revoke
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will disconnect {source.name}. No new data will be synced. Your existing records will remain but won't be updated.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => revokeMutation.mutate(source.id)} data-testid="button-confirm-revoke">
                                Revoke Access
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Connected Sources</h3>
              <p className="text-muted-foreground">Connect your health providers to import records</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Your Data
            </CardTitle>
            <CardDescription>Download all your health records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-[140px]" data-testid="select-export-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf" data-testid="option-pdf">PDF</SelectItem>
                  <SelectItem value="json" data-testid="option-json">JSON</SelectItem>
                  <SelectItem value="fhir" data-testid="option-fhir">FHIR R4</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} data-testid="button-request-export">
                {exportMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Export Data
              </Button>
            </div>
            {exports && exports.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Recent Exports</p>
                {exports.slice(0, 3).map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`export-${exp.id}`}>
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{exp.format.toUpperCase()} Export</p>
                        <p className="text-xs text-muted-foreground">{new Date(exp.requestedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {exp.status === "completed" && exp.downloadUrl ? (
                      <Button size="sm" variant="outline" asChild data-testid={`button-download-${exp.id}`}>
                        <a href={exp.downloadUrl}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </a>
                      </Button>
                    ) : exp.status === "processing" ? (
                      <Badge variant="secondary">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Processing
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{exp.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Your Data Summary
            </CardTitle>
            <CardDescription>Overview of stored information</CardDescription>
          </CardHeader>
          <CardContent>
            {dataSummary?.categories ? (
              <div className="grid grid-cols-2 gap-2">
                {dataSummary.categories.map((cat, i) => (
                  <div key={i} className="p-3 rounded-lg border" data-testid={`data-category-${i}`}>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{cat.name}</p>
                      <Badge variant="secondary">{cat.itemCount}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-32" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>Permanently delete your account and all associated data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-900/10">
            <p className="text-sm text-muted-foreground mb-4">
              This action cannot be undone. All your health records, connected sources, and account data will be permanently removed.
            </p>
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" data-testid="button-delete-account">
                  Request Account Deletion
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all your health records. This action cannot be undone.
                    You will receive an email to confirm this request.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={deleteMutation.isPending}
                    data-testid="button-confirm-delete"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AIPreferences {
  userId: string;
  aiExplanationsEnabled: boolean;
  aiSummariesEnabled: boolean;
  updatedAt: string | null;
}

function AISettingsSection() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<AIPreferences>({
    queryKey: ["/api/ai-preferences"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AIPreferences>) => {
      const response = await apiRequest("PUT", "/api/ai-preferences", updates);
      if (!response.ok) throw new Error("Failed to update AI preferences");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-preferences"] });
      toast({ 
        title: "Preferences Updated", 
        description: "Your AI settings have been saved" 
      });
    },
    onError: () => {
      toast({ 
        title: "Update Failed", 
        description: "Could not save your preferences. Please try again.",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-8 w-48 mb-4" />
            <Skeleton className="h-24" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const aiExplanationsEnabled = preferences?.aiExplanationsEnabled ?? true;
  const aiSummariesEnabled = preferences?.aiSummariesEnabled ?? true;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            AI Feature Controls
          </CardTitle>
          <CardDescription>
            Manage how AI is used to process and display your health information.
            Disabling features will stop AI-powered analysis while keeping your data accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-muted/50 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Your Privacy, Your Choice</p>
              <p className="text-sm text-muted-foreground">
                These controls let you opt out of AI-powered features at any time. 
                Your health data is never shared with external AI systems without your consent.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="ai-explanations" className="text-base font-medium cursor-pointer">
                    AI Medical Term Explanations
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Get plain-language explanations of complex medical terminology, lab values, and conditions using AI.
                  </p>
                </div>
              </div>
              <Switch
                id="ai-explanations"
                checked={aiExplanationsEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ aiExplanationsEnabled: checked })}
                disabled={updateMutation.isPending}
                data-testid="switch-ai-explanations"
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-start gap-3">
                <FileSearch className="h-5 w-5 text-purple-500 mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor="ai-summaries" className="text-base font-medium cursor-pointer">
                    AI Document Summaries
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate summaries of clinical notes, visit records, and health documents.
                  </p>
                </div>
              </div>
              <Switch
                id="ai-summaries"
                checked={aiSummariesEnabled}
                onCheckedChange={(checked) => updateMutation.mutate({ aiSummariesEnabled: checked })}
                disabled={updateMutation.isPending}
                data-testid="switch-ai-summaries"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Feature Status
          </CardTitle>
          <CardDescription>
            Current state of AI-powered features in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Explanations</span>
                <Badge 
                  variant={aiExplanationsEnabled ? "default" : "secondary"}
                  data-testid="badge-explanations-status"
                >
                  {aiExplanationsEnabled ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3 mr-1" />
                      Disabled
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {aiExplanationsEnabled 
                  ? "AI explanations are shown when viewing records" 
                  : "AI explanations are hidden throughout the app"
                }
              </p>
            </div>

            <div className="p-4 rounded-lg border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Summaries</span>
                <Badge 
                  variant={aiSummariesEnabled ? "default" : "secondary"}
                  data-testid="badge-summaries-status"
                >
                  {aiSummariesEnabled ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Enabled
                    </>
                  ) : (
                    <>
                      <Power className="h-3 w-3 mr-1" />
                      Disabled
                    </>
                  )}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {aiSummariesEnabled 
                  ? "AI summaries are generated for documents" 
                  : "Document summaries are not generated"
                }
              </p>
            </div>
          </div>

          {preferences?.updatedAt && (
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date(preferences.updatedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 dark:border-amber-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Disabling AI features affects only how your data is displayed and analyzed within this app. 
              Your underlying health records remain unchanged and accessible.
            </p>
            <p>
              Some features like the AI Medical Assistant and Health Insights may have reduced 
              functionality when these settings are disabled.
            </p>
            <p>
              Changes take effect immediately and are logged in your security audit trail.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
