import { useEffect, useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO, buildPageSchemas } from "@/hooks/use-seo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { useRegion } from "@/components/region-provider";
import type { AppRegion } from "@/components/region-provider";
import { useLanguage, TRANSLATION_METADATA } from "@/components/language-provider";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings as SettingsIcon,
  Moon,
  Sun,
  Bell,
  Shield,
  Download,
  Smartphone,
  Info,
  FileText,
  Link2,
  Share2,
  User,
  Mail,
  Phone,
  Pencil,
  Check,
  X,
  Database,
  Globe,
  ExternalLink,
  Activity,
  MapPin,
  MessageSquare,
  Send,
  Trash2,
  AlertTriangle,
  Loader2,
  FileJson,
  Lock,
} from "lucide-react";

interface NotificationPreferences {
  newRecords: boolean;
  connectionExpired: boolean;
  snapshotReady: boolean;
}

interface UserProfile {
  displayName: string;
  email: string;
  phone: string;
  avatarInitials: string;
}

interface EhrConnection {
  id: number;
  platform: string;
  status: string;
  label?: string;
  lastSynced?: string;
}

const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "Improvement Suggestion" },
  { value: "accessibility", label: "Accessibility Issue" },
  { value: "general", label: "General Feedback" },
];

function FeedbackForm() {
  const { toast } = useToast();
  const [category, setCategory] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({ title: "Please enter your feedback", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const subject = encodeURIComponent(`[${FEEDBACK_CATEGORIES.find(c => c.value === category)?.label}] Tabula Medica Feedback`);
      const body = encodeURIComponent(`Category: ${FEEDBACK_CATEGORIES.find(c => c.value === category)?.label}\n\n${message.trim()}\n\n---\nSent from Tabula Medica App`);
      window.location.href = `mailto:info@tabulamedica.digital?subject=${subject}&body=${body}`;
      toast({ title: "Opening email client...", description: "Your feedback draft has been prepared." });
      setMessage("");
      setCategory("general");
    } catch {
      toast({ title: "Could not open email client", description: "Please email info@tabulamedica.digital directly.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback-category">Category</Label>
        <select
          id="feedback-category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="select-feedback-category"
        >
          {FEEDBACK_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-message">Your Feedback</Label>
        <Textarea
          id="feedback-message"
          placeholder="Tell us what you think, report a bug, or suggest a feature..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          data-testid="textarea-feedback-message"
          aria-required="true"
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={handleSubmit} disabled={sending || !message.trim()} data-testid="button-send-feedback">
          <Send className="h-4 w-4 mr-2" />
          {sending ? "Opening..." : "Send Feedback"}
        </Button>
        <a
          href="mailto:info@tabulamedica.digital"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-email-feedback"
        >
          <Mail className="h-4 w-4" />
          info@tabulamedica.digital
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Your feedback is sent directly to our team. We read every message and use it to improve Tabula Medica for everyone.
      </p>
    </div>
  );
}

// --- GDPR / Data Rights -----------------------------------------------------

interface DeletionStatus {
  status: "none" | "scheduled" | "cancelled";
  purgeAfter: string | null;
  requestedAt?: string;
}

interface ConsentRecord {
  type: string;
  granted: boolean;
  version?: string;
  at: string;
  ip: string | null;
}

interface ConsentResponse {
  consents: ConsentRecord[];
  latestByType: Record<string, ConsentRecord>;
}

const CONSENT_TYPES: { type: string; label: string; description: string }[] = [
  {
    type: "gdpr_processing",
    label: "Data processing (GDPR Art. 6)",
    description:
      "Allow Tabula Medica to process your personal and health data to provide the service.",
  },
  {
    type: "emergency_sharing",
    label: "Emergency information sharing",
    description:
      "Allow break-glass access to your emergency info (allergies, contacts) by first responders.",
  },
  {
    type: "research",
    label: "Research & product improvement",
    description:
      "Allow your de-identified data to be used to improve features. You can withdraw any time.",
  },
];

function GdprDataRights() {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const deletionQ = useQuery<DeletionStatus>({
    queryKey: ["/api/account/deletion/status"],
  });
  const consentsQ = useQuery<ConsentResponse>({
    queryKey: ["/api/account/consent"],
  });

  const requestDeletionMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/account/deletion/request", {
        confirm: "DELETE",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Account deletion scheduled", description: data.message });
      setDeleteOpen(false);
      setConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["/api/account/deletion/status"] });
    },
    onError: (err: Error) =>
      toast({
        title: "Could not schedule deletion",
        description: err.message,
        variant: "destructive",
      }),
  });

  const cancelDeletionMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/account/deletion/cancel", {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Deletion cancelled",
        description: "Your account will not be deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/account/deletion/status"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" }),
  });

  const consentMut = useMutation({
    mutationFn: async (vars: { type: string; granted: boolean }) => {
      const res = await apiRequest("POST", "/api/account/consent", vars);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Consent updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/account/consent"] });
    },
    onError: (err: Error) =>
      toast({ title: "Could not update consent", description: err.message, variant: "destructive" }),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export", {
        credentials: "include",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `tabula-medica-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Export downloaded",
        description: "Your data was exported as a file you control.",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const scheduled = deletionQ.data?.status === "scheduled";
  const consents = consentsQ.data?.latestByType ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Data & Privacy Rights
        </CardTitle>
        <CardDescription>
          Your data is exported as a file you control. Account deletion is scheduled
          with a 30-day grace period and can be cancelled.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Download my data */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <FileJson className="h-5 w-5 text-muted-foreground" />
            <div>
              <Label>Download my data</Label>
              <p className="text-sm text-muted-foreground">
                Get a complete JSON copy of your account, profiles, documents,
                contacts, and audit history.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            data-testid="button-download-my-data"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {exporting ? "Preparing..." : "Download"}
          </Button>
        </div>

        <Separator />

        {/* Consents */}
        <div className="space-y-4">
          <div>
            <Label>Consents</Label>
            <p className="text-sm text-muted-foreground">
              Control how your data is used. Changes are recorded with a timestamp.
            </p>
          </div>
          {consentsQ.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            CONSENT_TYPES.map((c, i) => (
              <div key={c.type}>
                {i > 0 && <Separator className="mb-4" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Label htmlFor={`consent-${c.type}`} className="text-sm font-medium">
                      {c.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
                  </div>
                  <Switch
                    id={`consent-${c.type}`}
                    checked={consents[c.type]?.granted ?? false}
                    onCheckedChange={(granted) =>
                      consentMut.mutate({ type: c.type, granted })
                    }
                    disabled={consentMut.isPending}
                    data-testid={`switch-consent-${c.type}`}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <Separator />

        {/* Delete my account */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <Label className="text-destructive">Delete my account</Label>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data after a 30-day grace
                period. You can cancel any time before then.
              </p>
            </div>
          </div>

          {scheduled ? (
            <Alert variant="destructive" data-testid="alert-deletion-scheduled">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Deletion scheduled</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Your account is scheduled for permanent deletion on{" "}
                  <strong>
                    {deletionQ.data?.purgeAfter
                      ? new Date(deletionQ.data.purgeAfter).toLocaleDateString()
                      : "the end of the grace period"}
                  </strong>
                  . You can cancel any time before then.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => cancelDeletionMut.mutate()}
                  disabled={cancelDeletionMut.isPending}
                  data-testid="button-cancel-deletion"
                >
                  Cancel deletion
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                data-testid="button-open-delete-account"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete my account
              </Button>
              <DialogContent data-testid="dialog-delete-account">
                <DialogHeader>
                  <DialogTitle>Delete your account</DialogTitle>
                  <DialogDescription className="space-y-2">
                    <span className="block">
                      This schedules permanent deletion of your account, profiles, and
                      health records <strong>30 days from now</strong>. You can cancel
                      any time before then; after 30 days it is irreversible.
                    </span>
                    <span className="block">
                      Type <strong>DELETE</strong> below to confirm.
                    </span>
                  </DialogDescription>
                </DialogHeader>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  data-testid="input-confirm-delete"
                />
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteOpen(false);
                      setConfirmText("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => requestDeletionMut.mutate()}
                    disabled={confirmText !== "DELETE" || requestDeletionMut.isPending}
                    data-testid="button-confirm-delete-account"
                  >
                    {requestDeletionMut.isPending
                      ? "Scheduling..."
                      : "Schedule deletion"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Settings() {
  useSEO({
    title: "Settings",
    description: "Manage your Tabula Medica preferences, security settings, appearance, connected devices, and account details.",
    canonicalPath: "/settings",
    structuredData: buildPageSchemas({
      pageName: "Account Settings",
      pageDescription: "Manage your Tabula Medica preferences, security settings, appearance, connected devices, and account details.",
      pagePath: "/settings",
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Dashboard", path: "/dashboard" },
        { name: "Settings", path: "/settings" },
      ],
    }),
  });

  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, supportedLanguages, languageInfo } = useLanguage();
  const isMachineTranslated = TRANSLATION_METADATA[language]?.machineTranslated === true;
  const { toast } = useToast();
  const { region, setRegion, isUS } = useRegion();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const { data: userProfile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/user-profile"],
  });

  const { data: ehrConnections, isLoading: connectionsLoading } = useQuery<EhrConnection[]>({
    queryKey: ["/api/ehr-connections"],
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      const response = await apiRequest("PATCH", "/api/user-profile", updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile"] });
      setEditingField(null);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    },
  });

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValues({ ...editValues, [field]: currentValue });
  };

  const cancelEditing = () => {
    setEditingField(null);
  };

  const saveField = (field: string) => {
    updateProfileMutation.mutate({ [field]: editValues[field] });
  };

  const { data: notifPrefs, isLoading: prefsLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notification-preferences"],
  });

  const updatePrefMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const response = await apiRequest("PATCH", "/api/notification-preferences", { [key]: value });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      fetch("/api/notification-preferences/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "notification_setting_changed",
          setting: variables.key,
          value: variables.value,
        }),
      }).catch(() => {});
      toast({
        title: "Preference Updated",
        description: "Your notification settings have been saved.",
      });
    },
  });

  useEffect(() => {
    fetch("/api/notification-preferences/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "notification_settings_opened" }),
    }).catch(() => {});
  }, []);

  const handleToggle = (key: keyof NotificationPreferences, currentValue: boolean) => {
    updatePrefMutation.mutate({ key, value: !currentValue });
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground">Manage your app preferences and account settings</p>
        </div>

        {/* Profile Management */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Management</CardTitle>
            <CardDescription>Manage your personal information and display settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback data-testid="text-avatar-initials">{userProfile?.avatarInitials || "??"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium" data-testid="text-display-name">{userProfile?.displayName}</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-user-email">{userProfile?.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <Label>Display Name</Label>
                      {editingField === "displayName" ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            value={editValues.displayName || ""}
                            onChange={(e) => setEditValues({ ...editValues, displayName: e.target.value })}
                            data-testid="input-display-name"
                          />
                          <Button size="icon" variant="ghost" onClick={() => saveField("displayName")} disabled={updateProfileMutation.isPending} data-testid="button-save-display-name">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-display-name">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{userProfile?.displayName}</p>
                      )}
                    </div>
                  </div>
                  {editingField !== "displayName" && (
                    <Button size="icon" variant="ghost" onClick={() => startEditing("displayName", userProfile?.displayName || "")} data-testid="button-edit-display-name">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Mail className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <Label>Email</Label>
                      {editingField === "email" ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="email"
                            value={editValues.email || ""}
                            onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                            data-testid="input-email"
                          />
                          <Button size="icon" variant="ghost" onClick={() => saveField("email")} disabled={updateProfileMutation.isPending} data-testid="button-save-email">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-email">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{userProfile?.email}</p>
                      )}
                    </div>
                  </div>
                  {editingField !== "email" && (
                    <Button size="icon" variant="ghost" onClick={() => startEditing("email", userProfile?.email || "")} data-testid="button-edit-email">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Phone className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <Label>Phone Number</Label>
                      {editingField === "phone" ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="tel"
                            value={editValues.phone || ""}
                            onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                            data-testid="input-phone"
                          />
                          <Button size="icon" variant="ghost" onClick={() => saveField("phone")} disabled={updateProfileMutation.isPending} data-testid="button-save-phone">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={cancelEditing} data-testid="button-cancel-phone">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">{userProfile?.phone}</p>
                      )}
                    </div>
                  </div>
                  {editingField !== "phone" && (
                    <Button size="icon" variant="ghost" onClick={() => startEditing("phone", userProfile?.phone || "")} data-testid="button-edit-phone">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Customize how Tabula Medica looks on your device</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <div>
                  <Label htmlFor="dark-mode">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Use dark theme for reduced eye strain
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={theme === 'dark'}
                onCheckedChange={toggleTheme}
                data-testid="switch-dark-mode"
              />
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language</CardTitle>
            <CardDescription>
              Choose the language for the app interface. Right-to-left languages
              (Arabic, Hebrew, Urdu, Farsi, Pashto) are fully supported.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xl" aria-hidden="true">🌐</span>
              <div className="flex-1">
                <Label htmlFor="language-select">Display language</Label>
                <p className="text-sm text-muted-foreground">
                  Currently: {languageInfo.nativeName} ({languageInfo.name})
                  {languageInfo.direction === "rtl" && (
                    <Badge variant="secondary" className="ml-2 text-xs">RTL</Badge>
                  )}
                </p>
              </div>
            </div>
            <select
              id="language-select"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                toast({
                  title: "Language updated",
                  description: `Switched to ${supportedLanguages.find(l => l.code === e.target.value)?.nativeName}.`,
                });
              }}
              className="w-full bg-background border rounded-md px-3 py-2 text-sm cursor-pointer"
              data-testid="select-settings-language"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} — {lang.name}
                </option>
              ))}
            </select>
            {isMachineTranslated && (
              <p
                data-testid="text-machine-translated-warning"
                className="text-xs rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-2 text-amber-900 dark:text-amber-200"
              >
                Translation in progress. Some text may appear in English while
                native-speaker review is pending. Clinical disclaimers and drug
                names are always shown in English for safety.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Drug names, dosages, and lab units always appear in English to
              prevent transcription errors that could affect your safety.
            </p>
          </CardContent>
        </Card>

        {/* Region */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Region</CardTitle>
            <CardDescription>Select your region to see features relevant to your location</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label>Current Region</Label>
                <p className="text-sm text-muted-foreground">
                  {isUS ? "United States — Full feature access including EHR connections, USCDI compliance, and data backup" : "International — Core health record features optimized for global use"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={region === "us" ? "default" : "outline"}
                className="flex flex-col items-center gap-1 h-auto py-3"
                onClick={() => {
                  setRegion("us");
                  toast({ title: "Region Updated", description: "Switched to United States region." });
                }}
                data-testid="button-region-us"
              >
                <span className="text-lg">🇺🇸</span>
                <span className="text-sm font-medium">United States</span>
              </Button>
              <Button
                variant={region === "international" ? "default" : "outline"}
                className="flex flex-col items-center gap-1 h-auto py-3"
                onClick={() => {
                  setRegion("international");
                  toast({ title: "Region Updated", description: "Switched to International region." });
                }}
                data-testid="button-region-international"
              >
                <span className="text-lg">🌍</span>
                <span className="text-sm font-medium">International</span>
              </Button>
            </div>
            {!isUS && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                Some features like US EHR connections, Blue Button 2.0, USCDI compliance, TEFCA, and cloud data backup are only available in the United States region.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications</CardTitle>
            <CardDescription>Configure how you receive updates and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {prefsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="new-records">New Records</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when new health records are available
                      </p>
                    </div>
                  </div>
                  <Switch 
                    id="new-records" 
                    checked={notifPrefs?.newRecords ?? true}
                    onCheckedChange={() => handleToggle("newRecords", notifPrefs?.newRecords ?? true)}
                    disabled={updatePrefMutation.isPending}
                    data-testid="switch-new-records" 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="connection-expired">Connection Expired</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when an EHR connection needs to be renewed
                      </p>
                    </div>
                  </div>
                  <Switch 
                    id="connection-expired" 
                    checked={notifPrefs?.connectionExpired ?? true}
                    onCheckedChange={() => handleToggle("connectionExpired", notifPrefs?.connectionExpired ?? true)}
                    disabled={updatePrefMutation.isPending}
                    data-testid="switch-connection-expired" 
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Share2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <Label htmlFor="snapshot-ready">Snapshot Ready</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when a health snapshot is ready to share
                      </p>
                    </div>
                  </div>
                  <Switch 
                    id="snapshot-ready" 
                    checked={notifPrefs?.snapshotReady ?? true}
                    onCheckedChange={() => handleToggle("snapshotReady", notifPrefs?.snapshotReady ?? true)}
                    disabled={updatePrefMutation.isPending}
                    data-testid="switch-snapshot-ready" 
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Privacy & Security</CardTitle>
            <CardDescription>Manage your data and security preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <Label>Multi-factor authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add a 6-digit code from an authenticator app at sign-in.
                  </p>
                </div>
              </div>
              <Link href="/settings/security">
                <Button variant="outline" size="sm" data-testid="button-manage-mfa">
                  Manage
                </Button>
              </Link>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5" />
                <div>
                  <Label htmlFor="biometric-auth">Biometric Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Use Face ID or fingerprint to unlock the app
                  </p>
                </div>
              </div>
              <Switch id="biometric-auth" data-testid="switch-biometric-auth" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5" />
                <div>
                  <Label>Export Data</Label>
                  <p className="text-sm text-muted-foreground">
                    Download a copy of all your health data
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" data-testid="button-export-data">
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GDPR — Data & Privacy Rights (export / consent / account deletion) */}
        <GdprDataRights />

        {/* Data Source Connections (US Only) */}
        {isUS && <Card>
          <CardHeader>
            <CardTitle className="text-base">Data Source Connections</CardTitle>
            <CardDescription>Manage your connected EHR platforms and data sources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectionsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <Label>Connected Platforms</Label>
                    <p className="text-sm text-muted-foreground">
                      {ehrConnections?.length ?? 0} platform{(ehrConnections?.length ?? 0) !== 1 ? "s" : ""} connected
                    </p>
                  </div>
                </div>
                {ehrConnections && ehrConnections.length > 0 && (
                  <div className="space-y-3">
                    {ehrConnections.map((conn) => (
                      <div key={conn.id} className="flex items-center justify-between gap-2" data-testid={`connection-item-${conn.id}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate" data-testid={`text-connection-name-${conn.id}`}>{conn.label || conn.platform}</p>
                            {conn.lastSynced && (
                              <p className="text-xs text-muted-foreground">Last synced: {new Date(conn.lastSynced).toLocaleDateString()}</p>
                            )}
                          </div>
                        </div>
                        <Badge
                          variant={conn.status === "connected" ? "default" : conn.status === "expired" ? "destructive" : "secondary"}
                          data-testid={`badge-connection-status-${conn.id}`}
                        >
                          {conn.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                <Separator />
                <Link href="/connections">
                  <Button variant="outline" size="sm" data-testid="button-manage-connections">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Connections
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>}

        {/* API Integration (US Only) */}
        {isUS && <Card>
          <CardHeader>
            <CardTitle className="text-base">API Integration</CardTitle>
            <CardDescription>FHIR endpoints and interoperability settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>FHIR Endpoint</Label>
                  <p className="text-sm text-muted-foreground font-mono" data-testid="text-fhir-endpoint">
                    {window.location.origin}/api/fhir/r4
                  </p>
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label>TEFCA Participation</Label>
                  <p className="text-sm text-muted-foreground">
                    Trusted Exchange Framework and Common Agreement
                  </p>
                </div>
              </div>
              <Badge variant="secondary" data-testid="badge-tefca-status">Active</Badge>
            </div>
            <Separator />
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/tefca-hub">
                <Button variant="outline" size="sm" data-testid="link-tefca-hub">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  TEFCA Hub
                </Button>
              </Link>
              <Link href="/fhir-api-explorer">
                <Button variant="outline" size="sm" data-testid="link-fhir-api-explorer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  FHIR API Explorer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>}

        {/* Install App */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Install App</CardTitle>
            <CardDescription>Get Tabula Medica on your mobile device</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <Smartphone className="h-5 w-5 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm mb-3">
                  Tabula Medica is a Progressive Web App (PWA). You can install it on your device for quick access and offline capabilities.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>iOS:</strong> Tap Share button, then "Add to Home Screen"</p>
                  <p><strong>Android:</strong> Tap menu (3 dots), then "Install app" or "Add to Home Screen"</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback & Suggestions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Feedback & Suggestions
            </CardTitle>
            <CardDescription>
              Help us improve Tabula Medica — we'd love to hear from you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FeedbackForm />
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-0.5" />
              <div>
                <p className="font-medium">Tabula Medica</p>
                <p className="text-sm text-muted-foreground mb-2">Version 1.0.0</p>
                <p className="text-sm text-muted-foreground">
                  Your unified healthcare dashboard. Connect multiple EHR platforms, view patient records, 
                  and get AI-powered health summaries all in one place.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-settings-disclaimer" />
      </div>
    </div>
  );
}
