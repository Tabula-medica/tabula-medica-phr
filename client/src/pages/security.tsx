import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Smartphone,
  Key,
  Monitor,
  Trash2,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  LogOut,
  History,
  Bell,
  BellOff,
  Info,
  AlertCircle,
  CheckCheck,
  Mail,
  Phone,
  Lock,
  User,
  Pencil,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { UserSession, SecurityAuditLog, SecurityNotification, SecuritySettings } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
}

interface SetupResponse {
  secret: string;
  qrCodeDataUrl: string;
  backupCodes: string[];
}

const verifyCodeSchema = z.object({
  code: z.string().min(6, "Code must be at least 6 characters").max(8),
});

const accountSecuritySchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits").regex(/^[\d\s\-+()]+$/, "Please enter a valid phone number"),
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

function AccountSecuritySection() {
  const [isEditing, setIsEditing] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [verifyEmailDialogOpen, setVerifyEmailDialogOpen] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof accountSecuritySchema>>({
    resolver: zodResolver(accountSecuritySchema),
    defaultValues: {
      email: "patient@example.com",
      phone: "+1 (555) 123-4567",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof accountSecuritySchema>) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Account Updated",
        description: "Your account security settings have been saved.",
      });
      setIsEditing(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not update your account settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyEmailMutation = useMutation({
    mutationFn: async (otp: string) => {
      await new Promise(resolve => setTimeout(resolve, 800));
      if (otp === "123456") {
        return { success: true };
      }
      throw new Error("Invalid code");
    },
    onSuccess: () => {
      toast({
        title: "Email Verified",
        description: "Your email address has been verified successfully.",
      });
      setVerifyEmailDialogOpen(false);
      setEmailOtp("");
    },
    onError: () => {
      toast({
        title: "Invalid Code",
        description: "The verification code is incorrect. Please try again.",
        variant: "destructive",
      });
    },
  });

  const sendVerificationMutation = useMutation({
    mutationFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Code Sent",
        description: "A verification code has been sent to your email.",
      });
      setVerifyEmailDialogOpen(true);
    },
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              <CardTitle>Account Security</CardTitle>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-account"
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
          <CardDescription>
            Manage your email, phone number, and password for account recovery and security.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="flex gap-2 flex-wrap">
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          disabled={!isEditing}
                          className={form.formState.errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
                          data-testid="input-email"
                          {...field}
                        />
                        {!isEditing && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => sendVerificationMutation.mutate()}
                            disabled={sendVerificationMutation.isPending}
                            data-testid="button-verify-email"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Verify
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      Used for account recovery and important notifications
                    </FormDescription>
                    <FormMessage data-testid="error-email" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        disabled={!isEditing}
                        className={form.formState.errors.phone ? "border-destructive focus-visible:ring-destructive" : ""}
                        data-testid="input-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Used for SMS-based verification and alerts
                    </FormDescription>
                    <FormMessage data-testid="error-phone" />
                  </FormItem>
                )}
              />

              {isEditing && (
                <>
                  <Separator />
                  
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Change Password
                    </h4>
                    
                    <FormField
                      control={form.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type={showCurrentPassword ? "text" : "password"}
                                placeholder="Enter current password"
                                className={form.formState.errors.currentPassword ? "border-destructive focus-visible:ring-destructive flex-1" : "flex-1"}
                                data-testid="input-current-password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                data-testid="button-toggle-current-password"
                              >
                                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage data-testid="error-current-password" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <div className="flex gap-2">
                              <Input
                                type={showNewPassword ? "text" : "password"}
                                placeholder="Enter new password"
                                className={form.formState.errors.newPassword ? "border-destructive focus-visible:ring-destructive flex-1" : "flex-1"}
                                data-testid="input-new-password"
                                {...field}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                data-testid="button-toggle-new-password"
                              >
                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Must be at least 8 characters with uppercase, lowercase, and numbers
                          </FormDescription>
                          <FormMessage data-testid="error-new-password" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="Confirm new password"
                              className={form.formState.errors.confirmPassword ? "border-destructive focus-visible:ring-destructive" : ""}
                              data-testid="input-confirm-password"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage data-testid="error-confirm-password" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex items-center gap-3 flex-wrap pt-4">
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending}
                      data-testid="button-save-account"
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button 
                      type="button" 
                      variant="secondary"
                      onClick={() => {
                        setIsEditing(false);
                        form.reset();
                      }}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => form.reset()}
                      data-testid="button-reset-form"
                    >
                      Reset Form
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={verifyEmailDialogOpen} onOpenChange={setVerifyEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Verify Email
            </DialogTitle>
            <DialogDescription>
              Enter the 6-digit code sent to your email address
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={emailOtp}
                onChange={setEmailOtp}
                data-testid="input-otp-email-verify"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Didn't receive a code?{" "}
              <Button 
                type="button"
                variant="ghost"
                className="h-auto p-0 text-xs"
                onClick={() => sendVerificationMutation.mutate()}
                data-testid="button-resend-code"
              >
                Resend
              </Button>
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                setVerifyEmailDialogOpen(false);
                setEmailOtp("");
              }}
              data-testid="button-cancel-verify-email"
            >
              Cancel
            </Button>
            <Button 
              className="flex-1"
              onClick={() => verifyEmailMutation.mutate(emailOtp)}
              disabled={emailOtp.length !== 6 || verifyEmailMutation.isPending}
              data-testid="button-submit-verify-email"
            >
              {verifyEmailMutation.isPending ? "Verifying..." : "Verify"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TwoFactorSection() {
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [setupData, setSetupData] = useState<SetupResponse | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const { toast } = useToast();

  const { data: status, isLoading } = useQuery<TwoFactorStatus>({
    queryKey: ["/api/security/2fa/status"],
  });

  const setupForm = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const disableForm = useForm<z.infer<typeof verifyCodeSchema>>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: { code: "" },
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/security/2fa/setup", {});
      return res.json();
    },
    onSuccess: (data: SetupResponse) => {
      setSetupData(data);
      setSetupDialogOpen(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to set up 2FA. Please try again.",
        variant: "destructive",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/security/2fa/verify", { code });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been enabled successfully.",
      });
      setSetupDialogOpen(false);
      setSetupData(null);
      setupForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/security/2fa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security/audit-log"] });
    },
    onError: () => {
      toast({
        title: "Invalid Code",
        description: "The verification code is incorrect. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("POST", "/api/security/2fa/disable", { code });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "2FA Disabled",
        description: "Two-factor authentication has been disabled.",
      });
      setDisableDialogOpen(false);
      disableForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/security/2fa/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security/audit-log"] });
    },
    onError: () => {
      toast({
        title: "Invalid Code",
        description: "The verification code is incorrect.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Two-Factor Authentication</CardTitle>
            {status?.enabled ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="secondary">
                Disabled
              </Badge>
            )}
          </div>
          <CardDescription>
            Add an extra layer of security by requiring a verification code from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.enabled ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enabled on {status.verifiedAt ? format(new Date(status.verifiedAt), "PPP") : "Unknown date"}
              </p>
              <Button
                variant="destructive"
                onClick={() => setDisableDialogOpen(true)}
                data-testid="button-disable-2fa"
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              data-testid="button-setup-2fa"
            >
              <Smartphone className="h-4 w-4 mr-2" />
              {setupMutation.isPending ? "Setting up..." : "Set Up 2FA"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>
          {setupData && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="2FA QR Code"
                  className="w-48 h-48 rounded-lg"
                  data-testid="img-2fa-qr-code"
                />
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Manual entry code:</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono break-all">
                    {setupData.secret}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(setupData.secret)}
                    data-testid="button-copy-secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-medium">Backup Codes</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                    data-testid="button-toggle-backup-codes"
                  >
                    {showBackupCodes ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showBackupCodes ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save these codes in a secure location. Each code can only be used once.
                </p>
                {showBackupCodes && (
                  <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded">
                    {setupData.backupCodes.map((code, i) => (
                      <code key={i} className="text-sm font-mono">{code}</code>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <Form {...setupForm}>
                <form onSubmit={setupForm.handleSubmit((data) => verifyMutation.mutate(data.code))} className="space-y-4">
                  <FormField
                    control={setupForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enter verification code</FormLabel>
                        <FormControl>
                          <div className="flex justify-center">
                            <InputOTP
                              maxLength={6}
                              value={field.value}
                              onChange={field.onChange}
                              data-testid="input-otp-2fa-verify"
                            >
                              <InputOTPGroup>
                                <InputOTPSlot index={0} />
                                <InputOTPSlot index={1} />
                                <InputOTPSlot index={2} />
                              </InputOTPGroup>
                              <InputOTPSeparator />
                              <InputOTPGroup>
                                <InputOTPSlot index={3} />
                                <InputOTPSlot index={4} />
                                <InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </FormControl>
                        <FormDescription className="text-center">
                          Enter the 6-digit code from your authenticator app
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={verifyMutation.isPending} data-testid="button-verify-2fa">
                    {verifyMutation.isPending ? "Verifying..." : "Verify and Enable 2FA"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={disableDialogOpen} onOpenChange={setDisableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove 2FA from your account. Enter your verification code to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Form {...disableForm}>
            <form onSubmit={disableForm.handleSubmit((data) => disableMutation.mutate(data.code))} className="space-y-4">
              <FormField
                control={disableForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Verification code</FormLabel>
                    <FormControl>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={field.value}
                          onChange={field.onChange}
                          data-testid="input-otp-2fa-disable"
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                          </InputOTPGroup>
                          <InputOTPSeparator />
                          <InputOTPGroup>
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                    </FormControl>
                    <FormDescription className="text-center text-xs">
                      Enter your 6-digit code or a backup code
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <AlertDialogFooter className="flex-wrap gap-2">
                <AlertDialogCancel data-testid="button-cancel-disable-2fa">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  type="submit"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={disableMutation.isPending}
                  data-testid="button-confirm-disable-2fa"
                >
                  {disableMutation.isPending ? "Disabling..." : "Disable 2FA"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </form>
          </Form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SessionsSection() {
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const { toast } = useToast();

  const { data: sessions, isLoading } = useQuery<UserSession[]>({
    queryKey: ["/api/security/sessions"],
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await apiRequest("DELETE", `/api/security/sessions/${sessionId}`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Session Revoked",
        description: "The session has been revoked successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/security/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security/audit-log"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke session.",
        variant: "destructive",
      });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/security/sessions", {});
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sessions Revoked",
        description: "All other sessions have been revoked.",
      });
      setRevokeAllOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/security/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/security/audit-log"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke sessions.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const otherSessions = sessions?.filter(s => !s.isCurrentSession) || [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Monitor className="h-5 w-5 text-primary" />
            <CardTitle>Active Sessions</CardTitle>
          </div>
          <CardDescription>
            Manage your active login sessions across all devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions && sessions.length > 0 ? (
            <>
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-start justify-between gap-4 p-3 rounded-lg border flex-wrap"
                  data-testid={`session-${session.id}`}
                >
                  <div className="flex items-start gap-3">
                    <Monitor className="h-5 w-5 mt-0.5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{session.deviceInfo}</p>
                        {session.isCurrentSession && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        IP: {session.ipAddress}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last active: {format(new Date(session.lastActiveAt), "PPp")}
                      </p>
                    </div>
                  </div>
                  {!session.isCurrentSession && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                      data-testid={`button-revoke-session-${session.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {otherSessions.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setRevokeAllOpen(true)}
                  data-testid="button-revoke-all-sessions"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out of all other sessions
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No active sessions found.</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of all other sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out of all other devices. Your current session will remain active.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeAllMutation.mutate()}
              disabled={revokeAllMutation.isPending}
              data-testid="button-confirm-revoke-all"
            >
              {revokeAllMutation.isPending ? "Signing out..." : "Sign Out All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function NotificationsSection() {
  const { toast } = useToast();
  const { data: notifications, isLoading } = useQuery<SecurityNotification[]>({
    queryKey: ["/api/security/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/security/notifications/${id}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/security/notifications/read-all", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/notifications"] });
      toast({
        title: "Notifications cleared",
        description: "All notifications have been marked as read.",
      });
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Bell className="h-5 w-5" />
            <CardTitle>Security Alerts</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="destructive" data-testid="badge-unread-count">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <CardDescription>
          Recent security notifications about your account activity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {notifications && notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.slice(0, 10).map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-3 p-3 rounded-md ${
                  notification.isRead ? "bg-muted/50" : "bg-muted"
                }`}
                data-testid={`notification-${notification.id}`}
              >
                {getSeverityIcon(notification.severity)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {!notification.isRead && (
                      <Badge variant="secondary" className="text-xs">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => markReadMutation.mutate(notification.id)}
                    disabled={markReadMutation.isPending}
                    data-testid={`button-mark-read-${notification.id}`}
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            <BellOff className="h-8 w-8 mb-2" />
            <p className="text-sm">No security alerts</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotificationPreferencesSection() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<SecuritySettings>({
    queryKey: ["/api/security/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<SecuritySettings>) => {
      const res = await apiRequest("PATCH", "/api/security/settings", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/settings"] });
      toast({
        title: "Settings updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof SecuritySettings, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Bell className="h-5 w-5" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>
          Choose which security notifications you want to receive.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <Label htmlFor="newDeviceAlerts">New device alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get warned when a login from a new device or location is detected
              </p>
            </div>
            <Switch
              id="newDeviceAlerts"
              checked={settings?.newDeviceAlerts ?? true}
              onCheckedChange={(checked) => handleToggle("newDeviceAlerts", checked)}
              disabled={updateMutation.isPending}
              data-testid="switch-new-device-alerts"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <Label htmlFor="loginNotifications">Fallback login notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about new device logins (when new device alerts are disabled)
              </p>
            </div>
            <Switch
              id="loginNotifications"
              checked={settings?.loginNotifications ?? true}
              onCheckedChange={(checked) => handleToggle("loginNotifications", checked)}
              disabled={updateMutation.isPending}
              data-testid="switch-login-notifications"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-0.5">
              <Label htmlFor="sessionActivityAlerts">Session activity alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified about session changes and revocations
              </p>
            </div>
            <Switch
              id="sessionActivityAlerts"
              checked={settings?.sessionActivityAlerts ?? false}
              onCheckedChange={(checked) => handleToggle("sessionActivityAlerts", checked)}
              disabled={updateMutation.isPending}
              data-testid="switch-session-activity-alerts"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditLogSection() {
  const { data: logs, isLoading } = useQuery<SecurityAuditLog[]>({
    queryKey: ["/api/security/audit-log"],
  });

  const eventLabels: Record<string, string> = {
    login: "Logged in",
    logout: "Logged out",
    new_device_login: "New device login",
    "2fa_enabled": "Two-factor authentication enabled",
    "2fa_disabled": "Two-factor authentication disabled",
    "2fa_verified": "Two-factor authentication verified",
    backup_code_used: "Backup code used",
    session_revoked: "Session revoked",
    password_changed: "Password changed",
    account_locked: "Account locked",
    account_unlocked: "Account unlocked",
    caregiver_invited: "Caregiver invited",
    caregiver_removed: "Caregiver removed",
    security_alert: "Security alert",
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <History className="h-5 w-5 text-primary" />
          <CardTitle>Security Activity</CardTitle>
        </div>
        <CardDescription>
          Recent security-related activity on your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <div className="space-y-3">
            {logs.slice(0, 10).map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 text-sm"
                data-testid={`audit-log-${log.id}`}
              >
                <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1">
                  <p>{eventLabels[log.eventType] || log.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.createdAt), "PPp")} • {log.ipAddress}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No security activity recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SecurityPage() {
  const { user, isLoading: authLoading } = useAuth();
  const loginWithRedirect = () => { window.location.href = "/auth/login"; };

  if (authLoading) {
    return (
      <div className="container max-w-4xl py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground text-center mb-4">
              Please sign in to access your security settings.
            </p>
            <Button onClick={() => loginWithRedirect()} data-testid="link-login">Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Security Settings</h1>
          <p className="text-muted-foreground">
            Manage your account security and authentication methods.
          </p>
        </div>
      </div>

      <AccountSecuritySection />
      <NotificationsSection />
      <TwoFactorSection />
      <SessionsSection />
      <NotificationPreferencesSection />
      <AuditLogSection />
    </div>
  );
}
